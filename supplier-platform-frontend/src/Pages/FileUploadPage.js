import React, { useState, useMemo, useEffect } from 'react';
// 引入 Grid 用于响应式断点检测
import { Form, Input, Button, Upload, Typography, Divider, Modal, Select, InputNumber, Card, Row, Col, DatePicker, Checkbox, Collapse, Grid } from 'antd';
import { UploadOutlined, InboxOutlined, ApiOutlined, GoogleOutlined } from '@ant-design/icons';
import { useSuppliers } from '../contexts/SupplierContext';
import { useCategories } from '../contexts/CategoryContext';
import { useNotification } from '../contexts/NotificationContext';
import { useNotices } from '../contexts/NoticeContext';
import { supabase } from '../supabaseClient'; // 确保引入了 supabase
import dayjs from 'dayjs';

const { Dragger } = Upload;
const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { Panel } = Collapse;
const { useBreakpoint } = Grid; // 引入断点钩子

// 🔧 环境配置
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_URL = isDev
    ? 'http://localhost:3001' 
    : window.location.origin; // 必须是这句！

// 辅助函数
const normFile = (e) => {
  if (Array.isArray(e)) return e;
  return e && e.fileList;
};

// 保留用于本地 UI 预览的 base64 转换
const getBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });

const LS_API_KEY_KEY = 'gemini_api_key_local_storage';

// --- 日志系统工具函数 (复用逻辑) ---
const getSessionId = () => {
  let sid = sessionStorage.getItem('app_session_id');
  if (!sid) {
    sid = 'sess_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    sessionStorage.setItem('app_session_id', sid);
  }
  return sid;
};

let cachedIpAddress = null;
const getClientIp = async () => {
  if (cachedIpAddress) return cachedIpAddress;
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    cachedIpAddress = data.ip;
    return data.ip;
  } catch (error) {
    return 'unknown';
  }
};

