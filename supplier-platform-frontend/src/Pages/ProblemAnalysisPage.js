import React, { useState, useMemo, useEffect } from 'react';
import { Card, Typography, Input, Select, List, Empty, Spin, Tag, Button, Divider, Space, Row, Col, DatePicker, message, Modal } from 'antd';
import { BookOutlined, CheckSquareOutlined, SearchOutlined, DownloadOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useNotices } from '../contexts/NoticeContext';
import { useNotification } from '../contexts/NotificationContext';
import { useSuppliers } from '../contexts/SupplierContext';
import { supabase } from '../supabaseClient';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import dayjs from 'dayjs';

const { Title, Paragraph, Text } = Typography;
const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

const RECENT_SUPPLIERS_KEY_PREFIX = 'recentAnalysisSuppliers';

// --- 核心配置：定义后端 API 地址 ---
const isDev = process.env.NODE_ENV === 'development';

// 1. 本地开发时，指向本地后端端口 (通常是 3001)
// 2. 生产环境时，填入你部署后的 Vercel 后端域名
//    !!! 重要：请将下方的 URL 替换为你实际部署的后端 Vercel 域名 !!!
const API_BASE_URL = isDev 
    ? 'http://localhost:3001' 
    : 'https://supplier-interaction-platform-backend.vercel.app'; 

