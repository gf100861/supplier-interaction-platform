import React, { useState, useEffect, useMemo } from 'react';
import { Checkbox, Card, Tabs, Upload, Button, Form, Input, Select, DatePicker, message, Row, Col, Typography, Divider, Alert, Space, Spin, Collapse, Switch, Table, Progress, Tag } from 'antd';
import { InboxOutlined, FileExcelOutlined, FilePdfOutlined, UploadOutlined, CloudUploadOutlined, RobotOutlined, ThunderboltOutlined, CaretRightOutlined, ApiOutlined, GoogleOutlined, CheckCircleOutlined, SyncOutlined, CloseCircleOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNotification } from '../contexts/NotificationContext';
import { useSuppliers } from '../contexts/SupplierContext';
// --- 第三方库 CDN 导入 ---
import Tesseract from 'https://esm.sh/tesseract.js@5.0.3';
import * as pdfjsLibProxy from 'https://esm.sh/pdfjs-dist@3.11.174';
import mammoth from 'https://esm.sh/mammoth@1.6.0';


const pdfjsLib = pdfjsLibProxy.default?.GlobalWorkerOptions ? pdfjsLibProxy.default : pdfjsLibProxy;

if (pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
}

const { Title, Paragraph, Text } = Typography;
const { Dragger } = Upload;
const { TextArea } = Input;
const { Option } = Select;

// 🔧 环境配置
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_URL = isDev
    ? 'http://localhost:3001'
    : 'https://supplier-interaction-platform-backend.vercel.app';

const PROVIDERS = {
    QWEN: { label: '阿里云 Qwen', value: 'qwen', defaultModel: 'qwen-vl-max' },
    GEMINI: { label: 'Google Gemini', value: 'gemini', defaultModel: 'gemini-2.5-flash' },
    OPENAI: { label: 'OpenAI (GPT-4o)', value: 'openai', defaultModel: 'gpt-4o' }
};

