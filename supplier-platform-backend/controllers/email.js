const nodemailer = require('nodemailer');
const cors = require('cors');

// --- 1. 初始化 CORS 中间件 ---
const corsMiddleware = cors({
    origin: true,
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
});

// --- 2. 辅助函数：运行中间件 ---
function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) return reject(result);
            return resolve(result);
        });
    });
}

// --- 3. 辅助函数：创建 Transporter (复用配置) ---
const createTransporter = () => {
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: smtpPort,
        secure: smtpPort === 465, // 465=SSL, 587=STARTTLS
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        // 增加超时设置，防止 Vercel 连接抖动
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
        tls: {
            rejectUnauthorized: false // 兼容性设置
        }
    });
};

// ==========================================
// --- Handler 1: 发送安全警报邮件 (Alert) ---
// ==========================================
exports.sendAlertEmail = async (req, res) => {
    // CORS & Method Check
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await runMiddleware(req, res, corsMiddleware);
        
        const { recipients, supplierCount, user, timestamp } = req.body;

        if (!recipients?.length) {
            return res.status(400).json({ error: 'Missing recipients' });
        }

        const transporter = createTransporter();
        const info = await transporter.sendMail({
            from: `"SD Platform Security" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
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
            `
        });

        console.log('[Email] Alert sent:', info.messageId);
        res.status(200).json({ success: true, messageId: info.messageId });

    } catch (error) {
        console.error('[Email] Alert failed:', error);
        res.status(500).json({ error: error.message });
    }
};

// ==========================================
// --- Handler 2: 发送普通通知邮件 (General) ---
// ==========================================
exports.sendGeneralEmail = async (req, res) => {
    // CORS & Method Check
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await runMiddleware(req, res, corsMiddleware);

        const { to, subject, html } = req.body;

        if (!to || !subject || !html) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const transporter = createTransporter();
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
            to: Array.isArray(to) ? to.join(',') : to,
            subject: subject,
            html: html,
        });

        console.log('[Email] General sent:', info.messageId);
        res.status(200).json({ success: true, messageId: info.messageId });

    } catch (error) {
        console.error('[Email] General failed:', error);
        res.status(500).json({ error: error.message });
    }
};