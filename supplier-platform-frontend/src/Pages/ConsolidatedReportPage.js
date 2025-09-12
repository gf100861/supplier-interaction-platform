import React, { useMemo, useState } from 'react';
import { Table, Button, Typography, Space, Tag, Empty, Card, DatePicker, Select, Modal, Timeline, Divider, Image, Input } from 'antd';
import { PrinterOutlined, DownloadOutlined, UserOutlined as PersonIcon, CalendarOutlined, PaperClipOutlined, PictureOutlined } from '@ant-design/icons';
import { mockNoticesData, noticeCategories, categoryColumnConfig, allPossibleStatuses } from '../data/_mockData';
import { useSuppliers } from '../contexts/SupplierContext';
import { useNotices } from '../contexts/NoticeContext';
import dayjs from 'dayjs';
import ExcelJS from 'exceljs';
import { useNotification } from '../contexts/NotificationContext';
import './ConsolidatedReport.css';

const { Title, Paragraph, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { Search } = Input; // 1. Import Search component

// 2. --- 复用历史记录的辅助函数 ---
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

const getSummaryFromHistory = (history) => {
    const planSubmission = history.find(h => h.type === 'supplier_plan_submission');
    const lastApproval = [...history].reverse().find(h => h.type.includes('_approval') || h.type.includes('_rejection'));

    return {
        deadline: planSubmission?.deadline || 'N/A',
        lastApprover: lastApproval?.submitter || 'N/A',
    };
};

const getStatusColor = (status) => {
    if (!status) return 'default';
    if (status.includes('完成')) return 'success'; // 绿色
    if (status.includes('作废')) return 'default'; // 灰色
    if (status.includes('审核')) return 'warning'; // 橙色
    if (status.includes('提交') || status.includes('上传')) return 'processing'; // 蓝色
    return 'default';
};

const ConsolidatedReportPage = () => {
    const { suppliers } = useSuppliers();
    const { notices } = useNotices();
    const { messageApi } = useNotification();
    
    const [dateRange, setDateRange] = useState([dayjs().startOf('year'), dayjs().endOf('year')]);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [detailsModal, setDetailsModal] = useState({ visible: false, notice: null });
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);
    
    const initialSelectedSuppliers = currentUser?.role === 'Supplier' ? [currentUser.id] : [];
    const [selectedSuppliers, setSelectedSuppliers] = useState(initialSelectedSuppliers);

    const [searchTerm, setSearchTerm] = useState('');



    const groupedData = useMemo(() => {
        let accessibleData = [];
        if (currentUser?.role === 'Supplier') {
            accessibleData = notices.filter(n => n.assignedSupplierId === currentUser.id);
        } else {
            accessibleData = notices;
        }

           const finalFilteredData = accessibleData.filter(notice => {
            // 关键字搜索
            const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
            if (lowerCaseSearchTerm) {
                const supplier = suppliers.find(s => s.id === notice.assignedSupplierId);
                const parmaId = supplier ? supplier.parmaId.toLowerCase() : '';

                const searchMatch = notice.id.toLowerCase().includes(lowerCaseSearchTerm) ||
                                  notice.title.toLowerCase().includes(lowerCaseSearchTerm) ||
                                  notice.assignedSupplierName.toLowerCase().includes(lowerCaseSearchTerm) ||
                                  parmaId.includes(lowerCaseSearchTerm);
                
                if (!searchMatch) return false;
            }

            // 其他下拉框和日期筛选
            const createTime = dayjs(notice.sdNotice.createTime);
            const [start, end] = dateRange || [];
            const isDateMatch = !start || !end || (createTime.isAfter(start) && createTime.isBefore(end));
            const isSupplierMatch = selectedSuppliers.length === 0 || selectedSuppliers.includes(notice.assignedSupplierId);
            const isCategoryMatch = selectedCategories.length === 0 || selectedCategories.includes(notice.category);
            const isStatusMatch = selectedStatuses.length === 0 || selectedStatuses.includes(notice.status);
            
            return isDateMatch && isSupplierMatch && isCategoryMatch && isStatusMatch;
        });

        const dataWithSummary = finalFilteredData.map(notice => ({
            ...notice,
            ...getSummaryFromHistory(notice.history || []),
        }));

        return dataWithSummary.reduce((acc, notice) => {
            const category = notice.category || '未分类';
            if (!acc[category]) acc[category] = [];
            acc[category].push(notice);
            return acc;
        }, {});
    // 2. 将 suppliers 添加到依赖项数组
    }, [dateRange, selectedSuppliers, selectedCategories, selectedStatuses, currentUser, notices, searchTerm, suppliers]);

    const categories = Object.keys(groupedData);

    const showDetailsModal = (notice) => setDetailsModal({ visible: true, notice });
    const handleDetailsCancel = () => setDetailsModal({ visible: false, notice: null });
    // 5. --- 升级列生成函数，加入“操作”列 ---
    const generateColumnsForCategory = (category) => {
        const baseColumns = [
            { title: 'ID', dataIndex: 'id', key: 'id', width: 180 },
            { title: '供应商', dataIndex: 'assignedSupplierName', key: 'assignedSupplierName', width: 150 },
            { title: '预计完成日期', dataIndex: 'deadline', key: 'deadline', width: 120 }, // 新增
            { title: '最后审批人', dataIndex: 'lastApprover', key: 'lastApprover', width: 150 }, // 新增
             { 
                title: '状态', 
                dataIndex: 'status', 
                key: 'status', 
                width: 150, 
                render: (status) => <Tag color={getStatusColor(status)}>{status}</Tag> 
            },
            { title: '创建时间', dataIndex: ['sdNotice', 'createTime'], key: 'createTime', width: 120, render: (time) => dayjs(time).format('YYYY-MM-DD') },
            
        ];
        const dynamicColumns = (categoryColumnConfig[category] || []).map(configCol => ({
            title: configCol.title,
            dataIndex: ['sdNotice', configCol.dataIndex],
            key: configCol.dataIndex,
            width: 200,
        }));
        const actionColumn = {
            title: '操作',
            key: 'action',
            fixed: 'right',
            width: 120,
            render: (_, record) => (
                <Button type="link" onClick={() => showDetailsModal(record)}>查看详情</Button>
            ),
        };
        return [...baseColumns.slice(0, 1), ...dynamicColumns, ...baseColumns.slice(1), actionColumn];
    };

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

        // 3. --- 遍历每个类别，分别为其创建一个工作表 ---
        for (const category of categories) {
            const worksheet = workbook.addWorksheet(category.substring(0, 30)); // Sheet名不能超过31个字符

            // --- 动态生成表头 ---
            const baseColumns = [
                { title: 'ID', dataIndex: 'id' },
                { title: '供应商', dataIndex: 'assignedSupplierName' },
                { title: '状态', dataIndex: 'status' },
                { title: '创建时间', dataIndex: ['sdNotice', 'createTime'] },
            ];
            const dynamicColumns = categoryColumnConfig[category] || [];
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


    return (
        <div className="printable-container">
            {/* --- 3. 筛选器和操作按钮现在都在页面顶部 --- */}
            <Card className="no-print" style={{ marginBottom: 24 }}>
                <Title level={4}>综合报告中心</Title>
                <Paragraph type="secondary">请选择筛选条件以生成报告，然后点击打印。</Paragraph>
                <Space wrap>
                    <RangePicker value={dateRange} onChange={setDateRange} />
                    <Select
                        mode="multiple"
                        allowClear
                        style={{ width: 300 }}
                        placeholder="筛选供应商"
                        onChange={setSelectedSuppliers}
                        value={selectedSuppliers}
                        disabled={currentUser?.role === 'Supplier'} // 如果是供应商，则禁用
                        options={suppliers.map(s => ({ label: s.name, value: s.id }))}
                    />

                    <Select
                        mode="multiple"
                        allowClear
                        style={{ width: 300 }}
                        placeholder="筛选问题类型 (默认全部)"
                        onChange={setSelectedCategories}
                        options={noticeCategories.map(c => ({ label: c, value: c }))}
                    />
                     <Select
                        mode="multiple"
                        allowClear
                        style={{ width: 250 }}
                        placeholder="筛选完成状态"
                        onChange={setSelectedStatuses}
                        // options 来自我们新导入的 allPossibleStatuses
                        options={allPossibleStatuses.map(s => ({ label: s, value: s }))}
                    />
                     <Search
                        placeholder="搜索ID, 标题, 供应商..."
                        allowClear
                        onSearch={setSearchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: 250 }}
                    />
                    <Button type="primary" icon={<DownloadOutlined />} onClick={handleExportExcel}>
                        导出为Excel
                    </Button>
                </Space>
            </Card>

            {/* --- 4. 报告内容区域 --- */}
            <div className="report-content">
                <Title level={4} style={{ textAlign: 'center' }}>供应商问题综合报告</Title>
                <Paragraph type="secondary" style={{ textAlign: 'center', display: 'block', marginBottom: 20 }}>
                    报告生成日期: {dayjs().format('YYYY-MM-DD HH:mm')}
                </Paragraph>

                {categories.length > 0 ? categories.map(category => {
                    // 为当前类别动态生成列
                    const reportColumns = generateColumnsForCategory(category);
                    return (
                        <div key={category} className="report-section">
                            <Title level={5} style={{ borderBottom: '2px solid #1890ff', paddingBottom: 8, marginBottom: 16 }}>
                                问题类型: {category} (共 {groupedData[category].length} 项)
                            </Title>
                            <Table
                                columns={reportColumns}
                                dataSource={groupedData[category]}
                                rowKey="id"
                                pagination={false}
                                bordered
                                size="small"
                            />
                        </div>
                    );
                }) : <Empty description="根据您的筛选条件，没有找到任何数据。" />}
            </div>
            <Modal
                title={`详情: ${detailsModal.notice?.title || ''}`}
                open={detailsModal.visible}
                onCancel={handleDetailsCancel}
                footer={null}
                width={800}
            >
                {detailsModal.notice && (
                    <>
                        <Title level={5} style={{ marginTop: 24 }}>初始通知内容</Title>
                        <Card size="small" type="inner">
                            <Paragraph><strong>问题描述:</strong> {detailsModal.notice.sdNotice.description}</Paragraph>
                            <Text type="secondary">由 {detailsModal.notice.sdNotice.creator} 于 {detailsModal.notice.sdNotice.createTime} 发起</Text>
                        </Card>
                        <Divider />
                        <Title level={5}>处理历史</Title>
                        <Timeline>
                            <Timeline.Item color="green">
                                <p><b>{detailsModal.notice.sdNotice.creator}</b> 发起了通知</p>
                                <small>{detailsModal.notice.sdNotice.createTime}</small>
                            </Timeline.Item>
                            {detailsModal.notice.history.map((h, index) => {
                                const details = getHistoryItemDetails(h);
                                const isApproval = h.type.includes('_approval') || h.type.includes('_rejection');
                                return (
                                    <Timeline.Item key={index} color={details.color}>
                                        <p><b>{h.submitter}</b> {details.text}</p>
                                        {(h.description || h.images || h.attachments || (h.responsible && h.deadline)) && (
                                            <Card size="small" type="inner" style={{ marginTop: 8 }}>
                                                {isApproval && (
                                                    <Paragraph><b>审批意见: </b>{h.description}</Paragraph>
                                                )}

                                                {h.type !== 'supplier_plan_submission' && h.description && !isApproval && (
                                                    <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{h.description}</Paragraph>
                                                )}

                                                {h.type === 'supplier_plan_submission' && (
                                                    <>
                                                        <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{h.description}</Paragraph>
                                                        <Divider style={{ margin: '12px 0' }} />
                                                        <Space direction="vertical" size="small">
                                                            <Text><PersonIcon style={{ marginRight: 8 }} /><b>负责人: </b>{h.responsible}</Text>
                                                            <Text><CalendarOutlined style={{ marginRight: 8 }} /><b>预计完成日期: </b><Text type="danger">{h.deadline}</Text></Text>
                                                        </Space>
                                                    </>
                                                )}
                                                {h.images && h.images.length > 0 && (
                                                    <div style={{ marginTop: 8 }}>
                                                        <Text strong><PictureOutlined /> 提交的图片:</Text><br />
                                                        <Image.PreviewGroup>
                                                            {h.images.map((img, i) => (
                                                                <Image key={i} width={80} height={80} src={img.url || img.thumbUrl} style={{ objectFit: 'cover', marginRight: 8, marginTop: 4, borderRadius: 4 }} />
                                                            ))}
                                                        </Image.PreviewGroup>
                                                    </div>
                                                )}

                                                {h.attachments && h.attachments.length > 0 && (
                                                    <div style={{ marginTop: 8 }}>
                                                        <Text strong><PaperClipOutlined /> 提交的附件:</Text><br />
                                                        {h.attachments.map((file, i) => (
                                                            <Button key={i} type="link" href={file.url} size="small" target="_blank" icon={<PaperClipOutlined />}>{file.name}</Button>
                                                        ))}
                                                    </div>
                                                )}
                                            </Card>
                                        )}
                                        <small>{h.time}</small>
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