const HistoricalImportPage = () => {
    const [loading, setLoading] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [parseProgress, setParseProgress] = useState('');
    const [useAI, setUseAI] = useState(true);

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

    const [provider, setProvider] = useState(PROVIDERS.GEMINI.value);
    const [apiKeys, setApiKeys] = useState({ gemini: '', qwen: '', openai: '' });
    const [currentModel, setCurrentModel] = useState(PROVIDERS.GEMINI.defaultModel);
    const [rememberApiKey, setRememberApiKey] = useState(false);

    const [form] = Form.useForm();

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
        const providerKey = Object.keys(PROVIDERS).find(k => PROVIDERS[k].value === val);
        if (providerKey) setCurrentModel(PROVIDERS[providerKey].defaultModel);
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

    const fileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
        });
    };

    // ✅ 修改：统一调用后端分析 API
    const callUnifiedAI = async (inputData, inputType = 'image') => {
        const apiKey = apiKeys[provider];
        if (!apiKey) throw new Error(`请先输入 ${PROVIDERS[Object.keys(PROVIDERS).find(k => PROVIDERS[k].value === provider)].label} 的 API Key`);

        // 调用后端
        const response = await fetch(`${BACKEND_URL}/api/ai/analyze-document`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider,
                model: currentModel,
                inputData, // text content or array of base64 images
                inputType, // 'text' or 'image'
                apiKey // 传递前端输入的 Key (如果后端没配置全局 Key)
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Server Error: ${response.status}`);
        }

        const resData = await response.json();
        return resData.data;
    };

    // --- 文件处理逻辑 (保留在前端以避免大文件上传限制) ---
    const convertPdfToImages = async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const totalPages = pdf.numPages;
        const images = [];
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

    const extractTextFromDocx = async (file) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
            return result.value;
        } catch (error) {
            throw new Error("Word 解析失败，请确认文件未损坏且为 .docx 格式");
        }
    };

    // 本地 OCR (Fallback)
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
            const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
            const isWord = file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc');

            setBatchProgress({ current: i + 1, total: fileList.length, percent: Math.round(((i) / fileList.length) * 100) });
            setParseProgress(`正在处理 (${i + 1}/${fileList.length}): ${file.name}...`);

            try {
                let data = {};

                if (useAI) {
                    if (!apiKeys[provider]) {
                        messageApi.error(`缺少 ${PROVIDERS[provider.toUpperCase()].label} API Key`);
                        throw new Error(`缺少 Key`);
                    }

                    let aiResult;
                    if (isPdf) {
                        setParseProgress(`正在渲染 PDF...`);
                        const base64Images = await convertPdfToImages(file);
                        setParseProgress(`请求后端 AI (视觉分析)...`);
                        aiResult = await callUnifiedAI(base64Images, 'image');
                    } else if (isWord) {
                        if (file.name.toLowerCase().endsWith('.doc')) throw new Error("不支持 .doc");
                        setParseProgress(`正在提取文本...`);
                        const textContent = await extractTextFromDocx(file);
                        setParseProgress(`请求后端 AI (文本分析)...`);
                        aiResult = await callUnifiedAI(textContent, 'text');
                    } else {
                        throw new Error("不支持的文件格式");
                    }

                    data = {
                        ...aiResult,
                        date: aiResult.date ? dayjs(aiResult.date) : dayjs(),
                        title: aiResult.subject ? aiResult.subject : `${aiResult.partNo || ''} - ${aiResult.partName || ''}`
                    };
                } else {
                    // Local OCR Fallback
                    if (isPdf) {
                        const rawText = await extractTextLocal(file);
                        data = parse8DReportTextLocal(rawText);
                    } else if (isWord) {
                        const rawText = await extractTextFromDocx(file);
                        data = parse8DReportTextLocal(rawText);
                    }
                }

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

        const firstSuccess = results.findIndex(r => r.status === 'success');
        if (firstSuccess !== -1) loadResultToForm(results[firstSuccess], firstSuccess);
    };

    const loadResultToForm = (resultItem, index) => {
        setActiveResultIndex(index);
        if (resultItem.status === 'success' && resultItem.data) {
            form.setFieldsValue({
                title: resultItem.data.title,
                partNumber: resultItem.data.partNumber,
                partName: resultItem.data.partName,
                reportNo: resultItem.data.reportNo,
                summary: resultItem.data.summary,
                rootCause: resultItem.data.rootCause,
                interimAction: resultItem.data.interimAction,
                date: resultItem.data.date,
                supplierId: resultItem.data.supplierId,
                quantity: resultItem.data.quantity
            });
        } else {
            form.resetFields();
        }
    };

    // ✅ 修改：调用后端归档 API
    const handleSingleFileArchive = async (values) => {
        setLoading(true);
        try {
            let file;
            if (activeResultIndex !== -1 && parsedResults[activeResultIndex]) {
                file = parsedResults[activeResultIndex].fileObj;
            } else if (values.file && values.file[0]) {
                file = values.file[0].originFileObj;
            }

            if (!file) throw new Error("未找到文件对象");

            // 前端转 Base64 (避免传大文件给后端解析，这里只做存储准备)
            const base64File = await fileToBase64(file);

            const aiContext = `
[Part Number]: ${values.partNumber || 'N/A'}
[Part Name]: ${values.partName || 'N/A'}
[Quantity]: ${values.quantity || 'N/A'}
[Problem]: ${values.summary}
[Root Cause]: ${values.rootCause}
[Interim/Permanent Action]: ${values.interimAction}
            `.trim();

            const supplierName = suppliers.find(s => s.id === values.supplierId)?.name || '';

              const token = localStorage.getItem('access_token');

            // 调用后端
            const response = await fetch(`${BACKEND_URL}/api/notices/archive-historical`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json','Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    values: {
                        ...values,
                        date: values.date ? values.date.toISOString() : new Date().toISOString()
                    },
                    currentUser,
                    supplierName,
                    aiContext,
                    base64File, // 注意：如果文件 > 4MB，这里可能会报错，建议限制文件大小
                    fileName: file.name,
                    apiKey: apiKeys.gemini // 传递 Key 用于后端生成向量
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Archive failed');
            }

            messageApi.success("归档成功！");

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

    // ✅ 修改：批量归档调用后端
    const handleBatchArchiveAll = async () => {
        const itemsToArchive = parsedResults.filter(item => item.status === 'success' && !item.isArchived);
        if (itemsToArchive.length === 0) {
            messageApi.info("没有需要归档的项目");
            return;
        }

        setLoading(true);
        let successCount = 0;
        let failCount = 0;

        const token = localStorage.getItem('access_token');
        if (!token) {
        messageApi.error('登录凭证丢失');
        return;
      }

        for (const item of itemsToArchive) {
            try {
                const values = item.data;
                const file = item.fileObj;
                const base64File = await fileToBase64(file);

                const aiContext = `
[Part Number]: ${values.partNumber || 'N/A'}
[Part Name]: ${values.partName || 'N/A'}
[Problem]: ${values.summary}
[Root Cause]: ${values.rootCause}
[Interim/Permanent Action]: ${values.interimAction}
                `.trim();

                const supplierName = suppliers.find(s => s.id === values.supplierId)?.name || 'Unknown';

                const response = await fetch(`${BACKEND_URL}/api/notices/archive-historical`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json','Authorization': `Bearer ${token}`}, // ✅ 现场组装 Header },
                    body: JSON.stringify({
                        values: {
                            ...values,
                            date: values.date ? dayjs(values.date).toISOString() : new Date().toISOString()
                        },
                        currentUser,
                        supplierName,
                        aiContext,
                        base64File,
                        fileName: file.name,
                        apiKey: apiKeys.gemini
                    })
                });

                if (!response.ok) throw new Error('Batch Item Failed');

                successCount++;
                setParsedResults(prev => prev.map(p => p.key === item.key ? { ...p, isArchived: true } : p));

            } catch (err) {
                failCount++;
                console.error(`Batch archive failed for ${item.fileName}`, err);
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

    // ... render return 保持不变，注意 <Form> 的 onFinish 已经改为了 handleSingleFileArchive
    // 篇幅原因，UI 部分与原代码基本一致，只是调用逻辑变了
    return (
        <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
            {/* ... 保持原本的 UI JSX 结构 ... */}
            {/* 只需确保 <Form onFinish={handleSingleFileArchive}> */}
            <Title level={2}>📚 历史经验导入中心</Title>
            <Paragraph type="secondary">
                将历史 8D 报告、Excel 跟踪表导入系统，构建企业质量知识库。
            </Paragraph>

            <Tabs defaultActiveKey="file" type="card" size="large">
                <Tabs.TabPane tab={<span><FilePdfOutlined /> PDF和World文档归档 (OCR/AI)</span>} key="file">
                    <Row gutter={24}>
                        <Col span={14}>
                            <Card title="PDF 批量智能解析" style={{ marginBottom: 24 }}>
                                <Form form={form} layout="vertical" onFinish={handleSingleFileArchive}>
                                    <Form.Item label="文件上传" style={{ marginBottom: 12 }}>
                                        <Form.Item name="file" valuePropName="fileList" getValueFromEvent={(e) => Array.isArray(e) ? e : e && e.fileList} noStyle>
                                            <Upload
                                                multiple
                                                beforeUpload={() => false}
                                                accept=".pdf,.docx,.doc"
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