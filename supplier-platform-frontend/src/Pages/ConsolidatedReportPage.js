import  { useMemo, useState } from 'react';
import { Table, Button, Typography, Space, Tag, Empty, Card, DatePicker, Select, Modal, Timeline, Divider, Image, Input, Spin,List,Tooltip } from 'antd';
import { DownloadOutlined, UserOutlined as PersonIcon, CalendarOutlined, PaperClipOutlined, PictureOutlined,LeftOutlined, RightOutlined} from '@ant-design/icons';
import { categoryColumnConfig, allPossibleStatuses } from '../data/_mockData';
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
    const latestPlanSubmission = [...(history || [])].reverse().find(h => h.type === 'supplier_plan_submission' && h.actionPlans && h.actionPlans.length > 0);
    
    let latestDeadline = 'N/A';
    if (latestPlanSubmission) {
        const deadlines = latestPlanSubmission.actionPlans.map(p => dayjs(p.deadline)).filter(d => d.isValid());
        if (deadlines.length > 0) {
            // dayjs.max() 现在是有效的函数
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
    return ( <div style={{ marginTop: 12 }}><Text strong><PaperClipOutlined /> 附件:</Text><div style={{ marginTop: 8 }}><Space wrap>{attachments.map((file, i) => (<Button key={i} type="dashed" href={file.url} size="small" target="_blank" icon={<PaperClipOutlined />}>{file.name}</Button>))}</Space></div></div> );
};

const ImageScroller = ({ images, title }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    if (!images || images.length === 0) return null;
    const goToPrevious = () => setCurrentIndex(currentIndex === 0 ? images.length - 1 : currentIndex - 1);
    const goToNext = () => setCurrentIndex(currentIndex === images.length - 1 ? 0 : currentIndex + 1);
    return ( <div style={{ marginTop: 12 }}><Text strong><PictureOutlined /> {title}:</Text><div style={{ position: 'relative', marginTop: 8 }}><Image height={250} style={{ objectFit: 'contain', width: '100%', backgroundColor: '#f0f2f5', borderRadius: '8px' }} src={images[currentIndex].url || images[currentIndex].thumbUrl} />{images.length > 1 && (<><Button shape="circle" icon={<LeftOutlined />} onClick={goToPrevious} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} /><Button shape="circle" icon={<RightOutlined />} onClick={goToNext} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)' }} /><Tag style={{ position: 'absolute', bottom: 16, right: 16 }}>{currentIndex + 1} / {images.length}</Tag></>)}</div></div> );
};



const getStatusColor = (status) => {
    if (!status) return 'default';
    if (status.includes('完成')) return 'success'; // 绿色
    if (status.includes('作废')) return 'default'; // 灰色
    if (status.includes('审核')) return 'purple'; // 橙色
    if (status.includes('提交') || status.includes('上传')) return 'processing'; // 蓝色
    if (status.includes('关闭')) return 'orange'
    if(status.includes('处理')) return 'blue'
    return 'default';
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
    
    // --- 核心修正 1：初始化时，使用供应商用户的 supplier_id ---
    const initialSelectedSuppliers = currentUser?.role === 'Supplier' ? [currentUser.supplier_id] : [];

    console.log(initialSelectedSuppliers)
    const [selectedSuppliers, setSelectedSuppliers] = useState(initialSelectedSuppliers);

    const [searchTerm, setSearchTerm] = useState('');

    const { noticeCategories } = useConfig();

    const sortedNoticeCategories = useMemo(() => {
            if (!noticeCategories || noticeCategories.length === 0) {
                return [];
            }
            const target = "Process Audit"; // 您想要置顶的项
            // 如果目标项存在于数组中，则将其置顶
            if (noticeCategories.includes(target)) {
                return [target, ...noticeCategories.filter(item => item !== target)];
            }
            // 如果不存在，则返回原始顺序
            return noticeCategories;
        }, [noticeCategories]); // 依赖于从 Context 获取的原始分类列表

      const managedSuppliers = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === 'Manager') return suppliers;
        if (currentUser.role === 'SD') {
          const managed = currentUser.managed_suppliers || [];
          return managed.map(assignment => assignment.supplier);
        }
        return [];
      }, [currentUser, suppliers]);

    console.log(managedSuppliers)

        const groupedData = useMemo(() => {
       
        let accessibleData = [];
        if (currentUser?.role === 'Supplier') {
            const supplierCompanyId = currentUser.supplier_id;
          
            if (!supplierCompanyId) {

                return {};
            }
            accessibleData = notices.filter(n => n.assignedSupplierId === supplierCompanyId);

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

    // const supplier_shotcode=assignedSupplierName.short_code

    const showDetailsModal = (notice) => setDetailsModal({ visible: true, notice });
    const handleDetailsCancel = () => setDetailsModal({ visible: false, notice: null });
    // 5. --- 升级列生成函数，加入“操作”列 ---
    //在dataIndex处修改Value值
    //这是一个 Ant Design Table 的高级用法，它告诉表格：“请不要在顶层的 notice 对象里找数据，而是进入它嵌套的 supplier 对象，然后找到里面的 parmaId 属性来显示”。
    const generateColumnsForCategory = (category) => {
        const baseColumns = [
            { title: 'ID', dataIndex: ['supplier', 'parmaId'], key: 'id', width: 50 },
            { 
                title: '供应商', 
                dataIndex: ['supplier', 'shortCode'], 
                key: 'supplier', 
                width: 80,
                render: (shortCode, record) => (
                    <Tooltip title={record.assignedSupplierName}>
                        {shortCode || 'N/A'}
                    </Tooltip>
                )
            },
             { 
                title: '状态', 
                dataIndex: 'status', 
                key: 'status', 
                width: 100, 
                render: (status) => <Tag color={getStatusColor(status)}>{status}</Tag> 
            },
            { title: '创建时间', dataIndex: ['sdNotice', 'createTime'], key: 'createTime', width: 120, render: (time) => dayjs(time).format('YYYY-MM-DD') },
            //
              // --- 核心修正 2：确保 dataIndex 正确指向我们新计算出的 'deadline' ---
            { 
                title: '预计完成日期', 
                dataIndex: 'deadline', // 直接使用顶层的 deadline 属性
                key: 'deadline', 
                width: 120 
            },
            
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

     if (noticesLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 200px)' }}>
                <Spin size="large" />
            </div>
        );
    }


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
                         options={managedSuppliers.map(s => ({ value: s.id, label: `${s.short_code}` }))}
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
                destroyOnClose
            >
                {detailsModal.notice && (
                    <>
                        <Title level={5} style={{ marginTop: 24 }}>初始通知内容</Title>
                        <Card size="small" type="inner">
                            <Paragraph><strong>问题描述:</strong> {detailsModal.notice.sdNotice.description}</Paragraph>
                            <ImageScroller images={detailsModal.notice.sdNotice.images} title="初始图片" />
                            <AttachmentsDisplay attachments={detailsModal.notice.sdNotice.attachments} />
                            <Divider style={{margin: '16px 0'}} />
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
                                return (
                                    <Timeline.Item key={index} color={details.color}>
                                        <div style={{ width: '100%' }}>
                                            <p><b>{h.submitter}</b> {details.text}</p>
                                            
                                            {/* 如果是行动计划提交，则渲染行动计划列表 */}
                                            {h.type === 'supplier_submission' && h.actionPlans ? (
                                                <Card size="small" type="inner" style={{ marginTop: 8 }}>
                                                    {h.description && <Paragraph>{h.description}</Paragraph>}
                                                    <Divider style={{ margin: '12px 0' }} />
                                                    <List
                                                        size="small"
                                                        dataSource={h.actionPlans}
                                                        renderItem={(planItem, idx) => (
                                                            <List.Item>
                                                                <div>
                                                                    <Text strong>{idx + 1}. {planItem.plan}</Text><br/>
                                                                    <Text type="secondary" style={{marginLeft: '18px'}}>
                                                                        <PersonIcon style={{ marginRight: 8 }} />{planItem.responsible}
                                                                        <Divider type="vertical" />
                                                                        <CalendarOutlined style={{ marginRight: 8 }} />{planItem.deadline}
                                                                    </Text>
                                                                </div>
                                                            </List.Item>
                                                        )}
                                                    />
                                                </Card>
                                            ) : (
                                                // 否则，渲染普通的描述和文件
                                                (h.description || h.images?.length > 0 || h.attachments?.length > 0) && (
                                                    <Card size="small" type="inner" style={{ marginTop: 8 }}>
                                                        {h.description && <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{h.description}</Paragraph>}
                                                    </Card>
                                                )
                                            )}
                                            
                                            <ImageScroller images={h.images} title="提交的图片" />
                                            <AttachmentsDisplay attachments={h.attachments} />
                                            <small>{h.time}</small>
                                        </div>
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