const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

// 初始化 CORS 中间件
// 允许所有来源 (*)，允许 POST 和 OPTIONS 方法
const corsMiddleware = cors({
    origin: '*', 
    methods: ['POST', 'OPTIONS'],
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
    // 1. 首先运行 CORS 中间件
    // 这会自动处理 OPTIONS 请求并设置 Access-Control-Allow-Origin 等头信息
    await runMiddleware(req, res, corsMiddleware);

    // 2. 如果是 OPTIONS 请求，直接结束，不进入业务逻辑
    // 虽然 cors 中间件通常会处理，但显式返回 200 是个双重保险
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 3. 检查请求方法
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // --- 业务逻辑开始 ---
    
    // 初始化带有 Service Role 权限的 Supabase 客户端
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
        // 4. 在 Supabase Auth 中创建用户
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: { username: username, role: role }
        });

        if (authError) throw authError;
        const newUserId = authData.user.id;

        let supplierId = null;

        // 5. 如果是供应商角色，处理供应商公司逻辑
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

        // 6. 在 public.users 表中创建记录
        const { error: profileError } = await supabaseAdmin
            .from('users')
            .insert({
                id: newUserId,
                username: username,
                email: email,
                role: role,
                supplier_id: supplierId,
                created_at: new Date().toISOString()
            });

        if (profileError) {
            // 如果 user profile 创建失败，回滚删除 Auth 用户
            await supabaseAdmin.auth.admin.deleteUser(newUserId);
            throw profileError;
        }

        return res.status(200).json({ success: true, userId: newUserId, message: '用户创建成功' });

    } catch (error) {
        console.error('Create user failed:', error);
        return res.status(500).json({ error: error.message });
    }
};