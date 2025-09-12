
import React, { useState, useMemo } from 'react';
import { List, Tag, Button, Modal, Typography, Divider, Timeline, Form, Input, DatePicker, Upload, Space, Tabs, Card, Image, theme, Collapse, Popconfirm, Select, Carousel } from 'antd';
import { FileTextOutlined, PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, PaperClipOutlined, PictureOutlined, UploadOutlined, SolutionOutlined, CameraOutlined, UserOutlined as PersonIcon, CalendarOutlined, ProfileOutlined, LeftOutlined, RightOutlined, MinusCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNotification } from '../contexts/NotificationContext';
import { useSuppliers } from '../contexts/SupplierContext'; // 引入供应商列表
import { useNotices } from '../contexts/NoticeContext'; // 1. 导入 Hook
import { mockNoticesData, mockUsers, noticeCategories, categoryColumnConfig, noticeCategoryDetails } from '../data/_mockData'; // 1
const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;
const { Search } = Input;
const { Option } = Select;
// --- MOCK DATA AND HELPER FUNCTIONS ---

const normFile = (e) => { if (Array.isArray(e)) return e; return e && e.fileList; };
const getBase64 = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => resolve(reader.result); reader.onerror = (error) => reject(error); });

const NoticePage = () => {
    // --- 1. 所有的状态和 Hooks ---
    // const [notices, setNotices] = useState(mockNoticesData);
    const { notices, updateNotice } = useNotices();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedNotice, setSelectedNotice] = useState(null);
    const [form] = Form.useForm();
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState('');
    const [previewTitle, setPreviewTitle] = useState('');
    const { token } = theme.useToken();
    const { suppliers } = useSuppliers();
    const [searchTerm, setSearchTerm] = useState('');
    const { messageApi } = useNotification();
    const [rejectionModal, setRejectionModal] = useState({
        visible: false,
        notice: null,
        handler: null
    });
    const [activeCollapseKeys, setActiveCollapseKeys] = useState([]);
    const [rejectionForm] = Form.useForm();

    const [selectedCategories, setSelectedCategories] = useState([]);
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

    const [correctionModal, setCorrectionModal] = useState({ visible: false, notice: null });
    const [reassignForm] = Form.useForm();


    //动态显示根据不同的column
    const DynamicDetailsDisplay = ({ notice }) => {
        if (!notice.category || !notice.sdNotice.details) return null;

        // 从配置中心获取当前类别的专属列定义
        const config = categoryColumnConfig[notice.category] || [];
        // 过滤掉我们已经手动显示过的 title 和 description
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
                            {/* 从 sdNotice.details 中获取对应的值 */}
                            {notice.sdNotice.details[field.dataIndex]}
                        </Text>
                    ))}
                </Space>
            </>
        );
    };

    const userVisibleNotices = useMemo(() => {
        if (!currentUser) return [];
        switch (currentUser.role) {
            case 'Supplier': return notices.filter(n => n.assignedSupplierId === currentUser.id);
            case 'SD': return notices.filter(n => n.sdNotice.creatorId === currentUser.id);
            case 'Manager': return notices;
            default: return [];
        }
    }, [notices, currentUser]);

    const searchedNotices = useMemo(() => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
        if (!lowerCaseSearchTerm) return userVisibleNotices;
        return userVisibleNotices.filter(notice =>
            notice.title.toLowerCase().includes(lowerCaseSearchTerm) ||
            notice.assignedSupplierName.toLowerCase().includes(lowerCaseSearchTerm) ||
            notice.id.toLowerCase().includes(lowerCaseSearchTerm) ||
            (notice.category && notice.category.toLowerCase().includes(lowerCaseSearchTerm))

        );
    }, [searchTerm, userVisibleNotices]);

    const groupedNotices = useMemo(() => {
        const grouped = {};
        const singles = [];
        searchedNotices.forEach(notice => {
            if (notice.batchId) {
                if (!grouped[notice.batchId]) {
                    grouped[notice.batchId] = [];
                }
                grouped[notice.batchId].push(notice);
            } else {
                singles.push(notice);
            }
        });
        const batchItems = Object.values(grouped).map(batch => ({
            isBatch: true,
            batchId: batch[0].batchId,
            notices: batch,
            representative: batch[0],
        }));
        return [...batchItems, ...singles];
    }, [searchedNotices]);


    const AttachmentsDisplay = ({ attachments }) => {
        if (!attachments || attachments.length === 0) return null;
        return (
            <div style={{ marginTop: 12 }}>
                <Text strong><PaperClipOutlined /> 附件:</Text>
                <div style={{ marginTop: 8 }}>
                    <Space wrap>
                        {attachments.map((file, i) => (
                            <Button key={i} type="dashed" href={file.url} size="small" target="_blank" icon={<PaperClipOutlined />}>
                                {file.name}
                            </Button>
                        ))}
                    </Space>
                </div>
            </div>
        );
    };



    const ImageScroller = ({ images, title }) => {
        const [currentIndex, setCurrentIndex] = useState(0);

        if (!images || images.length === 0) return null;

        const goToPrevious = () => {
            const isFirstSlide = currentIndex === 0;
            const newIndex = isFirstSlide ? images.length - 1 : currentIndex - 1;
            setCurrentIndex(newIndex);
        };

        const goToNext = () => {
            const isLastSlide = currentIndex === images.length - 1;
            const newIndex = isLastSlide ? 0 : currentIndex + 1;
            setCurrentIndex(newIndex);
        };

        return (
            <div style={{ marginTop: 12 }}>
                <Text strong><PictureOutlined /> {title}:</Text>
                <div style={{ position: 'relative', marginTop: 8 }}>
                    <Image
                        height={250}
                        style={{ objectFit: 'contain', width: '100%', backgroundColor: '#f0f2f5', borderRadius: '8px' }}
                        src={images[currentIndex].url || images[currentIndex].thumbUrl}
                    />
                    {images.length > 1 && (
                        <>
                            {/* 左箭头 */}
                            <Button
                                shape="circle"
                                icon={<LeftOutlined />}
                                onClick={goToPrevious}
                                style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }}
                            />
                            {/* 右箭头 */}
                            <Button
                                shape="circle"
                                icon={<RightOutlined />}
                                onClick={goToNext}
                                style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)' }}
                            />
                            {/* 图片计数器 */}
                            <Tag style={{ position: 'absolute', bottom: 16, right: 16 }}>
                                {currentIndex + 1} / {images.length}
                            </Tag>
                        </>
                    )}
                </div>
            </div>
        );
    };

    // --- 2. 所有的处理函数 (Handlers) ---
    // 【关键修改】将所有处理函数移到这里，在 getActionsForItem 和子组件定义之前

    const showCorrectionModal = (notice) => {
        setCorrectionModal({ visible: true, notice });
    };
    const handleCorrectionCancel = () => {
        setCorrectionModal({ visible: false, notice: null });
        reassignForm.resetFields();
    };
    // const showDetailsModal = (notice) => { setSelectedNotice(notice); setIsModalVisible(true); };
    const showDetailsModal = (notice) => {
        const history = notice.history || [];
        const lastHistoryItem = history.length > 0 ? history[history.length - 1] : null;

        // 清空表單，防止數據污染
        form.resetFields();

        // 情況一：行動計劃被退回
        if (notice.status === '待供应商提交行动计划' && lastHistoryItem?.type === 'sd_plan_rejection') {
            const lastSubmission = [...history].reverse().find(h => h.type === 'supplier_plan_submission');
            if (lastSubmission && lastSubmission.actionPlans) {
                form.setFieldsValue({
                    actionPlans: lastSubmission.actionPlans.map(p => ({
                        ...p,
                        deadline: p.deadline ? dayjs(p.deadline) : null
                    }))
                });
            }
        }
        // 情況二：證據被退回
        else if (notice.status === '待供应商提交证据' && lastHistoryItem?.type === 'sd_evidence_rejection') {
            const lastSubmission = [...history].reverse().find(h => h.type === 'supplier_evidence_submission');
            if (lastSubmission) {
                form.setFieldsValue({
                    description: lastSubmission.description,
                    images: lastSubmission.images || [],
                    attachments: lastSubmission.attachments || []
                });
            }
        }

        setSelectedNotice(notice);
        setIsModalVisible(true);
    };

    const handleModalCancel = () => { setIsModalVisible(false); setSelectedNotice(null); form.resetFields(); };
    const handlePreview = async (file) => { if (!file.url && !file.preview) { file.preview = await getBase64(file.originFileObj); } setPreviewImage(file.url || file.preview); setPreviewOpen(true); setPreviewTitle(file.name || file.url.substring(file.url.lastIndexOf('/') + 1)); };
    const handlePreviewCancel = () => setPreviewOpen(false);
    const handleRejectionCancel = () => { rejectionForm.resetFields(); setRejectionModal({ visible: false, notice: null, handler: null }); };

    const handleSdPlanApprove = async (id, description = '计划已批准，请尽快执行。') => {
        const noticeId = id || selectedNotice.id;
        const currentNotice = notices.find(n => n.id === noticeId);
        if (!currentNotice) return;

        const newHistory = {
            type: 'sd_plan_approval',
            submitter: currentUser.name,
            time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            description
        };

        const updates = {
            status: '待供应商上传证据',
            history: currentNotice.history.concat(newHistory)
        };

        // 使用 await 等待中央更新方法执行完毕
        await updateNotice(noticeId, updates);

        messageApi.success('行动计划已批准！');

        if (isModalVisible && selectedNotice?.id === noticeId) {
            handleModalCancel();
        }
    };

    const handleSdEvidenceApprove = async (id, description = '证据审核通过，问题关闭。') => {
        const noticeId = id || selectedNotice.id;
        const currentNotice = notices.find(n => n.id === noticeId);
        if (!currentNotice) return;

        const newHistory = {
            type: 'sd_evidence_approval',
            submitter: currentUser.name,
            time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            description
        };

        const updates = {
            status: '已完成',
            history: currentNotice.history.concat(newHistory)
        };

        // 使用 await 等待，并确保参数顺序正确 (ID, 更新内容)
        await updateNotice(noticeId, updates);

        messageApi.success('证据审核通过，流程已完成！');

        if (isModalVisible && selectedNotice?.id === noticeId) {
            handleModalCancel();
        }
    };

    const handleSdPlanReject = async (values, id) => {
        const noticeId = id || selectedNotice.id;
        const currentNotice = notices.find(n => n.id === noticeId);
        if (!currentNotice) return;

        const newHistory = { type: 'sd_plan_rejection', submitter: currentUser.name, time: dayjs().format('YYYY-MM-DD HH:mm:ss'), description: `[计划被退回] ${values.rejectionReason}` };

        await updateNotice(noticeId, {
            status: '待供应商提交行动计划',
            history: currentNotice.history.concat(newHistory)
        });

        messageApi.warning('行动计划已退回！');
        if (isModalVisible && selectedNotice?.id === noticeId) handleModalCancel();
    };

    const handleSdEvidenceReject = async (values, id) => {
        const noticeId = id || selectedNotice.id;
        const currentNotice = notices.find(n => n.id === noticeId);
        if (!currentNotice) return;

        const newHistory = { type: 'sd_evidence_rejection', submitter: currentUser.name, time: dayjs().format('YYYY-MM-DD HH:mm:ss'), description: `[证据被退回] ${values.rejectionReason}` };

        await updateNotice(noticeId, {
            status: '待供应商上传证据',
            history: currentNotice.history.concat(newHistory)
        });

        messageApi.warning('证据审核不通过，已退回！');
        if (isModalVisible && selectedNotice?.id === noticeId) handleModalCancel();
    };

    const handlePlanSubmit = async (values) => {
        const currentNotice = selectedNotice;
        if (!currentNotice) return;

        const formattedActionPlans = (values.actionPlans || []).map(plan => ({
            ...plan,
            deadline: plan.deadline ? dayjs(plan.deadline).format('YYYY-MM-DD') : ''
        }));

        const newHistory = {
            type: 'supplier_plan_submission',
            submitter: currentUser.name,
            time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            actionPlans: formattedActionPlans,
            description: "提交了行动计划以供审核。"
        };

        await updateNotice(currentNotice.id, {
            status: '待SD审核行动计划', // 狀態變更為：待SD審核行動計劃
            history: currentNotice.history.concat(newHistory)
        });

        messageApi.success('行动计划提交成功！');
        handleModalCancel();
    };


    // --- 快捷操作相关的 Handler ---
    const handleQuickApprove = (notice) => {
        if (notice.status === '待SD审核行动计划') {
            handleSdPlanApprove(notice.id, `行动计划已批准`);
        } else if (notice.status === '待SD审核证据') {
            handleSdEvidenceApprove(notice.id, `证据审核通过，问题关闭`);
        }
    };

    // 找到 showRejectionModal 函数并替换为以下内容

    const showRejectionModal = (notice) => {
        let handler = null;

        // Only handle the rejection of a plan or evidence
        if (notice.status === '待SD审核行动计划') {
            handler = (values) => handleSdPlanReject(values, notice.id);
        } else if (notice.status === '待SD审核证据') {
            handler = (values) => handleSdEvidenceReject(values, notice.id);
        }

        setRejectionModal({ visible: true, notice, handler });
    };

    const handleRejectionSubmit = async () => {
        try {
            const values = await rejectionForm.validateFields();
            if (rejectionModal.handler) {
                rejectionModal.handler(values);
            }
            handleRejectionCancel();
        } catch (error) {
            console.log('Validate Failed:', error);
        }
    };

    const handleEvidenceSubmit = async (values) => {
        const currentNotice = selectedNotice;
        if (!currentNotice) return;

        const newHistory = {
            type: 'supplier_evidence_submission',
            submitter: currentUser.name,
            time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            description: values.description,
            images: values.images || [],
            attachments: values.attachments || []
        };

        await updateNotice(currentNotice.id, {
            status: '待SD审核证据',
            history: currentNotice.history.concat(newHistory)
        });

        messageApi.success('证据提交成功！');
        handleModalCancel();
    };

    const handleReassignment = async (values) => {
        const { newSupplierId } = values;
        const noticeToUpdate = correctionModal.notice;
        const newSupplier = suppliers.find(s => s.id === newSupplierId);

        if (!noticeToUpdate || !newSupplier) return;

        const newHistory = {
            type: 'manager_reassignment',
            submitter: currentUser.name,
            time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            description: `[管理操作] 将此通知从 ${noticeToUpdate.assignedSupplierName} 重新指派给 ${newSupplier.name}。`
        };

        await updateNotice(noticeToUpdate.id, {
            assignedSupplierId: newSupplier.id,
            assignedSupplierName: newSupplier.name,
            status: '待供应商提交行动计划', // 状态重置
            history: noticeToUpdate.history.concat(newHistory)
        });

        messageApi.success('通知单已成功重新指派！');
        handleCorrectionCancel();
    };

    const handleVoidNotice = async () => {
        const noticeToUpdate = correctionModal.notice;
        if (!noticeToUpdate) return;

        const newHistory = {
            type: 'manager_void',
            submitter: currentUser.name,
            time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            description: '[管理操作] 此通知单已被作废。'
        };

        await updateNotice(noticeToUpdate.id, {
            status: '已作废',
            history: noticeToUpdate.history.concat(newHistory)
        });

        messageApi.warning('通知单已作废！');
        handleCorrectionCancel();
    };


    // --- 3. 核心渲染逻辑与子组件 ---
    const getActionsForItem = (item) => {
        const actions = [];
        const isSDOrManager = currentUser && (currentUser.role === 'SD' || currentUser.role === 'Manager');
        const isManager = currentUser && currentUser.role === 'Manager';

        const stopPropagationAndRun = (e, func) => {
            e?.stopPropagation();
            func();
        };

        if (isSDOrManager && (item.status === '待SD审核行动计划' || item.status === '待SD审核证据')) {
            actions.push(
                <Popconfirm
                    key="approve" title="确定要通过吗?"
                    onConfirm={(e) => stopPropagationAndRun(e, () => handleQuickApprove(item))}
                    onCancel={(e) => e?.stopPropagation()}
                >
                    <Button type="link" onClick={(e) => e.stopPropagation()}>通过</Button>
                </Popconfirm>
            );
            actions.push(
                <Button key="reject" type="link" danger onClick={(e) => stopPropagationAndRun(e, () => showRejectionModal(item))}>
                    驳回
                </Button>
            );
        }
        if (isManager && item.status !== '已完成' && item.status !== '已作废') {
            actions.push(
                <Button key="correct" type="link" style={{ color: token.colorWarning }} onClick={(e) => {
                    e.stopPropagation();
                    showCorrectionModal(item);
                }}>
                    修正/撤回
                </Button>
            );
        }
        actions.push(
            <Button key="details" onClick={(e) => stopPropagationAndRun(e, () => showDetailsModal(item))}>
                查看详情
            </Button>
        );

        return actions;
    };



    const SingleNoticeItem = ({ item }) => {
        // 从配置中心查找当前类别的详细信息
        const categoryInfo = noticeCategoryDetails[item.category] || { id: 'N/A', color: 'default' };

        return (
            <List.Item actions={getActionsForItem(item)}>
                <List.Item.Meta
                    avatar={<FileTextOutlined style={{ fontSize: '24px', color: token.colorPrimary }} />}
                    title={<a onClick={() => showDetailsModal(item)}><Text strong>{item.title}</Text></a>}
                    description={`编号: ${item.id} | 指派给: ${item.assignedSupplierName}`}
                />
                <Space size="middle">
                    <Tag color={categoryInfo.color}>{item.category || '未分类'}</Tag>
                    <Tag color={item.status === '已完成' || item.status === '已作废' ? 'default' : item.status.includes('审核') ? 'warning' : 'processing'}>
                        {item.status}
                    </Tag>
                </Space>
            </List.Item>
        );
    };


    const NoticeBatchItem = ({ batch }) => (
        <List.Item style={{ display: 'block', padding: 0 }}>
            {/* --- 核心修正 2：将 Collapse 变为受控组件 --- */}
            <Collapse
                bordered={false}
                style={{ width: '100%', backgroundColor: token.colorBgLayout }}
                expandIconPosition="end"
                activeKey={activeCollapseKeys}
                onChange={(keys) => setActiveCollapseKeys(keys)}
            >
                <Collapse.Panel
                    key={batch.batchId}
                    header={
                        <List.Item.Meta
                            avatar={<ProfileOutlined style={{ fontSize: '24px', color: token.colorPrimary }} />}
                            title={<Text strong>{`批量任务 (共 ${batch.notices.length} 项)`}</Text>}
                            description={`来自: ${batch.representative.sdNotice.creator} | 创建于: ${batch.representative.sdNotice.createTime.split(' ')[0]}`}
                        />
                    }
                >
                    <List
                        dataSource={batch.notices}
                        renderItem={notice => <SingleNoticeItem item={notice} />}
                    />
                </Collapse.Panel>
            </Collapse>
        </List.Item>
    );

    const actionAreaStyle = {
        background: token.colorFillAlter,
        padding: '16px',
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
    };

    const PlanSubmissionForm = ({ onFinish }) => (
        <div style={actionAreaStyle}>
            <Title level={5}><SolutionOutlined /> 提交行动计划</Title>
            <Paragraph type="secondary">您可以添加多个行动项，并为每一项指定负责人和完成日期。</Paragraph>
            <Form form={form} layout="vertical" onFinish={onFinish} autoComplete="off">
                <Form.List name="actionPlans" initialValue={[{ plan: '', responsible: '', deadline: null }]}>
                    {(fields, { add, remove }) => (
                        <div style={{ display: 'flex', flexDirection: 'column', rowGap: 16 }}>
                            {fields.map(({ key, name, ...restField }) => (
                                <Card key={key} size="small"
                                    extra={<MinusCircleOutlined onClick={() => remove(name)} />}
                                >
                                    <Form.Item
                                        {...restField}
                                        name={[name, 'plan']}
                                        label="行动方案"
                                        rules={[{ required: true, message: '请输入行动方案' }]}
                                    >
                                        <TextArea rows={2} placeholder="具体的行动方案..." />
                                    </Form.Item>
                                    <Space wrap align="baseline">
                                        <Form.Item
                                            {...restField}
                                            name={[name, 'responsible']}
                                            label="负责人"
                                            rules={[{ required: true, message: '请输入负责人' }]}
                                        >
                                            <Input placeholder="负责人姓名" />
                                        </Form.Item>
                                        <Form.Item
                                            {...restField}
                                            name={[name, 'deadline']}
                                            label="完成日期"
                                            rules={[{ required: true, message: '请选择日期' }]}
                                        >
                                            <DatePicker />
                                        </Form.Item>
                                    </Space>
                                </Card>
                            ))}
                            <Form.Item>
                                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                    添加行动项
                                </Button>
                            </Form.Item>
                        </div>
                    )}
                </Form.List>
                <Form.Item style={{ marginTop: 24 }}>
                    <Button type="primary" htmlType="submit">提交所有计划</Button>
                </Form.Item>
            </Form>
        </div>
    );

    const EvidenceSubmissionForm = ({ onFinish }) => (<div style={actionAreaStyle}><Title level={5}><CameraOutlined /> 上传完成证据</Title><Form form={form} layout="vertical" onFinish={onFinish}><Form.Item name="description" label="完成情况说明"><TextArea rows={3} placeholder="可以补充说明完成情况..." /></Form.Item><Form.Item name="images" label="上传图片证据" valuePropName="fileList" getValueFromEvent={normFile} rules={[{ required: true, message: '请至少上传一张图片作为证据' }]}><Upload listType="picture-card" beforeUpload={() => false} onPreview={handlePreview} accept="image/*"><div><PlusOutlined /><div style={{ marginTop: 8 }}>上传</div></div></Upload></Form.Item><Form.Item name="attachments" label="上传附件 (可选)" valuePropName="fileList" getValueFromEvent={normFile}><Upload beforeUpload={() => false} multiple><Button icon={<UploadOutlined />}>点击上传附件</Button></Upload></Form.Item><Form.Item><Button type="primary" htmlType="submit">提交证据</Button></Form.Item></Form></div>);

    const ApprovalArea = ({ onApprove, title, notice }) => (
        <div style={actionAreaStyle}>
            <Title level={5}>{title}</Title>
            <Space direction="vertical" style={{ width: '100%' }}>
                <Button type="primary" icon={<CheckCircleOutlined />} style={{ width: '100%' }} onClick={onApprove}>
                    审核通过
                </Button>
                <Divider style={{ margin: '8px 0' }}>或</Divider>
                <Button danger icon={<CloseCircleOutlined />} style={{ width: '100%' }} onClick={() => showRejectionModal(notice)}>
                    退回供应商
                </Button>
            </Space>
        </div>
    );

    const renderActionArea = () => {
        if (!selectedNotice || !currentUser) return null;

        const isAssignedSupplier = currentUser.role === 'Supplier' && currentUser.id === selectedNotice.assignedSupplierId;
        const isSDOrManager = currentUser.role === 'SD' || currentUser.role === 'Manager';

        switch (selectedNotice.status) {
            // 阶段一：供应商提交行动计划 (使用简体中文)
            case '待供应商提交行动计划':
                return isAssignedSupplier && <PlanSubmissionForm onFinish={handlePlanSubmit} />;

            // 阶段二：SD 审核行动计划 (使用简体中文)
            case '待SD审核行动计划':
                return isSDOrManager && <ApprovalArea onApprove={() => handleSdPlanApprove()} title="审核行动计划" notice={selectedNotice} />;

            // 阶段三：供应商上传完成证据 (使用简体中文)
            case '待供应商上传证据':
                return isAssignedSupplier && <EvidenceSubmissionForm onFinish={handleEvidenceSubmit} />;

            // 阶段四：SD 审核完成证据 (使用简体中文)
            case '待SD审核证据':
                return isSDOrManager && <ApprovalArea onApprove={() => handleSdEvidenceApprove()} title="审核完成证据" notice={selectedNotice} />;

            // 其他状态不显示操作区
            default:
                return null;
        }
    };
    const renderNoticeList = (data) => (
        <List
            dataSource={data}
            renderItem={item => (
                item.isBatch
                    ? <NoticeBatchItem batch={item} />
                    : <SingleNoticeItem item={item} />
            )}
            locale={{ emptyText: '暂无相关通知单' }}
        />
    );

    const getHistoryItemDetails = (historyItem) => {
        switch (historyItem.type) {
            // CORRECTED: Use 'supplier_plan_submission'
            case 'supplier_plan_submission':
                return { color: 'blue', text: '提交了行动计划' };

            // This one is correct
            case 'supplier_evidence_submission':
                return { color: 'blue', text: '提交了完成证据' };

            case 'sd_plan_approval':
                return { color: 'green', text: '批准了行动计划' };
            case 'sd_plan_rejection':
                return { color: 'red', text: '退回了行动计划' };
            case 'sd_evidence_approval':
                return { color: 'green', text: '审核通过了证据' };
            case 'sd_evidence_rejection':
                return { color: 'red', text: '退回了提交的证据' };
            case 'manager_reassignment':
                return { color: 'orange', text: '重分配了供应商' };
            case 'manager_void':
                return { color: 'black', text: '作废了通知单' };
            default:
                return { color: 'grey', text: '执行了未知操作' };
        }
    };

    const renderTabs = () => {
        if (!currentUser) return <p>请先登录</p>;
        const tabsConfig = {
            Supplier: [{ key: 'pending', label: '待我处理', statuses: ['待供应商提交行动计划', '待供应商上传证据'] }, { key: 'review', label: '等待审核', statuses: ['待SD审核行动计划', '待SD审核证据'] }, { key: 'completed', label: '已完成', statuses: ['已完成'] },],
            SD: [{ key: 'review', label: '待我审核', statuses: ['待SD审核行动计划', '待SD审核证据'] }, { key: 'pending', label: '待供应商处理', statuses: ['待供应商提交行动计划', '待供应商上传证据'] }, { key: 'completed', label: '已完成', statuses: ['已完成'] },],
            Manager: [{ key: 'all', label: '所有单据', statuses: ['待供应商提交行动计划', '待SD审核行动计划', '待供应商上传证据', '待SD审核证据', '已完成'] }, { key: 'review', label: '待审核', statuses: ['待SD审核行动计划', '待SD审核证据'] }, { key: 'pending', label: '待供应商处理', statuses: ['待供应商提交行动计划', '待供应商上传证据'] }, { key: 'completed', label: '已完成', statuses: ['已完成'] },]
        };
        const userTabs = tabsConfig[currentUser.role];
        return (
            <Tabs defaultActiveKey={userTabs[0].key} type="card">
                {userTabs.map(tab => {
                    const filteredData = searchedNotices.filter(n => tab.statuses.includes(n.status));
                    return (<TabPane tab={`${tab.label} (${filteredData.length})`} key={tab.key}>
                        {renderNoticeList(groupedNotices.filter(g =>
                            g.isBatch
                                ? g.notices.some(n => tab.statuses.includes(n.status))
                                : tab.statuses.includes(g.status)
                        ))}
                    </TabPane>);
                })}
            </Tabs>
        );
    };

    // --- 4. 主渲染 JSX ---
    return (
        <div style={{ padding: '24px', background: token.colorBgLayout }}>
            <Card style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div><Title level={4} style={{ margin: 0 }}>整改通知单</Title><Paragraph type="secondary" style={{ margin: 0, marginTop: '4px' }}>{currentUser?.role === 'Supplier' ? '处理分配给您的所有整改任务。' : '审核和管理所有整改通知。'}</Paragraph></div>
                    <Search placeholder="搜索标题、编号、供应商、种类..." allowClear onSearch={value => setSearchTerm(value)} onChange={e => setSearchTerm(e.target.value)} style={{ width: 300 }} />
                </div>
            </Card>
            <Card>
                {renderTabs()}
            </Card>
            <Modal
                title={`修正/撤回通知单: ${correctionModal.notice?.title || ''}`}
                open={correctionModal.visible}
                onCancel={handleCorrectionCancel}
                footer={null} // 自定义页脚
            >
                <Title level={5}>重新指派给其他供应商</Title>
                <Paragraph type="secondary">如果此通知单指派错误，您可以在此将其分配给正确的供应商，流程将为新供应商重新开始。</Paragraph>
                <Form form={reassignForm} layout="inline" onFinish={handleReassignment}>
                    <Form.Item name="newSupplierId" rules={[{ required: true, message: '请选择供应商' }]} style={{ flex: 1 }}>
                        <Select placeholder="选择一个新的供应商">
                            {suppliers
                                .filter(s => s.id !== correctionModal.notice?.assignedSupplierId) // 过滤掉当前供应商
                                .map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)
                            }
                        </Select>
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit">确认重派</Button>
                    </Form.Item>
                </Form>
                <Divider>或</Divider>
                <Title level={5}>作废此通知单</Title>
                <Paragraph type="secondary">如果此通知单完全错误或不再需要，可以将其作废。此操作不可逆。</Paragraph>
                <Popconfirm
                    title="确定要作废这个通知单吗？"
                    description="作废后将无法进行任何操作。"
                    onConfirm={handleVoidNotice}
                    okText="确认作废"
                    cancelText="取消"
                >
                    <Button type="primary" danger>作废此通知单</Button>
                </Popconfirm>
            </Modal>

            {selectedNotice && (
                <Modal title={`通知单详情: ${selectedNotice.title}`} open={isModalVisible} onCancel={handleModalCancel} footer={null} width={800}>
                    <Title level={5} style={{ marginTop: 24 }}>初始通知内容</Title>
                    <Card size="small" type="inner">
                        <Paragraph><strong>问题描述:</strong> {selectedNotice.sdNotice.description}</Paragraph>

                        <DynamicDetailsDisplay notice={selectedNotice} />
                        <ImageScroller images={selectedNotice.sdNotice.images} title="初始图片" />
                        <AttachmentsDisplay attachments={selectedNotice.sdNotice.attachments} />

                        <Divider style={{ margin: '12px 0' }} />
                        <Text type="secondary">由 {selectedNotice.sdNotice.creator} 于 {selectedNotice.sdNotice.createTime} 发起</Text>
                    </Card>
                    <Divider />
                    <Title level={5}>处理历史</Title>
                    <Timeline>
                        <Timeline.Item color="green">
                            <p><b>{selectedNotice.sdNotice.creator}</b> 发起了通知</p>
                            <small>{selectedNotice.sdNotice.createTime}</small>
                        </Timeline.Item>
                        {selectedNotice.history.map((h, index) => {
                            const details = getHistoryItemDetails(h);

                            const hasCardContent = h.description ||
                                (h.actionPlans && h.actionPlans.length > 0) ||
                                (h.images && h.images.length > 0) ||
                                (h.attachments && h.attachments.length > 0);

                            return (
                                <Timeline.Item key={index} color={details.color}>
                                    <p><b>{h.submitter}</b> {details.text}</p>

                                    {hasCardContent && (
                                        <Card size="small" type="inner" style={{ marginTop: 8 }}>
                                            {/* 显示描述信息 */}
                                            {h.description && <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{h.description}</Paragraph>}

                                            {/* 核心修正: 将类型判断从 'supplier_submission' 改为 'supplier_plan_submission' 
                    */}
                                            {h.type === 'supplier_plan_submission' && h.actionPlans && h.actionPlans.length > 0 && (
                                                <>
                                                    <Divider style={{ margin: '12px 0' }} />
                                                    <List
                                                        size="small"
                                                        header={<Text strong>行动计划:</Text>}
                                                        dataSource={h.actionPlans}
                                                        renderItem={(planItem, idx) => (
                                                            <List.Item>
                                                                <div>
                                                                    {/* 1. 行动方案 */}
                                                                    <Text strong>{idx + 1}. {planItem.plan}</Text><br />
                                                                    <Text type="secondary" style={{ marginLeft: '18px' }}>
                                                                        {/* 2. 负责人 */}
                                                                        <PersonIcon style={{ marginRight: 8 }} />{planItem.responsible}
                                                                        <Divider type="vertical" />
                                                                        {/* 3. 完成时间 */}
                                                                        <CalendarOutlined style={{ marginRight: 8 }} />{planItem.deadline}
                                                                    </Text>
                                                                </div>
                                                            </List.Item>
                                                        )}
                                                    />
                                                </>
                                            )}

                                            {/* 显示提交的图片 */}
                                            <ImageScroller images={h.images} title="提交的图片" />

                                            {/* 显示提交的附件 */}
                                            <AttachmentsDisplay attachments={h.attachments} />
                                        </Card>
                                    )}
                                    <small>{h.time}</small>
                                </Timeline.Item>
                            );
                        })}
                        {selectedNotice.status === '已完成' && (
                            <Timeline.Item color="green"><b>流程已完成</b></Timeline.Item>
                        )}
                    </Timeline>
                    <Divider />
                    {renderActionArea()}
                </Modal>
            )}

            <Modal
                title={`退回通知单: ${rejectionModal.notice?.title || ''}`}
                open={rejectionModal.visible}
                onOk={handleRejectionSubmit}
                onCancel={handleRejectionCancel}
                okText="确认退回"
                cancelText="取消"
                destroyOnClose
            >
                <Form form={rejectionForm} layout="vertical" name="rejection_form">
                    <Form.Item
                        name="rejectionReason"
                        label="退回原因"
                        rules={[{ required: true, message: '请填写详细的退回原因！' }]}
                    >
                        <TextArea rows={4} placeholder="请详细说明不通过的原因，以便供应商能清晰地进行下一步整改..." />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal open={previewOpen} title={previewTitle} footer={null} onCancel={handlePreviewCancel}>
                <img alt="预览" style={{ width: '100%' }} src={previewImage} />
            </Modal>
        </div>
    );
};

export default NoticePage;