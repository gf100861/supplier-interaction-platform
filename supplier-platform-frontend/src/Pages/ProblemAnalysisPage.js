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

const RECENT_SUPPLIERS_KEY_PREFIX = 'recentAnalysisSuppliers';

const ProblemAnalysisPage = () => {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    const { notices, loading } = useNotices();
    const { suppliers, loading: suppliersLoading } = useSuppliers();
    const { messageApi } = useNotification();
    const navigate = useNavigate();

    // --- 1. 核心修改：为筛选器 state 添加 source 和 cause ---
    const [filters, setFilters] = useState({
        supplier: [],
        dateRange: null,
        keyword: '',
        source: [], // 问题来源
        cause: []   // 造成原因
    });
    
    const RECENT_SUPPLIERS_KEY = useMemo(() => {
        if (!currentUser?.id) return `${RECENT_SUPPLIERS_KEY_PREFIX}_guest`;
        return `${RECENT_SUPPLIERS_KEY_PREFIX}_${currentUser.id}`;
    }, [currentUser?.id]);


    const [recentSuppliers, setRecentSuppliers] = useState([]);

    if (currentUser.role === 'Supplier') {
        navigate('/');
    }

    useEffect(() => {
        const saved = localStorage.getItem(RECENT_SUPPLIERS_KEY);
        if (saved) {
            setRecentSuppliers(JSON.parse(saved));
        }
    }, [RECENT_SUPPLIERS_KEY]);

    // --- 2. 核心修改：重新引入 useMemo 来提取所有唯一的标签 ---
    const { uniqueSources, uniqueCauses } = useMemo(() => {
        const sources = new Set();
        const causes = new Set();
        notices.forEach(notice => {
            if (notice.sdNotice?.problemSource) sources.add(notice.sdNotice.problemSource);
            if (notice.sdNotice?.cause) causes.add(notice.sdNotice.cause);
        });
        return {
            uniqueSources: Array.from(sources).sort(),
            uniqueCauses: Array.from(causes).sort()
        };
    }, [notices]);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleSupplierFilterChange = (supplierIds) => {
        handleFilterChange('supplier', supplierIds);
        const newIds = supplierIds.filter(id => !recentSuppliers.includes(id));
        let updatedRecent = [...newIds, ...recentSuppliers];
        updatedRecent = [...new Set(updatedRecent)];
        updatedRecent = updatedRecent.slice(0, 5);
        setRecentSuppliers(updatedRecent);
        localStorage.setItem(RECENT_SUPPLIERS_KEY, JSON.stringify(updatedRecent));
    };
    
    // --- 3. 核心修改：更新筛选逻辑 ---
    const filteredNotices = useMemo(() => {
        const { supplier, dateRange, keyword, source, cause } = filters; // <-- 获取新筛选器
        
        return notices.filter(notice => {
            // 供应商筛选
            if (supplier.length > 0 && !supplier.includes(notice.assignedSupplierId)) {
                return false;
            }
            // 日期筛选
            if (dateRange && dateRange[0] && dateRange[1]) {
                const createTime = dayjs(notice.createdAt);
                if (!createTime.isAfter(dateRange[0].startOf('day')) || !createTime.isBefore(dateRange[1].endOf('day'))) {
                    return false;
                }
            }
            
            // 关键词筛选
            const lowerCaseKeyword = keyword.toLowerCase();
            if (lowerCaseKeyword) {
                const processText = notice.title || '';
                const findingText = notice.sdNotice?.details?.finding || notice.sdNotice?.details?.description || '';
                const productText = notice.sdNotice?.details?.product || '';
                if (!(
                    processText.toLowerCase().includes(lowerCaseKeyword) ||
                    findingText.toLowerCase().includes(lowerCaseKeyword) ||
                    productText.toLowerCase().includes(lowerCaseKeyword) ||
                    notice.noticeCode?.toLowerCase().includes(lowerCaseKeyword)
                )) {
                    return false;
                }
            }

            // --- 4. 核心修改：添加标签筛选逻辑 ---
            // 问题来源筛选
            if (source.length > 0 && !source.includes(notice.sdNotice?.problemSource)) {
                return false;
            }
            // 造成原因筛选
            if (cause.length > 0 && !cause.includes(notice.sdNotice?.cause)) {
                return false;
            }
            // --- 筛选结束 ---

            return true;
        });
    }, [notices, filters]); // 'filters' 依赖已包含所有新 state

    // (Excel 导出逻辑已包含 source 和 cause, 无需修改)
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
            { header: 'PRODUCT', key: 'product', width: 20 },
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
                product: notice.sdNotice?.details?.product || 'N/A',
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
                    {/* --- 5. 核心修改：更新筛选器布局 --- */}
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
                                maxTagCount="responsive"
                            />
                        </Col>
                        <Col xs={24} md={12} lg={6}>
                            <RangePicker 
                                style={{ width: '100%' }} 
                                onChange={v => handleFilterChange('dateRange', v)} 
                                value={filters.dateRange}
                            />
                        </Col>
                        <Col xs={24} md={12} lg={6}>
                            <Select
                                mode="multiple"
                                allowClear
                                placeholder="按问题来源筛选..."
                                style={{ width: '100%' }}
                                onChange={v => handleFilterChange('source', v)}
                                value={filters.source}
                                options={uniqueSources.map(s => ({ label: s, value: s }))}
                                maxTagCount="responsive"
                            />
                        </Col>
                        <Col xs={24} md={12} lg={6}>
                             <Select
                                mode="multiple"
                                allowClear
                                placeholder="按造成原因筛选..."
                                style={{ width: '100%' }}
                                onChange={v => handleFilterChange('cause', v)}
                                value={filters.cause}
                                options={uniqueCauses.map(c => ({ label: c, value: c }))}
                                maxTagCount="responsive"
                            />
                        </Col>
                    </Row>
                    <Row gutter={[16, 16]}>
                        <Col xs={24}>
                            <Search 
                                placeholder="在结果中搜索关键词 (标题, 编号, Process, Finding, Product)..." 
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
                            <Col span={10}><Text strong>PROCESS / QUESTIONS</Text></Col>
                            <Col span={10}><Text strong>FINDINGS / DEVIATIONS</Text></Col>
                            <Col span={4}><Text strong>PRODUCT</Text></Col>
                        </Row>
                    }
                    dataSource={filteredNotices}
                    pagination={{ pageSize: 10, simple: true, showSizeChanger: false }}
                    renderItem={item => {
                        const processText = item.title || 'N/A';
                        const findingText = item.sdNotice?.details?.finding || item.sdNotice?.details?.description || 'N/A';
                        const productText = item.sdNotice?.details?.product || 'N/A';
                        
                        const supplierShortCode = suppliers.find(s => s.id === item.assignedSupplierId)?.short_code || item.assignedSupplierName;

                        return (
                            <List.Item style={{ padding: '12px 16px' }}>
                                <div style={{ width: '100%' }}>
                                    <Row gutter={16}>
                                        <Col span={10}>
                                            <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}>
                                                {processText}
                                            </Paragraph>
                                        </Col>
                                        <Col span={10}>
                                            <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}>
                                                {findingText}
                                            </Paragraph>
                                        </Col>
                                        <Col span={4}>
                                            <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}>
                                                {productText}
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