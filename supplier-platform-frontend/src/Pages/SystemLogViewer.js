import React, { useState, useEffect, useCallback } from 'react';
import { 
    Table, Tag, Space, Card, DatePicker, Select, Input, Button, 
    Typography, Drawer, Descriptions, Tooltip, Statistic, Row, Col, Badge, message 
} from 'antd';
import { 
    SearchOutlined, ReloadOutlined, BugOutlined, 
    InfoCircleOutlined, WarningOutlined, CloseCircleOutlined,
    EyeOutlined, CodeOutlined, UserOutlined,
    FilterOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
// ❌ 移除 Supabase 客户端引用
// import { supabase } from '../supabaseClient';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Text } = Typography;


const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const BACKEND_URL = isDev
        ? 'http://localhost:3001'  // 本地开发环境
        : 'https://supplier-interaction-platform-backend.vercel.app'; // Vercel 生产环境
// 配置日志级别的颜色和图标
const SEVERITY_CONFIG = {
    INFO: { color: 'processing', icon: <InfoCircleOutlined />, label: '信息' },
    WARN: { color: 'warning', icon: <WarningOutlined />, label: '警告' },
    ERROR: { color: 'error', icon: <CloseCircleOutlined />, label: '错误' },
    FATAL: { color: '#f50', icon: <BugOutlined />, label: '致命' },
};

const SystemLogViewer = () => {
    // --- State ---
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
    
    // Filters
    const [searchText, setSearchText] = useState('');
    const [severityFilter, setSeverityFilter] = useState(null);
    const [eventTypeFilter, setEventTypeFilter] = useState('');
    const [dateRange, setDateRange] = useState([dayjs().subtract(7, 'day'), dayjs()]);
    
    // Detail View
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);

    // --- Data Fetching ---
    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            // 1. 构建 URL 查询参数
            const params = new URLSearchParams();
            params.append('current', pagination.current);
            params.append('pageSize', pagination.pageSize);
            
            if (severityFilter) params.append('severity', severityFilter);
            if (eventTypeFilter) params.append('eventType', eventTypeFilter);
            if (searchText) params.append('search', searchText);
            
            if (dateRange && dateRange[0] && dateRange[1]) {
                params.append('startDate', dateRange[0].startOf('day').toISOString());
                params.append('endDate', dateRange[1].endOf('day').toISOString());
            }

            // 2. ✅ 发起 Fetch 请求替代 supabase.from()
            const apiPath = isDev ? `/api/admin/system-logs?${params.toString()}` : `/api/admin/system-logs.js?${params.toString()}`;
            const targetUrl = `${BACKEND_URL}${apiPath}`;
            const response = await fetch(`${targetUrl}`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || '获取日志失败');
            }

            // 3. 更新状态
            setLogs(result.data || []);
            setPagination(prev => ({ ...prev, total: result.total || 0 }));

        } catch (error) {
            console.error('Error fetching logs:', error);
            message.error('无法加载日志: ' + error.message);
        } finally {
            setLoading(false);
        }
    }, [pagination.current, pagination.pageSize, severityFilter, eventTypeFilter, searchText, dateRange]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    // --- Handlers ---
    const handleTableChange = (newPagination) => {
        setPagination(prev => ({ ...prev, current: newPagination.current, pageSize: newPagination.pageSize }));
    };

    const showDetails = (record) => {
        setSelectedLog(record);
        setDrawerVisible(true);
    };

    const handleSearch = () => {
        setPagination(prev => ({ ...prev, current: 1 }));
        // fetchLogs 会因为 dependency 变化自动触发，或者你可以显式调用
    };

    // --- Components ---
    const columns = [
        {
            title: '级别',
            dataIndex: 'severity',
            width: 100,
            render: (severity) => {
                const config = SEVERITY_CONFIG[severity] || { color: 'default', icon: null, label: severity };
                return (
                    <Tag icon={config.icon} color={config.color} style={{ marginRight: 0, width: '100%', textAlign: 'center' }}>
                        {config.label || severity}
                    </Tag>
                );
            }
        },
        {
            title: '时间',
            dataIndex: 'created_at',
            width: 180,
            render: (text) => (
                <Tooltip title={dayjs(text).format('YYYY-MM-DD HH:mm:ss')}>
                    <span>{dayjs(text).format('MM-DD HH:mm:ss')}</span>
                </Tooltip>
            )
        },
        {
            title: '类别 / 事件',
            key: 'type',
            width: 200,
            render: (_, record) => (
                <Space direction="vertical" size={0}>
                    <Text strong style={{ fontSize: 13 }}>{record.category}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{record.event_type}</Text>
                </Space>
            )
        },
        {
            title: '消息内容',
            dataIndex: 'message',
            ellipsis: true,
            render: (text) => <Text style={{ color: '#444' }}>{text}</Text>
        },
        {
            title: '操作用户',
            dataIndex: 'user_email',
            width: 200,
            ellipsis: true,
            render: (email) => email ? (
                <Space>
                    <UserOutlined style={{ color: '#bfbfbf' }} />
                    <span style={{ fontSize: 13 }}>{email}</span>
                </Space>
            ) : <Text type="secondary">-</Text>
        },
        {
            title: '操作',
            key: 'action',
            width: 80,
            fixed: 'right',
            render: (_, record) => (
                <Button 
                    type="text" 
                    icon={<EyeOutlined />} 
                    size="small"
                    onClick={() => showDetails(record)} 
                />
            )
        }
    ];

    return (
        <div style={{ background: '#f0f2f5', padding: '24px', borderRadius: 8 }}>
            {/* 1. 顶部统计卡片 */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={8}>
                    <Card bordered={false} bodyStyle={{ padding: 20 }}>
                        <Statistic 
                            title="日志总数 (Filtered)" 
                            value={pagination.total} 
                            prefix={<CodeOutlined />} 
                        />
                    </Card>
                </Col>
                <Col span={16}>
                    <Card bordered={false} bodyStyle={{ padding: 20, display: 'flex', alignItems: 'center', height: '100%' }}>
                        <Space size="large">
                            <Badge status="processing" text="Info: 正常运行" />
                            <Badge status="warning" text="Warn: 需要注意" />
                            <Badge status="error" text="Error: 系统异常" />
                        </Space>
                        <div style={{ flex: 1 }} />
                        <Text type="secondary">系统日志实时监控中心</Text>
                    </Card>
                </Col>
            </Row>

            {/* 2. 主体表格区域 */}
            <Card 
                bordered={false}
                title={
                    <Space>
                        <BugOutlined /> 系统日志
                    </Space>
                }
                extra={
                    <Space wrap>
                        <RangePicker 
                            value={dateRange}
                            onChange={setDateRange}
                            allowClear
                            style={{ width: 240 }}
                        />
                        <Select 
                            placeholder="日志级别" 
                            style={{ width: 110 }} 
                            allowClear
                            onChange={setSeverityFilter}
                            value={severityFilter}
                        >
                            <Option value="INFO">Info</Option>
                            <Option value="WARN">Warning</Option>
                            <Option value="ERROR">Error</Option>
                        </Select>
                        
                        <Input 
                            placeholder="事件类型 (e.g. LOGIN)" 
                            prefix={<FilterOutlined style={{ color: '#bfbfbf' }} />}
                            style={{ width: 180 }}
                            value={eventTypeFilter}
                            onChange={e => setEventTypeFilter(e.target.value)}
                            allowClear
                        />

                        <Input 
                            placeholder="搜索消息、用户或类别" 
                            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                            style={{ width: 200 }}
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                            onPressEnter={handleSearch}
                        />
                        <Button type="primary" onClick={handleSearch}>查询</Button>
                        <Button icon={<ReloadOutlined />} onClick={fetchLogs} />
                    </Space>
                }
            >
                <Table
                    columns={columns}
                    dataSource={logs}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        ...pagination,
                        showTotal: (total) => `共 ${total} 条记录`,
                        showSizeChanger: true,
                        showQuickJumper: true
                    }}
                    onChange={handleTableChange}
                    size="middle"
                    scroll={{ x: 1000 }}
                />
            </Card>

            {/* 3. 详情抽屉 (保持不变) */}
            <Drawer
                title={
                    <Space>
                        {selectedLog && SEVERITY_CONFIG[selectedLog.severity]?.icon}
                        <span>日志详情 #{selectedLog?.id}</span>
                    </Space>
                }
                width={600}
                onClose={() => setDrawerVisible(false)}
                open={drawerVisible}
                headerStyle={{ 
                    background: selectedLog?.severity === 'ERROR' ? '#fff2f0' : (selectedLog?.severity === 'WARN' ? '#fffbe6' : '#fff') 
                }}
            >
                {selectedLog && (
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                        <Descriptions bordered column={1} size="small">
                            <Descriptions.Item label="发生时间">
                                {dayjs(selectedLog.created_at).format('YYYY-MM-DD HH:mm:ss.SSS')}
                            </Descriptions.Item>
                            <Descriptions.Item label="严重程度">
                                <Tag color={SEVERITY_CONFIG[selectedLog.severity]?.color}>
                                    {selectedLog.severity}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="类别">{selectedLog.category}</Descriptions.Item>
                            <Descriptions.Item label="事件类型">{selectedLog.event_type}</Descriptions.Item>
                            <Descriptions.Item label="操作用户">
                                {selectedLog.user_email} 
                                <br />
                                <Text type="secondary" copyable>{selectedLog.user_id}</Text>
                            </Descriptions.Item>
                        </Descriptions>

                        <Card title="消息内容" size="small" type="inner">
                            <Text>{selectedLog.message}</Text>
                        </Card>

                        {selectedLog.metadata && (
                            <Card 
                                title={
                                    <Space>
                                        <CodeOutlined /> 
                                        <span>Metadata (元数据)</span>
                                    </Space>
                                } 
                                size="small" 
                                type="inner"
                                extra={
                                    <Button 
                                        type="link" 
                                        size="small" 
                                        onClick={() => {
                                            navigator.clipboard.writeText(JSON.stringify(selectedLog.metadata, null, 2));
                                            message.success('已复制');
                                        }}
                                    >
                                        复制 JSON
                                    </Button>
                                }
                            >
                                <div style={{ 
                                    backgroundColor: '#1e1e1e', 
                                    color: '#d4d4d4', 
                                    padding: '12px', 
                                    borderRadius: '6px',
                                    maxHeight: '400px',
                                    overflow: 'auto',
                                    fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                                    fontSize: '13px',
                                    lineHeight: '1.5'
                                }}>
                                    <pre style={{ margin: 0 }}>
                                        {JSON.stringify(selectedLog.metadata, null, 2)}
                                    </pre>
                                </div>
                            </Card>
                        )}
                    </Space>
                )}
            </Drawer>
        </div>
    );
};

export default SystemLogViewer;