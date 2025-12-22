import React, { useState, useEffect, useMemo } from 'react';
import { Card, Tabs, Upload, Button, Form, Input, Select, DatePicker, message, Row, Col, Typography, Divider, Alert, Space, Spin, Collapse, Switch, Table, Progress, Tag } from 'antd'; // 引入 Table, Progress, Tag
import { InboxOutlined, FileExcelOutlined, FilePdfOutlined, UploadOutlined, CloudUploadOutlined, RobotOutlined, ThunderboltOutlined, CaretRightOutlined, ApiOutlined, GoogleOutlined, CheckCircleOutlined, SyncOutlined, CloseCircleOutlined, EyeOutlined } from '@ant-design/icons'; // 引入更多图标
import dayjs from 'dayjs';
import { useNotification } from '../contexts/NotificationContext';
import { useSuppliers } from '../contexts/SupplierContext';
// --- 第三方库 CDN 导入 ---
import * as ExcelJS from 'https://esm.sh/exceljs@4.4.0';
import Tesseract from 'https://esm.sh/tesseract.js@5.0.3';
import * as pdfjsLibProxy from 'https://esm.sh/pdfjs-dist@3.11.174';

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

const mockSupabase = {
    storage: {
        from: (bucket) => ({
            upload: async (path, file) => {
                console.log(`模拟上传文件 ${file.name} 到 ${bucket}/${path}`);
                await new Promise(resolve => setTimeout(resolve, 500));
                return { data: { path }, error: null };
            },
            getPublicUrl: (path) => ({
                data: { publicUrl: `https://mock-storage.com/${path}` }
            })
        })
    }
};

// *** 修改点 1: 默认 API Key ***
const DEFAULT_API_KEY = '';

