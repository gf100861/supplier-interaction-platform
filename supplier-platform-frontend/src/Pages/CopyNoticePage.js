import React, { useState, useMemo } from 'react';
import { List, Tag, Button, Modal, Typography, Divider, Timeline, Form, Input, DatePicker, Upload, Space, Tabs, Card, Image, theme, Collapse } from 'antd';
import { FileTextOutlined, PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, PaperClipOutlined, PictureOutlined, UploadOutlined, SolutionOutlined, CameraOutlined, UserOutlined as PersonIcon, CalendarOutlined, MailOutlined } from '@ant-design/icons';

import { useNotification } from '../contexts/NotificationContext'; 
const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;
const { Search } = Input;

// --- MOCK DATA AND HELPER FUNCTIONS ---
// CHANGED: Added '待SD审核证据' status to mock data for testing
const mockNoticesData = [
    { id: 'N-20250815-001', title: '现场物料堆放不规范问题', assignedSupplierId: 'sup_A', assignedSupplierName: '供应商A', status: '待供应商提交行动计划', sdNotice: { creatorId: 'sd_01', description: '现场抽检发现，A类物料未按规定分区堆放，存在混料风险。请提供整改行动计划。', creator: 'SD (Philip Wang)', createTime: '2025-08-15 10:00:00' }, history: [] },
    { id: 'N-20250815-002', title: '产品包装有破损', assignedSupplierId: 'sup_B', assignedSupplierName: '供应商B', status: '待SD审核行动计划', sdNotice: { creatorId: 'sd_01', description: '入库检验时发现批次号 [P20250814] 的产品外包装有明显破损，请先提交处理计划。', creator: 'SD (Philip Wang)', createTime: '2025-08-14 14:00:00' }, history: [{ type: 'supplier_plan_submission', submitter: '供应商B (John Doe)', time: '2025-08-15 09:00:00', description: '行动计划如下：\n1. 立即隔离所有包装破损产品，进行内部评审。\n2. 追溯运输过程，排查原因。\n3. 预计2个工作日内完成评审并给出最终处置报告。' }] },
    { id: 'N-20250815-003', title: '资质文件过期提醒', assignedSupplierId: 'sup_A', assignedSupplierName: '供应商A', status: '待供应商上传证据', sdNotice: { creatorId: 'sd_01', description: '系统检测到贵司的ISO9001认证即将在30天后过期，请尽快更新并上传新证书。', creator: 'SD (Philip Wang)', createTime: '2025-08-12 16:00:00' }, history: [{ type: 'supplier_plan_submission', submitter: '供应商A (Jane Smith)', time: '2025-08-13 11:00:00', description: '计划在本周内完成年度审核并获取新证书。' }, { type: 'sd_plan_approval', submitter: 'SD (Philip Wang)', time: '2025-08-13 14:00:00', description: '计划已批准，请在获取新证书后立即上传。' }] },
    // NEW: Added a new notice with the status '待SD审核证据'
    { id: 'N-20250815-005', title: '生产车间5S问题', assignedSupplierId: 'sup_B', assignedSupplierName: '供应商B', status: '待SD审核证据', sdNotice: { creatorId: 'sd_01', description: '生产车间地面有油污，工具摆放混乱，请立即整改。', creator: 'SD (Philip Wang)', createTime: '2025-08-16 09:00:00' }, history: [{ type: 'supplier_plan_submission', submitter: '供应商B (John Doe)', time: '2025-08-16 10:00:00', description: '立即清理，重新规划工具区。' }, { type: 'sd_plan_approval', submitter: 'SD (Philip Wang)', time: '2025-08-16 11:00:00', description: '同意，完成后上传照片。' }, { type: 'supplier_evidence_submission', submitter: '供应商B (John Doe)', time: '2025-08-16 14:00:00', description: '已清理完毕，请审核。', images: [{ uid: '-2', name: '5s_clean.png', url: 'https://gw.alipayobjects.com/zos/rmsportal/mqaQswcyDLcXyDKnZfES.png' }] }] },
    { id: 'N-20250815-004', title: '安全出口通道堵塞', assignedSupplierId: 'sup_A', assignedSupplierName: '供应商A', status: '已完成', sdNotice: { creatorId: 'sd_01', description: '巡检发现仓库#3的安全出口通道被杂物堵塞，严重违反安全规定，请立即整改。', creator: 'SD (Philip Wang)', createTime: '2025-08-10 09:00:00' }, history: [{ type: 'supplier_plan_submission', submitter: '供应商A (Jane Smith)', time: '2025-08-10 10:00:00', description: '立即安排人员清理，预计1小时内完成。' }, { type: 'sd_plan_approval', submitter: 'SD (Philip Wang)', time: '2025-08-10 10:30:00', description: '同意计划，请完成后拍照上传作为证据。' }, { type: 'supplier_evidence_submission', submitter: '供应商A (Jane Smith)', time: '2025-08-10 11:15:00', description: '通道已清理完毕，现场照片见附件。', images: [{ uid: '-1', name: 'cleanup.png', url: 'https://gw.alipayobjects.com/zos/antfincdn/LlvErxo8H9/photo-1503185912284-5271ff81b9a8.jpeg' }] }, { type: 'sd_evidence_approval', submitter: 'SD (Philip Wang)', time: '2025-08-10 12:00:00', description: '证据审核通过，问题关闭。' }] },
];


