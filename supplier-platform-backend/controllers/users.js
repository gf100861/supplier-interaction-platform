const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

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
    // CORS Setup
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await runMiddleware(req, res, corsMiddleware);

        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { supplierId, action, includeManaged } = req.query;

        if (req.method === 'GET') {
            // 获取用户 ID 和 Supplier ID (用于 Notice 上下文)
            const { data, error } = await supabaseAdmin
                .from('users')
                .select('id, supplier_id'); // 按需只取这俩字段

            if (error) throw error;
            return res.json(data);
        }

        // 场景 1: AdminPage 获取完整用户列表 (带管理供应商信息)
        // 对应前端 fetch: /api/users?includeManaged=true
        if (includeManaged === 'true') {
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

        // 场景 1: 获取指定供应商下的所有用户 (用于重分配通知)
        if (supplierId) {
            const { data, error } = await supabaseAdmin
                .from('users')
                .select('id, email, username')
                .eq('supplier_id', supplierId);
            
            if (error) throw error;
            return res.json(data);
        }

        // 场景 2: 获取所有用户 (用于系统公告)
        if (action === 'all_users') {
             const { data, error } = await supabaseAdmin
                .from('users')
                .select('id, username');
            
            if (error) throw error;
            return res.json(data);
        }

        // if (action === 'all_users') {
        //      const { data, error } = await supabaseAdmin
        //         .from('users')
        //         .select('id, email, username'); // ✅ 新增 username
            
        //     if (error) throw error;
        //     return res.json(data);
        // }

        return res.status(400).json({ error: 'Missing parameters' });

    } catch (error) {
        console.error('[Users API] Error:', error);
        res.status(500).json({ error: error.message });
    }
};