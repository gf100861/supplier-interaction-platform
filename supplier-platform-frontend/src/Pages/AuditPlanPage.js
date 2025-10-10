import React, { useState, useMemo, useEffect } from 'react';
import { Button, Modal, Form, Input, Select, Tag, Typography, Card, Popconfirm, Empty, Avatar, Space, Tooltip, Divider, Spin, Statistic, Row, Col } from 'antd';
import { PlusOutlined, UserOutlined, DeleteOutlined, AuditOutlined, TeamOutlined, LeftOutlined, RightOutlined, CheckCircleOutlined, DownloadOutlined, UndoOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSuppliers } from '../contexts/SupplierContext';
import { noticeCategories } from '../data/_mockData';
import { useNotification } from '../contexts/NotificationContext';
import { supabase } from '../supabaseClient';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

const months = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);

// --- 样式 (保持不变) ---
const matrixStyles = {
    scrollContainer: { overflowX: 'auto', border: '1px solid #f0f0f0', borderRadius: '8px' },
    table: { display: 'inline-block', minWidth: '100%' },
    headerRow: { display: 'flex', position: 'sticky', top: 0, zIndex: 2, backgroundColor: '#fafafa' },
    bodyRow: { display: 'flex' },
    stickyCell: { padding: '8px 12px', borderRight: '1px solid #f0f0f0', backgroundColor: '#fff', position: 'sticky', zIndex: 1 },
    headerCell: { flex: '0 0 180px', padding: '16px', fontWeight: 'bold', borderRight: '1px solid #f0f0f0', textAlign: 'center' },
    cell: { flex: '0 0 180px', padding: '12px', borderRight: '1px solid #f0f0f0', borderTop: '1px solid #f0f0f0', minHeight: '80px' },
};



