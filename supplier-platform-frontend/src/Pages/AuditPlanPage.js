import React, { useState, useMemo, useEffect } from 'react';
import { Button, Modal, Form, Input, Select, Tag, Typography, Card, Popconfirm, Empty, Avatar, Space, Tooltip, Divider } from 'antd';
import { PlusOutlined, UserOutlined, DeleteOutlined, AuditOutlined, TeamOutlined, LeftOutlined, RightOutlined, CheckCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSuppliers } from '../contexts/SupplierContext';
import { mockEventsData, noticeCategories, noticeCategoryDetails } from '../data/_mockData';
import { useNotification } from '../contexts/NotificationContext';
import * as XLSX from 'xlsx'; // 2. 再次导入 xlsx 库
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

const months = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);

// --- 样式升级：支持多列冻结和事件卡片颜色 ---
const matrixStyles = {
    scrollContainer: { overflowX: 'auto', border: '1px solid #f0f0f0', borderRadius: '8px' },
    table: { display: 'inline-block', minWidth: '100%' },
    headerRow: { display: 'flex', position: 'sticky', top: 0, zIndex: 2 },
    bodyRow: { display: 'flex' },
    // 冻结列的基础样式
    stickyCell: { padding: '8px 12px', borderRight: '1px solid #f0f0f0', backgroundColor: '#fff', position: 'sticky', zIndex: 1 },
    // 月份表头
    headerCell: { flex: '0 0 180px', padding: '16px', fontWeight: 'bold', backgroundColor: '#fafafa', borderRight: '1px solid #f0f0f0', textAlign: 'center' },
    // 内容单元格
    cell: { flex: '0 0 180px', padding: '12px', borderRight: '1px solid #f0f0f0', borderTop: '1px solid #f0f0f0', minHeight: '120px' },
    // 事件卡片
    auditCard: { marginBottom: '8px', borderLeft: '4px solid #1890ff' },
    qrmCard: { marginBottom: '8px', borderLeft: '4px solid #fa8c16' },
};

