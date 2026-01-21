// supplier-platform-backend/controllers/ai/analyze-document.js

// 🚨 【核心修复】 禁用 SSL 证书验证
// 解决 "SELF_SIGNED_CERT_IN_CHAIN" 错误（公司内网/代理环境必须）
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const cors = require('cors');

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

// 通用 System Prompt
const SYSTEM_PROMPT = `
You are a Super Quality Engineer expert. Analyze this 8D Report / NCR document. Extract the information into a pure JSON object.
*** STRICT DATA CLEANING RULES ***
1. **NO TRANSLATION**: Output content in ORIGINAL LANGUAGE.
2. **NO BOILERPLATE**: Exclude footer notes, disclaimers.
3. **Data Formatting**:
    - Return **null** if field not found.
    - **partNumber**: Numeric string.
    - **date**: Format YYYY-MM-DD.

*** EXTRACTION FIELDS ***
- reportNo: Report number / NCR No.
- supplierCode: Supplier code.
- subject: Subject / Description.
- partNumber: Part number (Numbers only).
- partName: Part name.
- quantity: Quantity.
- date: Issue date (YYYY-MM-DD).
- summary: Problem description (D2).
- rootCause: Root cause analysis (D4).
- interimAction: Interim & Potential Corrective Action (D5/D6).
`;

// 辅助：解析 JSON
const parseJSON = (text) => {
    if (!text) throw new Error("API 返回空内容");
    // 去除 markdown 代码块标记
    const jsonStr = text.replace(/```json|```/g, '').trim();
    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("JSON Parse Error. Raw text:", text);
        // 尝试二次修复：有时模型会返回 "Here is the JSON: {...}"
        const match = jsonStr.match(/\{[\s\S]*\}/);
        if (match) {
            try { return JSON.parse(match[0]); } catch (err) {}
        }
        throw new Error("无法解析 AI 返回的 JSON，格式错误");
    }
};

module.exports = async (req, res) => {
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await runMiddleware(req, res, corsMiddleware);

        const { provider, model, inputData, inputType, apiKey } = req.body;

        const validApiKey = apiKey || process.env[`API_KEY_${provider.toUpperCase()}`];

        if (!validApiKey) {
            return res.status(400).json({ error: `Missing API Key for ${provider}` });
        }

        let resultData = {};
        let finalPrompt = SYSTEM_PROMPT;
        
        if (inputType === 'text') {
            finalPrompt += `\n\n[DOCUMENT CONTENT START]\n${inputData}\n[DOCUMENT CONTENT END]\nAnalyze the text above.`;
        }

        // --- 1. 调用 Gemini ---
        if (provider === 'gemini') {
            const parts = [{ text: finalPrompt }];
            if (inputType === 'image') {
                inputData.forEach(img => parts.push({ inline_data: { mime_type: "image/jpeg", data: img } }));
            }

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${validApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                // 处理 503 错误
                if (response.status === 503) {
                    throw new Error("Gemini 服务繁忙 (503)，请稍后重试或切换模型");
                }
                throw new Error(`Gemini API Error (${response.status}): ${errText}`);
            }
            
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            resultData = parseJSON(text);

        // --- 2. 调用 Qwen / OpenAI ---
        } else if (provider === 'qwen' || provider === 'openai') {
            const content = [{ type: "text", text: finalPrompt }];
            
            if (inputType === 'image') {
                inputData.forEach(img => content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${img}` } }));
            }

            const url = provider === 'qwen' 
                ? 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
                : 'https://api.openai.com/v1/chat/completions';

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${validApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: "user", content: content }],
                    max_tokens: 4096,
                    temperature: 0.2,
                    ...(provider === 'openai' ? { response_format: { type: "json_object" } } : {})
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(`${provider} API Error: ${err.error?.message || response.status}`);
            }
            const data = await response.json();
            resultData = parseJSON(data.choices[0].message.content);
        }

        return res.json({ success: true, data: resultData });

    } catch (error) {
        console.error('[Analyze Document] Error:', error);
        // 返回 500 给前端，前端会显示具体错误信息
        res.status(500).json({ error: error.message });
    }
};