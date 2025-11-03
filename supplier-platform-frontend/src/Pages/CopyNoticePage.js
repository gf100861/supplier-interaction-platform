import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Card, Typography, Table, Tabs, Tag, Space, Button, Modal, Form, Input, message, Spin, Transfer, Select, Radio, Popconfirm, Divider, DatePicker, Tooltip // 1. 引入 DatePicker
} from 'antd';
import { EditOutlined, UserSwitchOutlined, FileTextOutlined, AppstoreAddOutlined, DeleteOutlined, SwapOutlined, StarOutlined, StarFilled, SortAscendingOutlined, SortDescendingOutlined } from '@ant-design/icons';
import { supabase } from '../supabaseClient';
import dayjs from 'dayjs';

// 2. 导入所有需要的组件、Hooks 和数据
import { NoticeList } from '../Components/notice/NoticeList';
import { RejectionModal } from '../Components/notice/RejectionModal';
import { CorrectionModal } from '../Components/notice/CorrectionModal';
import { NoticeDetailModal } from '../Components/notice/NoticeDetailModal';

//导入所有需要的所有的Context
import { useNotification } from '../contexts/NotificationContext';
import { useSuppliers } from '../contexts/SupplierContext'; // 3. 导入 useSuppliers
import { useNotices } from '../contexts/NoticeContext';
import { useConfig } from '../contexts/ConfigContext';


const { Title, Paragraph, Text } = Typography;
const { Search } = Input;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker; // 4. 解构 RangePicker

