import React, { useState, useMemo } from 'react';
// 引入 Row, Col 和 DatePicker
import { Form, Input, Button, Upload, Typography, Divider, Modal, Select, InputNumber, Card, Row, Col, DatePicker } from 'antd';
import { UploadOutlined, InboxOutlined } from '@ant-design/icons';
import { useSuppliers } from '../contexts/SupplierContext';
import { useCategories } from '../contexts/CategoryContext';
import { useNotification } from '../contexts/NotificationContext';
import { useNotices } from '../contexts/NoticeContext';
import dayjs from 'dayjs';

const { Dragger } = Upload;
const { Title, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// 辅助函数
const normFile = (e) => {
  if (Array.isArray(e)) return e;
  return e && e.fileList;
};
const getBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });


const FileUploadPage = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);

  const { suppliers, loading: suppliersLoading } = useSuppliers();
  const { categories, loading: categoriesLoading } = useCategories();
  const { addNotices } = useNotices();
  const { messageApi } = useNotification();
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

  const managedSuppliers = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'Manager') return suppliers;
    if (currentUser.role === 'SD') {
      const managed = currentUser.managed_suppliers || [];
      return managed.map(assignment => assignment.supplier);
    }
    return [];
  }, [currentUser, suppliers]);

  // --- 新增排序逻辑 ---
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

  const handleCancel = () => setPreviewOpen(false);

  const handlePreview = async (file) => {
    if (!file.url && !file.preview) {
      file.preview = await getBase64(file.originFileObj);
    }
    setPreviewImage(file.url || file.preview);
    setPreviewOpen(true);
    setPreviewTitle(file.name || file.url.substring(file.url.lastIndexOf('/') + 1));
  };

