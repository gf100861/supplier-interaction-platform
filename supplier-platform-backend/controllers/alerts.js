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

        // ============================
        // Case 2: 创建通知 (POST) - ✅ 核心修改
        // ============================
        if (req.method === 'POST') {
            const bodyData = req.body;
            
            // ---------------------------------------------------------
            // 模式 A: 按供应商自动分发 (进阶功能 - 推荐使用)
            // 前端只需传: { createBySupplier: { supplierId: 1, title: '...', message: '...' } }
            // ---------------------------------------------------------
            if (bodyData.createBySupplier) {
                const { supplierId, title, message, link } = bodyData.createBySupplier;

                if (!supplierId) return res.status(400).json({ error: 'Missing supplierId' });

                // 1. 先查找该供应商下的所有用户
                const { data: targetUsers, error: userError } = await supabaseAdmin
                    .from('users')
                    .select('id')
                    .eq('supplier_id', supplierId);
                
                if (userError) throw userError;
                
                if (!targetUsers || targetUsers.length === 0) {
                    return res.json({ success: true, count: 0, message: 'No users found for this supplier' });
                }

                // 2. 为每个用户构建警报数据
                const generatedAlerts = targetUsers.map(u => ({
                    target_user_id: u.id,
                    message: message,
                    title: title || '系统通知',
                    link: link || null,
                    is_read: false,
                    created_at: new Date().toISOString()
                }));

                // 3. 批量插入
                const { data, error } = await supabaseAdmin
                    .from('alerts')
                    .insert(generatedAlerts)
                    .select();

                if (error) throw error;
                return res.status(201).json({ success: true, count: data.length, mode: 'by_supplier' });
            }

            // ---------------------------------------------------------
            // 模式 B: 直接插入 (兼容旧逻辑 / SD通知)
            // 前端传: { alerts: [...] } 或 [...]
            // ---------------------------------------------------------
            let alertsToInsert = [];

            if (bodyData.alerts && Array.isArray(bodyData.alerts)) {
                alertsToInsert = bodyData.alerts;
            } else if (Array.isArray(bodyData)) {
                alertsToInsert = bodyData;
            } else if (bodyData && !bodyData.createBySupplier) {
                // 如果不是 createBySupplier 且是对象，认为是单条插入
                alertsToInsert = [bodyData];
            }

            if (alertsToInsert.length > 0) {
                const { data, error } = await supabaseAdmin
                    .from('alerts')
                    .insert(alertsToInsert)
                    .select();

                if (error) throw error;
                return res.status(201).json({ success: true, count: data.length, mode: 'direct' });
            }

            return res.status(400).json({ error: 'Invalid payload provided' });
        }

        // ============================
        // Case 3: 更新状态 (PATCH)
        // ============================
        if (req.method === 'PATCH') {
            const { action, alertId, userId } = req.body;

            if (action === 'markAsRead' && alertId) {
                const { error } = await supabaseAdmin
                    .from('alerts')
                    .update({ is_read: true })
                    .eq('id', alertId);
                if (error) throw error;
                return res.status(200).json({ success: true });
            }

            if (action === 'markAllAsRead' && userId) {
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
        // Case 4: 删除通知 (DELETE)
        // ============================
        if (req.method === 'DELETE') {
            const { alertId } = req.query; 
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