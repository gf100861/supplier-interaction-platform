const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

// 初始化 CORS 中间件
const corsMiddleware = cors({
    origin: true,
    methods: ['POST', 'OPTIONS'],
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
    // 处理 OPTIONS 预检请求
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        await runMiddleware(req, res, corsMiddleware);

        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const { email, redirectTo } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // 初始化 Supabase Admin 客户端
        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        console.log(`[Auth] Sending password reset email to: ${email}`);

        // 调用 Supabase 发送重置邮件
        const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
            redirectTo: redirectTo || undefined // 如果前端没传，就用 Supabase 默认配置
        });

        if (error) {
            console.error('[Auth] Reset password error:', error);
            // 出于安全考虑，有时即便出错也不告诉前端具体原因（防止枚举邮箱），但开发阶段可以返回 error.message
            // 如果是 Rate Limit (429)，Supabase 会返回特定的错误
            throw error;
        }

        return res.status(200).json({ success: true, message: 'Password reset email sent' });

    } catch (error) {
        console.error('[Auth] Internal Error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
};