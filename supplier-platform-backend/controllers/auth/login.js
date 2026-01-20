const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

// --- 1. 初始化 CORS 中间件 ---
const corsMiddleware = cors({
    origin: true,
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With', 'Accept', 'Accept-Version', 'Content-Length', 'Content-MD5', 'Date', 'X-Api-Version'],
    credentials: true,
});

// --- 2. 辅助函数 ---
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
    // [Step A] CORS Headers
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        await runMiddleware(req, res, corsMiddleware);
    } catch (e) {
        console.error("CORS Middleware Error:", e);
        return res.status(500).json({ error: 'Internal Server Error (CORS)' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // ==========================================
    // --- 业务逻辑：用户登录 ---
    // ==========================================
    try {
        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        console.log(`[Auth] Attempting login for: ${email}`);
        
        // 1. 验证账号密码 (Supabase Auth 会自动比对哈希，很安全)
        const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            console.warn('[Auth] Login failed:', authError.message);
            return res.status(401).json({ error: '登录凭证无效或密码错误' });
        }

        // 2. 获取用户详细信息
        // ⚠️【安全修改】：显式指定字段，避免使用 *，防止误传敏感字段
        const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select(`
                id, 
                username, 
                email, 
                role, 
                supplier_id, 
                created_at,
                managed_suppliers:sd_supplier_assignments(supplier:suppliers(*))
            `)
            .eq('id', authData.user.id)
            .single();

        if (userError) {
            console.error('[Auth] User profile fetch error:', userError);
            return res.status(500).json({ error: '无法获取用户信息' });
        }

        console.log(`[Auth] Login success: ${email}`);
        
        // 3. 返回数据
        res.status(200).json({
            success: true,
            user: userData,
            session: authData.session 
        });

    } catch (error) {
        console.error('[Auth] Unexpected error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};