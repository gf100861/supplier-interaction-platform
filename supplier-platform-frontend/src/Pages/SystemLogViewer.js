import React, { useState, useEffect, useCallback } from 'react';
import { 
    Table, Tag, Space, Card, DatePicker, Select, Input, Button, 
    Typography, Drawer, Descriptions, Tooltip, Statistic, Row, Col, Badge 
} from 'antd';
import { 
    SearchOutlined, ReloadOutlined, BugOutlined, 
    InfoCircleOutlined, WarningOutlined, CloseCircleOutlined,
    EyeOutlined, CodeOutlined, CalendarOutlined, UserOutlined,
    FilterOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { supabase } from '../supabaseClient';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Text, Title, Paragraph } = Typography;

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
    const [eventTypeFilter, setEventTypeFilter] = useState(''); // 新增：事件类型筛选
    const [dateRange, setDateRange] = useState([dayjs().subtract(7, 'day'), dayjs()]);
    
    // Detail View
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);

    // Stats
    const [stats, setStats] = useState({ total: 0, errors: 0, warnings: 0 });

    // --- Data Fetching ---
    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            // 1. 构建基础查询
            let query = supabase
                .from('system_logs')
                .select('*', { count: 'exact' });

            // 2. 应用筛选条件
            if (severityFilter) {
                query = query.eq('severity', severityFilter);
            }
            // 新增：事件类型筛选 (模糊匹配，忽略大小写)
            if (eventTypeFilter) {
                query = query.ilike('event_type', `%${eventTypeFilter}%`);
            }
            
            if (searchText) {
                // 支持搜索消息内容、用户邮箱或类别
                query = query.or(`message.ilike.%${searchText}%,user_email.ilike.%${searchText}%,category.ilike.%${searchText}%`);
            }
            if (dateRange && dateRange[0] && dateRange[1]) {
                query = query
                    .gte('created_at', dateRange[0].startOf('day').toISOString())
                    .lte('created_at', dateRange[1].endOf('day').toISOString());
            }

            // 3. 应用分页排序
            const from = (pagination.current - 1) * pagination.pageSize;
            const to = from + pagination.pageSize - 1;
            
            const { data, count, error } = await query
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;

            setLogs(data);
            setPagination(prev => ({ ...prev, total: count || 0 }));
            
            // 4. 简单的统计
            setStats(prev => ({ ...prev, total: count }));

        } catch (error) {
            console.error('Error fetching logs:', error);
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
        fetchLogs(); // Search button trigger
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
            {/* 1. 顶部统计卡片 (Dashboard Feel) */}
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
                        >
                            <Option value="INFO">Info</Option>
                            <Option value="WARN">Warning</Option>
                            <Option value="ERROR">Error</Option>
                        </Select>
                        
                        {/* 新增：事件类型筛选输入框 */}
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

            {/* 3. 详情抽屉 */}
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