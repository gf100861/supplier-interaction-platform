const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

// 初始化 CORS 中间件
const corsMiddleware = cors({
    origin: true, // 允许所有 Origin，并返回正确的 Access-Control-Allow-Origin
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With', 'Accept', 'Accept-Version', 'Content-Length', 'Content-MD5', 'Date', 'X-Api-Version'],
    credentials: true,
});

// 辅助函数：运行中间件
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
    // 1. 手动设置 CORS 头（双重保险）
    // 必须写在函数内部！
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // 2. 处理 OPTIONS 预检请求（直接返回成功，不再往下走）
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // 3. 运行 CORS 中间件
        await runMiddleware(req, res, corsMiddleware);
    } catch (e) {
        console.error("CORS Middleware Error:", e);
        return res.status(500).json({ error: 'Internal Server Error (CORS)' });
    }

    // 4. 检查请求方法
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // --- 业务逻辑 ---
    
    // 初始化 Supabase
    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY, // 确保 .env 里有这个 Key
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );

    const { email, password, username, role, supplierData } = req.body;

    if (!email || !password || !username || !role) {
        return res.status(400).json({ error: '缺少必要参数' });
    }

    try {
        // 创建 Auth 用户
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: { username: username, role: role }
        });

        if (authError) throw authError;
        const newUserId = authData.user.id;

        let supplierId = null;

        // 处理供应商逻辑
        if (role === 'Supplier' && supplierData) {
            if (supplierData.isNew) {
                const { data: newSupplier, error: supError } = await supabaseAdmin
                    .from('suppliers')
                    .insert({
                        name: supplierData.name,
                        short_code: supplierData.shortCode,
                        parma_id: supplierData.parmaId
                    })
                    .select()
                    .single();
                
                if (supError) throw supError;
                supplierId = newSupplier.id;
            } else {
                supplierId = supplierData.id;
            }
        }

        // 创建 public.users 记录
        const { error: profileError } = await supabaseAdmin
            .from('users')
            .insert({
                id: newUserId,
                username: username,
                password: password,
                email: email,
                role: role,
                supplier_id: supplierId,
                created_at: new Date().toISOString()
            });

        if (profileError) {
            // 回滚：如果资料表创建失败，删除刚刚创建的 Auth 账号
            await supabaseAdmin.auth.admin.deleteUser(newUserId);
            throw profileError;
        }

        return res.status(200).json({ success: true, userId: newUserId, message: '用户创建成功' });

    } catch (error) {
        console.error('Create user failed:', error);
        return res.status(500).json({ error: error.message });
    }
};