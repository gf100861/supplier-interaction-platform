const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

// --- 1. 初始化 CORS 中间件 ---
const corsMiddleware = cors({
    origin: true, // 允许所有 Origin
    methods: ['GET', 'POST', 'OPTIONS'],
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
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
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
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // ==========================================
    // --- 业务逻辑：写入系统日志 ---
    // ==========================================
    try {
        // 初始化 Supabase Admin (每次请求独立初始化)
        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const logData = req.body;

        // 简单校验
        if (!logData) {
            return res.status(400).json({ error: 'Missing log data' });
        }

        // 写入数据库
        const { error } = await supabaseAdmin.from('system_logs').insert([logData]);

        if (error) {
            console.error('[Log] Insert failed:', error.message);
            return res.status(500).json({ error: error.message });
        }

        // 成功返回
        res.status(200).json({ success: true });

    } catch (error) {
        console.error('[Log] Handler error:', error);
        res.status(500).json({ error: error.message });
    }
};