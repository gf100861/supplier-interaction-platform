import React, { useState, useEffect, useMemo } from 'react';
import { Checkbox, Card, Tabs, Upload, Button, Form, Input, Select, DatePicker, message, Row, Col, Typography, Divider, Alert, Space, Spin, Collapse, Switch, Table, Progress, Tag } from 'antd'; // 引入 Table, Progress, Tag
import { InboxOutlined, FileExcelOutlined, FilePdfOutlined, UploadOutlined, CloudUploadOutlined, RobotOutlined, ThunderboltOutlined, CaretRightOutlined, ApiOutlined, GoogleOutlined, CheckCircleOutlined, SyncOutlined, CloseCircleOutlined, EyeOutlined } from '@ant-design/icons'; // 引入更多图标
import dayjs from 'dayjs';
import { useNotification } from '../contexts/NotificationContext';
import { useSuppliers } from '../contexts/SupplierContext';
// --- 第三方库 CDN 导入 ---
import Tesseract from 'https://esm.sh/tesseract.js@5.0.3';
import * as pdfjsLibProxy from 'https://esm.sh/pdfjs-dist@3.11.174';
import mammoth from 'https://esm.sh/mammoth@1.6.0';
import { supabase } from '../supabaseClient';
const pdfjsLib = pdfjsLibProxy.default?.GlobalWorkerOptions ? pdfjsLibProxy.default : pdfjsLibProxy;

if (pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
}

const { Title, Paragraph, Text } = Typography;
const { Dragger } = Upload;
const { TextArea } = Input;
const { Option } = Select;
const { Panel } = Collapse;

// 模拟的添加通知单函数
const mockAddNotices = async (notices) => {
    console.log("模拟写入数据库:", notices);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true;
};

// *** 修改点 1: 默认 API Key ***
const DEFAULT_API_KEY = '';


const PROVIDERS = {
    QWEN: { label: '阿里云 Qwen', value: 'qwen', defaultModel: 'qwen-vl-max' },
    GEMINI: { label: 'Google Gemini', value: 'gemini', defaultModel: 'gemini-2.5-flash' },
    OPENAI: { label: 'OpenAI (GPT-4o)', value: 'openai', defaultModel: 'gpt-4o' }
};

