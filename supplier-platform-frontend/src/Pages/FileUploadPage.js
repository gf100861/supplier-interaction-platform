import React, { useState, useMemo, useEffect } from 'react';
// 引入 Row, Col 和 DatePicker
import { Form, Input, Button, Upload, Typography, Divider, Modal, Select, InputNumber, Card, Row, Col, DatePicker, Radio, Empty } from 'antd';
import { UploadOutlined, InboxOutlined } from '@ant-design/icons';
import { useSuppliers } from '../contexts/SupplierContext';
import { useCategories } from '../contexts/CategoryContext';
import { useNotification } from '../contexts/NotificationContext';
import { useNotices } from '../contexts/NoticeContext';
import { supabase } from '../supabaseClient';
import dayjs from 'dayjs';

const { Dragger } = Upload;
const { Title, Paragraph, Text } = Typography;
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
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);


  const [historicalTags, setHistoricalTags] = useState({});
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);

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


  const handleSupplierChange = async (supplierId) => {
    setSelectedSupplierId(supplierId); // 更新供应商选择状态

    // 当清空选择时，重置所有相关状态
    if (!supplierId) {
      setHistoricalTags({});
      form.setFieldsValue({ problem_source: null, cause: null });
      setSelectedSource(null);
      return;
    }

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
        acc[problem_source].add(cause);
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
    // --- 核心修正：设置 duration 为 0，确保 loading 消息不会自动消失 ---
    messageApi.open({
      type: 'loading',
      content: '正在处理数据并上传...',
      key: 'submitting',
      duration: 0, 
    });

    try {
        const processFiles = async (fileList) => {
          console.log('filelist', fileList)
          if (!fileList || fileList.length === 0) return [];
    
          const processed = await Promise.all(
            fileList.map(async (file) => {
              // 如果文件有 originFileObj，说明它是新上传的，需要处理
              if (file.originFileObj) {
                try {
                  const base64Url = await getBase64(file.originFileObj);
                  // 返回一个干净、可序列化的对象
                  return {
                    uid: file.uid,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    url: base64Url,
                  };
                } catch (error) {
                  console.error("文件转换为 Base64 失败:", file.name, error);
                  messageApi.open({
                    type: 'error',
                    content: `文件 ${file.name} 处理失败！`,
                    key: 'submitting', // 使用相同的 key 来更新消息
                    duration: 3
                  });
                  return null; // 如果转换失败，则返回 null
                }
              }
    
              // 如果文件已经有 url (例如，来自一个已保存的记录)，只需确保它是一个干净的对象
              if (file.url) {
                return {
                  uid: file.uid,
                  name: file.name,
                  url: file.url,
                };
              }
    
              // 忽略无法处理的文件
              return null;
            })
          );
    
          // 过滤掉所有处理失败的 (null) 文件
          return processed.filter(Boolean);
        };
    
    
        const processedImages = await processFiles(values.images);
        const processedAttachments = await processFiles(values.attachments);
    
        const selectedSupplierInfo = suppliers.find(s => s.id === values.supplierId);
        const noticeCode = `N-${dayjs().format('YYYYMMDD')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        console.log('attachement', processedAttachments)
    
        console.log('image', currentUser)
        const newNoticeToInsert = {
          notice_code: noticeCode,
          category: values.category,
          // 修改后
          title: values.details.process || values.details.parameter || values.details.criteria || 'New Notice',
          assigned_supplier_id: values.supplierId,
          assigned_supplier_name: selectedSupplierInfo?.name || '',
          status: '待提交Action Plan',
          creator_id: currentUser.id,
          sd_notice: {
            creatorId: currentUser.id,
            creator: currentUser.name,
            // --- 使用表单中选择的日期 ---
            createTime: values.date ? values.date.format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss'),
            images: processedImages,
            attachments: processedAttachments,
            details: values.details,
            // --- 核心修正：在这里将选择的标签写入数据库 ---
            problem_source: values.problem_source || null,
            cause: values.cause || null,
          },
          history: [],
        };

        // 关键点：这里添加 await 确保 addNotices 真正执行完毕
        await addNotices([newNoticeToInsert]);
    
        // --- 成功：更新同一 key 的消息为 success 状态，并设置显示时长 ---
        messageApi.open({
          type: 'success',
          content: `提报成功！编号为：${noticeCode}`,
          key: 'submitting',
          duration: 2.5
        });
    
        const headerValues = {
          category: form.getFieldValue('category'),
          supplierId: form.getFieldValue('supplierId'),
          date: form.getFieldValue('date'),
        };
        form.resetFields();
        form.setFieldsValue(headerValues);
        setSelectedCategory(headerValues.category);
        setSelectedSource(null);
        setHistoricalTags({});
    
        // 延迟关闭按钮 loading，给用户一点反馈时间
        await new Promise(resolve => setTimeout(resolve, 1500));

    } catch (error) {
      console.error("提交失败:", error);
      // --- 失败：更新同一 key 的消息为 error 状态 ---
      messageApi.open({
        type: 'error',
        content: `提交失败: ${error.message}`,
        key: 'submitting',
        duration: 3
      });
      await new Promise(resolve => setTimeout(resolve, 1500));
    } finally {
        setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: 'auto', padding: '24px 0' }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={4}>手工输入新的审核结果</Title>
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
                  onChange={handleSupplierChange}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              {/* --- 新增的日期选择器 --- */}
              <Form.Item name="date" label="日期" rules={[{ required: true, message: '请选择日期！' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Card
                type="inner"
                title="历史经验标签 (可选) - 请先选择供应商"
                loading={loadingHistory}
                style={{
                  marginBottom: 24,
                  opacity: !selectedSupplierId ? 0.5 : 1,
                  pointerEvents: !selectedSupplierId ? 'none' : 'auto'
                }}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="problem_source" label="产品">
                      <Select
                        placeholder={!selectedSupplierId ? "请先选择供应商" : "选择产品或'其他'"}
                        allowClear
                        onChange={value => {
                          setSelectedSource(value);
                          if (value !== '其他') form.setFieldsValue({ cause: null });
                        }}
                      >
                        {Object.keys(historicalTags).map(source => (
                          <Option key={source} value={source}>{source}</Option>
                        ))}
                        <Option key="其他" value="其他">其他 (手动输入)</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    {selectedSource === '其他' ? (
                      <Form.Item name="cause" label="造成原因 (手动输入)" rules={[{ required: true, message: '请手动输入造成原因' }]}>
                        <Input placeholder="请输入具体原因" />
                      </Form.Item>
                    ) : (
                      <Form.Item name="cause" label="过程 (根据历史推荐)">
                        <Select placeholder="选择过程" allowClear disabled={!selectedSource}>
                          {(historicalTags[selectedSource] || []).map(cause => (
                            <Option key={cause} value={cause}>{cause}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    )}
                  </Col>
                </Row>
                {!loadingHistory && Object.keys(historicalTags).length === 0 && (
                  <Text type="secondary">暂无该供应商的历史标签数据，本次提交将作为新经验记录。</Text>
                )}
              </Card>
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

          <Form.Item label="补充附件 (可选)">
            <Form.Item name="attachments" valuePropName="fileList" getValueFromEvent={normFile} noStyle>
              <Upload beforeUpload={() => false} multiple>
                <Button icon={<UploadOutlined />}>点击上传附件</Button>
              </Upload>
            </Form.Item>
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