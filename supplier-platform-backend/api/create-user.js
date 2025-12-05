const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

// 初始化带有 Service Role 权限的 Supabase 客户端
// 这允许我们绕过 RLS 并直接管理 Auth 用户
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

const corsMiddleware = cors({
    origin: '*', // 生产环境请改为前端域名
    methods: ['POST', 'OPTIONS'],
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
    await runMiddleware(req, res, corsMiddleware);

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, password, username, role, supplierData } = req.body;

    if (!email || !password || !username || !role) {
        return res.status(400).json({ error: '缺少必要参数' });
    }

    try {
        // 1. 在 Supabase Auth 中创建用户
        // 这不会发送确认邮件，且会自动验证邮箱（email_confirm: true）
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true, 
            user_metadata: { username: username, role: role }
        });

        if (authError) throw authError;
        const newUserId = authData.user.id;

        let supplierId = null;

        // 2. 如果是供应商角色，处理供应商公司逻辑
        if (role === 'Supplier') {
            if (supplierData.isNew) {
                // 创建新供应商公司
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
                // 使用已有供应商 ID
                supplierId = supplierData.id;
            }
        }

        // 3. 在 public.users 表中创建记录
        const { error: profileError } = await supabaseAdmin
            .from('users')
            .insert({
                id: newUserId, // 关键：必须与 Auth ID 一致
                username: username,
                email: email,
                role: role,
                supplier_id: supplierId, // 如果不是供应商，这里是 null
                created_at: new Date().toISOString()
            });

        if (profileError) {
            // 如果 public 表插入失败，回滚 Auth 用户（可选但推荐）
            await supabaseAdmin.auth.admin.deleteUser(newUserId);
            throw profileError;
        }

        return res.status(200).json({ success: true, userId: newUserId, message: '用户创建成功' });

    } catch (error) {
        console.error('Create user failed:', error);
        return res.status(500).json({ error: error.message });
    }
};