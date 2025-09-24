import React, { useState, useMemo } from 'react';
import { Form, Input, Button, Upload, Typography, Divider, Modal, Select, InputNumber, Card} from 'antd';
import { UploadOutlined, InboxOutlined } from '@ant-design/icons';
import { useSuppliers } from '../contexts/SupplierContext';
import { useCategories } from '../contexts/CategoryContext';
import { useNotification } from '../contexts/NotificationContext';
import { useNotices } from '../contexts/NoticeContext';
import dayjs from 'dayjs';
// 假设您的 _mockData 文件中有一个 categoryColumnConfig 对象
// import { categoryColumnConfig } from '../data/_mockData';

const { Dragger } = Upload;
const { Title, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// 辅助函数: 处理文件上传事件
const normFile = (e) => {
  if (Array.isArray(e)) {
    return e;
  }
  return e && e.fileList;
};

// 辅助函数: 将文件转换为 Base64，用于预览
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

  // 从 Context Hooks 获取数据和方法
  const { suppliers, loading: suppliersLoading } = useSuppliers();
  const { categories, loading: categoriesLoading } = useCategories();
  const { addNotices } = useNotices();
  const { messageApi } = useNotification();
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

  // 根据用户角色确定其可管理的供应商列表
  const managedSuppliers = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'Manager') return suppliers;
    if (currentUser.role === 'SD') {
      const managed = currentUser.managed_suppliers || [];
      return managed.map(assignment => assignment.supplier);
    }
    return [];
  }, [currentUser, suppliers]);

  // 关闭图片预览 Modal
  const handleCancel = () => setPreviewOpen(false);

  // 处理图片预览
  const handlePreview = async (file) => {
    if (!file.url && !file.preview) {
      file.preview = await getBase64(file.originFileObj);
    }
    setPreviewImage(file.url || file.preview);
    setPreviewOpen(true);
    setPreviewTitle(file.name || file.url.substring(file.url.lastIndexOf('/') + 1));
  };

  /**
   * 核心功能：根据选择的问题类型，动态渲染对应的表单输入框
   */
  const renderDynamicFields = () => {
    if (!selectedCategory) {
      return null;
    }

    // 当问题类型为 'SEM' 时，渲染指定的字段
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
            <TextArea rows={3} placeholder="请输入 SEM Parameter" />
          </Form.Item>
          <Form.Item
            key="description"
            name={['details', 'description']}
            label="Gap description"
            rules={[{ required: true, message: '请输入 Gap description！' }]}
          >
            <TextArea rows={3} placeholder="请输入 Gap description" />
          </Form.Item>
          <Form.Item
            key="score"
            name={['details', 'score']}
            label="Actual SEM points"
            rules={[{ required: true, message: '请输入 Actual SEM points！' }]}
          >
            <InputNumber min={1} max={5} style={{ width: '100%' }} placeholder="请输入1到5之间的分数" />
          </Form.Item>
        </>
      );
    }

    if (selectedCategory === 'Process') {

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
          <Form.Item
            key="Findings"
            name={['details', 'finding']}
            label="FINDINGS/DEVIATIONS"
            rules={[{ required: true, message: 'FINDINGS/DEVIATIONS' }]}
          >
            <TextArea rows={3} placeholder="请输入FINDINGS/DEVIATIONS" />
          </Form.Item>
        </>

      )
    }

    return null;
  };

  const sortedCategories = useMemo(() => {
    // 如果 categories 数组还没加载好，直接返回一个空数组
    if (!categories || categories.length === 0) {
        return [];
    }

    // 1. 定义你想要的特殊顺序
    const desiredOrder = ['Process', 'SEM'];

    // 2. 创建一个新数组副本进行排序，避免修改原始数据
    return [...categories].sort((a, b) => {
        const indexA = desiredOrder.indexOf(a);
        const indexB = desiredOrder.indexOf(b);

        // 如果 a 和 b 都在我们的特殊顺序列表中
        if (indexA !== -1 && indexB !== -1) {
            return indexA - indexB; // 按列表中的顺序排序
        }
        // 如果只有 a 在列表中，那么 a 应该排在前面
        if (indexA !== -1) {
            return -1;
        }
        // 如果只有 b 在列表中，那么 b 应该排在前面
        if (indexB !== -1) {
            return 1;
        }
        // 如果 a 和 b 都不在列表中，则按它们原来的（或字母）顺序排序
        return a.localeCompare(b);
    });
}, [categories]); // 依赖项是 categories，只有它变了才会重新计算

  // 表单提交处理
  const onFinish = async (values) => {
    setLoading(true);
    messageApi.loading({ content: '正在处理数据...', key: 'submitting' });

    // 异步处理文件列表，将文件转换为 Base64
    const processFiles = async (fileList = []) => {
      return Promise.all((fileList).map(async file => {
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

    // 组装最终提交到后端或 Supabase 的数据对象
    const newNoticeToInsert = {
      notice_code: noticeCode,
      category: values.category,
      // 从 details 对象中自动选择一个作为主标题
      title: values.details.title || values.details.parameter || values.details.criteria || 'New Notice',
      assigned_supplier_id: values.supplierId,
      assigned_supplier_name: selectedSupplierInfo?.name || '',
      status: '待供应商处理',
      creator_id: currentUser.id,
      sd_notice: { // 将所有初始信息存入 jsonb 字段
        creatorId: currentUser.id,
        creator: currentUser.name,
        createTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        images: processedImages,
        attachments: processedAttachments,
        // 将所有动态和固定的描述性字段都存入 details
        details: values.details,
      },
      history: [],
    };

    try {
      await addNotices([newNoticeToInsert]); // addNotices 接收一个数组
      messageApi.success({ content: `提报成功！编号为：${noticeCode}`, key: 'submitting', duration: 3 });
      form.resetFields();
      setSelectedCategory(null); // 清空所选类型以重置表单
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

        <Form form={form} layout="vertical" onFinish={onFinish}>
         <Form.Item name="category" label="问题类型" rules={[{ required: true, message: '请选择问题类型！' }]}>
    <Select placeholder="请选择问题类型" loading={categoriesLoading} onChange={value => setSelectedCategory(value)}>
        {/* 使用我们新创建的、排好序的 sortedCategories 数组 */}
        {sortedCategories.map(cat => <Option key={cat} value={cat}>{cat}</Option>)}
    </Select>
</Form.Item>

          <Form.Item name="supplierId" label="供应商" rules={[{ required: true, message: '请选择一个供应商！' }]}>
            <Select
              showSearch
              placeholder="请从列表中选择供应商"
              loading={suppliersLoading}
              filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              options={managedSuppliers.map(s => ({
                value: s.id,
                label: `${s.short_code} (${s.name})`
              }))}
            />
          </Form.Item>

          {/* --- 动态字段渲染区域 --- */}
          {renderDynamicFields()}

          <Divider />

          {/* --- 图片和附件上传区域 --- */}
          <Form.Item label="图片 (可拖拽上传)">
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
          </Form.Item>

          <Form.Item style={{ marginTop: 24, textAlign: 'right' }}>
            <Button type="primary" htmlType="submit" loading={loading} size="large">
              提交
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