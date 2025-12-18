import React, { useState, useEffect, useMemo } from 'react';
import { Card, Tabs, Upload, Button, Form, Input, Select, DatePicker, message, Row, Col, Typography, Divider, Alert, Space, Spin, Collapse, Switch } from 'antd';
import { InboxOutlined, FileExcelOutlined, FilePdfOutlined, UploadOutlined, CloudUploadOutlined, RobotOutlined, ThunderboltOutlined, CaretRightOutlined, ApiOutlined, GoogleOutlined } from '@ant-design/icons';
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

    // --- Google Gemini API 调用核心逻辑 (支持多页) ---
    const callGeminiVisionAPI = async (base64Images) => {
        if (!apiKey) {
            throw new Error("API Key 为空！请在设置栏输入 Google API Key。");
        }

        const prompt = `
        You are a Super Quality Engineer expert. Analyze this 8D Report / NCR document (which may contain multiple pages).
        Extract the information into a pure JSON object. 
        
       Strict Rules:

        1. Output ONLY JSON. No Markdown block quotes (like \`\`\`json).
        2. If a field is not found, return null or empty string.
        3. Do not omit any information in any field, including both English and Chinese if possible.
        4. Root Cause Analysis and Interim & Potential Corrective Action should be as detailed as possible.
        5. Root Cause Analysis: Extract all numbered items under section 4. Combine the question (e.g., '为什么...') and the answer below it into a single string per item.
        6. Interim & Potential Corrective Action: Extract all numbered items under section 5 and the answer below it into a single string per item.
        7. Ignore the text inside the embedded screenshots/photos within the table cells.
        
        Fields to extract:
        - reportNo: Report number / NCR No.
        - supplierCode: Supplier code.
        - subject: Subject / Description / Title of the issue.
        - partNo: Material number / Part No.
        - partName: Part name.
        - quantity: Defect quantity.
        - date: Issue date (Format: YYYY-MM-DD).
        - summary: Problem description (D2).
        - rootCause: Root cause analysis (D4). EXTRACT FULL TEXT.
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
                maxOutputTokens: 4096, // 增加 Token 限制以容纳更多内容
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

    // --- 智能解析入口 ---
    const handleSmartParse = async () => {
        const fileList = form.getFieldValue('file');
        if (!fileList || fileList.length === 0) {
            messageApi.warning("请先选择一个 PDF 文件！");
            return;
        }
        const file = fileList[0].originFileObj;
        if (file.type !== 'application/pdf') {
            messageApi.error("仅支持 PDF 解析");
            return;
        }

        setParsing(true);

        try {
            let data = {};

            if (useGemini) {
                if (!apiKey) {
                    messageApi.error("请先在下方输入框填写 Google API Key");
                    setParsing(false);
                    return;
                }
                
                // *** 核心修改：将 PDF 所有页面转换为图片数组 ***
                setParseProgress('正在扫描 PDF 所有页面...');
                const base64Images = await convertPdfToImages(file);

                setParseProgress(`正在请求 ${geminiModel} 模型分析 (${base64Images.length} 页)...`);
                // *** 核心修改：发送图片数组给 AI ***
                const result = await callGeminiVisionAPI(base64Images);

                console.log('AI 解析结果:', result);

                data = {
                    ...result,
                    date: result.date ? dayjs(result.date) : dayjs(),
                    // 优先使用 AI 提取的 Subject 作为标题
                    title: result.subject ? result.subject : `${result.partNo ? `[${result.partNo}] ` : ''}${result.partName ? `${result.partName} - ` : ''}${result.summary ? result.summary.substring(0, 20) : 'Gemini Analysis'}...`
                };
                messageApi.success("Gemini AI 解析成功！");

            } else {
                setParseProgress('初始化 Tesseract OCR 引擎...');
                const rawText = await extractTextLocal(file);
                data = parse8DReportTextLocal(rawText);
                messageApi.success("本地 OCR 解析完成");
            }

            // 自动匹配供应商
            let matchedSupplierId = undefined;
            if (data.supplierCode && suppliers) {
                const targetCode = data.supplierCode.toString().trim().toUpperCase();
                const found = suppliers.find(s => 
                    (s.short_code && s.short_code.toUpperCase() === targetCode) || 
                    (s.parma_id && s.parma_id.toString() === targetCode)
                );
                if (found) {
                    matchedSupplierId = found.id;
                    messageApi.success(`已自动匹配供应商: ${found.name}`);
                }
            }

            form.setFieldsValue({
                title: data.title,
                partNo: data.partNo,
                reportNo: data.reportNo,
                summary: data.summary,
                rootCause: data.rootCause,
                interimAction: data.interimAction,
                date: data.date,
                supplierId: matchedSupplierId
            });
        } catch (error) {
            console.error(error);
            messageApi.error(`解析失败: ${error.message}`);
        } finally {
            setParsing(false);
            setParseProgress('');
        }
    };

    const handleSingleFileArchive = async (values) => {
        setLoading(true);
        try {
            const file = values.file[0].originFileObj;
            const fileName = `history/${Date.now()}_${file.name}`;
            await mockSupabase.storage.from('public-assets').upload(fileName, file);

            const aiContext = `[Part Number]: ${values.partNo || 'N/A'}\n[Problem]: ${values.summary}\n[Root Cause]: ${values.rootCause}\n[Interim/Permanent Action]: ${values.interimAction}`.trim();

            const newNotice = {
                title: values.title,
                description: aiContext,
                notice_code: values.reportNo || `DOC-${Date.now()}`,
                assigned_supplier_id: values.supplierId,
                assigned_supplier_name: suppliers.find(s => s.id === values.supplierId)?.name,
                status: '已完成',
                category: 'Historical 8D',
                details: {
                    part_number: values.partNo,
                    finding: values.summary,
                    root_cause: values.rootCause,
                    action_plan: values.interimAction,
                }
            };
            await addNotices([newNotice]);
            messageApi.success("归档成功！");
            form.resetFields();
        } catch (error) {
            console.error(error);
            messageApi.error("归档失败: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
            <Title level={2}>📚 历史经验导入中心</Title>
            <Paragraph type="secondary">
                将历史 8D 报告、Excel 跟踪表导入系统，构建企业质量知识库。
            </Paragraph>

            <Tabs defaultActiveKey="file" type="card" size="large">
                <Tabs.TabPane tab={<span><FilePdfOutlined /> PDF 文档归档 (OCR/AI)</span>} key="file">
                    <Card title="单份 8D 报告归档">
                        <Row gutter={24}>
                            <Col span={14}>
                                <Form form={form} layout="vertical" onFinish={handleSingleFileArchive}>
                                    <Row gutter={16}>
                                        <Col span={12}>
                                            <Form.Item name="supplierId" label="供应商" rules={[{ required: true }]}>
                                                <Select placeholder="选择供应商">
                                                    {managedSuppliers.map(s => <Option key={s.id} value={s.id}>{s.short_code} - {s.name}</Option>)}
                                                </Select>
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item name="date" label="发生日期" rules={[{ required: true }]}>
                                                <DatePicker style={{ width: '100%' }} />
                                            </Form.Item>
                                        </Col>
                                    </Row>

                                    <Form.Item label="文件与解析设置" style={{ marginBottom: 12 }}>
                                        <div style={{ background: '#f0f2f5', padding: 12, borderRadius: 6, marginBottom: 12 }}>
                                            <Space style={{ marginBottom: 8, width: '100%', justifyContent: 'space-between' }}>
                                                <span><ApiOutlined /> 解析引擎:</span>
                                                <Switch
                                                    checkedChildren={<><GoogleOutlined /> Google Gemini</>}
                                                    unCheckedChildren={<><RobotOutlined /> 本地 OCR</>}
                                                    checked={useGemini}
                                                    onChange={setUseGemini}
                                                />
                                            </Space>

                                            {useGemini && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                    <Input.Password
                                                        placeholder="请输入 Google Gemini API Key (AIza...)"
                                                        value={apiKey}
                                                        onChange={e => setApiKey(e.target.value)}
                                                        prefix={<GoogleOutlined style={{ color: '#999' }} />}
                                                        addonBefore="API Key"
                                                    />
                                                    <Select
                                                        value={geminiModel}
                                                        onChange={setGeminiModel}
                                                        placeholder="选择模型"
                                                        style={{ width: '100%' }}
                                                    >
                                                        <Option value="gemini-2.5-flash-lite">Gemini 2.5 Flash </Option>
                                                        <Option value="gemini-2.5-flash-preview-09-2025">Gemini 2.5 Pro(推荐 - 稳定) </Option>
                                                        <Option value="gemini-3-flash">Gemini 3.0 flash </Option>
                                                        <Option value="gemini-flash-latest">Gemini (最新版)</Option>
                                                    </Select>
                                                    <div style={{ fontSize: 10, color: '#999' }}>* 如果 Key 无效，请检查是否有多余空格</div>
                                                </div>
                                            )}
                                        </div>

                                        <Row gutter={8}>
                                            <Col span={14}>
                                                <Form.Item name="file" valuePropName="fileList" getValueFromEvent={(e) => Array.isArray(e) ? e : e && e.fileList} rules={[{ required: true, message: '请上传文件' }]} noStyle>
                                                    <Upload maxCount={1} beforeUpload={() => false} accept=".pdf">
                                                        <Button icon={<UploadOutlined />} block>选择 PDF 文件</Button>
                                                    </Upload>
                                                </Form.Item>
                                            </Col>
                                            <Col span={10}>
                                                <Button
                                                    icon={<ThunderboltOutlined />}
                                                    onClick={handleSmartParse}
                                                    loading={parsing}
                                                    type="primary"
                                                    ghost
                                                    block
                                                    style={useGemini ? { borderColor: '#722ed1', color: '#722ed1' } : {}}
                                                >
                                                    {parsing ? '正在分析...' : (useGemini ? 'Gemini 智能提取' : 'OCR 本地提取')}
                                                </Button>
                                            </Col>
                                        </Row>
                                        {parsing && <div style={{ marginTop: 8, color: useGemini ? '#722ed1' : '#1890ff', fontSize: 12 }}><Spin size="small" /> {parseProgress}</div>}
                                    </Form.Item>

                                    <Divider orientation="left" style={{ fontSize: 12, color: '#999' }}>识别结果 (请核对)</Divider>

                                    <Form.Item name="title" label="问题标题 (Title)" rules={[{ required: true }]}>
                                        <Input placeholder="自动生成或手动填写" />
                                    </Form.Item>

                                    <Row gutter={16}>
                                        <Col span={12}>
                                            <Form.Item name="reportNo" label="报告编号 (Report No)">
                                                <Input placeholder="OCR 提取" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item name="partNo" label="零件号 (Material No)">
                                                <Input placeholder="OCR 提取" />
                                            </Form.Item>
                                        </Col>
                                    </Row>

                                    <Form.Item name="summary" label="问题摘要 (Problem Description)" rules={[{ required: true }]}>
                                        <TextArea rows={3} showCount maxLength={500} />
                                    </Form.Item>

                                    <Collapse defaultActiveKey={['1']} ghost expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}>
                                        <Panel header="详细分析与措施 (点击展开)" key="1">
                                            <Form.Item name="rootCause" label="根本原因 (Root Cause Analysis)">
                                                <TextArea rows={3} placeholder="D4 根本原因分析..." />
                                            </Form.Item>
                                            <Form.Item name="interimAction" label="临时/永久措施 (Interim & Corrective Action)">
                                                <TextArea rows={3} placeholder="D5/D6 解决措施..." />
                                            </Form.Item>
                                        </Panel>
                                    </Collapse>

                                    <Button type="primary" htmlType="submit" loading={loading} block icon={<CloudUploadOutlined />} size="large" style={{ marginTop: 16 }}>
                                        归档并生成索引
                                    </Button>
                                </Form>
                            </Col>

                            <Col span={10} style={{ background: '#f9f9f9', padding: 24, borderRadius: 8 }}>
                                <Title level={5}><ApiOutlined /> AI 引擎说明</Title>
                                <Paragraph type="secondary" style={{ fontSize: 13 }}>
                                    支持两种解析模式：
                                </Paragraph>

                                <div style={{ marginBottom: 16 }}>
                                    <Text strong style={{ color: '#722ed1' }}><GoogleOutlined /> Google Gemini (推荐)</Text>
                                    <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                                        使用多模态大模型进行视觉分析。
                                        <br />
                                        1. 请在https://aistudio.google.com/welcome 注册并获取API Key。
                                        <br />
                                        2. 请在左侧 "API Key" 输入框填入你的 Key。一般为AIza... 开头。
                                        <br />
                                        3. 选择 <b>Gemini 2.5 pro</b> 速度最快。选择<b>Gemini最新版</b>体验最新版的模型。
                                        <br />
                                        4. 免费额度有限，请合理使用，避免频繁调用。
                                    </p>

                                    <Divider style={{ margin: '12px 0' }} />

                                    <Text strong style={{ color: '#1890ff' }}><RobotOutlined /> 本地 Tesseract OCR</Text>
                                    <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                                        无需 Key，完全本地运行，隐私性好，但准确率低于 Gemini。
                                    </p>
                                </div>
                            </Col>
                        </Row>
                    </Card>
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