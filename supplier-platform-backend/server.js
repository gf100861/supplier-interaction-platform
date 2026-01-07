require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const nodemailer = require('nodemailer');
// 1. 新增：引入 Supabase 客户端
const { createClient } = require('@supabase/supabase-js');

// --- 引入 API 处理逻辑 ---
const createUserHandler = require('./api/create-user');
const deleteUserHandler = require('./api/delete-user');
const smartSearchHandler = require('./api/smart-search');
const systemLogHandler = require('./api/system-log');
const app = express();
const server = http.createServer(app);

// 2. 新增：初始化 Supabase Admin 客户端
// 使用 Service Role Key 以便后端拥有足够的权限（例如写入系统日志、读取用户详情）
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 允许跨域
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS', 'DELETE'] })); 
app.use(express.json());

// --- Socket.IO (仅本地有效) ---
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
    console.log('Local Socket connected:', socket.id);
    socket.on('disconnect', () => console.log('User disconnected:', socket.id));
});

// ==========================================
// --- 注册 API 路由 ---
// ==========================================

// 1. [新增] 登录 API
// 替代前端原本的 supabase.auth.signInWithPassword
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        console.log(`[Auth] Attempting login for: ${email}`);
        
        // 1. 验证账号密码
        const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            console.warn('[Auth] Login failed:', authError.message);
            return res.status(401).json({ error: '登录凭证无效或密码错误' });
        }

        // 2. 获取用户详细信息 (关联 suppliers 表)
        const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select(`*, managed_suppliers:sd_supplier_assignments(supplier:suppliers(*))`)
            .eq('id', authData.user.id)
            .single();

        if (userError) {
            console.error('[Auth] User profile fetch error:', userError);
            return res.status(500).json({ error: '无法获取用户信息' });
        }

        console.log(`[Auth] Login success: ${email}`);
        
        // 3. 返回前端需要的数据
        res.json({
            success: true,
            user: userData,
            session: authData.session 
        });

    } catch (error) {
        console.error('[Auth] Unexpected error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 2. [新增] 系统日志 API
// 替代前端直接写库的操作
app.post('/api/system-log', systemLogHandler);

app.get('/api/admin/system-logs', async (req, res) => {
    try {
        // 1. 获取查询参数
        const { 
            current = 1, 
            pageSize = 10, 
            severity, 
            eventType, 
            search, 
            startDate, 
            endDate 
        } = req.query;

        // 2. 构建查询 (使用 supabaseAdmin，因为它有权限读所有日志)
        let query = supabaseAdmin
            .from('system_logs')
            .select('*', { count: 'exact' });

        // 3. 应用筛选条件
        if (severity) {
            query = query.eq('severity', severity);
        }
        if (eventType) {
            query = query.ilike('event_type', `%${eventType}%`);
        }
        if (search) {
            // 支持搜索消息、邮箱或类别
            query = query.or(`message.ilike.%${search}%,user_email.ilike.%${search}%,category.ilike.%${search}%`);
        }
        if (startDate) {
            query = query.gte('created_at', startDate);
        }
        if (endDate) {
            query = query.lte('created_at', endDate);
        }

        // 4. 应用分页
        const pageNum = parseInt(current);
        const sizeNum = parseInt(pageSize);
        const from = (pageNum - 1) * sizeNum;
        const to = from + sizeNum - 1;

        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        // 5. 返回结果
        res.json({
            data,
            total: count,
            success: true
        });

    } catch (error) {
        console.error('Fetch Logs Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 3. 原有 API: Create User
app.all('/api/create-user', async (req, res) => {
    await createUserHandler(req, res);
});

// 4. 原有 API: Delete User
app.all('/api/delete-user', async (req, res) => {
    await deleteUserHandler(req, res);
});

// 5. 原有 API: Smart Search
app.post('/api/smart-search', async (req, res) => {
    await smartSearchHandler(req, res);
});

// 6. 原有 API: 邮件发送
app.post('/api/send-alert-email', async (req, res) => {
    console.log('Local Server receiving email request...');
    const { recipients, supplierCount, user, timestamp } = req.body;

    if (!recipients || !recipients.length) return res.status(400).json({ error: 'No recipients' });

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpUser || !smtpPass) {
        console.error('Missing SMTP config in .env');
        return res.status(500).json({ error: 'SMTP config missing' });
    }

    try {
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: { user: smtpUser, pass: smtpPass },
            connectionTimeout: 10000, 
            tls: { rejectUnauthorized: false }
        });

        await transporter.sendMail({
            from: `"Local Dev" <${process.env.SMTP_FROM_EMAIL || smtpUser}>`,
            to: recipients.join(','),
            subject: `[本地测试] 异常导出拦截 - ${supplierCount} 家`,
            text: `用户 ${user} 尝试导出 ${supplierCount} 家供应商数据。时间: ${timestamp}`
        });

        console.log('Local email sent successfully');
        res.json({ success: true });
    } catch (error) {
        console.error('Local email failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- 启动服务器 ---
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`✅ Local Backend running on http://localhost:${PORT}`);
    console.log(`🔑 Login endpoint: http://localhost:${PORT}/api/auth/login`); // 打印确认
    console.log(`📝 Log endpoint: http://localhost:${PORT}/api/system-log`);   // 打印确认
    console.log(`📧 Email endpoint: http://localhost:${PORT}/api/send-alert-email`);
    console.log(`👤 Create User endpoint: http://localhost:${PORT}/api/create-user`);
    console.log(`🗑️ Delete User endpoint: http://localhost:${PORT}/api/delete-user`);
    console.log(`🧠 Smart Search endpoint: http://localhost:${PORT}/api/smart-search`);
});