const { createClient } = require('@supabase/supabase-js');

// 辅助函数：CORS 和请求方法处理
const allowCors = fn => async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    return await fn(req, res);
};

const handler = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

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
        // 1. 在 Supabase Auth 中创建用户
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

        // 3. 在 public.users 表中创建记录
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

module.exports = allowCors(handler);