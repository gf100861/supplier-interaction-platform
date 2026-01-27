import React, { useState, useMemo, useEffect } from 'react';
import { Row, Col, Tag, Button, Modal, Typography, Divider, Timeline, Form, Input, DatePicker, Upload, Space, Card, Image, theme, Popconfirm, message, Carousel, Alert, Grid } from 'antd';
import {
    PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, PaperClipOutlined, PictureOutlined, UploadOutlined, SolutionOutlined,
    CameraOutlined, UserOutlined as PersonIcon, CalendarOutlined, LeftOutlined, RightOutlined, MinusCircleOutlined, StarOutlined, StarFilled, TagsOutlined,
    InboxOutlined,
    FileAddOutlined,
    DownloadOutlined,
    FilePdfOutlined, // 新增图标
    HistoryOutlined,
    EyeOutlined, CloudDownloadOutlined // 新增图标
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { ActionPlanReviewDisplay } from './ActionPlanReviewDisplay';
import { useNotification } from '../../contexts/NotificationContext';
import { EnhancedImageDisplay } from '../common/EnhancedImageDisplay';
import { AttachmentsDisplay } from '../common/AttachmentsDisplay';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid; // 引入断点钩子

// --- 3. 新增：本地定义的图片轮播组件 ---
const LocalImageCarousel = ({ images, title }) => {
    const screens = useBreakpoint();
    const isMobile = !screens.md;

    if (!images || !Array.isArray(images) || images.length === 0) return null;

    // 轮播容器样式
    const contentStyle = {
        margin: 0,
        height: isMobile ? '200px' : '300px', // 移动端减小高度
        color: '#fff',
        lineHeight: isMobile ? '200px' : '300px',
        textAlign: 'center',
        background: '#f0f2f5',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: '8px',
        overflow: 'hidden'
    };

    return (
        <div style={{ marginTop: '12px' }} className="local-image-carousel-wrapper">
            {/* 注入样式覆盖默认的白色箭头 */}
            <style>
                {`
                    .local-image-carousel-wrapper .slick-prev,
                    .local-image-carousel-wrapper .slick-next {
                        z-index: 2; /* 确保箭头在图片上方 */
                        width: 30px;
                        height: 30px;
                    }
                    .local-image-carousel-wrapper .slick-prev::before,
                    .local-image-carousel-wrapper .slick-next::before {
                        color: black !important; /* 强制改为黑色 */
                        font-size: 24px;         /* 稍微调大一点 */
                        opacity: 0.6;            /* 默认透明度 */
                    }
                    .local-image-carousel-wrapper .slick-prev:hover::before,
                    .local-image-carousel-wrapper .slick-next:hover::before {
                        opacity: 1;              /* 悬停时不透明 */
                    }
                    /* 调整箭头位置，避免太靠边 */
                    .local-image-carousel-wrapper .slick-prev {
                        left: 10px;
                    }
                    .local-image-carousel-wrapper .slick-next {
                        right: 10px;
                    }
                `}
            </style>

            {title && <div style={{ marginBottom: '8px' }}><Text strong><PictureOutlined /> {title}:</Text></div>}
            <div style={{ padding: '0 20px' }}> {/* 增加 padding 以防止箭头遮挡 */}
                <Carousel
                    arrows
                    infinite
                    autoplay
                    style={{ backgroundColor: '#364d79', borderRadius: '8px' }}
                >
                    {images.map((img, index) => {
                        const url = typeof img === 'string' ? img : (img?.url || img?.thumbUrl);
                        return (
                            <div key={index}>
                                <div style={contentStyle}>
                                    <Image
                                        src={url}
                                        style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                                        alt={`evidence-${index}`}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </Carousel>
            </div>
        </div>
    );
};

// 3. 将 toPlainText 设为模块级辅助函数
const toPlainText = (val) => {
    if (val == null) return '';
    // 检查 ExcelJS 可能返回的富文本对象
    if (typeof val === 'object' && val.richText) {
        return val.richText.map(r => r?.text || '').join('');
    }
    // 检查您系统中存储的富文本对象
    if (typeof val === 'object' && Array.isArray(val.richText)) {
        return val.richText.map(r => r?.text || '').join('');
    }
    if (typeof val === 'object' && typeof val.richText === 'string') {
        return val.richText;
    }
    // 已经是纯文本或数字
    return String(val);
};

// --- 新增：Historical 8D 专用显示组件 ---
const Historical8DDisplay = ({ notice }) => {
    const details = notice?.sdNotice?.details || {};
    const { messageApi } = useNotification();

    // 在组件内部添加状态
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);

    const getChineseOnly = (text = '') =>
        text.match(/[\u4e00-\u9fa5]/g)?.join('') || '';

    // 打开预览
    const handlePreviewReport = () => {
        setIsPreviewVisible(true);
    };
    // 下载报告

    const handleDownloadReport = () => {
        // 1. 检查是否有 Base64 内容
        if (!details?.fileContent) {
            messageApi.warning('未找到文件内容');
            return;
        }

        try {
            messageApi.loading({ content: '正在准备下载...', key: 'download' });

            // 2. 创建一个临时的 <a> 标签
            const link = document.createElement('a');

            // 3. 直接将 Base64 字符串赋值给 href
            link.href = details.fileContent;

            // 4. 设置下载文件名
            link.download = details.originalFileName || `${notice?.noticeCode || 'Report'}.pdf`;

            // 5. 触发点击并清理
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            messageApi.success({ content: '下载已触发', key: 'download' });
        } catch (error) {
            console.error('下载出错:', error);
            messageApi.error({ content: '下载失败', key: 'download' });
        }
    };

    return (
        <Card type="inner" title={<Space><HistoryOutlined /> 历史 8D 归档详情</Space>} style={{ marginTop: 16, backgroundColor: '#f9f9f9' }}>
            {/* 响应式修改：xs=24 占满一行, md=12 占一半 */}
            <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                    <Text type="secondary">零件号 (Part No):</Text>
                    <div><Text strong>{details.partNumber || 'N/A'}</Text></div>
                </Col>
                <Col xs={24} md={12}>
                    <Text type="secondary">零件名称 (Part Name):</Text>
                    <div><Text strong>{details.partName || 'N/A'}</Text></div>
                </Col>
                <Col xs={24} md={12}>
                    <Text type="secondary">数量 (Qty):</Text>
                    <div>{details.quantity || 'N/A'}</div>
                </Col>
                 <Col xs={24} md={12}>
                    <Text type="secondary">供应商(Supplier):</Text>
                    <div>{notice?.supplier?.shortCode || 'N/A'}</div>
                </Col>
                <Col xs={24} md={12}>
                    <Text type="secondary">原始报告:</Text>
                    <div style={{ marginTop: 8 }}>
                        {details.fileContent ? (
                            <Space>
                                {/* 预览按钮 */}
                                <Button
                                    type="default"
                                    size="small"
                                    icon={<EyeOutlined />}
                                    onClick={handlePreviewReport}
                                >
                                    在线预览
                                </Button>

                                {/* 下载按钮 */}
                                <Button
                                    type="primary"
                                    ghost
                                    size="small"
                                    icon={<CloudDownloadOutlined />}
                                    onClick={handleDownloadReport}
                                >
                                    下载
                                </Button>
                            </Space>
                        ) : (
                            <Text disabled>无附件</Text>
                        )}

                        {/* 预览弹窗 */}

                        <Modal
                            title="报告预览"
                            open={isPreviewVisible}
                            onCancel={() => setIsPreviewVisible(false)}
                            width="95%" // 移动端更宽
                            style={{ top: 20 }}
                            footer={null}
                            destroyOnClose
                            bodyStyle={{ height: '80vh', padding: 0 }}
                        >
                            {details?.fileContent ? (
                                <iframe
                                    src={details.fileContent}
                                    style={{ width: '100%', height: '100%', border: 'none' }}
                                    title="PDF Preview"
                                />
                            ) : (
                                <div style={{ padding: 20, textAlign: 'center' }}>无法加载预览内容</div>
                            )}
                        </Modal>
                    </div>
                </Col>
            </Row>

            <Divider style={{ margin: '16px 0' }} />

            <Title level={5} style={{ fontSize: 14 }}>问题描述 (D2)</Title>
            <Paragraph style={{ whiteSpace: 'pre-wrap', background: '#fff', padding: 12, borderRadius: 4, border: '1px solid #f0f0f0' }}>
                {getChineseOnly(details.finding || notice.description) || '无详细描述'}
            </Paragraph>

            <Title level={5} style={{ fontSize: 14 }}>根本原因 (D4)</Title>
            <Paragraph style={{ whiteSpace: 'pre-wrap', background: '#fff', padding: 12, borderRadius: 4, border: '1px solid #f0f0f0' }}>
                {details.rootCause || '未记录'}
            </Paragraph>

            <Title level={5} style={{ fontSize: 14 }}>永久对策 (D5/D6)</Title>
            <Paragraph style={{ whiteSpace: 'pre-wrap', background: '#fff', padding: 12, borderRadius: 4, border: '1px solid #f0f0f0' }}>
                {details.actionPlan || '未记录'}
            </Paragraph>

            <Alert message="此为历史导入数据，仅供查询参考，不可编辑。" type="info" showIcon style={{ marginTop: 16 }} />
        </Card>
    );
};

const categoryColumnConfig = {
    'SEM': [
        { title: 'Criteria n°', dataIndex: 'criteria' },
        { title: 'SEM Parameter', dataIndex: 'parameter' },
        { title: 'Gap description', dataIndex: 'description' },
        { title: 'Actual SEM points', dataIndex: 'score' },
    ],
    'Process Audit': [
        { title: 'PROCESS/QUESTIONS', dataIndex: 'title' },
        { title: 'FINDINGS/DEVIATIONS', dataIndex: 'description' }
    ],
};


const normFile = (e) => { if (Array.isArray(e)) return e; return e && e.fileList; };

const DynamicDetailsDisplay = ({ notice }) => {
    // 如果是 Historical 8D，不显示通用的 dynamic details，由专用组件处理
    if (notice?.category === 'Historical 8D') return null;

    if (!notice?.category || !notice?.sdNotice?.details) return null;
    const config = categoryColumnConfig[notice.category] || [];
    const dynamicFields = config.filter(
        col => col.dataIndex !== 'title' && col.dataIndex !== 'description'
    );
    if (dynamicFields.length === 0) return null;

    return (
        <>
            <Divider style={{ margin: '12px 0' }} />
            <Space direction="vertical" size="small">
                {dynamicFields.map(field => (
                    <Text key={field.dataIndex}>
                        <Text strong>{field.title}: </Text>
                        {toPlainText(notice.sdNotice.details[field.dataIndex])}
                    </Text>
                ))}
            </Space>
        </>
    );
};

// --- PlanSubmissionForm ---
const PlanSubmissionForm = ({ onFinish, form, actionAreaStyle, notice }) => {
    const screens = useBreakpoint();
    const isMobile = !screens.md;

    // ... (PlanSubmissionForm 代码保持不变)
    const draftKey = `actionPlanDraft_${notice?.id}`;
    const { messageApi } = useNotification();

    // [加载草稿]
    useEffect(() => {
        if (notice?.id) {
            const savedDraft = localStorage.getItem(draftKey);
            if (savedDraft) {
                try {
                    const draftData = JSON.parse(savedDraft);
                    if (draftData.actionPlans) {
                        draftData.actionPlans = draftData.actionPlans.map(plan => ({
                            ...plan,
                            deadline: plan.deadline ? dayjs(plan.deadline) : null
                        }));
                    }
                    form.setFieldsValue(draftData);
                    messageApi.info("已为您加载上次未提交的草稿。");
                } catch (e) {
                    console.error("加载草稿失败:", e);
                    localStorage.removeItem(draftKey);
                }
            }
        }
    }, [notice?.id, form, draftKey, messageApi]);

    // [自动保存]
    const handleFormChange = (changedValues, allValues) => {
        if (notice?.id) {
            try {
                localStorage.setItem(draftKey, JSON.stringify(allValues));
            } catch (e) {
                console.warn("保存草稿失败 (可能已满):", e);
            }
        }
    };

    // [清空草稿]
    const handleFinish = (values) => {
        if (onFinish) {
            onFinish(values);
        }
        if (notice?.id) {
            localStorage.removeItem(draftKey);
        }
    };

    // [下载模板]
    const handleDownloadTemplate = async () => {
        messageApi.loading({ content: '正在生成模板...', key: 'template' });
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Action Plan Template');

            // A. 添加问题详情
            worksheet.mergeCells('A1:C1');
            worksheet.getCell('A1').value = 'Problem Finding / Deviation';
            worksheet.getCell('A1').font = { bold: true, size: 14 };
            worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF8E6' } };

            worksheet.mergeCells('A2:C2');
            const findingText = toPlainText(notice.sdNotice?.details?.finding || notice.sdNotice?.details?.description || notice.title || 'N/A');
            worksheet.getCell('A2').value = findingText;
            worksheet.getCell('A2').alignment = { wrapText: true };
            worksheet.getRow(2).height = 40;

            worksheet.mergeCells('A3:C3');
            worksheet.getCell('A3').value = { richText: [{ font: { bold: true, color: { argb: 'FFFF0000' } }, text: '请勿修改本行及以上内容。' }] };
            worksheet.mergeCells('A4:C4');
            worksheet.getCell('A4').value = { richText: [{ font: { bold: true, size: 12 }, text: '请在下方第 6 行开始填写。每一行代表一个独立的行动项。' }] };
            worksheet.getRow(4).height = 20;

            // B. 添加表头
            worksheet.getRow(5).values = ['Action Plan (必填)', 'Responsible (必填)', 'Deadline (YYYY-MM-DD 必填)'];
            worksheet.getRow(5).font = { bold: true };
            worksheet.getRow(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F7FF' } };
            worksheet.columns = [
                { key: 'plan', width: 60 },
                { key: 'responsible', width: 20 },
                { key: 'deadline', width: 20 },
            ];

            // C. 预填表单中已有的数据
            const currentPlans = form.getFieldValue('actionPlans') || [];
            currentPlans.forEach(plan => {
                if (plan && (plan.plan || plan.responsible || plan.deadline)) { // 只添加有内容的行
                    worksheet.addRow({
                        plan: plan.plan,
                        responsible: plan.responsible,
                        deadline: plan.deadline ? dayjs(plan.deadline).format('YYYY-MM-DD') : ''
                    });
                }
            });

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `ActionPlan_Template_${notice.noticeCode}.xlsx`);
            messageApi.success({ content: '模板已开始下载。', key: 'template' });

        } catch (error) {
            console.error("生成模板失败:", error);
            messageApi.error({ content: '模板生成失败，请重试。', key: 'template' });
        }
    };

    // [处理Excel导入]
    const handleExcelUpload = (file) => {
        messageApi.loading({ content: '正在解析Excel文件...', key: 'excelRead' });
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const buffer = e.target.result;
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(buffer);
                const worksheet = workbook.getWorksheet(1);

                const parsedData = [];
                let hasData = false;

                worksheet.eachRow((row, rowNumber) => {
                    if (rowNumber <= 5) return; // 跳过前5行

                    const plan = toPlainText(row.getCell(1).value || '');
                    const responsible = toPlainText(row.getCell(2).value || '');
                    const deadlineValue = row.getCell(3).value;

                    // --- 核心验证：三项都必须填写 ---
                    if (plan.trim() && responsible.trim() && deadlineValue) {
                        hasData = true;
                        parsedData.push({
                            plan: plan,
                            responsible: responsible,
                            deadline: deadlineValue ? dayjs(deadlineValue) : null
                        });
                    }
                });

                if (!hasData) {
                    messageApi.warning({ content: '未在Excel中找到有效的行动计划数据（请确保 Action Plan, Responsible, Deadline 均已填写）。', key: 'excelRead', duration: 4 });
                    return;
                }

                form.setFieldsValue({ actionPlans: parsedData });
                handleFormChange(null, { actionPlans: parsedData });
                messageApi.success({ content: `成功导入 ${parsedData.length} 条行动计划。`, key: 'excelRead' });

            } catch (error) {
                console.error("解析Excel失败:", error);
                messageApi.error({ content: `文件解析失败: ${error.message}`, key: 'excelRead' });
            }
        };
        reader.onerror = (error) => {
            messageApi.error({ content: `文件读取失败: ${error.message}`, key: 'excelRead' });
        };
        reader.readAsArrayBuffer(file);
        return false;
    };


    return (
        <div style={actionAreaStyle}>
            <Title level={5}><SolutionOutlined /> 提交行动计划</Title>

            <Space style={{ marginBottom: 16,width: '100%' }} direction={isMobile ? "vertical" : "horizontal"}>
                <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate} block={isMobile}>
                    下载模板
                </Button>
                <Upload
                    beforeUpload={handleExcelUpload}
                    showUploadList={false}
                    accept=".xlsx, .xls"
                >
                    <Button icon={<UploadOutlined />} block={isMobile}>
                        从Excel导入
                    </Button>
                </Upload>
            </Space>
            <Paragraph type="secondary" style={{ fontSize: '12px', marginTop: isMobile ? '4px' : '-8px' }}>
                您可以下载模板，离线填写行动计划后，再导入回系统。
            </Paragraph>
            <Divider />

            <Form
                form={form}
                layout="vertical"
                onFinish={handleFinish}
                onValuesChange={handleFormChange}
                autoComplete="off"
            >
                <Form.List name="actionPlans" initialValue={[{ plan: '', responsible: '', deadline: null }]}>
                    {(fields, { add, remove }) => (
                        <div style={{ display: 'flex', flexDirection: 'column', rowGap: 16 }}>
                            {fields.map((field, index) => (
                                <Card key={field.key} size="small" title={`行动项 #${index + 1}`} extra={<MinusCircleOutlined onClick={() => remove(field.name)} />}>
                                    <Form.Item {...field} name={[field.name, 'plan']} label="行动方案" rules={[{ required: true, message: '请输入行动方案' }]}>
                                        <TextArea autoSize={{ minRows: 3, maxRows: 9 }} />
                                    </Form.Item>
                                    <Space wrap align="baseline" direction={isMobile ? "vertical" : "horizontal"} style={{width: '100%'}}>
                                        <Form.Item {...field} name={[field.name, 'responsible']} label="负责人" rules={[{ required: true, message: '请输入负责人' }]} style={{width: isMobile ? '100%' : 'auto'}}>
                                            <Input />
                                        </Form.Item>
                                        <Form.Item {...field} name={[field.name, 'deadline']} label="完成日期" rules={[{ required: true, message: '请选择日期' }]} style={{width: isMobile ? '100%' : 'auto'}}>
                                            <DatePicker style={{width: '100%'}}/>
                                        </Form.Item>
                                    </Space>
                                </Card>
                            ))}
                            <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>添加行动项</Button>
                        </div>
                    )}
                </Form.List>
                <Divider />
                <Form.Item><Button type="primary" htmlType="submit" block={isMobile} size="large">提交计划</Button></Form.Item>
            </Form>
        </div>
    );
};

