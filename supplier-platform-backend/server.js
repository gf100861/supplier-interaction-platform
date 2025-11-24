require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const server = http.createServer(app);

// 允许跨域
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json());

// --- 1. Socket.IO (仅本地有效，Vercel 不支持 WebSocket) ---
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
    console.log('Local Socket connected:', socket.id);
    // ... 保留原有的 socket 逻辑 ...
    socket.on('disconnect', () => console.log('User disconnected:', socket.id));
});

// --- 2. 邮件 API (为了本地调试，逻辑与 api/send-alert-email.js 保持一致) ---
app.post('/api/send-alert-email', async (req, res) => {
    console.log('Local Server receiving email request...');
    const { recipients, supplierCount, user, timestamp } = req.body;

    // 简单的参数校验
    if (!recipients || !recipients.length) return res.status(400).json({ error: 'No recipients' });

    // 读取环境变量
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
            connectionTimeout: 10000, // 10秒超时
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
});