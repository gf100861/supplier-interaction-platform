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

// 优先级：首选 -> 备选1 -> 备选2
// 注意：确保您的 API Key 对这些模型都有权限
const QWEN_FALLBACK_MODELS = [
    'qwen-plus',        // 首选 (可能免费额度用完了)
    'qwen3-max',         // 备选 (性能更强，但要付费)
    'qwen3-vl-plus',       // 再次备选 (速度快，便宜)
    'qwen-max'         // 如果需要长文本
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
        try { return JSON.parse(req.body); } catch (e) { }
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
        // 1. 确定首选模型
        const targetModel = modelType == 'openai' ? 'gpt-4o' : 'qwen-plus';

        // 2. 准备消息体
        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContextPrompt }
        ];

        let response;

        // 3. 执行调用 (根据是否是 OpenAI 分别处理)
        if (modelType == 'openai') {
            // OpenAI 通常不需要复杂的降级，或者你自己决定是否要对 GPT-4 做降级
            response = await llmClient.chat.completions.create({
                model: targetModel,
                messages: messages,
                temperature: 0.1
            });
        } else {
            // ✅ Qwen 系列：使用我们新写的降级函数
            // 当 qwen-plus 报 403 时，会自动尝试 qwen-max 等
            response = await generateWithFallback(llmClient, messages, targetModel);
        }

        return response.choices[0].message.content;
    }
}

/**
 * 带有自动降级机制的生成函数
 * @param {Object} client - llmClient 实例
 * @param {Array} messages - 对话历史
 * @param {String} preferredModel - 用户想要的首选模型
 */
// --- E. 生成回复 (包含自动降级) ---
// 提取到外部，避免在 module.exports 里嵌套过深
async function generateWithFallback(client, messages, preferredModel) {
    let tryModels = [preferredModel, ...QWEN_FALLBACK_MODELS];
    tryModels = [...new Set(tryModels)]; // 去重

    let lastError = null;

    for (const model of tryModels) {
        try {
            console.log(`[Smart Search] Attempting model: ${model}...`);
            const response = await client.chat.completions.create({
                model: model,
                messages: messages,
                temperature: 0.1
            });
            console.log(`[Smart Search] Success with: ${model}`);
            return response;
        } catch (error) {
            console.warn(`[Smart Search] Model ${model} failed. Status: ${error.status}`);
            lastError = error;
            // 403 (No Quota), 429 (Rate Limit), >=500 (Server Error) 才重试
            const shouldRetry = error.status === 403 || error.status === 429 || (error.status >= 500);
            if (!shouldRetry) throw error; 
        }
    }
    throw new Error(`All models failed. Last error: ${lastError?.message}`);
}

