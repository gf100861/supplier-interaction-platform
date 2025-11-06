import React, { useState, useMemo, useEffect } from 'react';
// 1. 引入 Radio 和 Form.Item (虽然 Form.Item 没显式用，但在 Select 内部需要)
import { Button, Modal, Form, Input, Select, Tag, Typography, Card, Popconfirm, Empty, Avatar, Space, Tooltip, Divider, Spin, Statistic, Row, Col, Radio } from 'antd';
import { PlusOutlined, UserOutlined, DeleteOutlined, AuditOutlined, TeamOutlined, LeftOutlined, RightOutlined, CheckCircleOutlined, DownloadOutlined, UndoOutlined, ReconciliationOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSuppliers } from '../contexts/SupplierContext';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../contexts/NotificationContext';
import { supabase } from '../supabaseClient';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

const months = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);

const stickyColumnWidths = {
    parma: 100,
    cmt: 100,
    supplier: 100,
};

const matrixStyles = {
    table: { display: 'inline-block', minWidth: '100%' },
    headerRow: {
        display: 'flex',
        position: 'sticky',
        top: 0,
        zIndex: 2,
        backgroundColor: '#fafafa'
    },
    bodyRow: { display: 'flex' },
    stickyCell: {
        padding: '8px 12px',
        borderRight: '1px solid #f0f0f0',
        backgroundColor: '#fff',
        position: 'sticky',
        zIndex: 1
    },
    headerCell: { padding: '16px', fontWeight: 'bold', borderRight: '1px solid #f0f0f0', textAlign: 'center', position: 'relative' },
    cell: { padding: '12px', borderRight: '1px solid #f0f0f0', borderTop: '1px solid #f0f0f0', minHeight: '80px' },
};


