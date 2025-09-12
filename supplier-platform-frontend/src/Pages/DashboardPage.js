import React, { useState, useMemo } from 'react';
import { Card, Row, Col, Statistic, Typography, Select, Empty, List, Tag, Button } from 'antd';
import { Line, Bar } from '@ant-design/charts';
import { useSuppliers } from '../contexts/SupplierContext';
import { mockNoticesData, mockUsers } from '../data/_mockData';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { SolutionOutlined, AuditOutlined, ClockCircleOutlined, RiseOutlined, TrophyOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

// 提取所有SD和Manager用于筛选器
const sdUsers = Object.values(mockUsers).filter(u => u.role === 'SD' || u.role === 'Manager');

const DashboardPage = () => {
    const navigate = useNavigate();
    const [selectedSdId, setSelectedSdId] = useState('all');
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

    // 1. --- 核心数据处理逻辑 (增加了待办列表的数据提取) ---
    const dashboardData = useMemo(() => {
        let baseData = mockNoticesData;
        
        // 经理角色可以筛选特定SD，SD只能看自己的
        if (currentUser?.role === 'SD') {
            baseData = mockNoticesData.filter(n => n.sdNotice.creatorId === currentUser.id);
        } else if (currentUser?.role === 'Manager' && selectedSdId !== 'all') {
            baseData = mockNoticesData.filter(n => n.sdNotice.creatorId === selectedSdId);
        }

        // --- 核心修改 1：动态计算KPI ---
        const currentMonthStr = dayjs().format('YYYY-MM');

        // 计算本月新增
        const newThisMonth = baseData.filter(n => 
            dayjs(n.sdNotice.createTime).format('YYYY-MM') === currentMonthStr
        ).length;

        // 计算月度绩效之星 (基于所有SD，不受筛选器影响)
        const monthlyClosers = mockNoticesData.reduce((acc, notice) => {
            if (notice.status === '已完成') {
                const completion = notice.history.find(h => h.type === 'sd_evidence_approval');
                if (completion && dayjs(completion.time).format('YYYY-MM') === currentMonthStr) {
                    const creatorName = notice.sdNotice.creator;
                    acc[creatorName] = (acc[creatorName] || 0) + 1;
                }
            }
            return acc;
        }, {});
        
        const starEntry = Object.entries(monthlyClosers).sort((a, b) => b[1] - a[1])[0];
        const kpiStar = starEntry ? starEntry[0] : '暂无'; // 如果本月没人关闭问题，则显示'暂无'

        const openIssues = baseData.filter(n => n.status !== '已完成' && n.status !== '已作废').length;
        
        let totalClosedTime = 0;
        let closedCount = 0;
        baseData.filter(n => n.status === '已完成').forEach(n => {
            const completion = n.history.find(h => h.type === 'sd_evidence_approval');
            if (completion) {
                const duration = dayjs(completion.time).diff(dayjs(n.sdNotice.createTime), 'day');
                totalClosedTime += duration > 0 ? duration : 1; // 至少算1天
                closedCount++;
            }
        });
        const avgCloseDays = closedCount > 0 ? (totalClosedTime / closedCount).toFixed(1) : 'N/A';

        const trendData = {};
        baseData.forEach(notice => {
            const month = dayjs(notice.sdNotice.createTime).format('YYYY-MM');
            if (!trendData[month]) trendData[month] = { new: 0, closed: 0 };
            trendData[month].new += 1;
            if (notice.status === '已完成') trendData[month].closed += 1;
        });
        const lineChartData = Object.entries(trendData).flatMap(([month, values]) => [
            { month, count: values.new, type: '新增问题' },
            { month, count: values.closed, type: '关闭问题' },
        ]).sort((a,b) => a.month.localeCompare(b.month));

        const sdPerformance = sdUsers.map(sd => {
            const createdCount = mockNoticesData.filter(n => n.sdNotice.creatorId === sd.id).length;
            return { sdName: sd.name, count: createdCount };
        }).sort((a,b) => b.count - a.count);

        // --- 新增：为当前用户提取待办列表 ---
        const myOpenTasks = mockNoticesData
            .filter(n => (currentUser?.role === 'Manager' || n.sdNotice.creatorId === currentUser?.id) && n.status !== '已完成' && n.status !== '已作废')
            .sort((a, b) => dayjs(b.sdNotice.createTime).diff(dayjs(a.sdNotice.createTime)))
            .slice(0, 5); // 最多显示5条

        return { openIssues, avgCloseDays, lineChartData, sdPerformance, myOpenTasks };

    }, [selectedSdId, currentUser]);

    // 权限控制：只有Manager和SD能看
    if (currentUser?.role === 'Supplier') {
        return (
            <div style={{ padding: '50px', textAlign: 'center' }}>
                <Empty description={<Title level={4}>欢迎使用本平台</Title>} />
                <Paragraph type="secondary">您的待办事项请在“整改通知单”页面查看。</Paragraph>
            </div>
        );
    }
    
    // 图表配置
    const lineConfig = { data: dashboardData.lineChartData, xField: 'month', yField: 'count', seriesField: 'type', smooth: true, color: ['#1890ff', '#52c41a'] };
    const barConfig = { data: dashboardData.sdPerformance, xField: 'count', yField: 'sdName', seriesField: 'sdName', legend: { position: 'top-left' } };

    return (
        <div>
            <Card style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <Title level={4} style={{ margin: 0 }}>运营仪表盘</Title>
                        <Paragraph type="secondary" style={{ margin: 0, marginTop: '4px' }}>监控关键绩效指标 (KPI) 与趋势。</Paragraph>
                    </div>
                    {/* 仅Manager可以筛选查看其他SD */}
                  {currentUser?.role === 'Manager' && (
                        <Select
                            defaultValue="all"
                            style={{ width: 220 }}
                            onChange={setSelectedSdId}
                            options={[{ label: '所有SD/经理', value: 'all' }, ...sdUsers.map(u => ({ label: `追踪: ${u.name}`, value: u.id })) ]}
                        />
                    )}
                </div>
            </Card>

         {/* --- 2. 优化的KPI卡片 --- */}
            <Row gutter={[24, 24]}>
                <Col xs={24} md={12} lg={6}>
                    <Card bordered={false}><Statistic title="当前开启的问题总数" value={dashboardData.openIssues} valueStyle={{ color: '#cf1322' }} prefix={<SolutionOutlined />} /></Card>
                </Col>
                <Col xs={24} md={12} lg={6}>
                    <Card bordered={false}><Statistic title="平均问题关闭天数" value={dashboardData.avgCloseDays} suffix="天" prefix={<ClockCircleOutlined />} /></Card>
                </Col>
    {/* --- 核心修改 2：使用动态计算出的值 --- */}
                <Col xs={24} md={12} lg={6}>
                    <Card bordered={false}><Statistic title="本月新增问题" value={dashboardData.newThisMonth} prefix={<RiseOutlined />} /></Card>
                </Col>
                <Col xs={24} md={12} lg={6}>
                    <Card bordered={false}><Statistic title="月度绩效之星" value={dashboardData.kpiStar} prefix={<TrophyOutlined />} valueStyle={{fontSize: '24px'}} /></Card>
                </Col>
            </Row>

            {/* --- 3. 优化的布局：趋势图与待办列表并列 --- */}
            <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
                <Col xs={24} lg={16}>
                    <Card title="月度问题趋势 (新增 vs 关闭)" bordered={false} style={{ height: '100%' }}>
                        <Line {...lineConfig} height={300} />
                    </Card>
                </Col>
                <Col xs={24} lg={8}>
                    <Card title="我的待办事项" bordered={false} style={{ height: '100%' }}>
                        <List
                            itemLayout="horizontal"
                            dataSource={dashboardData.myOpenTasks}
                            renderItem={(item) => (
                                <List.Item
                                    actions={[<Button type="link" size="small" onClick={() => navigate('/notices')}>处理</Button>]}
                                >
                                    <List.Item.Meta
                                        title={<a onClick={() => navigate('/notices')}>{item.title}</a>}
                                        description={`${item.assignedSupplierName} - ${item.status}`}
                                    />
                                </List.Item>
                            )}
                        />
                         {dashboardData.myOpenTasks.length === 0 && <Empty description="太棒了！没有待办事项。" />}
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default DashboardPage;