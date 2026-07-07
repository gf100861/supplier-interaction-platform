const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require('cors');

// 1. 初始化 Gemini 客户端
// 优先使用环境变量中的 Key，如果没有则回退（但不建议在后端代码硬编码 Key）
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

// 2. 初始化 Supabase Admin (用于验证用户身份)
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 3. CORS 配置
const corsMiddleware = cors({
    origin: true,
    methods: ['POST', 'OPTIONS'],
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

// 辅助：后端生成向量 (带降维处理)
async function getEmbedding(text) {
    if (!text) return null;
    try {
        // ✅ 修正模型名称：使用 embedding-001
        const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        
        // 简单清洗文本
        const cleanText = text.replace(/\n/g, ' ').substring(0, 9000);

        const result = await model.embedContent({
            content: { parts: [{ text: cleanText }] },
            outputDimensionality: 768 // ✅ 强制降维到 768，匹配数据库
        });
        
        return result.embedding.values;
    } catch (e) {
        console.error("Embedding Error:", e.message);
        return null; // 降级处理：生成失败返回 null，不阻塞归档流程
    }
}

module.exports = async (req, res) => {
    // [Step A] 手动设置 CORS 头
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // ✅ 必须包含 Authorization
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();

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
        // 📂 2. 业务逻辑：归档历史数据
        // ============================================================
        if (req.method === 'POST') {
            const { 
                values, 
                currentUser, // 注意：这里的 currentUser 是前端传来的，最好改用 Token 解析出来的 user.id
                supplierName, 
                aiContext, 
                base64File, 
                fileName
            } = req.body;

            // 简单校验
            if (!values || !values.title || !values.supplierId) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // 1. 构建向量文本 (Rich Context)
            const textToEmbed = `
[Category]: Historical 8D
[Supplier]: ${supplierName}
[Part]: ${values.partName || ''}
[Title]: ${values.title}
[Issue]: ${values.summary}
[Cause]: ${values.rootCause}
            `.trim();

            // 2. 生成向量 (调用辅助函数)
            const embeddingVector = await getEmbedding(textToEmbed);

            // 3. 构建数据库对象
            // ⚠️ 安全建议：creator_id 最好使用 user.id (从 Token 获取)，而不是完全信任前端传来的 currentUser.id
            // 这里为了兼容你现有的前端逻辑，我先保留了 currentUser.id，但建议后续优化
            const creatorId = user.id; 

            const newNotice = {
                title: values.title,
                notice_code: values.reportNo || `HIST-${Date.now()}`,
                assigned_supplier_id: values.supplierId,
                assigned_supplier_name: supplierName,
                status: '已完成', // 历史归档默认已完成
                category: 'Historical 8D',
                creator_id: creatorId,
                created_at: values.date || new Date().toISOString(),
                embedding: embeddingVector, // 存入 768 维向量
                sd_notice: {
                    creatorId: creatorId,
                    creator: currentUser?.username || user.email,
                    description: aiContext,
                    createTime: values.date,
                    details: {
                        part_number: values.partNumber,
                        part_name: values.partName,
                        quantity: values.quantity,
                        finding: values.summary,
                        root_cause: values.rootCause,
                        action_plan: values.interimAction,
                        // 注意：如果 base64File 非常大，可能会导致 Supabase 请求体过大报错
                        // 建议生产环境改用 Supabase Storage 上传文件并只存 URL
                        file_storage_type: 'inline_base64', 
                        file_content: base64File, 
                        original_file_name: fileName
                    },
                    images: [],
                    attachments: []
                },
                history: [{
                    type: 'system_import',
                    submitter: currentUser?.username || 'System',
                    time: new Date().toISOString(),
                    description: '通过历史归档模块导入(Backend)'
                }]
            };

            const { data, error } = await supabaseAdmin
                .from('notices')
                .insert([newNotice])
                .select();

            if (error) throw error;

            return res.json({ success: true, id: data[0].id });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('[Archive Historical API] Error:', error);
        // 如果是 Supabase 报的错，通常会包含 details
        res.status(500).json({ error: error.message, details: error.details || null });
    }
};