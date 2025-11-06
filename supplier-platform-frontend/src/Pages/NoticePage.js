import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Card, Typography, Table, Tabs, Tag, Space, Button, Modal, Form, Input, message, Spin, Transfer, Select, Radio, Popconfirm, Divider, DatePicker, Tooltip, theme // 1. 引入 DatePicker
} from 'antd';
import { EditOutlined,  StarOutlined, StarFilled, SortAscendingOutlined, SortDescendingOutlined } from '@ant-design/icons';
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


    const navigate = useNavigate();
    const location = useLocation();


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

    const isSDManagerOrAdmin = ['SD', 'Manager', 'Admin'].includes(currentUser.role);

    // --- 6. 为 Supplier 和 DateRange 添加 State ---
    const [selectedSuppliers, setSelectedSuppliers] = useState([]);
    const [dateRange, setDateRange] = useState(null);

    const managedSuppliers = useMemo(() => {
        if (!currentUser || !suppliers) return [];
        if (currentUser.role === 'Manager' || currentUser.role === 'Admin') {
            return suppliers;
        }
        if (currentUser.role === 'SD') {
            const managed = currentUser.managed_suppliers || [];
            return managed.map(assignment => assignment.supplier).filter(Boolean);
        }
        return [];
    }, [currentUser, suppliers]);

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
            messageApi.info(`已为您筛选 ${preSelectedYear}年${preSelectedMonth}月 ${suppliers.find(s => s.id === preSelectedSupplierId)?.short_code || ''} 的相关通知单。`);

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


    const sortedNoticeCategories = useMemo(() => {
        if (!noticeCategories || noticeCategories.length === 0) {
            return [];
        }
        const target = "Process Audit"; // 您想要置顶的项
        // 如果目标项存在于数组中，则将其置顶
        if (noticeCategories.includes(target)) {
            return [target, ...noticeCategories.filter(item => item !== target)];
        }
        // 如果不存在，则返回原始顺序
        return noticeCategories;
    }, [noticeCategories]); // 依赖于从 Context 获取的原始分类列表


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


    // --- 核心修正：在这里实现全新的、智能的分组逻辑 ---
    const groupedNotices = useMemo(() => {
        const batchGroups = {}; // 用于存放真正的批量任务
        const dailyGroups = {}; // 用于存放按“供应商+日期”分组的单个任务

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

        // 排序逻辑 (保持不变)
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
    }, [searchedNotices, listSortOrder]); // <-- 确保依赖项正确


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

    // --- 核心修正：新增 useEffect 来实时同步 selectedNotice ---
    useEffect(() => {


        if (selectedNotice) {

            const updatedVersion = notices.find(n => n.id === selectedNotice.id);
            if (updatedVersion) {

                // 比较新旧数据，看是否真的有变化
                if (JSON.stringify(updatedVersion) !== JSON.stringify(selectedNotice)) {

                    setSelectedNotice(updatedVersion);
                }
            }
        }
    }, [notices]);

    // --- 弹窗与通用 Handler ---
    const showDetailsModal = (notice) => {
        form.resetFields(); // 每次打开都重置表单
        const history = notice.history || [];
        const lastHistory = history[history.length - 1];

        console.log('通知单',notice)

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
    // --- 核心业务处理函数 (精简版) ---

    // 1. 供应商提交行动计划
    const handlePlanSubmit = async (values) => {
        const notice = selectedNotice;
        if (!notice) return;
        const formattedPlans = (values.actionPlans || []).map(p => ({ ...p, deadline: p.deadline ? dayjs(p.deadline).format('YYYY-MM-DD') : '' }));
        const newHistory = { type: 'supplier_plan_submission', submitter: currentUser.name, time: dayjs().format('YYYY-MM-DD HH:mm:ss'), description: '供应商已提交行动计划。', actionPlans: formattedPlans };
        const currentHistory = Array.isArray(notice.history) ? notice.history : [];
        await updateNotice(notice.id, { status: '待SD确认', history: [...currentHistory, newHistory] });
        // 发送提醒
        messageApi.success('行动计划提交成功！');
        handleDetailModalCancel();
    };

    // 2. SD 批准行动计划（支持从弹窗或列表快捷操作触发）
    const handlePlanApprove = async (targetNotice) => {

        //selectedNotice 这个 state 中已经存储了我们正在操作的、完整的通知单对象
        const notice = targetNotice;
        if (!notice) return;

        // 使用 (notice.history || []) 来确保我们总是在操作一个数组
        const lastPlanSubmission = [...(notice.history || [])].reverse().find(h => h.type === 'supplier_plan_submission');

        console.log(notice.history)
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

        // 再次使用 (notice.history || []) 来确保安全
        const currentHistory = notice.history || [];
        await updateNotice(notice.id, { status: '待供应商关闭', history: [...currentHistory, newHistory] });

        // 发送传统提醒


        // 发送新的结构化提醒

        messageApi.success('计划已批准！');
        handleDetailModalCancel();
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
            await updateNotice(notice.id, { status: '待提交Action Plan', history: [...currentHistory, newHistory] });
            // 发送提醒
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

        // 1. --- 开始加载，显示“处理中”，并持续到整个函数结束 ---
        messageApi.loading({ content: '正在提交证据...', key: 'evidenceSubmit' });

        try {
            // 2. --- 查找需要附上证据的原始行动计划 ---
            const lastPlanSubmission = [...notice.history].reverse().find(h => h.type === 'supplier_plan_submission');
            const originalPlans = lastPlanSubmission?.actionPlans || [];

            // 3. --- 异步处理所有图片和附件文件 ---
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

                    // 将证据信息合并回每个行动计划中
                    return {
                        ...plan,
                        evidenceDescription: evidenceItem?.description || '',
                        evidenceImages: processedImages,
                        evidenceAttachments: processedAttachments, // <-- 确保附件也被包含
                    };
                })
            );

            // 4. --- 创建新的历史记录 ---
            const newHistory = {
                type: 'supplier_evidence_submission',
                submitter: currentUser.name,
                time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                description: '供应商已上传完成证据。',
                actionPlans: plansWithEvidence
            };
            const currentHistory = Array.isArray(notice.history) ? notice.history : [];

            // 5. --- 更新数据库中的通知单 ---
            await updateNotice(notice.id, {
                status: '待SD关闭',
                history: [...currentHistory, newHistory]
            });

            // 6. --- 发送实时提醒 ---


            // 7. --- 所有操作成功后，才显示成功消息并关闭弹窗 ---
            messageApi.success({ content: '完成证据提交成功！', key: 'evidenceSubmit', duration: 2 });
            handleDetailModalCancel();

        } catch (error) {
            // 8. --- 如果中间任何一步出错，显示失败消息 ---
            console.error("证据提交失败:", error);
            messageApi.error({ content: `提交失败: ${error.message}`, key: 'evidenceSubmit', duration: 3 });
        }
    };
    // 5. SD 批准并关闭（支持从弹窗或列表快捷操作触发）
    const handleClosureApprove = async (targetNotice) => {
        const notice = targetNotice || selectedNotice;
        if (!notice) return;
        const newHistory = { type: 'sd_closure_approve', submitter: currentUser.name, time: dayjs().format('YYYY-MM-DD HH:mm:ss'), description: '审核通过，问题关闭。' };
        const currentHistory = Array.isArray(notice.history) ? notice.history : [];
        await updateNotice(notice.id, { status: '已完成', history: [...currentHistory, newHistory] });
        // 发送提醒
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
        await updateNotice(notice.id, { status: '待供应商关闭', history: [...currentHistory, newHistory] });
        // 发送提醒
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
            // 发送提醒
            messageApi.success('该条证据已批准，所有证据均通过，单据已关闭！');
            handleDetailModalCancel();
        } else {
            await updateNotice(notice.id, { history: newFullHistory });
            // 发送提醒
            messageApi.success('该条证据已批准');
            // Refresh the modal with updated data
            setSelectedNotice({ ...notice, history: newFullHistory });
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

        await updateNotice(notice.id, { status: '待供应商关闭', history: [...newFullHistory, rejectionHistory] });

        //发送提醒
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

        // --- 在这里找到新旧供应商对应的用户ID ---
        const oldSupplierUser = allUsers.find(u => u.supplier_id === notice.assignedSupplierId);
        const newSupplierUser = allUsers.find(u => u.supplier_id === newSupplier.id);

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

        // --- 使用正确的用户ID发送提醒 ---
        //提醒


        messageApi.success('通知单已成功重分配！');
        setCorrectionModal({ visible: false, notice: null });
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


        messageApi.warning('通知单已作废！');
        setCorrectionModal({ visible: false, notice: null }); // 关闭修正弹窗
        reassignForm.resetFields();
    };


    const handleLikeToggle = async (notice) => {
        const currentLikes = notice.likes || [];
        const userId = currentUser.id;
        const isLiked = currentLikes.includes(userId);
        const newLikesArray = isLiked ? currentLikes.filter(id => id !== userId) : [...currentLikes, userId];
        // const newHistoryEntry = { type: isLiked ? 'unlike' : 'like', submitter: currentUser.name, time: dayjs().format('YYYY-MM-DD HH:mm:ss') };
        // const updatedHistory = [...(notice.history || []), newHistoryEntry];

        // --- 核心修正：直接使用 updateNotice Hook ---
        try {
            await updateNotice(notice.id, { likes: newLikesArray });
            messageApi.success(isLiked ? '已取消点赞' : '感谢您的认可！');
        } catch (error) {
            messageApi.error(`操作失败: ${error.message}`);
        }
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
        const isSDOrManager = currentUser && (currentUser.role === 'SD' || currentUser.role === 'Manager');
        const isAllowedToEdit = currentUser && (currentUser.role === 'SD' || currentUser.role === 'Manager' || currentUser.role === 'Admin');
        const canEdit = item.status === '待提交Action Plan';
        const isManager = currentUser && currentUser.role === 'Manager';
        const stopPropagationAndRun = (e, func) => { e?.stopPropagation(); func(); };

        if (isAllowedToEdit) {
            // --- 核心修正：修改此按钮的 onClick ---
            actions.push(
                <Button
                    key="edit"
                    icon={<EditOutlined />}
                    type="link"
                    disabled={!canEdit}
                    onClick={(e) => stopPropagationAndRun(e, () => navigate(`/edit-notice/${item.id}`))} // <-- 指向新的路由
                >
                    修改
                </Button>
            );
        }

        // SD 和 Manager 的快捷操作
        if (currentUser.role === 'SD' || currentUser.role === 'Manager') {
            // 审批计划阶段（兼容不同文案）
            if (item.status === '待SD确认' || item.status === '待SD确认计划') {
                actions.push(<Button key="quick_approve_plan" type="link" onClick={(e) => stopPropagationAndRun(e, () => handlePlanApprove(item))}>批准计划</Button>);
                actions.push(<Button key="quick_reject_plan" type="link" danger onClick={(e) => stopPropagationAndRun(e, () => showRejectionModal(item, handlePlanReject))}>驳回计划</Button>);
            }
            // 关闭阶段
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

        // 管理员的修正/撤回按钮 (如果需要)
        if (currentUser.role === 'Manager' && item.status !== '已完成' && item.status !== '已作废') {
            actions.push(<Button key="correct" type="link" style={{ color: token.colorWarning }} onClick={(e) => stopPropagationAndRun(e, () => setCorrectionModal({ visible: true, notice: item }))}>修正/撤回</Button>);
        }

        return actions;
    };

    const renderTabs = () => {
        if (!currentUser) return <p>请先登录</p>;
        if (configLoading || noticesLoading) { return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}><Spin size="large" /></div>; }

        if (noticesLoading && notices.length === 0) {
            return <div><Spin size="large" /></div>;
        }

        const tabsConfig = {
            Supplier: [
                { key: 'pending', label: '待我处理', statuses: ['待提交Action Plan', '待供应商关闭'] },
                { key: 'review', label: '等待审核', statuses: ['待SD确认', '待SD确认计划', '待SD关闭'] },
                { key: 'completed', label: '已完成', statuses: ['已完成', '已作废'] }
            ],
            SD: [
                { key: 'pending', label: '待提交Action Plan', statuses: ['待提交Action Plan', '待供应商关闭'] },
                { key: 'review', label: '待SD确认', statuses: ['待SD确认', '待SD确认计划', '待SD关闭'] },
                { key: 'completed', label: '已完成', statuses: ['已完成', '已作废'] },
                { key: 'all', label: '所有单据', statuses: allPossibleStatuses }
            ],
            Manager: [
                { key: 'all', label: '所有单据', statuses: allPossibleStatuses },
                { key: 'review', label: '待审核', statuses: ['待SD确认', '待SD确认计划', '待SD关闭'] },
                { key: 'pending', label: '待提交Action Plan', statuses: ['待提交Action Plan', '待供应商关闭'] },
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
                    <div><Title level={4} style={{ margin: 0 }}>整改通知单</Title><Paragraph type="secondary" style={{ margin: 0, marginTop: '4px' }}>审批，点赞和处理通知单</Paragraph></div>

                    <Space wrap>
                        {isSDManagerOrAdmin && (
                            <Select
                                mode="multiple"
                                allowClear
                                style={{ minWidth: 200 }} // 改为 minWidth
                                placeholder="按供应商筛选"
                                value={selectedSuppliers} // 绑定 state
                                onChange={setSelectedSuppliers} // 绑定 state setter
                                loading={suppliersLoading}
                                maxTagCount="responsive"
                                showSearch // 明确开启搜索功能

                                // --- 核心修正 1：在这里组合 label ---
                                options={managedSuppliers.map(s => ({
                                    value: s.id,
                                    label: `${s.short_code}` // 例如: "CVG (CVI-CVG)"
                                }))}

                                // --- 核心修正 2：使用 Antd 的默认智能筛选 ---
                                filterOption={(input, option) =>
                                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                            />
                        )}
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
                            placeholder="可用;；@,，分隔关键词"
                            allowClear
                            onSearch={setSearchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ width: 220 }}
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