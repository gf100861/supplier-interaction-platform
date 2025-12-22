require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const nodemailer = require('nodemailer');

// --- 引入 API 处理逻辑 ---
const createUserHandler = require('./api/create-user');
const deleteUserHandler = require('./api/delete-user'); // 引入 delete-user

const app = express();
const server = http.createServer(app);

// 允许跨域
// 注意：origin: '*' 方便开发，生产环境建议指定具体域名
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS', 'DELETE'] })); 
app.use(express.json());

// --- 1. Socket.IO (仅本地有效) ---
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

// 注册 Create User 路由
// 使用 app.all 捕获 POST 和 OPTIONS 请求
app.all('/api/create-user', async (req, res) => {
    await createUserHandler(req, res);
});

// 注册 Delete User 路由
// 同样使用 app.all 以支持 OPTIONS 预检请求
app.all('/api/delete-user', async (req, res) => {
    await deleteUserHandler(req, res);
});


// --- 2. 邮件 API ---
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

// --- 3. 启动本地服务器 ---
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`✅ Local Backend running on http://localhost:${PORT}`);
    console.log(`📧 Email endpoint: http://localhost:${PORT}/api/send-alert-email`);
    console.log(`👤 Create User endpoint: http://localhost:${PORT}/api/create-user`);
    console.log(`🗑️ Delete User endpoint: http://localhost:${PORT}/api/delete-user`);
});