// src/Pages/NoticePage.js

import React, { useState, useMemo, useEffect } from 'react';
import { Card, Typography, Input, Tabs, Form, Modal, Button, Popconfirm, theme,Spin } from 'antd';
import dayjs from 'dayjs';
import { useLocation, useNavigate } from 'react-router-dom';
// 1. 导入新创建的 Hooks 和组件
import { useFilteredNotices } from '../hooks/useFilteredNotices';
import { NoticeList } from '../Components/notice/NoticeList';

import { RejectionModal } from '../Components/notice/RejectionModal';
import { CorrectionModal } from '../Components/notice/CorrectionModal';
import { NoticeDetailModal } from '../Components/notice/NoticeDetailModal';
// 2. 导入 Contexts 和数据
import { useNotification } from '../contexts/NotificationContext';
import { useSuppliers } from '../contexts/SupplierContext';
import { useNotices } from '../contexts/NoticeContext';
import { useAlerts } from '../contexts/AlertContext';
import { useConfig } from '../contexts/ConfigContext'; // 1. Import the useConfig hook
const { Title, Paragraph } = Typography;
const { Search } = Input;
const { TabPane } = Tabs;

const NoticePage = () => {
    // --- 状态管理 ---
    const { notices, updateNotice, loading: noticesLoading } = useNotices();
     const [activeCollapseKeys, setActiveCollapseKeys] = useState([]); // 这个 state 是正确的
    const { suppliers } = useSuppliers();
    const { messageApi } = useNotification();
    const { token } = theme.useToken();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedNotice, setSelectedNotice] = useState(null);
    // const [isModalVisible, setIsModalVisible] = useState(false);
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
    const [rejectionModal, setRejectionModal] = useState({ visible: false, notice: null, handler: null });
    const [correctionModal, setCorrectionModal] = useState({ visible: false, notice: null });
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState('');
    const [previewTitle, setPreviewTitle] = useState('');
    const [form] = Form.useForm();
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);
    const { addAlert } = useAlerts(); // <-- 修改此行
    // --- 数据逻辑 (使用自定义 Hook) ---
    const { searchedNotices, groupedNotices } = useFilteredNotices(notices, currentUser, searchTerm);

    const { noticeCategoryDetails, noticeCategories, loading: configLoading } = useConfig();
    
    const navigate = useNavigate(); // 获取 navigate 函数
    const location = useLocation(); // 获取 location 对象

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
    }, [location.search, notices, navigate]); // <-- 将 navigate 添加到依赖项


    const showDetailsModal = (notice) => {
        // 清空表单，防止旧数据污染
        form.resetFields();

        const history = notice.history || [];
        const lastHistoryItem = history.length > 0 ? history[history.length - 1] : null;


        if (notice.status === '待供应商提交行动计划' && lastHistoryItem?.type === 'sd_plan_rejection') {

            // 3. 如果是，就从后往前查找上一次“供应商提交计划”的记录
            const lastSubmission = [...history].reverse().find(h => h.type === 'supplier_plan_submission');

            // 4. 如果找到了上次提交的记录，就用它的数据来填充表单
            if (lastSubmission && lastSubmission.actionPlans) {
                form.setFieldsValue({
                    actionPlans: lastSubmission.actionPlans.map(p => ({
                        ...p,
                        // 重要：将日期字符串转换回 DatePicker 认识的 dayjs 对象
                        deadline: p.deadline ? dayjs(p.deadline) : null
                    }))
                });
            }
        }

        else if (notice.status === '待供应商上传证据' && lastHistoryItem?.type === 'sd_evidence_rejection') {

            const lastSubmission = [...history].reverse().find(h => h.type === 'supplier_evidence_submission');
            if (lastSubmission) {
                form.setFieldsValue({
                    description: lastSubmission.description,
                    images: lastSubmission.images || [],
                    attachments: lastSubmission.attachments || []
                });
            }
        }

        // --- 新增逻辑结束 ---

        // 原有逻辑保持不变
        setSelectedNotice(notice);
        setIsDetailModalVisible(true);
    };


    const handleDetailModalCancel = () => {
        setIsDetailModalVisible(false);
        setSelectedNotice(null);
        form.resetFields();
    };

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

        await updateNotice(noticeId, {
            status: '待供应商上传证据',
            history: currentNotice.history.concat(newHistory)
        });

        // --- 核心修正：使用正确的 noticeId 变量 ---
        addAlert(
            currentUser.id,
            currentNotice.assignedSupplierId,
            `您提交的 "${currentNotice.title}" 行动计划已通过审核。`,
            `/notices?open=${noticeId}`
        );

        messageApi.success('行动计划已批准！');

        // --- 核心修正：使用正确的弹窗状态和关闭函数 ---
        if (selectedNotice?.id === noticeId) {
            handleDetailModalCancel();
        }
    };

   const handleSdEvidenceApprove = async (id, description = '证据审核通过，问题关闭。') => {
        const noticeId = id || selectedNotice.id;
        const currentNotice = notices.find(n => n.id === noticeId);
        if (!currentNotice) return;

        const newHistory = { type: 'sd_evidence_approval', submitter: currentUser.name, time: dayjs().format('YYYY-MM-DD HH:mm:ss'), description };
        
        await updateNotice(noticeId, {
            status: '已完成',
            history: currentNotice.history.concat(newHistory)
        });
        
        addAlert(
            currentUser.id,
            currentNotice.assignedSupplierId,
            `您提交的关于 "${currentNotice.title}" 的证据已通过审核，问题已关闭。`,
            `/notices?open=${noticeId}`
        );

        messageApi.success('证据审核通过，流程已完成！');
        if (selectedNotice?.id === noticeId) handleDetailModalCancel();
    };

    const handleQuickApprove = (notice) => {
        if (notice.status === '待SD审核行动计划') {
            handleSdPlanApprove(notice.id, `行动计划已批准`);
        } else if (notice.status === '待SD审核证据') {
            handleSdEvidenceApprove(notice.id, `证据审核通过，问题关闭`);
        }
    };

    const showCorrectionModal = (notice) => {
        setCorrectionModal({ visible: true, notice });
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

        const creatorId = currentNotice.sdNotice.creatorId;
        addAlert(
            currentUser.id, // 1. 发送人: 当前供应商
            creatorId,      // 2. 接收人: 创建通知的SD
            `供应商 ${currentUser.name} 已提交了 "${currentNotice.title}" 的行动计划。`, // 3. 消息
            `/notices?open=${currentNotice.id}` // 4. 链接
        );

        messageApi.success('行动计划提交成功！');
        handleDetailModalCancel(); // <--- 修改为此行
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
        
        addAlert(
            currentUser.id,
            currentNotice.assignedSupplierId,
            `您为 "${currentNotice.title}" 提交的证据已被退回，原因：${values.rejectionReason}`,
            `/notices?open=${noticeId}`
        );

        messageApi.warning('证据审核不通过，已退回！');
        if (selectedNotice?.id === noticeId) handleDetailModalCancel()
    };


    const showRejectionModal = (notice) => {
        let handler;
        if (notice.status === '待SD审核行动计划') {
            handler = (values) => handleSdPlanReject(values, notice.id);
        } else if (notice.status === '待SD审核证据') {
            handler = (values) => handleSdEvidenceReject(values, notice.id);
        }
        setRejectionModal({ visible: true, notice, handler });
    };

    const handleRejectionSubmit = (values) => {
        if (rejectionModal.handler) {
            rejectionModal.handler(values);
        }
        setRejectionModal({ visible: false, notice: null, handler: null });
    };


    const getBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });

    const handlePreview = async (file) => {
        if (!file.url && !file.preview) {
            file.preview = await getBase64(file.originFileObj);
        }
        setPreviewImage(file.url || file.preview);
        setPreviewOpen(true);
        setPreviewTitle(file.name || file.url.substring(file.url.lastIndexOf('/') + 1));
    };

    const handlePreviewCancel = () => setPreviewOpen(false);

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
          const creatorId = currentNotice.sdNotice.creatorId;
        addAlert(
            currentUser.id, // 1. 发送人: 当前供应商
            creatorId,      // 2. 接收人: 创建通知的SD
            `供应商 ${currentUser.name} 已为 "${currentNotice.title}" 提交了证据。`, // 3. 消息
            `/notices?open=${currentNotice.id}` // 4. 链接
        );
        messageApi.success('证据提交成功！');
        handleDetailModalCancel();
    };

    const handleCorrectionCancel = () => {
        setCorrectionModal({ visible: false, notice: null });
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

    const handleSdPlanReject = async (values, id) => {
        const noticeId = id || selectedNotice.id;
        const currentNotice = notices.find(n => n.id === noticeId);
        if (!currentNotice) return;
        const newHistory = { type: 'sd_plan_rejection', submitter: currentUser.name, time: dayjs().format('YYYY-MM-DD HH:mm:ss'), description: `[计划被退回] ${values.rejectionReason}` };
        await updateNotice(noticeId, {
            status: '待供应商提交行动计划',
            history: currentNotice.history.concat(newHistory)
        });
        const supplierId = currentNotice.assignedSupplierId;
        addAlert(
            currentUser.id,
            supplierId,
            `您提交的 "${currentNotice.title}" 行动计划已通过审核，请尽快上传证据。`,
            `/notices?open=${noticeId}`
        );
        messageApi.warning('行动计划已退回！');
        if (isDetailModalVisible && selectedNotice?.id === noticeId) handleDetailModalCancel();
    };

    const handleReviewToggle = async (notice, e) => {
        e.stopPropagation(); // 阻止事件冒泡，防止意外行为
        const newReviewedState = !notice.isReviewed;
        
        await updateNotice(notice.id, {
            isReviewed: newReviewedState
        });

        messageApi.success(newReviewedState ? '已标记为“已审阅”' : '已取消“已审阅”标记');
    };

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
    

    const renderTabs = () => {
        if (!currentUser) return <p>请先登录</p>;
          if (configLoading || noticesLoading) {
            return (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                    <Spin size="large" />
                </div>
            );
        }
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
                    const tabGroupedData = groupedNotices.filter(g =>
                        g.isBatch ? g.notices.some(n => tab.statuses.includes(n.status)) : tab.statuses.includes(g.status)
                    );
                    return (
                        <TabPane tab={`${tab.label} (${filteredData.length})`} key={tab.key}>
                            <NoticeList
                                data={tabGroupedData}
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
        <div style={{ padding: '24px', background: token.colorBgLayout }}>
            <Card style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div><Title level={4} style={{ margin: 0 }}>整改通知单</Title><Paragraph type="secondary" style={{ margin: 0, marginTop: '4px' }}></Paragraph></div>
                    <Search placeholder="搜索标题、编号、供应商、种类..." allowClear onSearch={value => setSearchTerm(value)} onChange={e => setSearchTerm(e.target.value)} style={{ width: 300 }} />
                </div>
            </Card>

            <Card>
                {renderTabs()}
            </Card>


            <NoticeDetailModal
                visible={isDetailModalVisible}
                notice={selectedNotice}
                onCancel={handleDetailModalCancel}
                currentUser={currentUser}
                form={form}
                onPlanSubmit={handlePlanSubmit}
                onEvidenceSubmit={handleEvidenceSubmit}
                onPlanApprove={() => handleSdPlanApprove(selectedNotice.id)}
                onEvidenceApprove={() => handleSdEvidenceApprove(selectedNotice.id)}
                showRejectionModal={showRejectionModal}
                handlePreview={handlePreview}
            />

            <RejectionModal
                visible={rejectionModal.visible}
                notice={rejectionModal.notice}
                onCancel={() => setRejectionModal({ visible: false, notice: null, handler: null })}
                _ onSubmit={handleRejectionSubmit}
            />

            <CorrectionModal
                visible={correctionModal.visible}
                notice={correctionModal.notice}
                onCancel={handleCorrectionCancel}
                onReassign={handleReassignment}
                onVoid={handleVoidNotice}
                suppliers={suppliers}
            />

            <Modal open={previewOpen} title={previewTitle} footer={null} onCancel={handlePreviewCancel}>
                <img alt="预览" style={{ width: '100%' }} src={previewImage} />
            </Modal>
        </div>
    );
};

export default NoticePage;