// --- EvidencePerActionForm ---
const EvidencePerActionForm = ({ onFinish, form, notice, handlePreview }) => {
    const screens = useBreakpoint();
    const isMobile = !screens.md;

    // ... (EvidencePerActionForm 代码保持不变)
    const { messageApi } = useNotification();
    const draftKey = `evidenceDraft_${notice?.id}`;

    // [加载草稿]
    useEffect(() => {
        if (notice?.id) {
            const savedDraft = localStorage.getItem(draftKey);
            if (savedDraft) {
                try {
                    const draftData = JSON.parse(savedDraft);
                    form.setFieldsValue(draftData);
                    messageApi.info("已为您加载上次未提交的证据草稿。");
                } catch (e) {
                    console.error("加载证据草稿失败:", e);
                    localStorage.removeItem(draftKey);
                }
            }
        }
    }, [notice?.id, form, draftKey, messageApi]);

    // [自动保存]
    const handleFormChange = (changedValues, allValues) => {
        if (notice?.id) {
            try {
                localStorage.setItem(draftKey, JSON.stringify(allValues));
            } catch (e) {
                console.warn("保存证据草稿失败 (可能已满):", e);
            }
        }
    };

    // [清空草稿]
    const handleFinish = (values) => {
        if (onFinish) {
            onFinish(values);
        }
        if (notice?.id) {
            localStorage.removeItem(draftKey);
        }
    };

    const lastApprovedPlans = useMemo(() => {
        const history = notice?.history || [];
        const lastPlanEvent = [...history].reverse().find(h => h.type === 'sd_plan_approval' || h.type === 'supplier_plan_submission');
        return lastPlanEvent?.actionPlans || [];
    }, [notice]);

    // [下载证据模板]
    const handleDownloadEvidenceTemplate = async () => {
        messageApi.loading({ content: '正在生成证据模板...', key: 'evidenceTemplate' });
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Evidence Template');

            // A. 标题和说明
            worksheet.mergeCells('A1:D1');
            worksheet.getCell('A1').value = '批量证据提交模板';
            worksheet.getCell('A1').font = { bold: true, size: 16 };
            worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF8E6' } };

            worksheet.mergeCells('A2:D2');
            worksheet.getCell('A2').value = { richText: [{ font: { bold: true, color: { argb: 'FFFF0000' } }, text: '请勿修改 A, B, C 列！请仅在 D 列填写“完成情况说明”。' }] };
            worksheet.mergeCells('A3:D3');
            worksheet.getCell('A3').value = { richText: [{ font: { bold: true, size: 12 }, text: '图片和附件仍需进入系统单独上传。' }] };

            // B. 表头
            worksheet.getRow(5).values = ['Action Plan (供参考)', 'Responsible (供参考)', 'Deadline (供参考)', 'Evidence Description (请填写)'];
            worksheet.getRow(5).font = { bold: true };
            const grayHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
            const blueHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F7FF' } };
            worksheet.getCell('A5').fill = grayHeaderFill;
            worksheet.getCell('B5').fill = grayHeaderFill;
            worksheet.getCell('C5').fill = grayHeaderFill;
            worksheet.getCell('D5').fill = blueHeaderFill;

            worksheet.columns = [
                { key: 'plan', width: 60 },
                { key: 'responsible', width: 20 },
                { key: 'deadline', width: 20 },
                { key: 'description', width: 60 },
            ];

            // C. 填充已批准的行动计划
            const grayDataFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
            const currentEvidence = form.getFieldValue('evidence') || [];

            lastApprovedPlans.forEach((plan, index) => {
                const row = worksheet.addRow({
                    plan: toPlainText(plan.plan),
                    responsible: plan.responsible,
                    deadline: dayjs(plan.deadline).format('YYYY-MM-DD'),
                    description: currentEvidence[index]?.description || '' // 预填草稿
                });
                row.getCell(1).fill = grayDataFill;
                row.getCell(2).fill = grayDataFill;
                row.getCell(3).fill = grayDataFill;
            });

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Evidence_Template_${notice.noticeCode}.xlsx`);
            messageApi.success({ content: '模板已开始下载。', key: 'evidenceTemplate' });

        } catch (error) {
            console.error("生成证据模板失败:", error);
            messageApi.error({ content: '模板生成失败，请重试。', key: 'evidenceTemplate' });
        }
    };

    // [处理证据导入]
    const handleEvidenceExcelUpload = (file) => {
        messageApi.loading({ content: '正在解析Excel文件...', key: 'excelRead' });
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const buffer = e.target.result;
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(buffer);
                const worksheet = workbook.getWorksheet(1);

                const parsedData = [];
                let hasData = false;

                worksheet.eachRow((row, rowNumber) => {
                    if (rowNumber <= 5) return; // 跳过表头

                    // 只读取第4列 (D列) 的证据描述
                    const description = toPlainText(row.getCell(4).value || '');

                    // 必须保证导入的行数与待办的行动项行数一致
                    if (rowNumber - 6 < lastApprovedPlans.length) {
                        // 获取表单中已有的该项数据 (如有)
                        const existingItem = form.getFieldValue(['evidence', rowNumber - 6]) || {};
                        parsedData.push({
                            ...existingItem, // 保留已有的 images/attachments
                            description: description.trim() || existingItem.description || '' // 优先使用 Excel 的
                        });
                        if (description.trim()) {
                            hasData = true;
                        }
                    }
                });

                if (!hasData) {
                    messageApi.warning({ content: '未在Excel中找到任何证据说明。', key: 'excelRead' });
                    return;
                }

                form.setFieldsValue({ evidence: parsedData });
                handleFormChange(null, { evidence: parsedData });
                messageApi.success({ content: `成功导入 ${parsedData.length} 条证据说明。`, key: 'excelRead' });

            } catch (error) {
                console.error("解析Excel失败:", error);
                messageApi.error({ content: `文件解析失败: ${error.message}`, key: 'excelRead' });
            }
        };
        reader.onerror = (error) => {
            messageApi.error({ content: `文件读取失败: ${error.message}`, key: 'excelRead' });
        };
        reader.readAsArrayBuffer(file);
        return false;
    };


    return (
        <Form
            form={form}
            layout="vertical"
            onFinish={handleFinish}
            onValuesChange={handleFormChange}
        >
            <Title level={5}><CheckCircleOutlined /> 上传完成证据</Title>
            <Paragraph type="secondary">请为每一个已批准的行动项，填写完成说明并上传证据文件。</Paragraph>

            {/* --- 8. 新增：添加导入/导出按钮 --- */}
            <Space style={{ marginBottom: 16, width: '100%' }} direction={isMobile ? "vertical" : "horizontal"}>
                <Button icon={<DownloadOutlined />} onClick={handleDownloadEvidenceTemplate} block={isMobile}>
                    下载证据模板
                </Button>
                <Upload
                    beforeUpload={handleEvidenceExcelUpload}
                    showUploadList={false}
                    accept=".xlsx, .xls"
                >
                    <Button icon={<UploadOutlined />} block={isMobile}>
                        导入证据说明
                    </Button>
                </Upload>
            </Space>
            <Paragraph type="secondary" style={{ fontSize: '12px', marginTop: isMobile ? '4px' : '-8px' }}>
                您可以下载模板，离线填写**证据说明**后，再导入回系统。
            </Paragraph>
            <Divider />

            <div style={{ display: 'flex', flexDirection: 'column', rowGap: 16 }}>
                {lastApprovedPlans.map((plan, index) => (
                    <Card key={index} type="inner" title={<Text strong>{`行动项 #${index + 1}: ${plan.plan}`}</Text>}>
                        <Paragraph type="secondary">负责人: {plan.responsible} | 截止日期: {dayjs(plan.deadline).format('YYYY-MM-DD')}</Paragraph>
                        <Form.Item
                            name={['evidence', index, 'description']}
                            label="完成情况说明"
                            rules={[{ required: true, message: '请填写完成说明！' }]}
                        >
                            <TextArea autoSize={{ minRows: 3, maxRows: 8 }} placeholder="请简述此项任务的完成情况..." />
                        </Form.Item>
                        <Form.Item
                            name={['evidence', index, 'images']}
                            label="上传图片证据 (可拖拽)"
                            valuePropName="fileList"
                            getValueFromEvent={normFile}
                        >
                            <Upload.Dragger
                                listType="picture"
                                beforeUpload={() => false}
                                onPreview={handlePreview}
                                accept="image/*"
                                multiple
                            >
                                <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                                <p className="ant-upload-text">点击或拖拽图片到此区域上传</p>
                            </Upload.Dragger>
                        </Form.Item>
                        <Form.Item
                            name={['evidence', index, 'attachments']}
                            label="上传附件 (可选, 可拖拽)"
                            valuePropName="fileList"
                            getValueFromEvent={normFile}
                        >
                            <Upload.Dragger
                                beforeUpload={() => false}
                                multiple
                            >
                                <p className="ant-upload-drag-icon"><FileAddOutlined /></p>
                                <p className="ant-upload-text">点击或拖拽附件到此区域上传</p>
                            </Upload.Dragger>
                        </Form.Item>
                    </Card>
                ))}
            </div>
            <Divider />
            <Form.Item><Button type="primary" htmlType="submit" block={isMobile} size="large">提交所有证据</Button></Form.Item>
        </Form>
    );
};