const HistoricalImportPage = () => {
    const [loading, setLoading] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [parseProgress, setParseProgress] = useState('');
    const [useAI, setUseAI] = useState(true); // 改名为 useAI

    const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, percent: 0 });
    const [parsedResults, setParsedResults] = useState([]);
    const [activeResultIndex, setActiveResultIndex] = useState(-1);

    const { messageApi } = useNotification();
    const { suppliers } = useSuppliers();

    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

    const managedSuppliers = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === 'Manager') return suppliers;
        if (currentUser.role === 'SD') {
            const managed = currentUser.managed_suppliers || [];
            return managed.map(assignment => assignment.supplier);
        }
        return [];
    }, [currentUser, suppliers]);

    // --- 2. 修改：多厂商状态管理 ---
    const [provider, setProvider] = useState(PROVIDERS.GEMINI.value); // 默认 Gemini
    const [apiKeys, setApiKeys] = useState({
        gemini: '',
        qwen: '',
        openai: ''
    });
    const [currentModel, setCurrentModel] = useState(PROVIDERS.GEMINI.defaultModel);
    const [rememberApiKey, setRememberApiKey] = useState(false);

    const addNotices = mockAddNotices;
    const [form] = Form.useForm();

    // 从本地存储加载 Keys
    useEffect(() => {
        const savedKeys = localStorage.getItem('app_api_keys');
        if (savedKeys) {
            try {
                const parsed = JSON.parse(savedKeys);
                setApiKeys(prev => ({ ...prev, ...parsed }));
                setRememberApiKey(true);
            } catch (e) { }
        }
    }, []);

    const handleApiKeyChange = (val) => {
        const newKeys = { ...apiKeys, [provider]: val };
        setApiKeys(newKeys);
        if (rememberApiKey) {
            localStorage.setItem('app_api_keys', JSON.stringify(newKeys));
        }
    };

    const handleProviderChange = (val) => {
        setProvider(val);
        // 切换厂商时自动切换到该厂商的默认模型
        const providerKey = Object.keys(PROVIDERS).find(k => PROVIDERS[k].value === val);
        if (providerKey) {
            setCurrentModel(PROVIDERS[providerKey].defaultModel);
        }
    };

    const handleRememberChange = (e) => {
        setRememberApiKey(e.target.checked);
        if (e.target.checked) {
            localStorage.setItem('app_api_keys', JSON.stringify(apiKeys));
            messageApi.success('API Key 已保存到本地');
        } else {
            localStorage.removeItem('app_api_keys');
            messageApi.info('不再记住 API Key');
        }
    };
    // 辅助函数：将 File 对象转换为 Base64 字符串
    const fileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file); // 结果将是 "data:application/pdf;base64,..."
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
        });
    };

    const getGeminiEmbedding = async (text) => {
        if (!text || !text.trim()) return null;

        // 清理一下文本，去掉过多的换行，减少Token消耗
        const cleanText = text.replace(/\s+/g, ' ').trim().substring(0, 10000); // 限制长度

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKeys.gemini}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: "models/text-embedding-004",
                        content: { parts: [{ text: cleanText }] }
                    })
                }
            );

            if (!response.ok) throw new Error("Embedding API request failed");

            const result = await response.json();
            // Gemini 返回的结构是 embedding.values
            return result.embedding.values;
        } catch (error) {
            console.error("生成向量失败:", error);
            return null; // 失败了不要卡住流程，存 null 即可
        }
    };
    // --- 核心：统一 AI 调用入口 ---
    const callUnifiedAI = async (inputData, inputType = 'image') => {
        const apiKey = apiKeys[provider];
        if (!apiKey) throw new Error(`请先输入 ${PROVIDERS[Object.keys(PROVIDERS).find(k => PROVIDERS[k].value === provider)].label} 的 API Key`);

        // 通用 Prompt
        const systemPrompt = `
         You are a Super Quality Engineer expert. Analyze this 8D Report / NCR document.Extract the information into a pure JSON object.
  *** STRICT DATA CLEANING RULES ***
  1. **NO TRANSLATION**: You must output the content in its **ORIGINAL LANGUAGE**.
     - If the text is in Chinese, keep it Chinese.
     - If it is mixed Chinese/English, keep it mixed.
     - Do NOT translate Chinese to English under any circumstances.

  2. **NO TEMPLATE/BOILERPLATE TEXT**: Do NOT extract standard footer notes, legal disclaimers, or form instructions.
     - **Explicitly Exclude** phrases like:
       - "Please let me know your investigation and corrective action plan..."
       - "The complete NCR with your action plan should reach us..."
       - "We will decide you agreed our report..."
       - "Cost claim"
       - "Administrative Cost"
       - "Standard citation"
       - "Approval & Closing"

  3. **Data Formatting**:
     - Return **null** or empty string if a field is not found.
     - **partNumber**: Must be a numeric string.
     - **date**: Format YYYY-MM-DD.

  *** EXTRACTION LOGIC ***
  **1. Identity Information:**
  - **partNumber**:
      - Locate "Part number" or "Part No". Pick the numeric string (typically 8 digits for Volvo) found **next to** the label.
      - Verify it is TOTALLY DIFFERENT from the Report No.
  - **reportNo**: The main NCR/MRB number (often starts with 530...).
  - **supplierCode**: The vendor code (usually 5 digits).
  - **partName**: Merge text if split across lines (e.g., "ELECTRICAL EQUIPMENT...").
  - **quantity**: Locate "Quantity". Extract the numeric value next to it(e.g., "1 EA" -> "1").

  **2. Technical Content (D2, D4, D5/D6):**

  - **subject**: The main issue title (D2). Keep original language.
  - **summary**: The problem description. Keep original language.
  - **rootCause**: (D4) Combine all "Root Cause" or "Why" analysis text.
      - **Logic**: Stop extracting when you reach "5. Interim" or "Cost claim".
      - **Keep Original Language**: Do not summarize into English. Copy the raw text/list.
  - **interimAction**: (D5/D6) Combine "Interim Action", "Corrective Action", or "Solution".
   - **Logic**: Stop extracting when you reach "Verification", "Approval", or the "Please let me know..." footer.
      - **Keep Original Language**.



  Fields to extract:
  - reportNo: Report number / NCR No. (Look for "Report No" or the number starting with 530... at the top).
  - supplierCode: Supplier code.
  - subject: Subject / Description / Title of the issue.
  - partNumber: Part number (Numbers only, 8 digits preferred).
  - partName: Part name / Description (Merge split lines).
  - quantity: Quantity.
  - date: Issue date (Format: YYYY-MM-DD).
  - summary: Problem description (D2).
  - rootCause: Root cause analysis (D4). EXTRACT FULL TEXT.
  - interimAction: Interim & Potential Corrective Action (D5/D6).
        `;

        // 如果是文本模式，将文档内容拼接到 Prompt 后面
        let finalPrompt = systemPrompt;
        if (inputType === 'text') {
            finalPrompt += `\n\n[DOCUMENT CONTENT START]\n${inputData}\n[DOCUMENT CONTENT END]\nAnalyze the text above.`;
        }

        if (provider === 'gemini') {
            return await callGeminiAPI(apiKey, currentModel, finalPrompt, inputData, inputType);
        } else if (provider === 'qwen') {
            return await callQwenAPI(apiKey, currentModel, finalPrompt, inputData, inputType);
        } else if (provider === 'openai') {
            return await callOpenAIAPI(apiKey, currentModel, finalPrompt, inputData, inputType);
        }
    };

    // 1. Google Gemini 实现 (修改版)
    const callGeminiAPI = async (key, model, prompt, inputData, inputType) => {
        const parts = [{ text: prompt }];

        if (inputType === 'image') {
            // 图片模式：添加图片数据
            inputData.forEach(img => parts.push({ inline_data: { mime_type: "image/jpeg", data: img } }));
        }
        // 文本模式：inputData 已经是拼接在 prompt 里的文本了，不需要额外处理 part

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
            })
        });

        if (!response.ok) throw new Error(`Gemini API Error: ${response.status}`);
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return parseJSON(text);
    };

    // 2. 阿里云 Qwen 实现 (修改版)
    const callQwenAPI = async (key, model, prompt, inputData, inputType) => {
        const content = [{ type: "text", text: prompt }];

        if (inputType === 'image') {
            inputData.forEach(img => content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${img}` } }));
        }

        const messages = [{ role: "user", content: content }];

        const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(`Qwen API Error: ${err.error?.message || response.status}`);
        }
        const data = await response.json();
        return parseJSON(data.choices[0].message.content);
    };

    // 3. OpenAI 实现 (修改版)
    const callOpenAIAPI = async (key, model, prompt, inputData, inputType) => {
        const content = [{ type: "text", text: prompt }];

        if (inputType === 'image') {
            inputData.forEach(img => content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${img}` } }));
        }

        const messages = [{ role: "user", content: content }];

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                max_tokens: 4096,
                temperature: 0.2,
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) throw new Error(`OpenAI API Error: ${response.status}`);
        const data = await response.json();
        return parseJSON(data.choices[0].message.content);
    };


    const parseJSON = (text) => {
        if (!text) throw new Error("API 返回空内容");
        const jsonStr = text.replace(/```json|```/g, '').trim();
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error("JSON Parse Error:", text);
            throw new Error("无法解析 AI 返回的 JSON");
        }
    };

    // --- 辅助：将 PDF 所有页面转换为 Base64 图片数组 ---
    const convertPdfToImages = async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const totalPages = pdf.numPages;
        const images = [];

        // 限制最大页数以防 Token 超限，通常 8D 报告前 3 页足矣
        const maxPagesToProcess = Math.min(totalPages, 5);

        for (let i = 1; i <= maxPagesToProcess; i++) {
            setParseProgress(`正在处理第 ${i} / ${totalPages} 页...`);
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            images.push(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
        }
        return images;
    };

    // --- 辅助：提取 Docx 文本 ---
    const extractTextFromDocx = async (file) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
            messageApi.success("Word 文件解析成功");
            return result.value; // 纯文本内容
        } catch (error) {
            console.error("Docx parse error:", error);
            messageApi.error("Word 文件解析失败，请确认文件未损坏且为 .docx 格式");
            throw new Error("Word 解析失败，请确认文件未损坏且为 .docx 格式");
        }
    };


    // --- 本地正则提取 (Fallback - 仅做文本提取) ---
    const extractTextLocal = async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        let fullText = '';
        const totalPages = pdf.numPages;

        for (let i = 1; i <= totalPages; i++) {
            setParseProgress(`正在解析第 ${i} / ${totalPages} 页...`);
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            const result = await Tesseract.recognize(canvas, 'chi_sim+eng', {
                logger: m => { if (m.status === 'recognizing text') setParseProgress(`第 ${i} 页识别中: ${Math.floor(m.progress * 100)}%`); }
            });
            fullText += result.data.text + '\n';
        }
        return fullText;
    };

    const parse8DReportTextLocal = (text) => {
        const cleanText = text.replace(/[\r\n]+/g, '\n').trim();
        const extractField = (keywords, maxLength = 100) => {
            const pattern = new RegExp(`(${keywords.join('|')})[:\\s]*([^\\n]+)`, 'i');
            const match = cleanText.match(pattern);
            return (match && match[2]) ? match[2].trim().replace(/^[:：\.]/, '').substring(0, maxLength) : null;
        };
        const extractBlock = (startKeywords, endKeywords) => {
            let startIndex = -1;
            for (const kw of startKeywords) {
                const idx = cleanText.search(new RegExp(kw, 'i'));
                if (idx !== -1) { startIndex = idx; break; }
            }
            if (startIndex === -1) return "";
            const textFromStart = cleanText.substring(startIndex);
            let endIndex = textFromStart.length;
            let minIndex = textFromStart.length;
            for (const kw of endKeywords) {
                const idx = textFromStart.search(new RegExp(kw, 'i'));
                if (idx > 20 && idx < minIndex) { minIndex = idx; }
            }
            endIndex = minIndex;
            let content = textFromStart.substring(0, endIndex);
            content = content.replace(/^.+?\n/, '').trim();
            return content;
        };
        const reportNo = extractField(['Report No', 'NCR No', '8D No', 'No.'], 30);
        const supplierCode = extractField(['Supplier Code', 'Vendor Code', 'Supplier No', 'Vendor ID', 'Parma No', 'Parma'], 20);
        const partNo = extractField(['Part number', 'Part No', 'P/N', 'Material No', 'Material number'], 30);
        const partName = extractField(['Part name', 'Description', 'Part Description'], 50);
        const quantity = extractField(['Quantity', 'Qty', 'Amount'], 20);
        const dateRegex = /(\d{4}[-./年]\d{1,2}[-./月]\d{1,2})|(\d{1,2}[-./]\d{1,2}[-./]\d{4})/;
        const dateMatch = cleanText.match(dateRegex);
        let date = dayjs();
        if (dateMatch) {
            const dateStr = dateMatch[0].replace(/[年月.]/g, '-').replace('日', '');
            date = dayjs(dateStr).isValid() ? dayjs(dateStr) : dayjs();
        }
        const summary = extractBlock(['Problem description', 'Phenomenon', 'Subject', 'Defect', '2. Problem'], ['3. Containment', '4. Root Cause', 'Root Cause']);
        const rootCause = extractBlock(['4. Root Cause Analysis', 'Root Cause', 'Analysis', 'Why'], ['5. Interim', 'Potential Corrective', 'Corrective Action']);
        const interimAction = extractBlock(['5. Interim', 'Potential Corrective Action', 'Interim Action', 'Corrective Action'], ['6. Verification', 'Verification', 'Prevent Recurrence']);
        let title = "NCR Report";
        if (partNo || summary) {
            const safeSummary = (summary || "未识别问题").substring(0, 30).replace(/[\r\n]/g, ' ');
            title = `${partNo ? `[${partNo}] ` : ''}${partName ? `${partName} - ` : ''}${safeSummary}...`;
        }
        return { reportNo, supplierCode, partNo, partName, quantity, title, summary: summary || "未识别到详细描述", rootCause: rootCause || "未识别到根本原因", interimAction: interimAction || "未识别到解决措施", date };
    };

    // --- 修改后：批量解析逻辑 ---
    const handleSmartParseBatch = async () => {
        const fileList = form.getFieldValue('file');
        if (!fileList || fileList.length === 0) {
            messageApi.warning("请先选择至少一个 PDF 文件！");
            return;
        }

        setParsing(true);
        setParsedResults([]);
        setActiveResultIndex(-1);
        setBatchProgress({ current: 0, total: fileList.length, percent: 0 });

        const results = [];

        for (let i = 0; i < fileList.length; i++) {
            const fileItem = fileList[i];
            const file = fileItem.originFileObj;

            // 简单的文件类型判断
            const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
            const isWord = file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc');

            setBatchProgress({ current: i + 1, total: fileList.length, percent: Math.round(((i) / fileList.length) * 100) });
            setParseProgress(`正在处理 (${i + 1}/${fileList.length}): ${file.name}...`);

            try {
                let data = {};

                if (useAI) {
                    if (!apiKeys[provider]) {

                        messageApi.error(`缺少 ${PROVIDERS[provider.toUpperCase()].label} API Key`);
                        throw new Error(`缺少 ${PROVIDERS[provider.toUpperCase()].label} API Key`);

                    }

                    let aiResult;

                    if (isPdf) {
                        // PDF 流程：转图片 -> 视觉模型
                        setParseProgress(`正在渲染 PDF 页面...`);
                        const base64Images = await convertPdfToImages(file);
                        setParseProgress(`正在请求 ${currentModel} (视觉分析)...`);
                        aiResult = await callUnifiedAI(base64Images, 'image');
                    } else if (isWord) {
                        // Word 流程：提文本 -> 文本模型
                        if (file.name.toLowerCase().endsWith('.doc')) {
                            messageApi.error("暂不支持旧版 .doc 格式，请另存为 .docx 后上传");
                            throw new Error("暂不支持旧版 .doc 格式，请另存为 .docx 后上传");
                        }
                        setParseProgress(`正在提取文档文本...`);
                        const textContent = await extractTextFromDocx(file);
                        if (!textContent || textContent.length < 10) {
                            messageApi.error("文档内容为空或无法识别");
                            throw new Error("文档内容为空或无法识别");
                        }
                        setParseProgress(`正在请求 ${currentModel} (文本分析)...`);
                        aiResult = await callUnifiedAI(textContent, 'text');
                    } else {
                        messageApi.error("不支持的文件格式，仅支持 PDF 和 DOCX");
                        throw new Error("不支持的文件格式");
                    }

                    // const base64Images = await convertPdfToImages(file);
                    // setParseProgress(`正在请求 ${currentModel} 分析...`);

                    // *** 切换为通用调用函数 ***
                    // const result = await callUnifiedAI(base64Images);

                    data = {
                        ...aiResult,
                        date: aiResult.date ? dayjs(aiResult.date) : dayjs(),
                        title: aiResult.subject ? aiResult.subject : `${aiResult.partNo || ''} - ${aiResult.partName || ''}`
                    };
                } else {
                    // 本地 OCR
                    if (isPdf) {
                        setParseProgress(`正在 OCR 识别...`);
                        const rawText = await extractTextLocal(file);
                        data = parse8DReportTextLocal(rawText);
                    } else if (isWord && file.name.toLowerCase().endsWith('.docx')) {
                        // 如果不使用 AI，Word 直接提取文本后用正则解析
                        setParseProgress(`正在提取文本...`);
                        const rawText = await extractTextFromDocx(file);
                        data = parse8DReportTextLocal(rawText);
                    }
                }

                // 自动匹配供应商 (保持不变)
                let matchedSupplierId = undefined;
                if (data.supplierCode && suppliers) {
                    const targetCode = data.supplierCode.toString().trim().toUpperCase();
                    const found = suppliers.find(s => (s.short_code && s.short_code.toUpperCase() === targetCode) || (s.parma_id && s.parma_id.toString() === targetCode));
                    if (found) matchedSupplierId = found.id;
                }

                results.push({
                    key: i,
                    fileName: file.name,
                    fileObj: file,
                    data: { ...data, supplierId: matchedSupplierId },
                    status: 'success',
                    isArchived: false
                });

            } catch (error) {
                console.error(`File ${file.name} failed:`, error);
                results.push({
                    key: i,
                    fileName: file.name,
                    fileObj: file,
                    data: null,
                    status: 'error',
                    errorMsg: error.message
                });
            }
        }

        setBatchProgress({ current: fileList.length, total: fileList.length, percent: 100 });
        setParsedResults(results);
        setParsing(false);
        setParseProgress('');

        // 自动加载第一个成功项
        const firstSuccess = results.findIndex(r => r.status === 'success');
        if (firstSuccess !== -1) loadResultToForm(results[firstSuccess], firstSuccess);
    };


    // 将选中的解析结果填入表单以便编辑
    const loadResultToForm = (resultItem, index) => {
        setActiveResultIndex(index);
        if (resultItem.status === 'success' && resultItem.data) {
            form.setFieldsValue({
                title: resultItem.data.title,
                partNumber: resultItem.data.partNumber,
                partName: resultItem.data.partName, // 新增：回填零件名称
                reportNo: resultItem.data.reportNo,
                summary: resultItem.data.summary,
                rootCause: resultItem.data.rootCause,
                interimAction: resultItem.data.interimAction,
                date: resultItem.data.date,
                supplierId: resultItem.data.supplierId
            });
        } else {
            form.resetFields();
        }
    };

    // 归档单个（当前表单内容 + 关联的原始文件数据）
    const handleSingleFileArchive = async (values) => {
        setLoading(true);
        try {
            // 1. 获取文件对象
            let file;
            if (activeResultIndex !== -1 && parsedResults[activeResultIndex]) {
                file = parsedResults[activeResultIndex].fileObj;
            } else if (values.file && values.file[0]) {
                file = values.file[0].originFileObj;
            }

            if (!file) {
                throw new Error("未找到文件对象");
            }

            // *** 核心修改：转为 Base64 字符串，不上传 Storage ***
            // 注意：这步对于大文件会比较耗时
            const base64File = await fileToBase64(file);

            // 3. 构建 AI 检索用的上下文摘要
            const aiContext = `
 [Part Number]: ${values.partNumber || 'N/A'}
 [Part Name]: ${values.partName || 'N/A'}
 [Quantity]: ${values.quantity || 'N/A'}
 [Problem]: ${values.summary}
 [Root Cause]: ${values.rootCause}
 [Interim/Permanent Action]: ${values.interimAction}
            `.trim();

            // 1. 准备要向量化的文本 (语义指纹)
            // 组合：零件名 + 标题 + 问题描述 + 根本原因
            const supplierName = suppliers.find(s => s.id === values.supplierId)?.name || '';

            const textToEmbed = `
    [Category]: Historical 8D // <-- 新增：明确这是历史数据
    [Supplier]: ${supplierName} // <-- 新增：加上供应商名
    [Part]: ${values.partName || ''}
    [Title]: ${values.title}
    [Issue]: ${values.summary}
    [Cause]: ${values.rootCause}
`.trim();

            // 2. 调用 API 生成向量 (新增步骤)
            messageApi.loading({ content: '正在生成 AI 语义向量...', key: 'embed' });
            const embeddingVector = await getGeminiEmbedding(textToEmbed);
            messageApi.success({ content: '向量生成完毕', key: 'embed' });

            // 4. 构建插入数据库的数据
            const newNotice = {
                title: values.title,
                notice_code: values.reportNo || `HIST-${dayjs().format('YYYYMMDD')}-${Math.floor(Math.random() * 1000)}`,
                assigned_supplier_id: values.supplierId,
                assigned_supplier_name: suppliers.find(s => s.id === values.supplierId)?.name || 'Unknown Supplier',
                status: '已完成',
                category: 'Historical 8D',
                creator_id: currentUser.id,
                created_at: values.date ? values.date.toISOString() : new Date().toISOString(),
                embedding: embeddingVector,

                sd_notice: {
                    creatorId: currentUser.id,
                    creator: currentUser.username,
                    description: aiContext,
                    createTime: values.date ? values.date.format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss'),
                    details: {
                        part_number: values.partNumber,
                        part_name: values.partName,
                        quantity: values.quantity,
                        finding: values.summary,
                        root_cause: values.rootCause,
                        action_plan: values.interimAction,

                        // *** 核心修改：这里不再存路径，而是存 Base64 数据 ***
                        // 标记为 inline_base64 以便前端展示时识别
                        file_storage_type: 'inline_base64',
                        file_content: base64File,
                        original_file_name: file.name
                    },
                    images: [],
                    attachments: []
                },
                history: [
                    {
                        type: 'system_import',
                        submitter: currentUser.username,
                        time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                        description: '通过历史归档模块导入',
                    }
                ]
            };

            const { error: insertError } = await supabase.from('notices').insert([newNotice]);
            if (insertError) throw insertError;

            messageApi.success("归档成功！文件已存入数据库。");

            if (activeResultIndex !== -1) {
                setParsedResults(prev => prev.map((item, idx) =>
                    idx === activeResultIndex ? { ...item, isArchived: true } : item
                ));
            } else {
                form.resetFields();
            }

        } catch (error) {
            console.error(error);
            messageApi.error("归档失败: " + error.message);
        } finally {
            setLoading(false);
        }
    };
    // 批量归档所有成功且未归档的项目
    // 批量归档所有成功且未归档的项目
    const handleBatchArchiveAll = async () => {
        const itemsToArchive = parsedResults.filter(item => item.status === 'success' && !item.isArchived);
        if (itemsToArchive.length === 0) {
            messageApi.info("没有需要归档的项目");
            return;
        }

        setLoading(true);
        let successCount = 0;
        let failCount = 0;

        for (const item of itemsToArchive) {
            try {
                const values = item.data;
                const file = item.fileObj;

                // *** 核心修改：转为 Base64 ***
                const base64File = await fileToBase64(file);

                const aiContext = `
   [Part Number]: ${values.partNumber || 'N/A'}
   [Part Name]: ${values.partName || 'N/A'}
   [Problem]: ${values.summary}
   [Root Cause]: ${values.rootCause}
   [Interim/Permanent Action]: ${values.interimAction}
                `.trim();

                const newNotice = {
                    title: values.title,
                    notice_code: values.reportNo || `HIST-${dayjs().format('YYYYMMDD')}-${Math.floor(Math.random() * 1000)}`,
                    assigned_supplier_id: values.supplierId,
                    assigned_supplier_name: suppliers.find(s => s.id === values.supplierId)?.name || 'Unknown',
                    status: '已完成',
                    category: 'Historical 8D',
                    creator_id: currentUser.id,
                    created_at: values.date ? dayjs(values.date).toISOString() : new Date().toISOString(),
                    sd_notice: {
                        creatorId: currentUser.id,
                        creator: currentUser.username,
                        description: aiContext,
                        createTime: values.date ? dayjs(values.date).format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss'),
                        details: {
                            part_number: values.partNumber,
                            part_name: values.partName,
                            finding: values.summary,
                            root_cause: values.rootCause,
                            action_plan: values.interimAction,

                            // *** 存入 Base64 ***
                            file_storage_type: 'inline_base64',
                            file_content: base64File,
                            original_file_name: file.name
                        },
                        images: [],
                        attachments: []
                    },
                    history: [{ type: 'system_import', submitter: currentUser.username, time: dayjs().format('YYYY-MM-DD HH:mm:ss'), description: '通过历史归档模块批量导入' }]
                };

                const { error: insertError } = await supabase.from('notices').insert([newNotice]);
                if (insertError) throw insertError;

                successCount++;
                setParsedResults(prev => prev.map(p => p.key === item.key ? { ...p, isArchived: true } : p));

            } catch (err) {
                failCount++;
                console.error(`Batch archive failed for ${item.fileName}`, err);
                messageApi.error(`文件 ${item.fileName} 归档失败: ${err.message}`);
            }
        }

        setLoading(false);
        messageApi.success(`批量处理完成。成功: ${successCount}, 失败: ${failCount}`);
    };


    const columns = [
        {
            title: '文件名',
            dataIndex: 'fileName',
            key: 'fileName',
            render: (text, record) => <Text delete={record.isArchived}>{text}</Text>
        },
        {
            title: '识别标题',
            key: 'title',
            render: (_, record) => record.data?.title || <Text type="secondary">N/A</Text>
        },
        {
            title: '状态',
            key: 'status',
            render: (_, record) => {
                if (record.isArchived) return <Tag color="green">已归档</Tag>;
                if (record.status === 'error') return <Tag color="red">解析失败</Tag>;
                return <Tag color="blue">待确认</Tag>;
            }
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record, index) => (
                <Button
                    type="link"
                    size="small"
                    onClick={() => loadResultToForm(record, index)}
                    disabled={record.status === 'error'}
                >
                    {activeResultIndex === index ? '编辑中...' : '查看/编辑'}
                </Button>
            )
        }
    ];

    return (
        <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
            <Title level={2}>📚 历史经验导入中心</Title>
            <Paragraph type="secondary">
                将历史 8D 报告、Excel 跟踪表导入系统，构建企业质量知识库。
            </Paragraph>

            <Tabs defaultActiveKey="file" type="card" size="large">
                <Tabs.TabPane tab={<span><FilePdfOutlined /> PDF 文档归档 (OCR/AI)</span>} key="file">
                    <Row gutter={24}>
                        <Col span={14}>
                            <Card title="PDF 批量智能解析" style={{ marginBottom: 24 }}>
                                <Form form={form} layout="vertical" onFinish={handleSingleFileArchive}>
                                    <Form.Item label="文件上传" style={{ marginBottom: 12 }}>
                                        <Form.Item name="file" valuePropName="fileList" getValueFromEvent={(e) => Array.isArray(e) ? e : e && e.fileList} noStyle>
                                            <Upload
                                                multiple
                                                beforeUpload={() => false}
                                                accept=".pdf,.docx,.doc" // 修改这里
                                            >
                                                <Button icon={<UploadOutlined />} block>选择文件 (PDF/Word)</Button>
                                            </Upload>
                                        </Form.Item>
                                    </Form.Item>

                                    <div style={{ background: '#f0f2f5', padding: 12, borderRadius: 6, marginBottom: 16 }}>
                                        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
                                            <span><ApiOutlined /> 解析引擎:</span>
                                            <Switch
                                                checkedChildren="AI 增强模式"
                                                unCheckedChildren="本地 OCR"
                                                checked={useAI}
                                                onChange={setUseAI}
                                            />
                                        </Space>
                                        {useAI && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                {/* 1. 选择提供商 */}
                                                <Form.Item label="模型提供商" style={{ marginBottom: 0 }}>
                                                    <Select value={provider} onChange={handleProviderChange}>
                                                        {Object.values(PROVIDERS).map(p => (
                                                            <Option key={p.value} value={p.value}>
                                                                <Space>{p.icon} {p.label}</Space>
                                                            </Option>
                                                        ))}
                                                    </Select>
                                                </Form.Item>

                                                {/* 2. 输入 Key */}
                                                <Input.Password
                                                    placeholder={`请输入 ${PROVIDERS[provider.toUpperCase()]?.label} API Key`}
                                                    value={apiKeys[provider]}
                                                    onChange={e => handleApiKeyChange(e.target.value)}
                                                />

                                                {/* 3. 选择模型 */}
                                                <Form.Item label="选择模型" style={{ marginBottom: 0 }}>
                                                    <Select value={currentModel} onChange={setCurrentModel}>
                                                        {provider === 'gemini' && (
                                                            <>
                                                                <Option value="gemini-2.5-flash">Gemini 2.5 Flash</Option>
                                                                <Option value="gemini-2.5-pro">Gemini 2.5 Pro</Option>
                                                            </>
                                                        )}
                                                        {provider === 'qwen' && (
                                                            <>
                                                                <Option value="qwen-vl-max">Qwen-VL-Max (通义千问-视觉增强)</Option>
                                                                <Option value="qwen-vl-plus">Qwen-VL-Plus</Option>
                                                                <Option value="qwen3-vl-plus">Qwen3-vl-plus</Option>
                                                            </>
                                                        )}
                                                        {provider === 'openai' && (
                                                            <>
                                                                <Option value="gpt-4o">GPT-4o (Omni)</Option>
                                                                <Option value="gpt-4-turbo">GPT-4 Turbo</Option>
                                                            </>
                                                        )}
                                                    </Select>
                                                </Form.Item>

                                                <Checkbox checked={rememberApiKey} onChange={handleRememberChange}>
                                                    记住 API Key (本地存储)
                                                </Checkbox>
                                            </div>
                                        )}
                                    </div>

                                    <Button
                                        type="primary"
                                        icon={<ThunderboltOutlined />}
                                        onClick={handleSmartParseBatch}
                                        loading={parsing}
                                        block
                                    >
                                        开始批量解析
                                    </Button>

                                    {parsing && (
                                        <div style={{ marginTop: 16 }}>
                                            <Progress percent={batchProgress.percent} status="active" />
                                            <div style={{ textAlign: 'center', fontSize: 12, color: '#666' }}>{parseProgress}</div>
                                        </div>
                                    )}
                                </Form>
                            </Card>

                            {/* 结果编辑区 */}
                            {activeResultIndex !== -1 && (
                                <Card title="核对与归档 (当前选中文件)" style={{ borderColor: '#1890ff' }}>
                                    <Alert message={`正在编辑: ${parsedResults[activeResultIndex]?.fileName}`} type="info" showIcon style={{ marginBottom: 16 }} />
                                    <Form form={form} layout="vertical" onFinish={handleSingleFileArchive}>
                                        <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
                                        <Row gutter={16}>
                                            <Col span={12}><Form.Item name="reportNo" label="编号"><Input /></Form.Item></Col>
                                            <Col span={12}>
                                                <Form.Item name="supplierId" label="供应商" rules={[{ required: true }]}>
                                                    <Select placeholder="选择供应商" options={managedSuppliers.map(s => ({ value: s.id, label: s.name }))} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item name="date" label="发生日期" rules={[{ required: true }]}>
                                                    <DatePicker style={{ width: '100%' }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}><Form.Item name="quantity" label="数量 (Quantity)"><Input /></Form.Item></Col>
                                        </Row>
                                        {/* 新增的 Part 字段 */}
                                        <Row gutter={16}>
                                            <Col span={12}><Form.Item name="partNumber" label="零件号 (Part Number)"><Input /></Form.Item></Col>
                                            <Col span={12}><Form.Item name="partName" label="零件名称 (Part Name)"><Input /></Form.Item></Col>
                                        </Row>
                                        <Form.Item name="summary" label="问题摘要"><TextArea rows={3} /></Form.Item>
                                        <Form.Item name="rootCause" label="根本原因"><TextArea rows={3} /></Form.Item>
                                        <Form.Item name="interimAction" label="解决措施"><TextArea rows={3} /></Form.Item>
                                        <Button type="primary" htmlType="submit" loading={loading} icon={<CloudUploadOutlined />} block>
                                            确认并归档此条
                                        </Button>
                                    </Form>
                                </Card>
                            )}
                        </Col>

                        <Col span={10}>
                            {/* 解析结果列表 */}
                            <Card title="解析结果队列" extra={<Button size="small" onClick={handleBatchArchiveAll} disabled={parsedResults.filter(r => r.status === 'success' && !r.isArchived).length === 0}>一键归档剩余</Button>}>
                                <Table
                                    dataSource={parsedResults}
                                    columns={columns}
                                    size="small"
                                    pagination={false}
                                    scroll={{ y: 600 }}
                                    rowClassName={(record, index) => index === activeResultIndex ? 'ant-table-row-selected' : ''}
                                />
                            </Card>
                        </Col>
                    </Row>
                </Tabs.TabPane>
            </Tabs>
        </div>
    );
};

export default HistoricalImportPage;