import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    Card, Row, Col, Statistic, Typography, List, Empty, Avatar, Tooltip, 
    Button, Divider, Space, Select, Popconfirm, Tour, Skeleton, Tag, message 
} from 'antd';
import { 
    ClockCircleOutlined, CheckCircleOutlined, StarOutlined, UserOutlined, 
    CalendarOutlined, AuditOutlined, TeamOutlined, ReconciliationOutlined, 
    UndoOutlined, DeleteOutlined, WarningOutlined, ScheduleOutlined, 
    FileTextOutlined, QuestionCircleOutlined 
} from '@ant-design/icons';
import dayjs from 'dayjs';
import minMax from 'dayjs/plugin/minMax';
import { useNavigate } from 'react-router-dom';
import { useNotices } from '../contexts/NoticeContext';
// ❌ 已移除: import { supabase } from '../supabaseClient';
import { useSuppliers } from '../contexts/SupplierContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';

dayjs.extend(minMax);

const { Title, Paragraph, Text } = Typography;

// 🔧 动态配置 API 地址
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_URL = isDev
    ? 'http://localhost:3001'
    : 'http://supplier-interaction-platform-backend.vercel.app'; 

// --- 辅助函数 ---
const getPlanIcon = (type) => {
    switch (type) {
        case 'audit': return <AuditOutlined style={{ color: '#1890ff' }} />;
        case 'qrm': return <TeamOutlined style={{ color: '#faad14' }} />;
        case 'quality_review': return <ReconciliationOutlined style={{ color: '#52c41a' }} />;
        default: return <CalendarOutlined />;
    }
};

// --- 子组件: PlanItem (保持在同一文件) ---
const PlanItem = ({ plan, onMarkComplete, onDelete, onNavigate, onReschedule }) => {
    const [targetDateStr, setTargetDateStr] = useState(null); 

    const handleConfirmReschedule = () => {
        if (targetDateStr) {
            const [year, month] = targetDateStr.split('-').map(Number);
            onReschedule(plan, month, year); 
            setTargetDateStr(null);
        }
    };

    const monthOptions = useMemo(() => {
        const options = [];
        let current = dayjs().startOf('month');
        for (let i = 0; i < 12; i++) {
            const val = current.add(i, 'month');
            const year = val.year();
            const month = val.month() + 1;
            const label = `${year}年${month}月`;
            const value = `${year}-${month}`;
            const disabled = plan.year === year && plan.planned_month === month;
            options.push({ label, value, disabled });
        }
        return options;
    }, [plan.year, plan.planned_month]);

    const rescheduleTitle = (
        <div style={{ width: 180 }} onClick={(e) => e.stopPropagation()}>
            <Text>移动到:</Text>
            <Select
                placeholder="选择月份"
                style={{ width: '100%', marginTop: 8 }}
                value={targetDateStr}
                onChange={(value) => setTargetDateStr(value)}
                onClick={(e) => e.stopPropagation()}
                getPopupContainer={(triggerNode) => triggerNode.parentNode}
                options={monthOptions}
            />
        </div>
    );

    const itemContent = (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '4px 8px', border: '1px solid #f0f0f0', borderRadius: '4px', marginBottom: '4px', backgroundColor: '#fff' }}>
             <Space>
                {getPlanIcon(plan.type)}
                <div>
                    <Text strong style={{ fontSize: '12px', display: 'block' }} ellipsis={{ tooltip: plan.supplier_name }}>
                        {plan.supplier_display_name}
                    </Text>
                    <Text type="secondary" style={{ fontSize: '11px', display: 'block' }} ellipsis={{ tooltip: `[${plan.category}] - ${plan.auditor}` }}>
                        {`[${plan.category}] - ${plan.auditor}`}
                    </Text>
                </div>
            </Space>
            <Space size={0}>
                 <Tooltip title="查找相关通知单">
                    <Button type="text" size="small" icon={<FileTextOutlined />} style={{ color: '#595959' }} onClick={(e) => { e.stopPropagation(); onNavigate(plan); }} />
                </Tooltip>
                <Tooltip title="调整计划月份">
                    <Popconfirm
                        title={rescheduleTitle}
                        onConfirm={handleConfirmReschedule}
                        onCancel={() => setTargetDateStr(null)}
                        okText="移动"
                        cancelText="取消"
                        disabled={plan.status === 'completed'}
                    >
                        <Button type="text" size="small" icon={<CalendarOutlined />} style={{ color: '#1890ff' }} disabled={plan.status === 'completed'} />
                    </Popconfirm>
                </Tooltip>
                <Tooltip title="标记完成/待办">
                    <Popconfirm title={`标记为 ${plan.status === 'pending' ? '已完成' : '待办'}?`} onConfirm={() => onMarkComplete(plan.id, plan.status)}>
                        <Button type="text" size="small" icon={plan.status === 'pending' ? <CheckCircleOutlined style={{ color: 'grey' }} /> : <UndoOutlined />} style={{ color: plan.status === 'pending' ? '#1890ff' : '#8c8c8c' }} />
                    </Popconfirm>
                </Tooltip>
                 <Popconfirm title="确定删除?" onConfirm={() => onDelete(plan.id)}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
            </Space>
        </div>
    );

    if (plan.comment && plan.comment.trim()) {
        return <Tooltip title={<><b>备注:</b> {plan.comment}</>} placement="topLeft">{itemContent}</Tooltip>;
    }
    return itemContent;
};

