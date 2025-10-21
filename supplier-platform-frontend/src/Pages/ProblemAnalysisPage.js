import React, { useState, useMemo } from 'react';
import { Card, Typography, Input, Select, List, Empty, Spin, Tag, Button, Divider, Space, Row, Col } from 'antd';
import { BookOutlined, CheckSquareOutlined, SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useNotices } from '../contexts/NoticeContext';
import { useNotification } from '../contexts/NotificationContext';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const { Title, Paragraph, Text } = Typography;

const ProblemAnalysisPage = () => {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    const { notices, loading } = useNotices();
    const [filters, setFilters] = useState({
        productionSource: [],
        productionKeyword: '',
        checklistSource: [],
        checklistCause: [],
        checklistKeyword: '',
    });
    const navigate = useNavigate();
    const { messageApi } = useNotification();

    if (currentUser.role === 'Supplier') {
        navigate('/');
    }

    // --- 1. 核心修正：将所有通知单“拉平”，正确提取 Actions 和 Findings ---
    const { allActions, allFindings, uniqueSources, uniqueCauses } = useMemo(() => {
        const actionsMap = new Map();
        const findings = [];
        const sources = new Set();
        const causes = new Set();

        notices.forEach(notice => {

            // --- 修正 A：在这里提取“问题发现” (Finding) ---
            // 优先从 details.finding 获取，其次是 details.description，最后是 title
            const findingText = notice.sdNotice?.details?.finding || notice.sdNotice?.details?.description || notice.title;
            if (findingText) {
                findings.push({
                    id: `${notice.id}-finding`,
                    finding: findingText,
                    notice: notice, // 保留对原始通知单的引用
                });
            }

            // 提取 Actions (行动计划)
            notice.history?.forEach(h => {
                if (h.type === 'supplier_plan_submission' && h.actionPlans) {
                    h.actionPlans.forEach((plan, index) => {
                        const key = `${notice.id}-${plan.plan}`;
                        if (!actionsMap.has(key)) {
                            actionsMap.set(key, {
                                id: key,
                                action: plan.plan,
                                evidence: '', // 初始化证据为空
                                notice: notice
                            });
                        }
                    });
                }
            });

            // 提取 Evidence (证据描述) 并关联到 Actions
            notice.history?.forEach(h => {
                if (h.type === 'supplier_evidence_submission' && h.actionPlans) {
                    h.actionPlans.forEach(plan => {
                        const key = `${notice.id}-${plan.plan}`; // 假设plan文本是唯一的
                        if (actionsMap.has(key)) {
                            actionsMap.get(key).evidence = plan.evidenceDescription || 'N/A';
                        }
                    });
                }
            });

            // 收集所有唯一的来源和原因标签
            if (notice.sdNotice?.problemSource) sources.add(notice.sdNotice.problemSource);
            if (notice.sdNotice?.cause) causes.add(notice.sdNotice.cause);
        });

        return {
            allActions: Array.from(actionsMap.values()),
            allFindings: findings,
            uniqueSources: Array.from(sources),
            uniqueCauses: Array.from(causes)
        };
    }, [notices]);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const hasActiveFilters = useMemo(() => {
        return Object.values(filters).some(value =>
            Array.isArray(value) ? value.length > 0 : !!value
        );
    }, [filters]);

    // --- 2. 核心：根据筛选条件，动态计算两个列表的数据 ---
    const filteredProductionData = useMemo(() => {
        return allActions.filter(item => {
            const notice = item.notice;
            if (!notice) return false;
            const sourceMatch = filters.productionSource.length === 0 || filters.productionSource.includes(notice.sdNotice?.problemSource);
            const keywordMatch = !filters.productionKeyword ||
                item.action?.toLowerCase().includes(filters.productionKeyword.toLowerCase()) ||
                item.evidence?.toLowerCase().includes(filters.productionKeyword.toLowerCase()) ||
                notice.title?.toLowerCase().includes(filters.productionKeyword.toLowerCase());
            return sourceMatch && keywordMatch;
        });
    }, [allActions, filters.productionSource, filters.productionKeyword]);

    const filteredChecklistData = useMemo(() => {
        return allFindings.filter(item => {
            const notice = item.notice;
            if (!notice) return false;
            const sourceMatch = filters.checklistSource.length === 0 || filters.checklistSource.includes(notice.sdNotice?.problemSource);
            const causeMatch = filters.checklistCause.length === 0 || filters.checklistCause.includes(notice.sdNotice?.cause);
            const keywordMatch = !filters.checklistKeyword ||
                item.finding?.toLowerCase().includes(filters.checklistKeyword.toLowerCase()) ||
                notice.title?.toLowerCase().includes(filters.checklistKeyword.toLowerCase());
            return sourceMatch && causeMatch && keywordMatch;
        });
    }, [allFindings, filters.checklistSource, filters.checklistCause, filters.checklistKeyword]);

    const handleExportActions = async () => {
        if (filteredProductionData.length === 0) {
            messageApi.warning('没有可导出的生产经验数据。');
            return;
        }
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('生产经验');
        worksheet.columns = [
            { header: '问题来源', key: 'source', width: 20 },
            { header: '行动方案', key: 'action', width: 50 },
            { header: '完成证据', key: 'evidence', width: 50 },
            { header: '关联案例编号', key: 'caseCode', width: 20 },
            { header: '关联案例标题', key: 'caseTitle', width: 40 },
        ];
        worksheet.getRow(1).font = { bold: true };

        filteredProductionData.forEach(item => {
            worksheet.addRow({
                source: item.notice.sdNotice?.problemSource || 'N/A',
                action: item.action,
                evidence: item.evidence || 'N/A',
                caseCode: item.notice.noticeCode,
                caseTitle: item.notice.title
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), '生产经验库.xlsx');
    };

    const handleExportChecklist = async () => {
        if (filteredChecklistData.length === 0) {
            messageApi.warning('没有可导出的Checklist数据。');
            return;
        }
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('审核Checklist');
        worksheet.columns = [
            { header: '问题来源', key: 'source', width: 20 },
            { header: '造成原因', key: 'cause', width: 20 },
            { header: '问题发现 (Finding)', key: 'finding', width: 60 },
            { header: '关联案例编号', key: 'caseCode', width: 20 },
            { header: '关联案例标题', key: 'caseTitle', width: 40 },
        ];
        worksheet.getRow(1).font = { bold: true };

        filteredChecklistData.forEach(item => {
            worksheet.addRow({
                source: item.notice.sdNotice?.problemSource || 'N/A',
                cause: item.notice.sdNotice?.cause || 'N/A',
                finding: item.finding,
                caseCode: item.notice.noticeCode,
                caseTitle: item.notice.title
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), '审核Checklist.xlsx');
    };

    if (loading) {
        return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
    }

    return (
        <div>
            <Card style={{ marginBottom: 24 }} bordered={false}>
                <Title level={4} style={{ margin: 0 }}>经验使用中心</Title>
                <Paragraph type="secondary" style={{ margin: 0, marginTop: '4px' }}>从历史数据中学习，生成生产经验和审核清单。</Paragraph>
            </Card>

            <Row gutter={[24, 24]}>
                {/* --- 生产经验 --- */}
                <Col xs={24} lg={12}>
                    <Card title={<Space><BookOutlined />生产经验 (行动方案库)</Space>} bordered={false} extra={<Button icon={<DownloadOutlined />} onClick={handleExportActions}>导出</Button>}>
                        <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
                            <Select mode="multiple" allowClear placeholder="按问题来源筛选..." style={{ width: '100%' }} onChange={v => handleFilterChange('productionSource', v)} options={uniqueSources.map(s => ({ label: s, value: s }))} />
                            <Input placeholder="搜索问题/方案/证据关键词..." prefix={<SearchOutlined />} onChange={e => handleFilterChange('productionKeyword', e.target.value)} />
                        </Space>
                        <List
                            dataSource={filteredProductionData}
                            pagination={{ pageSize: 5, simple: true }}
                            renderItem={item => (
                                <List.Item>
                                    <List.Item.Meta
                                        title={<Text strong>行动方案: {item.action}</Text>}
                                        description={
                                            <>
                                                <div><Text type="secondary">完成证据: {item.evidence || '暂无'}</Text></div>
                                                <Tag color="blue">{item?.notice?.sdNotice?.problemSource || '暂无'}</Tag>
                                                来自案例:
                                                {/* --- 核心修正 1：修改此按钮 --- */}
                                                <Button
                                                    type="link"
                                                    size="small"
                                                    href={`/notices?open=${item.notice.id}`} // 使用 href
                                                    target="_blank" // 在新标签页打开
                                                    rel="noopener noreferrer" // 安全性设置
                                                >
                                                    {item.notice.noticeCode}
                                                </Button>
                                            </>
                                        }
                                    />
                                </List.Item>
                            )}
                            locale={{ emptyText: <Empty description="未找到匹配的生产经验" /> }}
                        />
                    </Card>
                </Col>

                {/* --- 生成Checklist --- */}
                <Col xs={24} lg={12}>
                    <Card title={<Space><CheckSquareOutlined />生成Checklist (Finding发现库)</Space>} bordered={false} extra={<Button icon={<DownloadOutlined />} onClick={handleExportChecklist}>导出</Button>}>
                        <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
                            <Select mode="multiple" allowClear placeholder="按问题来源筛选..." style={{ width: '100%' }} onChange={v => handleFilterChange('checklistSource', v)} options={uniqueSources.map(s => ({ label: s, value: s }))} />
                            <Select mode="multiple" allowClear placeholder="按造成原因筛选..." style={{ width: '100%' }} onChange={v => handleFilterChange('checklistCause', v)} options={uniqueCauses.map(c => ({ label: c, value: c }))} />
                            <Input placeholder="搜索问题标题或Finding关键词..." prefix={<SearchOutlined />} onChange={e => handleFilterChange('checklistKeyword', e.target.value)} />
                        </Space>
                        <List
                            dataSource={filteredChecklistData}
                            pagination={{ pageSize: 5, simple: true }}
                            renderItem={item => (
                                <List.Item>
                                    <List.Item.Meta
                                        // --- 核心修正：在这里直接使用 item.finding ---
                                        title={<Text strong>{item.finding}</Text>}
                                        description={
                                            <>
                                                <Tag color="geekblue">{item?.notice?.sdNotice?.problemSource || '暂无'}</Tag>
                                                <Tag color="purple">{item?.notice?.sdNotice?.cause || '暂无'}</Tag>
                                                来自案例:
                                                {/* --- 核心修正 2：修改此按钮 --- */}
                                                <Button
                                                    type="link"
                                                    size="small"
                                                    href={`/notices?open=${item.notice.id}`} // 使用 href
                                                    target="_blank" // 在新标签页打开
                                                    rel="noopener noreferrer"
                                                >
                                                    {item.notice.noticeCode}
                                                </Button>
                                            </>
                                        }
                                    />
                                </List.Item>
                            )}
                            locale={{ emptyText: <Empty description="未找到匹配的Checklist项目" /> }}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default ProblemAnalysisPage;