// supplier-platform-backend/api/send-email.js
const nodemailer = require('nodemailer');
const cors = require('cors');

// CORS 配置
const corsMiddleware = cors({
    origin: '*',
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
});

function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) return reject(result);
            return resolve(result);
        });
    });
}

module.exports = async (req, res) => {
    await runMiddleware(req, res, corsMiddleware);

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // 1. 接收动态参数
    const { to, subject, html, text } = req.body;

    if (!to || !subject || (!html && !text)) {
        return res.status(400).json({ error: 'Missing required fields (to, subject, content)' });
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpUser || !smtpPass) {
        return res.status(500).json({ error: 'SMTP configuration missing' });
    }

    try {
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: { user: smtpUser, pass: smtpPass },
            tls: { rejectUnauthorized: false }
        });

        // 2. 发送邮件
        const info = await transporter.sendMail({
            from: `"Supplier Platform" <${process.env.SMTP_FROM_EMAIL || smtpUser}>`,
            to: Array.isArray(to) ? to.join(',') : to, // 支持数组或字符串
            subject: subject,
            text: text, // 纯文本回退
            html: html  // HTML 内容
        });

        console.log('Email sent:', info.messageId);
        return res.status(200).json({ success: true, messageId: info.messageId });

    } catch (error) {
        console.error('Email Error:', error);
        return res.status(500).json({ error: error.message });
    }
};