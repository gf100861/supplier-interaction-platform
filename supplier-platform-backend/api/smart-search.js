const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const https = require('https');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require('cors');

// ==========================================
// 1. 初始化 CORS 中间件
// ==========================================
const corsMiddleware = cors({
    origin: true, 
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With', 'Accept', 'Accept-Version', 'Content-Length', 'Content-MD5', 'Date', 'X-Api-Version'],
    credentials: true,
});

function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
}

// ==========================================
// 2. 初始化客户端
// ==========================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 简单的容错，防止 crashing
const supabase = createClient(supabaseUrl || 'https://placeholder.co', supabaseKey || 'placeholder');
const agent = new https.Agent({ rejectUnauthorized: false });

const llmClient = new OpenAI({
    apiKey: process.env.QWEN_API_KEY || 'dummy', 
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    httpAgent: agent
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy');

// ==========================================
// 3. 工具函数定义 (你之前缺少的就在这里！)
// ==========================================

// --- 工具 A: 获取向量 ---
async function getEmbedding(text, modelType) {
    try {
        // 这里默认用 Gemini Embedding，因为它免费且维度是768
        // 如果你的数据库是用 OpenAI 建的索引，请改用 llmClient.embeddings.create
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.embedContent(text);
        return result.embedding.values;
    } catch (e) {
        console.error("Embedding Error:", e);
        return null;
    }
}

// --- 工具 B: 意图提取 (这就是你报错缺失的函数！) ---
async function extractSearchIntent(query) {
    try {
        const response = await llmClient.chat.completions.create({
            model: "qwen-turbo", // 使用轻量模型提取意图
            messages: [
                { role: "system", content: `提取用户问题中的"供应商(supplier)"或"人名"。返回JSON: {"supplier_name": "名字", "is_asking_count": boolean}。若无则返回 {}` },
                { role: "user", content: query }
            ],
            response_format: { type: "json_object" }
        });
        return JSON.parse(response.choices[0].message.content);
    } catch (e) {
        console.warn("Intent extraction failed, skipping.", e.message);
        return {}; 
    }
}

// --- 工具 C: 数据库统计 ---
async function getSupplierStats(supplierName) {
    if (!supplierName) return null;
    // 使用 ilike 进行模糊匹配统计
    const { count, error } = await supabase.from('notices')
        .select('*', { count: 'exact', head: true })
        .ilike('assigned_supplier_name', `%${supplierName}%`);
        
    if (error) return null;
    return count;
}

// --- 工具 D: 重排序 ---
function simpleRerank(docs, query) {
    const keywords = query.toLowerCase().split(/[\s,，]+/);
    return docs.map(doc => {
        let score = 0;
        // 安全地处理 content，防止 doc.content 为空导致 crash
        const contentStr = JSON.stringify(doc.sd_notice || doc.content || "").toLowerCase();
        
        keywords.forEach(k => {
            if (contentStr.includes(k)) score += 1;
            if (doc.title && doc.title.toLowerCase().includes(k)) score += 3;
            if (doc.notice_code && contentStr.includes(k)) score += 10;
        });
        return { ...doc, rerank_score: score };
    }).sort((a, b) => b.rerank_score - a.rerank_score);
}

// --- 工具 E: 生成最终回答 ---
async function generateCompletion(modelType, systemPrompt, userContextPrompt) {
    console.log(`Generating with model: ${modelType}`);
    
    if (modelType === 'gemini') {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent([systemPrompt, userContextPrompt]);
        return result.response.text();
    } else {
        // 默认走 Qwen / OpenAI 协议
        const targetModel = modelType === 'openai' ? 'gpt-4o' : 'text-embedding-v4';
        const response = await llmClient.chat.completions.create({
            model: targetModel, 
            messages: [
                { role: "system", content: systemPrompt }, 
                { role: "user", content: userContextPrompt }
            ],
            temperature: 0.1
        });
        return response.choices[0].message.content;
    }
}

// ==========================================
// 4. 主处理函数
// ==========================================
// ... (上面的 import 和 工具函数 getEmbedding, extractSearchIntent 等保持不变) ...

// ==========================================
// 4. 主处理函数 (修复版)
// ==========================================
module.exports = async (req, res) => {
    // 1. 设置 CORS 头
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // 2. 处理预检请求 (OPTIONS)
    // 浏览器在发送 POST 之前会先发 OPTIONS，这个请求没有 Body
    // 如果不在这里拦截返回，下面的代码就会试图读取 Body 从而报错
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // 3. 运行中间件 (CORS)
        await runMiddleware(req, res, corsMiddleware);
    } catch (e) {
        return res.status(500).json({ error: 'Internal Server Error (CORS)' });
    }

    // 4. 业务逻辑
    try {
        // === 关键修复开始：给 req.body 穿上防弹衣 ===
        let body = req.body;

        // 情况 A: Vercel 没解析，传来了字符串
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch (e) {
                console.error("JSON Parse Error:", e);
                body = {};
            }
        }
        
        // 情况 B: 根本没有 body (比如 GET 请求或异常)，给个空对象防止崩溃
        if (!body) {
            body = {};
        }
        
        // 现在可以安全地解构了
        const { query: rawQuery, model = 'qwen' } = body;
        // === 关键修复结束 ===
        
        if (!rawQuery) {
            // 打印一下收到的东西，方便去 Vercel 日志排查
            console.log("Empty Query Received. Body was:", body);
            return res.status(400).json({ error: "Query is required in request body" });
        }

        console.log(`[Smart Search] Processing: ${rawQuery}`);

        // --- Step 1: 意图识别 & 向量生成 ---
        const [intentData, embedding] = await Promise.all([
            extractSearchIntent(rawQuery),
            getEmbedding(rawQuery, model)
        ]);

        // --- Step 2: 统计信息 ---
        let statsInfo = "";
        if (intentData.supplier_name) {
            const totalCount = await getSupplierStats(intentData.supplier_name);
            if (totalCount !== null) {
                statsInfo = `\n[系统数据库统计]: 供应商 "${intentData.supplier_name}" 在数据库中总共有 ${totalCount} 条通知单记录。`;
            }
        }

        // --- Step 3: 混合检索 ---
        const [vectorResults, keywordResults] = await Promise.all([
            supabase.rpc('match_notices', { query_embedding: embedding, match_threshold: 0.45, match_count: 15 }),
            supabase.from('notices').select('*').textSearch('content_tsvector', rawQuery, { config: 'chinese', type: 'websearch' }).limit(5)
        ]);

        // --- Step 4: 合并 & 重排序 ---
        const allDocsMap = new Map();
        [...(vectorResults.data || []), ...(keywordResults.data || [])].forEach(d => allDocsMap.set(d.id, d));
        let uniqueDocs = Array.from(allDocsMap.values());
        
        // 简单重排序
        uniqueDocs = simpleRerank(uniqueDocs, rawQuery).slice(0, 6);

        // --- Step 5: 构建 Prompt ---
        const contextText = uniqueDocs.map((d, i) => 
            `[文档${i}] 单号:${d.notice_code} | 供应商:${d.assigned_supplier_name} | 标题:${d.title}\n内容:${JSON.stringify(d.sd_notice || d.content || "").substring(0, 300)}`
        ).join('\n---\n');

        const systemPrompt = `你是一个质量助手。1. 优先基于[系统数据库统计]回答数量问题。2. 细节参考[参考文档]。3. 必须引用文档编号 $$REFS$$: [0, 1]。`;
        const userPrompt = `${statsInfo} \n[参考文档]:\n${contextText}\n问题: ${rawQuery}`;

        // --- Step 6: 生成 ---
        const answer = await generateCompletion(model, systemPrompt, userPrompt);

        res.status(200).json({
            answer: answer,
            sources: uniqueDocs,
            optimizedQuery: intentData.supplier_name ? `查找 ${intentData.supplier_name}` : rawQuery
        });

    } catch (error) {
        console.error("[Backend Logic Error]", error);
        res.status(500).json({ error: error.message });
    }
};