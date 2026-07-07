import React, { useState, useMemo } from 'react';
import { Card, Avatar, Typography, Button, Upload, Form, Input, List, Switch, Divider, Col, Row, Select, Spin, Modal, Image } from 'antd';
import { UserOutlined, UploadOutlined, LockOutlined, MessageOutlined, InboxOutlined, QrcodeOutlined, MobileOutlined } from '@ant-design/icons';
import { useTheme } from '../contexts/ThemeContext';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
// ❌ 移除 Supabase
import { supabase } from '../supabaseClient';
import { data } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { Dragger } = Upload;

// 🔧 环境配置
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
// const BACKEND_URL = isDev
//     ? 'http://localhost:3001'
//     : 'https://supplier-interaction-platform-backend.vercel.app';

const BACKEND_URL = isDev
    ? 'http://localhost:3001' 
    : window.location.origin; // 必须是这句！

const normFile = (e) => { if (Array.isArray(e)) return e; return e && e.fileList; };
const getBase64 = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => resolve(reader.result); reader.onerror = (error) => reject(error); });
// 假设这是你的小程序图片路径
const MINI_PROGRAM_IMAGE_URL = '../images/mini-program.jpg';

const SettingsPage = () => {
    const [passwordForm] = Form.useForm();
    const [feedbackForm] = Form.useForm();
    const { messageApi } = useNotification();
    const [feedbackLoading, setFeedbackLoading] = useState(false);

    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState('');
    const [previewTitle, setPreviewTitle] = useState('');

    const navigate = useNavigate();

    const [currentUser, setCurrentUser] = useState(() => {
        const userString = localStorage.getItem('user');
        return userString ? JSON.parse(userString) : null;
    });

    const { theme, toggleTheme } = useTheme();

    if (!currentUser) {
        return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
    }

    const handlePreview = async (file) => {
        if (!file.url && !file.preview && file.originFileObj) {
            file.preview = await getBase64(file.originFileObj);
        }
        setPreviewImage(file.url || file.preview);
        setPreviewOpen(true);
        setPreviewTitle(file.name || file.url.substring(file.url.lastIndexOf('/') + 1));
    };
    const handleCancelPreview = () => setPreviewOpen(false);

    // ✅ 修改：调用后端提交反馈
    const handleFeedbackSubmit = async (values) => {
        setFeedbackLoading(true);
        try {
            const processFiles = async (fileList = []) => {
                return Promise.all((fileList || []).map(async file => {
                    if (file.originFileObj && !file.url) {
                        const base64Url = await getBase64(file.originFileObj);
                        return { uid: file.uid, name: file.name, status: 'done', url: base64Url, type: file.type, size: file.size };
                    }
                    return file;
                }));
            };

            const processedImages = await processFiles(values.images);
            const processedAttachments = await processFiles(values.attachments);

            // 调用后端 API
            const response = await fetch(`${BACKEND_URL}/api/admin/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUser.id,
                    content: values.content,
                    category: values.category,
                    images: processedImages.length > 0 ? processedImages : null,
                    attachments: processedAttachments.length > 0 ? processedAttachments : null,
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Submit feedback failed');
            }

            messageApi.success('非常感谢您的宝贵意见，我们已经收到啦！');
            feedbackForm.resetFields();
        } catch (error) {
            messageApi.error(`提交失败: ${error.message}`);
        } finally {
            setFeedbackLoading(false);
        }
    };

    // ✅ 修改：调用后端修改密码
    const onFinishChangePassword = async (values) => {
        try {
            // 1. 获取当前的 Session Token
            const { data: { session } } = await supabase.auth.getSession();
            const accessToken = session?.access_token;

            if (!accessToken) {
                messageApi.error('未检测到登录状态，请重新登录');
                return;
            }

            // 2. 调用后端
            const response = await fetch(`${BACKEND_URL}/api/auth/update-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    password: values.newPassword
                })
            });

            // 3. ✅ 新增：手动解析响应并检查状态
            const result = await response.json();

            if (!response.ok) {
                // 如果后端返回错误（如 401/400/500），手动抛出错误以便进入 catch
                throw new Error(result.error || '请求失败');
            }

            // 4. 成功后的处理
            messageApi.success('密码修改成功！请重新登录。');
            passwordForm.resetFields(); // 清空表单

            // ✅ 核心修复：执行登出并跳转
            // 1. 调用 Supabase 客户端清除本地 Session
            await supabase.auth.signOut(); 
            
            // 2. 清除我们自己存的 user 信息 (如果有的话)
            localStorage.removeItem('user');

            // 3. 稍微延迟一下跳转，让用户看清提示 (可选)
            setTimeout(() => {
                navigate('/login');
            }, 1000);

        } catch (error) {
            console.error('Update password failed:', error);
            messageApi.error(`密码修改失败: ${error.message}`);
        }
    };

    return (
        <div style={{ padding: '24px' }}>
            <Row gutter={[24, 24]}>
                {/* --- 左侧栏 --- */}
                <Col xs={24} md={8}>
                    {/* 1. 个人信息卡片 */}
                    <Card style={{ marginBottom: 24 }}>
                        <div style={{ textAlign: 'center' }}>
                            <Avatar size={128} icon={<UserOutlined />} />
                            <Title level={4} style={{ marginTop: 16 }}>{currentUser.name || currentUser.username}</Title>
                            <Text type="secondary">{currentUser.role}</Text>
                        </div>
                    </Card>

                    {/* 2. [新增] 小程序访问卡片 */}
                    <Card style={{ marginBottom: 24 }} bodyStyle={{ padding: '12px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <Title level={5} style={{ margin: 0, fontSize: 16 }}>
                                    <MobileOutlined /> 移动端访问
                                </Title>
                                <Paragraph type="secondary" style={{ margin: '4px 0 0 0', fontSize: 12 }}>
                                    扫一扫，小程序立刻上岗！
                                </Paragraph>
                            </div>
                            {/* 图片展示区域 */}
                            <div style={{
                                width: 80,
                                height: 80,
                                overflow: 'hidden',
                                borderRadius: 8,
                                border: '1px solid #f0f0f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Image
                                    width={80}
                                    src={MINI_PROGRAM_IMAGE_URL}
                                    alt="小程序码"
                                    fallback="https://via.placeholder.com/80?text=QR" // 占位图
                                />
                            </div>
                        </div>
                    </Card>

                    {/* 3. 反馈表单卡片 */}
                    <Card>
                        <Title level={5}><MessageOutlined /> 反馈与建议</Title>
                        <Paragraph type="secondary">我们非常重视您的意见。</Paragraph>
                        <Form form={feedbackForm} layout="vertical" onFinish={handleFeedbackSubmit}>
                            {/* ... (表单内容保持不变) ... */}
                            <Form.Item name="category" label="反馈类型" rules={[{ required: true, message: '请选择一个反馈类型' }]}>
                                <Select placeholder="请选择反馈类型">
                                    <Option value="feature_request">功能建议</Option>
                                    <Option value="bug_report">问题报告</Option>
                                    <Option value="general_feedback">一般性反馈</Option>
                                </Select>
                            </Form.Item>
                            <Form.Item name="content" label="详细内容" rules={[{ required: true, message: '请填写您的反馈内容' }]}>
                                <TextArea rows={4} placeholder="请详细描述..." />
                            </Form.Item>

                            <Form.Item label="相关图片 (可选)">
                                <Form.Item name="images" valuePropName="fileList" getValueFromEvent={normFile} noStyle>
                                    <Dragger
                                        multiple
                                        listType="picture"
                                        beforeUpload={() => false}
                                        onPreview={handlePreview}
                                        accept="image/*"
                                        height={100} // 稍微调小一点高度，节省空间
                                    >
                                        <p className="ant-upload-drag-icon" style={{ marginBottom: 8 }}><InboxOutlined style={{ fontSize: 24 }} /></p>
                                        <p className="ant-upload-text" style={{ fontSize: 12 }}>点击或拖拽上传</p>
                                    </Dragger>
                                </Form.Item>
                            </Form.Item>

                            <Form.Item label="相关附件 (可选)">
                                <Form.Item name="attachments" valuePropName="fileList" getValueFromEvent={normFile} noStyle>
                                    <Upload beforeUpload={() => false} multiple>
                                        <Button icon={<UploadOutlined />} block>点击上传附件</Button> {/* block 让按钮撑满 */}
                                    </Upload>
                                </Form.Item>
                            </Form.Item>

                            <Form.Item>
                                <Button type="primary" htmlType="submit" loading={feedbackLoading} block>提交反馈</Button>
                            </Form.Item>
                        </Form>
                    </Card>
                </Col>

                {/* --- 右侧栏 --- */}
                <Col xs={24} md={16}>
                    <Card>
                        {/* ... (安全设置和通用设置保持不变) ... */}
                        <Title level={5}><LockOutlined /> 安全设置</Title>
                        <Form
                            form={passwordForm}
                            layout="vertical"
                            onFinish={onFinishChangePassword}
                            style={{ maxWidth: 400 }}
                        >
                            <Form.Item
                                name="newPassword"
                                label="新密码"
                                rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '密码至少需要6位' }]}
                                hasFeedback
                            >
                                <Input.Password placeholder="输入新密码" />
                            </Form.Item>
                            <Form.Item
                                name="confirmPassword"
                                label="确认新密码"
                                dependencies={['newPassword']}
                                hasFeedback
                                rules={[
                                    { required: true, message: '请确认您的新密码' },
                                    ({ getFieldValue }) => ({
                                        validator(_, value) {
                                            if (!value || getFieldValue('newPassword') === value) {
                                                return Promise.resolve();
                                            }
                                            return Promise.reject(new Error('两次输入的密码不一致!'));
                                        },
                                    }),
                                ]}
                            >
                                <Input.Password placeholder="再次输入新密码" />
                            </Form.Item>
                            <Form.Item>
                                <Button type="primary" htmlType="submit">修改密码</Button>
                            </Form.Item>
                        </Form>
                        <Divider />
                        <Title level={5}><UserOutlined /> 通用设置</Title>
                        <List>
                            <List.Item>
                                <Text>夜间模式</Text>
                                <Switch checked={theme === 'dark'} onChange={toggleTheme} />
                            </List.Item>
                        </List>
                    </Card>
                </Col>
            </Row>

            <Modal open={previewOpen} title={previewTitle} footer={null} onCancel={handleCancelPreview}>
                <img alt="预览" style={{ width: '100%' }} src={previewImage} />
            </Modal>
        </div>
    );
};


export default SettingsPage;