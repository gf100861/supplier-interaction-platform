// supplier-platform-backend/controllers/chat/sessions.js
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const corsMiddleware = cors({
    origin: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await runMiddleware(req, res, corsMiddleware);

        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // --- GET: 获取用户的会话列表 ---
        if (req.method === 'GET') {
            const { userId } = req.query;
            if (!userId) return res.status(400).json({ error: 'Missing userId' });

            const { data, error } = await supabaseAdmin
                .from('chat_sessions')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return res.json(data);
        }

        // --- POST: 创建新会话 ---
        if (req.method === 'POST') {
            const { userId, title } = req.body;
            if (!userId) return res.status(400).json({ error: 'Missing userId' });

            const { data, error } = await supabaseAdmin
                .from('chat_sessions')
                .insert([{ user_id: userId, title: title || 'New Chat' }])
                .select()
                .single();

            if (error) throw error;
            return res.json(data);
        }

        // --- DELETE: 删除会话 ---
        if (req.method === 'DELETE') {
            const { sessionId } = req.body; // 或者 req.query.sessionId
            if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

            // 级联删除通常由数据库外键处理，或者手动删除 messages
            // 这里假设数据库已设置 ON DELETE CASCADE，或者只删 session
            const { error } = await supabaseAdmin
                .from('chat_sessions')
                .delete()
                .eq('id', sessionId);

            if (error) throw error;
            return res.json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('[Chat Sessions API] Error:', error);
        res.status(500).json({ error: error.message });
    }
};