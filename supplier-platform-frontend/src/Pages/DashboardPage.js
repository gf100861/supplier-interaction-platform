import React, { useState, useMemo, useEffect } from 'react';
import { Card, Row, Col, Statistic, Typography, List, Empty, Avatar, Tooltip, Spin, Tag, Button, Divider, Space, Select, Popconfirm } from 'antd';
import { ClockCircleOutlined, CheckCircleOutlined, StarOutlined, UserOutlined, CalendarOutlined, AuditOutlined, TeamOutlined, ReconciliationOutlined, UndoOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useNotices } from '../contexts/NoticeContext';
import { supabase } from '../supabaseClient';
import { useSuppliers } from '../contexts/SupplierContext';
import { useNotification } from '../contexts/NotificationContext';
const { Title, Paragraph, Text } = Typography;

const DashboardPage = () => {
    const navigate = useNavigate();
    const { notices, loading: noticesLoading } = useNotices();
    const [allUsers, setAllUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const { suppliers, loading: suppliersLoading } = useSuppliers();
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);
    const [nextMonthPlans, setNextMonthPlans] = useState([]);
    const [plansLoading, setPlansLoading] = useState(true);


    const [planCategories, setPlanCategories] = useState([]);
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    const [selectedPlanCategory, setSelectedPlanCategory] = useState('all');
    const [selectedPlanSupplier, setSelectedPlanSupplier] = useState('all');

    const { messageApi } = useNotification();
    const { Option } = Select; // 确保 Option 已导入

    const managedSuppliers = useMemo(() => {
        if (!currentUser || !suppliers) return [];
        if (currentUser.role === 'Manager' || currentUser.role === 'Admin') {
            return suppliers;
        }
        if (currentUser.role === 'SD') {
            const managed = currentUser.managed_suppliers || [];
            // Ensure supplier data is present before returning
            return managed.map(assignment => assignment.supplier).filter(Boolean);
        }
        return [];
    }, [currentUser, suppliers]);

    const handleMarkAsComplete = async (id, currentStatus) => {
        const newStatus = currentStatus === 'pending' ? 'completed' : 'pending';
        const completionDate = newStatus === 'completed' ? dayjs().format('YYYY-MM-DD') : null;
        const { error } = await supabase
            .from('audit_plans')
            .update({ status: newStatus, completion_date: completionDate })
            .eq('id', id);

        if (error) {
            messageApi.error(`更新状态失败: ${error.message}`);
        } else {
            messageApi.success('状态更新成功！');
            // 实时更新UI：从列表中移除 (因为它不再是'待办')
            setNextMonthPlans(prevPlans => prevPlans.filter(p => p.id !== id));
        }
    };

    const handleDeleteEvent = async (id) => {
        const { error } = await supabase
            .from('audit_plans')
            .delete()
            .eq('id', id);

        if (error) {
            messageApi.error(`删除失败: ${error.message}`);
        } else {
            messageApi.success('事件已删除！');
            // 实时更新UI：从列表中移除
            setNextMonthPlans(prevPlans => prevPlans.filter(p => p.id !== id));
        }
    };

    // Fetch all users
    useEffect(() => {
        const fetchUsers = async () => {
            setUsersLoading(true);
            try {
                const { data, error } = await supabase.from('users').select('id, username');
                if (error) throw error;
                setAllUsers(data || []);
            } catch (error) {
                console.error("仪表盘获取用户列表失败:", error);
            } finally {
                setUsersLoading(false);
            }
        };
        fetchUsers();
    }, []);

    useEffect(() => {
        const fetchCategories = async () => {
            setCategoriesLoading(true);
            try {
                const { data, error } = await supabase.from('notice_categories').select('id, name');
                if (error) throw error;
                // 同样进行排序
                const sortedCategories = (data || []).sort((a, b) => {
                    const order = { "Process Audit": 1, "SEM": 2 };
                    const aOrder = order[a.name] || Infinity;
                    const bOrder = order[b.name] || Infinity;
                    return aOrder - bOrder;
                });
                setPlanCategories(sortedCategories);
            } catch (error) {
                console.error("获取问题类型列表失败:", error);
            } finally {
                setCategoriesLoading(false);
            }
        };
        fetchCategories();
    }, []);


    useEffect(() => {
        if (!currentUser || !['SD', 'Manager', 'Admin'].includes(currentUser.role)) {
            setPlansLoading(false);
            return;
        }

        const fetchNextMonthPlans = async () => {
            setPlansLoading(true);
            try {
                const nextMonth = dayjs().add(1, 'month');
                const targetMonth = nextMonth.month() + 1;
                const targetYear = nextMonth.year();

                // 基础查询
                let query = supabase
                    .from('audit_plans')
                    .select('*')
                    .eq('year', targetYear)
                    .eq('planned_month', targetMonth)
                    .neq('status', 'completed');

                // --- 动态添加筛选条件 ---
                if (selectedPlanCategory !== 'all') {
                    query = query.eq('category', selectedPlanCategory);
                }
                if (selectedPlanSupplier !== 'all') {
                    query = query.eq('supplier_id', selectedPlanSupplier);
                }

                const { data, error } = await query;
                if (error) throw error;

                // 角色权限过滤 (保持不变)
                if (currentUser.role === 'SD') {
                    if (!suppliersLoading && suppliers) {
                        const managedSupplierIds = new Set((currentUser.managed_suppliers || []).map(ms => ms.supplier?.id).filter(Boolean));
                        const filteredData = (data || []).filter(plan => managedSupplierIds.has(plan.supplier_id));
                        setNextMonthPlans(filteredData);
                    } else {
                        setNextMonthPlans([]);
                    }
                } else {
                    setNextMonthPlans(data || []);
                }
            } catch (error) {
                console.error("获取下月计划失败:", error);
                setNextMonthPlans([]);
            } finally {
                if (currentUser.role !== 'SD' || !suppliersLoading) {
                    setPlansLoading(false);
                }
            }
        };

        // 仅当 suppliers 加载完成后才执行 (SD 角色需要)
        if (currentUser.role === 'SD' && suppliersLoading) {
            // 等待 suppliers 加载...
        } else {
            fetchNextMonthPlans();
        }

        // --- 将新筛选器 state 加入依赖项 ---
    }, [currentUser, suppliers, suppliersLoading, selectedPlanCategory, selectedPlanSupplier]);

    const userLookup = useMemo(() => {
        return allUsers.reduce((acc, user) => {
            acc[user.id] = user;
            return acc;
        }, {});
    }, [allUsers]);

    const dashboardData = useMemo(() => {
        if (noticesLoading || usersLoading || suppliersLoading) return null;

        let baseData = [];
        if (currentUser) {
            if (currentUser.role === 'Manager' || currentUser.role === 'Admin') {
                baseData = notices;
            } else if (currentUser.role === 'SD') {
                const managedSupplierIds = new Set((currentUser.managed_suppliers || []).map(ms => ms.supplier?.id).filter(Boolean));
                baseData = notices.filter(n =>
                    n.creatorId === currentUser.id ||
                    managedSupplierIds.has(n.assignedSupplierId)
                );
            } else if (currentUser.role === 'Supplier') {
                baseData = notices.filter(n => n.assignedSupplierId === currentUser.supplier_id);
            }
        }

        const now = dayjs();
        const startOfMonth = now.startOf('month');
        const thirtyDaysAgo = now.subtract(30, 'day');

        const closedThisMonth = baseData.filter(n => {
            if (n.status !== '已完成') return false;
            const history = n.history || [];
            const closingEvent = [...history].reverse().find(h => h.type === 'sd_closure_approve');
            return closingEvent && dayjs(closingEvent.time).isAfter(startOfMonth);
        }).length;

        const allOpenIssues = baseData.filter(n => n.status !== '已完成' && n.status !== '已作废').length;

        const pendingForSupplier = baseData.filter(n =>
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

        return { closedThisMonth, allOpenIssues, supplierActionRequired, topImprovement };

    }, [notices, allUsers, suppliers, noticesLoading, usersLoading, suppliersLoading, currentUser]);

    const mainPageLoading = noticesLoading || usersLoading || suppliersLoading;
    const planCardLoading = plansLoading || categoriesLoading;


    if (mainPageLoading && !dashboardData) {
        return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
    }
    if (!dashboardData) {
        return <div style={{ padding: 24 }}><Empty description="无法加载仪表盘数据，请稍后重试或联系管理员。" /></div>;
    }



    // --- Supplier View ---
    if (currentUser.role === 'Supplier') {
        return (
            <div>
                <Card style={{ marginBottom: 24 }} bordered={false}>
                    <Title level={4} style={{ margin: 0 }}>我的仪表盘</Title>
                    <Paragraph type="secondary" style={{ margin: 0, marginTop: '4px' }}>查看与您公司相关的核心问题指标。</Paragraph>
                </Card>
                <Row gutter={[10, 10]}>
                    <Col xs={24} sm={12}>
                        <Card bordered={false} loading={mainPageLoading}><Statistic title="本月已关闭问题" value={dashboardData.closedThisMonth} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} /></Card>
                    </Col>
                    <Col xs={24} sm={12}>
                        <Card bordered={false} loading={mainPageLoading}><Statistic title="当前所有未关闭问题" value={dashboardData.allOpenIssues} valueStyle={{ color: '#faad14' }} prefix={<ClockCircleOutlined />} /></Card>
                    </Col>
                </Row>
                <Card style={{ marginTop: 24 }} bordered={false}>
                    <Empty description={
                        <Space direction="vertical">
                            <Text>所有待办事项，请前往“整改通知单”页面处理。</Text>
                            <Button type="primary" onClick={() => navigate('/notices')}>立即前往</Button>
                        </Space>
                    } />
                </Card>
            </div>
        );
    }
    // --- SD / Manager / Admin View ---
    const { closedThisMonth, allOpenIssues, supplierActionRequired, topImprovement } = dashboardData;

    const getPlanIcon = (type) => {
        switch (type) {
            case 'audit': return <AuditOutlined style={{ color: '#1890ff' }} />;
            case 'qrm': return <TeamOutlined style={{ color: '#faad14' }} />;
            case 'quality_review': return <ReconciliationOutlined style={{ color: '#52c41a' }} />;
            default: return <CalendarOutlined />;
        }
    };

    const isSDManagerOrAdmin = ['SD', 'Manager', 'Admin'].includes(currentUser.role);

    return (
        <div>
            <Card style={{ marginBottom: 24 }} bordered={false}>
                <Title level={4} style={{ margin: 0 }}>运营仪表盘</Title>
                <Paragraph type="secondary" style={{ margin: 0, marginTop: '4px' }}>监控关键绩效指标 (KPI) 与行动预警。</Paragraph>
            </Card>

            <Row gutter={[24, 24]} align="stretch">
                {/* 1. KPI 卡片：宽度从 lg={12} 缩小为 lg={8} */}
                <Col xs={24} md={isSDManagerOrAdmin ? 8 : 24} lg={8}>
                    <Card bordered={false} loading={mainPageLoading} style={{ height: '100%' }}>
                        {/* 2. 移除 Row 和 Col，改为垂直堆叠 */}
                        <Statistic title="本月已关闭问题" value={closedThisMonth} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
                        <div style={{ marginTop: '24px' }}>
                            <Statistic title="所有未关闭问题" value={allOpenIssues} valueStyle={{ color: '#faad14' }} prefix={<ClockCircleOutlined />} />
                        </div>
                    </Card>
                </Col>

                {isSDManagerOrAdmin && (
                    // 3. 计划卡片：宽度从 lg={12} 扩展为 lg={16}
                    <Col xs={24} md={16} lg={16}>
                        <Card
                            title={`下月 (${dayjs().add(1, 'month').format('YYYY年M月')}) 计划概览`}
                            bordered={false}
                            loading={planCardLoading}
                            style={{ height: '100%' }}
                        >
                            <Space wrap style={{ marginBottom: 16 }}>
                                <Select
                                    style={{ width: 200 }}
                                    placeholder="按供应商筛选"
                                    value={selectedPlanSupplier}
                                    onChange={setSelectedPlanSupplier}
                                    options={[
                                        { value: 'all', label: '所有供应商' },
                                        ...managedSuppliers.map(s => ({ value: s.id, label: s.short_code }))
                                    ]}
                                />
                                <Select
                                    style={{ width: 200 }}
                                    placeholder="按问题类型筛选"
                                    value={selectedPlanCategory}
                                    onChange={setSelectedPlanCategory}
                                    options={[
                                        { value: 'all', label: '所有类型' },
                                        ...planCategories.map(c => ({ value: c.name, label: c.name }))
                                    ]}
                                />
                            </Space>

                            <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                <List
                                    itemLayout="horizontal"
                                    dataSource={nextMonthPlans}
                                    renderItem={(plan) => (

                                        <List.Item>

                                            <List.Item.Meta

                                                avatar={getPlanIcon(plan.type)}

                                                title={<Text strong>{plan.supplier_name}</Text>}

                                                description={`类型: ${plan.category} | 负责人: ${plan.auditor}`}

                                            />

                                            <Tag>{plan.type === 'audit' ? '审计' : (plan.type === 'qrm' ? 'QRM' : '评审')}</Tag>

                                            <Space size={0} style={{ flexShrink: 0, marginLeft: '8px' }}>
                                                <Popconfirm title={`确定要将状态变更为“${plan.status === 'pending' ? '已完成' : '待办'}”吗?`} onConfirm={() => handleMarkAsComplete(plan.id, plan.status)}>
                                                    <Button type="text" size="small" style={{ padding: '0 5px', color: plan.status === 'pending' ? '#1890ff' : '#8c8c8c' }}>
                                                        {plan.status === 'pending' ? <CheckCircleOutlined /> : <UndoOutlined />}
                                                    </Button>
                                                </Popconfirm>
                                                <Popconfirm title="确定删除此项吗?" onConfirm={() => handleDeleteEvent([plan].id)}>
                                                    <Button type="text" size="small" icon={<DeleteOutlined />} danger style={{ padding: '0 4px' }} />
                                                </Popconfirm>
                                            </Space>

                                        </List.Item>

                                    )}
                                    locale={{ emptyText: <Empty description="下个月暂无计划。" /> }}
                                />


                            </div>
                        </Card>
                    </Col>
                )}
            </Row>
            <Row gutter={[24, 24]} style={{ marginTop: 24 }} align="stretch">
                <Col xs={24} lg={12}>
                    <Card title="行动预警：近30天待处理" bordered={false} loading={mainPageLoading} style={{ height: '100%' }}>
                        <List
                            itemLayout="horizontal"
                            dataSource={supplierActionRequired}
                            renderItem={(item) => (
                                <List.Item>
                                    <List.Item.Meta
                                        avatar={<Avatar style={{ backgroundColor: '#ff4d4f' }} icon={<UserOutlined />} />}
                                        title={<Text strong>{item.name}</Text>}
                                        description={`${item.count} 项待处理`}
                                    />
                                    <Button
                                        type="link"
                                        onClick={() => navigate('/notices', { state: { preSelectedSupplier: item.id } })}
                                    >
                                        去处理
                                    </Button>
                                </List.Item>
                            )}
                            locale={{ emptyText: <Empty description="太棒了！近30天内没有积压任务。" /> }}
                        />
                    </Card>
                </Col>
                <Col xs={24} lg={12}>
                    <Card title="亮点展示：近期最受欢迎改善" bordered={false} loading={mainPageLoading} style={{ height: '100%' }}>
                        {topImprovement ? (
                            <div>
                                {/* 1. 将所有标签放在一个 Space 容器中，并与按钮水平对齐 */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <Space wrap size="small">
                                        <Tag color="gold">来自: {topImprovement.supplier?.short_code || '未知'}</Tag>
                                        {topImprovement?.sdNotice?.problem_source && <Tag color="geekblue">{topImprovement.sdNotice.problem_source}</Tag>}
                                        {topImprovement?.sdNotice?.cause && <Tag color="purple">{topImprovement.sdNotice.cause}</Tag>}
                                    </Space>
                                    <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/notices?open=${topImprovement.id}`)}>
                                        查看详情
                                    </Button>
                                </div>

                                <Title level={5} style={{ marginTop: 0 }}>{topImprovement.title}</Title>

                                {/* 2. 描述: 现在只包含描述 */}
                                <Paragraph type="secondary" ellipsis={{ rows: 3, expandable: false }}>
                                    {topImprovement.sdNotice?.description || topImprovement.sdNotice?.details?.finding || '无详细描述'}
                                </Paragraph>

                                {/* 3. 移除描述下方的标签，将其移到顶部 */}
                                <Divider style={{ margin: '12px 0' }} />

                                <Space align="center">
                                    <StarOutlined style={{ color: '#ffc53d' }} />
                                    <Text strong>{topImprovement.likes?.length || 0} 个赞</Text>
                                    <Avatar.Group maxCount={5} size="small" style={{ marginLeft: 8 }}>
                                        {(topImprovement.likes || []).map(userId => (
                                            <Tooltip key={userId} title={userLookup[userId]?.username || '未知用户'}>
                                                <Avatar style={{ backgroundColor: '#1890ff' }}>
                                                    {userLookup[userId]?.username?.[0]?.toUpperCase() || '?'}
                                                </Avatar>
                                            </Tooltip>
                                        ))}
                                    </Avatar.Group>
                                </Space>
                            </div>
                        ) : (
                            <Empty description="近期暂无获得点赞的改善案例。" />
                        )}
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default DashboardPage;