const logSystemEvent = async (params) => {
  const {
    category = 'SYSTEM',
    eventType,
    severity = 'INFO',
    message,
    userId = null,
    meta = {}
  } = params;

  try {
    const apiPath = isDev ? '/api/system-log' : '/api/system-log';
    const targetUrl = `${BACKEND_URL}${apiPath}`;
    const clientIp = await getClientIp();
    const sessionId = getSessionId();

    await fetch(`${targetUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category,
        event_type: eventType,
        severity,
        message,
        user_id: userId,
        metadata: {
          ip_address: clientIp,
          session_id: sessionId,
          userAgent: navigator.userAgent,
          url: window.location.href,
          page: 'FileUploadPage',
          ...meta,
          timestamp_client: new Date().toISOString()
        }
      })
    });

  } catch (e) {
    console.error("Logger exception:", e);
  }
};

const FileUploadPage = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [fileType, setFileType] = useState(''); // 用于区分是图片还是视频
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);

  const [historicalTags, setHistoricalTags] = useState({});
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);

  // --- API Key 状态 ---
  const [apiKey, setApiKey] = useState('');
  const [rememberApiKey, setRememberApiKey] = useState(false);

  // --- 移动端适配 Hook ---
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const { suppliers, loading: suppliersLoading } = useSuppliers();
  const { categories, loading: categoriesLoading } = useCategories();
  const { addNotices } = useNotices();
  const { messageApi } = useNotification();
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

  useEffect(() => {
    const savedKey = localStorage.getItem(LS_API_KEY_KEY);
    if (savedKey) {
      setApiKey(savedKey);
      setRememberApiKey(true);
    }
  }, []);

  // 🌟 核心：专门负责把文件传到 Supabase 并返回链接的函数
  const uploadFileToSupabase = async (file) => {
    try {
      const fileExt = file.name.split('.').pop();
      // 生成随机文件名，防止覆盖
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      // 1. 上传文件到 attachments 存储桶
      const { error } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (error) throw error;

      // 2. 获取公开链接
      const { data: publicUrlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('上传 Supabase 失败:', error);
      throw error;
    }
  };

  const handleApiKeyChange = (e) => {
    const newKey = e.target.value;
    setApiKey(newKey);
    if (rememberApiKey) {
      localStorage.setItem(LS_API_KEY_KEY, newKey);
    }
  };

  const handleRememberChange = (e) => {
    const checked = e.target.checked;
    setRememberApiKey(checked);
    if (checked) {
      localStorage.setItem(LS_API_KEY_KEY, apiKey);
      messageApi.success('API Key 已保存到本地');
    } else {
      localStorage.removeItem(LS_API_KEY_KEY);
      messageApi.info('不再记住 API Key');
    }
  };

  const getBackendEmbedding = async (text) => {
    if (!text || !text.trim()) return null;
    const cleanText = text.replace(/\s+/g, ' ').trim().substring(0, 8000);

    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        messageApi.error('登录凭证丢失，请重新登录');
        return;
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      const response = await fetch(`${BACKEND_URL}/api/ai/embedding`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ text: cleanText })
      });

      if (!response.ok) throw new Error("Backend Embedding API request failed");
      const result = await response.json();
      return result.embedding;
    } catch (error) {
      console.error("生成向量失败:", error);
      logSystemEvent({
        category: 'AI',
        eventType: 'EMBEDDING_FAILED',
        severity: 'WARN',
        message: `Backend Embedding generation failed: ${error.message}`,
        userId: currentUser?.id,
        meta: { text_length: cleanText.length }
      });
      return null;
    }
  };

  useEffect(() => {
    if (currentUser) {
      logSystemEvent({
        category: 'INTERACTION',
        eventType: 'PAGE_VIEW',
        message: 'User visited File Upload Page (Manual Entry)',
        userId: currentUser.id
      });
    }
  }, [currentUser]);

  const managedSuppliers = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'Manager') return suppliers;
    if (currentUser.role === 'SD') {
      const managed = currentUser.managed_suppliers || [];
      return managed.map(assignment => assignment.supplier);
    }
    return [];
  }, [currentUser, suppliers]);

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

  const handleSupplierChange = async (supplierId) => {
    setSelectedSupplierId(supplierId);

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

      const token = localStorage.getItem('access_token');
      if (!token) {
        messageApi.error('登录凭证丢失');
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/knowledge-base?supplierParmaId=${selectedSupplier.parma_id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Fetch tags failed');
      const data = await response.json();

      const tags = data.reduce((acc, { problem_source, cause }) => {
        if (!acc[problem_source]) acc[problem_source] = new Set();
        if (cause) acc[problem_source].add(cause);
        return acc;
      }, {});

      Object.keys(tags).forEach(key => { tags[key] = Array.from(tags[key]); });
      setHistoricalTags(tags);
    } catch (error) {
      messageApi.error(`加载历史标签失败: ${error.message}`);
      logSystemEvent({
        category: 'DATA',
        eventType: 'LOAD_HISTORY_TAGS_FAILED',
        severity: 'ERROR',
        message: `Failed to load history tags: ${error.message}`,
        userId: currentUser?.id,
        meta: { supplierId: supplierId }
      });
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
          <Form.Item key="parameter" name={['details', 'parameter']} label="SEM Parameter" rules={[{ required: true, message: '请输入 SEM Parameter！' }]} >
            <TextArea autoSize={{ minRows: 3, maxRows: 5 }} placeholder="请输入 SEM Parameter" />
          </Form.Item>
          <Form.Item key="description" name={['details', 'description']} label="Gap description" rules={[{ required: true, message: '请输入 Gap description！' }]} >
            <TextArea autoSize={{ minRows: 3, maxRows: 6 }} placeholder="请输入 Gap description" />
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
          <Form.Item key="Process" name={['details', 'process']} label="PROCESS/QUESTIONS" rules={[{ required: true, message: '请输入Process/Questions' }]}>
            <Input placeholder="请输入Process/Questions" />
          </Form.Item>
          <Form.Item key="Findings" name={['details', 'finding']} label="FINDINGS/DEVIATIONS" rules={[{ required: true, message: 'FINDINGS/DEVIATIONS' }]}>
            <TextArea autoSize={{ minRows: 3, maxRows: 8 }} placeholder="请输入FINDINGS/DEVIATIONS" />
          </Form.Item>
        </>
      )
    }

    return null;
  };

  const onFinish = async (values) => {
    setLoading(true);
    messageApi.open({
      type: 'loading',
      content: '正在上传至云端对象存储...',
      key: 'submitting',
      duration: 0,
    });

    try {
      const processFiles = async (fileList) => {
        if (!fileList || fileList.length === 0) return [];

        const processed = await Promise.all(
          fileList.map(async (file) => {
            if (file.originFileObj) {
              try {
                // 调用核心函数，传至云端
                const publicUrl = await uploadFileToSupabase(file.originFileObj);
                return {
                  uid: file.uid,
                  name: file.name,
                  type: file.type,
                  size: file.size,
                  url: publicUrl, 
                };
              } catch (error) {
                console.error("文件上传到云端失败:", file.name, error);
                messageApi.open({
                  type: 'error',
                  content: `文件 ${file.name} 上传失败！`,
                  key: 'submitting',
                  duration: 3
                });
                return null;
              }
            }
            if (file.url) {
              return {
                uid: file.uid,
                name: file.name,
                url: file.url,
              };
            }
            return null;
          })
        );
        return processed.filter(Boolean);
      };

      // 这里同时处理了 images 和 attachments，非常好！
      const processedImages = await processFiles(values.images);
      const processedAttachments = await processFiles(values.attachments);

      const selectedSupplierInfo = suppliers.find(s => s.id === values.supplierId);
      const noticeCode = `N-${dayjs().format('YYYYMMDD')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const problemSource = values.problem_source || '';
      const cause = values.cause || '';
      const processOrTitle = values.details.process || values.details.criteria || '';
      const findingOrDesc = values.details.finding || values.details.description || '';

      const textToEmbed = `
    [Category]: ${values.category}
    [Supplier]: ${selectedSupplierInfo?.name || ''}
    [Title]: ${processOrTitle}
    [Description]: ${findingOrDesc}
    [Product]: ${problemSource}
    [RootCause]: ${cause}
`.trim();

      messageApi.open({ type: 'loading', content: '正在生成 AI 语义向量...', key: 'submitting', duration: 0 });
      const embeddingVector = await getBackendEmbedding(textToEmbed);

      const newNoticeToInsert = {
        notice_code: noticeCode,
        category: values.category,
        title: values.details.process || values.details.parameter || values.details.criteria || 'New Notice',
        assigned_supplier_id: values.supplierId,
        assigned_supplier_name: selectedSupplierInfo?.name || '',
        status: '待提交Action Plan',
        creator_id: currentUser.id,
        embedding: embeddingVector,
        sd_notice: {
          creatorId: currentUser.id,
          creator: currentUser.name,
          createTime: values.date ? values.date.format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss'),
          images: processedImages,
          attachments: processedAttachments,
          details: values.details,
          problem_source: values.problem_source || null,
          cause: values.cause || null,
        },
        history: [],
      };

      await addNotices([newNoticeToInsert]);

      messageApi.open({
        type: 'success',
        content: `提报成功！编号为：${noticeCode}`,
        key: 'submitting',
        duration: 2.5
      });

      logSystemEvent({
        category: 'DATA',
        eventType: 'SUBMIT_NOTICE_SUCCESS',
        severity: 'INFO',
        message: `Successfully submitted manual notice: ${noticeCode}`,
        userId: currentUser.id,
        meta: {
          noticeCode,
          category: values.category,
          supplierId: values.supplierId
        }
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

      await new Promise(resolve => setTimeout(resolve, 1500));

    } catch (error) {
      console.error("提交失败:", error);
      messageApi.open({
        type: 'error',
        content: `提交失败: ${error.message}`,
        key: 'submitting',
        duration: 3
      });

      logSystemEvent({
        category: 'DATA',
        eventType: 'SUBMIT_NOTICE_FAILED',
        severity: 'ERROR',
        message: `Submit notice failed: ${error.message}`,
        userId: currentUser.id,
        meta: { category: values.category, supplierId: values.supplierId }
      });

      await new Promise(resolve => setTimeout(resolve, 1500));
    } finally {
      setLoading(false);
    }
  };

  // 处理预览逻辑 (同时支持图片和视频)
  const handlePreview = async (file) => {
    // 这里的 getBase64 仅用于本地快速预览，绝不会传给后端，非常安全！
    if (!file.url && !file.preview) {
      file.preview = await getBase64(file.originFileObj);
    }

    setPreviewImage(file.url || file.preview);
    setPreviewOpen(true);
    setPreviewTitle(file.name || file.url?.substring(file.url.lastIndexOf('/') + 1) || 'Preview');

    // 记录文件类型，用于 Modal 渲染
    setFileType(file.type || (file.name?.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg'));
  };

  const beforeUpload = (file) => {
    const isImageOrVideo = file.type.startsWith('image/') || file.type.startsWith('video/');
    if (!isImageOrVideo) {
      messageApi.error('只能上传图片或视频文件!');
      return Upload.LIST_IGNORE;
    }

    // 限制 50MB (视频容易超大)
    const isLt50M = file.size / 1024 / 1024 < 50;
    if (!isLt50M) {
      messageApi.error('文件必须小于 50MB!');
      return Upload.LIST_IGNORE;
    }
    return false; // 阻止自动上传，手动控制
  };

  return (
    <div style={{ maxWidth: 800, margin: 'auto', padding: isMobile ? '12px' : '24px 0' }}>
      <Card bodyStyle={{ padding: isMobile ? '12px' : '24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={isMobile ? 5 : 4}>手工输入新的审核结果</Title>
          <Paragraph type="secondary" style={{ fontSize: isMobile ? '12px' : '14px' }}>
            请填写问题详情、选择供应商并上传必要文件
          </Paragraph>
        </div>

        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ date: dayjs() }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Form.Item name="category" label="问题类型" rules={[{ required: true, message: '请选择问题类型！' }]}>
                <Select placeholder="请选择问题类型" loading={categoriesLoading} onChange={value => setSelectedCategory(value)}>
                  {sortedCategories.map(cat => <Option key={cat} value={cat}>{cat}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
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
            <Col xs={24} md={8}>
              <Form.Item name="date" label="日期" rules={[{ required: true, message: '请选择日期！' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Card
                type="inner"
                title="历史经验标签 (可选)"
                size="small"
                loading={loadingHistory}
                style={{
                  marginBottom: 24,
                  opacity: !selectedSupplierId ? 0.5 : 1,
                  pointerEvents: !selectedSupplierId ? 'none' : 'auto'
                }}
              >
                {!selectedSupplierId && <div style={{ marginBottom: 16, color: '#faad14' }}>请先选择上面的供应商以加载数据</div>}

                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
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
                  <Col xs={24} md={12}>
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
                {!loadingHistory && Object.keys(historicalTags).length === 0 && selectedSupplierId && (
                  <Text type="secondary" style={{ fontSize: '12px' }}>暂无该供应商的历史标签数据，本次提交将作为新经验记录。</Text>
                )}
              </Card>
            </Col>

          </Row>

          {renderDynamicFields()}

          <Divider />

          <Form.Item label="证据上传 (图片/视频)">
            <Form.Item name="images" valuePropName="fileList" getValueFromEvent={(e) => Array.isArray(e) ? e : e?.fileList} noStyle>
              <Dragger
                multiple
                listType="picture"
                beforeUpload={beforeUpload}
                onPreview={handlePreview}
                accept="image/*,video/*"
              >
                <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                <p className="ant-upload-text">点击上传图片或录制视频</p>
                <p className="ant-upload-hint">支持 jpg, png, mp4 (最大50MB)</p>
              </Dragger>
            </Form.Item>
          </Form.Item>

          <Form.Item label="补充附件 (可选)">
            <Form.Item name="attachments" valuePropName="fileList" getValueFromEvent={normFile} noStyle>
              <Upload beforeUpload={() => false} multiple onPreview={handlePreview}>
                <Button icon={<UploadOutlined />} block={isMobile}>点击上传附件</Button>
              </Upload>
            </Form.Item>
            <Paragraph type="secondary" style={{ marginTop: '8px', fontSize: '12px' }}>
              提示：目前附件上传暂不支持 .txt 格式的文件。
            </Paragraph>
          </Form.Item>

          <Collapse ghost style={{ marginTop: 16 }}>
            <Panel header={<><ApiOutlined /> AI 增强设置</>} key="1">
              <Form.Item label={<><GoogleOutlined /> Gemini API Key</>} help="生成向量用于智能检索">
                <Input.Password
                  placeholder="请输入您的 Gemini API Key"
                  value={apiKey}
                  onChange={handleApiKeyChange}
                />
              </Form.Item>
              <Form.Item>
                <Checkbox checked={rememberApiKey} onChange={handleRememberChange}>
                  本地记住 API Key
                </Checkbox>
              </Form.Item>
            </Panel>
          </Collapse>

          <Form.Item style={{ marginTop: 24, textAlign: isMobile ? 'center' : 'right' }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              size="large"
              block={isMobile} // 移动端全宽按钮，更易点击
            >
              确认提交
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 统一使用这个升级版预览弹窗，删除了旧的重复弹窗 */}
      <Modal
        open={previewOpen}
        title={previewTitle}
        footer={null}
        onCancel={handleCancel}
        width={isMobile ? '95%' : 600} 
        centered
      >
        {fileType.startsWith('video/') ? (
          <video
            src={previewImage}
            controls
            style={{ width: '100%', maxHeight: '80vh' }}
            className="rounded-lg bg-black"
          />
        ) : (
          <img
            alt="预览"
            style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain' }}
            src={previewImage}
          />
        )}
      </Modal>
    </div>
  );
};

export default FileUploadPage;