import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
    Button, Modal, Form, Input, Select, Tag, Typography, Card,
    Popconfirm, Space, Tooltip, Divider, Spin,
    Statistic, Row, Col, Radio
} from 'antd';
import {
    DeleteOutlined, AuditOutlined, TeamOutlined, LeftOutlined,
    RightOutlined, CheckCircleOutlined, DownloadOutlined,
    UndoOutlined, ReconciliationOutlined, FileTextOutlined,
    CalendarOutlined, FullscreenOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSuppliers } from '../contexts/SupplierContext';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../contexts/NotificationContext';
import './AuditPlanPage.css';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_URL = isDev
    ? 'http://localhost:3001' 
    : window.location.origin; // 必须是这句！

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
        zIndex: 10,
        backgroundColor: '#fafafa',
        borderBottom: '1px solid #f0f0f0'
    },
    bodyRow: { display: 'flex' },
    stickyCell: {
        padding: '8px 12px',
        borderRight: '1px solid #f0f0f0',
        backgroundColor: '#fff',
        position: 'sticky',
        zIndex: 5
    },
    headerCell: { padding: '16px', fontWeight: 'bold', borderRight: '1px solid #f0f0f0', textAlign: 'center', position: 'relative' },
    cell: {
        padding: '8px',
        borderRight: '1px solid #f0f0f0',
        borderTop: '1px solid #f0f0f0',
        minHeight: '100px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        cursor: 'pointer',
        transition: 'background-color 0.2s'
    },
};

const translateError = (error) => {
    const msg = error?.message || error || '未知错误';
    if (msg.includes('Invalid login credentials')) return '登录凭证无效或已过期，请尝试重新登录';
    if (msg.includes('User not found')) return '用户不存在';
    if (msg.includes('duplicate key value')) return '该记录已存在，请勿重复添加';
    return msg;
};