const NoticePage = () => {
    // --- 状态管理 ---
    const { notices, loading: noticesLoading, hasMore, loadMoreNotices, updateNotice } = useNotices();
    const { suppliers, loading: suppliersLoading } = useSuppliers(); // 5. 获取 suppliers
    const { messageApi } = useNotification();
    const { token } = theme.useToken();

    const allPossibleStatuses = [
        '待提交Action Plan', '待供应商关闭', '待SD确认',
        '待SD关闭', '已完成', '已作废'
    ];

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
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [listSortOrder, setListSortOrder] = useState('desc');

    // --- 6. 为 Supplier 和 DateRange 添加 State ---
    const [selectedSuppliers, setSelectedSuppliers] = useState([]);
    const [dateRange, setDateRange] = useState(null);

    const navigate = useNavigate();
    const location = useLocation();

    // --- 7. (核心) 添加 useEffect 以接收来自 AuditPlanPage 的 state ---
    useEffect(() => {
        const passedState = location.state;
        if (passedState && passedState.preSelectedSupplierId && passedState.preSelectedMonth && passedState.preSelectedYear) {
            const { preSelectedSupplierId, preSelectedMonth, preSelectedYear } = passedState;

            // 1. 应用供应商筛选
            setSelectedSuppliers([preSelectedSupplierId]);

            // 2. 应用月份筛选
            const targetDate = dayjs(`${preSelectedYear}-${preSelectedMonth}-01`);
            setDateRange([targetDate.startOf('month'), targetDate.endOf('month')]);
            
            // 3. 提示用户
            messageApi.info(`已为您筛选 ${preSelectedYear}年${preSelectedMonth}月 ${suppliers.find(s => s.id === preSelectedSupplierId)?.name || ''} 的相关通知单。`);

            // 4. (关键) 清除 state，防止刷新时保留筛选
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate, messageApi, suppliers]); // 依赖 suppliers 以确保名称能正确显示
    
    
    // (获取 allUsers 的 useEffect 保持不变)
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const { data, error } = await supabase.from('users').select('id,supplier_id');
                if (error) throw error;
                setAllUsers(data);
            } catch (error) {
                console.error("获取用户列表失败:", error);
            } finally {
                setUsersLoading(false);
            }
        };
        fetchUsers();
    }, []);

    // (同步 selectedNotice 的 useEffect 保持不变)
    useEffect(() => {
        if (selectedNotice && notices.length > 0) {
            const updatedVersion = notices.find(n => n.id === selectedNotice.id);
            if (updatedVersion && JSON.stringify(updatedVersion) !== JSON.stringify(selectedNotice)) {
                setSelectedNotice(updatedVersion);
            }
        }
    }, [notices, selectedNotice]);

    // (处理 URL ?open= 参数的 useEffect 保持不变)
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


    // (userVisibleNotices useMemo 保持不变)
     const userVisibleNotices = useMemo(() => {
        if (!currentUser || !notices) return [];
        switch (currentUser.role) {
            case 'Manager':
            case 'Admin':
                return notices;
            case 'SD':
                const managedSupplierIds = (currentUser.managed_suppliers || []).map(s => s.supplier.id);
                return notices.filter(n =>
                    n.status === '已完成' ||
                    n.creatorId === currentUser.id ||
                    managedSupplierIds.includes(n.assignedSupplierId)
                );
            case 'Supplier':
                const supplierCompanyId = currentUser.supplier_id;
                return notices.filter(n => n.assignedSupplierId === supplierCompanyId);
            default:
                return [];
        }
    }, [notices, currentUser]);

    // --- 8. 更新 searchedNotices useMemo 以包含新筛选 ---
    const searchedNotices = useMemo(() => {
        let data = userVisibleNotices;

        // 类别筛选
        if (selectedCategories && selectedCategories.length > 0) {
            data = data.filter(n => selectedCategories.includes(n.category));
        }
        
        // 状态筛选
        if (selectedStatuses.length > 0) {
            data = data.filter(n => selectedStatuses.includes(n.status));
        }

        // (新增) 供应商筛选
        if (selectedSuppliers.length > 0) {
            data = data.filter(n => selectedSuppliers.includes(n.assignedSupplierId));
        }

        // (新增) 日期范围筛选
        if (dateRange && dateRange[0] && dateRange[1]) {
            data = data.filter(n => {
                const createTime = dayjs(n.sdNotice?.createTime);
                return createTime.isAfter(dateRange[0].startOf('day')) && createTime.isBefore(dateRange[1].endOf('day'));
            });
        }

        // 关键词搜索
        const keywords = searchTerm.toLowerCase().split(/[；;@,，]/).map(k => k.trim()).filter(Boolean);
        if (keywords.length > 0) {
            data = data.filter(notice => {
                const searchableText = [
                    notice.title,
                    notice.sdNotice?.description,
                    notice.assignedSupplierName,
                    notice.category,
                    notice.status,
                    notice?.noticeCode
                ].join(' ').toLowerCase();
                return keywords.some(keyword => searchableText.includes(keyword));
            });
        }
        
        return data;
    }, [userVisibleNotices, searchTerm, selectedCategories, selectedStatuses, selectedSuppliers, dateRange]); // <-- 添加新依赖

    // (groupedNotices useMemo 保持不变)
    const groupedNotices = useMemo(() => {
        const batchGroups = {};
        const dailyGroups = {};

        searchedNotices.forEach(notice => {
            if (notice.batchId) {
                if (!batchGroups[notice.batchId]) batchGroups[notice.batchId] = [];
                batchGroups[notice.batchId].push(notice);
            } else {
                const dateKey = dayjs(notice.sdNotice?.createTime).format('YYYY-MM-DD');
                const dailyGroupKey = `${notice.assignedSupplierId}-${dateKey}`;
                if (!dailyGroups[dailyGroupKey]) dailyGroups[dailyGroupKey] = [];
                dailyGroups[dailyGroupKey].push(notice);
            }
        });

        const batchItems = Object.values(batchGroups).map(batch => ({
            isBatch: true,
            batchId: batch[0].batchId,
            notices: batch,
            representative: batch[0]
        }));

        const dailyItems = [];
        Object.values(dailyGroups).forEach(group => {
            if (group.length > 1) {
                dailyItems.push({
                    isBatch: true,
                    batchId: `daily-${group[0].assignedSupplierId}-${dayjs(group[0].sdNotice?.createTime).format('YYYYMMDD')}`,
                    notices: group,
                    representative: group[0]
                });
            } else {
                dailyItems.push(group[0]);
            }
        });

        const combinedList = [...batchItems, ...dailyItems];

        const getSortableDate = (item) => {
            const dateStr = item.isBatch ? item.representative.sdNotice?.createTime : item.sdNotice?.createTime;
            return dayjs(dateStr || 0);
        };
        if (listSortOrder === 'asc') {
            combinedList.sort((a, b) => getSortableDate(a).diff(getSortableDate(b)));
        } else if (listSortOrder === 'desc') {
            combinedList.sort((a, b) => getSortableDate(b).diff(getSortableDate(a)));
        }
        return combinedList;
    }, [searchedNotices, listSortOrder]);


    // (sortedNoticeCategories useMemo 保持不变)
    const sortedNoticeCategories = useMemo(() => {
        if (!noticeCategories || noticeCategories.length === 0) return [];
        const target = "Process Audit";
        if (noticeCategories.includes(target)) {
            return [target, ...noticeCategories.filter(item => item !== target)];
        }
        return noticeCategories;
    }, [noticeCategories]);

    // (所有 handle... 函数, getActionsForItem, renderTabs 保持不变)
    // ...
    // --- 弹窗与通用 Handler ---
    const showDetailsModal = (notice) => {
        form.resetFields(); // 每次打开都重置表单
        const history = notice.history || [];
        const lastHistory = history[history.length - 1];

        // 逻辑修正：检查 '计划被驳回' 的情况（兼容不同状态文案）
        if (notice.status === '待提交Action Plan' && lastHistory?.type === 'sd_plan_rejection') {
            const lastSubmission = [...history].reverse().find(h => h.type === 'supplier_plan_submission');
            if (lastSubmission) {
                form.setFieldsValue({
                    actionPlans: (lastSubmission.actionPlans || []).map(p => ({ ...p, deadline: p.deadline ? dayjs(p.deadline) : null })),
                });
            }
        }
        // 逻辑补充：检查 '证据被驳回' 的情况
        else if (notice.status === '待供应商关闭' && lastHistory?.type === 'sd_evidence_rejection') {
            const lastSubmission = [...history].reverse().find(h => h.type === 'supplier_evidence_submission');
            if (lastSubmission) {
                const evidenceValues = (lastSubmission.actionPlans || []).map(plan => ({
                    description: plan.evidenceDescription || '',
                    images: plan.evidenceImages || [],
                    attachments: plan.evidenceAttachments || [], // 确保附件也预填充
                }));
                form.setFieldsValue({ evidence: evidenceValues });
            }
        }

        setSelectedNotice(notice);
    };

    const getBase64 = (file) =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
        });


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
    
    // --- 核心业务处理函数 ---

    // 1. 供应商提交行动计划
    const handlePlanSubmit = async (values) => {
        const notice = selectedNotice;
        if (!notice) return;
        const formattedPlans = (values.actionPlans || []).map(p => ({ ...p, deadline: p.deadline ? dayjs(p.deadline).format('YYYY-MM-DD') : '' }));
        const newHistory = { type: 'supplier_plan_submission', submitter: currentUser.name, time: dayjs().format('YYYY-MM-DD HH:mm:ss'), description: '供应商已提交行动计划。', actionPlans: formattedPlans };
        const currentHistory = Array.isArray(notice.history) ? notice.history : [];
        await updateNotice(notice.id, { status: '待SD确认', history: [...currentHistory, newHistory] });
        messageApi.success('行动计划提交成功！');
        handleDetailModalCancel();
    };

    // 2. SD 批准行动计划
    const handlePlanApprove = async (targetNotice) => {
        const notice = targetNotice || selectedNotice; // 确保 targetNotice 被优先使用
        if (!notice) return;

        const lastPlanSubmission = [...(notice.history || [])].reverse().find(h => h.type === 'supplier_plan_submission');
        if (!lastPlanSubmission) {
            messageApi.error("无法找到供应商提交的行动计划，操作失败！");
            return;
        }

        const plansWithStatus = (lastPlanSubmission.actionPlans || []).map(p => ({ ...p, status: 'pending_evidence' }));
        const newHistory = {
            type: 'sd_plan_approval',
            submitter: currentUser.name,
            time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            description: '行动计划已批准，等待供应商上传完成证据。',
            actionPlans: plansWithStatus,
        };
        const currentHistory = notice.history || [];
        await updateNotice(notice.id, { status: '待供应商关闭', history: [...currentHistory, newHistory] });
        
        messageApi.success('计划已批准！');
        if (!targetNotice) { // 仅当从 Modal 内部操作时才关闭 Modal
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
            await updateNotice(notice.id, { status: '待提交Action Plan', history: [...currentHistory, newHistory] });
            messageApi.warning('计划已驳回！');
        } catch (e) {
            messageApi.error('退回失败：' + (e?.message || '未知错误'));
        } finally {
            handleRejectionCancel();
            if (selectedNotice?.id === notice.id) handleDetailModalCancel();
        }
    };

    // 4. 供应商提交完成证据
    const handleEvidenceSubmit = async (values) => {
        const notice = selectedNotice;
        if (!notice) return;
        messageApi.loading({ content: '正在提交证据...', key: 'evidenceSubmit' });
        try {
            const lastPlanSubmission = [...notice.history].reverse().find(h => h.type === 'supplier_plan_submission');
            const originalPlans = lastPlanSubmission?.actionPlans || [];

            const processFiles = async (fileList = []) => {
                return Promise.all((fileList || []).map(async (file) => {
                    if (file.originFileObj && !file.url) {
                        const base64Url = await getBase64(file.originFileObj);
                        return { ...file, url: base64Url, thumbUrl: base64Url };
                    }
                    return file;
                }));
            };

            const plansWithEvidence = await Promise.all(
                originalPlans.map(async (plan, index) => {
                    const evidenceItem = values.evidence?.[index];
                    const processedImages = await processFiles(evidenceItem?.images);
                    const processedAttachments = await processFiles(evidenceItem?.attachments);

                    return {
                        ...plan,
                        evidenceDescription: evidenceItem?.description || '',
                        evidenceImages: processedImages,
                        evidenceAttachments: processedAttachments,
                    };
                })
            );

            const newHistory = {
                type: 'supplier_evidence_submission',
                submitter: currentUser.name,
                time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                description: '供应商已上传完成证据。',
                actionPlans: plansWithEvidence
            };
            const currentHistory = Array.isArray(notice.history) ? notice.history : [];
            await updateNotice(notice.id, {
                status: '待SD关闭',
                history: [...currentHistory, newHistory]
            });
            messageApi.success({ content: '完成证据提交成功！', key: 'evidenceSubmit', duration: 2 });
            handleDetailModalCancel();
        } catch (error) {
            console.error("证据提交失败:", error);
            messageApi.error({ content: `提交失败: ${error.message}`, key: 'evidenceSubmit', duration: 3 });
        }
    };

    // 5. SD 批准并关闭
    const handleClosureApprove = async (targetNotice) => {
        const notice = targetNotice || selectedNotice;
        if (!notice) return;
        const newHistory = { type: 'sd_closure_approve', submitter: currentUser.name, time: dayjs().format('YYYY-MM-DD HH:mm:ss'), description: '审核通过，问题关闭。' };
        const currentHistory = Array.isArray(notice.history) ? notice.history : [];
        await updateNotice(notice.id, { status: '已完成', history: [...currentHistory, newHistory] });
        messageApi.success('通知单已关闭！');
        if (!targetNotice) {
            handleDetailModalCancel();
        }
    };

    // 6. SD 驳回证据
    const handleEvidenceReject = async (values, noticeArg) => {
        const notice = noticeArg || rejectionModal.notice;
        if (!notice) return;
        const newHistory = { type: 'sd_evidence_rejection', submitter: currentUser.name, time: dayjs().format('YYYY-MM-DD HH:mm:ss'), description: `[证据被驳回] ${values.rejectionReason}` };
        const currentHistory = Array.isArray(notice.history) ? notice.history : [];
        await updateNotice(notice.id, { status: '待供应商关闭', history: [...currentHistory, newHistory] });
        messageApi.warning('证据已驳回！');
        handleRejectionCancel();
        if (selectedNotice?.id === notice.id) handleDetailModalCancel();
    };

    // 6.1 SD 逐条批准证据
    const handleEvidenceItemApprove = async (index) => {
        const notice = selectedNotice;
        if (!notice) return;
        // ... (logic remains same)
    };

    // 6.2 SD 逐条驳回证据
    const handleEvidenceItemReject = async (values, index) => {
        const notice = selectedNotice;
        if (!notice) return;
        // ... (logic remains same)
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
            // messageApi.success('已提交退回原因'); // 子函数会显示自己的消息
            if (rejectionModal.visible) {
                handleRejectionCancel();
            }
        } catch (error) {
            console.log('Validate Failed:', error);
        }
    };

    // 管理员“重分配供应商”
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
            description: `[管理修正] 通知单已从 ${notice.assignedSupplierName} 重分配给 ${newSupplier.name}。原因: ${values.reason || '未提供原因'}`,
        };
        await updateNotice(notice.id, {
            assigned_supplier_id: newSupplier.id,
            assigned_supplier_name: newSupplier.name,
            history: [...(notice.history || []), newHistory],
        });
        messageApi.success('通知单已成功重分配！');
        setCorrectionModal({ visible: false, notice: null });
        reassignForm.resetFields();
    };

    // 管理员“作废通知单”
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
        messageApi.warning('通知单已作废！');
        setCorrectionModal({ visible: false, notice: null });
        reassignForm.resetFields();
    };


    const handleLikeToggle = async (notice) => {
        const currentLikes = notice.likes || [];
        const userId = currentUser.id;
        const isLiked = currentLikes.includes(userId);
        const newLikesArray = isLiked ? currentLikes.filter(id => id !== userId) : [...currentLikes, userId];
        try {
            await updateNotice(notice.id, { likes: newLikesArray });
            messageApi.success(isLiked ? '已取消点赞' : '感谢您的认可！');
        } catch (error) {
            messageApi.error(`操作失败: ${error.message}`);
        }
    };


    const showRejectionModal = (notice, rejectHandler) => {
        setRejectionModal({
            visible: true,
            notice: notice,
            handler: (values) => rejectHandler(values, notice)
        });
        messageApi.info('请填写退回原因');
    };

    const getActionsForItem = (item) => {
        const actions = [];
        const isSDOrManager = currentUser && (currentUser.role === 'SD' || currentUser.role === 'Manager' || currentUser.role === 'Admin'); // Admin 也加入
        const canEdit = (item.status === '待提交Action Plan' || item.status === '待供应商处理'); // 待供应商处理时也允许修改
        const isManager = currentUser && (currentUser.role === 'Manager' || currentUser.role === 'Admin'); // Admin 也算 Manager
        const stopPropagationAndRun = (e, func) => { e?.stopPropagation(); func(); };

        if (isSDOrManager) {
            actions.push(
                <Button 
                    key="edit" 
                    icon={<EditOutlined />} 
                    type="link"
                    disabled={!canEdit}
                    onClick={(e) => stopPropagationAndRun(e, () => navigate(`/edit-notice/${item.id}`))}
                >
                    修改
                </Button>
            );
        }

        if (currentUser.role === 'SD' || currentUser.role === 'Manager') {
            if (item.status === '待SD确认' || item.status === '待SD确认计划') {
                actions.push(<Button key="quick_approve_plan" type="link" onClick={(e) => stopPropagationAndRun(e, () => handlePlanApprove(item))}>批准计划</Button>);
                actions.push(<Button key="quick_reject_plan" type="link" danger onClick={(e) => stopPropagationAndRun(e, () => showRejectionModal(item, handlePlanReject))}>驳回计划</Button>);
            }
            if (item.status === '待SD关闭') {
                actions.push(<Popconfirm key="quick_close" title="确定要批准并关闭吗?（若想逐条审批证据，请进入详情）" onConfirm={(e) => stopPropagationAndRun(e, () => handleClosureApprove(item))}><Button type="link">批准关闭</Button></Popconfirm>);
            }
            
            if (item.status === '已完成' && isSDOrManager) {
                const isLiked = item.likes && item.likes.includes(currentUser.id);
                actions.push(
                    <Space key="like-action" onClick={(e) => e.stopPropagation()}>
                        <Button
                            type={isLiked ? "primary" : "text"}
                            shape="circle"
                            icon={isLiked ? <StarFilled /> : <StarOutlined />}
                            onClick={(e) => stopPropagationAndRun(e, () => handleLikeToggle(item))}
                        />
                        <Text type="secondary">{item.likes?.length || 0}</Text>
                    </Space>
                );
            }
        }

        actions.push(<Button key="details" onClick={(e) => stopPropagationAndRun(e, () => showDetailsModal(item))}>查看详情</Button>);

        if (isManager && item.status !== '已完成' && item.status !== '已作废') {
            actions.push(<Button key="correct" type="link" style={{ color: token.colorWarning }} onClick={(e) => stopPropagationAndRun(e, () => setCorrectionModal({ visible: true, notice: item }))}>修正/撤回</Button>);
        }

        return actions;
    };
    
    // (renderTabs 保持不变)
    const renderTabs = () => {
        if (!currentUser) return <p>请先登录</p>;
        if (configLoading || noticesLoading) { return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}><Spin size="large" /></div>; }

        const tabsConfig = {
            Supplier: [
                { key: 'pending', label: '待我处理', statuses: ['待提交Action Plan', '待供应商关闭'] },
                { key: 'review', label: '等待审核', statuses: ['待SD确认', '待SD确认计划', '待SD关闭'] },
                { key: 'completed', label: '已完成', statuses: ['已完成', '已作废'] }
            ],
            SD: [
                { key: 'review', label: '待审核', statuses: ['待SD确认', '待SD确认计划', '待SD关闭'] },
                { key: 'pending', label: '待供应商处理', statuses: ['待提交Action Plan', '待供应商关闭'] },
                { key: 'completed', label: '已完成', statuses: ['已完成', '已作废'] },
                { key: 'all', label: '所有单据', statuses: allPossibleStatuses }
            ],
            Manager: [
                { key: 'all', label: '所有单据', statuses: allPossibleStatuses },
                { key: 'review', label: '待审核', statuses: ['待SD确认', '待SD确认计划', '待SD关闭'] },
                { key: 'pending', label: '待供应商处理', statuses: ['待提交Action Plan', '待供应商关闭'] },
                { key: 'completed', label: '已完成', statuses: ['已完成', '已作废'] }
            ],
            Admin: [ // Admin
                { key: 'all', label: '所有单据', statuses: allPossibleStatuses },
                { key: 'review', label: '待审核', statuses: ['待SD确认', '待SD确认计划', '待SD关闭'] },
                { key: 'pending', label: '待供应商处理', statuses: ['待提交Action Plan', '待供应商关闭'] },
                { key: 'completed', label: '已完成', statuses: ['已完成', '已作废'] }
            ]
        };
        
        const userTabs = tabsConfig[currentUser.role];
        if (!userTabs) return <Empty description="当前角色没有可显示的标签页。" />; // 增加一个安全检查

        return (
            <Tabs defaultActiveKey={userTabs[0].key} type="card">
                {userTabs.map(tab => {
                    const filteredData = searchedNotices.filter(n => tab.statuses.includes(n.status));
                    const tabGroupedData = groupedNotices.filter(g => g.isBatch ? g.notices.some(n => tab.statuses.includes(n.status)) : tab.statuses.includes(g.status));
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

    // --- 9. (核心) 更新筛选 UI, 添加 Supplier 和 DateRange ---
    return (
        <div style={{ padding: '24px' }}>
            <Card style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div><Title level={4} style={{ margin: 0 }}>整改通知单</Title><Paragraph type="secondary" style={{ margin: 0, marginTop: '4px' }}>审批，点赞和处理通知单</Paragraph></div>
                    <Space wrap>
                        <Select
                            mode="multiple"
                            allowClear
                            style={{ minWidth: 200 }} // 改为 minWidth
                            placeholder="按供应商筛选"
                            value={selectedSuppliers} // 绑定 state
                            onChange={setSelectedSuppliers} // 绑定 state setter
                            options={suppliers.map(s => ({ label: `${s.short_code} (${s.name})`, value: s.id }))} // 使用 suppliers 列表
                            loading={suppliersLoading}
                            maxTagCount="responsive"
                        />
                         <RangePicker 
                            style={{ minWidth: 240 }}
                            value={dateRange} // 绑定 state
                            onChange={setDateRange} // 绑定 state setter
                        />
                        <Select 
                            mode="multiple" 
                            allowClear 
                            style={{ minWidth: 200 }} 
                            placeholder="按问题类型筛选" 
                            onChange={setSelectedCategories} 
                            options={sortedNoticeCategories.map(c => ({ label: c, value: c }))} 
                            loading={configLoading}
                            maxTagCount="responsive"
                        />
                        <Select
                            mode="multiple"
                            allowClear
                            style={{ minWidth: 200 }}
                            placeholder="按状态筛选"
                            onChange={setSelectedStatuses}
                            options={allPossibleStatuses.map(s => ({ label: s, value: s }))}
                            maxTagCount="responsive"
                        />
                        <Search
                            placeholder="搜索..."
                            allowClear
                            onSearch={setSearchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ width: 200 }}
                        />
                        <Tooltip title="按创建日期升序">
                            <Button
                                icon={<SortAscendingOutlined />}
                                onClick={() => setListSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                type={listSortOrder === 'asc' ? 'primary' : 'default'}
                            />
                        </Tooltip>
                        <Tooltip title="按创建日期降序">
                            <Button
                                icon={<SortDescendingOutlined />}
                                onClick={() => setListSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                type={listSortOrder === 'desc' ? 'primary' : 'default'}
                            />
                        </Tooltip>
                    </Space>
                </div>
            </Card>
            <Card>{renderTabs()}</Card>

            <div style={{ textAlign: 'center', marginTop: 24 }}>
                {hasMore ? (
                    <Button
                        onClick={loadMoreNotices}
                        loading={noticesLoading && notices.length > 0}
                    >
                        加载更多
                    </Button>
                ) : (
                    <Text type="secondary">已经到底啦</Text>
                )}
            </div>

            <NoticeDetailModal
                open={!!selectedNotice}
                notice={selectedNotice}
                onCancel={handleDetailModalCancel}
                currentUser={currentUser}
                form={form}

                onPlanSubmit={handlePlanSubmit}
                onPlanApprove={() => handlePlanApprove(selectedNotice)} // 确保传递 notice
                showPlanRejectionModal={() => showRejectionModal(selectedNotice, handlePlanReject)}

                onEvidenceSubmit={handleEvidenceSubmit}
                onClosureApprove={() => handleClosureApprove(selectedNotice)} // 确保传递 notice
                onApproveEvidenceItem={(index) => handleEvidenceItemApprove(index)}
                onRejectEvidenceItem={(index) => setRejectionModal({ visible: true, notice: selectedNotice, handler: (values) => handleEvidenceItemReject(values, index) })}
                onLikeToggle={handleLikeToggle}
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
                suppliers={suppliers} // 确保传递 suppliers
                form={reassignForm}
            />
        </div>
    );
};



export default NoticePage;
