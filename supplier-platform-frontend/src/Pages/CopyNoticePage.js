import React, { useState, useMemo, useEffect } from 'react';
import { Card, Typography, Input, Tabs, Form, Modal, Popconfirm, theme, Spin, List, Button, Space, Select, Divider } from 'antd';
import dayjs from 'dayjs';
import { useLocation, useNavigate } from 'react-router-dom';

// 1. 导入所有需要的组件、Hooks 和数据
import { NoticeList } from '../Components/notice/NoticeList';
import { RejectionModal } from '../Components/notice/RejectionModal';
import { CorrectionModal } from '../Components/notice/CorrectionModal';
import { NoticeDetailModal } from '../Components/notice/NoticeDetailModal';
import { useNotification } from '../contexts/NotificationContext';
import { useSuppliers } from '../contexts/SupplierContext';
import { useNotices } from '../contexts/NoticeContext';
import { useAlerts } from '../contexts/AlertContext';
import { useConfig } from '../contexts/ConfigContext';
import { allPossibleStatuses } from '../data/_mockData';

const { Title, Paragraph } = Typography;
const { Search } = Input;
const { TabPane } = Tabs;

const NoticePage = () => {
    // --- 状态管理 (已清理) ---
    const { notices, updateNotice, loading: noticesLoading } = useNotices();
    const { suppliers } = useSuppliers();
    const { messageApi } = useNotification();
    const { token } = theme.useToken();
    const { addAlert } = useAlerts();
    const { noticeCategoryDetails, noticeCategories, loading: configLoading } = useConfig();
    const [form] = Form.useForm();
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);
    
    const [selectedNotice, setSelectedNotice] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [activeCollapseKeys, setActiveCollapseKeys] = useState([]);
    const [rejectionModal, setRejectionModal] = useState({ visible: false, notice: null, handler: null });
    const [rejectionForm] = Form.useForm();
    const [correctionModal, setCorrectionModal] = useState({ visible: false, notice: null });
    const [reassignForm] = Form.useForm();
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState('');
    const [previewTitle, setPreviewTitle] = useState('');

    // --- 数据逻辑 ---
    const userVisibleNotices = useMemo(() => {
        if (!currentUser || !notices) return [];
        if (currentUser.role === 'Manager') return notices;
        if (currentUser.role === 'SD') {
             const managedSupplierIds = (currentUser.managed_suppliers || []).map(s => s.supplier.id);
             return notices.filter(n => n.sdNotice?.creatorId === currentUser.id || managedSupplierIds.includes(n.assignedSupplierId));
        }
        if (currentUser.role === 'Supplier') {
            return notices.filter(n => n.assignedSupplierId === currentUser.id);
        }
        return [];
    }, [notices, currentUser]);

    const searchedNotices = useMemo(() => {
        let data = userVisibleNotices;
        const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
        if (lowerCaseSearchTerm) {
            data = data.filter(n => (n.title && typeof n.title === 'string' && n.title.toLowerCase().includes(lowerCaseSearchTerm)) || (n.noticeCode && n.noticeCode.toLowerCase().includes(lowerCaseSearchTerm)));
        }
        if (selectedCategories.length > 0) {
            data = data.filter(n => selectedCategories.includes(n.category));
        }
        return data;
    }, [userVisibleNotices, searchTerm, selectedCategories]);

    const groupedNotices = useMemo(() => {
        const grouped = {};
        const singles = [];
        searchedNotices.forEach(notice => {
            if (notice.batchId) {
                if (!grouped[notice.batchId]) grouped[notice.batchId] = [];
                grouped[notice.batchId].push(notice);
            } else {
                singles.push(notice);
            }
        });
        const batchItems = Object.values(grouped).map(batch => ({ isBatch: true, batchId: batch[0].batchId, notices: batch, representative: batch[0] }));
        return [...batchItems, ...singles];
    }, [searchedNotices]);
    
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const noticeIdToOpen = params.get('open');
        if (noticeIdToOpen && notices.length > 0) {
            const noticeToOpen = notices.find(n => n.id === noticeIdToOpen);
            if (noticeToOpen) {
                showDetailsModal(noticeToOpen);
                navigate('/notices', { replace: true });
            }
        }
    }, [location.search, notices, navigate]);

    // --- 弹窗与通用 Handler ---
    const showDetailsModal = (notice) => {
        form.resetFields();
        const lastHistory = notice.history?.[notice.history.length - 1];
        if (notice.status === '待供应商处理' && lastHistory?.type === 'sd_closure_reject') {
            const lastSubmission = [...notice.history].reverse().find(h => h.type === 'supplier_submission');
            if (lastSubmission) {
                form.setFieldsValue({
                    description: lastSubmission.description,
                    actionPlans: (lastSubmission.actionPlans || []).map(p => ({ ...p, deadline: p.deadline ? dayjs(p.deadline) : null })),
                });
            }
        }
        setSelectedNotice(notice);
    };
    const handleDetailModalCancel = () => setSelectedNotice(null);
    const handleRejectionCancel = () => { rejectionForm.resetFields(); setRejectionModal({ visible: false, notice: null, handler: null }); };
    const handleCorrectionCancel = () => { reassignForm.resetFields(); setCorrectionModal({ visible: false, notice: null }); };
    const handlePreviewCancel = () => setPreviewOpen(false);
    const handlePreview = async (file) => { /* ... */ };
    const handleReviewToggle = async (notice, e) => { /* ... */ };
    
    // --- 核心业务处理函数 (精简版) ---
    const handleSupplierSubmit = async (values) => { /* ... */ };
    const handleSdClosureApprove = async (notice) => { /* ... */ };
    const handleSdClosureReject = async (values, notice) => { /* ... */ };
    const showRejectionModal = (notice) => { /* ... */ };
    const handleRejectionSubmit = async () => { /* ... */ };
    const handleReassignment = async (values) => { /* ... */ };
    const handleVoidNotice = async () => { /* ... */ };
    const showCorrectionModal = (notice) => setCorrectionModal({ visible: true, notice });

    // --- 渲染逻辑 ---
    const getActionsForItem = (item) => { /* ... (精简版快捷操作) ... */ };
    const renderTabs = () => {
        if (!currentUser) return <p>请先登录</p>;
        if (configLoading || noticesLoading) { return <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px'}}><Spin size="large" /></div>; }

        const tabsConfig = { /* ... (精简版 Tabs) ... */ };
        const userTabs = tabsConfig[currentUser.role];
        return (
            <Tabs defaultActiveKey={userTabs[0].key} type="card">
                {userTabs.map(tab => {
                    const filteredData = searchedNotices.filter(n => tab.statuses.includes(n.status));
                    return (
                        <TabPane tab={`${tab.label} (${filteredData.length})`} key={tab.key}>
                            <NoticeList
                                data={groupedNotices.filter(g => g.isBatch ? g.notices.some(n => tab.statuses.includes(n.status)) : tab.statuses.includes(g.status))}
                                getActionsForItem={getActionsForItem}
                                showDetailsModal={showDetailsModal}
                                handleReviewToggle={handleReviewToggle}
                                token={token}
                                currentUser={currentUser}
                                noticeCategoryDetails={noticeCategoryDetails}
                                activeCollapseKeys={activeCollapseKeys}
                                setActiveCollapseKeys={setActiveCollapseKeys}
                            />
                        </TabPane>
                    );
                })}
            </Tabs>
        );
    };

    return (
        <div style={{ padding: '24px' }}>
            <Card style={{ marginBottom: '16px' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div><Title level={4} style={{ margin: 0 }}>整改通知单</Title><Paragraph type="secondary" style={{ margin: 0, marginTop: '4px' }}>{/* ... */}</Paragraph></div>
                    <Space wrap>
                        <Select mode="multiple" allowClear style={{ width: 250 }} placeholder="按问题类型筛选" onChange={setSelectedCategories} options={noticeCategories.map(c => ({ label: c, value: c }))}/>
                        <Search placeholder="搜索标题、编号..." allowClear onSearch={setSearchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: 300 }} />
                    </Space>
                </div>
            </Card>
            <Card>{renderTabs()}</Card>

            <NoticeDetailModal
                open={!!selectedNotice}
                notice={selectedNotice}
                onCancel={handleDetailModalCancel}
                currentUser={currentUser}
                form={form}
                onSupplierSubmit={handleSupplierSubmit}
                onClosureApprove={() => handleSdClosureApprove(selectedNotice)}
                showRejectionModal={showRejectionModal}
                handlePreview={handlePreview}
            />
            <RejectionModal visible={rejectionModal.visible} notice={rejectionModal.notice} form={rejectionForm} onCancel={handleRejectionCancel} onSubmit={handleRejectionSubmit} />
            <CorrectionModal visible={correctionModal.visible} notice={correctionModal.notice} onCancel={handleCorrectionCancel} onReassign={handleReassignment} onVoid={handleVoidNotice} suppliers={suppliers} form={reassignForm} />
            <Modal open={previewOpen} title={previewTitle} footer={null} onCancel={handlePreviewCancel}><Image width="100%" src={previewImage} /></Modal>
        </div>
    );
};

export default NoticePage;