import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Layout } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../contexts/NotificationContext';
// ❌ 移除直接的 supabase 引用
// import { supabase } from '../supabaseClient'; 

const { Title, Paragraph } = Typography;

// 🔧 环境配置 (确保指向你的后端地址)
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_URL = isDev
    ? 'http://localhost:3001'
    : 'https://supplier-interaction-platform-backend.vercel.app'; 

const ForgotPasswordPage = () => {
    const navigate = useNavigate();
    const { messageApi } = useNotification();
    const [loading, setLoading] = useState(false);

    const onFinish = async (values) => {
        setLoading(true);
        try {
            // 1. 获取重定向地址 (密码重置后跳转回前端的哪个页面)
            const redirectUrl = `${window.location.origin}/update-password`;
            
            console.log("正在请求后端重置，重定向地址为:", redirectUrl);

            // 2. ✅ 调用后端 API
            const response = await fetch(`${BACKEND_URL}/api/auth/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    email: values.email, 
                    redirectTo: redirectUrl 
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '请求失败');
            }
            
            messageApi.success('密码重置邮件已发送！请检查您的收件箱...');
            
            // 稍微延迟跳转，让用户看清提示
            setTimeout(() => {
                navigate('/login');
            }, 1500);

        } catch (error) {
            console.error(error);
            messageApi.error(error.message || '发送邮件失败，请稍后重试。');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
            <Card style={{ width: 400 }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <Title level={3}>重置密码</Title>
                    <Paragraph type="secondary">请输入您的注册邮箱，我们将向您发送一封包含密码重置链接的邮件。</Paragraph>
                </div>
                <Form name="forgot_password_form" onFinish={onFinish} layout="vertical">
                    <Form.Item
                        name="email"
                        label="注册邮箱"
                        rules={[{ required: true, message: '请输入邮箱地址' }, { type: 'email', message: '请输入有效的邮箱格式' }]}
                    >
                        <Input prefix={<MailOutlined />} placeholder="请输入您的注册邮箱" size="large" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" style={{ width: '100%' }} loading={loading} size="large">
                            发送重置邮件
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </Layout>
    );
};

export default ForgotPasswordPage;