// supplier-platform-backend/controllers/chat/ratings.js
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const corsMiddleware = cors({
    origin: true,
    methods: ['POST', 'OPTIONS'],
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
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await runMiddleware(req, res, corsMiddleware);

        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        if (req.method === 'POST') {
            const { userId, sessionId, rating, comment } = req.body;

            if (!userId || !sessionId) return res.status(400).json({ error: 'Missing required fields' });

            const { error } = await supabaseAdmin
                .from('chat_ratings')
                .insert([{
                    user_id: userId,
                    session_id: sessionId,
                    rating: rating,
                    comment: comment
                }]);

            if (error) throw error;
            return res.json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('[Chat Ratings API] Error:', error);
        res.status(500).json({ error: error.message });
    }
};