// controllers/ai.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require('@supabase/supabase-js'); // ✅ 引入 Supabase
const cors = require('cors');

// 1. 初始化 Gemini 客户端
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

// 2. 初始化 Supabase Admin (用于验证 Token)
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 3. CORS 配置
const corsMiddleware = cors({
    origin: true,
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'], // ✅ 允许 Authorization
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
    // [Step A] 手动设置 CORS 头
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // ✅ 必须包含 Authorization
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // [Step B] 处理 OPTIONS 预检请求
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        await runMiddleware(req, res, corsMiddleware);

        // ============================================================
        // 🔒 1. 安全验证 (Token Check) - 新增部分
        // ============================================================
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: Missing token' });
        }

        const token = authHeader.split(' ')[1];
        
        // 验证 Supabase Token
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }

        // ============================================================
        // 🤖 2. 业务逻辑 (生成 Embedding)
        // ============================================================
        if (req.method === 'POST') {
            const { text } = req.body;

            if (!text) return res.status(400).json({ error: 'Text is required' });

            // 简单清洗文本
            const cleanText = text.replace(/\n/g, ' ').substring(0, 8000);

            // ✅ 修正模型名称：Google AI Studio 标准名称是 "embedding-001"
            // "gemini-embedding-001" 可能会导致 404
            const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
            
            const result = await model.embedContent({
                content: { parts: [{ text: cleanText }] },
                outputDimensionality: 768 // ✅ 强制指定维度，防止返回 3072 维导致数据库报错
            });

            const embedding = result.embedding.values;

            return res.json({ embedding });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('[AI Embedding API] Error:', error);
        
        // 优化错误返回，方便前端调试
        res.status(500).json({ 
            error: error.message,
            details: error.response ? JSON.stringify(error.response) : null 
        });
    }
};