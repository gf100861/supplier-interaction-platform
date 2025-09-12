import React, { useState, useMemo } from 'react';
import { Form, Input, Button, Upload, Typography, Divider, Modal, theme, Select } from 'antd';
import { UploadOutlined, PlusOutlined } from '@ant-design/icons';
import { useSuppliers } from '../contexts/SupplierContext'; // 2. 引入我们创建的 Hook
import { noticeCategories } from '../data/_mockData'; // --- 1. 导入问题类型 ---
import { useNotification } from '../contexts/NotificationContext';
import dayjs from 'dayjs';
const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select; // 引入 Option
const normFile = (e) => {
  if (Array.isArray(e)) {
    return e;
  }
  return e && e.fileList;
};

const generateSubmissionId = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const randomStr = Math.random().toString(36).substring(2, 5).toUpperCase();

  return `T${year}${month}${day}${hours}${minutes}${seconds}-${randomStr}`;
}

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
  const { token } = theme.useToken();
  const { suppliers } = useSuppliers();
  const { messageApi } = useNotification();
  const handleCancel = () => setPreviewOpen(false);

  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

  const handlePreview = async (file) => {
    if (!file.url && !file.preview) {
      file.preview = await getBase64(file.originFileObj);
    }
    setPreviewImage(file.url || file.preview);
    setPreviewOpen(true);
    setPreviewTitle(file.name || file.url.substring(file.url.lastIndexOf('/') + 1));
  };


  const onFinish = (values) => {
    setLoading(true);
    const selectedSupplier = suppliers.find(s => s.id === values.supplierId);

    // --- 2. 核心修正：重构数据对象以匹配标准 Notice 结构 ---
    const newNoticeObject = {
      id: generateSubmissionId(),
      batchId: null, // 单个创建，没有批次ID
      category: values.category,
      title: values.title, // 从新的表单项获取
      assignedSupplierId: values.supplierId,
      assignedSupplierName: selectedSupplier ? selectedSupplier.name : '',
      status: '待供应商提交行动计划', // 设置明确的初始状态
      sdNotice: {
        creatorId: currentUser.id,
        creator: currentUser.name,
        createTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        description: values.description || '',
        images: values.images || [],
        attachments: values.attachments || [],
      },
      history: [], // 初始化空的流程历史
    };

    console.log('即将提交到后端的、结构完整的通知单对象:', newNoticeObject);

    setTimeout(() => {
      messageApi.success(`提报成功！编号为：${newNoticeObject.id}`);
      form.resetFields();
      setLoading(false);
    }, 1500);
  };

  return (
    <div style={{ background: token.colorBgLayout }}>
      <div style={{ padding: '24px', background: token.colorBgLayout, minHeight: '100%' }}>
        <Title level={4}>创建新的提报</Title>
        <Text type="secondary">请上传必要的图片和附件，并填写补充说明，然后点击提交。</Text>
      </div>
      <Divider />
      <div style={{ padding: '24px', background: token.colorBgLayout, minHeight: '100%' }}>

        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入一个清晰的标题！' }]}
          >
            <Input placeholder="例如：现场物料堆放不规范问题" />
          </Form.Item>
          <Form.Item
            name="supplierId"
            label="选择提报供应商"
            rules={[{ required: true, messageApi: '请选择一个供应商！' }]}
          >
            <Select placeholder="请从列表中选择供应商">
              {suppliers.map(supplier => (
                <Option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="category"
            label="问题类型"
            rules={[{ required: true, message: '请选择一个问题类型！' }]}
          >
            <Select placeholder="请选择问题类型">
              {noticeCategories.map(cat => (
                <Option key={cat} value={cat}>
                  {cat}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {/* --- 顺序调整：图片上传移到最前 --- */}
          <Form.Item
            name="images"
            label="展示图片 (用于轮播图)"
            valuePropName="fileList"
            getValueFromEvent={normFile}
            rules={[{ required: true, message: '请至少上传一张展示图片！' }]}
          >
            <Upload
              action="/upload.do"
              listType="picture-card"
              beforeUpload={() => false}
              onPreview={handlePreview}
              // --- 新增：限制文件类型为图片 ---
              accept="image/*"
            >
              <div>
                <PlusOutlined />
                <div style={{ marginTop: 8 }}>上传图片</div>
              </div>
            </Upload>
          </Form.Item>

          {/* --- 顺序调整：附件上传移到第二 --- */}
          <Form.Item name="attachments" label="补充文件 (PDF, Word, Excel等)" valuePropName="fileList" getValueFromEvent={normFile}>
            <Upload
              action="/upload.do"
              beforeUpload={() => false}
              multiple
              // --- 新增：限制文件类型为PDF, Word, Excel ---
              accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            >
              <Button icon={<UploadOutlined />}>点击上传附件</Button>
            </Upload>
          </Form.Item>

          {/* --- 顺序调整：文字说明移到最后 --- */}
          <Form.Item name="description" label="补充文字说明 (可选)">
            <TextArea rows={4} placeholder="如有需要，请在此处添加文字说明..." />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              提交提报
            </Button>
          </Form.Item>
        </Form>

      </div>

      <Modal open={previewOpen} title={previewTitle} footer={null} onCancel={handleCancel} width={800}>
        <img
          alt="example"
          style={{
            width: '100%',
          }}
          src={previewImage}
        />
      </Modal>
    </div>
  );
};

export default FileUploadPage;