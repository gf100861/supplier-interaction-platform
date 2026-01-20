const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

// 初始化 CORS 中间件
const corsMiddleware = cors({
    origin: true,
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
    // 1. 手动设置 CORS 头
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // 2. 处理 OPTIONS
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

    // --- 业务逻辑 ---
    
    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
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
        // 1. 在 Supabase Auth 系统中创建用户（这里会安全地存储哈希后的密码）
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

        // 2. 创建 public.users 记录
        // ⚠️【安全修改】：已移除 password 字段
        const { error: profileError } = await supabaseAdmin
            .from('users')
            .insert({
                id: newUserId,
                username: username,
                // password: password, // <--- 已删除此行，永远不要保存明文密码！
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