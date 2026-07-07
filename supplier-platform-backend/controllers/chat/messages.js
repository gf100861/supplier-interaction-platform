const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const corsMiddleware = cors({
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'], // 允许的方法
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
    // 1. 设置 CORS Headers
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // 2. 处理预检请求
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await runMiddleware(req, res, corsMiddleware);

        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // ==========================================
        // GET: 获取消息列表
        // ==========================================
        if (req.method === 'GET') {
            const { sessionId } = req.query;
            if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

            const { data, error } = await supabaseAdmin
                .from('chat_messages')
                .select('*')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return res.json(data);
        }

        // ==========================================
        // POST: 插入新消息 (用户提问 或 系统回答)
        // ==========================================
        if (req.method === 'POST') {
            // 从前端 Body 获取参数
            // 注意：前端传来的参数名建议保持驼峰，这里映射到数据库的蛇形命名
            const { userId, sessionId, sender, content, duration } = req.body;

            // 简单校验
            if (!userId || !sessionId || !sender || !content) {
                return res.status(400).json({ error: 'Missing required fields (userId, sessionId, sender, content)' });
            }

            // 执行插入
            const { data, error } = await supabaseAdmin
                .from('chat_messages')
                .insert([{
                    user_id: userId,
                    session_id: sessionId,
                    sender: sender,       // 'user' or 'system'
                    content: content,
                    duration: duration || null // 仅 system 消息可能有耗时
                }])
                .select()
                .single();

            if (error) throw error;
            return res.json(data);
        }

        // ==========================================
        // PATCH: 更新消息反馈 (点赞/点踩)
        // ==========================================
        if (req.method === 'PATCH') {
            const { messageId, feedback } = req.body;

            if (!messageId) return res.status(400).json({ error: 'Missing messageId' });

            // feedback 可以是 'like', 'dislike' 或 null (取消)
            const { data, error } = await supabaseAdmin
                .from('chat_messages')
                .update({ feedback: feedback })
                .eq('id', messageId)
                .select()
                .single();

            if (error) throw error;
            return res.json({ success: true, data });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('[Chat Messages API] Error:', error);
        res.status(500).json({ error: error.message });
    }
};