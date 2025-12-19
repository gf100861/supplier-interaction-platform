const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

// 初始化 CORS 中间件
const corsMiddleware = cors({
    // 关键修改：将 '*' 改为 true。
    // 这会让服务器自动返回请求端的域名（Reflect Origin），
    // 从而完美兼容 credentials: true，避免浏览器报错。
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
    try {
        // 1. 运行 CORS 中间件
        await runMiddleware(req, res, corsMiddleware);
    } catch (e) {
        console.error("CORS Middleware Error:", e);
        return res.status(500).json({ error: 'Internal Server Error (CORS)' });
    }

    // 2. 处理 OPTIONS 请求
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 3. 检查请求方法
    if (req.method !== 'POST') {
        // 这里就是你浏览器访问时看到的 405 错误，这是正常的防御逻辑
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // --- 业务逻辑 ---
    
    // 初始化 Supabase
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
        // 4. 创建 Auth 用户
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: { username: username, role: role }
        });

        if (authError) throw authError;
        const newUserId = authData.user.id;

        let supplierId = null;

        // 5. 处理供应商逻辑
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

        // 6. 创建 public.users 记录
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
            await supabaseAdmin.auth.admin.deleteUser(newUserId);
            throw profileError;
        }

        return res.status(200).json({ success: true, userId: newUserId, message: '用户创建成功' });

    } catch (error) {
        console.error('Create user failed:', error);
        return res.status(500).json({ error: error.message });
    }
};