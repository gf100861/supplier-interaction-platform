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
    // CORS
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

        // --- GET: 获取所有通知单 ---
        if (req.method === 'GET') {
            const { data, error } = await supabaseAdmin
                .from('notices')
                .select(`
                    *,
                    creator:users ( id, username, email, role ),
                    supplier:suppliers ( parma_id, short_code )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return res.json(data);
        }

        // --- POST: 创建通知单 (支持批量) ---
        if (req.method === 'POST') {
            const noticesData = req.body;
            // 确保是数组
            const insertData = Array.isArray(noticesData) ? noticesData : [noticesData];

            const { data, error } = await supabaseAdmin
                .from('notices')
                .insert(insertData)
                // 关键: 同时返回 creator 信息，供前端发邮件用
                .select('*, creator:users(username, email)');

            if (error) throw error;
            return res.status(201).json(data);
        }

        // --- PATCH: 更新通知单 ---
        if (req.method === 'PATCH') {
            const { id, updates } = req.body;
            if (!id || !updates) return res.status(400).json({ error: 'Missing id or updates' });

            // 过滤掉前端可能传来的辅助字段 (如 old_supplier_id)，只保留 DB 字段
            // 这里做一个简单的保护，实际应根据 Schema 过滤
            const { old_supplier_id, creator, supplier, ...dbUpdates } = updates;

            const { data, error } = await supabaseAdmin
                .from('notices')
                .update(dbUpdates)
                .eq('id', id)
                .select(`*, creator:users(id, email, username), supplier:suppliers(id, name)`)
                .single();

            if (error) throw error;
            return res.json(data);
        }

        // --- DELETE: 删除通知单 ---
        if (req.method === 'DELETE') {
            const { ids } = req.body; // Expecting { ids: [1, 2, 3] }
            
            if (!ids || ids.length === 0) return res.status(400).json({ error: 'Missing ids' });

            const { error } = await supabaseAdmin
                .from('notices')
                .delete()
                .in('id', ids);

            if (error) throw error;
            return res.json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('[Notices API] Error:', error);
        return res.status(500).json({ error: error.message });
    }
};