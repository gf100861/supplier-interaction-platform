import React, { useState, useMemo, useEffect } from 'react';
import { Card, Row, Col, Statistic, Typography, List, Empty, Avatar, Tooltip, Spin, Tag, Button, Divider, Space } from 'antd';
import { SolutionOutlined, ClockCircleOutlined, CheckCircleOutlined, StarOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useNotices } from '../contexts/NoticeContext';
import { supabase } from '../supabaseClient'; // 1. 导入 supabase 客户端
import { useSuppliers } from '../contexts/SupplierContext'; // 1. 导入 useSuppliers
const { Title, Paragraph, Text } = Typography;

const DashboardPage = () => {
    const navigate = useNavigate();
    const { notices, loading: noticesLoading } = useNotices();

    // --- 为用户数据创建独立的 state 和 loading 状态 ---
    const [allUsers, setAllUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(true);

    const { suppliers } = useSuppliers(); // 2. 获取完整的供应商列表

    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

    // --- 使用 useEffect 在组件加载时，独立获取所有用户的数据 ---
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                // ✨ 核心修正：确保获取的是 username 字段
                const { data, error } = await supabase
                    .from('users')
                    .select('id, username');

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

    const userLookup = useMemo(() => {
        return allUsers.reduce((acc, user) => {
            acc[user.id] = user;
            return acc;
        }, {});
    }, [allUsers]);

    // --- 核心：在这里计算所有仪表盘需要的数据 ---
    const dashboardData = useMemo(() => {
        if (noticesLoading || usersLoading) return null;

        // --- 核心修正：根据当前用户角色，过滤出他能看到的数据 ---
        let baseData = [];
        if (currentUser) {
            if (currentUser.role === 'Manager' || currentUser.role === 'Admin') {
                baseData = notices;
            } else if (currentUser.role === 'SD') {
                const managedSupplierIds = (currentUser.managedSuppliers || []).map(s => s.supplier.id);
                baseData = notices.filter(n =>
                    n.creatorId === currentUser.id || // 自己创建的
                    managedSupplierIds.includes(n.assignedSupplierId) // 或分配给自己负责的供应商的
                );
            }
            else if (currentUser.role === 'Supplier') {
                // 供应商只能看到分配给他们公司的通知单
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
            (n.status === '待SD关闭' || n.status === '待SD审核' || n.status === '待供应商处理' || n.status === '待供应商上传证据') &&
            dayjs(n.createdAt).isAfter(thirtyDaysAgo)
        );
        const supplierActionRequired = Object.entries(
            pendingForSupplier.reduce((acc, notice) => {
                const name = notice.supplier.shortCode;
                if (name) { // 安全检查
                    if (!acc[name]) acc[name] = 0;
                    acc[name]++;
                }
                return acc;
            }, {})
        ).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);



        // SD点赞最多的改善 (这个是全局的，所以用 notices)
        const topImprovement = notices
            .filter(n => n.status === '已完成' && n.likes && n.likes.length > 0)
            .sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0))[0];

        return { closedThisMonth, allOpenIssues, supplierActionRequired, topImprovement };

    }, [notices, allUsers, noticesLoading, usersLoading, currentUser]);

    // 加载守卫
    if (!dashboardData) {
        return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
    }

    if (currentUser.role === 'Supplier') {
        return (
            <div>
                <Card style={{ marginBottom: 24 }} bordered={false}>
                    <Title level={4} style={{ margin: 0 }}>我的仪表盘</Title>
                    <Paragraph type="secondary" style={{ margin: 0, marginTop: '4px' }}>查看与您公司相关的核心问题指标。</Paragraph>
                </Card>
                <Row gutter={[24, 24]}>
                    <Col xs={24} sm={12}>
                        <Card bordered={false}><Statistic title="本月已关闭问题" value={dashboardData.closedThisMonth} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} /></Card>
                    </Col>
                    <Col xs={24} sm={12}>
                        <Card bordered={false}><Statistic title="当前所有未关闭问题" value={dashboardData.allOpenIssues} valueStyle={{ color: '#faad14' }} prefix={<ClockCircleOutlined />} /></Card>
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

    const { closedThisMonth, allOpenIssues, supplierActionRequired, topImprovement } = dashboardData;

    return (
        <div>
            <Card style={{ marginBottom: 24 }} bordered={false}>
                <Title level={4} style={{ margin: 0 }}>运营仪表盘</Title>
                <Paragraph type="secondary" style={{ margin: 0, marginTop: '4px' }}>监控关键绩效指标 (KPI) 与行动预警。</Paragraph>
            </Card>

            <Row gutter={[24, 24]}>
                <Col xs={24} md={12} lg={6}>
                    <Card bordered={false}><Statistic title="本月已关闭问题" value={closedThisMonth} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} /></Card>
                </Col>
                <Col xs={24} md={12} lg={6}>
                    <Card bordered={false}><Statistic title="所有未关闭问题" value={allOpenIssues} valueStyle={{ color: '#faad14' }} prefix={<ClockCircleOutlined />} /></Card>
                </Col>
            </Row>

            <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
                <Col xs={24} lg={12}>
                    <Card title="行动预警：近30天待处理" bordered={false} style={{ height: '100%' }}>
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
                    <Card title="亮点展示：本月最佳改善" bordered={false} style={{ height: '100%' }}>
                        {topImprovement ? (

                            <div>
                                {console.log('Top', topImprovement)}
                                <Tag color="gold" style={{ marginBottom: 16 }}>来自: {topImprovement.supplier.shortCode}</Tag>
                                <Title level={5} style={{ marginTop: 0 }}>{topImprovement.title}</Title>
                                <Paragraph type="secondary" ellipsis={{ rows: 3 }}>
                                    {topImprovement.sdNotice?.description}
                                    <Divider />
                                    <Tag color="geekblue">{topImprovement?.sdNotice?.problemSource || '暂无'}</Tag>
                                    <Tag color="purple">{topImprovement?.sdNotice?.cause || '暂无'}</Tag>
                                </Paragraph>
                                <Space>
                                    <StarOutlined style={{ color: '#ffc53d' }} />
                                    <Text strong>{topImprovement.likes.length} 个赞</Text>
                                </Space>
                                <Avatar.Group style={{ marginLeft: 16 }}>
                                    {(topImprovement.likes).map(userId => (
                                        <Tooltip key={userId} title={userLookup[userId]?.username || '未知用户'}>
                                            <Avatar style={{ backgroundColor: '#1890ff' }}>
                                                {userLookup[userId]?.username?.[0]?.toUpperCase() || '?'}
                                            </Avatar>
                                        </Tooltip>
                                    ))}
                                </Avatar.Group>
                                <Button type="link" style={{ display: 'block', marginTop: 16 }} onClick={() => navigate(`/notices?open=${topImprovement.id}`)}>查看详情</Button>
                            </div>
                        ) : (
                            <Empty description="本月暂无获得点赞的改善案例。" />
                        )}
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default DashboardPage;