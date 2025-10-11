import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Layout, Alert } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../contexts/NotificationContext';
import { supabase } from '../supabaseClient';

const { Title, Paragraph } = Typography;

const ResetPasswordPage = () => {
    const navigate = useNavigate();
    const { messageApi } = useNotification();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // --- 核心：处理密码更新 ---
    const onFinish = async (values) => {
        if (values.password !== values.confirm) {
            setError('两次输入的密码不一致！');
            return;
        }
        setLoading(true);
        setError(null);

        try {
            // Supabase 会自动从 URL 中处理 token
            const { error } = await supabase.auth.updateUser({ password: values.password });
            
            if (error) throw error;
            
            messageApi.success('密码重置成功！现在您可以使用新密码登录了。');
            navigate('/login'); // 重置成功后，跳转到登录页

        } catch (error) {
            setError(error.message || '密码重置失败，链接可能已过期。');
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Layout style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
            <Card style={{ width: 400 }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <Title level={3}>设置新密码</Title>
                    <Paragraph type="secondary">请输入您的新密码。</Paragraph>
                </div>
                <Form name="reset_password_form" onFinish={onFinish} layout="vertical">
                    <Form.Item name="password" label="新密码" rules={[{ required: true, message: '请输入新密码' }]}>
                        <Input.Password prefix={<LockOutlined />} placeholder="请输入新密码" size="large" />
                    </Form.Item>
                    <Form.Item name="confirm" label="确认新密码" dependencies={['password']} rules={[{ required: true, message: '请再次输入新密码' }, ({ getFieldValue }) => ({ validator(_, value) { if (!value || getFieldValue('password') === value) { return Promise.resolve(); } return Promise.reject(new Error('两次输入的密码不一致！')); } })]}>
                        <Input.Password prefix={<LockOutlined />} placeholder="请再次输入新密码" size="large" />
                    </Form.Item>
                    {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 24 }} />}
                    <Form.Item>
                        <Button type="primary" htmlType="submit" style={{ width: '100%' }} loading={loading} size="large">
                            确认并更新密码
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </Layout>
    );
};

export default ResetPasswordPage;