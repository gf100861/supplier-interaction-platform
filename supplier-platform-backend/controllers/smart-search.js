const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const https = require('https');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require('cors');

// ==========================================
// 0. 配置常量
// ==========================================
const VALID_STATUSES = [
    '待提交Action Plan',
    '待供应商关闭',
    '待SD确认actions',
    '待SD确认actions计划',
    '待SD关闭evidence',
    '已完成',
    '已作废'
];

const QWEN_FALLBACK_MODELS = [
    'qwen3-max',         
    'qwen3-vl-plus',       
    'qwen-max'         
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

// --- A. 意图提取 ---
async function extractSearchIntent(query) {
    try {
        const today = new Date().toISOString().split('T')[0]; // 注入今天日期作为时间推算锚点

        const response = await llmClient.chat.completions.create({
            model: "qwen-max",
            messages: [
                {
                    role: "system",
                    content: `
你是查询意图分析器（Intent Extractor）。

任务：从用户问题中提取结构化查询参数。

规则：
1. 提取供应商名称(supplier)：未明确提及时必须返回 null。
2. 状态识别：
   数据库合法状态仅限:
   ${JSON.stringify(VALID_STATUSES)}

   模糊映射：
   - "待SD处理" -> ["待SD确认actions","待SD关闭evidence"]
   - "待供应商处理" -> ["待提交Action Plan","待供应商关闭"]
   - "待提交" -> ["待提交Action Plan"]
   - "待确认" -> ["待SD确认actions","待SD确认actions计划"]
   - "待关闭" -> ["待供应商关闭","待SD关闭evidence"]
   - "已关闭" -> ["已完成"]

   若无法确定具体状态，返回空数组 []
3. 分类识别 (category) (重要)：
   系统中合法的单据分类仅包含: ["Historical 8D", "Process Audit", "SEM"]
   请根据用户提问进行映射：
   - 提到 "8D" 或 "历史8D" -> 提取为 ["Historical 8D"]
   - 提到 "审核" 或 "过程审核" -> 提取为 ["Process Audit"]
   - 提到 "SEM" -> 提取为 ["SEM"]
   若未明确提及，返回空数组 []。
4. 时间解析 (重要)：当前系统日期是：${today}。若提及时间范围（最近一周/上个月/今年等），请精准推算并转换为 start_date 和 end_date（YYYY-MM-DD）。若只有开始时间无结束时间（如2024年之后），end_date 为 null。
5. 查询类型：count (多少/数量), list (列出/查看), summary (汇总/总结), unknown。
6. 提取核心搜索词 (keywords)：提取用户查询中的核心业务对象、零件名或问题描述（如 "漏水", "开裂", "螺栓"）。必须过滤掉问候语或语气词。注意：如果某个词已经被提取为分类（如"8D"），就不要再放入 keywords 中了。若无明确核心词则返回空数组 []。
7. 查询目标实体 (target_entity)：
   - "notice"：默认值。查询通知单、报告、审核、记录、问题等。
   - "supplier"：当明确查询“供应商”本身的数量或信息时（如“系统有几家供应商”、“所有的供应商有哪些”），提取为 "supplier"。

返回 JSON（必须严格符合）：
{
  "target_entity": "notice|supplier",
  "supplier_name": "string|null",
  "target_statuses": ["string"],
  "target_categories": ["string"],
  "time_range": {
      "start_date": "string|null",
      "end_date": "string|null"
  },
  "keywords": ["string"],
  "intent_type": "list|count|summary|unknown",
  "confidence": number
}
`
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
    const hasSupplier = !!intent.supplier_name;
    const hasStatus = intent.target_statuses && intent.target_statuses.length > 0;
    const hasCategory = intent.target_categories && intent.target_categories.length > 0;
    const hasTime = intent.time_range && (intent.time_range.start_date || intent.time_range.end_date);
    const hasKeyword = intent.keywords && intent.keywords.length > 0;
    const isCountIntent = intent.intent_type === 'count';

    // 【新增】路由一：如果是要查供应商表
    if (intent.target_entity === 'supplier') {
        let query = supabase.from('suppliers').select('*', { count: 'exact', head: true });
        if (hasSupplier) {
            query = query.ilike('name', `%${intent.supplier_name}%`);
        }
        const { count, error } = await query;
        if (error) return null;
        return { type: 'supplier', count };
    }

    // 【路由二】查通知单：若没有任何过滤条件，且不是在问“总计多少”，则跳过全表统计
    if (!hasSupplier && !hasStatus && !hasCategory && !hasTime && !hasKeyword && !isCountIntent) return null;

    let query = supabase.from('notices').select('*', { count: 'exact', head: true });

    if (hasSupplier) {
        query = query.ilike('assigned_supplier_name', `%${intent.supplier_name}%`);
    }
    if (hasStatus) {
        query = query.in('status', intent.target_statuses);
    }
    if (hasCategory) {
        query = query.in('category', intent.target_categories);
    }
    if (hasTime) {
        if (intent.time_range.start_date) query = query.gte('created_at', `${intent.time_range.start_date}T00:00:00.000Z`) || query.gte('createdAt', `${intent.time_range.start_date}T00:00:00.000Z`) ;
        if (intent.time_range.end_date) query = query.lte('created_at', `${intent.time_range.end_date}T23:59:59.999Z`) || query.lte('createdAt', `${intent.time_range.end_date}T23:59:59.999Z`);
    }
    if (hasKeyword) {
        // 构建 OR 条件，去标题和单号中找核心词
        const orFilters = intent.keywords.map(k => `title.ilike.%${k}%,notice_code.ilike.%${k}%`).join(',');
        query = query.or(orFilters);
    }

    const { count, error } = await query;
    if (error) return null;
    return { type: 'notice', count };
}


// --- D. 简单重排 ---
function simpleRerank(docs, query) {
    const keywords = query.toLowerCase().split(/[\s,，]+/);
    return docs.map(doc => {
        let score = 0;
        const content = JSON.stringify(doc.sd_notice || doc.content || "").toLowerCase();

        keywords.forEach(k => {
            if (content.includes(k)) score += 1;
            if (doc.title && doc.title.toLowerCase().includes(k)) score += 3;
            if (doc.status && query.includes(doc.status)) score += 5;
            if (doc.category && doc.category.toLowerCase().includes(k)) score += 5; // 针对分类词加权
        });

        if (doc.created_at) {
            const daysDiff = (new Date() - new Date(doc.created_at)) / (1000 * 60 * 60 * 24);
            if (daysDiff < 7) score += 10; 
            else if (daysDiff < 30) score += 5; 
        }

        return { ...doc, rerank_score: score };
    }).sort((a, b) => b.rerank_score - a.rerank_score);
}

// --- E. 生成回复 (包含自动降级) ---
async function generateWithFallback(client, messages, preferredModel) {
    let tryModels = [preferredModel, ...QWEN_FALLBACK_MODELS];
    tryModels = [...new Set(tryModels)]; 

    let lastError = null;

    for (const model of tryModels) {
        try {
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
        // contextDocs 参数：用于接收前端固定的上下文数据
        const { query: rawQuery, model = 'qwen', contextDocs = null } = body;

        if (!rawQuery) return res.status(400).json({ error: "Query required" });

        let uniqueDocs = [];
        let statsInfo = "";
        let intentData = {};
        let optDesc = [];

        // --- 核心优化点 1：始终先行提取意图，不被 contextDocs 短路 ---
        const [parsedIntent, embedding] = await Promise.all([
            extractSearchIntent(rawQuery),
            getEmbedding(rawQuery, model)
        ]);
        intentData = parsedIntent;
        console.log("[Intent Data]", intentData);

        // --- 核心优化点 2：智能判断是否沿用上下文 ---
        // 如果用户的提问中包含了明确的【实体过滤特征】（换了供应商、指定了特定状态或时间），说明这是一个全新的查询意图，不能被历史上下文束缚。
        const hasStrongFilters = 
            !!intentData.supplier_name || 
            (intentData.target_statuses && intentData.target_statuses.length > 0) ||
            (intentData.target_categories && intentData.target_categories.length > 0) ||
            (intentData.time_range && (intentData.time_range.start_date || intentData.time_range.end_date));

        // 仅当前端传了上下文，且本次提问没有强烈的“另起炉灶”过滤条件时，才沿用旧上下文
        const shouldUseContext = contextDocs && Array.isArray(contextDocs) && contextDocs.length > 0 && !hasStrongFilters;

        if (shouldUseContext) {
            console.log(`[Smart Search] No strong filters detected. Reusing ${contextDocs.length} provided context docs.`);
            uniqueDocs = contextDocs;
            statsInfo = "\n【系统提示】: 基于当前固定的上下文（追问模式）进行回答。";
            optDesc.push(`沿用历史上下文 (${contextDocs.length}篇文档)`);
        } else {
            console.log(`[Smart Search] Strong filters detected or no context. Executing DB Retrieval.`);
            // --- 没有有效上下文，或意图发生了改变，走完整的数据库检索链路 ---
            
            // Step 2: 精确统计
            const statsResult = await getDatabaseStats(intentData);
            if (statsResult !== null) {
                let desc = [];
                if (intentData.supplier_name) desc.push(`名称包含"${intentData.supplier_name}"`);
                if (intentData.target_statuses?.length > 0) desc.push(`状态为"${intentData.target_statuses.join(',')}"`);
                if (intentData.target_categories?.length > 0) desc.push(`分类为"${intentData.target_categories.join(',')}"`);
                if (intentData.keywords?.length > 0) desc.push(`包含关键词"${intentData.keywords.join(',')}"`);
                
                const conditionStr = desc.length > 0 ? `符合条件(${desc.join(' 且 ')})的` : "系统总计的";

                if (statsResult.type === 'supplier') {
                    statsInfo = `\n【系统数据库统计】: ${conditionStr}合作供应商共有 ${statsResult.count} 家。`;
                } else {
                    statsInfo = `\n【系统数据库统计】: ${conditionStr}通知单记录共有 ${statsResult.count} 条。`;
                }
            }

            // Step 3: 混合检索构建
            const vectorSearchPromise = (async () => {
                if (!embedding || intentData.target_entity === 'supplier') return { data: [] };
                const rpcParams = {
                    query_embedding: embedding,
                    match_threshold: 0.45,
                    match_count: 15,
                    filter_status: intentData.target_statuses?.[0] || null
                };
                return supabase.rpc('match_notices', rpcParams);
            })();

            const keywordSearchPromise = (async () => {
                if (intentData.target_entity === 'supplier') return { data: [] };
                let kwQuery = supabase.from('notices').select('*');
                if (intentData.target_statuses?.length > 0) {
                    kwQuery = kwQuery.in('status', intentData.target_statuses);
                }
                if (intentData.target_categories?.length > 0) {
                    kwQuery = kwQuery.in('category', intentData.target_categories);
                }
                if (rawQuery.length > 1) {
                    kwQuery = kwQuery.textSearch('content_tsvector', rawQuery, { config: 'chinese', type: 'websearch' });
                } else {
                    return kwQuery.order('created_at', { ascending: false }).limit(5);
                }
                return kwQuery.order('created_at', { ascending: false }).limit(10);
            })();

            const intentBasedSearchPromise = (async () => {
                // 如果明确是在查询供应商本身，则不从 notices 表盲目提取文档
                if (intentData.target_entity === 'supplier') return { data: [] };

                const hasSupplier = !!intentData.supplier_name;
                const hasStatus = intentData.target_statuses && intentData.target_statuses.length > 0;
                const hasCategory = intentData.target_categories && intentData.target_categories.length > 0;
                const hasTime = intentData.time_range && (intentData.time_range.start_date || intentData.time_range.end_date);
                const hasKeyword = intentData.keywords && intentData.keywords.length > 0;

                if (!hasSupplier && !hasStatus && !hasCategory && !hasTime && !hasKeyword) return { data: [] };

                let intentQuery = supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(15);

                if (hasSupplier) intentQuery = intentQuery.ilike('assigned_supplier_name', `%${intentData.supplier_name}%`);
                if (hasStatus) intentQuery = intentQuery.in('status', intentData.target_statuses);
                if (hasCategory) intentQuery = intentQuery.in('category', intentData.target_categories);
                if (hasTime) {
                    if (intentData.time_range.start_date) intentQuery = intentQuery.gte('created_at', `${intentData.time_range.start_date}T00:00:00.000Z`);
                    if (intentData.time_range.end_date) intentQuery = intentQuery.lte('created_at', `${intentData.time_range.end_date}T23:59:59.999Z`);
                }
                if (hasKeyword) {
                    const orFilters = intentData.keywords.map(k => `title.ilike.%${k}%,notice_code.ilike.%${k}%`).join(',');
                    intentQuery = intentQuery.or(orFilters);
                }

                return intentQuery;
            })();

            const [vectorResults, keywordResults, intentResults] = await Promise.all([
                vectorSearchPromise,
                keywordSearchPromise,
                intentBasedSearchPromise
            ]);

            // Step 4: 合并去重与重排序
            const allDocsMap = new Map();
            const mergeList = [
                ...(intentResults.data || []),
                ...(keywordResults.data || []),
                ...(vectorResults.data || [])
            ];

            mergeList.forEach(d => {
                if (!allDocsMap.has(d.id)) {
                    allDocsMap.set(d.id, d);
                }
            });

            uniqueDocs = Array.from(allDocsMap.values());
            uniqueDocs = simpleRerank(uniqueDocs, rawQuery).slice(0, 10);

            // 构建解析意图描述
            if (intentData?.target_entity === 'supplier') optDesc.push(`目标: 供应商`);
            if (intentData?.supplier_name) optDesc.push(`供应商: ${intentData.supplier_name}`);
            if (intentData?.target_categories?.length > 0) optDesc.push(`分类: ${intentData.target_categories.join(',')}`);
            if (intentData?.target_statuses?.length > 0) optDesc.push(`状态: ${intentData.target_statuses.join(',')}`);
            if (intentData?.keywords?.length > 0) optDesc.push(`关键词: ${intentData.keywords.join(',')}`);
        }

        // --- Step 5: 构建 Prompt ---
        // 无论文档是数据库查出来的，还是前端直接传过来的，都统一构建 Prompt
        const contextText = uniqueDocs.map((d, i) => {
            const summary = d.sd_notice?.description || d.sd_notice?.details?.finding || d.title || "无详细描述";
            const rootCause = d.details?.rootCause || "未填写";
            return `[文档${i+1}] 单号:${d.notice_code} | 分类:${d.category} | 状态:${d.status} | 供应商:${d.assigned_supplier_name} \n问题描述:${JSON.stringify(summary).substring(0, 300)}\n根本原因:${JSON.stringify(rootCause).substring(0, 150)}`;
        }).join('\n---\n');

        const systemPrompt = `你是一个专业的供应链质量分析助手。
        1. 当用户询问数量时，开头必须优先引用【系统数据库统计】的数据回答。
        2. 若用户要求“总结问题”，请认真阅读[参考文档]中的描述和根本原因进行归纳。
        3. 引用文档时使用 Reference: [文档x]。
        4. 如果没有找到相关文档，请诚实告知。`;

        const userPrompt = `${statsInfo} \n\n[参考文档]:\n${contextText}\n\n用户问题: ${rawQuery}`;

        // --- Step 6: 生成回答 ---
        const answer = await generateCompletion(model, systemPrompt, userPrompt);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        res.status(200).json({
            answer: answer,
            sources: uniqueDocs, 
            optimizedQuery: optDesc.length > 0 ? `[匹配意图: ${optDesc.join(' | ')}]` : rawQuery,
            thinkingTime: duration
        });

    } catch (error) {
        console.error("[Search API Error]", error);
        res.status(500).json({ error: error.message });
    }
};