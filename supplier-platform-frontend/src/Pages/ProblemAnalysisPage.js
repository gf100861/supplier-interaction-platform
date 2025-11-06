import React, { useState, useMemo, useEffect } from 'react';
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

// --- 1. 将 Key 的基础名称移到外部 ---
const RECENT_SUPPLIERS_KEY_PREFIX = 'recentAnalysisSuppliers';

const ProblemAnalysisPage = () => {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    const { notices, loading } = useNotices();
    const { suppliers, loading: suppliersLoading } = useSuppliers();
    const { messageApi } = useNotification();
    const navigate = useNavigate();

    const [filters, setFilters] = useState({
        supplier: [],
        dateRange: null,
        keyword: '',
    });
    
    // --- 2. 核心修正：基于用户ID创建动态的、唯一的 Key ---
    const RECENT_SUPPLIERS_KEY = useMemo(() => {
        if (!currentUser?.id) return `${RECENT_SUPPLIERS_KEY_PREFIX}_guest`; // 为未登录用户提供回退
        return `${RECENT_SUPPLIERS_KEY_PREFIX}_${currentUser.id}`;
    }, [currentUser?.id]);


    const [recentSuppliers, setRecentSuppliers] = useState([]);

    if (currentUser.role === 'Supplier') {
        navigate('/');
    }

    // --- 3. 核心修正：useEffect 依赖动态的 Key ---
    useEffect(() => {
        const saved = localStorage.getItem(RECENT_SUPPLIERS_KEY);
        if (saved) {
            setRecentSuppliers(JSON.parse(saved));
        }
    }, [RECENT_SUPPLIERS_KEY]); // 当 key 变化时 (用户切换)，重新加载

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    // --- 4. 核心修正：handleSupplierFilterChange 现在会使用动态的 Key ---
    const handleSupplierFilterChange = (supplierIds) => {
        handleFilterChange('supplier', supplierIds);

        const newIds = supplierIds.filter(id => !recentSuppliers.includes(id));
        let updatedRecent = [...newIds, ...recentSuppliers];
        updatedRecent = [...new Set(updatedRecent)];
        updatedRecent = updatedRecent.slice(0, 5); // 保持5个
        
        setRecentSuppliers(updatedRecent);
        // 使用用户专属的 Key 进行存储
        localStorage.setItem(RECENT_SUPPLIERS_KEY, JSON.stringify(updatedRecent));
    };
    
    const filteredNotices = useMemo(() => {
        const { supplier, dateRange, keyword } = filters;
        
        return notices.filter(notice => {
            if (supplier.length > 0 && !supplier.includes(notice.assignedSupplierId)) {
                return false;
            }
            if (dateRange && dateRange[0] && dateRange[1]) {
                const createTime = dayjs(notice.createdAt);
                if (!createTime.isAfter(dateRange[0].startOf('day')) || !createTime.isBefore(dateRange[1].endOf('day'))) {
                    return false;
                }
            }
            
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
                                onChange={handleSupplierFilterChange}
                                value={filters.supplier}
                                options={suppliers.map(s => ({label: s.short_code, value: s.id}))} 
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
                                value={filters.dateRange}
                            />
                        </Col>
                        <Col xs={24} md={24} lg={12}>
                            <Search 
                                placeholder="在结果中搜索关键词 (标题, 编号, Process, Finding)..." 
                                onSearch={v => handleFilterChange('keyword', v)}
                                onChange={e => handleFilterChange('keyword', e.target.value)}
                                value={filters.keyword}
                            />
                        </Col>
                    </Row>
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
                                    <Divider style={{ margin: '8px 0' }} />
                                    <Space>
                                        <Tag color="cyan">{supplierShortCode}</Tag>
                                        <Tag>{dayjs(item.createdAt).format('YYYY-MM-DD')}</Tag>
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