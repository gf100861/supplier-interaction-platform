import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, message, Layout } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../contexts/NotificationContext';
const { Title, Text } = Typography;
const { Content } = Layout;

const UpdatePasswordPage = () => {
    const [loading, setLoading] = useState(false);
    const { messageApi } = useNotification();
    const navigate = useNavigate();

    useEffect(() => {
        // 检查用户是否已通过邮件链接登录
        // 如果是从邮件点击过来的，Supabase 会自动处理 Hash 并建立 Session
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                messageApi.warning('无效的重置链接或链接已过期，请重新申请。');
                navigate('/forgot-password');
            }
        };
        checkSession();
    }, [navigate]);

    const onFinish = async (values) => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: values.password
            });

            if (error) throw error;

            messageApi.success('密码修改成功！请使用新密码重新登录。');

            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // 登出并跳转到登录页，确保用户用新密码登录
            await supabase.auth.signOut();
            navigate('/login');

        } catch (error) {
            messageApi.error(`密码修改失败: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
            <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                <Card style={{ width: '100%', maxWidth: 400, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                        <Title level={3}>重置密码</Title>
                        <Text type="secondary">请输入您的新密码</Text>
                    </div>

                    <Form
                        name="update_password"
                        onFinish={onFinish}
                        layout="vertical"
                    >
                        <Form.Item
                            name="password"
                            label="新密码"
                            rules={[
                                { required: true, message: '请输入新密码' },
                                { min: 6, message: '密码长度至少为 6 位' }
                            ]}
                            hasFeedback
                        >
                            <Input.Password prefix={<LockOutlined />} placeholder="新密码" size="large" />
                        </Form.Item>

                        <Form.Item
                            name="confirm"
                            label="确认新密码"
                            dependencies={['password']}
                            hasFeedback
                            rules={[
                                { required: true, message: '请再次输入密码' },
                                ({ getFieldValue }) => ({
                                    validator(_, value) {
                                        if (!value || getFieldValue('password') === value) {
                                            return Promise.resolve();
                                        }
                                        return Promise.reject(new Error('两次输入的密码不一致!'));
                                    },
                                }),
                            ]}
                        >
                            <Input.Password prefix={<LockOutlined />} placeholder="确认新密码" size="large" />
                        </Form.Item>

                        <Form.Item>
                            <Button type="primary" htmlType="submit" loading={loading} block size="large">
                                修改密码
                            </Button>
                        </Form.Item>
                    </Form>
                </Card>
            </Content>
        </Layout>
    );
};

export default UpdatePasswordPage;