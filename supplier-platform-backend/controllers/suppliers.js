const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

// --- 1. 初始化 CORS 中间件 ---
const corsMiddleware = cors({
    origin: true,
    methods: ['GET', 'OPTIONS'],
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
    // [CORS]
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await runMiddleware(req, res, corsMiddleware);

        // 初始化 Supabase
        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

          // ============================================================
        // 🔒 安全验证逻辑开始
        // ============================================================
        
        // 1. 获取 Authorization 头
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
        }

        // 2. 提取 Token
        const token = authHeader.split(' ')[1];

        // 3. 验证 Token 有效性 (获取用户信息)
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }

        // 查询数据库
        const { data, error } = await supabaseAdmin
            .from('suppliers')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('[Suppliers] Fetch failed:', error.message);
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json(data);

    } catch (error) {
        console.error('[Suppliers API] Error:', error);
        return res.status(500).json({ error: error.message });
    }
};