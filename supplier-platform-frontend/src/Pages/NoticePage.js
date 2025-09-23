// src/Pages/NoticePage.js

import React, { useState, useMemo, useEffect } from 'react';
import { Card, Typography, Input, Tabs, Form, Modal, Popconfirm, theme, Spin, List, Button, Space, Select, Divider, Timeline, Collapse, Image, Checkbox } from 'antd';
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
import { allPossibleStatuses } from '../data/_mockData'; // 导入状态字典

const { Title, Paragraph } = Typography;
const { Search } = Input;
const { TabPane } = Tabs;

const NoticePage = () => {
    // --- 状态管理 (已清理) ---
    const { notices, updateNotice, loading: noticesLoading } = useNotices();
    const { suppliers } = useSuppliers();
    const { messageApi, notificationApi } = useNotification();
    const { token } = theme.useToken();
    const { addAlert } = useAlerts();
    const sendAlert = async (senderId, recipientId, msg, link) => {
        try {
            await addAlert(senderId, recipientId, msg, link);
            notificationApi?.open({ message: '已发送提醒', description: msg, placement: 'bottomRight' });
        } catch (e) {
            console.error('发送提醒失败:', e);
        }
    };
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

    useEffect(() => {

    }, [selectedNotice]);

    // --- 数据逻辑 ---
    const userVisibleNotices = useMemo(() => {

        if (!currentUser || !notices) {
            return [];
        }
        switch (currentUser.role) {
            case 'Manager':

                return notices;
            case 'SD':
                const managedSupplierIds = (currentUser.managed_suppliers || []).map(s => s.supplier.id);

                return notices.filter(n => n.sdNotice?.creatorId === currentUser.id || managedSupplierIds.includes(n.assignedSupplierId));

            case 'Supplier':
                // 从当前用户对象中获取其所属的公司IDconcon
                const supplierCompanyId = currentUser.supplier_id;

                const filteredNotices = notices.filter(n => {
                    // ✅ 修正：将 n.assigned_supplier_id 改为 n.assignedSupplierId
                    const isMatch = n.assignedSupplierId === supplierCompanyId;
                    return isMatch;
                });

                return filteredNotices;

            default:
                return [];
        }
    }, [notices, currentUser]);

    const searchedNotices = useMemo(() => {
        let data = userVisibleNotices;
        const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
        if (lowerCaseSearchTerm) {
            data = data.filter(n => (n.title && n.title.toLowerCase().includes(lowerCaseSearchTerm)) || (n.noticeCode && n.noticeCode.toLowerCase().includes(lowerCaseSearchTerm)));
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
    form.resetFields(); // 每次打开都重置表单
    const history = notice.history || [];
    const lastHistory = history[history.length - 1];

    // 逻辑修正：检查 '计划被驳回' 的情况（兼容不同状态文案）
    if (notice.status === '待供应商处理' && lastHistory?.type === 'sd_plan_rejection') {
        const lastSubmission = [...history].reverse().find(h => h.type === 'supplier_plan_submission');
        if (lastSubmission) {
            form.setFieldsValue({
                actionPlans: (lastSubmission.actionPlans || []).map(p => ({ ...p, deadline: p.deadline ? dayjs(p.deadline) : null })),
            });
        }
    }
    // 逻辑补充：检查 '证据被驳回' 的情况
    else if (notice.status === '待供应商上传证据' && lastHistory?.type === 'sd_evidence_rejection') {
         const lastSubmission = [...history].reverse().find(h => h.type === 'supplier_evidence_submission');
         if(lastSubmission) {
            // 注意：EvidencePerActionForm 的数据结构是 { evidence: [...] }
            const evidenceValues = (lastSubmission.actionPlans || []).map(plan => ({
                description: plan.evidenceDescription || '',
                images: plan.evidenceImages || [],
            }));
            form.setFieldsValue({ evidence: evidenceValues });
         }
    }

    setSelectedNotice(notice);
};
    const handleDetailModalCancel = () => {

        setSelectedNotice(null);
    }
    const handleRejectionCancel = () => { rejectionForm.resetFields(); setRejectionModal({ visible: false, notice: null, handler: null }); };
    const handleCorrectionCancel = () => { reassignForm.resetFields(); setCorrectionModal({ visible: false, notice: null }); };
    const handleReviewToggle = async (notice, e) => {
        e.stopPropagation();
        await updateNotice(notice.id, { isReviewed: !notice.isReviewed });
        messageApi.success(!notice.isReviewed ? '已标记为“已审阅”' : '已取消“已审阅”标记');
    };
    // --- 核心业务处理函数 (精简版) ---

    // 1. 供应商提交行动计划
     const handlePlanSubmit = async (values) => {
           const notice = selectedNotice;
           if (!notice) return;
           const formattedPlans = (values.actionPlans || []).map(p => ({ ...p, deadline: p.deadline ? dayjs(p.deadline).format('YYYY-MM-DD') : '' }));
           const newHistory = { type: 'supplier_plan_submission', submitter: currentUser.name, time: dayjs().format('YYYY-MM-DD HH:mm:ss'), description: '供应商已提交行动计划。', actionPlans: formattedPlans };
           const currentHistory = Array.isArray(notice.history) ? notice.history : [];
           await updateNotice(notice.id, { status: '待SD审核', history: [...currentHistory, newHistory] });
           sendAlert(currentUser.id, notice.creatorId, `供应商 ${currentUser.name} 已提交 "${notice.title}" 的行动计划待审核。`, `/notices?open=${notice.id}`);
           messageApi.success('行动计划提交成功！');
           handleDetailModalCancel();
       };

      // 2. SD 批准行动计划（支持从弹窗或列表快捷操作触发）
       const handlePlanApprove = async (targetNotice) => {
        const notice = targetNotice || selectedNotice;
        if (!notice) return;

        // ✅ 核心修正：找到供应商提交的最新一份行动计划
        const lastPlanSubmission = [...notice.history].reverse().find(h => h.type === 'supplier_plan_submission');
        if (!lastPlanSubmission) {
            messageApi.error("无法找到供应商提交的行动计划，操作失败！");
            return;
        }
        
        // 为每个action plan添加初始状态
        const plansWithStatus = lastPlanSubmission.actionPlans.map(p => ({...p, status: 'pending_evidence'}));

        const newHistory = {
            type: 'sd_plan_approval',
            submitter: currentUser.name,
            time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            description: '行动计划已批准，等待供应商上传完成证据。',
            // ✅ 核心修正：将找到的行动计划 '接力' 保存到这条历史记录中
            actionPlans: plansWithStatus,
        };

        const currentHistory = Array.isArray(notice.history) ? notice.history : [];
        console.log('[handlePlanApprove] updating', notice.id, '-> 待供应商上传证据');
        await updateNotice(notice.id, { status: '待供应商上传证据', history: [...currentHistory, newHistory] });

        sendAlert(currentUser.id, notice.assignedSupplierId, `您为 "${notice.title}" 提交的行动计划已被批准。`, `/notices?open=${notice.id}`);
        messageApi.success('计划已批准！');
        if (!targetNotice) {
            handleDetailModalCancel();
        }
    };

       // 3. SD 驳回行动计划
       const handlePlanReject = async (values, noticeArg) => {
           const notice = noticeArg || rejectionModal.notice;
           if (!notice) return;
           const newHistory = { type: 'sd_plan_rejection', submitter: currentUser.name, time: dayjs().format('YYYY-MM-DD HH:mm:ss'), description: `[计划被驳回] ${values.rejectionReason}` };
           const currentHistory = Array.isArray(notice.history) ? notice.history : [];
           try {
               console.log('[handlePlanReject] updating', notice.id, '-> 待供应商处理');
               await updateNotice(notice.id, { status: '待供应商处理', history: [...currentHistory, newHistory] });
               sendAlert(currentUser.id, notice.assignedSupplierId, `您为 "${notice.title}" 提交的行动计划已被驳回，请根据意见修改并重新提交。`, `/notices?open=${notice.id}`);
               messageApi.warning('计划已驳回！');
           } catch (e) {
               messageApi.error('退回失败：' + (e?.message || '未知错误'));
               return;
           } finally {
               handleRejectionCancel();
               if (selectedNotice?.id === notice.id) handleDetailModalCancel();
           }
       };

       // 4. 供应商提交完成证据
      const handleEvidenceSubmit = async (values) => {
           const notice = selectedNotice;
           if (!notice) return;
           
           const lastApprovedHistory = [...notice.history].reverse().find(h => h.type === 'sd_plan_approval');
           const originalPlans = lastApprovedHistory?.actionPlans || [];
   
           // --- 核心修改 2: 只更新本次提交了证据的行动项 ---
           const plansWithEvidence = originalPlans.map((plan, index) => {
               // 只有待提交或被驳回的项才会被更新
               if (plan.status === 'pending_evidence' || plan.status === 'rejected') {
                   return {
                       ...plan,
                       evidenceDescription: values.evidence?.[index]?.description || '',
                       evidenceImages: values.evidence?.[index]?.images || [],
                       status: 'pending_approval', // 提交后状态变为待审批
                   };
               }
               return plan; // 其他状态（如已批准的）保持不变
           });
   
           const newHistory = { type: 'supplier_evidence_submission', submitter: currentUser.name, time: dayjs().format('YYYY-MM-DD HH:mm:ss'), description: '供应商已上传完成证据。', actionPlans: plansWithEvidence };
           const currentHistory = Array.isArray(notice.history) ? notice.history : [];
           
           await updateNotice(notice.id, { status: '待SD关闭', history: [...currentHistory, newHistory] });
           sendAlert(currentUser.id, notice.creatorId, `供应商 ${currentUser.name} 已上传 "${notice.title}" 的完成证据待关闭。`, `/notices?open=${notice.id}`);
           messageApi.success('完成证据提交成功！');
           handleDetailModalCancel();
       };

      // 5. SD 批准并关闭（支持从弹窗或列表快捷操作触发）
      const handleClosureApprove = async (targetNotice) => {
          const notice = targetNotice || selectedNotice;
          if(!notice) return;
          const newHistory = { type: 'sd_closure_approve', submitter: currentUser.name, time: dayjs().format('YYYY-MM-DD HH:mm:ss'), description: '审核通过，问题关闭。' };
           const currentHistory = Array.isArray(notice.history) ? notice.history : [];
          console.log('[handleClosureApprove] updating', notice.id, '-> 已完成');
          await updateNotice(notice.id, { status: '已完成', history: [...currentHistory, newHistory]});
           sendAlert(currentUser.id, notice.assignedSupplierId, `您关于 "${notice.title}" 的整改已被批准关闭。`, `/notices?open=${notice.id}`);
          messageApi.success('通知单已关闭！');
          if (!targetNotice) {
              handleDetailModalCancel();
          }
       };

       // 6. SD 驳回证据
       const handleEvidenceReject = async (values) => {
           const notice = rejectionModal.notice;
           if (!notice) return;
           const newHistory = { type: 'sd_evidence_rejection', submitter: currentUser.name, time: dayjs().format('YYYY-MM-DD HH:mm:ss'), description: `[证据被驳回] ${values.rejectionReason}` };
           const currentHistory = Array.isArray(notice.history) ? notice.history : [];
           console.log('[handleEvidenceReject] updating', notice.id, '-> 待供应商上传证据');
           await updateNotice(notice.id, { status: '待供应商上传证据', history: [...currentHistory, newHistory] });
           sendAlert(currentUser.id, notice.assignedSupplierId, `您关于 "${notice.title}" 的整改证据已被驳回，原因: ${values.rejectionReason}`, `/notices?open=${notice.id}`);
           messageApi.warning('证据已驳回！');
           handleRejectionCancel();
           if (selectedNotice?.id === notice.id) handleDetailModalCancel();
       };

        // 6.1 SD 逐条批准证据
        const handleEvidenceItemApprove = async (index) => {
            const notice = selectedNotice;
            if (!notice) return;

            const history = Array.isArray(notice.history) ? notice.history : [];
            const lastEvidenceSubmission = [...history].reverse().find(h => h.type === 'supplier_evidence_submission');
            if (!lastEvidenceSubmission) return;

            const updatedActionPlans = lastEvidenceSubmission.actionPlans.map((p, i) => i === index ? { ...p, status: 'approved' } : p);

            const newHistory = { ...lastEvidenceSubmission, actionPlans: updatedActionPlans };

            const newFullHistory = history.map(h => h.time === lastEvidenceSubmission.time ? newHistory : h);

            const allApproved = updatedActionPlans.every(p => p.status === 'approved');

            if (allApproved) {
                await updateNotice(notice.id, { status: '已完成', history: [...newFullHistory, { type: 'sd_closure_approve', submitter: currentUser.name, time: dayjs().format('YYYY-MM-DD HH:mm:ss'), description: '所有证据均已批准，问题关闭。' }] });
                sendAlert(currentUser.id, notice.assignedSupplierId, `您关于 "${notice.title}" 的整改证据均已批准，单据已关闭。`, `/notices`);
                messageApi.success('该条证据已批准，所有证据均通过，单据已关闭！');
                handleDetailModalCancel();
            } else {
                await updateNotice(notice.id, { history: newFullHistory });
                sendAlert(currentUser.id, notice.assignedSupplierId, `您关于 "${notice.title}" 的第 ${index + 1} 条证据已被批准。`, `/notices?open=${notice.id}`);
                messageApi.success('该条证据已批准');
                // Refresh the modal with updated data
                setSelectedNotice({...notice, history: newFullHistory});
            }
        };

        // 6.2 SD 逐条驳回证据（退回至行动阶段）
        const handleEvidenceItemReject = async (values, index) => {
            const notice = selectedNotice;
            if (!notice) return;
        
            const history = Array.isArray(notice.history) ? notice.history : [];
            const lastEvidenceSubmission = [...history].reverse().find(h => h.type === 'supplier_evidence_submission');
            if (!lastEvidenceSubmission) return;
        
            const updatedActionPlans = lastEvidenceSubmission.actionPlans.map((p, i) => i === index ? { ...p, status: 'rejected' } : p);
        
            const newHistoryItem = { ...lastEvidenceSubmission, actionPlans: updatedActionPlans };
        
            const newFullHistory = history.map(h => h.time === lastEvidenceSubmission.time ? newHistoryItem : h);
        
            const rejectionHistory = { type: 'sd_evidence_rejection', submitter: currentUser.name, time: dayjs().format('YYYY-MM-DD HH:mm:ss'), description: `[证据被驳回-第${index + 1}项] ${values.rejectionReason}`, evidenceIndex: index };
        
            await updateNotice(notice.id, { status: '待供应商上传证据', history: [...newFullHistory, rejectionHistory] });
        
            sendAlert(currentUser.id, notice.assignedSupplierId, `您关于 "${notice.title}" 的第 ${index + 1} 条证据被驳回，请按要求补充并重新上传证据。`, `/notices?open=${notice.id}`);
            messageApi.warning('该条证据已驳回，单据退回到提交证据阶段');
            handleRejectionCancel();
            handleDetailModalCancel();
        };

      // 通用驳回弹窗
      const handleRejectionSubmit = async () => {
          try {
              const values = await rejectionForm.validateFields();
              if (!rejectionModal.handler) {
                  messageApi.error('未找到处理函数，请重试');
                  return;
              }
              await rejectionModal.handler(values);
              messageApi.success('已提交退回原因');
              // 双保险：若子处理未主动关闭弹窗，这里也关闭
              if (rejectionModal.visible) {
                  handleRejectionCancel();
              }
          } catch (error) {
              console.log('Validate Failed:', error);
          }
      };

         // ✨ 新增：处理管理员“重分配供应商”的逻辑
    const handleReassignment = async (values) => {
        const notice = correctionModal.notice;
        if (!notice) return;

        const newSupplier = suppliers.find(s => s.id === values.newSupplierId);
        if (!newSupplier) {
            messageApi.error('未找到指定的供应商！');
            return;
        }

        const newHistory = {
            type: 'manager_reassignment',
            submitter: currentUser.name,
            time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            description: `[管理修正] 通知单已重分配给新的供应商: ${newSupplier.name}。原因: ${values.reason || '未提供原因'}`,
        };

        const currentHistory = Array.isArray(notice.history) ? notice.history : [];
        await updateNotice(notice.id, {
            assignedSupplierId: newSupplier.id,
            assignedSupplierName: newSupplier.name,
            history: [...currentHistory, newHistory],
        });

        // 为相关方创建提醒
        addAlert(currentUser.id, notice.assignedSupplierId, `"${notice.title}" 已被重分配，您无需再处理。`, `/notices`);
        addAlert(currentUser.id, newSupplier.id, `您有一个新的通知单被分配: "${notice.title}"。`, `/notices?open=${notice.id}`);
        addAlert(currentUser.id, notice.creatorId, `您创建的 "${notice.title}" 已被重分配给 ${newSupplier.name}。`, `/notices?open=${notice.id}`);

        messageApi.success('通知单已成功重分配！');
        setCorrectionModal({ visible: false, notice: null }); // 关闭修正弹窗
        reassignForm.resetFields();
    };

    // ✨ 新增：处理管理员“作废通知单”的逻辑
    const handleVoidNotice = async (values) => {
        const notice = correctionModal.notice;
        if (!notice) return;

        const newHistory = {
            type: 'manager_void',
            submitter: currentUser.name,
            time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            description: `[管理修正] 通知单已作废。原因: ${values.reason || '未提供原因'}`,
        };

        const currentHistory = Array.isArray(notice.history) ? notice.history : [];
        await updateNotice(notice.id, {
            status: '已作废',
            history: [...currentHistory, newHistory],
        });

        // 为相关方创建提醒
        addAlert(currentUser.id, notice.assignedSupplierId, `"${notice.title}" 已被作废，您无需再处理。`, `/notices`);
        addAlert(currentUser.id, notice.creatorId, `您创建的 "${notice.title}" 已被作废。`, `/notices?open=${notice.id}`);

        messageApi.warning('通知单已作废！');
        setCorrectionModal({ visible: false, notice: null }); // 关闭修正弹窗
        reassignForm.resetFields();
    };


const showRejectionModal = (notice, rejectHandler) => {
    console.log('[showRejectionModal] open for notice', notice?.id);
    setRejectionModal({
        visible: true,
        notice: notice,
        handler: (values) => rejectHandler(values, notice)
    });
    messageApi.info('请填写退回原因');
};

    const getActionsForItem = (item) => {
    const actions = [];
    const stopPropagationAndRun = (e, func) => { e?.stopPropagation(); func(); };

    // SD 和 Manager 的快捷操作
    if (currentUser.role === 'SD' || currentUser.role === 'Manager') {
        // 审批计划阶段（兼容不同文案）
        if (item.status === '待SD审核' || item.status === '待SD审核计划') {
            actions.push(<Button key="quick_approve_plan" type="link" onClick={(e) => stopPropagationAndRun(e, () => handlePlanApprove(item))}>批准计划</Button>);
            actions.push(<Button key="quick_reject_plan" type="link" danger onClick={(e) => stopPropagationAndRun(e, () => showRejectionModal(item, handlePlanReject))}>驳回计划</Button>);
        }
        // 关闭阶段
        if (item.status === '待SD关闭') {
            actions.push(<Popconfirm key="quick_close" title="确定要批准并关闭吗?（若想逐条审批证据，请进入详情）" onConfirm={(e) => stopPropagationAndRun(e, () => handleClosureApprove(item))}><Button type="link">批准关闭</Button></Popconfirm>);
        }
    }

    actions.push(<Button key="details" onClick={(e) => stopPropagationAndRun(e, () => showDetailsModal(item))}>查看详情</Button>);

    // 管理员的修正/撤回按钮 (如果需要)
    if (currentUser.role === 'Manager' && item.status !== '已完成' && item.status !== '已作废') {
        actions.push(<Button key="correct" type="link" style={{ color: token.colorWarning }} onClick={(e) => stopPropagationAndRun(e, () => setCorrectionModal({ visible: true, notice: item }))}>修正/撤回</Button>);
    }

    return actions;
};

    const renderTabs = () => {
        if (!currentUser) return <p>请先登录</p>;
        if (configLoading || noticesLoading) { return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}><Spin size="large" /></div>; }

      // 在 NoticePage.js > renderTabs 函数中...

const tabsConfig = {
    Supplier: [
        { key: 'pending', label: '待我处理', statuses: ['待供应商处理', '待供应商上传证据'] },
        { key: 'review', label: '等待审核', statuses: ['待SD审核', '待SD审核计划', '待SD关闭'] },
        { key: 'completed', label: '已完成', statuses: ['已完成', '已作废'] }
    ],
    SD: [
        { key: 'review', label: '待我审核', statuses: ['待SD审核', '待SD审核计划', '待SD关闭'] },
        { key: 'pending', label: '待供应商处理', statuses: ['待供应商处理', '待供应商上传证据'] },
        { key: 'completed', label: '已完成', statuses: ['已完成', '已作废'] }
    ],
    Manager: [
        { key: 'all', label: '所有单据', statuses: allPossibleStatuses },
        { key: 'review', label: '待审核', statuses: ['待SD审核', '待SD审核计划', '待SD关闭'] },
        { key: 'pending', label: '待供应商处理', statuses: ['待供应商处理', '待供应商上传证据'] },
        { key: 'completed', label: '已完成', statuses: ['已完成', '已作废'] }
    ]
};
        const userTabs = tabsConfig[currentUser.role];
        return (
            <Tabs defaultActiveKey={userTabs[0].key} type="card">
                {userTabs.map(tab => {
                    const filteredData = searchedNotices.filter(n => tab.statuses.includes(n.status));
                    const tabGroupedData = groupedNotices.filter(g => g.isBatch ? g.notices.some(n => tab.statuses.includes(n.status)) : tab.statuses.includes(g.status));
                    return (
                        <TabPane tab={`${tab.label} (${filteredData.length})`} key={tab.key}>
                            {/* --- 核心修正：在这里将所有需要的 props 完整地传递下去 --- */}
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
        <div style={{ padding: '24px' }}>
            <Card style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div><Title level={4} style={{ margin: 0 }}>整改通知单</Title><Paragraph type="secondary" style={{ margin: 0, marginTop: '4px' }}>{/* ... */}</Paragraph></div>
                    <Space wrap>
                        <Select mode="multiple" allowClear style={{ width: 250 }} placeholder="按问题类型筛选" onChange={setSelectedCategories} options={noticeCategories.map(c => ({ label: c, value: c }))} />
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

                onPlanSubmit={handlePlanSubmit}
                onPlanApprove={handlePlanApprove}
                showPlanRejectionModal={() => setRejectionModal({ visible: true, notice: selectedNotice, handler: handlePlanReject })}

                onEvidenceSubmit={handleEvidenceSubmit}
                onClosureApprove={handleClosureApprove}
                showEvidenceRejectionModal={() => setRejectionModal({ visible: true, notice: selectedNotice, handler: handleEvidenceReject })}
                onApproveEvidenceItem={(index) => handleEvidenceItemApprove(index)}
                onRejectEvidenceItem={(index) => setRejectionModal({ visible: true, notice: selectedNotice, handler: (values) => handleEvidenceItemReject(values, index) })}
            />

            <RejectionModal
                visible={rejectionModal.visible}
                notice={rejectionModal.notice}
                form={rejectionForm}
                onCancel={handleRejectionCancel}
                onSubmit={handleRejectionSubmit}
            />
            <CorrectionModal
                visible={correctionModal.visible}
                notice={correctionModal.notice}
                onCancel={handleCorrectionCancel}
                onReassign={handleReassignment}
                onVoid={handleVoidNotice}
                suppliers={suppliers}
                form={reassignForm}
            />
        </div>
    );
};



export default NoticePage;