async function generateCompletion(modelType, systemPrompt, userContextPrompt) {
    if (modelType === 'gemini') {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent([systemPrompt, userContextPrompt]);
        return result.response.text();
    } else {
        const targetModel = modelType === 'openai' ? 'gpt-4o' : 'qwen-plus';
        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContextPrompt }
        ];

        let response;
        if (modelType === 'openai') {
            response = await llmClient.chat.completions.create({
                model: targetModel,
                messages: messages,
                temperature: 0.1
            });
        } else {
            // Qwen 启用自动降级
            response = await generateWithFallback(llmClient, messages, targetModel);
        }
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

        // --- Step 1: 意图识别 & 向量化 (并行) ---
        const [intentData, embedding] = await Promise.all([
            extractSearchIntent(rawQuery),
            getEmbedding(rawQuery, model)
        ]);

        console.log("Search Intent:", intentData);

        // --- Step 2: 精确统计 ---
        let statsInfo = "";
        const totalCount = await getDatabaseStats(intentData);
        if (totalCount !== null) {
            let desc = [];
            if (intentData.supplier_name) desc.push(`供应商包含"${intentData.supplier_name}"`);
            if (intentData.target_status) desc.push(`状态为"${intentData.target_status}"`);
            statsInfo = `\n【系统数据库统计】: 符合条件(${desc.join(' 且 ')})的记录共有 ${totalCount} 条。`;
        }

        // --- Step 3: 混合检索构建 ---

        // A. 向量检索 Promise
        const vectorSearchPromise = (async () => {
            if (!embedding) return { data: [] };
            const rpcParams = {
                query_embedding: embedding,
                match_threshold: 0.45,
                match_count: 15,
                // ✅ 修正：确保传给 RPC 的参数符合你的 SQL 定义
                // 如果你的 SQL 是 filter jsonb，请改为 filter: { status: ... }
                // 这里假设你的 SQL 接收名为 filter_status 的参数
                filter_status: intentData.target_status || null 
            };
            return supabase.rpc('match_notices', rpcParams);
        })();

        // B. 关键词检索 Promise
        const keywordSearchPromise = (async () => {
            let kwQuery = supabase.from('notices').select('*');
            
            // 如果有明确状态，先硬过滤，减少搜索范围
            if (intentData.target_status) {
                kwQuery = kwQuery.eq('status', intentData.target_status);
            }
            
            // 只有当查询词够长时才进行全文检索，避免单字匹配过多
            if (rawQuery.length > 1) {
                // 使用 websearch 语法支持 "A | B"
                kwQuery = kwQuery.textSearch('content_tsvector', rawQuery, { config: 'chinese', type: 'websearch' });
            } else {
                // 如果没有关键词，就按时间降序取最新的
                return kwQuery.order('created_at', { ascending: false }).limit(5);
            }
            
            return kwQuery.order('created_at', { ascending: false }).limit(10);
        })();

        // C. 状态保底检索 Promise
        const statusFallbackPromise = (async () => {
            if (!intentData.target_status) return { data: [] };

            let fbQuery = supabase.from('notices')
                .select('*')
                .eq('status', intentData.target_status)
                .order('created_at', { ascending: false })
                .limit(5);

            if (intentData.supplier_name) {
                fbQuery = fbQuery.ilike('assigned_supplier_name', `%${intentData.supplier_name}%`);
            }
            return fbQuery;
        })();

        // --- 执行所有检索 ---
        const [vectorResults, keywordResults, fallbackResults] = await Promise.all([
            vectorSearchPromise,
            keywordSearchPromise,
            statusFallbackPromise
        ]);

        // --- Step 4: 合并去重与重排序 ---
        const allDocsMap = new Map();
        
        // 辅助函数：标准化数据结构 (RPC返回的结构可能和表查询不一样，这里做个兼容)
        const normalize = (d) => ({ ...d, id: d.id });

        // 合并策略：Fallback -> Keyword -> Vector (越靠后的如果重复会覆盖前面的，或者保留前面的)
        // 我们希望保留 Vector 的相似度分数，所以 Vector 放最后
        const mergeList = [
            ...(fallbackResults.data || []),
            ...(keywordResults.data || []),
            ...(vectorResults.data || [])
        ];

        mergeList.forEach(d => {
            if (!allDocsMap.has(d.id)) {
                allDocsMap.set(d.id, d);
            }
        });

        let uniqueDocs = Array.from(allDocsMap.values());
        
        // 重排序并截断
        uniqueDocs = simpleRerank(uniqueDocs, rawQuery).slice(0, 8);

        // --- Step 5: 构建 Prompt ---
        const contextText = uniqueDocs.map((d, i) => {
            // 优先取 SD 填写的详细描述，没有则取标题
            const summary = d.sd_notice?.description || d.sd_notice?.details?.finding || d.title || "无详细描述";
            return `[文档${i}] 单号:${d.notice_code} | 状态:${d.status} | 供应商:${d.assigned_supplier_name} \n摘要:${JSON.stringify(summary).substring(0, 300)}`;
        }).join('\n---\n');

        const systemPrompt = `你是一个专业的供应链质量助手。
        1. 开头必须优先引用【系统数据库统计】的数据回答数量问题（如果存在）。
        2. 如果用户查询特定状态，请基于文档中的"状态"字段确认。
        3. 引用文档时使用 Reference: [文档x]。
        4. 如果没有找到相关文档，请诚实告知。`;

        const userPrompt = `${statsInfo} \n\n[参考文档]:\n${contextText}\n\n用户问题: ${rawQuery}`;

        // --- Step 6: 生成回答 ---
        const answer = await generateCompletion(model, systemPrompt, userPrompt);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        res.status(200).json({
            answer: answer,
            sources: uniqueDocs, // 返回源文档供前端展示卡片
            optimizedQuery: intentData.target_status ? `[状态过滤: ${intentData.target_status}] ${rawQuery}` : rawQuery,
            thinkingTime: duration
        });

    } catch (error) {
        console.error("[Search API Error]", error);
        // 返回 500 时包含错误信息，方便前端 toast 提示
        res.status(500).json({ error: error.message });
    }
};