const normFile = (e) => { if (Array.isArray(e)) return e; return e && e.fileList; };
const getBase64 = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => resolve(reader.result); reader.onerror = (error) => reject(error); });


const NoticePage = () => {
    const [notices, setNotices] = useState(mockNoticesData);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedNotice, setSelectedNotice] = useState(null);
    const [form] = Form.useForm();
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState('');
    const [previewTitle, setPreviewTitle] = useState('');
    const { token } = theme.useToken();
    const [searchTerm, setSearchTerm] = useState('');
    const [isSendingEmail, setIsSendingEmail] = useState(false); // 新增 state 用于按钮加载状态
    const { messageApi } = useNotification();


    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);
    

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
            notice.id.toLowerCase().includes(lowerCaseSearchTerm)
        );
    }, [searchTerm, userVisibleNotices]);

    // --- HANDLER FUNCTIONS ---
    const showDetailsModal = (notice) => { setSelectedNotice(notice); setIsModalVisible(true); };
    const handleModalCancel = () => { setIsModalVisible(false); setSelectedNotice(null); form.resetFields(); };
    const handlePreview = async (file) => { if (!file.url && !file.preview) { file.preview = await getBase64(file.originFileObj); } setPreviewImage(file.url || file.preview); setPreviewOpen(true); setPreviewTitle(file.name || file.url.substring(file.url.lastIndexOf('/') + 1)); };
    const handlePreviewCancel = () => setPreviewOpen(false);

    // Plan submission
    const handlePlanSubmit = (values) => {
        const newHistory = {
            type: 'supplier_plan_submission',
            submitter: currentUser.name,
            time: new Date().toLocaleString(),
            description: values.actionPlan,
            // NEW: 保存新字段的值
            responsible: values.responsiblePerson,
            deadline: values.expectedDate.format('YYYY-MM-DD'), // 使用 dayjs 格式化日期
        };
        const newNotices = notices.map(n => n.id === selectedNotice.id ? { ...n, status: '待SD审核行动计划', history: [...n.history, newHistory] } : n);
        setNotices(newNotices);
        messageApi.success('行动计划提交成功！'); // <-- 修改success('行动计划提交成功！');
        handleModalCancel();
    };

    // Plan approval
    const handleSdPlanApprove = () => {
        const newHistory = { type: 'sd_plan_approval', submitter: currentUser.name, time: new Date().toLocaleString(), description: '行动计划已批准，请按计划执行并提交证据。' };
        const newNotices = notices.map(n => n.id === selectedNotice.id ? { ...n, status: '待供应商上传证据', history: [...n.history, newHistory] } : n);
        setNotices(newNotices); messageApi.success('行动计划已批准！'); handleModalCancel();
    };
    const handleSdPlanReject = (values) => {
        const newHistory = { type: 'sd_plan_rejection', submitter: currentUser.name, time: new Date().toLocaleString(), description: `[计划被退回] ${values.rejectionReason}` };
        const newNotices = notices.map(n => n.id === selectedNotice.id ? { ...n, status: '待供应商提交行动计划', history: [...n.history, newHistory] } : n);
        setNotices(newNotices); messageApi.warning('行动计划已退回！'); handleModalCancel();
    };

    // Evidence submission
    const handleEvidenceSubmit = (values) => {
        const newHistory = { type: 'supplier_evidence_submission', submitter: currentUser.name, time: new Date().toLocaleString(), description: values.description, images: values.images || [], attachments: values.attachments || [] };
        // THIS IS A KEY CHANGE: Status now becomes '待SD审核证据'
        const newNotices = notices.map(n => n.id === selectedNotice.id ? { ...n, status: '待SD审核证据', history: [...n.history, newHistory] } : n);
        setNotices(newNotices); messageApi.success('证据提交成功！'); handleModalCancel();
    };

    // Evidence approval
    const handleSdEvidenceApprove = () => {
        const newHistory = { type: 'sd_evidence_approval', submitter: currentUser.name, time: new Date().toLocaleString(), description: '证据审核通过，此通知单已完成。' };
        const newNotices = notices.map(n => n.id === selectedNotice.id ? { ...n, status: '已完成', history: [...n.history, newHistory] } : n);
        setNotices(newNotices); messageApi.success('审核通过，此通知单已完成！'); handleModalCancel();
    };
    const handleSdEvidenceReject = (values) => {
        const newHistory = { type: 'sd_evidence_rejection', submitter: currentUser.name, time: new Date().toLocaleString(), description: `[证据被退回] ${values.rejectionReason}` };
        // This sends the supplier back to the 'upload evidence' step
        const newNotices = notices.map(n => n.id === selectedNotice.id ? { ...n, status: '待供应商上传证据', history: [...n.history, newHistory] } : n);
        setNotices(newNotices); messageApi.warning('证据已退回！'); handleModalCancel();
    };

    // --- STYLING ---
    const actionAreaStyle = {
        background: token.colorFillAlter,
        padding: '16px',
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
    };

    // --- MODULAR ACTION COMPONENTS ---
    const PlanSubmissionForm = ({ onFinish }) => (
        <div style={actionAreaStyle}>
            <Title level={5}><SolutionOutlined /> 提交行动计划</Title>
            <Form form={form} layout="vertical" onFinish={onFinish}>
                {/* NEW: 负责人字段 */}
                <Form.Item name="responsiblePerson" label="负责人" rules={[{ required: true, message: '请填写负责人姓名' }]}>
                    <Input prefix={<PersonIcon />} placeholder="请输入负责人姓名" />
                </Form.Item>

                {/* NEW: 预计截止日期字段 */}
                <Form.Item name="expectedDate" label="预计完成日期" rules={[{ required: true, message: '请选择一个日期' }]}>
                    <DatePicker style={{ width: '100%' }} placeholder="请选择日期" />
                </Form.Item>

                {/* 原有的行动计划说明 */}
                <Form.Item name="actionPlan" label="行动计划说明" rules={[{ required: true, message: '请填写详细的行动计划' }]}>
                    <TextArea rows={4} placeholder="请详细描述您将采取的步骤、负责人和预计完成时间..." />
                </Form.Item>

                <Form.Item><Button type="primary" htmlType="submit">提交计划</Button></Form.Item>
            </Form>
        </div>
    );
    const EvidenceSubmissionForm = ({ onFinish }) => (<div style={actionAreaStyle}><Title level={5}><CameraOutlined /> 上传完成证据</Title><Form form={form} layout="vertical" onFinish={onFinish}><Form.Item name="description" label="完成情况说明"><TextArea rows={3} placeholder="可以补充说明完成情况..." /></Form.Item><Form.Item name="images" label="上传图片证据" valuePropName="fileList" getValueFromEvent={normFile} rules={[{ required: true, message: '请至少上传一张图片作为证据' }]}><Upload listType="picture-card" beforeUpload={() => false} onPreview={handlePreview} accept="image/*"><div><PlusOutlined /><div style={{ marginTop: 8 }}>上传</div></div></Upload></Form.Item><Form.Item name="attachments" label="上传附件 (可选)" valuePropName="fileList" getValueFromEvent={normFile}><Upload beforeUpload={() => false} multiple><Button icon={<UploadOutlined />}>点击上传附件</Button></Upload></Form.Item><Form.Item><Button type="primary" htmlType="submit">提交证据</Button></Form.Item></Form></div>);
    const ApprovalArea = ({ onApprove, onReject, title }) => (<div style={actionAreaStyle}><Title level={5}>{title}</Title><Space direction="vertical" style={{ width: '100%' }}><Button type="primary" icon={<CheckCircleOutlined />} style={{ width: '100%' }} onClick={onApprove}>审核通过</Button><Divider style={{ margin: '8px 0' }}>或</Divider><Form form={form} layout="vertical" onFinish={onReject}><Form.Item name="rejectionReason" label="退回原因" rules={[{ required: true, message: '请填写退回原因' }]}><TextArea rows={2} placeholder="请详细说明不通过的原因，以便供应商整改..." /></Form.Item><Form.Item><Button danger icon={<CloseCircleOutlined />} htmlType="submit" style={{ width: '100%' }}>退回供应商</Button></Form.Item></Form></Space></div>);

   
    // THIS IS THE MAIN LOGIC CHANGE
    const renderActionArea = () => {
        if (!selectedNotice || !currentUser) return null;

        const isAssignedSupplier = currentUser.role === 'Supplier' && currentUser.id === selectedNotice.assignedSupplierId;
        const isSDOrManager = (currentUser.role === 'SD' && currentUser.id === selectedNotice.sdNotice.creatorId) || currentUser.role === 'Manager';

        switch (selectedNotice.status) {
            case '待供应商提交行动计划':
                return isAssignedSupplier && <PlanSubmissionForm onFinish={handlePlanSubmit} />;

            case '待SD审核行动计划':
                return isSDOrManager && <ApprovalArea onApprove={handleSdPlanApprove} onReject={handleSdPlanReject} title="审核行动计划" />;

            case '待供应商上传证据':
                return isAssignedSupplier && <EvidenceSubmissionForm onFinish={handleEvidenceSubmit} />;

            // THIS CASE WAS ADDED
            case '待SD审核证据':
                return isSDOrManager && <ApprovalArea onApprove={handleSdEvidenceApprove} onReject={handleSdEvidenceReject} title="审核完成证据" />;

            // NEW: 为“已完成”状态添加新操作
            case '已完成':
                if (isSDOrManager) {
                    return (
                        <div style={actionAreaStyle}>
                            <Title level={5}>后续操作</Title>
                            <Paragraph type="secondary">此通知单已关闭。您可以选择发送一封完成通知邮件给供应商。</Paragraph>
                          
                        </div>
                    );
                }
                return null; // 供应商在已完成状态下看不到任何操作

            default:
                return null;
        }
    };

    // --- RENDERING FUNCTIONS ---
    const renderNoticeList = (data) => (<List dataSource={data} renderItem={item => (<List.Item actions={[<Button onClick={() => showDetailsModal(item)}>查看详情</Button>]}> <List.Item.Meta avatar={<FileTextOutlined style={{ fontSize: '24px', color: token.colorPrimary }} />} title={<Text strong>{item.title}</Text>} description={`编号: ${item.id} | 指派给: ${item.assignedSupplierName}`} /> <Tag color={item.status === '已完成' ? 'success' : item.status.includes('审核') ? 'warning' : 'processing'}>{item.status}</Tag> </List.Item>)} locale={{ emptyText: '暂无相关通知单' }} />);

    const renderTabs = () => {
        if (!currentUser) return <p>请先登录</p>;
        // ANOTHER KEY CHANGE: Added '待SD审核证据' to the tabs config
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
                    return (<TabPane tab={`${tab.label} (${filteredData.length})`} key={tab.key}>{renderNoticeList(filteredData)}</TabPane>);
                })}
            </Tabs>
        );
    };

    const getHistoryItemDetails = (historyItem) => {
        switch (historyItem.type) {
            case 'supplier_plan_submission': return { color: 'blue', text: '提交了行动计划' };
            case 'sd_plan_approval': return { color: 'green', text: '批准了行动计划' };
            case 'sd_plan_rejection': return { color: 'red', text: '退回了行动计划' };
            case 'supplier_evidence_submission': return { color: 'blue', text: '提交了完成证据' };
            case 'sd_evidence_approval': return { color: 'green', text: '审核通过了证据' };
            case 'sd_evidence_rejection': return { color: 'red', text: '退回了提交的证据' };
            default: return { color: 'grey', text: '执行了未知操作' };
        }
    };

    return (
        <div style={{ padding: '24px', background: token.colorBgLayout }}>
            <Card style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div><Title level={4} style={{ margin: 0 }}>整改通知单</Title><Paragraph type="secondary" style={{ margin: 0, marginTop: '4px' }}>{currentUser?.role === 'Supplier' ? '处理分配给您的所有整改任务。' : '审核和管理所有整改通知。'}</Paragraph></div>
                    <Search placeholder="搜索标题、编号、供应商..." allowClear onSearch={value => setSearchTerm(value)} onChange={e => setSearchTerm(e.target.value)} style={{ width: 300 }} />
                </div>
            </Card>
            <Card>
                {renderTabs()}
            </Card>

            {selectedNotice && (
                <Modal title={`通知单详情: ${selectedNotice.title}`} open={isModalVisible} onCancel={handleModalCancel} footer={null} width={800}>
                    <Title level={5} style={{ marginTop: 24 }}>初始通知内容</Title>
                    <Card size="small" type="inner"><Paragraph><strong>问题描述:</strong> {selectedNotice.sdNotice.description}</Paragraph><Text type="secondary">由 {selectedNotice.sdNotice.creator} 于 {selectedNotice.sdNotice.createTime} 发起</Text></Card>
                    <Divider />
                    <Title level={5}>处理历史</Title>
                    <Timeline>
                        <Timeline.Item color="green"><p><b>{selectedNotice.sdNotice.creator}</b> 发起了通知</p><small>{selectedNotice.sdNotice.createTime}</small></Timeline.Item>
                        {selectedNotice.history.map((h, index) => {
                            const details = getHistoryItemDetails(h);
                         return (
                                <Timeline.Item key={index} color={details.color}>
                                    <p><b>{h.submitter}</b> {details.text}</p>
                                    { (h.description || h.images || h.attachments) && (
                                         <Card size="small" type="inner" style={{marginTop: 8}}>
              
                                            {/* 1. 如果有描述，只在这里显示一次 */}
                                            {h.description && <Paragraph style={{whiteSpace: 'pre-wrap', margin: 0}}>{h.description}</Paragraph>}
                                            
                                            {/* 2. 如果是行动计划，显示额外信息 */}
                                            {h.type === 'supplier_plan_submission' && h.responsible && h.deadline && (
                                                <>
                                                    <Divider style={{ margin: '12px 0' }} />
                                                    <Space direction="vertical" size="small">
                                                        <Text><PersonIcon style={{ marginRight: 8, color: token.colorPrimary }} /><Text strong>负责人: </Text>{h.responsible}</Text>
                                                        <Text><CalendarOutlined style={{ marginRight: 8, color: token.colorPrimary }} /><Text strong>预计完成日期: </Text><Text type="danger">{h.deadline}</Text></Text>
                                                    </Space>
                                                </>
                                            )}
                                            
                                            {/* 3. 如果有图片，显示图片 */}
                                            {h.images && h.images.length > 0 && (<div style={{ marginTop: 8 }}><Text strong><PictureOutlined /> 提交的图片:</Text><br /><Image.PreviewGroup>{h.images.map((img, i) => (<Image key={i} width={80} height={80} src={img.url || img.thumbUrl} style={{ objectFit: 'cover', marginRight: 8, marginTop: 4, borderRadius: 4 }} />))}</Image.PreviewGroup></div>)}
                                            
                                            {/* 4. 如果有附件，显示附件 */}
                                            {h.attachments && h.attachments.length > 0 && (<div style={{ marginTop: 8 }}><Text strong><PaperClipOutlined /> 提交的附件:</Text><br />{h.attachments.map((file, i) => (<Button key={i} type="link" href={file.url} size="small" target="_blank" icon={<PaperClipOutlined />}>{file.name}</Button>))}</div>)}
                                        </Card>
                                    )}
                                    <small>{h.time}</small>
                                </Timeline.Item>
                            );
                        })}
                        {selectedNotice.status === '已完成' && (<Timeline.Item color="green"><b>流程已完成</b></Timeline.Item>)}
                    </Timeline>
                    <Divider />
                    {renderActionArea()}
                </Modal>
            )}

            <Modal open={previewOpen} title={previewTitle} footer={null} onCancel={handlePreviewCancel}><img alt="预览" style={{ width: '100%' }} src={previewImage} /></Modal>
        </div>
    );
};

export default NoticePage;