const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const corsMiddleware = cors({
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'], // 确保包含 POST
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();
    try {

        await runMiddleware(req, res, corsMiddleware);


        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );


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

        if (req.method === 'POST') {
            const { user_id, content, category, images, attachments } = req.body;

            const { error } = await supabaseAdmin.from('feedback').insert([{
                user_id,
                content,
                category,
                images,
                attachments
            }]);

            if (error) throw error;
            return res.json({ success: true });
        }
        // --- GET: 获取反馈列表 ---
        if (req.method === 'GET') {
            const { data, error } = await supabaseAdmin
                .from('feedback')
                .select('*, user:users ( username )')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return res.json(data);
        }

        // --- PATCH: 更新状态或回复 ---
        if (req.method === 'PATCH') {
            const { id, status, admin_response } = req.body;

            // 构建更新对象（只更新传过来的字段）
            const updates = {};
            if (status) updates.status = status;
            if (admin_response !== undefined) updates.admin_response = admin_response;

            const { data, error } = await supabaseAdmin
                .from('feedback')
                .update(updates)
                .eq('id', id)
                .select();

            if (error) throw error;
            return res.json(data);
        }

        // --- DELETE: 删除反馈 ---
        if (req.method === 'DELETE') {
            const { id } = req.query; // 从 URL 参数获取 ID
            if (!id) return res.status(400).json({ error: 'Missing id' });

            const { error } = await supabaseAdmin
                .from('feedback')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return res.json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('[Feedback API] Error:', error);
        res.status(500).json({ error: error.message });
    }
};