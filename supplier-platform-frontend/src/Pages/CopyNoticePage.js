import React, { useState, useMemo, useEffect } from 'react';
import { Card, Row, Col, Statistic, Typography, List, Empty, Avatar, Tooltip, Spin, Tag, Button, Divider, Space, Select } from 'antd';
import { ClockCircleOutlined, CheckCircleOutlined, StarOutlined, UserOutlined, CalendarOutlined, AuditOutlined, TeamOutlined, ReconciliationOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useNotices } from '../contexts/NoticeContext';
import { supabase } from '../supabaseClient';
import { useSuppliers } from '../contexts/SupplierContext';
const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

const DashboardPage = () => {
    const navigate = useNavigate();
    const { notices, loading: noticesLoading } = useNotices();
    const [allUsers, setAllUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const { suppliers, loading: suppliersLoading } = useSuppliers();
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);
    const [nextMonthPlans, setNextMonthPlans] = useState([]);
    const [plansLoading, setPlansLoading] = useState(true); // <-- 这个 state 专门用于“下月计划”卡片

    const [planCategories, setPlanCategories] = useState([]);
    const [categoriesLoading, setCategoriesLoading] = useState(true); // <-- 这个 state 也用于“下月计划”卡片
    const [selectedPlanCategory, setSelectedPlanCategory] = useState('all');
    const [selectedPlanSupplier, setSelectedPlanSupplier] = useState('all');

    // ... (fetchUsers 和 fetchCategories 两个 useEffect 保持不变) ...
    useEffect(() => { /* fetchUsers */ }, []);
    useEffect(() => { /* fetchCategories */ }, []);

    // Fetch next month's plans (这个 effect 逻辑也保持不变)
    useEffect(() => {
        // ...
        const fetchNextMonthPlans = async () => {
            setPlansLoading(true); // <-- 它只控制 plansLoading
            // ...
            setPlansLoading(false); // <-- 它只控制 plansLoading
        };
        // ...
    }, [currentUser, suppliers, suppliersLoading, selectedPlanCategory, selectedPlanSupplier]);

    const userLookup = useMemo(() => { /* ... (逻辑不变) ... */ }, [allUsers]);

    // --- 核心修正 1： dashboardData 只依赖它需要的数据 ---
    const dashboardData = useMemo(() => {
        // 它不再等待 plansLoading 或 categoriesLoading
        if (noticesLoading || usersLoading || suppliersLoading) return null; 
        
        // ... (所有计算KPI、行动预警、最佳改善的逻辑都保持不变) ...
        let baseData = [];
        // ...
        const closedThisMonth = baseData.filter(/* ... */).length;
        const allOpenIssues = baseData.filter(/* ... */).length;
        const pendingForSupplier = baseData.filter(/* ... */);
        const supplierActionRequired = Object.entries(/* ... */);
        const topImprovement = notices.filter(/* ... */)[0];

        return { closedThisMonth, allOpenIssues, supplierActionRequired, topImprovement };

    }, [notices, allUsers, suppliers, noticesLoading, usersLoading, suppliersLoading, currentUser]); // <-- 移除了 plansLoading 和 categoriesLoading

    // --- 核心修正 2：定义一个独立的“主加载”状态 ---
    const mainPageLoading = noticesLoading || usersLoading || suppliersLoading;
    const planCardLoading = plansLoading || categoriesLoading;

    // --- 核心修正 3：更新主加载守卫 ---
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
                {/* ... (供应商视图的 KPI 卡片现在使用 mainPageLoading) ... */}
                <Card bordered={false} loading={mainPageLoading}><Statistic title="本月已关闭问题" value={dashboardData.closedThisMonth} /* ... */ /></Card>
                <Card bordered={false} loading={mainPageLoading}><Statistic title="当前所有未关闭问题" value={dashboardData.allOpenIssues} /* ... */ /></Card>
            </div>
        );
    }

    // --- SD / Manager / Admin View ---
    const { closedThisMonth, allOpenIssues, supplierActionRequired, topImprovement } = dashboardData;
    const getPlanIcon = (type) => { /* ... */ };
    const isSDManagerOrAdmin = ['SD', 'Manager', 'Admin'].includes(currentUser.role);

    return (
        <div>
            <Card style={{ marginBottom: 24 }} bordered={false}>{/* ... (页面标题) ... */}</Card>

            <Row gutter={[24, 24]} align="stretch">
                <Col xs={24} md={isSDManagerOrAdmin ? 12 : 24} lg={12}>
                    {/* --- 核心修正 4：此卡片使用 mainPageLoading --- */}
                    <Card bordered={false} loading={mainPageLoading} style={{ height: '100%' }}>
                        <Row gutter={16} align="middle">
                            <Col span={12}><Statistic title="本月已关闭问题" value={closedThisMonth} /* ... */ /></Col>
                            <Col span={12}><Statistic title="所有未关闭问题" value={allOpenIssues} /* ... */ /></Col>
                        </Row>
                    </Card>
                </Col>

                {isSDManagerOrAdmin && (
                    <Col xs={24} md={12} lg={12}>
                        {/* --- 核心修正 5：此卡片使用自己独立的 planCardLoading --- */}
                        <Card
                            title={`下月 (${dayjs().add(1, 'month').format('YYYY年M月')}) 计划概览`}
                            bordered={false}
                            loading={planCardLoading} // <-- 使用独立的状态
                            style={{ height: '100%' }}
                        >
                            <Space wrap style={{ marginBottom: 16 }}>
                                <Select /* ... (供应商筛选器) ... */ />
                                <Select /* ... (类型筛选器) ... */ />
                            </Space>
                            <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                <List dataSource={nextMonthPlans} /* ... (列表渲染) ... */ />
                            </div>
                        </Card>
                    </Col>
                )}
            </Row>

            <Row gutter={[24, 24]} style={{ marginTop: 24 }} align="stretch">
                <Col xs={24} lg={12}>
                    {/* --- 核心修正 6：此卡片使用 mainPageLoading --- */}
                    <Card title="行动预警：近30天待处理" bordered={false} loading={mainPageLoading} style={{ height: '100%' }}>
                        {/* ... (列表渲染) ... */}
                    </Card>
                </Col>
                <Col xs={24} lg={12}>
                    {/* --- 核心修正 6：此卡片使用 mainPageLoading --- */}
                    <Card title="亮点展示：近期最受欢迎改善" bordered={false} loading={mainPageLoading} style={{ height: '100%' }}>
                        {/* ... (亮点渲染) ... */}
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default DashboardPage;