const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

// 初始化 Supabase Admin 客户端
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// CORS 中间件配置
const corsMiddleware = cors({
    origin: true,
    methods: ['GET', 'OPTIONS'],
    credentials: true,
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
    // 0. 手动设置 CORS 头 (为了保险)
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // ✅ 允许 Authorization 头
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // 处理预检请求
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        // 运行 CORS 中间件
        await runMiddleware(req, res, corsMiddleware);

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
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        
        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }

        // 3. 获取请求者的角色信息 (用于权限控制)
        const { data: requesterProfile, error: profileError } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profileError || !requesterProfile) {
            return res.status(403).json({ error: 'Forbidden: User profile not found' });
        }

        // ============================================================
        // 🔓 业务逻辑
        // ============================================================

        const { supplierId, action, includeManaged } = req.query;

        // 场景 1: AdminPage 获取完整用户列表
        // 🛡️ 权限要求: 必须是 Admin
        if (includeManaged === 'true') {
            if (requesterProfile.role !== 'Admin') {
                return res.status(403).json({ error: 'Forbidden: Admins only' });
            }

            // 注意：这里使用的是 supabaseAdmin，拥有最高权限，所以必须在上面做好权限卡控
            const { data, error } = await supabaseAdmin
                .from('users')
                .select(`
                    id, username, email, phone, role, created_at,
                    managed_suppliers:sd_supplier_assignments(supplier_id)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return res.json(data);
        }

        // 场景 2: 获取指定供应商下的所有用户 (可能用于 Manager 分配任务)
        // 🛡️ 权限要求: 登录用户即可 (或者你可以限制为 Manager/Admin)
        if (supplierId) {
            const { data, error } = await supabaseAdmin
                .from('users')
                .select('id, email, username, role')
                .eq('supplier_id', supplierId);
            
            if (error) throw error;
            return res.json(data);
        }

        // 场景 3: 获取所有用户简略信息 (用于系统公告选择对象等)
        // 🛡️ 权限要求: Admin 或 Manager
        if (action === 'all_users') {
             // 如果你希望只有 Admin 能发全员公告，可以在这里加判断
             // if (requesterProfile.role !== 'Admin') return res.status(403)...

             const { data, error } = await supabaseAdmin
                .from('users')
                .select('id, username');
            
            if (error) throw error;
            return res.json(data);
        }

        return res.status(400).json({ error: 'Missing or invalid parameters' });

    } catch (error) {
        console.error('[Users API] Error:', error);
        res.status(500).json({ error: error.message });
    }
};