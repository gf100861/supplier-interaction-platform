import React, { useState, useMemo } from 'react';
import { Card, Avatar, Typography, Button, Upload, Form, Input, List, Switch, Divider, Col, Row } from 'antd';
import { UserOutlined, UploadOutlined, LockOutlined } from '@ant-design/icons';
import { useTheme } from '../contexts/ThemeContext';
import { useNotification } from '../contexts/NotificationContext';

const { Title, Text } = Typography;

// 图片转Base64的辅助函数 (保持不变)
const getBase64 = (img, callback) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => callback(reader.result));
    reader.readAsDataURL(img);
};


const SettingsPage = () => {
    const [passwordForm] = Form.useForm();
    
    // 1. 在组件顶层调用 Hook，这是正确的做法
    const { messageApi } = useNotification();
    
    // 直接从 localStorage 获取用户信息
    const currentUser = useMemo(() => {
        const userString = localStorage.getItem('user');
        return userString ? JSON.parse(userString) : null;
    }, []);

    const { theme, toggleTheme } = useTheme();
    const [avatarLoading, setAvatarLoading] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar || '');
    
    // --- 核心修正：将 beforeUpload 函数移动到组件内部 ---
    const beforeUpload = (file) => {
        const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
        // 2. 这里不再需要调用 Hook，直接使用上面已经获取的 messageApi
        if (!isJpgOrPng) {
            messageApi.error('您只能上传 JPG/PNG 格式的图片!');
        }
        const isLt2M = file.size / 1024 / 1024 < 2;
        if (!isLt2M) {
            messageApi.error('图片大小必须小于 2MB!');
        }
        return isJpgOrPng && isLt2M;
    };

    if (!currentUser) {
        return <p>加载用户信息中...</p>;
    }

    const handleAvatarChange = (info) => {
        if (info.file.status === 'uploading') {
            setAvatarLoading(true);
            return;
        }
        if (info.file.status === 'done') {
            getBase64(info.file.originFileObj, (url) => {
                setAvatarLoading(false);
                setAvatarUrl(url);
                messageApi.success('头像更换成功！');
                // TODO: 在这里调用API将新的头像URL保存到后端
            });
        }
    };

    const onFinishChangePassword = (values) => {
        console.log('收到修改密码的表单值: ', values);
        // TODO: 在这里调用后端API来修改密码
        messageApi.success('密码修改成功！');
        passwordForm.resetFields();
    };

    return (
        <div style={{ padding: '24px' }}>
            <Row gutter={[24, 24]}>
                {/* 个人资料卡片 */}
                <Col xs={24} md={8}>
                    <Card>
                        <div style={{ textAlign: 'center' }}>
                            <Avatar size={128} src={avatarUrl} icon={<UserOutlined />} />
                            <Title level={4} style={{marginTop: 16}}>{currentUser.name}</Title>
                            <Text type="secondary">{currentUser.role}</Text>
                            <br/>
                            <Upload
                                name="avatar"
                                showUploadList={false}
                                beforeUpload={beforeUpload} // 现在这里的 beforeUpload 是定义在组件内部的函数
                                onChange={handleAvatarChange}
                                customRequest={({ file, onSuccess }) => {
                                    setTimeout(() => { onSuccess("ok"); }, 1000);
                                }}
                                accept="image/*"
                            >
                                <Button icon={<UploadOutlined />} style={{marginTop: 16}} loading={avatarLoading}>
                                    更换头像
                                </Button>
                            </Upload>
                        </div>
                    </Card>
                </Col>
                {/* 设置项卡片 */}
                <Col xs={24} md={16}>
                    <Card>
                        {/* 安全设置 */}
                        <Title level={5}><LockOutlined /> 安全设置</Title>
                        <Form
                            form={passwordForm}
                            layout="vertical"
                            onFinish={onFinishChangePassword}
                            style={{maxWidth: 400}}
                        >
                            <Form.Item name="oldPassword" label="当前密码" rules={[{ required: true, message: '请输入当前密码' }]}>
                                <Input.Password />
                            </Form.Item>
                            <Form.Item name="newPassword" label="新密码" rules={[{ required: true, message: '请输入新密码' }]}>
                                <Input.Password />
                            </Form.Item>
                            <Form.Item
                                name="confirmPassword"
                                label="确认新密码"
                                dependencies={['newPassword']}
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
                                <Input.Password />
                            </Form.Item>
                            <Form.Item>
                                <Button type="primary" htmlType="submit">修改密码</Button>
                            </Form.Item>
                        </Form>

                        <Divider />
                        
                        {/* --- 新增：通用设置区域 --- */}
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
        </div>
    );
};

export default SettingsPage;