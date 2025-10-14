import React, { useState, useMemo, useEffect } from 'react';
import { Form, Input, Button, Upload, Typography, Divider, Modal, theme, Select, InputNumber, Card, Space, Radio } from 'antd';
import { UserOutlined, InboxOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

// 导入所有需要的 Contexts 和配置
import { useNotification } from '../contexts/NotificationContext';
import { useSuppliers } from '../contexts/SupplierContext';
import { useNotices } from '../contexts/NoticeContext';
import { useCategories } from '../contexts/CategoryContext';
import { supabase } from '../supabaseClient';
import { categoryColumnConfig } from '../data/_mockData';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { Dragger } = Upload;

// ... (辅助函数 normFile, getBase64 保持不变)

const FileUploadPage = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    
    const [selectedCategory, setSelectedCategory] = useState(null);
   const [historicalTags, setHistoricalTags] = useState({});
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [selectedSource, setSelectedSource] = useState(null);



    const { suppliers, loading: suppliersLoading } = useSuppliers();
    const { categories, loading: categoriesLoading } = useCategories();
    const { addNotices } = useNotices();
    const { messageApi } = useNotification();
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

    const managedSuppliers = useMemo(() => { /* ... (逻辑不变) ... */ }, [currentUser, suppliers]);

    // --- 核心功能 1：当问题类型变化时，从数据库获取对应的知识库 ---
    const handleSupplierChange = async (supplierId) => {
        if (!supplierId) {
            setHistoricalTags({});
            return;
        }
        setLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from('notices')
                .select('problem_source, cause')
                .eq('assigned_supplier_id', supplierId)
                .not('problem_source', 'is', null) // 只选择有标签的历史记录
                .not('cause', 'is', null);
            
            if (error) throw error;
            
            // 将返回的数据处理成级联选择器需要的格式: { '来源1': ['原因A', '原因B'], ... }
            const tags = data.reduce((acc, { problem_source, cause }) => {
                if (!acc[problem_source]) {
                    acc[problem_source] = new Set();
                }
                acc[problem_source].add(cause);
                return acc;
            }, {});
            
            // 将 Set 转换为数组
            Object.keys(tags).forEach(key => {
                tags[key] = Array.from(tags[key]);
            });

            setHistoricalTags(tags);
        } catch (error) {
            messageApi.error(`加载历史标签失败: ${error.message}`);
        } finally {
            setLoadingHistory(false);
        }
    };
    // ... (其他 handler 函数，如 onFinish, handlePreview 等)

    // --- 核心功能 2：当用户选择一个原因时，自动填充对应的方法 ---
    // const handleCauseChange = (e) => {
    //     const cause = e.target.value;
    //     const selectedKnowledge = knowledgeBase.find(item => item.cause === cause);
    //     if (selectedKnowledge) {
    //         setSelectedCause(selectedKnowledge);
    //         form.setFieldsValue({ process_tag: selectedKnowledge.method });
    //     }
    // };
    
    // const onFinish = async (values) => {
    //     // ... (提交逻辑，确保包含了 values.cause_tag 和 values.process_tag)
    // };

    return (
        <div style={{ maxWidth: 800, margin: 'auto', padding: '24px 0' }}>
            <Card>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Title level={4}>创建新的整改通知单</Title>
                </div>
                
                <Form form={form} layout="vertical" onFinish={onFinish}>
                    <Form.Item name="category" label="问题类型" rules={[{ required: true }]}>
                        <Select placeholder="请选择问题类型" loading={categoriesLoading} onChange={value => setSelectedCategory(value)}>
                            {categories.map(cat => <Option key={cat} value={cat}>{cat}</Option>)}
                        </Select>
                    </Form.Item>
                    <Form.Item name="supplierId" label="选择供应商" rules={[{ required: true }]}>
                        {/* ... (供应商选择) */}
                    </Form.Item>
                    
                    {/* --- 核心功能 3：动态渲染“历史原因”选择区域 --- */}
                      <Card type="inner" title="历史经验标签 (可选)" loading={loadingHistory} style={{marginBottom: 24}}>
                        {Object.keys(historicalTags).length > 0 ? (
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="problem_source" label="问题来源 (根据历史推荐)">
                                        <Select placeholder="选择来源" allowClear onChange={value => setSelectedSource(value)}>
                                            {Object.keys(historicalTags).map(source => (
                                                <Option key={source} value={source}>{source}</Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="cause" label="造成原因 (根据来源推荐)">
                                        <Select placeholder="选择原因" allowClear disabled={!selectedSource}>
                                            {(historicalTags[selectedSource] || []).map(cause => (
                                                <Option key={cause} value={cause}>{cause}</Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                            </Row>
                        ) : (
                            <Text type="secondary">暂无该供应商的历史标签数据，本次提交将作为新经验记录。</Text>
                        )}
                    </Card>
                    
                    {/* ... (原有的动态字段、图片上传、附件上传等部分保持不变) ... */}

                    <Form.Item style={{ marginTop: 24, textAlign: 'right' }}>
                        <Button type="primary" htmlType="submit" loading={loading} size="large">
                            确认提交
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};

export default FileUploadPage;