const AuditPlanPage = () => {
    const [events, setEvents] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [eventType, setEventType] = useState('audit');
    const [form] = Form.useForm();
    const [currentYear, setCurrentYear] = useState(dayjs().year());
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState([]);
    const [monthColumnWidths, setMonthColumnWidths] = useState(Array(12).fill(190));
    const resizeSessionRef = useRef({ cleanup: null, frame: null });
    const { suppliers, loading: suppliersLoading } = useSuppliers();
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);
    const { messageApi } = useNotification();
    const navigate = useNavigate();


    const [isFullScreen, setIsFullScreen] = useState(false);

    // --- 筛选器 State ---
    const [selectedSupplierKeys, setSelectedSupplierKeys] = useState([]);
    const [selectedCategoryKeys, setSelectedCategoryKeys] = useState([]);
    const [selectedStatusKey, setSelectedStatusKey] = useState('all');

    const [rescheduleTarget, setRescheduleTarget] = useState(null);

    const rollingMonths = useMemo(() => {
        const options = [];
        const start = dayjs().startOf('month');
        for (let i = 0; i < 12; i++) {
            const d = start.add(i, 'month');
            options.push({
                label: d.format('YYYY年 M月'),
                value: JSON.stringify({ year: d.year(), month: d.month() + 1 }),
                year: d.year(),
                month: d.month() + 1
            });
        }
        return options;
    }, []);

    const fetchData = useCallback(async () => {
        const token = localStorage.getItem('access_token');

        // 安全检查
        if (!token) {
            // 如果是在页面初始化时没 Token，跳转登录
            // 如果是后续操作丢失 Token，也跳转
            // 这里可以加个判断，如果是静默刷新就不跳转，看你需求
            // messageApi.error('登录凭证丢失');
            navigate('/login');
            return;
        }

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        setLoading(true);
        try {
            // 这里写你原本的请求逻辑
            // 注意：如果在 URL 里用了 currentYear 等状态，要把它们加入到底部的依赖数组 []
            const eventsRes = await fetch(`${BACKEND_URL}/api/audit-plans?year=${currentYear}`, { headers });

            if (eventsRes.status === 401) throw new Error('UNAUTHORIZED');
            if (!eventsRes.ok) throw new Error('Fetch failed');

            const eventsData = await eventsRes.json();
            setEvents(eventsData || []);

            const configRes = await fetch(`${BACKEND_URL}/api/config`, { headers });
            if (!configRes.ok) throw new Error('Fetch config failed');
            const configData = await configRes.json();
            const categoriesData = Array.isArray(configData) ? configData : (configData.categories || []);

            const sortedCategories = categoriesData.sort((a, b) => {
                const order = { "Process Audit": 1, "SEM": 2 };
                return (order[a.name] || Infinity) - (order[b.name] || Infinity);
            });
            setCategories(sortedCategories);

        } catch (error) {
            console.error(error);
            if (error.message === 'UNAUTHORIZED') {
                navigate('/login');
            } else {
                messageApi.error('刷新数据失败');
            }
        } finally {
            setLoading(false);
        }
    }, [currentYear, navigate, messageApi]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => () => resizeSessionRef.current.cleanup?.(), []);

    const managedSuppliers = useMemo(() => {
        if (!currentUser || !suppliers) return [];
        if (currentUser.role === 'Manager' || currentUser.role === 'Admin') return suppliers;
        if (currentUser.role === 'SD') {
            const managed = currentUser.managed_suppliers || [];
            const managedIds = managed.map(m => m.supplier_id || m.supplier?.id || m);
            return suppliers.filter(s => managedIds.includes(s.id));
        }
        return [];
    }, [currentUser, suppliers]);

    const filteredEvents = useMemo(() => {
        if (!currentUser) return [];
        let roleFilteredEvents = [];
        if (currentUser.role === 'Manager' || currentUser.role === 'Admin') roleFilteredEvents = events;
        else if (currentUser.role === 'SD') {
            const managedSupplierIds = new Set(managedSuppliers.map(s => s.id));
            roleFilteredEvents = events.filter(event => managedSupplierIds.has(event.supplier_id));
        }
        return roleFilteredEvents.filter(event => {
            const statusMatch = selectedStatusKey === 'all' || event.status === selectedStatusKey;
            const supplierMatch = selectedSupplierKeys.length === 0 || selectedSupplierKeys.includes(event.supplier_id);
            const categoryMatch = selectedCategoryKeys.length === 0 || selectedCategoryKeys.includes(event.category);
            return statusMatch && supplierMatch && categoryMatch;
        });
    }, [events, currentUser, managedSuppliers, selectedSupplierKeys, selectedCategoryKeys, selectedStatusKey]);

    const suppliersToRender = useMemo(() => {
        if (selectedSupplierKeys.length === 0) return managedSuppliers;
        return managedSuppliers.filter(s => selectedSupplierKeys.includes(s.id));
    }, [managedSuppliers, selectedSupplierKeys]);

    const planStats = useMemo(() => {
        const stats = { total: filteredEvents.length, completed: 0, pending: 0 };
        for (const event of filteredEvents) {
            event.status === 'completed' ? stats.completed += 1 : stats.pending += 1;
        }
        return stats;
    }, [filteredEvents]);

    const matrixData = useMemo(() => {
        const grouped = {};
        filteredEvents.forEach(event => {
            if (!grouped[event.supplier_name]) grouped[event.supplier_name] = Array.from({ length: 12 }, () => []);
            if (event.planned_month >= 1 && event.planned_month <= 12) grouped[event.supplier_name][event.planned_month - 1].push(event);
        });
        return grouped;
    }, [filteredEvents]);

    // --- API Operations ---

    const handleMarkAsComplete = async (id, currentStatus) => {
        const newStatus = currentStatus === 'pending' ? 'completed' : 'pending';
        const completionDate = newStatus === 'completed' ? dayjs().format('YYYY-MM-DD') : null;
        try {
            const token = localStorage.getItem('access_token');

            // 安全检查
            if (!token) {
                messageApi.error('登录凭证丢失');
                navigate('/login');
                return;
            }

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };
            const response = await fetch(`${BACKEND_URL}/api/audit-plans`, {
                method: 'PATCH',
                headers: headers,
                body: JSON.stringify({ id, updates: { status: newStatus, completion_date: completionDate } })
            });
            if (!response.ok) throw new Error('Update failed');
            messageApi.success('状态更新成功！');
            fetchData();
        } catch (error) {
            messageApi.error(`更新状态失败: ${translateError(error.message)}`);
        }
    };

    const handleDeleteEvent = async (id) => {
        try {

            const token = localStorage.getItem('access_token');

            // 安全检查
            if (!token) {
                messageApi.error('登录凭证丢失');
                navigate('/login');
                return;
            }

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };
            const response = await fetch(`${BACKEND_URL}/api/audit-plans?id=${id}`, { method: 'DELETE', headers });
            if (!response.ok) throw new Error('Delete failed');
            messageApi.success('事件已删除！');
            fetchData();
        } catch (error) {
            messageApi.error(`删除失败: ${translateError(error.message)}`);
        }
    };

    const handleNavigateToNotices = (plan) => {
        if (!plan.supplier_id || !plan.planned_month || !plan.year) {
            messageApi.error("无法跳转，计划信息不完整。");
            return;
        }
        navigate('/notices', { state: { preSelectedSupplierId: plan.supplier_id, preSelectedMonth: plan.planned_month, preSelectedYear: plan.year } });
    };

    const handleReschedule = async (item) => {
        if (!rescheduleTarget) {
            messageApi.error("请选择一个新的月份！");
            return;
        }
        const target = JSON.parse(rescheduleTarget);
        if (target.year === item.year && target.month === item.planned_month) {
            messageApi.info("月份未改变。");
            setRescheduleTarget(null);
            return;
        }
        setLoading(true);
        try {
            const token = localStorage.getItem('access_token');

            // 安全检查
            if (!token) {
                messageApi.error('登录凭证丢失');
                navigate('/login');
                return;
            }

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };
            const response = await fetch(`${BACKEND_URL}/api/audit-plans`, {
                method: 'PATCH',
                headers: headers,
                body: JSON.stringify({ id: item.id, updates: { planned_month: target.month, year: target.year } })
            });
            if (!response.ok) throw new Error('Reschedule failed');
            messageApi.success(`计划已成功移动到 ${target.year}年 ${target.month}月！`);
            fetchData();
        } catch (error) {
            messageApi.error(`计划调整失败: ${translateError(error.message)}`);
        } finally {
            setLoading(false);
            setRescheduleTarget(null);
        }
    };

    // --- Modal Logic ---

    const showAddModal = (type, prefillData = {}) => {
        setEventType(type || 'audit');
        form.resetFields();
        form.setFieldsValue({
            auditor: currentUser?.username || '',
            supplierId: prefillData.supplierId || undefined,
            plannedMonth: prefillData.plannedMonth || undefined,
            type: type || 'audit'
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

        const finalType = values.type || eventType;

        const newEvent = {
            type: finalType,
            year: currentYear,
            category: values.category,
            planned_month: values.plannedMonth,
            supplier_id: selectedSupplier.id,
            supplier_name: selectedSupplier.name,
            auditor: values.auditor,
            status: 'pending',
            comment: values.comment
        };

        try {
            const token = localStorage.getItem('access_token');

            // 安全检查
            if (!token) {
                messageApi.error('登录凭证丢失');
                navigate('/login');
                return;
            }

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };
            const response = await fetch(`${BACKEND_URL}/api/audit-plans`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(newEvent)
            });

            if (!response.ok) throw new Error('Create failed');

            messageApi.success('事件添加成功！');
            setIsModalVisible(false);
            fetchData();
        } catch (error) {
            messageApi.error(`添加失败: ${translateError(error.message)}`);
        }
    };

    // --- Helpers ---
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

    const handleResizePointerDown = (index) => (e) => {
        e.preventDefault();
        e.stopPropagation();
        resizeSessionRef.current.cleanup?.();

        const startX = e.clientX;
        const startWidth = monthColumnWidths[index];
        const previousCursor = document.body.style.cursor;
        const previousUserSelect = document.body.style.userSelect;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const handlePointerMove = (moveEvent) => {
            const newWidth = Math.min(480, Math.max(100, startWidth + moveEvent.clientX - startX));
            if (resizeSessionRef.current.frame) cancelAnimationFrame(resizeSessionRef.current.frame);
            resizeSessionRef.current.frame = requestAnimationFrame(() => {
                setMonthColumnWidths(prevWidths => {
                    const newWidths = [...prevWidths];
                    newWidths[index] = newWidth;
                    return newWidths;
                });
            });
        };

        const cleanup = () => {
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', cleanup);
            document.removeEventListener('pointercancel', cleanup);
            if (resizeSessionRef.current.frame) cancelAnimationFrame(resizeSessionRef.current.frame);
            document.body.style.cursor = previousCursor;
            document.body.style.userSelect = previousUserSelect;
            resizeSessionRef.current = { cleanup: null, frame: null };
        };

        resizeSessionRef.current.cleanup = cleanup;
        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', cleanup);
        document.addEventListener('pointercancel', cleanup);
    };

    const handleExportExcel = async () => {
        // ... (Export logic unchanged) ...
        if (suppliersToRender.length === 0) {
            messageApi.warning('没有可供导出的数据。');
            return;
        }
        messageApi.loading({ content: '正在生成Excel文件...', key: 'exporting' });

        const [excelModule, fileSaverModule] = await Promise.all([
            import('exceljs'),
            import('file-saver'),
        ]);
        const ExcelJS = excelModule.default || excelModule;
        const saveAs = fileSaverModule.saveAs || fileSaverModule.default?.saveAs || fileSaverModule.default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`${currentYear}年规划`);

        const columns = [
            { header: "Parma号", key: "parmaId", width: 15 },
            { header: "CMT", key: "cmt", width: 15 },
            { header: "供应商", key: "supplierName", width: 30 },
            { header: "供应商代码", key: "shortCode", width: 15 },
            ...months.map((m, i) => ({ header: m, key: `month_${i + 1}`, width: 30 }))
        ];
        worksheet.columns = columns;

        worksheet.getRow(1).eachCell(cell => {
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "4F81BD" } };
            cell.alignment = { horizontal: "center", vertical: "middle" };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        suppliersToRender.forEach(supplier => {
            const rowData = {
                parmaId: supplier.parma_id,
                cmt: supplier.cmt,
                supplierName: supplier.name,
                shortCode: supplier.short_code
            };

            months.forEach((_, monthIndex) => {
                const itemsInCell = matrixData[supplier.name]?.[monthIndex] || [];

                if (itemsInCell.length > 0) {
                    const richTextValue = itemsInCell.flatMap((item, index) => {
                        const statusText = item.status === 'completed' ? '[已完成] ' : '[待办] ';
                        const statusColor = item.status === 'completed' ? 'FF008000' : 'FFFFC000';
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
        const typeLabels = { 'audit': '新建审计计划', 'qrm': '添加QRM会议', 'quality_review': '添加质量评审' };
        return typeLabels[eventType] || '添加新事件';
    };

    const eventTypeOptions = [
        { label: '审计计划', value: 'audit' },
        { label: 'QRM会议', value: 'qrm' },
        { label: '质量评审', value: 'quality_review' },
    ];

    const managedSupplierOptions = useMemo(
        () => managedSuppliers.map(s => ({ label: s.short_code, value: s.id })),
        [managedSuppliers]
    );

    const categoryOptions = useMemo(
        () => categories.map(c => ({ label: c.name, value: c.name })),
        [categories]
    );

    const monthOptions = useMemo(
        () => months.map((m, i) => ({ label: m, value: i + 1 })),
        []
    );

    const matrixWidth = useMemo(
        () => Object.values(stickyColumnWidths).reduce((sum, width) => sum + width, 0) + monthColumnWidths.reduce((sum, width) => sum + width, 0),
        [monthColumnWidths]
    );

    // ✅ 4. 封装筛选栏：提取成组件以便复用
    const renderFilterBar = () => (
        <Row gutter={[16, 20]} align="middle" style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} md={8} lg={6}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ whiteSpace: 'nowrap', marginRight: 12, color: '#000000d9' }}>筛选供应商:</span>
                    <Select
                        mode="multiple"
                        allowClear
                        placeholder="选择供应商 (默认全部)"
                        value={selectedSupplierKeys}
                        onChange={setSelectedSupplierKeys}
                        style={{ flex: 1, width: 0 }}
                        options={managedSupplierOptions}
                        filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                        maxTagCount="responsive"
                    />
                </div>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ whiteSpace: 'nowrap', marginRight: 12, color: '#000000d9' }}>计划类型:</span>
                    <Select
                        mode="multiple"
                        allowClear
                        placeholder="选择类型 (默认全部)"
                        value={selectedCategoryKeys}
                        onChange={setSelectedCategoryKeys}
                        style={{ flex: 1, width: 0 }}
                        options={categoryOptions}
                        maxTagCount="responsive"
                    />
                </div>
            </Col>
            <Col xs={24} sm={12} md={8} lg={8}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ whiteSpace: 'nowrap', marginRight: 12, color: '#000000d9' }}>筛选状态:</span>
                    <Radio.Group value={selectedStatusKey} onChange={(e) => setSelectedStatusKey(e.target.value)} buttonStyle="solid" style={{ flexShrink: 0 }}>
                        <Radio.Button value="all">全部</Radio.Button>
                        <Radio.Button value="pending">待办</Radio.Button>
                        <Radio.Button value="completed">已完成</Radio.Button>
                    </Radio.Group>
                </div>
            </Col>
        </Row>
    );

    // 5. 封装渲染函数：用于复用矩阵渲染逻辑
    const renderMatrixTable = () => (


        <div style={{ ...matrixStyles.table, width: matrixWidth }}>
            <div style={matrixStyles.headerRow}>
                <div style={{ ...matrixStyles.stickyCell, flex: `0 0 ${stickyColumnWidths.parma}px`, left: 0, fontWeight: 'bold' }}>Parma号</div>
                <div style={{ ...matrixStyles.stickyCell, flex: `0 0 ${stickyColumnWidths.cmt}px`, left: stickyColumnWidths.parma, fontWeight: 'bold' }}>CMT</div>
                <div style={{ ...matrixStyles.stickyCell, flex: `0 0 ${stickyColumnWidths.supplier}px`, left: stickyColumnWidths.parma + stickyColumnWidths.cmt, fontWeight: 'bold' }}>供应商</div>
                {months.map((month, index) => (
                    <div key={month} style={{ ...matrixStyles.headerCell, flex: `0 0 ${monthColumnWidths[index]}px` }}>
                        {month}
                        <div
                            aria-label={`调整${month}列宽`}
                            onPointerDown={handleResizePointerDown(index)}
                            style={{ position: 'absolute', right: -5, top: 0, height: '100%', width: '12px', cursor: 'col-resize', userSelect: 'none', touchAction: 'none', zIndex: 2 }}
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
                            <div
                                key={monthIndex}
                                style={{ ...matrixStyles.cell, flex: `0 0 ${monthColumnWidths[monthIndex]}px` }}
                                onClick={() => showAddModal('audit', { supplierId: supplier.id, plannedMonth: monthIndex + 1 })}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fafafa'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                            >
                                {itemsInCell.map(item => {
                                    const typeTagMap = {
                                        audit: { color: 'blue', text: '审计' },
                                        qrm: { color: 'orange', text: 'QRM' },
                                        quality_review: { color: 'cyan', text: '评审' }
                                    };
                                    const typeInfo = typeTagMap[item.type] || { color: 'default', text: item.type };

                                    const rescheduleTitle = (
                                        <div style={{ width: 200 }} onClick={e => e.stopPropagation()}>
                                            <Text>调整计划至:</Text>
                                            <Select
                                                placeholder="选择月份"
                                                style={{ width: '100%', marginTop: 8 }}
                                                onChange={(value) => setRescheduleTarget(value)}
                                                onClick={e => e.stopPropagation()}
                                            >
                                                {rollingMonths.map((opt) => (
                                                    <Option
                                                        key={opt.value}
                                                        value={opt.value}
                                                        disabled={item.year === opt.year && item.planned_month === opt.month}
                                                    >
                                                        {opt.label}
                                                    </Option>
                                                ))}
                                            </Select>
                                        </div>
                                    );

                                    return (
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
                                                background: item.status === 'completed' ? '#f6ffed' : '#ffffff',
                                                border: '1px solid #d9d9d9',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Tooltip key={`tooltip-${item.id}`} title={<><div><b>类型:</b> {item.category}</div><div><b>负责人:</b> {item.auditor}</div><div><b>备注:</b> {item.comment || '无'}</div></>}>
                                                <Text style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    <Tag color={typeInfo.color}>{typeInfo.text}</Tag>
                                                </Text>
                                            </Tooltip>
                                            <Space size={0} style={{ flexShrink: 0, marginLeft: '8px' }}>
                                                <Tooltip title="查找相关通知单">
                                                    <Button type="text" size="small" icon={<FileTextOutlined />} style={{ color: '#595959' }} onClick={(e) => { e.stopPropagation(); handleNavigateToNotices(item); }} />
                                                </Tooltip>
                                                <Tooltip title="调整计划月份">
                                                    <Popconfirm title={rescheduleTitle} onConfirm={() => handleReschedule(item)} onCancel={() => setRescheduleTarget(null)} okText="移动" cancelText="取消" disabled={item.status === 'completed'}>
                                                        <Button type="text" size="small" icon={<CalendarOutlined />} style={{ color: '#1890ff' }} disabled={item.status === 'completed'} onClick={e => e.stopPropagation()} />
                                                    </Popconfirm>
                                                </Tooltip>
                                                <Tooltip title={item.status === 'pending' ? '标记为已完成' : '标记为未完成'}>
                                                    <Popconfirm title={`确定要将状态变更为“${item.status === 'pending' ? '已完成' : '待办'}”吗?`} onConfirm={() => handleMarkAsComplete(item.id, item.status)}>
                                                        <Button type="text" size="small" style={{ padding: '0 5px', color: item.status === 'pending' ? '#7d92a7ff' : '#8c8c8c' }} onClick={e => e.stopPropagation()}>
                                                            {item.status === 'pending' ? <CheckCircleOutlined /> : <UndoOutlined />}
                                                        </Button>
                                                    </Popconfirm>
                                                </Tooltip>
                                                <Tooltip title="删除此计划">
                                                    <Popconfirm title="确定删除此项吗?" onConfirm={() => handleDeleteEvent(item.id)}>
                                                        <Button type="text" size="small" icon={<DeleteOutlined />} danger style={{ padding: '0 4px' }} onClick={e => e.stopPropagation()} />
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
    );

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
                <Paragraph type="secondary" style={{ margin: '0' }}>规划和跟踪本年度供应商审计、QRM会议与质量评审的整体进度。点击单元格空白处可快速添加。</Paragraph>
                <Divider style={{ margin: '16px 0' }} />

                {/* 6. 在主页面调用 Filter Bar */}
                {renderFilterBar()}

                <Divider style={{ margin: '16px 0' }} />
                <Row gutter={16}>
                    <Col span={8}><Statistic title="总计事项(已筛选）" value={planStats.total} /></Col>
                    <Col span={8}><Statistic title="已完成(已筛选）" value={planStats.completed} valueStyle={{ color: '#52c41a' }} suffix={`/ ${planStats.total}`} /></Col>
                    <Col span={8}><Statistic title="待办(已筛选）" value={planStats.pending} valueStyle={{ color: '#faad14' }} /></Col>
                </Row>
            </Card>

            <Card
                title={`${currentYear} 年度规划矩阵`}
                extra={
                    <Space>
                        <Button icon={<FullscreenOutlined />} onClick={() => setIsFullScreen(true)}>全屏视图</Button>
                        <Button icon={<DownloadOutlined />} onClick={handleExportExcel}>导出为Excel</Button>
                    </Space>
                }
                styles={{ body: { padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 400px)' } }}
            >
                {loading || suppliersLoading ? <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div> : (
                    renderMatrixTable() // 使用封装后的渲染函数
                )}
            </Card>

            {/* 7. 全屏 Modal：顶部放 Filter Bar，下面放 Table */}
            <Modal
                title={`${currentYear} 年度规划矩阵 (全景视图)`}
                open={isFullScreen}
                onCancel={() => setIsFullScreen(false)}
                footer={null}
                width="100vw"
                wrapClassName="audit-plan-fullscreen-modal"
                style={{ top: 0, paddingBottom: 0, margin: 0, maxWidth: 'none' }}
                styles={{
                    body: { height: 'calc(100vh - 57px)', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' },
                    mask: { backgroundColor: '#fff' },
                }}
            >
                {/* 筛选栏容器 */}
                <div style={{ padding: '16px 24px', background: '#f5f5f5', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
                    {renderFilterBar()}
                </div>
                {/* 表格容器 */}
                <div className="audit-plan-fullscreen-table">
                    {renderMatrixTable()}
                </div>
            </Modal>

            <Modal title={getModalTitle()} open={isModalVisible} onCancel={handleCancel} footer={null} destroyOnClose>
                <Form form={form} layout="vertical" onFinish={handleFormSubmit} style={{ marginTop: 24 }}>
                    <Form.Item name="type" label="计划类型" initialValue={eventType}>
                        <Radio.Group options={eventTypeOptions} onChange={(e) => setEventType(e.target.value)} buttonStyle="solid" />
                    </Form.Item>

                    <Form.Item name="supplierId" label="供应商" rules={[{ required: true, message: '请选择供应商' }]}>
                        <Select
                            showSearch
                            placeholder="请选择您负责的供应商"
                            options={managedSupplierOptions}
                            filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                            virtual
                        />
                    </Form.Item>
                    <Form.Item name="plannedMonth" label="计划月份" rules={[{ required: true, message: '请选择月份' }]}>
                        <Select placeholder="请选择月份" options={monthOptions} />
                    </Form.Item>
                    <Form.Item name="category" label="问题类型" rules={[{ required: true, message: '请选择问题类型' }]}>
                        <Select placeholder="请选择问题类型" options={categoryOptions} />
                    </Form.Item>
                    <Form.Item name="comment" label="备注">
                        <Input.TextArea placeholder="请输入备注内容" />
                    </Form.Item>
                    <Form.Item name="auditor" label="负责人" rules={[{ required: true, message: '请输入负责人' }]} style={{ display: 'none' }}>
                        <Input readOnly />
                    </Form.Item>
                    <Form.Item><Button type="primary" htmlType="submit" block>提交计划</Button></Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default AuditPlanPage;
