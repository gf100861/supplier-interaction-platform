// supplier-platform-backend/controllers/ai.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require('cors');

// 初始化 Gemini 客户端 (建议将 API Key 放在环境变量中)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
    // CORS Headers
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await runMiddleware(req, res, corsMiddleware);

        if (req.method === 'POST') {
            const { text } = req.body;

            if (!text) return res.status(400).json({ error: 'Text is required' });

            const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
            const result = await model.embedContent(text);
            const embedding = result.embedding.values;

            return res.json({ embedding });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('[AI Embedding API] Error:', error);
        res.status(500).json({ error: error.message });
    }
};