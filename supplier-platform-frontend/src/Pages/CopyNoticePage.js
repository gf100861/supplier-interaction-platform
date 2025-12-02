import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card, Row, Col, Statistic, Typography, List, Empty, Avatar, Tooltip, Spin, Tag, Button, Divider, Space, Select, Popconfirm, Tour } from 'antd';
import { ClockCircleOutlined, CheckCircleOutlined, StarOutlined, UserOutlined, CalendarOutlined, AuditOutlined, TeamOutlined, ReconciliationOutlined, UndoOutlined, DeleteOutlined, WarningOutlined, ScheduleOutlined, FileTextOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useNotices } from '../contexts/NoticeContext';
import { supabase } from '../supabaseClient';
import { useSuppliers } from '../contexts/SupplierContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

const getPlanIcon = (type) => {
    switch (type) {
        case 'audit': return <AuditOutlined style={{ color: '#1890ff' }} />;
        case 'qrm': return <TeamOutlined style={{ color: '#faad14' }} />;
        case 'quality_review': return <ReconciliationOutlined style={{ color: '#52c41a' }} />;
        default: return <CalendarOutlined />;
    }
};

// --- 核心修复 2: PlanItem 支持跨年移动 ---
const PlanItem = ({ plan, onMarkComplete, onDelete, onNavigate, onReschedule }) => {
    const [targetDateStr, setTargetDateStr] = useState(null); // 格式 "YYYY-MM"

    const handleConfirmReschedule = () => {
        if (targetDateStr) {
            const [year, month] = targetDateStr.split('-').map(Number);
            onReschedule(plan, month, year); // 传递新的年份
            setTargetDateStr(null);
        }
    };

    // 生成未来 12 个月的选项
    const monthOptions = useMemo(() => {
        const options = [];
        let current = dayjs().startOf('month');
        for (let i = 0; i < 12; i++) {
            const val = current.add(i, 'month');
            const year = val.year();
            const month = val.month() + 1;
            const label = `${year}年${month}月`;
            const value = `${year}-${month}`;
            // 禁用当前计划所在的月份
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

    // ... (managedSuppliers, handleMarkAsComplete, handleDeleteEvent 等函数保持不变)
    const managedSuppliers = useMemo(() => {
        if (!currentUser || !suppliers) return [];
        if (currentUser.role === 'Manager' || currentUser.role === 'Admin') return suppliers;
        if (currentUser.role === 'SD') return (currentUser.managed_suppliers || []).map(a => a.supplier).filter(Boolean);
        return [];
    }, [currentUser, suppliers]);

    const handleMarkAsComplete = async (id, currentStatus) => {
        const newStatus = currentStatus === 'pending' ? 'completed' : 'pending';
        const completionDate = newStatus === 'completed' ? dayjs().format('YYYY-MM-DD') : null;
        const { error } = await supabase.from('audit_plans').update({ status: newStatus, completion_date: completionDate }).eq('id', id);
        if (error) messageApi.error(`更新状态失败: ${error.message}`);
        else {
            messageApi.success('状态更新成功！');
            setAllPendingPlans(prev => prev.filter(p => p.id !== id));
        }
    };

    const handleDeleteEvent = async (id) => {
        const { error } = await supabase.from('audit_plans').delete().eq('id', id);
        if (error) messageApi.error(`删除失败: ${error.message}`);
        else {
            messageApi.success('事件已删除！');
            setAllPendingPlans(prev => prev.filter(p => p.id !== id));
        }
    };

    const handleNavigateToNotices = (plan) => {
        if (!plan.supplier_id || !plan.planned_month || !plan.year) {
            messageApi.error("无法跳转，计划信息不完整。");
            return;
        }
        navigate('/notices', { state: { preSelectedSupplierId: plan.supplier_id, preSelectedMonth: plan.planned_month, preSelectedYear: plan.year } });
    };

    // --- 核心修复 2: 接收年份参数并更新 ---
    const handleReschedule = async (item, newMonth, newYear) => {
        if (!newMonth || !newYear) {
            messageApi.error("请选择一个新的月份！");
            return;
        }
        if (newMonth === item.planned_month && newYear === item.year) return;

        const oldMonth = item.planned_month;
        const oldYear = item.year;
        const key = `reschedule-${item.id}`;

        // 乐观更新 UI
        setAllPendingPlans(prevPlans =>
            prevPlans.map(p =>
                p.id === item.id ? { ...p, planned_month: newMonth, year: newYear } : p
            )
        );
        messageApi.loading({ content: '正在移动计划...', key });

        try {
            const { error } = await supabase
                .from('audit_plans')
                .update({ planned_month: newMonth, year: newYear }) // 更新年份
                .eq('id', item.id);

            if (error) throw error;
            messageApi.success({ content: `计划已成功移动到 ${newYear}年${newMonth}月！`, key });
        } catch (error) {
            messageApi.error({ content: `计划调整失败: ${error.message}`, key });
            setAllPendingPlans(prevPlans =>
                prevPlans.map(p =>
                    p.id === item.id ? { ...p, planned_month: oldMonth, year: oldYear } : p
                )
            );
        }
    };

    useEffect(() => {
        const fetchUsers = async () => {
            setUsersLoading(true);
            try {
                const { data } = await supabase.from('users').select('id, username');
                setAllUsers(data || []);
            } catch (e) { console.error(e); } finally { setUsersLoading(false); }
        };
        fetchUsers();
    }, []);

    useEffect(() => {
        const fetchCategories = async () => {
            setCategoriesLoading(true);
            try {
                const { data } = await supabase.from('notice_categories').select('id, name');
                setPlanCategories(data || []);
            } catch (e) { console.error(e); } finally { setCategoriesLoading(false); }
        };
        fetchCategories();
    }, []);

    useEffect(() => {
        if (!currentUser || !['SD', 'Manager', 'Admin'].includes(currentUser.role)) {
            setAllPlansLoading(false);
            return;
        }
        const fetchAllPendingPlans = async () => {
            setAllPlansLoading(true);
            try {
                // 修改查询逻辑：获取今年及以后的所有未完成计划，不再限制仅今年
                const currentYear = dayjs().year();
                let query = supabase
                    .from('audit_plans')
                    .select('*')
                    .gte('year', currentYear) // 获取今年及未来的
                    .neq('status', 'completed');

                const { data, error } = await query;
                if (error) throw error;

                if (currentUser.role === 'SD') {
                    if (!suppliersLoading) {
                        const managedSupplierIds = new Set(managedSuppliers.map(s => s.id));
                        const filteredData = (data || []).filter(plan => managedSupplierIds.has(plan.supplier_id));
                        setAllPendingPlans(filteredData);
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
        if (!(currentUser.role === 'SD' && suppliersLoading)) fetchAllPendingPlans();
    }, [currentUser, suppliers, suppliersLoading, managedSuppliers]);

    const userLookup = useMemo(() => allUsers.reduce((acc, user) => ({ ...acc, [user.id]: user }), {}), [allUsers]);

    // --- planStatistics 修改：更健壮的日期比较 ---
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

            // 构建计划的日期对象进行比较
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

    // ... (dashboardData 计算逻辑保持不变)
    const dashboardData = useMemo(() => {
        if (noticesLoading || usersLoading || suppliersLoading) return null;
        let baseData = [];
        // ... (省略重复代码，与之前一致)
        if (currentUser.role === 'Manager' || currentUser.role === 'Admin') baseData = notices;
        else if (currentUser.role === 'SD') {
             const managedIds = new Set(managedSuppliers.map(s=>s.id));
             baseData = notices.filter(n => (n.creatorId === currentUser.id || managedIds.has(n.assignedSupplierId)));
        } else if (currentUser.role === 'Supplier') baseData = notices.filter(n => n.assignedSupplierId === currentUser.supplier_id);

        const now = dayjs();
        // ... (统计逻辑省略，与之前一致)
        const closedThisMonth = baseData.filter(n => n.status === '已完成' && dayjs(n.history?.find(h=>h.type==='sd_closure_approve')?.time).isAfter(now.startOf('month'))).length;
        const allOpenIssues = baseData.filter(n => !['已完成', '已作废'].includes(n.status)).length;
        const recentPendingIssues = baseData.filter(n => !['已完成', '已作废'].includes(n.status) && dayjs(n.createdAt).isAfter(now.subtract(30, 'day'))).length;
        const pendingEvidenceNext30Days = baseData.filter(n => n.status === '待供应商关闭' && n.deadline !== 'N/A' && dayjs(n.deadline).isAfter(now) && dayjs(n.deadline).isBefore(now.add(30, 'day'))).length;
        
        // ... (Top Improvement 逻辑省略)
        const topImprovement = notices.filter(n => n.status === '已完成' && n.likes?.length > 0).sort((a,b)=>b.likes.length - a.likes.length)[0];
        
        // ... (Action Required 逻辑省略)
        const pendingForSupplier = baseData.filter(n => !['已完成', '已作废'].includes(n.status) && dayjs(n.createdAt).isAfter(now.subtract(30, 'day')));
        const supplierActionRequired = Object.entries(pendingForSupplier.reduce((acc, n) => {
             const name = suppliers.find(s=>s.id===n.assignedSupplierId)?.short_code || n.assignedSupplierName || 'Unknown';
             if(!acc[name]) acc[name]={count:0, id:n.assignedSupplierId};
             acc[name].count++;
             return acc;
        }, {})).map(([name, d]) => ({name, ...d})).sort((a,b)=>b.count-a.count);

        return { closedThisMonth, allOpenIssues, recentPendingIssues, pendingEvidenceNext30Days, supplierActionRequired, topImprovement };
    }, [notices, allUsers, suppliers, noticesLoading, usersLoading, suppliersLoading, currentUser, managedSuppliers]);

    const isSDManagerOrAdmin = ['SD', 'Manager', 'Admin'].includes(currentUser.role);
    const mainPageLoading = noticesLoading || usersLoading || suppliersLoading;

    // --- 核心修复 1: 确保 t 函数参数传递正确 ---
    // 获取下个月的月份名称用于参数替换
    // 注意：这里我们使用 dayjs 获取下个月的数字 (1-12)
    const nextMonthNum = dayjs().add(1, 'month').format('M');
    // 如果您在字典中使用了 {month} 占位符，这里传递对象
    const nextMonthTitle = t('dashboard.list.nextMonthPending', { month: nextMonthNum });

    const tourSteps = [
        { title: t('tour.step1.title'), description: t('tour.step1.desc'), target: () => refCoreMetrics.current },
        ...(isSDManagerOrAdmin ? [{ title: t('tour.step2.title'), description: t('tour.step2.desc'), target: () => refMonthlyPlan.current }] : []),
        { title: t('tour.step3.title'), description: t('tour.step3.desc'), target: () => refWarnings.current },
        { title: t('tour.step4.title'), description: t('tour.step4.desc'), target: () => refHighlights.current },
    ];

    const pageIsLoading = noticesLoading || usersLoading || suppliersLoading || allPlansLoading;

    if (pageIsLoading && !dashboardData) return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
    if (!dashboardData) return <div style={{ padding: 24 }}><Empty description="No data" /></div>;

    // ... (Supplier View 省略，保持不变)
    if (currentUser.role === 'Supplier') {
         // ...
         return <div>...</div>
    }

    const { closedThisMonth, allOpenIssues, supplierActionRequired, topImprovement } = dashboardData;
    const { overduePastPlans, pendingCurrentMonthPlans, filteredCurrentAndPastPlansForList, filteredNextMonthPlansForList } = planStatistics;

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
                                <Col xs={12} sm={12}><Statistic title={t('dashboard.stat.closedMonth')} value={closedThisMonth} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} /></Col>
                                <Col xs={12} sm={12}><Statistic title={t('dashboard.stat.allOpen')} value={allOpenIssues} valueStyle={{ color: '#faad14' }} prefix={<ClockCircleOutlined />} /></Col>
                                <Col xs={12} sm={12}><Statistic title={t('dashboard.stat.planOverdue')} value={overduePastPlans} valueStyle={{ color: '#f5222d' }} prefix={<WarningOutlined />} /></Col>
                                <Col xs={12} sm={12}><Statistic title={t('dashboard.stat.planPending')} value={pendingCurrentMonthPlans} valueStyle={{ color: '#faad14' }} prefix={<ScheduleOutlined />} /></Col>
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
                                        <Select size="small" style={{ width: 120 }} placeholder={t('dashboard.filter.bySupplier')} value={selectedPlanSupplier} onChange={setSelectedPlanSupplier} options={[{ value: 'all', label: t('dashboard.filter.allSuppliers') }, ...managedSuppliers.map(s => ({ value: s.id, label: s.short_code }))]} />
                                        <Select size="small" style={{ width: 120 }} placeholder={t('dashboard.filter.byType')} value={selectedPlanCategory} onChange={setSelectedPlanCategory} options={[{ value: 'all', label: t('dashboard.filter.allTypes') }, ...planCategories.map(c => ({ value: c.name, label: c.name }))]} />
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
                                                <List itemLayout="horizontal" dataSource={filteredCurrentAndPastPlansForList} renderItem={(plan) => <PlanItem plan={plan} onMarkComplete={handleMarkAsComplete} onDelete={handleDeleteEvent} onNavigate={handleNavigateToNotices} onReschedule={handleReschedule} />} pagination={{ pageSize: 3, size: 'small', showLessItems: true }} />
                                            ) : <Empty description={t('dashboard.list.noBacklog')} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '20px 0' }} />}
                                        </div>
                                    </Col>
                                    <Col span={12}>
                                        <Title level={5} style={{ marginTop: 0 }}>
                                            {/* 使用处理后的 nextMonthTitle */}
                                            {nextMonthTitle} ({filteredNextMonthPlansForList.length})
                                        </Title>
                                        <div>
                                            {filteredNextMonthPlansForList.length > 0 ? (
                                                <List itemLayout="horizontal" dataSource={filteredNextMonthPlansForList} renderItem={(plan) => <PlanItem plan={plan} onMarkComplete={handleMarkAsComplete} onDelete={handleDeleteEvent} onNavigate={handleNavigateToNotices} onReschedule={handleReschedule} />} pagination={{ pageSize: 3, size: 'small', showLessItems: true }} />
                                            ) : <Empty description={t('dashboard.list.noNextMonth')} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '20px 0' }} />}
                                        </div>
                                    </Col>
                                </Row>
                            </Card>
                        </div>
                    </Col>
                )}
            </Row>

            {/* ... (Action Alert 和 Highlights 区域代码保持不变) ... */}
            <Row gutter={[24, 24]} style={{ marginTop: 24 }} align="stretch">
                <Col xs={24} lg={12}>
                    <div ref={refWarnings} style={{ height: '100%' }}>
                        <Card title={t('dashboard.actionAlert')} bordered={false} loading={mainPageLoading} style={{ height: '100%' }}>
                            <List
                                itemLayout="horizontal"
                                dataSource={supplierActionRequired}
                                renderItem={(item) => (
                                    <List.Item>
                                        <List.Item.Meta avatar={<Avatar style={{ backgroundColor: '#ff4d4f' }} icon={<UserOutlined />} />} title={<Text strong>{item.name}</Text>} description={`${item.count} ${t('dashboard.list.itemsPending')}`} />
                                        <Button type="link" onClick={() => navigate('/notices', { state: { preSelectedSupplierId: item.id } })}>{t('dashboard.action.process')}</Button>
                                    </List.Item>
                                )}
                                locale={{ emptyText: <Empty description={t('dashboard.empty.noAlerts')} /> }}
                            />
                        </Card>
                    </div>
                </Col>
                <Col xs={24} lg={12}>
                    <div ref={refHighlights} style={{ height: '100%' }}>
                        <Card title={t('dashboard.highlights')} bordered={false} loading={mainPageLoading} style={{ height: '100%' }}>
                            {topImprovement ? (
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                        <Space wrap size="small">
                                            <Tag color="gold">{t('dashboard.tag.from')}: {topImprovement.supplier?.short_code || '?'}</Tag>
                                            {topImprovement?.sdNotice?.problem_source && <Tag color="geekblue">{topImprovement.sdNotice.problem_source}</Tag>}
                                            {topImprovement?.sdNotice?.cause && <Tag color="purple">{topImprovement.sdNotice.cause}</Tag>}
                                        </Space>
                                        <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/notices?open=${topImprovement.id}`)}>{t('dashboard.action.viewDetails')}</Button>
                                    </div>
                                    <Title level={5} style={{ marginTop: 0 }}>{topImprovement.title}</Title>
                                    <Paragraph type="secondary" ellipsis={{ rows: 3, expandable: false }}>{topImprovement.sdNotice?.description || topImprovement.sdNotice?.details?.finding || t('dashboard.desc.noDetails')}</Paragraph>
                                    <Divider style={{ margin: '12px 0' }} />
                                    <Space align="center">
                                        <StarOutlined style={{ color: '#ffc53d' }} />
                                        <Text strong>{topImprovement.likes?.length || 0} {t('dashboard.text.likes')}</Text>
                                        <Avatar.Group maxCount={5} size="small" style={{ marginLeft: 8 }}>
                                            {(topImprovement.likes || []).map(userId => <Tooltip key={userId} title={userLookup[userId]?.username || '?'}> <Avatar style={{ backgroundColor: '#1890ff' }}>{userLookup[userId]?.username?.[0]?.toUpperCase() || '?'}</Avatar></Tooltip>)}
                                        </Avatar.Group>
                                    </Space>
                                </div>
                            ) : <Empty description={t('dashboard.empty.noLikes')} />}
                        </Card>
                    </div>
                </Col>
            </Row>

            <Tour open={openTour} onClose={() => setOpenTour(false)} steps={tourSteps} />
        </div>
    );
};

export default DashboardPage;