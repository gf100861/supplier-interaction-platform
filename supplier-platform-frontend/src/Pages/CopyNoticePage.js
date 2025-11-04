import React, { useState, useMemo, useEffect } from 'react';
import { Card, Row, Col, Statistic, Typography, List, Empty, Avatar, Tooltip, Spin, Tag, Button, Divider, Space, Select, Popconfirm } from 'antd';
import { ClockCircleOutlined, CheckCircleOutlined, StarOutlined, UserOutlined, CalendarOutlined, AuditOutlined, TeamOutlined, ReconciliationOutlined, UndoOutlined, DeleteOutlined, WarningOutlined, ScheduleOutlined, FileTextOutlined } from '@ant-design/icons';
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
    
    const [allPendingPlans, setAllPendingPlans] = useState([]);
    const [allPlansLoading, setAllPlansLoading] = useState(true); 

    const { messageApi } = useNotification();
    const { Option } = Select; 

    const [planCategories, setPlanCategories] = useState([]);
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    const [selectedPlanCategory, setSelectedPlanCategory] = useState('all');
    const [selectedPlanSupplier, setSelectedPlanSupplier] = useState('all');

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

    const getPlanIcon = (type) => {
        switch (type) {
            case 'audit': return <AuditOutlined style={{ color: '#1890ff' }}/>;
            case 'qrm': return <TeamOutlined style={{ color: '#faad14' }}/>;
            case 'quality_review': return <ReconciliationOutlined style={{ color: '#52c41a' }}/>;
            default: return <CalendarOutlined />;
        }
    };

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
            setAllPendingPlans(prevPlans => prevPlans.filter(p => p.id !== id));
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
            setAllPendingPlans(prevPlans => prevPlans.filter(p => p.id !== id));
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

    // Fetch plan categories
    useEffect(() => {
        const fetchCategories = async () => {
            setCategoriesLoading(true);
            try {
                const { data, error } = await supabase.from('notice_categories').select('id, name');
                if (error) throw error;
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

    // Fetch all pending plans for the current year
    useEffect(() => {
        if (!currentUser || !['SD', 'Manager', 'Admin'].includes(currentUser.role)) {
            setAllPlansLoading(false);
            return;
        }

        const fetchAllPendingPlans = async () => {
            setAllPlansLoading(true);
            try {
                const targetYear = dayjs().year(); 
                let query = supabase
                    .from('audit_plans')
                    .select('*')
                    .eq('year', targetYear)
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
                console.error("获取所有年度计划失败:", error);
                setAllPendingPlans([]);
            } finally {
                if (currentUser.role !== 'SD' || !suppliersLoading) {
                    setAllPlansLoading(false);
                }
            }
        };
        
        if (currentUser.role === 'SD' && suppliersLoading) {
           // Wait for suppliers
        } else {
           fetchAllPendingPlans();
        }
        
    }, [currentUser, suppliers, suppliersLoading, managedSuppliers]);


    const userLookup = useMemo(() => {
        return allUsers.reduce((acc, user) => {
            acc[user.id] = user;
            return acc;
        }, {});
    }, [allUsers]);

    // --- 1. 核心修改：重构 planStatistics `useMemo` ---
    const planStatistics = useMemo(() => {
        const now = dayjs();
        const currentMonth = now.month() + 1; // 1-12
        const nextMonth = now.add(1, 'month').month() + 1;
        
        const overduePastPlansList = [];
        const pendingCurrentMonthPlansList = [];
        const pendingNextMonthPlansList = [];

        allPendingPlans.forEach(plan => {
            const supplier = suppliers.find(s => s.id === plan.supplier_id);
            const enrichedPlan = {
                ...plan,
                supplier_display_name: supplier?.short_code || plan.supplier_name 
            };

            if (enrichedPlan.planned_month < currentMonth) {
                overduePastPlansList.push(enrichedPlan);
            } else if (enrichedPlan.planned_month === currentMonth) {
                pendingCurrentMonthPlansList.push(enrichedPlan);
            } else if (enrichedPlan.planned_month === nextMonth) {
                pendingNextMonthPlansList.push(enrichedPlan);
            }
        });

        const filterPlans = (plan) => {
            if (selectedPlanCategory !== 'all' && plan.category !== selectedPlanCategory) {
                return false;
            }
            if (selectedPlanSupplier !== 'all' && plan.supplier_id !== selectedPlanSupplier) {
                return false;
            }
            return true;
        };

        const filteredCurrentMonthPlansForList = pendingCurrentMonthPlansList.filter(filterPlans);
        const filteredNextMonthPlansForList = pendingNextMonthPlansList.filter(filterPlans);
        // --- ✨ 新增：过滤过往计划列表 ---
        const filteredOverduePastPlansForList = overduePastPlansList.filter(filterPlans);


        return {
            overduePastPlans: overduePastPlansList.length,
            pendingCurrentMonthPlans: pendingCurrentMonthPlansList.length,
            pendingNextMonthPlans: pendingNextMonthPlansList.length, 
            
            filteredCurrentMonthPlansForList,
            filteredNextMonthPlansForList,
            filteredOverduePastPlansForList // --- ✨ 暴露过往计划列表 ---
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
        
        const getSummaryFromHistory = (history) => {
             const latestPlanSubmission = [...(history || [])].reverse().find(h => h.type === 'supplier_plan_submission' && h.actionPlans && h.actionPlans.length > 0);
             let latestDeadline = 'N/A';
             if (latestPlanSubmission) {
                 const deadlines = latestPlanSubmission.actionPlans.map(p => dayjs(p.deadline)).filter(d => d.isValid());
                 if (deadlines.length > 0) {
                     latestDeadline = dayjs.max(deadlines).format('YYYY-MM-DD');
                 }
             }
             return { deadline: latestDeadline };
        };
        
        const baseDataWithDeadline = baseData.map(notice => ({
             ...notice,
             ...getSummaryFromHistory(notice.history || [])
        }));

        const closedThisMonth = baseDataWithDeadline.filter(n => {
            if (n.status !== '已完成') return false;
            const history = n.history || [];
            const closingEvent = [...history].reverse().find(h => h.type === 'sd_closure_approve');
            return closingEvent && dayjs(closingEvent.time).isAfter(startOfMonth);
        }).length;

        const allOpenIssues = baseDataWithDeadline.filter(n => !['已完成', '已作废'].includes(n.status)).length;

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
            topImprovement 
        };

    }, [notices, allUsers, suppliers, noticesLoading, usersLoading, suppliersLoading, currentUser, managedSuppliers]);

    const pageIsLoading = noticesLoading || usersLoading || suppliersLoading || allPlansLoading;

    if (pageIsLoading && !dashboardData) {
        return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
    }

     if (!dashboardData) {
         return <div style={{ padding: 24 }}><Empty description="无法加载仪表盘数据，请稍后重试或联系管理员。" /></div>;
     }

    // --- Supplier View ---
    if (currentUser.role === 'Supplier') {
        const { closedThisMonth, allOpenIssues } = dashboardData;
        return (
            <div>
                {/* Supplier Dashboard UI... */}
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
    
    // --- 2. 解构新列表 ---
    const {
        overduePastPlans,
        pendingCurrentMonthPlans,
        // pendingNextMonthPlans, // <-- 这个总数仍然被计算
        filteredCurrentMonthPlansForList,
        filteredOverduePastPlansForList // <-- 使用这个新列表
    } = planStatistics;


    const isSDManagerOrAdmin = ['SD', 'Manager', 'Admin'].includes(currentUser.role);
    
    const PlanItem = ({ plan }) => {
        const itemContent = (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '4px 8px',
                border: '1px solid #f0f0f0',
                borderRadius: '4px',
                marginBottom: '4px',
                backgroundColor: '#fff'
            }}>
                <Space>
                    {getPlanIcon(plan.type)}
                    <div>
                        <Text strong style={{ fontSize: '12px', display: 'block' }} ellipsis={{tooltip: plan.supplier_name}}>
                            {plan.supplier_display_name} 
                        </Text>
                        <Text type="secondary" style={{ fontSize: '11px', display: 'block' }} ellipsis={{tooltip: `[${plan.category}] - ${plan.auditor}`}}>
                            {`[${plan.category}] - ${plan.auditor}`}
                        </Text>
                    </div>
                </Space>
                <Space size={0}>
                    <Tooltip title="查找相关通知单">
                        <Button
                            type="text"
                            size="small"
                            icon={<FileTextOutlined />}
                            style={{ color: '#595959' }}
                            onClick={(e) => {
                                e.stopPropagation(); 
                                handleNavigateToNotices(plan);
                            }}
                        />
                    </Tooltip>
                    <Tooltip title="标记完成/待办">
                        <Popconfirm 
                            title={`标记为 ${plan.status === 'pending' ? '已完成' : '待办'}?`} 
                            onConfirm={() => handleMarkAsComplete(plan.id, plan.status)}
                        >
                            <Button type="text" size="small" icon={plan.status === 'pending' ? <CheckCircleOutlined /> : <UndoOutlined />} style={{ color: plan.status === 'pending' ? '#1890ff' : '#8c8c8c' }} />
                        </Popconfirm>
                    </Tooltip>
                    <Tooltip title="删除计划">
                        <Popconfirm 
                            title="确定删除此计划吗?" 
                            onConfirm={() => handleDeleteEvent(plan.id)}
                        >
                            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                    </Tooltip>
                </Space>
            </div>
        );

        if (plan.comment && plan.comment.trim()) {
            return (
                <Tooltip title={<><b>备注:</b> {plan.comment}</>} placement="topLeft">
                    {itemContent}
                </Tooltip>
            );
        }
        return itemContent;
    };


    return (
        <div>
            <Card style={{ marginBottom: 24 }} bordered={false}>
                <Title level={4} style={{ margin: 0 }}>运营仪表盘</Title>
                <Paragraph type="secondary" style={{ margin: 0, marginTop: '4px' }}>监控关键绩效指标 (KPI) 与行动预警。</Paragraph>
            </Card>

            <Row gutter={[24, 24]} align="stretch">
                <Col xs={24} md={isSDManagerOrAdmin ? 12 : 24} lg={12}>
                    <Card bordered={false} loading={pageIsLoading || allPlansLoading} style={{ height: '100%' }} title="核心指标 (通知单 & 计划)">
                        <Row gutter={[16, 24]}>
                             <Col xs={12} sm={12}>
                                 <Statistic title="本月已关闭 (通知)" value={closedThisMonth} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
                             </Col>
                             <Col xs={12} sm={12}>
                                 <Statistic title="所有未关闭 (通知)" value={allOpenIssues} valueStyle={{ color: '#faad14' }} prefix={<ClockCircleOutlined />} />
                             </Col>
                             <Col xs={12} sm={12}>
                                 <Statistic title="过往未完成 (计划)" value={overduePastPlans} valueStyle={{ color: '#f5222d' }} prefix={<WarningOutlined />} />
                             </Col>
                             <Col xs={12} sm={12}>
                                 <Statistic title="本月待办 (计划)" value={pendingCurrentMonthPlans} valueStyle={{ color: '#faad14' }} prefix={<ScheduleOutlined />} />
                             </Col>
                         </Row>
                    </Card>
                </Col>

                 {isSDManagerOrAdmin && (
                    <Col xs={24} md={12} lg={12}>
                         <Card
                             title="月度计划概览"
                             bordered={false}
                             loading={allPlansLoading || categoriesLoading}
                             style={{ height: '100%' }}
                             extra={
                                 <Space wrap>
                                     <Select
                                         size="small"
                                         style={{ width: 120 }}
                                         placeholder="按供应商"
                                         value={selectedPlanSupplier}
                                         onChange={setSelectedPlanSupplier}
                                         options={[
                                             { value: 'all', label: '所有供应商' },
                                             ...managedSuppliers.map(s => ({ value: s.id, label: s.short_code }))
                                         ]}
                                     />
                                     <Select
                                         size="small"
                                         style={{ width: 120 }}
                                         placeholder="按类型"
                                         value={selectedPlanCategory}
                                         onChange={setSelectedPlanCategory}
                                         options={[
                                             { value: 'all', label: '所有类型' },
                                             ...planCategories.map(c => ({ value: c.name, label: c.name }))
                                         ]}
                                     />
                                 </Space>
                             }
                         >
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Title level={5} style={{ marginTop: 0 }}>{dayjs().format('M')}月待办 ({filteredCurrentMonthPlansForList.length})</Title>
                                    <div>
                                        {filteredCurrentMonthPlansForList.length > 0 ? (
                                            <List
                                                itemLayout="horizontal"
                                                dataSource={filteredCurrentMonthPlansForList}
                                                renderItem={(plan) => <PlanItem plan={plan} />}
                                                pagination={{ pageSize: 3, size: 'small', showLessItems: true }} 
                                            />
                                        ) : (
                                            <Empty description="本月暂无计划。" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{padding: '20px 0'}}/>
                                        )}
                                    </div>
                                </Col>
                                {/* --- 3. 核心修改：更新右侧列 --- */}
                                <Col span={12}>
                                    <Title level={5} style={{ marginTop: 0, color: '#f5222d' }}>过往未完成 ({filteredOverduePastPlansForList.length})</Title>
                                    <div>
                                        {filteredOverduePastPlansForList.length > 0 ? (
                                            <List
                                                itemLayout="horizontal"
                                                dataSource={filteredOverduePastPlansForList}
                                                renderItem={(plan) => <PlanItem plan={plan} />}
                                                pagination={{ pageSize: 3, size: 'small', showLessItems: true }} 
                                            />
                                        ) : (
                                             <Empty description="暂无过往计划。" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{padding: '20px 0'}}/>
                                        )}
                                    </div>
                                </Col>
                            </Row>
                         </Card>
                    </Col>
                 )}
            </Row>

            <Row gutter={[24, 24]} style={{ marginTop: 24 }} align="stretch">
                <Col xs={24} lg={12}>
                     <Card title="行动预警：近30天待处理 (通知单)" bordered={false} loading={mainPageLoading} style={{ height: '100%' }}>
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
                    <Card title="亮点展示：近期最受欢迎改善 (通知单)" bordered={false} loading={mainPageLoading} style={{ height: '100%' }}>
                        {topImprovement ? (
                            <div>
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
                                <Paragraph type="secondary" ellipsis={{ rows: 3, expandable: false }}>
                                     {topImprovement.sdNotice?.description || topImprovement.sdNotice?.details?.finding || '无详细描述'}
                                </Paragraph>
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

