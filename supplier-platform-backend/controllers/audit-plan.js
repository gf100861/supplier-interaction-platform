const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

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
    // CORS Setup
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await runMiddleware(req, res, corsMiddleware);

        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // --- GET: 获取审计计划 ---
        if (req.method === 'GET') {
            // ✅ [修正点] 获取 min_year 和 status_neq 参数
            const { year, min_year, status_neq } = req.query;
            
            let query = supabaseAdmin.from('audit_plans').select('*');

            if (year) {
                // 场景1: 审计计划页 (指定年份)
                query = query.eq('year', year);
            } else if (min_year) {
                // 场景2: 仪表盘页 (今年及未来，gte = greater than or equal)
                query = query.gte('year', min_year);
            } else {
                // 如果两个参数都没有，才报错
                return res.status(400).json({ error: 'Missing year or min_year parameter' });
            }

            if (status_neq) {
                // 场景2补充: 排除已完成的 (neq = not equal)
                query = query.neq('status', status_neq);
            }

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

            const { data, error } = await supabaseAdmin
                .from('audit_plans')
                .insert([planData])
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