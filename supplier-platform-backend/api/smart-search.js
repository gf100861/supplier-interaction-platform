// 文件路径: ./api/smart-search.js

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const https = require('https');
// 1. 引入 Google SDK
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- 配置部分 ---

// 初始化 Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// SSL 代理 (解决公司内网问题)
const agent = new https.Agent({ rejectUnauthorized: false });

// A. 初始化 Qwen/OpenAI 客户端
const llmClient = new OpenAI({
    apiKey: process.env.QWEN_API_KEY, 
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    httpAgent: agent
});

// B. 初始化 Google Gemini 客户端
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- 核心工具函数 ---

// 1. 获取向量 (注意：必须与你数据库里存储的向量模型保持一致！)
// 如果你之前是用 Gemini 存的向量，这里必须用 Gemini 生成查询向量，否则搜不到！
async function getEmbedding(text, modelType) {
    try {
        // 假设数据库是用 Gemini 004 建的索引 (根据你之前的代码)
        // 如果想混用，建议统一在这里写死一种，比如始终用 Gemini 或 始终用 OpenAI
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.embedContent(text);
        return result.embedding.values;

        // 如果想用 Qwen/OpenAI 的向量，解开下面注释：
        /*
        const response = await llmClient.embeddings.create({
            model: "text-embedding-v3-small", 
            input: text,
        });
        return response.data[0].embedding;
        */
    } catch (e) {
        console.error("Embedding Error:", e);
        return null;
    }
}

// 2. 通用生成函数 (根据 modelType 切换)
async function generateCompletion(modelType, systemPrompt, userContextPrompt) {
    console.log(`[Model Switch] Using: ${modelType}`);

    // --- 分支 A: Google Gemini ---
    if (modelType === 'gemini') {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent([
            systemPrompt, // Gemini 没有明确的 system role，通常直接拼在前面或者用 instruction
            userContextPrompt
        ]);
        return result.response.text();
    } 
    
    // --- 分支 B: Qwen / OpenAI ---
    else {
        // 默认使用 Qwen (兼容 OpenAI 协议)
        const targetModel = modelType === 'openai' ? 'gpt-4o' : 'qwen-plus'; // 简单映射
        
        const response = await llmClient.chat.completions.create({
            model: targetModel, 
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userContextPrompt }
            ],
            temperature: 0.3
        });
        return response.choices[0].message.content;
    }
}

// 3. 查询重写 (通常用一个快速模型即可，这里默认用 Qwen)
async function rewriteQuery(userQuery) {
    try {
        const response = await llmClient.chat.completions.create({
            model: "text-embedding-v4", // 用便宜快模型
            messages: [
                { role: "system", content: "你是一个搜索助手。请扩展用户的搜索关键词，展开缩写，提取核心实体。直接输出优化后的关键词，不要废话。" },
                { role: "user", content: userQuery }
            ]
        });
        return response.choices[0].message.content;
    } catch (e) {
        return userQuery;
    }
}

// 4. 简单重排序
function simpleRerank(docs, query) {
    const keywords = query.toLowerCase().split(/[\s,，]+/);
    return docs.map(doc => {
        let score = 0;
        const content = JSON.stringify(doc).toLowerCase();
        keywords.forEach(k => {
            if (content.includes(k)) score += 1;
            if (doc.notice_code && content.includes(k)) score += 10; // 单号匹配加重权
        });
        return { ...doc, rerank_score: score };
    }).sort((a, b) => b.rerank_score - a.rerank_score);
}

// === 主处理函数 ===
module.exports = async (req, res) => {
    try {
        // 1. 接收前端传来的 model 参数
        const { query: rawQuery, model = 'qwen' } = req.body; 
        
        if (!rawQuery) return res.status(400).json({ error: "Query required" });

        // 2. 智能重写
        const optimizedQuery = await rewriteQuery(rawQuery);

        // 3. 获取向量 (重要：确保和数据库已有向量是同一种模型生成的)
        const embedding = await getEmbedding(optimizedQuery, model);
        
        // 4. 数据库检索
        const [vectorResults, keywordResults] = await Promise.all([
            supabase.rpc('match_notices', {
                query_embedding: embedding,
                match_threshold: 0.45,
                match_count: 15
            }),
            supabase.from('notices').select('*')
                .textSearch('content_tsvector', rawQuery, { config: 'chinese', type: 'websearch' })
                .limit(5)
        ]);

        // 5. 合并去重
        const allDocsMap = new Map();
        [...(vectorResults.data || []), ...(keywordResults.data || [])].forEach(d => allDocsMap.set(d.id, d));
        let uniqueDocs = Array.from(allDocsMap.values());

        // 6. 重排序
        uniqueDocs = simpleRerank(uniqueDocs, rawQuery).slice(0, 5);

        // 7. 构建上下文
        const contextText = uniqueDocs.map((d, i) => 
            `[文档${i}] 单号:${d.notice_code} | 标题:${d.title}\n内容:${JSON.stringify(d.sd_notice || d.content).substring(0, 800)}`
        ).join('\n---\n');

        const systemPrompt = "你是一个严谨的质量助手。请基于以下参考文档回答问题。必须在回答末尾引用实际使用到的文档编号，格式如 $$REFS$$: [0, 2]。如果文档无法回答问题，请直说。";
        const userPrompt = `参考文档:\n${contextText}\n\n问题: ${rawQuery}`;

        // 8. 生成回答 (动态切换模型)
        const answer = await generateCompletion(model, systemPrompt, userPrompt);

        res.json({
            answer: answer,
            sources: uniqueDocs,
            optimizedQuery: optimizedQuery
        });

    } catch (error) {
        console.error("[Backend Error]", error);
        res.status(500).json({ error: error.message });
    }
};