const AuditPlanPage = () => {
    const [events, setEvents] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [eventType, setEventType] = useState('audit'); // 默认为 'audit'
    const [form] = Form.useForm();
    const [currentYear, setCurrentYear] = useState(dayjs().year());
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState([]);
    const { suppliers, loading: suppliersLoading } = useSuppliers();
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);
    const { messageApi } = useNotification();



    // --- 核心修改：从 Supabase 获取数据 ---
    const fetchData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('audit_plans')
                .select('*')
                .eq('year', currentYear); // 只获取当前年份的数据

            if (error) throw error;
            setEvents(data || []);
            const { data: categoriesData, error: categoriesError } = await supabase
                .from('notice_categories')
                .select('id, name');
            if (categoriesError) throw categoriesError;
            setCategories(categoriesData || []);
        } catch (error) {
            messageApi.error(`加载规划数据失败: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // --- 在年份变化时重新获取数据 ---
    useEffect(() => {
        fetchData();
    }, [currentYear]); // 依赖项为 currentYear

    // 放在 AuditPlanPage 组件的顶部
    useEffect(() => {
        if (suppliers && suppliers.length > 0) {
            console.log("从 Context 获取到的 Suppliers 数据:", suppliers);
        }
    }, [suppliers]);

    const managedSuppliers = useMemo(() => {
        if (!currentUser || !suppliers) return [];
        if (currentUser.role === 'Manager' || currentUser.role === 'Admin') {
            return suppliers; // Manager/Admin看到所有供应商
        }
        if (currentUser.role === 'SD') {
            // 假设 currentUser 对象在登录时已包含 managed_suppliers 及其嵌套的 supplier 对象
            const managed = currentUser.managed_suppliers || [];
            return managed.map(assignment => assignment.supplier).filter(Boolean); // filter(Boolean) 移除可能存在的 null/undefined
        }
        return []; // 其他角色看不到
    }, [currentUser, suppliers]);

    // --- 过滤事件的逻辑 (修复了角色判断的 bug) ---
    const filteredEvents = useMemo(() => {
        if (!currentUser) return [];
        // 管理员和SD能看到所有
        if (currentUser.role === 'Manager' || currentUser.role === 'SD' || currentUser.role === 'Admin') {
            return events;
        }
        // 供应商只能看到和自己相关的
        if (currentUser.role === 'Supplier') {
            return events.filter(e => e.supplier_id === currentUser.supplier_id);
        }
        return [];
    }, [events, currentUser]);



    const planStats = useMemo(() => {
        const stats = {
            total: filteredEvents.length,
            completed: 0,
            pending: 0,
        };
        for (const event of filteredEvents) {
            if (event.status === 'completed') {
                stats.completed += 1;
            } else {
                stats.pending += 1;
            }
        }
        return stats;
    }, [filteredEvents]); // 当过滤后的事件列表变化时，重新计算

    // --- 数据分组逻辑 (保持不变) ---
    const matrixData = useMemo(() => {
        const grouped = {};
        filteredEvents.forEach(event => {
            if (!grouped[event.supplier_name]) {
                grouped[event.supplier_name] = Array.from({ length: 12 }, () => []);
            }
            grouped[event.supplier_name][event.planned_month - 1].push(event);
        });
        return grouped;
    }, [filteredEvents]);

    // --- 核心修改：标记完成事件 ---
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
            fetchData(); // 重新获取数据以刷新UI
        }
    };

    // --- 核心修改：删除事件 ---
    const handleDeleteEvent = async (id) => {
        const { error } = await supabase
            .from('audit_plans')
            .delete()
            .eq('id', id);

        if (error) {
            messageApi.error(`删除失败: ${error.message}`);
        } else {
            messageApi.success('事件已删除！');
            fetchData(); // 重新获取数据以刷新UI
        }
    };

    const showAddModal = (type) => {
        setEventType(type);

        // --- 核心修改 ---
        // 1. 先调用 resetFields()，不带任何参数，清空整个表单
        form.resetFields();

        // 2. 然后使用 setFieldsValue() 为特定字段设置值
        form.setFieldsValue({
            auditor: currentUser?.username || '' // 负责人自动填充为当前用户
        });

        setIsModalVisible(true);
    };

    const handleCancel = () => setIsModalVisible(false);

    // --- 核心修改：提交新事件到数据库 ---
    const handleFormSubmit = async (values) => {
        // 修正行：在用于生成下拉框的“已筛选供应商”列表中查找
        const selectedSupplier = managedSuppliers.find(s => s.id === values.supplierId);

        if (!selectedSupplier) {
            // 这条错误现在几乎不可能触发了，但作为保障依然保留
            messageApi.error("未找到供应商信息，无法提交。");
            return;
        }

        const newEvent = {
            type: eventType,
            year: currentYear,
            category: values.category,
            planned_month: values.plannedMonth,
            supplier_id: selectedSupplier.id,
            supplier_name: selectedSupplier.name,
            audit_project: values.auditProject,
            auditor: values.auditor,
            status: 'pending',
        };

        const { error } = await supabase.from('audit_plans').insert([newEvent]);

        if (error) {
            messageApi.error(`添加失败: ${error.message}`);
        } else {
            messageApi.success(`${eventType === 'audit' ? '审计计划' : 'QRM会议'} 添加成功！`);
            setIsModalVisible(false);
            fetchData(); // 重新获取数据
        }
    };

    // 年份切换函数 (保持不变)
    const prevYear = () => setCurrentYear(currentYear - 1);
    const nextYear = () => setCurrentYear(currentYear + 1);
    const handleYearChange = (year) => setCurrentYear(year);
    const generateYearOptions = () => {

        const current = dayjs().year();

        const years = [];

        for (let i = current - 2; i <= current + 2; i++) {

            years.push(<Option key={i} value={i}>{i}</Option>);

        }

        return years;

    };

    //根据SD的需要设计表头和添加数据
    const handleExportExcel = async () => { /* ... */ };

    return (
        <div style={{ padding: '0 24px 24px 24px' }}>
            {/* 顶部控制栏 (保持不变) */}
            <Card style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Button icon={<LeftOutlined />} onClick={prevYear} size="small" style={{ marginRight: 8 }} />
                        <Select value={currentYear} style={{ width: 120, marginRight: 8 }} onChange={handleYearChange}>
                            {generateYearOptions()}
                        </Select>
                        <Button icon={<RightOutlined />} onClick={nextYear} size="small" />
                        <Title level={4} style={{ margin: 0, marginLeft: 16 }}>{currentYear} 年度战略规划面板</Title>
                    </div>
                    <Space>
                        <Button type="primary" icon={<AuditOutlined />} onClick={() => showAddModal('audit')}>新建审计计划</Button>
                        <Button icon={<TeamOutlined />} onClick={() => showAddModal('qrm')} style={{ backgroundColor: '#fffbe6', borderColor: '#ffe58f' }}>添加QRM会议</Button>
                    </Space>
                </div>
                <Paragraph type="secondary" style={{ margin: '0' }}>规划和跟踪本年度供应商审计与QRM会议的整体进度。</Paragraph>
                <Divider style={{ margin: '16px 0' }} />
                <Row gutter={16}>
                    <Col span={8}>
                        <Statistic title="总计事项" value={planStats.total} />
                    </Col>
                    <Col span={8}>
                        <Statistic title="已完成" value={planStats.completed} valueStyle={{ color: '#52c41a' }} suffix={`/ ${planStats.total}`} />
                    </Col>
                    <Col span={8}>
                        <Statistic title="待办" value={planStats.pending} valueStyle={{ color: '#faad14' }} />
                    </Col>
                </Row>
            </Card>


            <Card
                title={`${currentYear} 年度规划矩阵`}
                extra={<Button icon={<DownloadOutlined />} onClick={handleExportExcel}>导出为Excel</Button>}
            >
                {loading || suppliersLoading ? <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div> : (
                    <div style={matrixStyles.scrollContainer}>
                        <div style={matrixStyles.table}>
                            <div style={matrixStyles.headerRow}>
                                {/* --- 核心修改：修复字段名 parma_id 和 cmt --- */}
                                <div style={{ ...matrixStyles.stickyCell, flex: '0 0 100px', left: 0, fontWeight: 'bold' }}>Parma号</div>
                                <div style={{ ...matrixStyles.stickyCell, flex: '0 0 100px', left: 100, fontWeight: 'bold' }}>CMT</div>
                                <div style={{ ...matrixStyles.stickyCell, flex: '0 0 160px', left: 200, fontWeight: 'bold' }}>供应商</div>
                                {months.map(month => <div key={month} style={matrixStyles.headerCell}>{month}</div>)}
                            </div>


                            {suppliers.map(supplier => (
                                <div key={supplier.id} style={matrixStyles.bodyRow}>
                                    {/* ✨ 核心修正：将 parmaId 更正为 parma_id 以匹配您的数据库表 */}
                                    <div style={{ ...matrixStyles.stickyCell, flex: '0 0 100px', left: 0 }}>
                                        <Text type="secondary">{supplier.parma_id}</Text>
                                    </div>
                                    <div style={{ ...matrixStyles.stickyCell, flex: '0 0 100px', left: 100 }}>
                                        <Tag>{supplier.cmt}</Tag>
                                    </div>
                                    <div style={{ ...matrixStyles.stickyCell, flex: '0 0 160px', left: 200, fontWeight: 'bold' }}>
                                        {supplier.short_code}
                                    </div>

                                    {/* 月份单元格的渲染逻辑保持不变 */}
                                    {Array.from({ length: 12 }).map((_, monthIndex) => {
                                        const itemsInCell = matrixData[supplier.name]?.[monthIndex] || [];
                                        return (
                                            <div key={monthIndex} style={matrixStyles.cell}>
                                                {itemsInCell.map(item => (
                                                    // --- ✨ 核心修改：全新的单行事件 UI ---
                                                    <div
                                                        key={item.id}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            width: '100%',
                                                            padding: '4px',
                                                            marginBottom: '4px',
                                                            borderRadius: '4px',
                                                            background: item.status === 'completed' ? '#f6ffed' : '#fafafa',
                                                            border: '1px solid #d9d9d9'
                                                        }}
                                                    >
                                                        {/* 左侧：文字内容，可伸缩并截断 */}
                                                        <Tooltip title={<><div><b>项目:</b> {item.audit_project}</div><div><b>负责人:</b> {item.auditor}</div></>}>
                                                            <Text
                                                                style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap' }}
                                                                ellipsis={{ tooltip: false }} // Tooltip由外层提供，此处禁用默认的
                                                            >
                                                                <Tag color={item.type === 'audit' ? 'blue' : 'orange'}>{item.category}</Tag>
                                                                {
                                                                    item.audit_project.length > 5
                                                                        ? `${item.audit_project.substring(0, 5)}...`
                                                                        : item.audit_project
                                                                }
                                                            </Text>
                                                        </Tooltip>

                                                        {/* 右侧：操作按钮，固定宽度 */}
                                                        <Space size={0} style={{ flexShrink: 0, marginLeft: '8px' }}>
                                                            <Popconfirm
                                                                title={`确定要将状态变更为“${item.status === 'pending' ? '已完成' : '待办'}”吗?`}
                                                                onConfirm={() => handleMarkAsComplete(item.id, item.status)}
                                                            >
                                                                <Button type="text" size="small" style={{ padding: '0 4px', color: item.status === 'pending' ? '#1890ff' : '#8c8c8c' }}>
                                                                    {item.status === 'pending' ? <CheckCircleOutlined /> : <UndoOutlined />}
                                                                </Button>
                                                            </Popconfirm>
                                                            <Popconfirm title="确定删除此项吗?" onConfirm={() => handleDeleteEvent(item.id)}>
                                                                <Button type="text" size="small" icon={<DeleteOutlined />} danger style={{ padding: '0 4px' }} />
                                                            </Popconfirm>
                                                        </Space>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Card>

            <Modal
                title={eventType === 'audit' ? '新建审计计划' : '添加QRM会议'}
                open={isModalVisible}
                onCancel={handleCancel}
                footer={null}
                destroyOnClose // 确保每次打开模态框时表单都重置
            >
                <Form form={form} layout="vertical" onFinish={handleFormSubmit} style={{ marginTop: 24 }}>
                    <Form.Item name="supplierId" label="供应商" rules={[{ required: true, message: '请选择供应商' }]}>
                        <Select showSearch placeholder="请选择您负责的供应商" filterOption={(input, option) => option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0}>
                            {managedSuppliers.map(s => <Option key={s.id} value={s.id}>{s.short_code}</Option>)}
                        </Select>
                    </Form.Item>
                    <Form.Item name="plannedMonth" label="计划月份" rules={[{ required: true, message: '请选择月份' }]}>
                        <Select placeholder="请选择月份">{months.map((m, i) => <Option key={i + 1} value={i + 1}>{m}</Option>)}</Select>
                    </Form.Item>
                    <Form.Item name="category" label="问题类型" rules={[{ required: true, message: '请选择问题类型' }]}>
                        <Select placeholder="请选择问题类型">
                            {categories.map(cat => <Option key={cat.id} value={cat.name}>{cat.name}</Option>)}
                        </Select>
                    </Form.Item>
                    <Form.Item name="auditProject" label={eventType === 'audit' ? '审计项目' : '会议主题'} rules={[{ required: true, message: '请输入项目/主题' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="auditor" label="负责人" rules={[{ required: true, message: '请输入负责人' }]}>
                        <Input readOnly />
                    </Form.Item>
                    <Form.Item><Button type="primary" htmlType="submit">提交</Button></Form.Item>
                </Form>
            </Modal>
        </div>
    );
};


const handleExportExcel = async () => { /* ... (此函数逻辑无需修改) ... */ };

export default AuditPlanPage;
