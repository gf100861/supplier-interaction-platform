// supplier-platform-backend/controllers/auth/update-password.js
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

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
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await runMiddleware(req, res, corsMiddleware);

        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        if (req.method === 'POST') {
            const { password } = req.body; 

            // 1. 检查密码是否为空
            if (!password) {
                console.error('[Update Password] Error: Password is missing in body');
                return res.status(400).json({ error: 'Password is required' });
            }

            // 2. 获取 Authorization Header
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                console.error('[Update Password] Error: Missing Authorization header');
                return res.status(401).json({ error: 'Missing Authorization header' });
            }

            // 3. 解析 Token
            const token = authHeader.replace('Bearer ', '');
            
            // 4. 让 Supabase 验证 Token 并获取用户信息
            const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

            if (authError || !user) {
                console.error('[Update Password] Invalid Token:', authError?.message);
                return res.status(401).json({ error: 'Invalid or expired token' });
            }

            // 5. 获取真实的 User ID (核心步骤)
            const safeUserId = user.id;

            // --- 🔍 调试日志 (关键) ---
            console.log("--------------------------------------------------");
            console.log("[Update Password Debug]");
            console.log("User Email:", user.email);
            console.log("Resolved User ID (safeUserId):", safeUserId); 
            console.log("--------------------------------------------------");

            // 6. 再次检查 ID 是否有效
            if (!safeUserId) {
                return res.status(500).json({ error: 'Failed to resolve User ID from token' });
            }

            // 7. 执行修改
            // ⚠️ 注意：这里必须使用 safeUserId，不要使用 req.body.userId
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                safeUserId, 
                { password: password }
            );

            if (updateError) {
                console.error('[Update Password] Supabase Update Error:', updateError);
                throw updateError;
            }

            console.log("[Update Password] Success!");
            return res.json({ success: true, message: 'Password updated successfully' });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('[Update Password API] System Error:', error);
        res.status(500).json({ error: error.message });
    }
};