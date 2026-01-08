const nodemailer = require('nodemailer');
const cors = require('cors');

// 初始化 CORS 中间件
const corsMiddleware = cors({
    origin: '*', // 生产环境建议替换为具体前端域名
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
});

// 辅助函数：运行中间件
function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
}

module.exports = async (req, res) => {
    // 1. 运行 CORS
    await runMiddleware(req, res, corsMiddleware);

    // 2. 处理 OPTIONS 请求
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { to, subject, html } = req.body;

    if (!to || !subject || !html) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // 3. 配置 Nodemailer (适配 Hotmail/Outlook)
    // Hotmail 通常使用 smtp-mail.outlook.com, 端口 587, secure: false (STARTTLS)
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp-mail.outlook.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // 587 端口通常为 false (STARTTLS)
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        tls: {
            // 这行配置对某些 Microsoft 服务器很重要，防止握手错误
            ciphers: 'SSLv3',
            rejectUnauthorized: false
        }
    });

    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER, // 发件人
            to: Array.isArray(to) ? to.join(',') : to,
            subject: subject,
            html: html,
        });

        console.log('Message sent: %s', info.messageId);
        return res.status(200).json({ success: true, messageId: info.messageId });
    } catch (error) {
        console.error('Email sending failed:', error);
        return res.status(500).json({ error: error.message || 'Failed to send email' });
    }
};