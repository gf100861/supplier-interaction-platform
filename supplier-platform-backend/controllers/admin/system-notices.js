const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
    // 0. 处理 CORS 预检请求 (可选，防止浏览器报跨域错误)
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Credentials', true);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
        res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
        return res.status(200).end();
    }

    try {
        // ============================================================
        // 🔒 安全验证逻辑开始
        // ============================================================
        
        // 1. 获取 Authorization 头
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
        }

        // 2. 提取 Token
        const token = authHeader.split(' ')[1];

        // 3. 验证 Token 有效性 (获取用户信息)
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }

        // 4. (强烈建议) 权限验证：检查用户是否为 Admin
        // 只有 GET 请求可能允许普通用户查看，但 POST/DELETE 必须是管理员
        if (req.method === 'POST' || req.method === 'DELETE') {
            // 查询你的 users 表，确认该用户的角色
            // 假设你的用户表叫 'users' 或 'profiles'，并且有 'role' 字段
            const { data: userProfile, error: profileError } = await supabaseAdmin
                .from('users') // ⚠️ 请根据你实际的表名修改，可能是 'profiles'
                .select('role')
                .eq('id', user.id) // Supabase Auth 的 user.id 对应业务表的 id
                .single();

            if (profileError || !userProfile || userProfile.role !== 'Admin') {
                return res.status(403).json({ error: 'Forbidden: Admins only' });
            }
        }
        
        // ============================================================
        // 🔓 验证通过，执行业务逻辑
        // ============================================================

        // --- GET: 获取公告列表 ---
        if (req.method === 'GET') {
            const { data, error } = await supabaseAdmin
                .from('system_notices')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return res.json(data);
        }

        // --- POST: 发布新公告 ---
        if (req.method === 'POST') {
            const { type, content, is_active } = req.body;
            
            const { data, error } = await supabaseAdmin
                .from('system_notices')
                .insert([{ type, content, is_active: is_active ?? true }])
                .select();

            if (error) throw error;
            return res.status(201).json(data);
        }

        // --- DELETE: 删除公告 ---
        if (req.method === 'DELETE') {
            const { id } = req.query;
            if (!id) return res.status(400).json({ error: 'Missing id' });

            const { error } = await supabaseAdmin
                .from('system_notices')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return res.json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('[System Notices API] Error:', error);
        res.status(500).json({ error: error.message });
    }
};