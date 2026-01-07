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
const getSystemLogsHandler = require('./api/admin/system-logs');
const loginHandler = require('./api/auth/login');
const categoriesHandler = require('./api/categories');
const configHandler = require('./api/config'); // 引入新文件
const alertsHandler = require('./api/alerts'); // 引入新文件
const usersHandler = require('./api/users');   // 新增
const noticesHandler = require('./api/notices'); // 新增
const suppliersHandler = require('./api/suppliers'); // 引入新文件
const app = express();
const server = http.createServer(app);

// 2. 新增：初始化 Supabase Admin 客户端
// 使用 Service Role Key 以便后端拥有足够的权限（例如写入系统日志、读取用户详情）
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 允许跨域
// ✅ 添加 'PATCH'
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS', 'DELETE', 'PATCH'] }));
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
app.post('/api/auth/login', async (req, res) => {await loginHandler(req, res);});

// 2. [新增] 系统日志 API
// 替代前端直接写库的操作
// app.post('/api/system-log', systemLogHandler);

app.post('/api/system-log', async (req, res) => {await systemLogHandler(req, res);});

app.get('/api/admin/system-logs', async (req, res) => {
    await getSystemLogsHandler(req, res);
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

//  新增config API
app.get('/api/config', async (req, res) => {
    await configHandler(req, res);
});
//添加catogories API
app.get('/api/categories', async (req, res) => {
    await categoriesHandler(req, res);
});

// 添加alerts API
app.all('/api/alerts', async (req, res) => {
    await alertsHandler(req, res);
});

// 添加users API
app.all('/api/users', async (req, res) => {
    await usersHandler(req, res);
});

// 添加suppliers API
app.get('/api/suppliers', async (req, res) => {
    await suppliersHandler(req, res);
});

// 添加notices API
app.all('/api/notices', async (req, res) => {
    await noticesHandler(req, res);
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