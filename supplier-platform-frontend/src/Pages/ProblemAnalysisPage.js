import React, { useState, useMemo, useEffect } from 'react'; // 1. 引入 useEffect
import { Card, Typography, Input, Select, List, Empty, Spin, Tag, Button, Divider, Space, Row, Col, DatePicker, message } from 'antd';
import { BookOutlined, CheckSquareOutlined, SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useNotices } from '../contexts/NoticeContext';
import { useNotification } from '../contexts/NotificationContext';
import { useSuppliers } from '../contexts/SupplierContext';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import dayjs from 'dayjs';

const { Title, Paragraph, Text } = Typography;
const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

// --- 2. 用于本地存储最近搜索的 Key ---
const RECENT_SUPPLIERS_KEY = 'recentAnalysisSuppliers';

const ProblemAnalysisPage = () => {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    const { notices, loading } = useNotices();
    const { suppliers, loading: suppliersLoading } = useSuppliers();
    const { messageApi } = useNotification();
    const navigate = useNavigate();

    const [filters, setFilters] = useState({
        // 移除了 source 和 cause
        supplier: [],
        dateRange: null,
        keyword: '',
    });
    
    // --- 3. 为“最近搜索”添加 State ---
    const [recentSuppliers, setRecentSuppliers] = useState([]); // 存储供应商 ID

    if (currentUser.role === 'Supplier') {
        navigate('/');
    }

    // --- 4. 在页面加载时，获取“最近搜索”的供应商 ---
    useEffect(() => {
        const saved = localStorage.getItem(RECENT_SUPPLIERS_KEY);
        if (saved) {
            setRecentSuppliers(JSON.parse(saved)); // 这是一个 ID 数组
        }
    }, []);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    // --- 5. 创建一个专门处理供应商选择的函数，用于更新“最近搜索” ---
    const handleSupplierFilterChange = (supplierIds) => {
        handleFilterChange('supplier', supplierIds);

        // 获取当前选择中尚未在“最近”列表里的新 ID
        const newIds = supplierIds.filter(id => !recentSuppliers.includes(id));
        // 将新 ID 放在最前面
        let updatedRecent = [...newIds, ...recentSuppliers];
        // 去重
        updatedRecent = [...new Set(updatedRecent)];
        // 只保留最近 3 个
        updatedRecent = updatedRecent.slice(0, 5);
        
        setRecentSuppliers(updatedRecent);
        localStorage.setItem(RECENT_SUPPLIERS_KEY, JSON.stringify(updatedRecent));
    };
    
    // --- 6. 核心筛选逻辑：现在直接筛选 notices，而不是 allFindings ---
    const filteredNotices = useMemo(() => {
        const { supplier, dateRange, keyword } = filters;
        
        return notices.filter(notice => {
            // 供应商筛选
            if (supplier.length > 0 && !supplier.includes(notice.assignedSupplierId)) {
                return false;
            }
            // 日期筛选 (基于创建日期)
            if (dateRange && dateRange[0] && dateRange[1]) {
                const createTime = dayjs(notice.createdAt);
                if (!createTime.isAfter(dateRange[0].startOf('day')) || !createTime.isBefore(dateRange[1].endOf('day'))) {
                    return false;
                }
            }
            
            // 关键词筛选 (现在会搜索 Process 和 Finding)
            const lowerCaseKeyword = keyword.toLowerCase();
            if (lowerCaseKeyword) {
                const processText = notice.title || '';
                const findingText = notice.sdNotice?.details?.finding || notice.sdNotice?.details?.description || '';

                if (!(
                    processText.toLowerCase().includes(lowerCaseKeyword) ||
                    findingText.toLowerCase().includes(lowerCaseKeyword) ||
                    notice.noticeCode?.toLowerCase().includes(lowerCaseKeyword)
                )) {
                    return false;
                }
            }
            
            return true;
        });
    }, [notices, filters]);

    // --- 7. 导出Excel (更新为双列数据) ---
    const handleExportExcel = async () => {
        if (filteredNotices.length === 0) {
            messageApi.warning('没有可导出的数据。');
            return;
        }
        messageApi.loading({ content: '正在生成Excel文件...', key: 'exporting' });
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('审核Checklist');
        worksheet.columns = [
            { header: '供应商', key: 'supplier', width: 30 },
            { header: '日期', key: 'date', width: 15 },
            { header: '关联案例编号', key: 'caseCode', width: 20 },
            { header: 'PROCESS/QUESTIONS', key: 'process', width: 60 },
            { header: 'FINDINGS/DEVIATIONS', key: 'finding', width: 60 },
            { header: '问题来源', key: 'source', width: 20 },
            { header: '造成原因', key: 'cause', width: 20 },
        ];
        worksheet.getRow(1).font = { bold: true };

        filteredNotices.forEach(notice => {
            worksheet.addRow({
                supplier: notice.assignedSupplierName,
                date: dayjs(notice.createdAt).format('YYYY-MM-DD'),
                caseCode: notice.noticeCode,
                process: notice.title || 'N/A',
                finding: notice.sdNotice?.details?.finding || notice.sdNotice?.details?.description || 'N/A',
                source: notice.sdNotice?.problemSource || 'N/A',
                cause: notice.sdNotice?.cause || 'N/A',
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), '审核Checklist.xlsx');
        messageApi.success({ content: 'Excel 文件已成功导出！', key: 'exporting', duration: 3 });
    };

    // --- 8. 辅助函数：根据 ID 获取供应商 short_code ---
    const getSupplierShortCode = (id) => {
        return suppliers.find(s => s.id === id)?.short_code || '未知';
    };


    if (loading || suppliersLoading) {
        return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
    }

    return (
        <div>
            <Card style={{ marginBottom: 24 }} bordered={false}>
                <Title level={4} style={{ margin: 0 }}>经验使用中心</Title>
                <Paragraph type="secondary" style={{ margin: 0, marginTop: '4px' }}>从历史数据中学习，生成审核清单。</Paragraph>
                
                <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
                    <Row gutter={[16, 16]}>
                        <Col xs={24} md={12} lg={6}>
                            <Select 
                                mode="multiple" 
                                allowClear 
                                placeholder="按供应商筛选..." 
                                style={{ width: '100%' }} 
                                onChange={handleSupplierFilterChange} // <-- 9. 使用新函数
                                value={filters.supplier} // 确保受控
                                options={suppliers.map(s => ({label: s.short_code, value: s.id}))} 
                                // --- ✨ 核心修正：添加 showSearch 和 filterOption ---
                                showSearch
                                filterOption={(input, option) =>
                                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                            />
                        </Col>
                        <Col xs={24} md={12} lg={6}>
                            <RangePicker 
                                style={{ width: '100%' }} 
                                onChange={v => handleFilterChange('dateRange', v)} 
                                value={filters.dateRange} // 确保受控
                            />
                        </Col>
                        <Col xs={24} md={24} lg={12}>
                            <Search 
                                placeholder="在结果中搜索关键词 (标题, 编号, Process, Finding)..." 
                                onSearch={v => handleFilterChange('keyword', v)}
                                onChange={e => handleFilterChange('keyword', e.target.value)}
                                value={filters.keyword} // 确保受控
                            />
                        </Col>
                    </Row>
                    {/* --- 10. “最近搜索”按钮区域 --- */}
                    {recentSuppliers.length > 0 && (
                        <Row>
                            <Col>
                                <Space wrap>
                                    <Text type="secondary">最近搜索:</Text>
                                    {recentSuppliers.map(supplierId => (
                                        <Button 
                                            key={supplierId} 
                                            size="small"
                                            onClick={() => handleSupplierFilterChange([supplierId])}
                                        >
                                            {getSupplierShortCode(supplierId)}
                                        </Button>
                                    ))}
                                </Space>
                            </Col>
                        </Row>
                    )}
                </Space>
            </Card>

            {/* --- 11. 核心：重构后的双列列表 --- */}
            <Card 
                title={<Space><CheckSquareOutlined />知识经验库</Space>} 
                bordered={false} 
                extra={<Button icon={<DownloadOutlined />} onClick={handleExportExcel}>导出为Excel</Button>}
            >
                <List
                    header={
                        <Row gutter={16} style={{ padding: '0 16px', backgroundColor: '#fafafa' }}>
                            <Col span={12}><Text strong>PROCESS / QUESTIONS</Text></Col>
                            <Col span={12}><Text strong>FINDINGS / DEVIATIONS</Text></Col>
                        </Row>
                    }
                    dataSource={filteredNotices}
                    pagination={{ pageSize: 10, simple: true, showSizeChanger: false }}
                    renderItem={item => {
                        const processText = item.title || 'N/A';
                        const findingText = item.sdNotice?.details?.finding || item.sdNotice?.details?.description || 'N/A';
                        
                        // ✨ 修正：在 renderItem 内部查找 supplier short_code
                        const supplierShortCode = suppliers.find(s => s.id === item.assignedSupplierId)?.short_code || item.assignedSupplierName;

                        return (
                            <List.Item style={{ padding: '12px 16px' }}>
                                <div style={{ width: '100%' }}>
                                    <Row gutter={16}>
                                        <Col span={12}>
                                            <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}>
                                                {processText}
                                            </Paragraph>
                                        </Col>
                                        <Col span={12}>
                                            <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}>
                                                {findingText}
                                            </Paragraph>
                                        </Col>
                                    </Row>
                                    {/* <Divider style={{ margin: '8px 0' }} /> */}
                                    <Space>
                                        {/* ✨ 修正：使用上面找到的 supplierShortCode */}
                                        <Tag color="cyan">{supplierShortCode}</Tag>
                                        <Tag>{dayjs(item.createdAt).format('YYYY-MM-DD')}</Tag>
                                        {/* 链接到通知单详情页，在新窗口打开 */}
                                        <Button 
                                            type="link" 
                                            size="small" 
                                            href={`/notices?open=${item.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            {item.noticeCode}
                                        </Button>
                                    </Space>
                                </div>
                            </List.Item>
                        );
                    }}
                    locale={{ emptyText: <Empty description="未找到匹配的项目" />}}
                />
            </Card>
        </div>
    );
};

export default ProblemAnalysisPage;