const HistoricalImportPage = () => {
    // --- 状态管理 ---
    const [loading, setLoading] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [parseProgress, setParseProgress] = useState('');
    const [useGemini, setUseGemini] = useState(true);
    
    // 新增：批量解析相关状态
    const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, percent: 0 });
    const [parsedResults, setParsedResults] = useState([]); // 存储批量解析的结果
    const [activeResultIndex, setActiveResultIndex] = useState(-1); // 当前正在编辑/查看的结果索引

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

    // *** 修改点 2: API Key ***
    const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);

    // *** 修改点 3: 模型选择 ***
    const [geminiModel, setGeminiModel] = useState('gemini-2.5-pro');

    const addNotices = mockAddNotices;
    const [form] = Form.useForm();

    // --- Google Gemini API 调用核心逻辑 (支持多页 + 图片深度解析) ---
    const callGeminiVisionAPI = async (base64Images) => {
        if (!apiKey) {
            throw new Error("API Key 为空！请在设置栏输入 Google API Key。");
        }

        const prompt = `
        You are a Super Quality Engineer expert. Analyze this 8D Report / NCR document (which may contain multiple pages).
        Extract the information into a pure JSON object. 
        
        Strict Rules:
        1. Output ONLY JSON. No Markdown block quotes.
        2. If a field is not found, return null or empty string.
        3. Do not omit any information.
        4. **CRITICAL**: Read ALL pages provided. The Root Cause (D4) and Interim/Corrective Actions (D5/D6) might be on the 2nd or 3rd page.
        5. **Root Cause Analysis**: Combine content from all pages. Look for "4.", "D4", "Root Cause", "Why". Flatten any 5-Why structure into a readable string.
        6. **Interim/Corrective Action**: Combine content from all pages. Look for "5.", "D5", "6.", "D6", "Action", "Measures".
        7. **Embedded Images Analysis (EXPERIMENTAL)**:
           - If there are photos or screenshots embedded in the "Problem Description" or "Root Cause" sections, please analyze them.
           - Briefly describe what the defect looks like in the image (e.g., "Image shows a crack on the weld seam" or "Photo indicates rust on the surface").
           - Append this visual description to the corresponding text field (summary or rootCause) in brackets, like: "[Visual Analysis: ...]".
        
        Fields to extract:
        - reportNo: Report number / NCR No.
        - supplierCode: Supplier code.
        - subject: Subject / Description / Title of the issue. Use the main title or problem statement found in the header or D2 section.
        - partNumber: Part number / Part No. Look for "Part number", "P/N".
        - partName: Part name / Description.
        - quantity: Defect quantity.
        - date: Issue date (Format: YYYY-MM-DD).
        - summary: Problem description (D2). Include visual analysis of any embedded photos here.
        - rootCause: Root cause analysis (D4). EXTRACT FULL TEXT. Include visual analysis of any evidence photos here.
        - interimAction: Interim & Potential Corrective Action (D5/D6). EXTRACT FULL TEXT.
        `;

        // *** 核心修改：构建包含多张图片的 Payload ***
        const parts = [{ text: prompt }];
        
        // 确保输入是数组
        const images = Array.isArray(base64Images) ? base64Images : [base64Images];
        
        images.forEach(imgData => {
            parts.push({
                inline_data: {
                    mime_type: "image/jpeg",
                    data: imgData
                }
            });
        });

        const payload = {
            contents: [{ parts: parts }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 8192, // 增加 Token 限制以容纳更多内容
            }
        };

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || `API 请求失败: ${response.status}`);
            }

            const data = await response.json();
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!textResponse) throw new Error("API 返回了空内容");

            const jsonStr = textResponse.replace(/```json|```/g, '').trim();

            try {
                return JSON.parse(jsonStr);
            } catch (e) {
                console.error("JSON Parse Error. Raw Text:", textResponse);
                throw new Error("AI 返回的数据格式无法解析为 JSON，请重试。");
            }

        } catch (error) {
            console.error("Gemini API Error:", error);
            throw error;
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

    // --- 核心功能 1: Excel 批量导入 ---
    const handleExcelBatchImport = async (file) => {
        setLoading(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const buffer = e.target.result;
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(buffer);
                const worksheet = workbook.getWorksheet(1);
                const noticesToInsert = [];
                let successCount = 0;
                worksheet.eachRow((row, rowNumber) => {
                    if (rowNumber <= 1) return;
                    const supplierCode = row.getCell(1).value?.toString();
                    const dateVal = row.getCell(2).value;
                    const problemDesc = row.getCell(3).value?.toString();
                    const rootCause = row.getCell(4).value?.toString();
                    const action = row.getCell(5).value?.toString();
                    const reportNo = row.getCell(6).value?.toString();

                    if (supplierCode && problemDesc) {
                        const supplier = suppliers.find(s => s.short_code === supplierCode);
                        const aiTrainingText = `[Problem]: ${problemDesc}\n[Root Cause]: ${rootCause}\n[Action]: ${action}`;
                        noticesToInsert.push({
                            title: problemDesc.substring(0, 50) + (problemDesc.length > 50 ? '...' : ''),
                            description: aiTrainingText,
                            notice_code: reportNo || `HIST-${Date.now()}-${rowNumber}`,
                            assigned_supplier_id: supplier?.id || null,
                            assigned_supplier_name: supplier?.name || 'Unknown History Supplier',
                            status: '已完成',
                            category: 'Historical 8D',
                            created_at: dateVal ? dayjs(dateVal).toISOString() : new Date().toISOString(),
                            details: { finding: problemDesc, root_cause: rootCause, action_plan: action }
                        });
                        successCount++;
                    }
                });
                if (noticesToInsert.length > 0) {
                    await addNotices(noticesToInsert);
                    messageApi.success(`成功模拟导入 ${successCount} 条数据！`);
                } else {
                    messageApi.warning("未解析到有效数据。");
                }
            } catch (error) {
                console.error(error);
                messageApi.error("Excel 解析失败: " + error.message);
            } finally {
                setLoading(false);
            }
        };
        reader.readAsArrayBuffer(file);
        return false;
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
        
        // 检查所有文件类型
        const invalidFiles = fileList.filter(f => f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf'));
        if (invalidFiles.length > 0) {
            messageApi.error("包含不支持的文件类型，仅支持 PDF。");
            return;
        }

        setParsing(true);
        setParsedResults([]); // 清空旧结果
        setActiveResultIndex(-1);
        setBatchProgress({ current: 0, total: fileList.length, percent: 0 });

        const results = [];

        for (let i = 0; i < fileList.length; i++) {
            const fileItem = fileList[i];
            const file = fileItem.originFileObj;
            
            // 更新进度
            setBatchProgress({ current: i + 1, total: fileList.length, percent: Math.round(((i) / fileList.length) * 100) });
            setParseProgress(`正在处理 (${i + 1}/${fileList.length}): ${file.name}...`);

            try {
                let data = {};
                let status = 'success';
                let errorMsg = null;

                if (useGemini) {
                    if (!apiKey) throw new Error("缺少 Google API Key");
                    
                    const base64Images = await convertPdfToImages(file);
                    setParseProgress(`正在 AI 分析 (${i + 1}/${fileList.length})...`);
                    const result = await callGeminiVisionAPI(base64Images);
                    
                    data = {
                        ...result,
                        date: result.date ? dayjs(result.date) : dayjs(),
                        title: result.subject ? result.subject : `${result.partNumber ? `[${result.partNumber}] ` : ''}${result.partName ? `${result.partName} - ` : ''}${result.summary ? result.summary.substring(0, 20) : 'Gemini Analysis'}...`
                    };
                } else {
                    setParseProgress(`正在 OCR 识别 (${i + 1}/${fileList.length})...`);
                    const rawText = await extractTextLocal(file);
                    data = parse8DReportTextLocal(rawText);
                }

                // 自动匹配供应商
                let matchedSupplierId = undefined;
                if (data.supplierCode && suppliers) {
                    const targetCode = data.supplierCode.toString().trim().toUpperCase();
                    const found = suppliers.find(s => 
                        (s.short_code && s.short_code.toUpperCase() === targetCode) || 
                        (s.parma_id && s.parma_id.toString() === targetCode)
                    );
                    if (found) matchedSupplierId = found.id;
                }

                // 存入结果对象
                results.push({
                    key: i,
                    fileName: file.name,
                    fileObj: file,
                    data: { ...data, supplierId: matchedSupplierId },
                    status: 'success',
                    isArchived: false // 是否已归档
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
        messageApi.success(`批量解析完成！成功: ${results.filter(r => r.status === 'success').length}, 失败: ${results.filter(r => r.status === 'error').length}`);
        
        // 如果有成功的结果，自动加载第一个到表单预览
        const firstSuccess = results.findIndex(r => r.status === 'success');
        if (firstSuccess !== -1) {
            loadResultToForm(results[firstSuccess], firstSuccess);
        }
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

    // 归档单个（当前表单内容 + 关联的原始文件）
    const handleSingleFileArchive = async (values) => {
        // 如果是批量列表过来的，需要校验
        if (activeResultIndex !== -1 && !parsedResults[activeResultIndex]) {
             // 这种情况理论上不应发生，但也做个防御
        }

        setLoading(true);
        try {
            // 1. 获取文件对象 (如果是批量模式，从 parsedResults 取；如果是单文件模式，从 values.file 取)
            let file;
            let fileName;
            
            if (activeResultIndex !== -1 && parsedResults[activeResultIndex]) {
                 file = parsedResults[activeResultIndex].fileObj;
            } else if (values.file && values.file[0]) {
                 file = values.file[0].originFileObj;
            } else {
                 throw new Error("未找到文件对象");
            }

            // 2. 上传原始 PDF 到 Supabase Storage (归档留底)
            fileName = `history/${Date.now()}_${file.name}`;
            await mockSupabase.storage.from('public-assets').upload(fileName, file);

            // 3. 构建 AI 检索用的上下文摘要 (Description)
            // 这部分文本将被用于向量化搜索，所以要尽可能包含关键信息
            const aiContext = `
[Part Number]: ${values.partNumber || 'N/A'}
[Part Name]: ${values.partName || 'N/A'}
[Quantity]: ${values.quantity || 'N/A'}
[Problem]: ${values.summary}
[Root Cause]: ${values.rootCause}
[Interim/Permanent Action]: ${values.interimAction}
            `.trim();

            // 4. 构建插入 notices 表的数据对象
            // 我们复用现有的 notices 表，但打上 "Historical 8D" 的标签
            const newNotice = {
                title: values.title,
                description: aiContext, // 用于列表展示和简单搜索
                notice_code: values.reportNo || `HIST-${dayjs().format('YYYYMMDD')}-${Math.floor(Math.random() * 1000)}`,
                assigned_supplier_id: values.supplierId,
                assigned_supplier_name: suppliers.find(s => s.id === values.supplierId)?.name || 'Unknown Supplier',
                status: '已完成', // 历史数据直接标记为已完成
                category: 'Historical 8D', // 特殊分类
                created_at: values.date ? values.date.toISOString() : new Date().toISOString(), // 保持历史时间真实性
                
                // 关键：将所有详细的结构化数据存入 sd_notice (JSONB)
                // 这样前端展示详情时，可以从这里取出 D4/D5 等具体字段
                sd_notice: {
                    details: {
                        part_number: values.partNumber,
                        part_name: values.partName, // 确保写入
                        quantity: values.quantity,
                        finding: values.summary, // D2
                        root_cause: values.rootCause, // D4
                        action_plan: values.interimAction, // D5/D6
                        report_file_path: fileName // 关联原始 PDF
                    },
                    images: [], // 历史导入通常没有单独分离出的图片附件，除非我们做更复杂的切图
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
            
            await addNotices([newNotice]);
            messageApi.success("归档成功！");
            
            // 如果是批量模式，更新列表状态
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
    const handleBatchArchiveAll = async () => {
        const itemsToArchive = parsedResults.filter(item => item.status === 'success' && !item.isArchived);
        if (itemsToArchive.length === 0) {
            messageApi.info("没有需要归档的项目");
            return;
        }

        setLoading(true);
        let successCount = 0;
        
        for (const item of itemsToArchive) {
            try {
                const values = item.data;
                const file = item.fileObj;
                const fileName = `history/${Date.now()}_${file.name}`;
                
                await mockSupabase.storage.from('public-assets').upload(fileName, file);

                const aiContext = `
[Part Number]: ${values.partNumber || 'N/A'}
[Part Name]: ${values.partName || 'N/A'}
[Problem]: ${values.summary}
[Root Cause]: ${values.rootCause}
[Interim/Permanent Action]: ${values.interimAction}
                `.trim();

                const newNotice = {
                    title: values.title,
                    description: aiContext,
                    notice_code: values.reportNo || `HIST-${dayjs().format('YYYYMMDD')}-${Math.floor(Math.random() * 1000)}`,
                    assigned_supplier_id: values.supplierId,
                    assigned_supplier_name: suppliers.find(s => s.id === values.supplierId)?.name || 'Unknown',
                    status: '已完成',
                    category: 'Historical 8D',
                    created_at: values.date ? dayjs(values.date).toISOString() : new Date().toISOString(),
                    sd_notice: {
                        details: {
                            part_number: values.partNumber,
                            part_name: values.partName, // 确保写入
                            finding: values.summary,
                            root_cause: values.rootCause,
                            action_plan: values.interimAction,
                            report_file_path: fileName
                        }
                    },
                    history: [{ type: 'system_import', submitter: currentUser.username, time: dayjs().format('YYYY-MM-DD HH:mm:ss') }]
                };
                await addNotices([newNotice]);
                successCount++;
                
                // 更新该项状态
                setParsedResults(prev => prev.map(p => p.key === item.key ? { ...p, isArchived: true } : p));

            } catch (err) {
                console.error(`Batch archive failed for ${item.fileName}`, err);
            }
        }
        setLoading(false);
        messageApi.success(`批量处理完成，成功归档 ${successCount} 个文件`);
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
                             <Card title="PDF 批量智能解析" style={{marginBottom: 24}}>
                                <Form form={form} layout="vertical" onFinish={handleSingleFileArchive}>
                                    <Form.Item label="文件上传" style={{ marginBottom: 12 }}>
                                        <Form.Item name="file" valuePropName="fileList" getValueFromEvent={(e) => Array.isArray(e) ? e : e && e.fileList} noStyle>
                                            <Upload multiple beforeUpload={() => false} accept=".pdf" fileList={form.getFieldValue('file')}>
                                                <Button icon={<UploadOutlined />} block>选择 PDF 文件 (支持多选)</Button>
                                            </Upload>
                                        </Form.Item>
                                    </Form.Item>
                                    
                                    <div style={{ background: '#f0f2f5', padding: 12, borderRadius: 6, marginBottom: 16 }}>
                                         <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                            <span><ApiOutlined /> 解析引擎:</span>
                                            <Switch
                                                checkedChildren={<><GoogleOutlined /> Google Gemini</>}
                                                unCheckedChildren={<><RobotOutlined /> 本地 OCR</>}
                                                checked={useGemini}
                                                onChange={setUseGemini}
                                            />
                                        </Space>
                                         {useGemini && (
                                            <div style={{ marginTop: 8 }}>
                                                <Input.Password
                                                    placeholder="Google API Key"
                                                    value={apiKey}
                                                    onChange={e => setApiKey(e.target.value)}
                                                    style={{marginBottom: 8}}
                                                />
                                                 <Select
                                                    value={geminiModel}
                                                    onChange={setGeminiModel}
                                                    placeholder="选择模型"
                                                    style={{ width: '100%' }}
                                                >
                                                    <Option value="gemini-2.5-flash-lite">Gemini 2.5 Flash</Option>
                                                    <Option value="gemini-2.5-pro">Gemini 2.5 Pro</Option>
                                                </Select>
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
                                    <Alert message={`正在编辑: ${parsedResults[activeResultIndex]?.fileName}`} type="info" showIcon style={{marginBottom: 16}} />
                                    <Form form={form} layout="vertical" onFinish={handleSingleFileArchive}>
                                        <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
                                        <Row gutter={16}>
                                            <Col span={12}><Form.Item name="reportNo" label="编号"><Input /></Form.Item></Col>
                                            <Col span={12}>
                                                <Form.Item name="supplierId" label="供应商" rules={[{ required: true }]}>
                                                    <Select placeholder="选择供应商" options={managedSuppliers.map(s => ({ value: s.id, label: s.name }))} />
                                                </Form.Item>
                                            </Col>
                                        </Row>
                                        {/* 新增的 Part 字段 */}
                                        <Row gutter={16}>
                                            <Col span={12}><Form.Item name="partNumber" label="零件号 (Part No)"><Input /></Form.Item></Col>
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

                <Tabs.TabPane tab={<span><FileExcelOutlined /> Excel 批量迁移</span>} key="excel">
                    <Card title="旧版 8D 跟踪表导入">
                        <Dragger beforeUpload={handleExcelBatchImport} showUploadList={false} accept=".xlsx, .xls">
                            <p className="ant-upload-drag-icon"><InboxOutlined style={{ color: '#1890ff' }} /></p>
                            <p className="ant-upload-text">点击或拖拽历史 Excel 跟踪表到此区域</p>
                        </Dragger>
                    </Card>
                </Tabs.TabPane>
            </Tabs>
        </div>
    );
};

export default HistoricalImportPage;