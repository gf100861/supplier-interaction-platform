const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const corsMiddleware = cors({
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
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
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await runMiddleware(req, res, corsMiddleware);

        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // 假设前端会在 Headers 里传 userId (实际项目中建议走 Token 解析，这里为了兼容现有逻辑简化)
        // 或者从 req.query / req.body 获取 userId
        const userId = req.headers['x-user-id'] || req.body.userId || req.query.userId;

        if (!userId) return res.status(400).json({ error: 'Missing User ID' });

        // --- GET: 获取设置 ---
        if (req.method === 'GET') {
            const { data, error } = await supabaseAdmin
                .from('users')
                .select('preferences')
                .eq('id', userId)
                .single();

            if (error) throw error;
            // 如果没有 preferences，返回默认值
            return res.json(data?.preferences || {
                publicProfile: true,
                showEmail: false,
                showPhone: false,
                activityLog: true
            });
        }

        // --- PATCH: 更新设置 ---
        if (req.method === 'PATCH') {
            const { preferences } = req.body;
            
            const { data, error } = await supabaseAdmin
                .from('users')
                .update({ preferences })
                .eq('id', userId)
                .select();

            if (error) throw error;
            return res.json({ success: true, data });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('[Settings API] Error:', error);
        res.status(500).json({ error: error.message });
    }
};