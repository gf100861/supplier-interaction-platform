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

    // [Step D] 检查请求方法 (改为 GET)
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // ==========================================
    // --- 业务逻辑：查询系统日志 ---
    // ==========================================
    try {
        // 初始化 Supabase Admin (每次请求独立初始化)
        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // 1. 从 Query 参数获取筛选条件 (注意：GET请求的数据在 req.query 中)
        const { 
            current = 1, 
            pageSize = 10, 
            severity, 
            eventType, 
            search, 
            startDate, 
            endDate 
        } = req.query;

        // 2. 构建查询
        let query = supabaseAdmin
            .from('system_logs')
            .select('*', { count: 'exact' });

        // 3. 应用筛选条件
        if (severity) {
            query = query.eq('severity', severity);
        }
        if (eventType) {
            query = query.ilike('event_type', `%${eventType}%`);
        }
        if (search) {
            // 支持搜索消息、邮箱或类别
            query = query.or(`message.ilike.%${search}%,user_email.ilike.%${search}%,category.ilike.%${search}%`);
        }
        if (startDate) {
            query = query.gte('created_at', startDate);
        }
        if (endDate) {
            query = query.lte('created_at', endDate);
        }

        // 4. 应用分页
        const pageNum = parseInt(current);
        const sizeNum = parseInt(pageSize);
        const from = (pageNum - 1) * sizeNum;
        const to = from + sizeNum - 1;

        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('[Logs] Fetch failed:', error.message);
            return res.status(500).json({ error: error.message });
        }

        // 5. 成功返回
        res.status(200).json({
            success: true,
            data,
            total: count
        });

    } catch (error) {
        console.error('[Logs] Handler error:', error);
        res.status(500).json({ error: error.message });
    }
};