// --- 主组件: DashboardPage ---
const DashboardPage = () => {
    const navigate = useNavigate();
    const { t, language } = useLanguage();
    const { notices, loading: noticesLoading } = useNotices();
    const [allUsers, setAllUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const { suppliers, loading: suppliersLoading } = useSuppliers();
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

    const [allPendingPlans, setAllPendingPlans] = useState([]);
    const [allPlansLoading, setAllPlansLoading] = useState(true);

    const { messageApi } = useNotification();

    const [planCategories, setPlanCategories] = useState([]);
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    const [selectedPlanCategory, setSelectedPlanCategory] = useState('all');
    const [selectedPlanSupplier, setSelectedPlanSupplier] = useState('all');

    const refCoreMetrics = useRef(null);
    const refMonthlyPlan = useRef(null);
    const refWarnings = useRef(null);
    const refHighlights = useRef(null);
    const [openTour, setOpenTour] = useState(false);

    const managedSuppliers = useMemo(() => {
        if (!currentUser || !suppliers) return [];
        if (currentUser.role === 'Manager' || currentUser.role === 'Admin') {
            return suppliers;
        }
        if (currentUser.role === 'SD') {
            const managed = currentUser.managed_suppliers || [];
            // 兼容可能的数据结构差异
            const managedIds = managed.map(m => m.supplier_id || m.supplier?.id || m);
            return suppliers.filter(s => managedIds.includes(s.id));
        }
        return [];
    }, [currentUser, suppliers]);

    // --- API Handlers (替换 Supabase) ---

    // 1. 标记完成
    const handleMarkAsComplete = async (id, currentStatus) => {
        const newStatus = currentStatus === 'pending' ? 'completed' : 'pending';
        const completionDate = newStatus === 'completed' ? dayjs().format('YYYY-MM-DD') : null;
        
        try {
            const response = await fetch(`${BACKEND_URL}/api/audit-plans`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id, 
                    updates: { status: newStatus, completion_date: completionDate } 
                })
            });

            if (!response.ok) throw new Error('Update failed');

            messageApi.success('状态更新成功！');
            setAllPendingPlans(prevPlans => prevPlans.filter(p => p.id !== id));
        } catch (error) {
            messageApi.error(`更新状态失败: ${error.message}`);
        }
    };

    // 2. 删除计划
    const handleDeleteEvent = async (id) => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/audit-plans?id=${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Delete failed');

            messageApi.success('事件已删除！');
            setAllPendingPlans(prevPlans => prevPlans.filter(p => p.id !== id));
        } catch (error) {
            messageApi.error(`删除失败: ${error.message}`);
        }
    };

    const handleNavigateToNotices = (plan) => {
        if (!plan.supplier_id || !plan.planned_month || !plan.year) {
            messageApi.error("无法跳转，计划信息不完整。");
            return;
        }
        navigate('/notices', {
            state: {
                preSelectedSupplierId: plan.supplier_id,
                preSelectedMonth: plan.planned_month,
                preSelectedYear: plan.year,
            }
        });
    };

    // 3. 调整计划 (PATCH)
    const handleReschedule = async (item, newMonth, newYear) => {
        if (!newMonth || !newYear) {
            messageApi.error("请选择一个新的月份！");
            return;
        }
        if (newMonth === item.planned_month && newYear === item.year) return;

        const oldMonth = item.planned_month;
        const oldYear = item.year;
        const key = `reschedule-${item.id}`;

        setAllPendingPlans(prevPlans =>
            prevPlans.map(p =>
                p.id === item.id ? { ...p, planned_month: newMonth, year: newYear } : p
            )
        );
        messageApi.loading({ content: '正在移动计划...', key });

        try {
            const response = await fetch(`${BACKEND_URL}/api/audit-plans`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id: item.id, 
                    updates: { planned_month: newMonth, year: newYear } 
                })
            });

            if (!response.ok) throw new Error('Reschedule failed');

            messageApi.success({ content: `计划已成功移动到 ${newYear}年${newMonth}月！`, key });
        } catch (error) {
            messageApi.error({ content: `计划调整失败: ${error.message}`, key });
            // 回滚
            setAllPendingPlans(prevPlans =>
                prevPlans.map(p =>
                    p.id === item.id ? { ...p, planned_month: oldMonth, year: oldYear } : p
                )
            );
        }
    };

    // --- API Fetching Effects ---

    // 1. Fetch Users
    useEffect(() => {
        const fetchUsers = async () => {
            setUsersLoading(true);
            try {
                // 使用新增的 API 参数 action=all_users
                const response = await fetch(`${BACKEND_URL}/api/users?action=all_users`);
                if (!response.ok) throw new Error('Fetch users failed');
                const data = await response.json();
                setAllUsers(data || []);
            } catch (error) {
                console.error("仪表盘获取用户列表失败:", error);
            } finally {
                setUsersLoading(false);
            }
        };
        fetchUsers();
    }, []);

    // 2. Fetch Categories
    useEffect(() => {
        const fetchCategories = async () => {
            setCategoriesLoading(true);
            try {
                // 复用 config 接口
                const response = await fetch(`${BACKEND_URL}/api/config`);
                if (!response.ok) throw new Error('Fetch config failed');
                const data = await response.json();
                const categoriesData = Array.isArray(data) ? data : (data.categories || []);

                setPlanCategories((categoriesData || []).sort((a, b) => {
                    const order = { "Process Audit": 1, "SEM": 2 };
                    const aOrder = order[a.name] || Infinity;
                    const bOrder = order[b.name] || Infinity;
                    return aOrder - bOrder;
                }));
            } catch (error) {
                console.error("获取问题类型列表失败:", error);
            } finally {
                setCategoriesLoading(false);
            }
        };
        fetchCategories();
    }, []);

    // 3. Fetch Plans
    useEffect(() => {
        if (!currentUser || !['SD', 'Manager', 'Admin'].includes(currentUser.role)) {
            setAllPlansLoading(false);
            return;
        }

        const fetchAllPendingPlans = async () => {
            setAllPlansLoading(true);
            try {
                const currentYear = dayjs().year();
                // 使用新增的 min_year 和 status_neq 参数
                const response = await fetch(`${BACKEND_URL}/api/audit-plans?min_year=${currentYear}&status_neq=completed`);
                
                if (!response.ok) throw new Error('Fetch plans failed');
                const data = await response.json();

                if (currentUser.role === 'SD') {
                    if (!suppliersLoading) {
                        const managedSupplierIds = new Set(managedSuppliers.map(s => s.id));
                        setAllPendingPlans((data || []).filter(plan => managedSupplierIds.has(plan.supplier_id)));
                    } else {
                        setAllPendingPlans([]);
                    }
                } else {
                    setAllPendingPlans(data || []);
                }
            } catch (error) {
                console.error("获取计划失败:", error);
                setAllPendingPlans([]);
            } finally {
                if (currentUser.role !== 'SD' || !suppliersLoading) setAllPlansLoading(false);
            }
        };

        if (!(currentUser.role === 'SD' && suppliersLoading)) {
            fetchAllPendingPlans();
        }

    }, [currentUser, suppliers, suppliersLoading, managedSuppliers]);


    // --- 逻辑计算 (保持不变) ---
    const userLookup = useMemo(() => {
        return allUsers.reduce((acc, user) => {
            acc[user.id] = user;
            return acc;
        }, {});
    }, [allUsers]);

    const planStatistics = useMemo(() => {
        const now = dayjs();
        const currentMonthStart = now.startOf('month');
        const nextMonthStart = now.add(1, 'month').startOf('month');
        
        let overduePastPlansCount = 0;
        let pendingCurrentMonthPlansCount = 0;

        const currentAndPastPlansList = [];
        const pendingNextMonthPlansList = [];

        allPendingPlans.forEach(plan => {
            const supplier = suppliers.find(s => s.id === plan.supplier_id);
            const enrichedPlan = {
                ...plan,
                supplier_display_name: supplier?.short_code || plan.supplier_name
            };

            const planDate = dayjs(`${plan.year}-${plan.planned_month}-01`);

            if (planDate.isBefore(currentMonthStart)) {
                overduePastPlansCount++;
                currentAndPastPlansList.push(enrichedPlan);
            }
            else if (planDate.isSame(currentMonthStart, 'month')) {
                pendingCurrentMonthPlansCount++;
                currentAndPastPlansList.push(enrichedPlan);
            }
            else if (planDate.isSame(nextMonthStart, 'month')) {
                pendingNextMonthPlansList.push(enrichedPlan);
            }
        });

        const filterPlans = (plan) => {
            if (selectedPlanCategory !== 'all' && plan.category !== selectedPlanCategory) return false;
            if (selectedPlanSupplier !== 'all' && plan.supplier_id !== selectedPlanSupplier) return false;
            return true;
        };

        return {
            overduePastPlans: overduePastPlansCount,
            pendingCurrentMonthPlans: pendingCurrentMonthPlansCount,
            pendingNextMonthPlans: pendingNextMonthPlansList.length,
            filteredCurrentAndPastPlansForList: currentAndPastPlansList.filter(filterPlans),
            filteredNextMonthPlansForList: pendingNextMonthPlansList.filter(filterPlans)
        };
    }, [allPendingPlans, selectedPlanCategory, selectedPlanSupplier, suppliers]);


    const dashboardData = useMemo(() => {
        if (noticesLoading || usersLoading || suppliersLoading) return null;

        let baseData = [];
        if (currentUser) {
            if (currentUser.role === 'Manager' || currentUser.role === 'Admin') {
                baseData = notices;
            } else if (currentUser.role === 'SD') {
                const managedSupplierIds = new Set(managedSuppliers.map(s => s.id));
                baseData = notices.filter(n =>
                    (n.creatorId === currentUser.id || managedSupplierIds.has(n.assignedSupplierId)) &&
                    n.creator
                );
            } else if (currentUser.role === 'Supplier') {
                baseData = notices.filter(n => n.assignedSupplierId === currentUser.supplier_id);
            }
        }

        const now = dayjs();
        const startOfMonth = now.startOf('month');
        const thirtyDaysAgo = now.subtract(30, 'day');
        const thirtyDaysFromNow = now.add(30, 'day');

        const baseDataWithDeadline = baseData.map(notice => {
             const history = Array.isArray(notice.history) ? notice.history : [];
             const latestPlanSubmission = [...history].reverse().find(h => h.type === 'supplier_plan_submission' && h.actionPlans && h.actionPlans.length > 0);
             let latestDeadline = 'N/A';
             if (latestPlanSubmission) {
                 const deadlines = latestPlanSubmission.actionPlans.map(p => dayjs(p.deadline)).filter(d => d.isValid());
                 if (deadlines.length > 0) {
                     latestDeadline = dayjs.max(deadlines).format('YYYY-MM-DD');
                 }
             }
             return { ...notice, deadline: latestDeadline };
        });

        const closedThisMonth = baseDataWithDeadline.filter(n => {
            if (n.status !== '已完成') return false;
            const history = Array.isArray(n.history) ? n.history : [];
            const closingEvent = [...history].reverse().find(h => h.type === 'sd_closure_approve');
            return closingEvent && dayjs(closingEvent.time).isAfter(startOfMonth);
        }).length;

        const allOpenIssues = baseDataWithDeadline.filter(n => !['已完成', '已作废'].includes(n.status)).length;

        const recentPendingIssues = baseDataWithDeadline.filter(n =>
            !['已完成', '已作废'].includes(n.status) &&
            dayjs(n.createdAt).isAfter(thirtyDaysAgo)
        ).length;

        const pendingEvidenceNext30Days = baseDataWithDeadline.filter(n => {
            const deadlineDate = dayjs(n.deadline);
            return n.status === '待供应商关闭' &&
                n.deadline !== 'N/A' &&
                deadlineDate.isAfter(now) &&
                deadlineDate.isBefore(thirtyDaysFromNow);
        }).length;

        const pendingForSupplier = baseDataWithDeadline.filter(n =>
            !['已完成', '已作废'].includes(n.status) &&
            dayjs(n.createdAt).isAfter(thirtyDaysAgo)
        );

        const supplierActionRequired = Object.entries(
            pendingForSupplier.reduce((acc, notice) => {
                const supplierInfo = suppliers.find(s => s.id === notice.assignedSupplierId);
                const name = supplierInfo?.short_code || notice.assignedSupplierName || '未知供应商';
                if (!acc[name]) acc[name] = { count: 0, id: notice.assignedSupplierId };
                acc[name].count++;
                return acc;
            }, {})
        ).map(([name, data]) => ({ name, count: data.count, id: data.id }))
            .sort((a, b) => b.count - a.count);


        const topImprovement = notices
            .filter(n => n.status === '已完成' && n.likes && n.likes.length > 0)
            .map(n => ({ ...n, supplier: suppliers.find(s => s.id === n.assignedSupplierId) }))
            .sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0))[0];

        return {
            closedThisMonth,
            allOpenIssues,
            supplierActionRequired,
            topImprovement,
            recentPendingIssues,
            pendingEvidenceNext30Days
        };

    }, [notices, allUsers, suppliers, noticesLoading, usersLoading, suppliersLoading, currentUser, managedSuppliers]);


    const isSDManagerOrAdmin = ['SD', 'Manager', 'Admin'].includes(currentUser.role);
    const nextMonthTitle = t('dashboard.list.nextMonthPending');

    const tourSteps = [
        {
            title: t('tour.step1.title'),
            description: t('tour.step1.desc'),
            target: () => refCoreMetrics.current,
        },
        ...(isSDManagerOrAdmin ? [{
            title: t('tour.step2.title'),
            description: t('tour.step2.desc'),
            target: () => refMonthlyPlan.current,
        }] : []),
        {
            title: t('tour.step3.title'),
            description: t('tour.step3.desc'),
            target: () => refWarnings.current,
        },
        {
            title: t('tour.step4.title'),
            description: t('tour.step4.desc'),
            target: () => refHighlights.current,
        },
    ];
    
    const pageIsLoading = noticesLoading || usersLoading || suppliersLoading || allPlansLoading;

    // --- Loading UI (内联 Skeleton) ---
    if (pageIsLoading && !dashboardData) {
        return (
            <div>
                {/* Header Skeleton */}
                <Card style={{ marginBottom: 24 }} bordered={false}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <Skeleton active paragraph={{ rows: 1 }} title={{ width: 150 }} />
                        </div>
                        <Skeleton.Button active shape="default" size="default" />
                    </div>
                </Card>

                {/* Metrics Skeleton */}
                <Row gutter={[24, 24]} align="stretch">
                    <Col xs={24} md={isSDManagerOrAdmin ? 12 : 24} lg={12}>
                        <Card bordered={false} style={{ height: '100%' }}>
                            <Skeleton active paragraph={{ rows: 0 }} title={{ width: 100 }} />
                            <Row gutter={[16, 24]} style={{ marginTop: 20 }}>
                                {[1, 2, 3, 4].map(i => (
                                    <Col xs={12} sm={12} key={i}>
                                        <Skeleton.Node active style={{ width: '100%', height: 80 }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <Skeleton.Avatar active shape="circle" size="small" />
                                                <div style={{ marginLeft: 10 }}>
                                                    <Skeleton.Button active size="small" style={{ width: 60, marginBottom: 5 }} block={false} />
                                                    <Skeleton.Input active size="small" style={{ width: 40 }} />
                                                </div>
                                            </div>
                                        </Skeleton.Node>
                                    </Col>
                                ))}
                            </Row>
                        </Card>
                    </Col>

                    {isSDManagerOrAdmin && (
                        <Col xs={24} md={12} lg={12}>
                            <Card bordered={false} style={{ height: '100%' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                                    <Skeleton.Input active style={{ width: 100 }} />
                                    <Space>
                                        <Skeleton.Button active size="small" />
                                        <Skeleton.Button active size="small" />
                                    </Space>
                                </div>
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Skeleton active paragraph={{ rows: 4 }} title={{ width: '60%' }} />
                                    </Col>
                                    <Col span={12}>
                                        <Skeleton active paragraph={{ rows: 4 }} title={{ width: '60%' }} />
                                    </Col>
                                </Row>
                            </Card>
                        </Col>
                    )}
                </Row>

                {/* Bottom Row Skeletons */}
                <Row gutter={[24, 24]} style={{ marginTop: 24 }} align="stretch">
                    <Col xs={24} lg={12}>
                        <Card bordered={false} style={{ height: '100%' }}>
                            <Skeleton active paragraph={{ rows: 0 }} title={{ width: 120 }} />
                            <List
                                dataSource={[1, 2, 3]}
                                renderItem={() => (
                                    <List.Item>
                                        <List.Item.Meta
                                            avatar={<Skeleton.Avatar active shape="circle" />}
                                            title={<Skeleton.Input active style={{ width: 100 }} size="small" />}
                                            description={<Skeleton.Input active style={{ width: 150 }} size="small" />}
                                        />
                                    </List.Item>
                                )}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} lg={12}>
                        <Card bordered={false} style={{ height: '100%' }}>
                            <Skeleton active paragraph={{ rows: 3 }} title={{ width: 120 }} />
                            <Divider />
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <Skeleton.Avatar active shape="circle" size="small" />
                                <Skeleton.Input active style={{ width: 80, marginLeft: 10 }} size="small" />
                                <div style={{ marginLeft: 20, display: 'flex' }}>
                                    {[1, 2, 3].map(i => <Skeleton.Avatar key={i} active size="small" shape="circle" style={{ marginLeft: -8, border: '2px solid white' }} />)}
                                </div>
                            </div>
                        </Card>
                    </Col>
                </Row>
            </div>
        );
    }

    if (!dashboardData) {
        return <div style={{ padding: 24 }}><Empty description="无法加载仪表盘数据，请稍后重试或联系管理员。" /></div>;
    }

    // --- Supplier View (供应商视图) ---
    if (currentUser.role === 'Supplier') {
        const { allOpenIssues, recentPendingIssues, pendingEvidenceNext30Days } = dashboardData;

        const handleStatClick = (statuses, dateRange = null) => {
            const state = {};
            if (statuses && statuses.length > 0) {
                state.preSelectedStatuses = statuses;
            }
            if (dateRange && dateRange.length === 2) {
                state.preSelectedDateRange = dateRange;
            }
            navigate('/notices', { state });
        };

        return (
            <div>
                <Card style={{ marginBottom: 24 }} bordered={false}>
                    <Title level={4} style={{ margin: 0 }}>我的仪表盘</Title>
                    <Paragraph type="secondary" style={{ margin: 0, marginTop: '4px' }}>查看与您公司相关的核心问题指标。</Paragraph>
                </Card>
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} lg={8}>
                        <Card
                            hoverable
                            bordered={false}
                            loading={pageIsLoading}
                            onClick={() => handleStatClick(['待提交Action Plan', '待供应商关闭'])}
                        >
                            <Statistic
                                title={<Space><ClockCircleOutlined /> 通知单历史未完成</Space>}
                                value={allOpenIssues}
                                valueStyle={{ color: '#faad14' }}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={8}>
                        <Card
                            hoverable
                            bordered={false}
                            loading={pageIsLoading}
                            onClick={() => handleStatClick(
                                ['待提交Action Plan', '待供应商关闭'],
                                [dayjs().subtract(30, 'day'), dayjs()]
                            )}
                        >
                            <Statistic
                                title={<Space><WarningOutlined /> 最近30天未完成</Space>}
                                value={recentPendingIssues}
                                valueStyle={{ color: '#f5222d' }}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={8}>
                        <Card
                            hoverable
                            bordered={false}
                            loading={pageIsLoading}
                            onClick={() => handleStatClick(['待供应商关闭'])}
                        >
                            <Statistic
                                title={<Space><ScheduleOutlined /> 未来30天需提交证据</Space>}
                                value={pendingEvidenceNext30Days}
                                valueStyle={{ color: '#1890ff' }}
                            />
                        </Card>
                    </Col>
                </Row>
            </div>
        );
    }

    // --- SD / Manager / Admin View ---
    const {
        closedThisMonth,
        allOpenIssues,
        supplierActionRequired,
        topImprovement
    } = dashboardData;

    const {
        overduePastPlans,
        pendingCurrentMonthPlans,
        filteredCurrentAndPastPlansForList,
        filteredNextMonthPlansForList
    } = planStatistics;

  return (
         <div>
             <Card style={{ marginBottom: 24 }} bordered={false}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <div>
                         <Title level={4} style={{ margin: 0 }}>{t('dashboard.opsDashboard')}</Title>
                         <Paragraph type="secondary" style={{ margin: 0, marginTop: '4px' }}>{t('dashboard.opsDashboardDesc')}</Paragraph>
                     </div>
                     <Button icon={<QuestionCircleOutlined />} onClick={() => setOpenTour(true)}>{t('dashboard.tourButton')}</Button>
                 </div>
             </Card>
 
             <Row gutter={[24, 24]} align="stretch">
                 <Col xs={24} md={isSDManagerOrAdmin ? 12 : 24} lg={12}>
                     <div ref={refCoreMetrics} style={{ height: '100%' }}>
                         <Card bordered={false} loading={pageIsLoading || allPlansLoading} style={{ height: '100%' }} title={t('dashboard.coreMetrics')}>
                             <Row gutter={[16, 24]}>
                                 <Col xs={12} sm={12}>
                                     <Statistic title={t('dashboard.stat.closedMonth')} value={closedThisMonth} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
                                 </Col>
                                 <Col xs={12} sm={12}>
                                     <Statistic title={t('dashboard.stat.allOpen')} value={allOpenIssues} valueStyle={{ color: '#faad14' }} prefix={<ClockCircleOutlined />} />
                                 </Col>
                                 <Col xs={12} sm={12}>
                                     <Statistic title={t('dashboard.stat.planOverdue')} value={overduePastPlans} valueStyle={{ color: '#f5222d' }} prefix={<WarningOutlined />} />
                                 </Col>
                                 <Col xs={12} sm={12}>
                                     <Statistic title={t('dashboard.stat.planPending')} value={pendingCurrentMonthPlans} valueStyle={{ color: '#faad14' }} prefix={<ScheduleOutlined />} />
                                 </Col>
                             </Row>
                         </Card>
                     </div>
                 </Col>
 
                 {isSDManagerOrAdmin && (
                     <Col xs={24} md={12} lg={12}>
                         <div ref={refMonthlyPlan} style={{ height: '100%' }}>
                             <Card
                                 title={t('dashboard.monthlyPlan')}
                                 bordered={false}
                                 loading={allPlansLoading || categoriesLoading}
                                 style={{ height: '100%' }}
                                 extra={
                                     <Space wrap>
                                         <Select
                                             size="small"
                                             style={{ width: 120 }}
                                             placeholder={t('dashboard.filter.bySupplier')}
                                             value={selectedPlanSupplier}
                                             onChange={setSelectedPlanSupplier}
                                             options={[
                                                 { value: 'all', label: t('dashboard.filter.allSuppliers') },
                                                 ...managedSuppliers.map(s => ({ value: s.id, label: s.short_code }))
                                             ]}
                                         />
                                         <Select
                                             size="small"
                                             style={{ width: 120 }}
                                             placeholder={t('dashboard.filter.byType')}
                                             value={selectedPlanCategory}
                                             onChange={setSelectedPlanCategory}
                                             options={[
                                                 { value: 'all', label: t('dashboard.filter.allTypes') },
                                                 ...planCategories.map(c => ({ value: c.name, label: c.name }))
                                             ]}
                                         />
                                     </Space>
                                 }
                             >
                                 <Row gutter={16}>
                                     <Col span={12}>
                                         <Title level={5} style={{ marginTop: 0 }}>
                                             {t('dashboard.list.pastPending')} ({filteredCurrentAndPastPlansForList.length})
                                         </Title>
                                         <div>
                                             {filteredCurrentAndPastPlansForList.length > 0 ? (
                                                 <List
                                                     itemLayout="horizontal"
                                                     dataSource={filteredCurrentAndPastPlansForList}
                                                     renderItem={(plan) => (
                                                         <PlanItem
                                                             plan={plan}
                                                             onMarkComplete={handleMarkAsComplete}
                                                             onDelete={handleDeleteEvent}
                                                             onNavigate={handleNavigateToNotices}
                                                             onReschedule={handleReschedule}
                                                         />
                                                     )}
                                                     pagination={{ pageSize: 3, size: 'small', showLessItems: true }}
                                                 />
                                             ) : (
                                                 <Empty description={t('dashboard.list.noBacklog')} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '20px 0' }} />
                                             )}
                                         </div>
                                     </Col>
                                     <Col span={12}>
                                         <Title level={5} style={{ marginTop: 0 }}>
                                            {nextMonthTitle}({filteredNextMonthPlansForList.length})
                                         </Title>
                                         <div>
                                             {filteredNextMonthPlansForList.length > 0 ? (
                                                 <List
                                                     itemLayout="horizontal"
                                                     dataSource={filteredNextMonthPlansForList}
                                                     renderItem={(plan) => (
                                                         <PlanItem
                                                             plan={plan}
                                                             onMarkComplete={handleMarkAsComplete}
                                                             onDelete={handleDeleteEvent}
                                                             onNavigate={handleNavigateToNotices}
                                                             onReschedule={handleReschedule}
                                                         />
                                                     )}
                                                     pagination={{ pageSize: 3, size: 'small', showLessItems: true }}
                                                 />
                                             ) : (
                                                 <Empty description={t('dashboard.list.noNextMonth')} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '20px 0' }} />
                                             )}
                                         </div>
                                     </Col>
                                 </Row>
                             </Card>
                         </div>
                     </Col>
                 )}
             </Row>
 
             <Row gutter={[24, 24]} style={{ marginTop: 24 }} align="stretch">
                 <Col xs={24} lg={12}>
                     <div ref={refWarnings} style={{ height: '100%' }}>
                         <Card title={t('dashboard.actionAlert')} bordered={false} loading={pageIsLoading} style={{ height: '100%' }}>
                             <List
                                 itemLayout="horizontal"
                                 dataSource={supplierActionRequired}
                                 renderItem={(item) => (
                                     <List.Item>
                                         <List.Item.Meta
                                             avatar={<Avatar style={{ backgroundColor: '#ff4d4f' }} icon={<UserOutlined />} />}
                                             title={<Text strong>{item.name}</Text>}
                                             description={`${item.count} ${t('dashboard.list.itemsPending')}`}
                                         />
                                         <Button
                                             type="link"
                                             onClick={() => navigate('/notices', { state: { preSelectedSupplierId: item.id } })}
                                         >
                                             {t('dashboard.action.process')}
                                         </Button>
                                     </List.Item>
                                 )}
                                 locale={{ emptyText: <Empty description={t('dashboard.empty.noAlerts')} /> }}
                             />
                         </Card>
                     </div>
                 </Col>
                 <Col xs={24} lg={12}>
                     <div ref={refHighlights} style={{ height: '100%' }}>
                         {/* 以下是点赞最多的case显示（未来根据算法计算） */}
                         <Card title={t('dashboard.highlights')} bordered={false} loading={pageIsLoading} style={{ height: '100%' }}>
                             {topImprovement ? (
                                 <div>
                                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                         <Space wrap size="small">
                                             <Tag color="gold">{t('dashboard.tag.from')}: {topImprovement.supplier?.short_code || '?'}</Tag>
                                             <Tag color="green"> {topImprovement.category || '?'}</Tag>
                                             {topImprovement?.sdNotice?.problem_source && <Tag color="geekblue">{topImprovement.sdNotice.problem_source}</Tag>}
                                             {topImprovement?.sdNotice?.cause && <Tag color="purple">{topImprovement.sdNotice.cause}</Tag>}
                                         </Space>
                                         <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/notices?open=${topImprovement.id}`)}>
                                             {t('dashboard.action.viewDetails')}
                                         </Button>
                                     </div>
                                     <Title level={5} style={{ marginTop: 0 }}>{topImprovement.title}</Title>
                                     <Paragraph type="secondary" ellipsis={{ rows: 3, expandable: false }}>
                                         {topImprovement.sdNotice?.title ||topImprovement.sdNotice?.description || topImprovement.sdNotice?.details?.finding || t('dashboard.desc.noDetails')}
                                     </Paragraph>
                                     <Divider style={{ margin: '12px 0' }} />
                                     <Space align="center">
                                         <StarOutlined style={{ color: '#ffc53d' }} />
                                         <Text strong>{topImprovement.likes?.length || 0} {t('dashboard.text.likes')}</Text>
                                         <Avatar.Group maxCount={5} size="small" style={{ marginLeft: 8 }}>
                                             {(topImprovement.likes || []).map(userId => (
                                                 <Tooltip key={userId} title={userLookup[userId]?.username || '?'}>
                                                     <Avatar style={{ backgroundColor: '#1890ff' }}>
                                                         {userLookup[userId]?.username?.[0]?.toUpperCase() || '?'}
                                                     </Avatar>
                                                 </Tooltip>
                                             ))}
                                         </Avatar.Group>
                                     </Space>
                                 </div>
                             ) : (
                                 <Empty description={t('dashboard.empty.noLikes')} />
                             )}
                         </Card>
                     </div>
                 </Col>
             </Row>
 
             <Tour open={openTour} onClose={() => setOpenTour(false)} steps={tourSteps} />
         </div>
     );
};

export default DashboardPage;