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
// 2. 强力 Body 解析器 (解决 Vercel req.body undefined 问题)
// ==========================================
const parseRequestBody = async (req) => {
    // 1. 如果 Vercel 已经解析好了 (对象)
    if (req.body && typeof req.body === 'object') {
        return req.body;
    }

    // 2. 如果 Vercel 解析成了字符串
    if (req.body && typeof req.body === 'string') {
        try {
            return JSON.parse(req.body);
        } catch (e) {
            console.error("JSON parse failed (string):", e);
        }
    }

    // 3. (兜底) 如果 req.body 为空，手动读取流
    // 这通常发生在 Vercel 认为 Content-Type 不标准时
    return new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => {
            data += chunk;
        });
        req.on('end', () => {
            if (!data) return resolve({});
            try {
                resolve(JSON.parse(data));
            } catch (e) {
                console.error("Manual JSON parse failed:", e);
                console.log("Raw Data:", data);
                resolve({});
            }
        });
        req.on('error', (err) => {
            console.error("Stream read error:", err);
            resolve({});
        });
    });
};

// ==========================================
// 3. 初始化客户端 & 工具函数
// ==========================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl || 'https://placeholder.co', supabaseKey || 'placeholder');
const agent = new https.Agent({ rejectUnauthorized: false });

const llmClient = new OpenAI({
    apiKey: process.env.QWEN_API_KEY || 'dummy', 
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    httpAgent: agent
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy');

// --- 工具函数 A: 获取向量 ---
async function getEmbedding(text, modelType) {
    try {
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.embedContent(text);
        return result.embedding.values;
    } catch (e) {
        console.error("Embedding Error:", e);
        return null;
    }
}

// --- 工具函数 B: 意图提取 ---
async function extractSearchIntent(query) {
    try {
        const response = await llmClient.chat.completions.create({
            model: "qwen-turbo",
            messages: [
                { role: "system", content: `提取用户问题中的"供应商(supplier)"或"人名"。返回JSON: {"supplier_name": "名字", "is_asking_count": boolean}。若无则返回 {}` },
                { role: "user", content: query }
            ],
            response_format: { type: "json_object" }
        });
        return JSON.parse(response.choices[0].message.content);
    } catch (e) { return {}; }
}

// --- 工具函数 C: 数据库统计 ---
async function getSupplierStats(supplierName) {
    if (!supplierName) return null;
    const { count, error } = await supabase.from('notices').select('*', { count: 'exact', head: true }).ilike('assigned_supplier_name', `%${supplierName}%`);
    if (error) return null;
    return count;
}

// --- 工具函数 D: 重排序 ---
function simpleRerank(docs, query) {
    const keywords = query.toLowerCase().split(/[\s,，]+/);
    return docs.map(doc => {
        let score = 0;
        const content = JSON.stringify(doc.sd_notice || doc.content || "").toLowerCase();
        keywords.forEach(k => {
            if (content.includes(k)) score += 1;
            if (doc.title && doc.title.toLowerCase().includes(k)) score += 3;
            if (doc.notice_code && content.includes(k)) score += 10;
        });
        return { ...doc, rerank_score: score };
    }).sort((a, b) => b.rerank_score - a.rerank_score);
}

// --- 工具函数 E: 生成 ---
async function generateCompletion(modelType, systemPrompt, userContextPrompt) {
    if (modelType === 'gemini') {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent([systemPrompt, userContextPrompt]);
        return result.response.text();
    } else {
        console.log("Using model:", modelType);
        
        // ❌ 错误写法 (你现在的代码):
        // const targetModel = modelType == 'openai' ? 'gpt-4o' : 'text-embedding-v4'; 
        
        // ✅ 正确写法:
        // 如果是 Qwen，必须用 qwen-plus (或 qwen-max, qwen-turbo)
        const targetModel = modelType == 'openai' ? 'gpt-4o' : 'qwen3-max-preview'; 
        
        const response = await llmClient.chat.completions.create({
            model: targetModel, // 这里必须是聊天模型
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
module.exports = async (req, res) => {

    // 1. 【新增】开始计时
    const startTime = Date.now();
 
    // 不要往下走，不要读 Body，不要连数据库
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // 3. 运行 CORS 中间件
        await runMiddleware(req, res, corsMiddleware);
    } catch (e) {
        return res.status(500).json({ error: 'Internal Server Error (CORS)' });
    }

    try {
        // === 关键修改：使用强力解析器 ===
        const body = await parseRequestBody(req);
        const { query: rawQuery, model = 'qwen' } = body;
        
        if (!rawQuery) {
            console.log("Error: No query found. Body received:", JSON.stringify(body));
            return res.status(400).json({ 
                error: "Query is required in request body",
                debug_body: body // 为了调试，把收到的东西返回给你看
            });
        }

        // --- Step 1: 意图 & 向量 ---
        const [intentData, embedding] = await Promise.all([
            extractSearchIntent(rawQuery),
            getEmbedding(rawQuery, model)
        ]);

        // --- Step 2: 统计 ---
        let statsInfo = "";
        if (intentData.supplier_name) {
            const totalCount = await getSupplierStats(intentData.supplier_name);
            if (totalCount !== null) {
                statsInfo = `\n[系统数据库统计]: 供应商 "${intentData.supplier_name}" 在数据库中总共有 ${totalCount} 条通知单记录。`;
            }
        }

        // --- Step 3: 检索 ---
        const [vectorResults, keywordResults] = await Promise.all([
            supabase.rpc('match_notices', { query_embedding: embedding, match_threshold: 0.45, match_count: 15 }),
            supabase.from('notices').select('*').textSearch('content_tsvector', rawQuery, { config: 'chinese', type: 'websearch' }).limit(5)
        ]);

        // --- Step 4: 合并重排 ---
        const allDocsMap = new Map();
        [...(vectorResults.data || []), ...(keywordResults.data || [])].forEach(d => allDocsMap.set(d.id, d));
        let uniqueDocs = Array.from(allDocsMap.values());
        uniqueDocs = simpleRerank(uniqueDocs, rawQuery).slice(0, 6);

        // --- Step 5: 上下文 ---
        const contextText = uniqueDocs.map((d, i) => 
            `[文档${i}] 单号:${d.notice_code} | 供应商:${d.assigned_supplier_name} | 标题:${d.title}\n内容:${JSON.stringify(d.sd_notice || d.content || "").substring(0, 300)}`
        ).join('\n---\n');

        const systemPrompt = `你是一个质量助手。1. 优先基于[系统数据库统计]回答数量问题。2. 细节参考[参考文档]。3. 必须引用文档编号 $$REFS$$: [0, 1]。`;
        const userPrompt = `${statsInfo} \n[参考文档]:\n${contextText}\n问题: ${rawQuery}`;

        // --- Step 6: 生成 ---
        const answer = await generateCompletion(model, systemPrompt, userPrompt);

        // 2. 【新增】结束计时 & 计算耗时 (单位：秒，保留2位小数)
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        res.status(200).json({
            answer: answer,
            sources: uniqueDocs,
            optimizedQuery: intentData.supplier_name ? `查找 ${intentData.supplier_name}` : rawQuery,
            thinkingTime: duration // <--- 把这个字段传给前端
        });

    } catch (error) {
        console.error("[Backend Logic Error]", error);
        res.status(500).json({ error: error.message });
    }
};