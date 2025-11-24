const nodemailer = require('nodemailer');
const cors = require('cors');

// 初始化 CORS 中间件 - 允许跨域
const corsMiddleware = cors({
    origin: '*', // 生产环境建议改为您的前端域名
    methods: ['POST', 'OPTIONS'],
});

// 辅助函数：在 Serverless 环境中运行中间件
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

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { recipients, supplierCount, user, timestamp } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: 'Missing recipients' });
    }

    // 获取环境变量
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpUser || !smtpPass) {
        return res.status(500).json({ error: 'Server SMTP configuration missing' });
    }

    try {
        // 2. 配置 SMTP
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            // 端口 465 用 SSL，587 用 STARTTLS (secure: false)
            secure: smtpPort === 465, 
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
            // 增加超时设置，防止 Vercel 连接外部 SMTP 偶尔的抖动
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 10000,
            tls: {
                rejectUnauthorized: false // 允许部分自签名证书，增加兼容性
            }
        });

        // 3. 邮件内容
        const mailOptions = {
            from: `"SD Platform Security" <${process.env.SMTP_FROM_EMAIL || smtpUser}>`,
            to: recipients.join(','),
            subject: `[安全警报] 异常数据导出拦截 - ${supplierCount} 家供应商`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 5px;">
                    <div style="background: #d32f2f; color: white; padding: 15px; text-align: center;">
                        <h2 style="margin:0;">数据安全警报</h2>
                    </div>
                    <div style="padding: 20px;">
                        <p>系统检测到以下异常操作，已触发风控拦截（单次 > 8家）：</p>
                        <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
                            <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>用户:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${user}</td></tr>
                            <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>数量:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;color:red;font-weight:bold;">${supplierCount} 家</td></tr>
                            <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>时间:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${timestamp}</td></tr>
                        </table>
                        <p style="font-size: 12px; color: #999;">此操作已被前端拦截，数据未流出。</p>
                    </div>
                </div>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent via Vercel:', info.messageId);
        
        return res.status(200).json({ success: true, messageId: info.messageId });

    } catch (error) {
        console.error('Vercel Email Error:', error);
        return res.status(500).json({ error: 'Failed to send email', details: error.message });
    }
};