import React, { useState, useMemo, useEffect } from 'react';
import { Button, Modal, Form, Input, Select, Tag, Typography, Card, Popconfirm, Empty, Avatar, Space, Tooltip, Divider, Spin, Statistic, Row, Col } from 'antd';
import { PlusOutlined, UserOutlined, DeleteOutlined, AuditOutlined, TeamOutlined, LeftOutlined, RightOutlined, CheckCircleOutlined, DownloadOutlined, UndoOutlined } from '@ant-design/icons';
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

// --- ✨ 核心修正 1：统一定义列宽以确保对齐 ---
const stickyColumnWidths = {
    parma: 100,
    cmt: 100,
    supplier: 100,
};

// --- 样式 (使用上面定义的列宽) ---
const matrixStyles = {
    scrollContainer: { overflowX: 'auto', border: '1px solid #f0f0f0', borderRadius: '8px' },
    table: { display: 'inline-block', minWidth: '100%' },
    headerRow: { display: 'flex', position: 'sticky', top: 0, zIndex: 2, backgroundColor: '#fafafa' },
    bodyRow: { display: 'flex' },
    stickyCell: { padding: '8px 12px', borderRight: '1px solid #f0f0f0', backgroundColor: '#fff', position: 'sticky', zIndex: 1 },
    headerCell: { padding: '16px', fontWeight: 'bold', borderRight: '1px solid #f0f0f0', textAlign: 'center', position: 'relative' }, // position: relative for resize handle
    cell: { padding: '12px', borderRight: '1px solid #f0f0f0', borderTop: '1px solid #f0f0f0', minHeight: '80px' },
};




const AuditPlanPage = () => {
    const [events, setEvents] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [eventType, setEventType] = useState('audit'); // 默认为 'audit'
    const [form] = Form.useForm();
    const [currentYear, setCurrentYear] = useState(dayjs().year());
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState([]);
    // --- ✨ 核心修正：为月份列宽添加状态管理 ---
    const [monthColumnWidths, setMonthColumnWidths] = useState(Array(12).fill(150));
    const { suppliers, loading: suppliersLoading } = useSuppliers();
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);
    const { messageApi } = useNotification();

    const navigate = useNavigate();


    if (currentUser.role === 'Supplier') {
        navigate('/'); // 跳转到初始页面
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

    useEffect(() => {
        if (suppliers && suppliers.length > 0) {
            console.log("从 Context 获取到的 Suppliers 数据:", suppliers);
        }
    }, [suppliers]);

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

    const filteredEvents = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === 'Manager' || currentUser.role === 'SD' || currentUser.role === 'Admin') {
            return events;
        }
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
    }, [filteredEvents]);

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
        const { error } = await supabase
            .from('audit_plans')
            .delete()
            .eq('id', id);

        if (error) {
            messageApi.error(`删除失败: ${error.message}`);
        } else {
            messageApi.success('事件已删除！');
            fetchData();
        }
    };

    const showAddModal = (type) => {
        setEventType(type);
        form.resetFields();
        form.setFieldsValue({
            auditor: currentUser?.username || ''
        });
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
        };

        const { error } = await supabase.from('audit_plans').insert([newEvent]);

        if (error) {
            messageApi.error(`添加失败: ${error.message}`);
        } else {
            messageApi.success(`${eventType === 'audit' ? '审计计划' : 'QRM会议'} 添加成功！`);
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

    // --- ✨ 核心修正：处理列宽拖拽的函数 ---
    const handleResizeMouseDown = (index) => (e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = monthColumnWidths[index];

        const handleMouseMove = (moveEvent) => {
            const newWidth = startWidth + (moveEvent.clientX - startX);
            if (newWidth > 80) { // 设置最小宽度
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
        if (managedSuppliers.length === 0) {
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

        managedSuppliers.forEach(supplier => {
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
                        const mainText = `[${item.type === 'audit' ? '审计' : 'QRM'}] ${item.category} (负责人: ${item.auditor || 'N/A'})`;
                        
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
                    </Space>
                </div>
                <Paragraph type="secondary" style={{ margin: '0' }}>规划和跟踪本年度供应商审计与QRM会议的整体进度。</Paragraph>
                <Divider style={{ margin: '16px 0' }} />
                <Row gutter={16}>
                    <Col span={8}><Statistic title="总计事项" value={planStats.total} /></Col>
                    <Col span={8}><Statistic title="已完成" value={planStats.completed} valueStyle={{ color: '#52c41a' }} suffix={`/ ${planStats.total}`} /></Col>
                    <Col span={8}><Statistic title="待办" value={planStats.pending} valueStyle={{ color: '#faad14' }} /></Col>
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
                                <div style={{ ...matrixStyles.stickyCell, flex: `0 0 ${stickyColumnWidths.parma}px`, left: 0, fontWeight: 'bold' }}>Parma号</div>
                                <div style={{ ...matrixStyles.stickyCell, flex: `0 0 ${stickyColumnWidths.cmt}px`, left: stickyColumnWidths.parma, fontWeight: 'bold' }}>CMT</div>
                                <div style={{ ...matrixStyles.stickyCell, flex: `0 0 ${stickyColumnWidths.supplier}px`, left: stickyColumnWidths.parma + stickyColumnWidths.cmt, fontWeight: 'bold' }}>供应商</div>
                                {/* --- ✨ 核心修正：渲染可拖拽调整的表头 --- */}
                                {months.map((month, index) => (
                                    <div key={month} style={{ ...matrixStyles.headerCell, flex: `0 0 ${monthColumnWidths[index]}px`}}>
                                        {month}
                                        <div
                                            onMouseDown={handleResizeMouseDown(index)}
                                            style={{
                                                position: 'absolute',
                                                right: 0,
                                                top: 0,
                                                height: '100%',
                                                width: '10px',
                                                cursor: 'col-resize',
                                                userSelect: 'none',
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>

                            {suppliers.map(supplier => (
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
                                            // --- ✨ 核心修正：应用动态的列宽 ---
                                            <div key={monthIndex} style={{ ...matrixStyles.cell, flex: `0 0 ${monthColumnWidths[monthIndex]}px` }}>
                                                {itemsInCell.map(item => (
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
                                                        <Tooltip key={`tooltip-${item.id}`} title={<><div><b>类型:</b> {item.category}</div><div><b>负责人:</b> {item.auditor}</div></>}>
                                                            <Text
                                                                style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                                            >
                                                                <Tag color={item.type === 'audit' ? 'blue' : 'orange'}>{item.type === 'audit' ? '审计' : 'QRM'}</Tag>
                                                                {/* {item.category} */}
                                                            </Text>
                                                        </Tooltip>
                                                        <Space size={0} style={{ flexShrink: 0, marginLeft: '8px' }}>
                                                            <Popconfirm
                                                                title={`确定要将状态变更为“${item.status === 'pending' ? '已完成' : '待办'}”吗?`}
                                                                onConfirm={() => handleMarkAsComplete(item.id, item.status)}
                                                            >
                                                                <Button type="text" size="small" style={{ padding: '0 5px', color: item.status === 'pending' ? '#1890ff' : '#8c8c8c' }}>
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
                    <Form.Item name="auditor" label="负责人" rules={[{ required: true, message: '请输入负责人' }]}>
                        <Input readOnly />
                    </Form.Item>
                    <Form.Item><Button type="primary" htmlType="submit">提交</Button></Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default AuditPlanPage;

