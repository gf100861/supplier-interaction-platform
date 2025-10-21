import React, { useState, useMemo, useEffect } from 'react';
import { Form, Input, Button, Upload, Typography, Divider, Modal, theme, Select, InputNumber, Card, Row, Col, Space, Spin, Empty, DatePicker, AutoComplete } from 'antd';
import { UploadOutlined, InboxOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useNotification } from '../contexts/NotificationContext';
import { useSuppliers } from '../contexts/SupplierContext';
import { useNotices } from '../contexts/NoticeContext';
import { useCategories } from '../contexts/CategoryContext';
import { supabase } from '../supabaseClient';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { Dragger } = Upload;

// Helper functions
const normFile = (e) => { if (Array.isArray(e)) return e; return e && e.fileList; };
const getBase64 = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => resolve(reader.result); reader.onerror = (error) => reject(error); });

const EditNoticePage = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState('');
    const [previewTitle, setPreviewTitle] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [historicalTags, setHistoricalTags] = useState({});
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [selectedSource, setSelectedSource] = useState(null);

    const { suppliers, loading: suppliersLoading } = useSuppliers();
    const { categories, loading: categoriesLoading } = useCategories();
    const { notices, updateNotice } = useNotices();
    const { messageApi } = useNotification();
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);
    const navigate = useNavigate();
    const { id: noticeId } = useParams();

    const editingNotice = useMemo(() => {
        if (!noticeId || notices.length === 0) return null;
        return notices.find(n => n.id === noticeId);
    }, [noticeId, notices]);

     const sortedCategories = useMemo(() => {
        if (!categories || categories.length === 0) return [];
        const desiredOrder = ['Process Audit', 'SEM'];
        return [...categories].sort((a, b) => {
          const indexA = desiredOrder.indexOf(a);
          const indexB = desiredOrder.indexOf(b);
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          return a.localeCompare(b);
        });
      }, [categories]);

    useEffect(() => {
        if (editingNotice && form) {
            form.setFieldsValue({
                category: editingNotice.category,
                supplierId: editingNotice.assignedSupplierId,
                date: dayjs(editingNotice.sdNotice.createTime),
                problem_source: editingNotice.sdNotice.problem_source,
                cause: editingNotice.sdNotice.cause,
                details: editingNotice.sdNotice.details,
                images: editingNotice.sdNotice.images,
                attachments: editingNotice.sdNotice.attachments,
            });
            setSelectedCategory(editingNotice.category);
            handleSupplierChange(editingNotice.assignedSupplierId, editingNotice.sdNotice.problem_source, editingNotice.sdNotice.cause);
            setPageLoading(false);
        }
    }, [editingNotice, form]);

    const managedSuppliers = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === 'Manager' || currentUser.role === 'Admin') return suppliers;
        if (currentUser.role === 'SD') {
            const managed = currentUser.managed_suppliers || [];
            return managed.map(assignment => assignment.supplier).filter(Boolean);
        }
        return [];
    }, [currentUser, suppliers]);

    const handleSupplierChange = async (supplierId, initialSource, initialCause) => {
        if (!initialSource) {
            form.setFieldsValue({ problem_source: undefined, cause: undefined });
            setSelectedSource(null);
        } else {
            setSelectedSource(initialSource);
        }
        setHistoricalTags({});

        if (!supplierId) return;

        setLoadingHistory(true);
        try {
            const selectedSupplier = suppliers.find(s => s.id === supplierId);
            if (!selectedSupplier) return;

            const { data, error } = await supabase
                .from('knowledge_base')
                .select('problem_source, cause')
                .eq('supplier_parma_id', selectedSupplier.parma_id);

            if (error) throw error;

            const tags = data.reduce((acc, { problem_source, cause }) => {
                if (!acc[problem_source]) acc[problem_source] = new Set();
                if (cause) acc[problem_source].add(cause);
                return acc;
            }, {});

            Object.keys(tags).forEach(key => { tags[key] = Array.from(tags[key]); });
            setHistoricalTags(tags);
        } catch (error) {
            messageApi.error(`加载历史标签失败: ${error.message}`);
        } finally {
            setLoadingHistory(false);
        }
    };

    const renderDynamicFields = () => {
        if (!selectedCategory) return null;

        if (selectedCategory === 'SEM') {
            return (
                <>
                    <Form.Item
                        key="criteria"
                        name={['details', 'criteria']}
                        label="Criteria n°"
                        rules={[{ required: true, message: '请输入 Criteria n°！' }]}
                    >
                        <Input placeholder="请输入 Criteria n°" />
                    </Form.Item>
                    <Form.Item
                        key="parameter"
                        name={['details', 'parameter']}
                        label="SEM Parameter"
                        rules={[{ required: true, message: '请输入 SEM Parameter！' }]}
                    >
                        <TextArea autoSize={{ minRows: 3, maxRows: 6 }} placeholder="请输入 SEM Parameter" />
                    </Form.Item>
                    <Form.Item
                        key="description"
                        name={['details', 'description']}
                        label="Gap description"
                        rules={[{ required: true, message: '请输入 Gap description！' }]}
                    >
                        <TextArea autoSize={{ minRows: 3, maxRows: 6 }} placeholder="请输入 Gap description" />
                    </Form.Item>
                    <Form.Item
                        key="score"
                        name={['details', 'score']}
                        label="Actual SEM points"
                        rules={[{ required: true, message: '请输入 Actual SEM points！' }]}
                    >
                        <InputNumber min={0} max={5} style={{ width: '100%' }} placeholder="请输入1到5之间的分数" />
                    </Form.Item>
                </>
            );
        }

        if (selectedCategory === 'Process Audit') {
            return (
                <>
                    <Form.Item
                        key="process"
                        //这里代表之前历史的值进行修改，details=sdNotice,意味着把sdNotice中的title赋值上去
                        name={['details', 'title']}
                        label="PROCESS/QUESTIONS"
                        rules={[{ required: true, message: '请输入Process/Questions' }]}
                    >
                        <Input placeholder="请输入Process/Questions" />
                    </Form.Item>
                    <Form.Item
                        key="finding"
                        name={['details', 'description']}
                        label="FINDINGS/DEVIATIONS"
                        rules={[{ required: true, message: '请输入FINDINGS/DEVIATIONS' }]}
                    >
                        <TextArea autoSize={{ minRows: 3, maxRows: 8 }} placeholder="请输入FINDINGS/DEVIATIONS" />
                    </Form.Item>
                </>
            );
        }

        return null;
    };

    const handlePreview = async (file) => {
        if (!file.url && !file.preview && file.originFileObj) {
            file.preview = await getBase64(file.originFileObj);
        }
        setPreviewImage(file.url || file.preview);
        setPreviewOpen(true);
        setPreviewTitle(file.name || file.url.substring(file.url.lastIndexOf('/') + 1));
    };

    const handleCancel = () => setPreviewOpen(false);

    const onFinish = async (values) => {
        setLoading(true);
        messageApi.loading({ content: '正在更新通知单...', key: 'updating' });

        const processFiles = async (fileList = []) => (
            Promise.all((fileList || []).map(async file => {
                if (file.originFileObj) { // It's a new file
                    const base64Url = await getBase64(file.originFileObj);
                    return { uid: file.uid, name: file.name, status: 'done', url: base64Url, type: file.type, size: file.size };
                }
                // It's an existing file, just return the essential parts
                return { uid: file.uid, name: file.name, url: file.url, status: file.status };
            }))
        );

        const processedImages = await processFiles(values.images);
        const processedAttachments = await processFiles(values.attachments);
        const selectedSupplierInfo = suppliers.find(s => s.id === values.supplierId);

        const newHistoryEntry = {
            type: 'sd_notice_edit',
            submitter: currentUser.name || currentUser.email,
            time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            description: 'SD 修改了初始通知内容。',
        };

        const noticeUpdates = {
            category: values.category,
            title: values.details?.process || values.details?.parameter || values.details?.criteria || editingNotice.title,
            assigned_supplier_id: values.supplierId,
            assigned_supplier_name: selectedSupplierInfo?.name || '',
            sd_notice: {
                ...editingNotice.sdNotice,
                creatorId: currentUser.id,
                creator: currentUser.name,
                createTime: values.date.format('YYYY-MM-DD HH:mm:ss'),
                images: processedImages,
                attachments: processedAttachments,
                details: values.details,
                problem_source: values.problem_source || null,
                cause: values.cause || null,
            },
            history: [...(editingNotice.history || []), newHistoryEntry],
        };

        try {
            await updateNotice(editingNotice.id, noticeUpdates);
            messageApi.success({ content: `通知单 ${editingNotice.noticeCode} 已成功修改！`, key: 'updating', duration: 3 });
            navigate('/notices');
        } catch (error) {
            messageApi.error({ content: `修改失败: ${error.message}`, key: 'updating', duration: 3 });
        } finally {
            setLoading(false);
        }
    };

    if (pageLoading || suppliersLoading || categoriesLoading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}><Spin size="large" /></div>;
    }

    if (!editingNotice) {
        return (
            <div style={{ maxWidth: 800, margin: 'auto', padding: '24px 0' }}>
                <Card>
                    <Empty description="未找到指定的通知单，或数据仍在加载中。" />
                </Card>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 900, margin: 'auto', padding: '24px 0' }}>
            <Card>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Title level={4}>修改整改通知单</Title>
                    <Paragraph type="secondary">您正在修改: <Text strong>{editingNotice?.noticeCode}</Text></Paragraph>
                </div>

                <Form form={form} layout="vertical" onFinish={onFinish}>
                    <Card title="基础信息" bordered={false}>
                        <Row gutter={16}>
                            <Col span={8}>
                                <Form.Item name="category" label="问题类型" rules={[{ required: true }]}>
                                    <Select placeholder="请选择问题类型" loading={categoriesLoading} onChange={value => setSelectedCategory(value)}>

                                        {sortedCategories.map(cat => <Option key={cat} value={cat}>{cat}</Option>)}

                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item name="supplierId" label="供应商" rules={[{ required: true }]}>
                                    <Select
                                        showSearch
                                        placeholder="请选择供应商"
                                        options={managedSuppliers.map(s => ({ value: s.id, label: `${s.short_code} (${s.name})` }))}
                                        onChange={(value) => handleSupplierChange(value)}
                                        filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item name="date" label="日期" rules={[{ required: true }]}>
                                    <DatePicker style={{ width: '100%' }} />
                                </Form.Item>
                            </Col>
                        </Row>
                    </Card>

                    <Card title="历史经验标签 (可选)" bordered={false} loading={loadingHistory} style={{ marginTop: 16 }}>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="problem_source" label="问题来源 (可输入新来源)">
                                    <AutoComplete
                                        options={Object.keys(historicalTags).map(source => ({ value: source }))}
                                        placeholder="选择或输入问题来源"
                                        filterOption={(inputValue, option) => option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1}
                                        allowClear
                                        onChange={value => {
                                            if (form.getFieldValue('problem_source') !== value) form.setFieldsValue({ cause: undefined });
                                            setSelectedSource(value);
                                        }}
                                        onSelect={value => setSelectedSource(value)}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="cause" label="造成原因 (可输入新原因)">
                                    <AutoComplete
                                        options={(historicalTags[selectedSource] || []).map(cause => ({ value: cause }))}
                                        placeholder="选择或输入造成原因"
                                        filterOption={(inputValue, option) => option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1}
                                        allowClear
                                        disabled={!selectedSource}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                    </Card>

                    <Card title="问题详情" bordered={false} style={{ marginTop: 16 }}>
                        {renderDynamicFields()}
                    </Card>

                    <Card title="证据文件" bordered={false} style={{ marginTop: 16 }}>
                        <Form.Item label="图片证据 (可拖拽上传)">
                            <Form.Item name="images" valuePropName="fileList" getValueFromEvent={normFile} noStyle>
                                <Dragger multiple listType="picture" beforeUpload={() => false} onPreview={handlePreview} accept="image/*">
                                    <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                                    <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                                </Dragger>
                            </Form.Item>
                        </Form.Item>
                        <Form.Item label="补充附件 (可选)">
                            <Form.Item name="attachments" valuePropName="fileList" getValueFromEvent={normFile} noStyle>
                                <Upload beforeUpload={() => false} multiple>
                                    <Button icon={<UploadOutlined />}>点击上传附件</Button>
                                </Upload>
                            </Form.Item>
                        </Form.Item>
                    </Card>

                    <Form.Item style={{ marginTop: 32, textAlign: 'right' }}>
                        <Space>
                            <Button onClick={() => navigate('/notices')}>取消</Button>
                            <Button type="primary" htmlType="submit" loading={loading} size="large" icon={<SaveOutlined />}>
                                保存修改
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Card>

            <Modal open={previewOpen} title={previewTitle} footer={null} onCancel={handleCancel}>
                <img alt="预览" style={{ width: '100%' }} src={previewImage} />
            </Modal>
        </div>
    );
};

export default EditNoticePage;

