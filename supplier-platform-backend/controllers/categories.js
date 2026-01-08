const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

// --- 1. 初始化 CORS 中间件 ---
const corsMiddleware = cors({
    origin: true,
    methods: ['GET', 'OPTIONS'], // 获取分类只需要 GET
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With', 'Accept', 'Accept-Version', 'Content-Length', 'Content-MD5', 'Date', 'X-Api-Version'],
    credentials: true,
});

// --- 2. 辅助函数：运行中间件 ---
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

// --- 3. 主处理函数 ---
module.exports = async (req, res) => {
    // [Step A] 手动设置 CORS 头（双重保险）
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // [Step B] 处理 OPTIONS 预检请求
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // [Step C] 运行 CORS 中间件
    try {
        await runMiddleware(req, res, corsMiddleware);
    } catch (e) {
        console.error("CORS Middleware Error:", e);
        return res.status(500).json({ error: 'Internal Server Error (CORS)' });
    }

    // [Step D] 检查请求方法
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // ==========================================
    // --- 业务逻辑：获取分类列表 ---
    // ==========================================
    try {
        // 初始化 Supabase Admin
        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // 1. 查询数据库
        const { data, error } = await supabaseAdmin
            .from('notice_categories')
            .select('name')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('[Categories] Fetch failed:', error.message);
            return res.status(500).json({ error: error.message });
        }

        // 2. 数据转换：[{name: 'A'}, {name: 'B'}] => ['A', 'B']
        // 在后端做转换，前端代码改动最小
        const categoryNames = data.map(c => c.name);

        // 3. 返回结果
        res.status(200).json(categoryNames);

    } catch (error) {
        console.error('[Categories] Handler error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};