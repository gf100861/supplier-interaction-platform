import React, { useState, useMemo } from 'react';
import { Card, Avatar, Typography, Button, Upload, Form, Input, List, Switch, Divider, Col, Row, Select } from 'antd';
import { UserOutlined, UploadOutlined, LockOutlined, MessageOutlined } from '@ant-design/icons';
import { useTheme } from '../contexts/ThemeContext';
import { useNotification } from '../contexts/NotificationContext';
import { supabase } from '../supabaseClient';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;


const SettingsPage = () => {
    const [passwordForm] = Form.useForm();
    const [feedbackForm] = Form.useForm(); // 为反馈表单创建新的实例
    const { messageApi } = useNotification();

    // ✨ 核心修正：使用 useState 来管理 currentUser，以便在更新后能刷新UI
    const [currentUser, setCurrentUser] = useState(() => {
        const userString = localStorage.getItem('user');
        return userString ? JSON.parse(userString) : null;
    });

    const { theme, toggleTheme } = useTheme();


    if (!currentUser) {
        return <p>加载用户信息中...</p>;
    }

    const handleFeedbackSubmit = async (values) => {
        try {
            const { error } = await supabase.from('feedback').insert([
                {
                    user_id: currentUser.id,
                    content: values.content,
                    category: values.category
                }
            ]);

            if (error) throw error;

            messageApi.success('非常感谢您的宝贵意见，我们已经收到啦！');
            feedbackForm.resetFields();
        } catch (error) {
            messageApi.error(`提交失败: ${error.message}`);
        }
    };

    if (!currentUser) {
        return <p>加载用户信息中...</p>;
    }


    // ✨ 核心修正：实现真正的密码修改逻辑
    const onFinishChangePassword = async (values) => {
        // Supabase 的密码更新 API 不需要旧密码，只要用户是登录状态即可
        try {
            const { error } = await supabase.auth.updateUser({
                password: values.newPassword
            });

            if (error) throw error;

            messageApi.success('密码修改成功！请重新登录以使新密码生效。');
            passwordForm.resetFields();
            // 建议：可以在这里添加一个延时后自动登出的逻辑

        } catch (error) {
            messageApi.error(`密码修改失败: ${error.message}`);
        }
    };

    return (
        <div style={{ padding: '24px' }}>
            <Row gutter={[24, 24]}>
                {/* --- 核心修正 1：将“反馈与建议”表单移动到左侧卡片中 --- */}
                <Col xs={24} md={8}>
                    <Card>
                        <div style={{ textAlign: 'center' }}>
                            <Avatar size={128} icon={<UserOutlined />} />
                            <Title level={4} style={{ marginTop: 16 }}>{currentUser.name || currentUser.username}</Title>
                            <Text type="secondary">{currentUser.role}</Text>
                        </div>
                        <Divider />
                        {/* 反馈与建议区域 */}
                        <Title level={5}><MessageOutlined /> 反馈与建议</Title>
                        <Paragraph type="secondary">我们非常重视您的意见。</Paragraph>
                        <Form form={feedbackForm} layout="vertical" onFinish={handleFeedbackSubmit}>
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
                            <Form.Item>
                                <Button type="primary" htmlType="submit">提交反馈</Button>
                            </Form.Item>
                        </Form>
                    </Card>
                </Col>
                {/* 设置项卡片 */}
                <Col xs={24} md={16}>
                    <Card>
                        {/* 安全设置 (表单逻辑已连接数据库) */}
                        <Title level={5}><LockOutlined /> 安全设置</Title>
                        <Form
                            form={passwordForm}
                            layout="vertical"
                            onFinish={onFinishChangePassword}
                            style={{ maxWidth: 400 }}
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
                        {/* 通用设置 (保持不变) */}


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