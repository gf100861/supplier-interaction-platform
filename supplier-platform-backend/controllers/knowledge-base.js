const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

// --- 1. 初始化 CORS 中间件 ---
const corsMiddleware = cors({
    origin: true,
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With', 'Accept', 'Accept-Version', 'Content-Length', 'Content-MD5', 'Date', 'X-Api-Version'],
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

// --- 3. 主处理函数 ---
module.exports = async (req, res) => {
    // [Step A] 手动设置 CORS 头
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept'); // ✅ 必须包含 Authorization
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // [Step B] 处理 OPTIONS 预检请求
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        // [Step C] 运行 CORS 中间件
        await runMiddleware(req, res, corsMiddleware);

        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // ============================================================
        // 🔒 安全验证逻辑 (新增)
        // ============================================================

        // 1. 获取 Authorization 头
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: Missing token' });
        }

        const token = authHeader.split(' ')[1];

        // 2. 验证 Token 有效性
        // 只要是登录用户，都允许读取知识库标签（用于自动补全等）
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }

        // ============================================================
        // 🔓 业务逻辑
        // ============================================================

        // --- GET: 获取特定供应商的历史标签 ---
        if (req.method === 'GET') {
            const { supplierParmaId } = req.query;

            if (!supplierParmaId) {
                return res.status(400).json({ error: 'Missing supplierParmaId' });
            }

            // 查询知识库
            const { data, error } = await supabaseAdmin
                .from('knowledge_base')
                .select('problem_source, cause')
                .eq('supplier_parma_id', supplierParmaId);

            if (error) throw error;
            return res.json(data);
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('[KnowledgeBase API] Error:', error);
        res.status(500).json({ error: error.message });
    }
};