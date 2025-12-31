import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Layout } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../contexts/NotificationContext';
import { supabase } from '../supabaseClient';

const { Title, Paragraph } = Typography;

const ForgotPasswordPage = () => {
    const navigate = useNavigate();
    const { messageApi } = useNotification();
    const [loading, setLoading] = useState(false);

   const onFinish = async (values) => {
    setLoading(true);
    try {
        // --- 核心修改 ---
        // 1. 使用 window.location.origin 自动获取当前域名 (localhost 或 vercel 域名)
        // 2. 补全路径为 '/update-password' (必须与你 Supabase 后台白名单一致)
        const redirectUrl = `${window.location.origin}/update-password`;
        
        console.log("正在请求重置，重定向地址为:", redirectUrl); // 方便调试

        const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
            redirectTo: redirectUrl, 
        });

        if (error) throw error;
        
        messageApi.success('密码重置邮件已发送！请检查您的收件箱...');
        navigate('/login'); 

    } catch (error) {
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