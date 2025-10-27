import { useMemo, useState } from 'react';
import { Table, Button, Typography, Space, Tag, Empty, Card, DatePicker, Select, Modal, Timeline, Divider, Image, Input, Spin, Tooltip, Collapse } from 'antd';
import { DownloadOutlined, UserOutlined as PersonIcon, CalendarOutlined, PaperClipOutlined, PictureOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';

import { useSuppliers } from '../contexts/SupplierContext';
import { useNotices } from '../contexts/NoticeContext';
import dayjs from 'dayjs';
import ExcelJS from 'exceljs';
import { useConfig } from '../contexts/ConfigContext';
import { useNotification } from '../contexts/NotificationContext';
import './ConsolidatedReport.css';
import minMax from 'dayjs/plugin/minMax';
dayjs.extend(minMax);


const { Title, Paragraph, Text } = Typography;
const { RangePicker } = DatePicker;
const { Search } = Input;
const { Panel } = Collapse;

// Helper components and functions (no changes here)
const getHistoryItemDetails = (historyItem) => {
    switch (historyItem.type) {
        case 'supplier_plan_submission': return { color: 'blue', text: '提交了行动计划' };
        case 'sd_plan_approval': return { color: 'green', text: '批准了行动计划' };
        case 'sd_plan_rejection': return { color: 'red', text: '退回了行动计划' };
        case 'supplier_evidence_submission': return { color: 'blue', text: '提交了完成证据' };
        case 'sd_evidence_approval': return { color: 'green', text: '审核通过了证据' };
        case 'sd_evidence_rejection': return { color: 'red', text: '退回了提交的证据' };
        default: return { color: 'grey', text: '执行了未知操作' };
    }
};

const allPossibleStatuses = [

    '待提交Action Plan',
    '待供应商关闭',
    '待SD确认',
    '待SD关闭',
    '已完成',
    '已作废'

]

const getSummaryFromHistory = (history) => {
    const latestPlanSubmission = [...(history || [])].reverse().find(h => h.type === 'supplier_plan_submission' && h.actionPlans && h.actionPlans.length > 0);
    let latestDeadline = 'N/A';
    if (latestPlanSubmission) {
        const deadlines = latestPlanSubmission.actionPlans.map(p => dayjs(p.deadline)).filter(d => d.isValid());
        if (deadlines.length > 0) {
            latestDeadline = dayjs.max(deadlines).format('YYYY-MM-DD');
        }
    }
    const lastApproval = [...(history || [])].reverse().find(h => h.type.includes('_approval') || h.type.includes('_rejection'));
    return {
        deadline: latestDeadline,
        lastApprover: lastApproval?.submitter || 'N/A',
    };
};

const AttachmentsDisplay = ({ attachments }) => {
    if (!attachments || attachments.length === 0) return null;
    return (<div style={{ marginTop: 12 }}><Text strong><PaperClipOutlined /> 附件:</Text><div style={{ marginTop: 8 }}><Space wrap>{attachments.map((file, i) => (<Button key={i} type="dashed" href={file.url} size="small" target="_blank" download={file.name} icon={<PaperClipOutlined />}>{file.name}</Button>))}</Space></div></div>);
};

const ImageScroller = ({ images, title }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    if (!images || images.length === 0) return null;
    const goToPrevious = () => setCurrentIndex(currentIndex === 0 ? images.length - 1 : currentIndex - 1);
    const goToNext = () => setCurrentIndex(currentIndex === images.length - 1 ? 0 : currentIndex + 1);
    return (<div style={{ marginTop: 12 }}><Text strong><PictureOutlined /> {title}:</Text><div style={{ position: 'relative', marginTop: 8 }}><Image.PreviewGroup items={images.map(img => img.url || img.thumbUrl)}><Image height={250} style={{ objectFit: 'contain', width: '100%', backgroundColor: '#f0f2f5', borderRadius: '8px' }} src={images[currentIndex].url || images[currentIndex].thumbUrl} /></Image.PreviewGroup>{images.length > 1 && (<><Button shape="circle" icon={<LeftOutlined />} onClick={goToPrevious} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} /><Button shape="circle" icon={<RightOutlined />} onClick={goToNext} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)' }} /><Tag style={{ position: 'absolute', bottom: 16, right: 16 }}>{currentIndex + 1} / {images.length}</Tag></>)}</div></div>);
};

// --- ✨ 核心修正 1: 添加用于在 Modal 中显示详情的组件 ---
const ActionPlanReviewDisplay = ({ historyItem }) => {
    if (!historyItem || !Array.isArray(historyItem.actionPlans) || historyItem.actionPlans.length === 0) {
        return <Text type="secondary">（无行动计划详情）</Text>;
    }

    return (
        <Collapse defaultActiveKey={['0']} style={{ marginTop: '12px' }} size="small">
            {historyItem.actionPlans.map((plan, index) => (
                <Panel
                    key={index}
                    header={<Text strong>{`行动项 #${index + 1}: ${plan.plan}`}</Text>}
                >
                    <Space size="large" wrap>
                        <Text type="secondary"><PersonIcon style={{ marginRight: 8 }} />负责人: {plan.responsible || '未指定'}</Text>
                        <Text type="secondary"><CalendarOutlined style={{ marginRight: 8 }} />截止日期: {dayjs(plan.deadline).format('YYYY-MM-DD') || '未指定'}</Text>
                    </Space>

                    {historyItem.type === 'supplier_evidence_submission' && (
                        <>
                            <Divider style={{ margin: '12px 0' }} />
                            <Paragraph>
                                <Text strong>完成情况说明:</Text>
                                <br />
                                <Text type="secondary">{plan.evidenceDescription || "（供应商未提供文字说明）"}</Text>
                            </Paragraph>
                            <ImageScroller images={plan.evidenceImages} title="图片证据" />
                            <AttachmentsDisplay attachments={plan.evidenceAttachments} />
                        </>
                    )}
                </Panel>
            ))}
        </Collapse>
    );
};


const getStatusColor = (status) => {
    if (!status) return 'default';
    if (status.includes('完成')) return 'success';
    if (status.includes('作废')) return 'default';
    if (status.includes('待SD关闭')) return 'purple';
    if (status.includes('待SD确认')) return 'green';
    if (status.includes('待提交Action Plan')) return 'blue';
    if (status.includes('待供应商关闭')) return 'yellow';
    return 'default';
};


const getNestedValue = (obj, path) => {
    if (!path) return obj;
    // If path is a string like 'status', convert to array
    const pathArray = Array.isArray(path) ? path : [path];
    return pathArray.reduce((acc, key) => (acc && acc[key] != null) ? acc[key] : '', obj);
};

const ConsolidatedReportPage = () => {
    const { suppliers } = useSuppliers();
    const { notices, loading: noticesLoading } = useNotices();
    const { messageApi } = useNotification();
    const [dateRange, setDateRange] = useState([dayjs().startOf('year'), dayjs().endOf('year')]);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [detailsModal, setDetailsModal] = useState({ visible: false, notice: null });
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);
    const initialSelectedSuppliers = currentUser?.role === 'Supplier' ? [currentUser.supplier_id] : [];
    const [selectedSuppliers, setSelectedSuppliers] = useState(initialSelectedSuppliers);
    const [searchTerm, setSearchTerm] = useState('');
    const { noticeCategories } = useConfig();

    const filteredNotices = useMemo(() => {
        let accessibleData = [];
        if (currentUser?.role === 'Supplier') {
            const supplierCompanyId = currentUser.supplier_id;
            if (!supplierCompanyId) return [];
            accessibleData = notices.filter(n => n.assignedSupplierId === supplierCompanyId);
        } else if (currentUser?.role === 'Manager' || currentUser?.role === 'Admin') {
            // Manager 和 Admin 可以看到所有通知
            accessibleData = notices;
        } else if (currentUser?.role === 'SD') {
            // SD 只能看到自己创建的通知 (如果需要看所有, 此处改为 accessibleData = notices;)
            const supplierDevelopmentId = currentUser.id;
            accessibleData = notices.filter(n => n.creator?.id === supplierDevelopmentId);
        } else {
             // 其他未知角色看不到任何通知
            accessibleData = [];
        }

        return accessibleData.filter(notice => {
            const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
            if (lowerCaseSearchTerm) {
                const supplier = suppliers.find(s => s.id === notice.assignedSupplierId);
                const parmaId = supplier ? (supplier.parma_id || '').toLowerCase() : '';
                const searchMatch = notice.noticeCode.toLowerCase().includes(lowerCaseSearchTerm) ||
                    notice.title.toLowerCase().includes(lowerCaseSearchTerm) ||
                    notice.assignedSupplierName.toLowerCase().includes(lowerCaseSearchTerm) ||
                    parmaId.includes(lowerCaseSearchTerm);
                if (!searchMatch) return false;
            }

            const createTime = dayjs(notice.sdNotice.createTime);
            const [start, end] = dateRange || [];
            const isDateMatch = !start || !end || (createTime.isAfter(start) && createTime.isBefore(end));
            const isSupplierMatch = selectedSuppliers.length === 0 || selectedSuppliers.includes(notice.assignedSupplierId);
            const isCategoryMatch = selectedCategories.length === 0 || selectedCategories.includes(notice.category);
            const isStatusMatch = selectedStatuses.length === 0 || selectedStatuses.includes(notice.status);

            return isDateMatch && isSupplierMatch && isCategoryMatch && isStatusMatch;
        });
    }, [dateRange, selectedSuppliers, selectedCategories, selectedStatuses, currentUser, notices, searchTerm, suppliers]);


    const groupedData = useMemo(() => {
        const noticesWithDetails = filteredNotices.map(notice => {
            const actions = [];
            const findings = [];
            notice.history?.forEach(h => {
                if (h.type === 'supplier_plan_submission' && h.actionPlans) {
                    h.actionPlans.forEach(plan => {
                        actions.push(plan.plan);
                    });
                }
                if (h.type === 'supplier_evidence_submission' && h.actionPlans) {
                    h.actionPlans.forEach(plan => {
                        findings.push(plan.evidenceDescription || 'N/A');
                    });
                }
            });

            return {
                ...notice,
                ...getSummaryFromHistory(notice.history || []),
                actions,
                findings,
            };
        });

        return noticesWithDetails.reduce((acc, notice) => {
            const category = notice.category || '未分类';
            if (!acc[category]) acc[category] = [];
            acc[category].push(notice);
            return acc;
        }, {});
    }, [filteredNotices]);


    const sortedNoticeCategories = useMemo(() => {
        if (!noticeCategories || noticeCategories.length === 0) return [];
        const target = "Process Audit";
        if (noticeCategories.includes(target)) {
            return [target, ...noticeCategories.filter(item => item !== target)];
        }
        return noticeCategories;
    }, [noticeCategories]);

    const managedSuppliers = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === 'Manager' || currentUser.role === 'Admin') return suppliers;
        if (currentUser.role === 'SD') {
            const managed = currentUser.managed_suppliers || [];
            return managed.map(assignment => assignment.supplier).filter(Boolean);
        }
        return [];
    }, [currentUser, suppliers]);

    const showDetailsModal = (notice) => setDetailsModal({ visible: true, notice });
    const handleDetailsCancel = () => setDetailsModal({ visible: false, notice: null });

    const generateColumnsForCategory = (category) => {

        const baseColumns = [
            { title: 'Parma ID', dataIndex: ['supplier', 'parmaId'], key: 'parma_id', width: 100, sorter: (a, b) => getNestedValue(a, ['supplier', 'parmaId']).localeCompare(getNestedValue(b, ['supplier', 'parmaId'])), },
            {
                title: '供应商', dataIndex: ['supplier', 'shortCode'], key: 'supplier', width: 120,
                render: (shortCode, record) => (shortCode || 'N/A'),
                sorter: (a, b) => getNestedValue(a, ['supplier', 'shortCode']).localeCompare(getNestedValue(b, ['supplier', 'shortCode'])),
            },
            { title: '状态', dataIndex: 'status', key: 'status', width: 150, render: (status) => <Tag color={getStatusColor(status)}>{status}</Tag> },

            {
                title: '行动计划',
                dataIndex: 'actions',
                key: 'actions',
                width: 250,
                render: (actions) => {
                    if (!actions || actions.length === 0) {
                        return <Text type="secondary">N/A</Text>;
                    }
                    return (
                        <div style={{ whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto' }}>
                            {actions.map((action, index) => (
                                <div key={index} style={{ paddingBottom: '4px' }}>{`${index + 1}. ${action}`}</div>
                            ))}
                        </div>
                    );
                }
            },
            {
                title: '发现项 / 证据',
                dataIndex: 'findings',
                key: 'findings',
                width: 250,
                render: (findings) => {
                    if (!findings || findings.length === 0) {
                        return <Text type="secondary">N/A</Text>;
                    }
                    return (
                        <div style={{ whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto' }}>
                            {findings.map((finding, index) => (
                                <div key={index} style={{ paddingBottom: '4px' }}>{`${index + 1}. ${finding}`}</div>
                            ))}
                        </div>
                    );
                }
            },
            { title: '创建时间', dataIndex: ['sdNotice', 'createTime'], key: 'createTime', width: 120, render: (time) => dayjs(time).format('YYYY-MM-DD'), sorter: (a, b) => dayjs(a.createdAt).diff(dayjs(b.createdAt)) },
            {
                title: '预计完成',
                dataIndex: 'deadline',
                key: 'deadline',
                width: 120,
                // Add sorter for dates, handling 'N/A'
                sorter: (a, b) => {
                    const dateA = a.deadline !== 'N/A' ? dayjs(a.deadline) : dayjs('1970-01-01');
                    const dateB = b.deadline !== 'N/A' ? dayjs(b.deadline) : dayjs('1970-01-01');
                    return dateA.diff(dateB);
                }
            },
        ];
        const dynamicColumns = ([]).map(configCol => ({
            title: configCol.title,
            dataIndex: ['sdNotice', 'details', configCol.dataIndex],
            key: configCol.dataIndex,
            width: 200,
            ellipsis: true,
            render: (text) => <Tooltip title={text}>{text}</Tooltip>,
            sorter: (a, b) => {
                const valA = getNestedValue(a, ['sdNotice', 'details', configCol.dataIndex]);
                const valB = getNestedValue(b, ['sdNotice', 'details', configCol.dataIndex]);
                // Handle numbers and text
                if (typeof valA === 'number' && typeof valB === 'number') {
                    return valA - valB;
                }
                return String(valA).localeCompare(String(valB));
            }
        }));
        const actionColumn = {
            title: '操作', key: 'action', fixed: 'right', width: 120,
            render: (_, record) => (<Button type="link" onClick={() => showDetailsModal(record)}>查看详情</Button>),
        };
        return [...baseColumns.slice(0, 4), ...dynamicColumns, ...baseColumns.slice(4), actionColumn];
    };

    const categories = Object.keys(groupedData);


    const handleExportExcel = async () => {
        if (categories.length === 0) {
            messageApi.warning('没有可供导出的数据。');
            return;
        }

        messageApi.loading({ content: '正在生成Excel文件...', key: 'exporting' });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'SD Platform';
        workbook.created = new Date();

        // 定义通用样式
        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } },
            alignment: { vertical: 'middle', horizontal: 'center' },
            border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
        };

        console.log(notices)

        // 3. --- 遍历每个类别，分别为其创建一个工作表 ---
        for (const category of categories) {
            const worksheet = workbook.addWorksheet(category.substring(0, 30)); // Sheet名不能超过31个字符

            // --- 动态生成表头 ---
            const baseColumns = [
                { title: 'ParmaId', dataIndex: ['supplier', 'parmaId'] },
                { title: '供应商', dataIndex: 'assignedSupplierName' },
                { title: '状态', dataIndex: 'status' },
                { title: '创建时间', dataIndex: ['sdNotice', 'createTime'] },
                { title: '预计时间', dataIndex: ['sdNotice', 'createTime'] },
            ];
            const dynamicColumns = [];
            const allHeaders = [...dynamicColumns, ...baseColumns];

            worksheet.columns = allHeaders.map(col => ({
                header: col.title,
                key: col.dataIndex.toString(), // key 必须是字符串
                width: col.title.length > 15 ? 40 : 25,
            }));

            // 应用表头样式
            worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => {
                cell.s = headerStyle;
            });

            // --- 准备并添加行数据 ---
            const rows = groupedData[category].map(notice => {
                const rowData = {};
                allHeaders.forEach(col => {
                    const key = col.dataIndex.toString();
                    // 处理嵌套数据路径
                    if (Array.isArray(col.dataIndex)) {
                        rowData[key] = col.dataIndex.reduce((obj, key) => (obj && obj[key] !== 'undefined') ? obj[key] : '', notice);
                    } else {
                        rowData[key] = notice[col.dataIndex];
                    }
                });
                return rowData;
            });
            worksheet.addRows(rows);
        }

        // 4. --- 生成并下载文件 ---
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `供应商问题综合报告_${dayjs().format('YYYY-MM-DD')}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        messageApi.success({ content: 'Excel 文件已成功导出！', key: 'exporting', duration: 3 });
    };

    if (noticesLoading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 200px)' }}><Spin size="large" /></div>;
    }

    const categoriesWithData = Object.keys(groupedData);

    return (
        <div className="printable-container">
            <Card className="no-print" style={{ marginBottom: 24 }}>
                <Title level={4}>综合报告中心</Title>
                <Paragraph type="secondary">请选择筛选条件以生成报告。</Paragraph>
                <Space wrap>
                    <RangePicker value={dateRange} onChange={setDateRange} />
                    <Select
                        mode="multiple"
                        allowClear
                        style={{ width: 300 }}
                        placeholder="筛选供应商"
                        onChange={setSelectedSuppliers}
                        value={selectedSuppliers}
                        disabled={currentUser?.role === 'Supplier'}
                        options={managedSuppliers.map(s => ({ value: s.id, label: `${s.short_code} (${s.name})` }))}
                    />
                    <Select
                        mode="multiple"
                        allowClear
                        style={{ width: 300 }}
                        placeholder="筛选问题类型 (默认全部)"
                        onChange={setSelectedCategories}
                        options={sortedNoticeCategories.map(c => ({ label: c, value: c }))}
                    />
                    <Select
                        mode="multiple"
                        allowClear
                        style={{ width: 250 }}
                        placeholder="筛选完成状态"
                        onChange={setSelectedStatuses}
                        options={allPossibleStatuses.map(s => ({ label: s, value: s }))}
                    />
                    <Search
                        placeholder="搜索ID, 标题, 供应商..."
                        allowClear
                        onSearch={setSearchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: 250 }}
                    />
                    <Button type="primary" icon={<DownloadOutlined />} onClick={handleExportExcel}>导出为Excel</Button>
                </Space>
            </Card>

            <div className="report-content">
                <Title level={4} style={{ textAlign: 'center' }}>供应商问题综合报告</Title>
                <Paragraph type="secondary" style={{ textAlign: 'center', display: 'block', marginBottom: 20 }}>
                    报告生成日期: {dayjs().format('YYYY-MM-DD HH:mm')}
                </Paragraph>

                <div className="report-section">
                    <Title level={5} style={{ borderBottom: '2px solid #1890ff', paddingBottom: 8, marginBottom: 16 }}>
                        综合报告 (共 {filteredNotices.length} 项)
                    </Title>
                    {categoriesWithData.length > 0 ? categoriesWithData.map(category => (
                        <div key={category} style={{ marginBottom: 24 }}>
                            <Title level={5} style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 8, marginBottom: 16 }}>
                                问题类型: {category} (共 {groupedData[category].length} 项)
                            </Title>
                            <Table
                                columns={generateColumnsForCategory(category)}
                                dataSource={groupedData[category]}
                                rowKey="id"
                                pagination={false}
                                bordered
                                size="small"
                            />
                        </div>
                    )) : <Empty description="根据您的筛选条件，没有找到任何数据。" />}
                </div>
            </div>

            <Modal
                title={`详情: ${detailsModal.notice?.title || ''}`}
                open={detailsModal.visible}
                onCancel={handleDetailsCancel}
                footer={null}
                width={800}
                destroyOnClose
            >
                {detailsModal.notice && (
                    <>
                        <Title level={5} style={{ marginTop: 24 }}>初始通知内容</Title>
                        <Card size="small" type="inner">
                            <Paragraph><strong>问题描述:</strong> {detailsModal.notice.sdNotice.description || "N/A"}</Paragraph>
                            <ImageScroller images={detailsModal.notice.sdNotice.images} title="初始图片" />
                            <AttachmentsDisplay attachments={detailsModal.notice.sdNotice.attachments} />
                            <Divider style={{ margin: '16px 0' }} />
                            <Text type="secondary">由 {detailsModal.notice.creator?.name || 'N/A'} 于 {dayjs(detailsModal.notice.sdNotice.createTime).format('YYYY-MM-DD')} 发起</Text>
                        </Card>
                        <Divider />
                        <Title level={5}>处理历史</Title>
                        <Timeline>
                            {(detailsModal.notice.history || []).map((h, index) => {
                                const details = getHistoryItemDetails(h);
                                return (
                                    <Timeline.Item key={index} color={details.color}>
                                        <p><b>{h.submitter}</b> {details.text} <Text type="secondary"> @ {dayjs(h.time).format('YYYY-MM-DD HH:mm')}</Text></p>

                                        {h.description && <Paragraph type="secondary" style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0 16px' }}>{h.description}</Paragraph>}

                                        {/* --- ✨ 核心修正 2: 在 Modal 的 Timeline 中使用 ActionPlanReviewDisplay --- */}
                                        {(h.type === 'supplier_plan_submission' || h.type === 'supplier_evidence_submission') && h.actionPlans && h.actionPlans.length > 0 && (
                                            <ActionPlanReviewDisplay historyItem={h} />
                                        )}
                                    </Timeline.Item>
                                );
                            })}
                        </Timeline>
                    </>
                )}
            </Modal>
        </div>
    );
};

export default ConsolidatedReportPage;

