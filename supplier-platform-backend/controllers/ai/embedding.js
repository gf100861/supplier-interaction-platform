// const { createClient } = require('@supabase/supabase-js');
// const cors = require('cors');
// const { GoogleGenerativeAI } = require("@google/generative-ai");

// // 1. 初始化 Google AI 客户端
// const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// // 2. 初始化 Supabase Admin (用于验证用户身份)
// const supabaseAdmin = createClient(
//     process.env.SUPABASE_URL,
//     process.env.SUPABASE_SERVICE_ROLE_KEY
// );

// // 3. CORS 配置
// const corsMiddleware = cors({
//     origin: true,
//     methods: ['POST', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'Authorization'],
//     credentials: true,
// });

// function runMiddleware(req, res, fn) {
//     return new Promise((resolve, reject) => {
//         fn(req, res, (result) => {
//             if (result instanceof Error) return reject(result);
//             return resolve(result);
//         });
//     });
// }

// module.exports = async (req, res) => {
//     // [Step A] 手动设置 CORS 头
//     const requestOrigin = req.headers.origin || '*';
//     res.setHeader('Access-Control-Allow-Origin', requestOrigin);
//     res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
//     res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
//     res.setHeader('Access-Control-Allow-Credentials', 'true');

//     // [Step B] 处理预检请求
//     if (req.method === 'OPTIONS') {
//         return res.status(200).end();
//     }

//     try {
//         await runMiddleware(req, res, corsMiddleware);

//         // ============================================================
//         // 🔒 1. 安全验证 (Token 检查)
//         // ============================================================
//         const authHeader = req.headers.authorization;
//         if (!authHeader || !authHeader.startsWith('Bearer ')) {
//             return res.status(401).json({ error: 'Missing token' });
//         }

//         const token = authHeader.split(' ')[1];
//         const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

//         if (authError || !user) {
//             return res.status(401).json({ error: 'Invalid token' });
//         }

//         // ============================================================
//         // 🤖 2. 业务逻辑：调用 Google Gemini 生成 Embedding
//         // ============================================================
//         if (req.method !== 'POST') {
//             return res.status(405).json({ error: 'Method not allowed' });
//         }

//         const { text } = req.body;

//         if (!text || typeof text !== 'string') {
//             return res.status(400).json({ error: 'Invalid text input' });
//         }

//         // 简单清洗：移除换行，限制长度
//         // Google 的 text-embedding-004 模型支持较长文本，但为了安全还是做个截断
//         const cleanText = text.replace(/\n/g, ' ').substring(0, 8000);

//         // 获取 Embedding 模型
//         // 目前推荐使用 'text-embedding-004'
//        // ✅ 修正后的代码：使用基础嵌入模型
//        const model = genAI.getGenerativeModel({ model: "gemini-embedding-001"});

//         const result = await model.embedContent(cleanText);
//         const embedding = result.embedding.values;

//         // 返回结果
//         return res.status(200).json({ embedding });

//     } catch (error) {
//         console.error('[Google AI Embedding] Error:', error);
//         res.status(500).json({ error: error.message || 'Internal Server Error' });
//     }
// };