const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const formidable = require('formidable'); // 需要安装：npm install formidable
const fs = require('fs');

// 禁用 SSL 验证（保留你的设置）
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const corsMiddleware = cors({
    origin: true,
    methods: ['POST', 'OPTIONS'],
    credentials: true,
});

// 初始化 Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);
// --- 2. AI 提示词与 JSON 解析辅助函数 ---
const SYSTEM_PROMPT = `
You are an expert Training Material Content Analyzer. Your task is to analyze the text extracted from training materials (PDF, PPTX, Word) and extract structured metadata into a strict JSON format.

*** STRICT DATA CLEANING RULES ***
1. **NO MARKDOWN**: Output ONLY pure JSON. No \`\`\`json or \`\`\` tags.
2. **NO EXTRA TEXT**: Do not say "Here is the JSON" or anything else.
3. **INFER MISSING DATA**: If specific data (like author or date) is missing, make a logical guess based on context, or use standard defaults.

*** REQUIRED JSON SCHEMA ***
You must output a single JSON object with EXACTLY these keys:
{
  "id": "Generate a unique ID starting with 'learn_' followed by 3 random digits (e.g., 'learn_042').",
  "type": "Infer the content type. Use 'document', 'presentation', or 'video' based on the context.",
  "title": "Extract the main title of the document. Keep it concise.",
  "module": "Infer the system module this belongs to (e.g., 'System Improvement', 'Supplier Quality', 'Logistics', 'General').",
  "role": "Infer the target audience role (e.g., 'Key User', 'Supplier', 'Admin', 'All Users').",
  "thumb": "from-blue-500 to-indigo-600",
  "views": "0",
  "rating": "100%",
  "duration": "Estimate reading/viewing time based on text length (e.g., '10:00' for 10 minutes).",
  "url": "",
  "description": "Generate a highly professional, 2-3 sentence summary of what this document teaches. Use Chinese (Simplified).",
  "author": "Extract the author or department if present. If not, default to 'IT Support Team'.",
  "updatedAt": "Extract the last updated date (YYYY-MM-DD). If none, use the current date.",
  "tags": ["tag1", "tag2", "tag3"] // Generate 3-5 relevant keywords/tags in English or Chinese.
}
`;
module.exports = async (req, res) => {
    // 1. 处理 CORS
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // 2. 使用 Formidable 解析 Multipart 数据
    const form = new formidable.IncomingForm();
    
    form.parse(req, async (err, fields, files) => {
        if (err) return res.status(500).json({ error: "文件解析失败" });

        try {
            const inputData = fields.inputData?.[0] || fields.inputData; // 提取的文本
            const file = files.file?.[0] || files.file; // 原始文件
            
            if (!file || !inputData) {
                return res.status(400).json({ error: '缺少文件或文本内容' });
            }

            // --- 步骤 A: 上传文件到 Supabase Storage ---
            const fileBuffer = fs.readFileSync(file.filepath);
            const fileName = `${Date.now()}-${file.originalFilename}`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('learning-materials') // 确保你已经在 Supabase 创建了此 Bucket
                .upload(fileName, fileBuffer, {
                    contentType: file.mimetype,
                    upsert: true
                });

            if (uploadError) throw new Error(`文件上传失败: ${uploadError.message}`);

            // 获取公共访问链接
            const { data: { publicUrl } } = supabase.storage
                .from('learning-materials')
                .getPublicUrl(fileName);

            // --- 步骤 B: 调用 AI 解析文本 ---
            const finalPrompt = `${SYSTEM_PROMPT}\n\n[CONTENT]\n${inputData.slice(0, 15000)}`;
            
            const aiResponse = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'qwen-plus',
                    messages: [{ role: "user", content: finalPrompt }],
                    temperature: 0.1
                })
            });

            const aiData = await aiResponse.json();
            // 这里调用你原来的 parseJSON 函数
            let resultJson = parseJSON(aiData.choices[0].message.content);

            // --- 步骤 C: 注入文件链接 ---
            resultJson.url = publicUrl;

            // --- 步骤 D: 将结果存入数据库 ---
            // 假设你的表名是 learning_contents
            const { error: dbError } = await supabase
                .from('learning_contents')
                .insert([{
                    id: resultJson.id,
                    title: resultJson.title,
                    type: resultJson.type,
                    module: resultJson.module,
                    role: resultJson.role,
                    description: resultJson.description,
                    author: resultJson.author,
                    url: resultJson.url, // 这里的 URL 就是刚生成的链接
                    tags: resultJson.tags,
                    raw_json: resultJson, // 建议备份一份完整的 JSON
                    updated_at: new Date()
                }]);

            if (dbError) console.error("数据库存储失败:", dbError);

            // 成功返回给前端
            return res.status(200).json({ success: true, data: resultJson });

        } catch (error) {
            console.error('[API Error]:', error);
            return res.status(500).json({ error: error.message });
        }
    });
};

// 辅助函数 (保持不变)
const parseJSON = (text) => {
    const jsonStr = text.replace(/```json|```/g, '').trim();
    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        const match = jsonStr.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        throw new Error("JSON 解析失败");
    }
};