const EventItem = ({ item, onDelete, onComplete }) => {
    const itemStyle = {
        padding: '8px',
        borderRadius: '4px',
        marginBottom: '6px',
        borderLeft: `3px solid ${item.type === 'audit' ? '#1890ff' : '#fa8c16'}`,
        backgroundColor: '#f9f9f9',
    };
    const categoryInfo = noticeCategoryDetails[item.category] || { id: 'N/A', color: 'default' };

    return (
        <div style={itemStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <Tag color={categoryInfo.color}>{categoryInfo.id}</Tag>
                <Popconfirm title="确定删除此项吗?" onConfirm={() => onDelete(item.id)}>
                    <Button type="text" size="small" icon={<DeleteOutlined />} danger style={{ padding: '0 4px' }} />
                </Popconfirm>
            </div>

            {/* --- 使用 antd 内置的 ellipsis 属性来实现截断和 Tooltip --- */}
            <Text
                style={{ fontSize: 13, display: 'block', marginBottom: '8px' }}
                ellipsis={{ tooltip: item.auditProject }}
            >
                {item.auditProject}
            </Text>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space size={4}>
                    <Avatar size="small" icon={<UserOutlined />} />
                    <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{item.auditor}</Text>
                </Space>
                {item.status === 'pending' ? (
                    <Popconfirm title="确认完成此项吗?" onConfirm={() => onComplete(item.id)}>
                        <Button type="link" size="small" style={{ padding: 0 }}>完成</Button>
                    </Popconfirm>
                ) : (
                    <Tag icon={<CheckCircleOutlined />} color="success" style={{ margin: 0 }}>已完成</Tag>
                )}
            </div>
        </div>
    );
};


const AuditPlanPage = () => {
    const [events, setEvents] = useState(mockEventsData);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [eventType, setEventType] = useState(null);
    const [form] = Form.useForm();
    const [currentYear, setCurrentYear] = useState(dayjs().year()); // NEW: 当前年份 state

    const { suppliers } = useSuppliers();
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

    const { messageApi } = useNotification()

    // --- 2. 核心功能：自动更新状态的 useEffect ---
    useEffect(() => {
        const today = dayjs().startOf('day'); // 获取今天的开始时间，忽略时分秒
        let updatedCount = 0;

        const updatedEvents = events.map(event => {
            // 只检查状态为 'pending' 且有 'completionDate' 的事件
            if (event.status === 'pending' && event.completionDate) {
                const completionDate = dayjs(event.completionDate);

                // 如果完成日期是今天或今天之前
                if (completionDate.isBefore(today) || completionDate.isSame(today)) {
                    updatedCount++;
                    // 返回一个更新了状态的新对象
                    return { ...event, status: 'completed' };
                }
            }
            // 其他情况，返回原始事件
            return event;
        });

        // 只有当真正有事件被更新时，才设置 state 以避免不必要的重渲染
        if (updatedCount > 0) {
            setEvents(updatedEvents);
            messageApi.info(`自动更新了 ${updatedCount} 个已到期的事项为“已完成”状态。`);
        }
    }, []); // 空依赖数组 [] 意味着这个 effect 只在组件首次加载时运行一次

    // NEW: 过滤只显示当前年份的事件
    const filteredEvents = useMemo(() => {
        const yearFiltered = events.filter(e => e.year === currentYear);
        if (!currentUser) return []; // 返回空数组以防 currentUser 尚未加载
        if (currentUser.role === 'Manager' || 'SD') return yearFiltered;
        // if (currentUser.role === 'SD') return yearFiltered.filter(e => e.auditor === currentUser.name);

        return [];
    }, [events, currentUser, currentYear]);

    const matrixData = useMemo(() => {
        const grouped = {};
        filteredEvents.forEach(event => {
            if (!grouped?.[event.supplierName]) {
                grouped[`${event.supplierName}`] = Array.from({ length: 12 }, () => []);
            }
            grouped[`${event.supplierName}`][event.plannedMonth - 1].push(event);
        });
        return grouped;
    }, [filteredEvents]);

    const handleMarkAsComplete = (id) => {
        setEvents(prevEvents =>
            prevEvents.map(event =>
                event.id === id
                    ? { ...event, status: 'completed', completionDate: dayjs().format('YYYY-MM-DD') }
                    : event
            )
        );
        messageApi.success('已标记为完成！');
    };
    const handleCancel = () => setIsModalVisible(false);

    // NEW: 删除单个事件
    const handleDeleteEvent = (id) => {
        setEvents(events.filter(e => e.id !== id));
        messageApi.success('事件已删除！');
    };

    // NEW: 打开模态框（现在需要知道事件类型）
    const showAddModal = (type) => {
        setEventType(type);
        form.resetFields();
        // 如果当前用户是 SD，则自动填充并锁定负责人为他自己
        if (currentUser && currentUser.role === 'SD') {
            form.setFieldsValue({
                auditor: currentUser.name,
            });
        }
        setIsModalVisible(true);
    };

    const handleFormSubmit = (values) => {
        const selectedSupplier = suppliers.find(s => s.id === values.supplierId);
        const newEvent = {
            id: `EVT-${Date.now()}`,
            type: eventType, // 使用 state 中的事件类型
            year: currentYear,
            category: values.category,
            plannedMonth: values.plannedMonth,
            supplierId: selectedSupplier.id,
            supplierName: selectedSupplier.name,
            auditProject: values.auditProject,
            auditor: values.auditor,
            status: 'pending',
            completionDate: null,
        };
        setEvents(prev => [...prev, newEvent]);
        messageApi.success(`${eventType === 'audit' ? '审计计划' : 'QRM会议'} 添加成功！`);
        setIsModalVisible(false);
    };

    // NEW: 切换到上一年
    const prevYear = () => {
        setCurrentYear(currentYear - 1);
    };

    // NEW: 切换到下一年
    const nextYear = () => {
        setCurrentYear(currentYear + 1);
    };

    // NEW: 处理年份选择
    const handleYearChange = (year) => {
        setCurrentYear(year);
    };

    // NEW: 生成年份选项
    const generateYearOptions = () => {
        const current = dayjs().year();
        const years = [];
        for (let i = current - 2; i <= current + 2; i++) {
            years.push(<Option key={i} value={i}>{i}</Option>);
        }
        return years;
    };

    // 3. 新增：处理Excel导出的函数
    // NEW: 升级版的Excel导出函数，支持自定义样式和格式
   const handleExportExcel = async () => {
        if (filteredEvents.length === 0) {
            messageApi.warning('当前视图没有可导出的数据。');
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`${currentYear}年规划`);

        // 1. --- 核心修改：在列定义中增加“问题类型” ---
        worksheet.columns = [
            { header: "序号", key: "index", width: 6 },
            { header: "事件类型", key: "type", width: 15 },
            { header: "问题类型", key: "category", width: 15 }, // <-- 新增的列
            { header: "主题/项目", key: "project", width: 40 },
            { header: "供应商", key: "supplier", width: 20 },
            { header: "负责人", key: "auditor", width: 20 },
            { header: "状态", key: "status", width: 12 },
            { header: "计划月份", key: "month", width: 10 },
            { header: "完成日期", key: "completionDate", width: 15 },
            // 图片列可以暂时移除，因为我们还没有从UI获取图片的Base64数据
            // { header: "图片", key: "image", width: 12 },
        ];

        // 2. 表头样式 (保持不变)
        worksheet.getRow(1).eachCell(cell => {
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "4F81BD" } };
            cell.alignment = { horizontal: "center", vertical: "middle" };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        // 3. 填充数据
        filteredEvents.forEach((event, index) => {
            const rowIndex = worksheet.lastRow.number + 1;
            const row = worksheet.addRow({
                index: index + 1,
                type: event.type === 'audit' ? '审计计划' : 'QRM会议',
                category: event.category || '未分类', // <-- 核心修改：添加 category 数据
                project: event.auditProject,
                supplier: event.supplierName,
                auditor: event.auditor,
                status: event.status === 'completed' ? '已完成' : '待办',
                month: `${event.plannedMonth}月`,
                completionDate: event.completionDate || ''
            });

            // 设置单元格边框 (保持不变)
            row.eachCell(cell => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });

            // 状态列样式 (保持不变)
            const statusCell = row.getCell("status");
            if (statusCell.value === "已完成") {
                statusCell.font = { bold: true, color: { argb: "008000" } }; // 绿色
            } else if (statusCell.value === "待办") {
                statusCell.font = { color: { argb: "FFC000" } }; // 橙色
            }

            // 图片插入逻辑 (保持不变, 但目前 event.imageBase64 不存在)
            // if (event.imageBase64) { ... }
        });

        // 4. 添加汇总行 (保持不变)
        worksheet.addRow([]);
        worksheet.addRow([`总计: ${filteredEvents.length} 项`]);

        // 5. 导出文件 (保持不变)
        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `${currentYear}年度战略规划报告.xlsx`);
    };


    return (
        <div style={{ padding: '0 24px 24px 24px' }}>
            <Card style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        {/* NEW: 年份切换按钮 */}
                        <Button icon={<LeftOutlined />} onClick={prevYear} size="small" style={{ marginRight: 8 }} />
                        {/* NEW: 年份选择器 */}
                        <Select defaultValue={currentYear} style={{ width: 120, marginRight: 8 }} onChange={handleYearChange}>
                            {generateYearOptions()}
                        </Select>
                        {/* NEW: 年份切换按钮 */}
                        <Button icon={<RightOutlined />} onClick={nextYear} size="small" />
                        <Title level={4} style={{ margin: 0, marginLeft: 16 }}>{currentYear} 年度战略规划面板</Title>
                    </div>
                    <Space>
                        <Button type="primary" icon={<AuditOutlined />} onClick={() => showAddModal('audit')}>新建审计计划</Button>
                        <Button icon={<TeamOutlined />} onClick={() => showAddModal('qrm')} style={{ backgroundColor: '#fffbe6', borderColor: '#ffe58f' }}>添加QRM会议</Button>
                    </Space>
                </div>
                <Paragraph type="secondary" style={{ margin: 0, marginTop: '4px' }}>规划和跟踪本年度供应商审计与QRM会议。</Paragraph>
            </Card>


            <Card

                title={`${currentYear} 年度战略规划面板`}
                extra={
                    <Button icon={<DownloadOutlined />} onClick={handleExportExcel}>
                        导出为Excel
                    </Button>
                }

            >
                <div style={matrixStyles.scrollContainer}>
                    <div style={matrixStyles.table}>
                        <div style={matrixStyles.headerRow}>
                            <div style={{ ...matrixStyles.stickyCell, flex: '0 0 100px', left: 0, fontWeight: 'bold', backgroundColor: '#fafafa' }}>Parma号</div>
                            <div style={{ ...matrixStyles.stickyCell, flex: '0 0 100px', left: 100, fontWeight: 'bold', backgroundColor: '#fafafa' }}>CMT</div>
                            <div style={{ ...matrixStyles.stickyCell, flex: '0 0 160px', left: 200, fontWeight: 'bold', backgroundColor: '#fafafa' }}>供应商</div>
                            {months.map(month => <div key={month} style={matrixStyles.headerCell}>{month}</div>)}
                        </div>

                        {suppliers.map(supplier => (
                            <div key={supplier.id} style={matrixStyles.bodyRow}>
                                <div style={{ ...matrixStyles.stickyCell, flex: '0 0 100px', left: 0 }}><Text type="secondary">{supplier.parmaId}</Text></div>
                                <div style={{ ...matrixStyles.stickyCell, flex: '0 0 100px', left: 100 }}><Tag>{supplier.cmt}</Tag></div>
                                <div style={{ ...matrixStyles.stickyCell, flex: '0 0 160px', left: 200, fontWeight: 'bold' }}>{supplier.name}</div>

                                {Array.from({ length: 12 }).map((_, monthIndex) => {
                                    // 这里使用 ?. 安全地访问可能不存在的 supplier.name
                                    const itemsInCell = matrixData[supplier.name]?.[monthIndex] || [];

                                    const groupedByAuditor = itemsInCell.reduce((acc, item) => {
                                        const auditor = item.auditor;
                                        if (!acc[auditor]) { acc[auditor] = []; }
                                        acc[auditor].push(item);
                                        return acc;
                                    }, {});
                                    return (
                                        <div key={monthIndex} style={matrixStyles.cell}>
                                            {Object.entries(groupedByAuditor).map(([auditor, auditorEvents], groupIndex) => (
                                                <div key={auditor} style={{ marginBottom: groupIndex < Object.keys(groupedByAuditor).length - 1 ? 16 : 0 }}>

                                                    {auditorEvents.map(item => {
                                                        const categoryInfo = noticeCategoryDetails[item.category] || { id: 'N/A', color: 'default' };
                                                        return (
                                                            <Card
                                                                key={item.id}
                                                                size="small"
                                                                style={{
                                                                    marginBottom: '8px',
                                                                    borderLeft: `3px solid ${item.type === 'audit' ? '#1890ff' : '#fa8c16'}`,
                                                                }}
                                                                bodyStyle={{ padding: '8px' }}
                                                            >
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                                    <Tag color={categoryInfo.color}>{categoryInfo.id}</Tag>
                                                                    <Popconfirm title="确定删除此项吗?" onConfirm={() => handleDeleteEvent(item.id)}>
                                                                        <Button type="text" size="small" icon={<DeleteOutlined />} danger style={{ padding: '0 4px' }} />
                                                                    </Popconfirm>
                                                                </div>

                                                                {/* --- 核心修正：强制省略号的 Flexbox 布局 --- */}
                                                                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', alignItems: 'center', minHeight: '45px' }}>
                                                                    {item.auditProject.length > 8 ? (
                                                                        <Tooltip title={item.auditProject}>
                                                                            <Text style={{ fontSize: 13 }}>
                                                                                {`${item.auditProject.substring(0, 10)}...`}
                                                                            </Text>
                                                                        </Tooltip>
                                                                    ) : (
                                                                        <Text style={{ fontSize: 13 }}>
                                                                            {item.auditProject}
                                                                        </Text>
                                                                    )}
                                                                </div>

                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    {/* This space is intentionally left empty to push the status to the right */}
                                                                    <div></div>
                                                                    {item.status === 'pending' ? (
                                                                        <Popconfirm title="确认完成此项吗?" onConfirm={() => handleMarkAsComplete(item.id)}>
                                                                            <Button type="link" size="small" style={{ padding: 0 }}>完成</Button>
                                                                        </Popconfirm>
                                                                    ) : (
                                                                        <Tag icon={<CheckCircleOutlined />} color="success" style={{ margin: 0 }}>已完成</Tag>
                                                                    )}
                                                                </div>
                                                            </Card>
                                                        )
                                                    })}

                                                    {groupIndex < Object.keys(groupedByAuditor).length - 1 && <Divider style={{ margin: '12px 0' }} />}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </Card>

            <Modal
                title={eventType === 'audit' ? '新建审计计划' : '添加QRM会议'}
                open={isModalVisible}
                onCancel={handleCancel}
                footer={null}
            >
                <Form form={form} layout="vertical" onFinish={handleFormSubmit} style={{ marginTop: 24 }}>
                    <Form.Item name="supplierId" label="供应商" rules={[{ required: true }]}>
                        <Select placeholder="请选择供应商">{suppliers.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}</Select>
                    </Form.Item>
                    <Form.Item name="plannedMonth" label="计划月份" rules={[{ required: true }]}>
                        <Select placeholder="请选择月份">{months.map((m, i) => <Option key={i + 1} value={i + 1}>{m}</Option>)}</Select>
                    </Form.Item>
                    <Form.Item name="category" label="问题类型" rules={[{ required: true, message: '请选择问题类型' }]}>
                        <Select placeholder="请选择问题类型">
                            {noticeCategories.map(cat => <Option key={cat} value={cat}>{cat}</Option>)}
                        </Select>
                    </Form.Item>
                    <Form.Item name="auditProject" label={eventType === 'audit' ? '审计项目' : '会议主题'} rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="auditor" label="负责人" rules={[{ required: true }]}>
                        <Input readOnly={currentUser?.role === 'SD'} placeholder={currentUser?.role === 'Manager' ? '请指定一位负责人' : ''} />
                    </Form.Item>

                    <Form.Item><Button type="primary" htmlType="submit">提交</Button></Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default AuditPlanPage;