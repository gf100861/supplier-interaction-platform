const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const https = require('https');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require('cors');

// ==========================================
// 0. 配置常量
// ==========================================
// 请根据您数据库中实际的 enum 或 check constraint 修改此列表
const VALID_STATUSES = [
    '待提交Action Plan', 
    '待供应商关闭', 
    '待SD确认actions', 
    '待SD确认actions计划', 
    '待SD关闭evidence', 
    '已完成', 
    '已作废'
];

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
            if (result instanceof Error) return reject(result);
            return resolve(result);
        });
    });
}

// ==========================================
// 2. 强力 Body 解析器
// ==========================================
const parseRequestBody = async (req) => {
    if (req.body && typeof req.body === 'object') return req.body;
    if (req.body && typeof req.body === 'string') {
        try { return JSON.parse(req.body); } catch (e) {}
    }
    return new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => {
            if (!data) return resolve({});
            try { resolve(JSON.parse(data)); } catch (e) { resolve({}); }
        });
        req.on('error', () => resolve({}));
    });
};

// ==========================================
// 3. 初始化客户端
// ==========================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const agent = new https.Agent({ rejectUnauthorized: false });

const llmClient = new OpenAI({
    apiKey: process.env.QWEN_API_KEY || 'dummy', 
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    httpAgent: agent
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy');

// ==========================================
// 4. 工具函数集
// ==========================================

// --- A. 意图提取 (增强版：支持状态映射) ---
async function extractSearchIntent(query) {
    try {
        const response = await llmClient.chat.completions.create({
            model: "qwen-turbo", // 使用快速模型
            messages: [
                { 
                    role: "system", 
                    content: `你是查询意图分析器。
                    1. 提取用户问题中的 "供应商(supplier)" 或 "人名"。
                    2. 判断用户是否在筛选特定状态。数据库合法状态仅限: ${JSON.stringify(VALID_STATUSES)}。
                    3. 模糊匹配规则: 
                       - "待SD处理" -> 可能指 "待SD确认actions" 或 "待SD关闭evidence" (如无法确定，返回null)
                       - "待供应商处理" -> "待提交Action Plan" 或 "待供应商关闭"
                       - "待关闭" -> "待供应商关闭" 或 "待SD关闭evidence"
                       - "已关闭" -> "已完成"
                    4. 如果用户询问"数量"、"多少条"，设置 is_asking_count 为 true。
                    
                    返回 JSON: {"supplier_name": "string/null", "target_status": "string/null (必须完全匹配合法状态)", "is_asking_count": boolean}` 
                },
                { role: "user", content: query }
            ],
            response_format: { type: "json_object" }
        });
        return JSON.parse(response.choices[0].message.content);
    } catch (e) { 
        console.error("Intent Extract Error:", e);
        return {}; 
    }
}

// --- B. 获取向量 ---
async function getEmbedding(text, modelType) {
    try {
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.embedContent(text);
        return result.embedding.values;
    } catch (e) { return null; }
}

// --- C. 数据库精确统计 ---
async function getDatabaseStats(intent) {
    // 如果没有具体意图，不进行全表扫描统计
    if (!intent.supplier_name && !intent.target_status) return null;

    let query = supabase.from('notices').select('*', { count: 'exact', head: true });

    if (intent.supplier_name) {
        query = query.ilike('assigned_supplier_name', `%${intent.supplier_name}%`);
    }
    if (intent.target_status) {
        query = query.eq('status', intent.target_status);
    }

    const { count, error } = await query;
    if (error) return null;
    return count;
}

// --- D. 简单重排 ---
// --- D. 简单重排 (修改后：增加时间权重) ---
function simpleRerank(docs, query) {
    const keywords = query.toLowerCase().split(/[\s,，]+/);
    return docs.map(doc => {
        let score = 0;
        const content = JSON.stringify(doc.sd_notice || doc.content || "").toLowerCase();
        
        // 1. 基础关键词匹配
        keywords.forEach(k => {
            if (content.includes(k)) score += 1;
            if (doc.title && doc.title.toLowerCase().includes(k)) score += 3;
            if (doc.status && query.includes(doc.status)) score += 5; 
        });

        // 2. ✅ 新增：时间加权 (最近 7 天的数据加分)
        if (doc.created_at) {
            const daysDiff = (new Date() - new Date(doc.created_at)) / (1000 * 60 * 60 * 24);
            if (daysDiff < 7) score += 10; // 一周内的新单据大幅加分
            else if (daysDiff < 30) score += 5; // 一个月内的加分
        }

        return { ...doc, rerank_score: score };
    }).sort((a, b) => b.rerank_score - a.rerank_score);
}

// --- E. 生成回复 ---
async function generateCompletion(modelType, systemPrompt, userContextPrompt) {
    if (modelType === 'gemini') {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent([systemPrompt, userContextPrompt]);
        return result.response.text();
    } else {
        const targetModel = modelType == 'openai' ? 'gpt-4o' : 'qwen-plus'; 
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
// 5. 主处理函数
// ==========================================
module.exports = async (req, res) => {
    const startTime = Date.now();

    if (req.method === 'OPTIONS') return res.status(200).end();

    try { await runMiddleware(req, res, corsMiddleware); } 
    catch (e) { return res.status(500).json({ error: 'CORS Error' }); }

    try {
        const body = await parseRequestBody(req);
        const { query: rawQuery, model = 'qwen' } = body;
        
        if (!rawQuery) return res.status(400).json({ error: "Query required" });

        // --- Step 1: 并行执行意图识别和向量化 ---
        const [intentData, embedding] = await Promise.all([
            extractSearchIntent(rawQuery),
            getEmbedding(rawQuery, model)
        ]);

        console.log("Search Intent:", intentData); // 调试日志

        // --- Step 2: 获取精确统计数据 ---
        let statsInfo = "";
        const totalCount = await getDatabaseStats(intentData);
        if (totalCount !== null) {
            let desc = "";
            if (intentData.supplier_name) desc += `供应商包含"${intentData.supplier_name}"`;
            if (intentData.target_status) desc += `${desc ? ' 且' : ''}状态为"${intentData.target_status}"`;
            statsInfo = `\n【系统数据库统计】: 符合条件(${desc})的记录共有 ${totalCount} 条。`;
        }

        // --- Step 3: 混合检索 (向量 + 关键词 + 结构化过滤) ---
        
        // A. 向量检索参数
        const rpcParams = {
            query_embedding: embedding,
            match_threshold: 0.45,
            match_count: 15
        };
        // 关键：如果意图识别出了状态，传给 RPC 进行硬过滤
        if (intentData.target_status) {
            rpcParams.filter_status = intentData.target_status;
        }

        // B. 关键词检索构建
       // B. 关键词检索构建 (修改后)
        const keywordSearchPromise = (async () => {
            let kwQuery = supabase.from('notices').select('*');
            if (intentData.target_status) {
                kwQuery = kwQuery.eq('status', intentData.target_status);
            }
            if (rawQuery.length > 1) {
                kwQuery = kwQuery.textSearch('content_tsvector', rawQuery, { config: 'chinese', type: 'websearch' });
            }
            // ✅ 新增：强制按时间倒序，保证最新创建的单据优先被检索到
            return kwQuery.order('created_at', { ascending: false }).limit(10); 
        })();

        // C. 【新增】状态保底检索 (Status Fallback)
        // 如果用户指定了状态，我们无视 textSearch，直接硬抓取该状态下最新的 5 条
        // 解决 "列出5个..." 这种指令型查询导致 textSearch 结果为空的问题
        const statusFallbackPromise = (async () => {
            if (!intentData.target_status) return { data: [] };
            
            let fbQuery = supabase.from('notices')
                .select('*')
                .eq('status', intentData.target_status)
                .order('created_at', { ascending: false })
                .limit(5); // 保底抓5条，确保 AI 有素材可聊
            
            // 如果还指定了供应商，保底时也加上，防止串台
            if (intentData.supplier_name) {
                fbQuery = fbQuery.ilike('assigned_supplier_name', `%${intentData.supplier_name}%`);
            }
            
            return fbQuery;
        })();

       // 执行所有检索
        const [vectorResults, keywordResults, fallbackResults] = await Promise.all([
            supabase.rpc('match_notices', rpcParams),
            keywordSearchPromise,
            statusFallbackPromise
        ]);

        // --- Step 4: 合并去重与重排序 ---
      // --- Step 4: 合并去重与重排序 ---
        const allDocsMap = new Map();
        // 优先放入 Keyword 和 Vector 的结果，最后放入 Fallback 的结果补充
        [
            ...(vectorResults.data || []), 
            ...(keywordResults.data || []),
            ...(fallbackResults.data || []) // 把保底数据合并进来
        ].forEach(d => {
            // 使用 Map 去重，如果 id 已存在则不覆盖（或者覆盖，看需求）
            if (!allDocsMap.has(d.id)) {
                allDocsMap.set(d.id, d);
            }
        });
        let uniqueDocs = Array.from(allDocsMap.values());
        
        uniqueDocs = simpleRerank(uniqueDocs, rawQuery).slice(0, 8); // 取前8条

        // --- Step 5: 构建上下文 ---
        const contextText = uniqueDocs.map((d, i) => 
            `[文档${i}] 单号:${d.notice_code} | 状态:${d.status} | 供应商:${d.assigned_supplier_name} | 标题:${d.title}\n摘要:${JSON.stringify(d.sd_notice?.description || d.title).substring(0, 200)}`
        ).join('\n---\n');

        const systemPrompt = `你是一个专业的供应链质量助手。
        1. 开头必须优先引用【系统数据库统计】的数据回答数量问题。
        2. 如果用户查询特定状态（如“待SD关闭”），请基于[参考文档]中的"状态"字段进行确认。
        3. 回答需简洁专业，引用文档时使用 Reference: [0, 1]。`;

        const userPrompt = `${statsInfo} \n\n[参考文档]:\n${contextText}\n\n用户问题: ${rawQuery}`;

        // --- Step 6: 生成回答 ---
        const answer = await generateCompletion(model, systemPrompt, userPrompt);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        res.status(200).json({
            answer: answer,
            sources: uniqueDocs,
            optimizedQuery: intentData.target_status 
                ? `[状态过滤: ${intentData.target_status}] ${rawQuery}` 
                : rawQuery,
            thinkingTime: duration
        });

    } catch (error) {
        console.error("[Search API Error]", error);
        res.status(500).json({ error: error.message });
    }
};