const ApprovalArea = ({ title, onApprove, onReject, approveText, rejectText, actionAreaStyle }) => {
    const screens = useBreakpoint();
    const isMobile = !screens.md;

    return (
        <div style={actionAreaStyle}>
            <Title level={5}>{title}</Title>
            {/* 响应式：移动端垂直排列，桌面端水平排列 */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px', marginTop: '16px' }}>
                <Button type="primary" icon={<CheckCircleOutlined />} onClick={onApprove} style={{ flex: 1 }} size="large" block={isMobile} >
                    {approveText || '批准'}
                </Button>
                <Button danger icon={<CloseCircleOutlined />} onClick={onReject} style={{ flex: 1 }} size="large" block={isMobile} >
                    {rejectText || '驳回'}
                </Button>
            </div>
        </div>
    );
};


export const NoticeDetailModal = ({
    notice, open, onCancel, currentUser, form,
    onPlanSubmit, onPlanApprove, showPlanRejectionModal,
    onEvidenceSubmit, onClosureApprove,
    onApproveEvidenceItem, onRejectEvidenceItem,
    onLikeToggle
}) => {
    const { token } = theme.useToken();
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState('');
    const [previewTitle, setPreviewTitle] = useState('');
    const screens = useBreakpoint(); // 获取断点
    const isMobile = !screens.md;    // 判断是否为移动端

    if (!notice) return null;

    const isLiked = notice.likes && notice.likes.includes(currentUser?.id);
    const isSDOrManager = currentUser?.role === 'SD' || currentUser?.role === 'Manager';

    const getBase64 = (file) =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
        });

    const handleCancel = () => setPreviewOpen(false);

    const handlePreview = async (file) => {
        if (!file.url && !file.preview && file.originFileObj) {
            file.preview = await getBase64(file.originFileObj);
        }
        setPreviewImage(file.url || file.preview);
        setPreviewOpen(true);
        setPreviewTitle(file.name || file.url.substring(file.url.lastIndexOf('/') + 1));
    };

    const actionAreaStyle = {
        background: token.colorFillAlter,
        padding: '16px',
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
    };


    const getChineseOnly = (text = '') =>
        text.match(/[\u4e00-\u9fa5]/g)?.join('') || '';

    const safeTitle = notice?.category === 'Historical 8D' ? getChineseOnly(toPlainText(notice.title || '')) : toPlainText(notice.title || '');

    const renderActionArea = () => {
        const isAssignedSupplier = currentUser?.role === 'Supplier' && currentUser.supplier_id === notice.assignedSupplierId;
        const isSDOrManager = currentUser?.role === 'SD' || currentUser?.role === 'Manager';

        switch (notice.status) {
            case '待提交Action Plan':
                return isAssignedSupplier && <PlanSubmissionForm
                    form={form}
                    onFinish={onPlanSubmit}
                    actionAreaStyle={actionAreaStyle}
                    notice={notice}
                />;

            case '待SD确认actions':
            case '待SD审核计划': {
                if (!isSDOrManager) return null;
                const lastPlanSubmission = [...(notice.history || [])].reverse().find(h => h.type === 'supplier_plan_submission');
                return (
                    <div style={actionAreaStyle}>
                        <Title level={5}>审核供应商行动计划</Title>
                        {lastPlanSubmission ? (
                            <ActionPlanReviewDisplay historyItem={lastPlanSubmission} />
                        ) : (
                            <Text type="danger">错误：未找到供应商提交的行动计划。</Text>
                        )}
                        <Divider />
                        <ApprovalArea
                            title=""
                            onApprove={onPlanApprove}
                            onReject={showPlanRejectionModal}
                            actionAreaStyle={{ background: 'none', border: 'none', padding: 0 }}
                        />
                    </div>
                );
            }

            case '待供应商关闭':
                return isAssignedSupplier && <EvidencePerActionForm form={form} onFinish={onEvidenceSubmit} notice={notice} handlePreview={handlePreview} />;

            case '待SD关闭evidence': {
                if (!isSDOrManager) return null;
                const history = notice.history || [];
                const lastEvidenceIndex = [...history].reverse().findIndex(h => h.type === 'supplier_evidence_submission');
                const realIndex = lastEvidenceIndex >= 0 ? history.length - 1 - lastEvidenceIndex : -1;
                const lastEvidence = realIndex >= 0 ? history[realIndex] : null;
                const evidenceList = lastEvidence?.actionPlans || [];

                const approvedSet = new Set();
                if (realIndex >= 0) {
                    for (let i = realIndex + 1; i < history.length; i++) {
                        const h = history[i];
                        if (h.type === 'sd_evidence_item_approval' && typeof h.evidenceIndex === 'number') {
                            approvedSet.add(h.evidenceIndex);
                        }
                    }
                }
                const approvedFlags = evidenceList.map((_, idx) => approvedSet.has(idx));
                return (
                    <div style={actionAreaStyle}>
                        <Title level={5}>逐条审核证据</Title>
                        <Space direction="vertical" style={{ width: '100%' }}>
                            {evidenceList.map((plan, index) => (
                                <Card key={index} size="small" title={<Text strong>{`证据 #${index + 1}: ${plan.plan}`}</Text>}>
                                    <Paragraph type="secondary">{plan.evidenceDescription || '（供应商未提供文字说明）'}</Paragraph>
                                    <EnhancedImageDisplay
                                        images={plan.evidenceImages}
                                        title=""
                                        size="xlarge"
                                        showTitle={false}
                                    />
                                    <AttachmentsDisplay attachments={plan.evidenceAttachments || plan.attachments} />
                                    <div style={{ marginTop: 8, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '8px' }}>
                                        <Button type="primary" icon={<CheckCircleOutlined />} disabled={approvedFlags[index]} onClick={() => onApproveEvidenceItem?.(index)} block={isMobile}>
                                            {approvedFlags[index] ? '已批准' : '批准此证据'}
                                        </Button>
                                        <Button danger icon={<CloseCircleOutlined />} onClick={() => onRejectEvidenceItem?.(index)} block={isMobile}>驳回此证据并退回</Button>
                                    </div>
                                </Card>
                            ))}
                            <Divider />
                            <Popconfirm title="确定所有证据均已审核通过并关闭吗？" onConfirm={() => onClosureApprove()}>
                                <Button type="primary" block={isMobile} size="large">全部批准并关闭</Button>
                            </Popconfirm>
                        </Space>
                    </div>
                );
            }
            default:
                return null;
        }
    };

    const getHistoryItemLabel = (h) => {
        const typeMap = {
            supplier_plan_submission: "供应商提交了行动计划",
            sd_plan_approval: "SD批准了行动计划",
            sd_plan_rejection: "SD驳回了行动计划",
            supplier_evidence_submission: "供应商提交了完成证据",
            sd_evidence_rejection: "SD驳回了完成证据",
            sd_closure_approve: "SD批准关闭",
            manager_reassignment: "管理员重分配了供应商",
            manager_void: "管理员作废了通知单",
        };
        const colorMap = {
            submission: 'blue',
            approval: 'green',
            rejection: 'red',
            reassignment: 'orange',
            void: 'grey',
        };
        const key = Object.keys(colorMap).find(k => h.type.includes(k));
        return { text: typeMap[h.type] || "执行了操作", color: colorMap[key] || 'grey' };
    };


    return (
        <Modal
            title={`通知单详情: ${safeTitle} - ${notice?.noticeCode || ''}`}
            open={open}
            onCancel={onCancel}
            footer={null}
            // 响应式 Modal 属性
            width={isMobile ? '100%' : 800}
            style={isMobile ? { top: 0, margin: 0, maxWidth: '100vw', padding: 0 } : {}}
            bodyStyle={isMobile ? { minHeight: '100vh', padding: '16px' } : {}}
        >
            <Title level={5} style={{ marginTop: 24 }}>初始通知内容</Title>
            {/* 核心修改：如果是 Historical 8D，使用新的展示组件，否则使用默认的 */}
            {notice?.category === 'Historical 8D' ? (
                <Historical8DDisplay notice={notice} />
            ) : (
                <Card size="small" type="inner">
                    <Paragraph><strong>问题描述:</strong> {toPlainText(notice?.sdNotice?.description || notice?.sdNotice?.details?.finding)}</Paragraph>
                    <DynamicDetailsDisplay notice={notice} />
                    <LocalImageCarousel images={notice?.sdNotice?.images} title="初始图片" />
                    <AttachmentsDisplay attachments={notice?.sdNotice?.attachments} />

                    {(notice?.sdNotice?.problemSource || notice?.sdNotice?.cause) && (
                        <div style={{ marginTop: '12px' }}>
                            <Space wrap>
                                <Text strong><TagsOutlined /> 历史经验标签(单个):</Text>
                                {notice.sdNotice?.problemSource && <Tag color="geekblue">{notice?.sdNotice?.problemSource}</Tag>}
                                {notice?.sdNotice?.cause && <Tag color="purple">{notice?.sdNotice?.cause}</Tag>}
                            </Space>
                        </div>
                    )}

                    {(notice?.sdNotice?.details?.product) && (
                        <div style={{ marginTop: '12px' }}>
                            <Space wrap>
                                <Text strong><TagsOutlined /> 历史经验标签(批量):</Text>
                                {notice?.sdNotice?.details?.product && <Tag color="geekblue">{notice?.sdNotice?.details?.product}</Tag>}
                            </Space>
                        </div>
                    )}
                    <Divider style={{ margin: '8px 0' }} />
                    <Text type="secondary">由 {notice?.creator?.username || 'SD'} 于 {dayjs(notice?.sdNotice?.createTime).format('YYYY-MM-DD HH:mm')} 发起给 {notice?.supplier?.shortCode}</Text>
                </Card>
            )}

            <Divider />

            <Title level={5}>处理历史</Title>
            <Timeline>
                <Timeline.Item color="green">
                    <p><b>{notice?.creator?.username || '发起人'}</b> 在 {dayjs(notice.createdAt).format('YYYY-MM-DD HH:mm')} 发起了通知</p>
                </Timeline.Item>

                {(notice.history || []).map((h, index) => {
                    const label = getHistoryItemLabel(h);
                    const historyArray = notice.history || [];

                    let historyItemForDisplay = h;
                    let shouldRenderItem = false;

                    // 特殊逻辑：对于 Historical 8D，显示“系统导入”记录
                    if (notice.category === 'Historical 8D' && h.type === 'system_import') {
                        return (
                            <Timeline.Item key={index} color="blue">
                                <p><b>{h.submitter}</b> 于 {h.time} 导入了历史数据</p>
                                <Text type="secondary">{h.description}</Text>
                            </Timeline.Item>
                        );
                    }

                    if (h.type === 'sd_plan_approval' || h.type === 'sd_closure_approve') {
                        shouldRenderItem = true;

                        if (h.type === 'sd_closure_approve') {
                            const lastEvidenceSubmission = [...historyArray.slice(0, index)]
                                .reverse()
                                .find(item => item.type === 'supplier_evidence_submission');

                            if (lastEvidenceSubmission) {
                                const nextItem = historyArray[historyArray.indexOf(lastEvidenceSubmission) + 1];
                                if (!nextItem || (nextItem.type !== 'sd_evidence_rejection' && nextItem.type !== 'sd_plan_rejection')) {
                                    historyItemForDisplay = lastEvidenceSubmission;
                                }
                            }
                        }
                    }

                    if (!shouldRenderItem) {
                        return null;
                    }

                    return (
                        <Timeline.Item key={index} color={label.color}>
                            <p><b>{h.submitter || '发起人'}</b> 在 {h.time} {label.text}</p>
                            <ActionPlanReviewDisplay historyItem={historyItemForDisplay} />
                        </Timeline.Item>
                    );
                })}
            </Timeline>

            {notice.status === '已完成' && isSDOrManager && (
                <>
                    <Divider />
                    <div style={{ textAlign: 'center' }}>
                        <Button
                            type={isLiked ? "primary" : "default"}
                            icon={isLiked ? <StarFilled /> : <StarOutlined />}
                            onClick={() => onLikeToggle(notice)}
                            size="large"
                            block={isMobile}
                        >
                            {isLiked ? '已赞' : '点赞表彰'}
                        </Button>
                        <Paragraph type="secondary" style={{ marginTop: '8px' }}>为优秀的整改案例点赞，以在仪表盘上进行展示。
                        </Paragraph>
                    </div>
                </>
            )}

            <Divider />
            {/* 核心修改：如果是 Historical 8D，不显示操作区域，因为它是已完成状态 */}
            {notice.category !== 'Historical 8D' && renderActionArea()}

            <Modal open={previewOpen} title={previewTitle} footer={null} onCancel={handleCancel} width={isMobile ? '100%' : undefined} style={isMobile ? {top: 20} : {}}>
                <img alt="example" style={{ width: '100%' }} src={previewImage} />
            </Modal>
        </Modal>
    );
};