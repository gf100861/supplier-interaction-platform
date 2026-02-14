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
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
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
    // 0. 手动设置 CORS 头 (双重保险)
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // ✅ 必须允许 Authorization
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // 处理预检请求
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        // 运行 CORS 中间件
        await runMiddleware(req, res, corsMiddleware);

        // ============================================================
        // 🔒 安全验证逻辑 (新增部分)
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

        // 3. 获取请求者角色 (用于权限控制)
        const { data: userProfile, error: profileError } = await supabaseAdmin
            .from('users')
            .select('role, username') // 多取一个 username 用于记录审计员
            .eq('id', user.id)
            .single();

        if (profileError || !userProfile) {
            return res.status(403).json({ error: 'Forbidden: User profile not found' });
        }

        // 4. 权限检查 (RBAC)
        // 允许 Admin, Manager, SD 操作审计计划
        const allowedRoles = ['Admin', 'Manager', 'SD']; 
        if (!allowedRoles.includes(userProfile.role)) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
        }

        // ============================================================
        // 🔓 业务逻辑 (已通过验证)
        // ============================================================

        // --- GET: 获取审计计划 ---
        if (req.method === 'GET') {
            const { year, min_year, status_neq } = req.query;
            
            // ✅ 优化: 关联查询供应商名称，前端直接用 supplier.short_code
            let query = supabaseAdmin.from('audit_plans').select(`
                *,
                supplier:suppliers(name, short_code)
            `);

            if (year) {
                // 场景1: 审计计划页 (指定年份)
                query = query.eq('year', year);
            } else if (min_year) {
                // 场景2: 仪表盘页 (今年及未来)
                query = query.gte('year', min_year);
            } else {
                return res.status(400).json({ error: 'Missing year or min_year parameter' });
            }

            if (status_neq) {
                query = query.neq('status', status_neq);
            }
            
            // 按月份排序
            query = query.order('planned_month', { ascending: true });

            const { data, error } = await query;

            if (error) throw error;
            return res.json(data);
        }

        // --- POST: 创建审计计划 ---
        if (req.method === 'POST') {
            const planData = req.body;
            if (!planData.supplier_id || !planData.planned_month || !planData.year) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // ✅ 自动填充审计员 (如果前端没传)
            const newPlan = {
                ...planData,
                auditor: planData.auditor || userProfile.username || user.email,
                created_at: new Date()
            };

            const { data, error } = await supabaseAdmin
                .from('audit_plans')
                .insert([newPlan])
                .select();

            if (error) throw error;
            return res.status(201).json(data);
        }

        // --- PATCH: 更新审计计划 ---
        if (req.method === 'PATCH') {
            const { id, updates } = req.body;
            if (!id || !updates) return res.status(400).json({ error: 'Missing id or updates' });

            const { data, error } = await supabaseAdmin
                .from('audit_plans')
                .update(updates)
                .eq('id', id)
                .select();

            if (error) throw error;
            return res.json(data);
        }

        // --- DELETE: 删除审计计划 ---
        if (req.method === 'DELETE') {
            const { id } = req.query;
            if (!id) return res.status(400).json({ error: 'Missing id' });

            const { error } = await supabaseAdmin
                .from('audit_plans')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return res.json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('[Audit Plans API] Error:', error);
        res.status(500).json({ error: error.message });
    }
};