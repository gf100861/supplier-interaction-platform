require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const nodemailer = require('nodemailer');

// --- 新增：引入 create-user 处理逻辑 ---
// ⚠️ 注意：请确保 api/create-user.js 里的语法错误已经按照上一步修复，
// 否则这里引入时会导致服务器启动报错。
const createUserHandler = require('./api/create-user');

const app = express();
const server = http.createServer(app);

// 允许跨域
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] })); // 建议把 OPTIONS 也加上
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
// --- 新增：注册 Create User 路由 ---
// ==========================================
app.all('/api/create-user', async (req, res) => {
    // 将请求转发给 api/create-user.js 处理
    await createUserHandler(req, res);
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
    console.log(`👤 Create User endpoint: http://localhost:${PORT}/api/create-user`); // 打印出来确认路由生效
});