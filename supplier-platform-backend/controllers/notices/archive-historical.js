// supplier-platform-backend/controllers/notices/archive-historical.js
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require('cors');

// 初始化 Gemini 用于后端生成向量 (假设使用 backend 环境变量的 Key)
// 如果你想用前端传来的 Key 生成向量，可以动态初始化
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.EXTERNAL_API_SECRET); // 这里的 Key 配置要注意

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

// 辅助：后端生成向量
async function getEmbedding(text, apiKey) {
    if (!text) return null;
    try {
        // 如果环境变量没配，尝试用传进来的
        const client = apiKey ? new GoogleGenerativeAI(apiKey) : genAI;
        const model = client.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.embedContent(text.substring(0, 9000));
        return result.embedding.values;
    } catch (e) {
        console.error("Embedding Error:", e.message);
        return null; // 降级处理，不存向量
    }
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
            const { 
                values, 
                currentUser, 
                supplierName, 
                aiContext, 
                base64File, 
                fileName,
                apiKey // 可选：用于生成向量的 key
            } = req.body;

            // 1. 构建向量文本
            const textToEmbed = `
[Category]: Historical 8D
[Supplier]: ${supplierName}
[Part]: ${values.partName || ''}
[Title]: ${values.title}
[Issue]: ${values.summary}
[Cause]: ${values.rootCause}
            `.trim();

            // 2. 生成向量
            const embeddingVector = await getEmbedding(textToEmbed, apiKey);

            // 3. 构建数据库对象
            const newNotice = {
                title: values.title,
                notice_code: values.reportNo || `HIST-${Date.now()}`,
                assigned_supplier_id: values.supplierId,
                assigned_supplier_name: supplierName,
                status: '已完成',
                category: 'Historical 8D',
                creator_id: currentUser.id,
                created_at: values.date, // 前端传来的应该是 ISO string
                embedding: embeddingVector,
                sd_notice: {
                    creatorId: currentUser.id,
                    creator: currentUser.username,
                    description: aiContext,
                    createTime: values.date,
                    details: {
                        part_number: values.partNumber,
                        part_name: values.partName,
                        quantity: values.quantity,
                        finding: values.summary,
                        root_cause: values.rootCause,
                        action_plan: values.interimAction,
                        file_storage_type: 'inline_base64',
                        file_content: base64File, // 注意：Base64 可能很大，确保 express.json limit 够大
                        original_file_name: fileName
                    },
                    images: [],
                    attachments: []
                },
                history: [{
                    type: 'system_import',
                    submitter: currentUser.username,
                    time: new Date().toISOString(),
                    description: '通过历史归档模块导入(Backend)'
                }]
            };

            const { data, error } = await supabaseAdmin.from('notices').insert([newNotice]).select();

            if (error) throw error;

            return res.json({ success: true, id: data[0].id });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('[Archive Historical API] Error:', error);
        res.status(500).json({ error: error.message });
    }
};