const AuditPlanPage = () => {
    const [events, setEvents] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [eventType, setEventType] = useState('audit');
    const [form] = Form.useForm();
    const [currentYear, setCurrentYear] = useState(dayjs().year());
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState([]);
    const [monthColumnWidths, setMonthColumnWidths] = useState(Array(12).fill(150));
    const { suppliers, loading: suppliersLoading } = useSuppliers();
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);
    const { messageApi } = useNotification();
    const navigate = useNavigate();

    // --- 2. 为筛选器添加 State ---
    const [selectedSupplierKeys, setSelectedSupplierKeys] = useState([]);
    const [selectedCategoryKeys, setSelectedCategoryKeys] = useState([]);
    const [selectedStatusKey, setSelectedStatusKey] = useState('all'); // 'all', 'pending', 'completed'


    if (currentUser.role === 'Supplier') {
        navigate('/');
    }

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: eventsData, error: eventsError } = await supabase
                .from('audit_plans')
                .select('*')
                .eq('year', currentYear);
            if (eventsError) throw eventsError;
            setEvents(eventsData || []);

            const { data: categoriesData, error: categoriesError } = await supabase
                .from('notice_categories')
                .select('id, name');
            if (categoriesError) throw categoriesError;

            const sortedCategories = (categoriesData || []).sort((a, b) => {
                const order = { "Process Audit": 1, "SEM": 2 };
                const aOrder = order[a.name] || Infinity;
                const bOrder = order[b.name] || Infinity;
                return aOrder - bOrder;
            });
            setCategories(sortedCategories);

        } catch (error) {
            messageApi.error(`加载规划数据失败: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentYear]);

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

    // --- 3. 核心修改：更新 filteredEvents 逻辑 ---
    const filteredEvents = useMemo(() => {
        if (!currentUser) return [];

        let roleFilteredEvents = [];
        // 角色过滤
        if (currentUser.role === 'Manager' || currentUser.role === 'Admin') {
            roleFilteredEvents = events;
        } else if (currentUser.role === 'SD') {
            const managedSupplierIds = new Set(managedSuppliers.map(s => s.id));
            roleFilteredEvents = events.filter(event => managedSupplierIds.has(event.supplier_id));
        }

        // --- 应用新增的筛选器 ---
        return roleFilteredEvents.filter(event => {
            // 状态筛选
            const statusMatch = selectedStatusKey === 'all' || event.status === selectedStatusKey;

            // 供应商筛选
            const supplierMatch = selectedSupplierKeys.length === 0 || selectedSupplierKeys.includes(event.supplier_id);

            // 类型筛选
            const categoryMatch = selectedCategoryKeys.length === 0 || selectedCategoryKeys.includes(event.category);

            return statusMatch && supplierMatch && categoryMatch;
        });
    }, [events, currentUser, managedSuppliers, selectedSupplierKeys, selectedCategoryKeys, selectedStatusKey]); // <-- 添加新依赖


    // --- 4. 核心修改：根据筛选器计算要渲染的供应商列表 ---
    const suppliersToRender = useMemo(() => {
        if (selectedSupplierKeys.length === 0) {
            return managedSuppliers; // 如果未筛选，显示所有管理的供应商
        }
        // 如果已筛选，只显示筛选中的供应商
        return managedSuppliers.filter(s => selectedSupplierKeys.includes(s.id));
    }, [managedSuppliers, selectedSupplierKeys]);


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
    }, [filteredEvents]); // 依赖于已过滤的事件

    const matrixData = useMemo(() => {
        const grouped = {};
        filteredEvents.forEach(event => { // 使用已过滤的事件
            if (!grouped[event.supplier_name]) {
                grouped[event.supplier_name] = Array.from({ length: 12 }, () => []);
            }
            if (event.planned_month >= 1 && event.planned_month <= 12) {
                grouped[event.supplier_name][event.planned_month - 1].push(event);
            } else {
                console.warn(`Invalid planned_month found: ${event.planned_month} for event ID: ${event.id}`);
            }
        });
        return grouped;
    }, [filteredEvents]); // 依赖于已过滤的事件

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
            fetchData();
        }
    };

    const handleDeleteEvent = async (id) => {
        const { error } = await supabase.from('audit_plans').delete().eq('id', id);
        if (error) {
            messageApi.error(`删除失败: ${error.message}`);
        } else {
            messageApi.success('事件已删除！');
            fetchData();
        }
    };

    // 2. 新增导航函数
    const handleNavigateToNotices = (plan) => {
        if (!plan.supplier_id || !plan.planned_month || !plan.year) {
            messageApi.error("无法跳转，计划信息不完整。");
            return;
        }

        // 导航到通知单列表页，并携带筛选参数
        navigate('/notices', {
            state: {
                preSelectedSupplierId: plan.supplier_id,
                preSelectedMonth: plan.planned_month,
                preSelectedYear: plan.year,
            }
        });
    };

    const showAddModal = (type) => {
        setEventType(type);
        form.resetFields();
        form.setFieldsValue({ auditor: currentUser?.username || '' });
        setIsModalVisible(true);
    };

    const handleCancel = () => setIsModalVisible(false);

    const handleFormSubmit = async (values) => {
        const selectedSupplier = managedSuppliers.find(s => s.id === values.supplierId);
        if (!selectedSupplier) {
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
            auditor: values.auditor,
            status: 'pending',
            comment: values.comment
        };
        const { error } = await supabase.from('audit_plans').insert([newEvent]);
        if (error) {
            messageApi.error(`添加失败: ${error.message}`);
        } else {
            const successMessageMap = {
                'audit': '审计计划 添加成功！',
                'qrm': 'QRM会议 添加成功！',
                'quality_review': '质量评审 添加成功！'
            };
            messageApi.success(successMessageMap[eventType] || '事件添加成功！');
            setIsModalVisible(false);
            fetchData();
        }
    };

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

    const handleResizeMouseDown = (index) => (e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = monthColumnWidths[index];
        const handleMouseMove = (moveEvent) => {
            const newWidth = startWidth + (moveEvent.clientX - startX);
            if (newWidth > 80) {
                setMonthColumnWidths(prevWidths => {
                    const newWidths = [...prevWidths];
                    newWidths[index] = newWidth;
                    return newWidths;
                });
            }
        };
        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleExportExcel = async () => {
        if (suppliersToRender.length === 0) { // 修正：使用 suppliersToRender
            messageApi.warning('没有可供导出的数据。');
            return;
        }
        messageApi.loading({ content: '正在生成Excel文件...', key: 'exporting' });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`${currentYear}年规划`);

        const columns = [
            { header: "Parma号", key: "parmaId", width: 15 },
            { header: "CMT", key: "cmt", width: 15 },
            { header: "供应商", key: "supplierName", width: 30 },
            ...months.map((m, i) => ({ header: m, key: `month_${i + 1}`, width: 30 }))
        ];
        worksheet.columns = columns;

        worksheet.getRow(1).eachCell(cell => {
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "4F81BD" } };
            cell.alignment = { horizontal: "center", vertical: "middle" };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        suppliersToRender.forEach(supplier => { // 修正：使用 suppliersToRender
            const rowData = {
                parmaId: supplier.parma_id,
                cmt: supplier.cmt,
                supplierName: supplier.name
            };

            months.forEach((_, monthIndex) => {
                const itemsInCell = matrixData[supplier.name]?.[monthIndex] || [];

                if (itemsInCell.length > 0) {
                    const richTextValue = itemsInCell.flatMap((item, index) => {
                        const statusText = item.status === 'completed' ? '[已完成] ' : '[待办] ';
                        const statusColor = item.status === 'completed' ? 'FF008000' : 'FFFFC000'; // Green : Orange
                        const typeText = { audit: '审计', qrm: 'QRM', quality_review: '评审' }[item.type] || item.type;
                        const mainText = `[${typeText}] ${item.category} (负责人: ${item.auditor || 'N/A'})`;

                        const textParts = [
                            { font: { bold: true, color: { argb: statusColor } }, text: statusText },
                            { font: { color: { argb: 'FF000000' } }, text: mainText }
                        ];

                        if (index < itemsInCell.length - 1) {
                            textParts.push({ font: { color: { argb: 'FF000000' } }, text: '\n' });
                        }
                        return textParts;
                    });
                    rowData[`month_${monthIndex + 1}`] = { richText: richTextValue };
                } else {
                    rowData[`month_${monthIndex + 1}`] = '';
                }
            });

            const row = worksheet.addRow(rowData);
            row.eachCell(cell => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `${currentYear}年度战略规划报告.xlsx`);
        messageApi.success({ content: 'Excel 文件已成功导出！', key: 'exporting', duration: 3 });
    };

    const getModalTitle = () => {
        switch (eventType) {
            case 'audit': return '新建审计计划';
            case 'qrm': return '添加QRM会议';
            case 'quality_review': return '添加质量评审';
            default: return '添加新事件';
        }
    };


    return (
        <div style={{ padding: '0 24px 24px 24px' }}>
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
                        <Button icon={<ReconciliationOutlined />} onClick={() => showAddModal('quality_review')} style={{ backgroundColor: '#e6f7ff', borderColor: '#91d5ff' }}>添加质量评审</Button>
                    </Space>
                </div>
                <Paragraph type="secondary" style={{ margin: '0' }}>规划和跟踪本年度供应商审计、QRM会议与质量评审的整体进度。</Paragraph>
                <Divider style={{ margin: '16px 0' }} />
                <Row gutter={[16, 16]} align="bottom">
                    <Col xs={24} sm={12} md={8} lg={6}>
                        <Form.Item label="筛选供应商" style={{ margin: 0 }}>
                            <Select
                                mode="multiple"
                                allowClear
                                placeholder="选择供应商 (默认全部)"
                                value={selectedSupplierKeys}
                                onChange={setSelectedSupplierKeys}
                                style={{ width: '100%' }}
                                options={managedSuppliers.map(s => ({ label: s.short_code, value: s.id }))}
                                filterOption={(input, option) =>
                                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                                maxTagCount="responsive"
                            />
                        </Form.Item>
                    </Col>
                    <Col xs={24} sm={12} md={8} lg={6}>
                        <Form.Item label="筛选问题类型" style={{ margin: 0 }}>
                            <Select
                                mode="multiple"
                                allowClear
                                placeholder="选择类型 (默认全部)"
                                value={selectedCategoryKeys}
                                onChange={setSelectedCategoryKeys}
                                style={{ width: '100%' }}
                                options={categories.map(c => ({ label: c.name, value: c.name }))}
                                maxTagCount="responsive"
                            />
                        </Form.Item>
                    </Col>
                    <Col xs={24} sm={12} md={8} lg={6}>
                        <Form.Item label="筛选状态" style={{ margin: 0 }}>
                            <Radio.Group
                                value={selectedStatusKey}
                                onChange={(e) => setSelectedStatusKey(e.target.value)}
                            >
                                <Radio.Button value="all">全部</Radio.Button>
                                <Radio.Button value="pending">待办</Radio.Button>
                                <Radio.Button value="completed">已完成</Radio.Button>
                            </Radio.Group>
                        </Form.Item>
                    </Col>
                </Row>

                <Divider style={{ margin: '16px 0' }} />
                <Row gutter={16}>
                    <Col span={8}><Statistic title="总计事项(已筛选）" value={planStats.total} /></Col>
                    <Col span={8}><Statistic title="已完成(已筛选）" value={planStats.completed} valueStyle={{ color: '#52c41a' }} suffix={`/ ${planStats.total}`} /></Col>
                    <Col span={8}><Statistic title="待办(已筛选）" value={planStats.pending} valueStyle={{ color: '#faad14' }} /></Col>
                </Row>
            </Card>

            <Card
                title={`${currentYear} 年度规划矩阵`}
                extra={<Button icon={<DownloadOutlined />} onClick={handleExportExcel}>导出为Excel</Button>}
                bodyStyle={{
                    padding: 0,
                    overflow: 'auto',
                    maxHeight: 'calc(100vh - 400px)'
                }}
            >
                {loading || suppliersLoading ? <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div> : (
                    // 移除 matrixStyles.scrollContainer
                    <div style={matrixStyles.table}>
                        <div style={matrixStyles.headerRow}>
                            <div style={{ ...matrixStyles.stickyCell, flex: `0 0 ${stickyColumnWidths.parma}px`, left: 0, fontWeight: 'bold' }}>Parma号</div>
                            <div style={{ ...matrixStyles.stickyCell, flex: `0 0 ${stickyColumnWidths.cmt}px`, left: stickyColumnWidths.parma, fontWeight: 'bold' }}>CMT</div>
                            <div style={{ ...matrixStyles.stickyCell, flex: `0 0 ${stickyColumnWidths.supplier}px`, left: stickyColumnWidths.parma + stickyColumnWidths.cmt, fontWeight: 'bold' }}>供应商</div>
                            {months.map((month, index) => (
                                <div key={month} style={{ ...matrixStyles.headerCell, flex: `0 0 ${monthColumnWidths[index]}px` }}>
                                    {month}
                                    <div
                                        onMouseDown={handleResizeMouseDown(index)}
                                        style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: '10px', cursor: 'col-resize', userSelect: 'none' }}
                                    />
                                </div>
                            ))}
                        </div>

                        {suppliersToRender.map(supplier => (
                            <div key={supplier.id} style={matrixStyles.bodyRow}>
                                <div style={{ ...matrixStyles.stickyCell, flex: `0 0 ${stickyColumnWidths.parma}px`, left: 0 }}>
                                    <Text type="secondary">{supplier.parma_id}</Text>
                                </div>
                                <div style={{ ...matrixStyles.stickyCell, flex: `0 0 ${stickyColumnWidths.cmt}px`, left: stickyColumnWidths.parma }}>
                                    <Tag>{supplier.cmt}</Tag>
                                </div>
                                <div style={{ ...matrixStyles.stickyCell, flex: `0 0 ${stickyColumnWidths.supplier}px`, left: stickyColumnWidths.parma + stickyColumnWidths.cmt, fontWeight: 'bold' }}>
                                    {supplier.short_code}
                                </div>

                                {Array.from({ length: 12 }).map((_, monthIndex) => {
                                    const itemsInCell = matrixData[supplier.name]?.[monthIndex] || [];
                                    return (
                                        <div key={monthIndex} style={{ ...matrixStyles.cell, flex: `0 0 ${monthColumnWidths[monthIndex]}px` }}>
                                            {itemsInCell.map(item => {
                                                const typeTagMap = {
                                                    audit: { color: 'blue', text: '审计' },
                                                    qrm: { color: 'orange', text: 'QRM' },
                                                    quality_review: { color: 'cyan', text: '评审' }
                                                };
                                                const typeInfo = typeTagMap[item.type] || { color: 'default', text: item.type };

                                                return (
                                                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '4px', marginBottom: '4px', borderRadius: '4px', background: item.status === 'completed' ? '#f6ffed' : '#fafafa', border: '1px solid #d9d9d9' }}>
                                                        <Tooltip key={`tooltip-${item.id}`} title={<><div><b>类型:</b> {item.category}</div><div><b>负责人:</b> {item.auditor}</div><div><b>备注:</b> {item.comment || '无'}</div></>}>
                                                            <Text style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                <Tag color={typeInfo.color}>{typeInfo.text}</Tag>
                                                            </Text>
                                                        </Tooltip>
                                                        {/* 3. 添加新按钮到 Space --- */}
                                                        <Space size={0} style={{ flexShrink: 0, marginLeft: '8px' }}>
                                                            <Tooltip title="查找相关通知单">
                                                                <Button
                                                                    type="text"
                                                                    size="small"
                                                                    icon={<FileTextOutlined />}
                                                                    style={{ color: '#595959' }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation(); // 阻止 Popconfirm 触发
                                                                        handleNavigateToNotices(item);
                                                                    }}
                                                                />
                                                            </Tooltip>
                                                            <Tooltip title={item.status === 'pending' ? '标记为已完成' : '标记为待办'}>
                                                                <Popconfirm title={`确定要将状态变更为“${item.status === 'pending' ? '已完成' : '待办'}”吗?`} onConfirm={() => handleMarkAsComplete(item.id, item.status)}>
                                                                    <Button type="text" size="small" style={{ padding: '0 5px', color: item.status === 'pending' ? '#7d92a7ff' : '#8c8c8c' }}>
                                                                        {item.status === 'pending' ? <CheckCircleOutlined /> : <UndoOutlined />}
                                                                    </Button>
                                                                </Popconfirm>
                                                            </Tooltip>
                                                            <Tooltip title="删除此计划">
                                                                <Popconfirm title="确定删除此项吗?" onConfirm={() => handleDeleteEvent(item.id)}>
                                                                    <Button type="text" size="small" icon={<DeleteOutlined />} danger style={{ padding: '0 4px' }} />
                                                                </Popconfirm>
                                                            </Tooltip>
                                                        </Space>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <Modal
                title={getModalTitle()}
                open={isModalVisible}
                onCancel={handleCancel}
                footer={null}
                destroyOnClose
            >
                <Form form={form} layout="vertical" onFinish={handleFormSubmit} style={{ marginTop: 24 }}>
                    <Form.Item name="supplierId" label="供应商" rules={[{ required: true, message: '请选择供应商' }]}>
                        <Select showSearch placeholder="请选择您负责的供应商" filterOption={(input, option) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())}>
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
                    <Form.Item name="comment" label="备注">
                        <Input.TextArea placeholder="请输入备注内容" />
                    </Form.Item>
                    <Form.Item name="auditor" label="负责人" rules={[{ required: true, message: '请输入负责人' }]} style={{ display: 'none' }}>
                        <Input readOnly />
                    </Form.Item>
                    <Form.Item><Button type="primary" htmlType="submit">提交</Button></Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default AuditPlanPage;