const renderDynamicFields = () => {
    if (!selectedCategory) return null;

    if (selectedCategory === 'SEM') {
        return (
            <>
                <Form.Item key="criteria" name={['details', 'criteria']} label="Criteria n°" rules={[{ required: true, message: '请输入 Criteria n°！' }]} >
                    <Input placeholder="请输入 Criteria n°" />
                </Form.Item>
                
                {/* --- 核心修改：使用 autoSize 替换 rows --- */}
                <Form.Item key="parameter" name={['details', 'parameter']} label="SEM Parameter" rules={[{ required: true, message: '请输入 SEM Parameter！' }]} >
                    <TextArea 
                        autoSize={{ minRows: 3, maxRows: 5 }} // 高度将在3行到5行之间自动调整
                        placeholder="请输入 SEM Parameter" 
                    />
                </Form.Item>
                
                {/* --- 核心修改：使用 autoSize 替换 rows --- */}
                <Form.Item key="description" name={['details', 'description']} label="Gap description" rules={[{ required: true, message: '请输入 Gap description！' }]} >
                    <TextArea 
                        autoSize={{ minRows: 3, maxRows: 6 }} // 高度将在3行到6行之间自动调整
                        placeholder="请输入 Gap description" 
                    />
                </Form.Item>
                
                <Form.Item key="score" name={['details', 'score']} label="Actual SEM points" rules={[{ required: true, message: '请输入 Actual SEM points！' }]} >
                    <InputNumber min={1} max={5} style={{ width: '100%' }} placeholder="请输入1到5之间的分数" />
                </Form.Item>
            </>
        );
    }

    if (selectedCategory === 'Process Audit') {
        return (
            <>
                <Form.Item
                    key="Process"
                    name={['details', 'process']}
                    label="PROCESS/QUESTIONS"
                    rules={[{ required: true, message: '请输入Process/Questions' }]}
                >
                    <Input placeholder="请输入Process/Questions" />
                </Form.Item>
                
                {/* --- 核心修改：使用 autoSize 替换 rows --- */}
                <Form.Item
                    key="Findings"
                    name={['details', 'finding']}
                    label="FINDINGS/DEVIATIONS"
                    rules={[{ required: true, message: 'FINDINGS/DEVIATIONS' }]}
                >
                    <TextArea 
                        autoSize={{ minRows: 3, maxRows: 8 }} // 高度将在3行到8行之间自动调整
                        placeholder="请输入FINDINGS/DEVIATIONS" 
                    />
                </Form.Item>
            </>
        )
    }

    return null;
};

  const onFinish = async (values) => {
    setLoading(true);
    messageApi.loading({ content: '正在处理数据...', key: 'submitting' });

    const processFiles = async (fileList = []) => {
      return Promise.all((fileList || []).map(async file => {
        if (file.originFileObj && !file.url) {
          const base64Url = await getBase64(file.originFileObj);
          return { uid: file.uid, name: file.name, status: 'done', url: base64Url, thumbUrl: base64Url };
        }
        return file;
      }));
    };

    const processedImages = await processFiles(values.images);
    const processedAttachments = await processFiles(values.attachments);

    const selectedSupplierInfo = suppliers.find(s => s.id === values.supplierId);
    const noticeCode = `N-${dayjs().format('YYYYMMDD')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    console.log(values)
    const newNoticeToInsert = {
      notice_code: noticeCode,
      category: values.category,
      // 修改后
      title: values.details.process || values.details.parameter || values.details.criteria || 'New Notice',
      assigned_supplier_id: values.supplierId,
      assigned_supplier_name: selectedSupplierInfo?.name || '',
      status: '待供应商处理',
      creator_id: currentUser.id,
      sd_notice: {
        creatorId: currentUser.id,
        creator: currentUser.name,
        // --- 使用表单中选择的日期 ---
        createTime: values.date ? values.date.format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss'),
        images: processedImages,
        attachments: processedAttachments,
        details: values.details,
      },
      history: [],
    };

    try {
      await addNotices([newNoticeToInsert]);
      messageApi.success({ content: `提报成功！编号为：${noticeCode}`, key: 'submitting', duration: 3 });

      // --- ✨ 核心修改：智能重置表单 ✨ ---
      // 1. 获取需要保留的字段的当前值
      const headerValues = {
        category: form.getFieldValue('category'),
        supplierId: form.getFieldValue('supplierId'),
        date: form.getFieldValue('date'),
      };

      // 2. 完全重置表单
      form.resetFields();

      // 3. 将刚才保存的值重新设置回去
      form.setFieldsValue(headerValues);

      // 4. 保持问题类型选择器的状态同步
      setSelectedCategory(headerValues.category);

    } catch (error) {
      messageApi.error({ content: `提交失败: ${error.message}`, key: 'submitting', duration: 3 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: 'auto', padding: '24px 0' }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={4}>输入新的审核结果</Title>
          <Paragraph type="secondary">请填写问题详情、选择供应商并上传必要的证据文件。</Paragraph>
        </div>

        {/* --- ✨ 核心修改：将 initialValues 移到 Form 标签上 --- */}
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ date: dayjs() }}>
          {/* --- ✨ 核心修改：使用 Row 和 Col 进行布局 --- */}
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="category" label="问题类型" rules={[{ required: true, message: '请选择问题类型！' }]}>
                <Select placeholder="请选择问题类型" loading={categoriesLoading} onChange={value => setSelectedCategory(value)}>
                  {sortedCategories.map(cat => <Option key={cat} value={cat}>{cat}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="supplierId" label="供应商" rules={[{ required: true, message: '请选择一个供应商！' }]}>
                <Select
                  showSearch
                  placeholder="请从列表中选择供应商"
                  loading={suppliersLoading}
                  filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                  options={managedSuppliers.map(s => ({ value: s.id, label: `${s.short_code} (${s.name})` }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              {/* --- 新增的日期选择器 --- */}
              <Form.Item name="date" label="日期" rules={[{ required: true, message: '请选择日期！' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          {/* --- 动态字段渲染区域 --- */}
          {renderDynamicFields()}

          <Divider />

          <Form.Item label="图片证据 (可拖拽上传)">
            <Form.Item name="images" valuePropName="fileList" getValueFromEvent={normFile} noStyle>
              <Dragger multiple listType="picture" beforeUpload={() => false} onPreview={handlePreview} accept="image/*">
                <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              </Dragger>
            </Form.Item>
          </Form.Item>

          <Form.Item name="attachments" label="补充附件 (可选)" valuePropName="fileList" getValueFromEvent={normFile}>
            <Upload beforeUpload={() => false} multiple>
              <Button icon={<UploadOutlined />}>点击上传附件</Button>
            </Upload>
            <Paragraph type="secondary" style={{ marginTop: '8px' }}>
              提示：目前附件上传暂不支持 .txt 格式的文件，请打包为 .zip 或使用其他格式。
            </Paragraph>
          </Form.Item>

          <Form.Item style={{ marginTop: 24, textAlign: 'right' }}>
            <Button type="primary" htmlType="submit" loading={loading} size="large">
              确认提交
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Modal open={previewOpen} title={previewTitle} footer={null} onCancel={handleCancel}>
        <img alt="预览" style={{ width: '100%' }} src={previewImage} />
      </Modal>
    </div>
  );
};

export default FileUploadPage;