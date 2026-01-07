const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

// --- 1. 初始化 CORS 中间件 ---
const corsMiddleware = cors({
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
    // [CORS]
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await runMiddleware(req, res, corsMiddleware);

        // 初始化 Supabase
        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // ============================
        // Case 1: 获取通知 (GET)
        // ============================
        if (req.method === 'GET') {
            const { userId } = req.query;
            if (!userId) return res.status(400).json({ error: 'Missing userId' });

            const { data, error } = await supabaseAdmin
                .from('alerts')
                .select('*')
                .eq('target_user_id', userId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            return res.status(200).json(data);
        }

        // POST: 创建通知 (支持批量) - [新增]
        if (req.method === 'POST') {
            const alertsData = req.body;
            if (!alertsData) return res.status(400).json({ error: 'No data provided' });

            // 无论是单条对象还是数组，统一转为数组处理
            const dataToInsert = Array.isArray(alertsData) ? alertsData : [alertsData];

            const { data, error } = await supabaseAdmin
                .from('alerts')
                .insert(dataToInsert)
                .select();

            if (error) throw error;
            return res.status(201).json(data);
        }

        // ============================
        // Case 2: 更新状态 (PATCH) - 已读/全部已读
        // ============================
        if (req.method === 'PATCH') {
            const { action, alertId, userId } = req.body;

            if (action === 'markAsRead' && alertId) {
                // 标记单个已读
                const { error } = await supabaseAdmin
                    .from('alerts')
                    .update({ is_read: true })
                    .eq('id', alertId);
                if (error) throw error;
                return res.status(200).json({ success: true });
            }

            if (action === 'markAllAsRead' && userId) {
                // 标记全部已读
                const { error } = await supabaseAdmin
                    .from('alerts')
                    .update({ is_read: true })
                    .eq('target_user_id', userId)
                    .eq('is_read', false);
                if (error) throw error;
                return res.status(200).json({ success: true });
            }

            return res.status(400).json({ error: 'Invalid action or missing parameters' });
        }

        // ============================
        // Case 3: 删除通知 (DELETE)
        // ============================
        if (req.method === 'DELETE') {
            const { alertId } = req.query; // DELETE 参数通常在 URL query 中
            if (!alertId) return res.status(400).json({ error: 'Missing alertId' });

            const { error } = await supabaseAdmin
                .from('alerts')
                .delete()
                .eq('id', alertId);

            if (error) throw error;
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('[Alerts API] Error:', error);
        return res.status(500).json({ error: error.message });
    }
};