const ProblemAnalysisPage = () => {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    const { notices, loading } = useNotices();
    const { suppliers, loading: suppliersLoading } = useSuppliers();
    const { messageApi } = useNotification();
    const navigate = useNavigate();

    // --- 1. 使用 useModal Hook 解决弹窗不显示的问题 ---
    // contextHolder 必须插入到 JSX 中
    const [modal, contextHolder] = Modal.useModal();

    const [filters, setFilters] = useState({
        supplier: [],
        dateRange: null,
        keyword: '',
        source: [], 
        cause: []   
    });
    
    const RECENT_SUPPLIERS_KEY = useMemo(() => {
        if (!currentUser?.id) return `${RECENT_SUPPLIERS_KEY_PREFIX}_guest`;
        return `${RECENT_SUPPLIERS_KEY_PREFIX}_${currentUser.id}`;
    }, [currentUser?.id]);


    const [recentSuppliers, setRecentSuppliers] = useState([]);

    useEffect(() => {
        if (currentUser?.role === 'Supplier') {
            navigate('/');
        }
    }, [currentUser, navigate]);

    useEffect(() => {
        const saved = localStorage.getItem(RECENT_SUPPLIERS_KEY);
        if (saved) {
            setRecentSuppliers(JSON.parse(saved));
        }
    }, [RECENT_SUPPLIERS_KEY]);

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
    
    const filteredNotices = useMemo(() => {
        const { supplier, dateRange, keyword, source, cause } = filters; 
        
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

            if (source.length > 0 && !source.includes(notice.sdNotice?.problemSource)) {
                return false;
            }
            if (cause.length > 0 && !cause.includes(notice.sdNotice?.cause)) {
                return false;
            }

            return true;
        });
    }, [notices, filters]); 

    // --- 真实发送邮件的函数 (修复版) ---
    const sendSecurityEmail = async (managersAndAdmins, supplierCount) => {
        const recipients = managersAndAdmins.map(u => u.email).filter(Boolean);
        
        if (recipients.length === 0) {
            console.warn('没有找到接收警报的管理员邮箱。');
            return;
        }

        try {
            // messageApi.loading({ content: '正在向管理员发送安全警报邮件...', key: 'sending_email' });

            // 确保路径正确，使用上面定义的 API_BASE_URL
            const endpoint = `${API_BASE_URL}/api/send-alert-email`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    recipients: recipients,
                    supplierCount: supplierCount,
                    user: currentUser.username || currentUser.email || 'Unknown User',
                    timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss')
                })
            });

            // --- 核心修复：先检查内容类型，避免解析 HTML 报错 ---
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || '后端返回错误');
                }
                // messageApi.success({ content: '安全警报邮件已成功发送。', key: 'sending_email', duration: 3 });
            } else {
                // 如果返回的不是 JSON (比如是 404 HTML 页面)，说明找错了地址
                // const text = await response.text(); 
                // console.error('Non-JSON response:', text.substring(0, 200)); 
                
                // 给用户更清晰的错误提示
                throw new Error(`无法连接到邮件服务 (API 404)。请确认后端服务已部署，且地址配置正确：${API_BASE_URL}`);
            }

        } catch (error) {
            console.error('发送邮件 API 调用失败:', error);
            messageApi.warning({ 
                content: `邮件发送失败: ${error.message}`, 
                key: 'sending_email', 
                duration: 5 
            });
        }
    };

    const triggerSecurityAlert = async (supplierCount) => {
        try {
            // 1. 获取 Admin 和 Manager 用户
            const { data: managersAndAdmins, error: userError } = await supabase
                .from('users')
                .select('id, email, role')
                .in('role', ['Admin']);

            if (userError) throw userError;

            const alertMessage = `[安全警告] 用户 ${currentUser.username || currentUser.email} 尝试批量下载 ${supplierCount} 家供应商的数据，已触发风控拦截。`;

            // 2. 插入 Alerts 表 (系统内通知)
            const alertsToInsert = managersAndAdmins.map(user => ({
                creator_id: currentUser.id,
                target_user_id: user.id,
                message: alertMessage,
                link: '/admin', 
                is_read: false,
                created_at: new Date().toISOString()
            }));

            if (alertsToInsert.length > 0) {
                const { error: alertError } = await supabase
                    .from('alerts')
                    .insert(alertsToInsert);
                if (alertError) throw alertError;
            }

            // 3. 触发邮件发送 (真实调用)
            await sendSecurityEmail(managersAndAdmins, supplierCount);
        } catch (error) {
            console.error('Failed to trigger security alert:', error);
            messageApi.error('警报系统异常，请联系管理员。');
        }
    };

    const handleExportExcel = async () => {
        if (filteredNotices.length === 0) {
            messageApi.warning('没有可导出的数据。');
            return;
        }

        // --- 核心修正：Set 计数逻辑与空值处理 ---
        // 即使没有 ID，我们用 "Unknown" 占位，确保它被计为 1 个实体，而不是被 filter 扔掉
        const supplierIdentifiers = filteredNotices.map(n => 
            n.assignedSupplierId || n.assigned_supplier_id || n.assignedSupplierName || 'Unknown_Supplier'
        );
            
        const uniqueSuppliersInResult = new Set(supplierIdentifiers).size;
        
        // --- 设置下载限制 ---
        const DOWNLOAD_LIMIT = 1; 
        
        console.log(`[安全检查] 涉及供应商数量: ${uniqueSuppliersInResult}, 限制: ${DOWNLOAD_LIMIT}`);

        if (uniqueSuppliersInResult > DOWNLOAD_LIMIT) {
            // --- 核心修正：使用 hook 返回的 modal 实例 ---
            modal.warning({
                title: '数据下载受限',
                icon: <ExclamationCircleOutlined style={{ color: 'red' }} />,
                content: (
                    <div>
                        <p>您正在尝试一次性导出 <b>{uniqueSuppliersInResult}</b> 家供应商的数据。</p>
                        <p>为了数据安全，单次导出允许的最大供应商数量为 <b>{DOWNLOAD_LIMIT}</b> 家。</p>
                        <br />
                        <Text type="danger" strong>系统已拦截此操作，并自动向管理员发送了安全警报邮件。</Text>
                    </div>
                ),
                okText: '我知道了',
                onOk: () => {
                    triggerSecurityAlert(uniqueSuppliersInResult);
                }
            });
            return; // ⛔️ 必须 return，阻止后续下载代码执行
        }

        // --- 如果通过检查，继续下载 ---
        messageApi.loading({ content: '正在生成Excel文件...', key: 'exporting' });
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('经验库');
        worksheet.columns = [
            { header: '供应商', key: 'supplier', width: 30 },
            { header: '日期', key: 'date', width: 15 },
            { header: '关联案例编号', key: 'caseCode', width: 20 },
            { header: 'PRODUCT', key: 'product', width: 20 },
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
                product: notice.sdNotice?.details?.product || 'N/A',
                source: notice.sdNotice?.problemSource || 'N/A',
                cause: notice.sdNotice?.cause || 'N/A',
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), '历史经验.xlsx');
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
            {/* 2. 务必在此处渲染 contextHolder，否则弹窗无法显示 */}
            {contextHolder}
            
            <Card style={{ marginBottom: 24 }} bordered={false}>
                <Title level={4} style={{ margin: 0 }}>经验使用中心</Title>
                <Paragraph type="secondary" style={{ margin: 0, marginTop: '4px' }}>从历史数据中学习，防止重复错误发生。</Paragraph>
                
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
                              <Col span={4}><Text strong>PRODUCT</Text></Col>
                            <Col span={10}><Text strong>PROCESS / QUESTIONS</Text></Col>
                            <Col span={10}><Text strong>FINDINGS / DEVIATIONS</Text></Col>
                          
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
                                                <Col span={4}>
                                                <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}>
                                                    {productText}
                                                </Paragraph>
                                            </Col>
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
                                           
                                    </Row>
                                
                                    <Space>
                                        <Tag color="cyan">{supplierShortCode}</Tag>
                                        {/* <Tag>{dayjs(item.createdAt).format('YYYY-MM-DD')}</Tag> */}
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