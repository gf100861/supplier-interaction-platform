import React, { useState } from 'react';
import { Form, Input, Button, Select, Card, Layout, Row, Col, Typography, Avatar } from 'antd';
import { UserOutlined, LockOutlined, ApartmentOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../contexts/NotificationContext';
import { supabase } from '../supabaseClient';

const { Option } = Select;
const { Title, Text, Link } = Typography;

// 为了让页面更美观，我们添加一个矢量插图组件
const LoginIllustration = () => (
    <svg width="100%" height="100%" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{stopColor: '#4f46e5', stopOpacity:1}} />
                <stop offset="100%" style={{stopColor: '#1e90ff', stopOpacity:1}} />
            </linearGradient>
            <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{stopColor: '#a855f7', stopOpacity:1}} />
                <stop offset="100%" style={{stopColor: '#f472b6', stopOpacity:1}} />
            </linearGradient>
        </defs>
        <rect width="600" height="600" fill="#f0f2f5" />
        <g transform="translate(300, 300)">
            <circle cx="0" cy="0" r="250" fill="url(#grad1)" opacity="0.1" />
            <circle cx="0" cy="0" r="200" fill="url(#grad2)" opacity="0.2" />
            <path d="M-150,-150 Q-100,0 -150,150 L150,150 Q100,0 150,-150 Z" fill="white" stroke="url(#grad1)" strokeWidth="4" />
            <path d="M-100,-100 Q-50,0 -100,100 L100,100 Q50,0 100,-100 Z" fill="rgba(255,255,255,0.8)" stroke="url(#grad2)" strokeWidth="3" />
            <g fill="#4f46e5">
                <rect x="-30" y="-30" width="60" height="60" rx="10" transform="rotate(45)" />
                <circle cx="-120" cy="120" r="20" />
                <circle cx="120" cy="-120" r="20" />
            </g>
        </g>
    </svg>
);


const LoginPage = () => {
    const navigate = useNavigate();
    const { messageApi } = useNotification();
    const [loading, setLoading] = useState(false);

    // 您的登录逻辑完全不变
    const onFinish = async (values) => {
        setLoading(true);
        try {
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: values.email,
                password: values.password,
            });

            if (authError) throw authError;

            const { data: userData, error: userError } = await supabase
                .from('users')
                .select(`
                    *,
                    managed_suppliers:sd_supplier_assignments (
                        supplier:suppliers (*)
                    )
                `)
                .eq('id', authData.user.id)
                .single();
            
            if (userError) throw userError;

            if (userData.role !== values.role) {
                throw new Error("凭证或角色选择不正确！");
            }
            
            messageApi.success('登录成功!');
            localStorage.setItem('user', JSON.stringify(userData));
            navigate('/');

        } catch (error) {
            messageApi.error(error.message || '登录失败，请检查您的凭证。');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Row justify="center" align="middle" style={{ minHeight: '100vh', background: '#f0f2f5' }}>
                
                {/* 左侧插图区域，仅在大屏幕上显示 */}
                <Col xs={0} sm={0} md={12} lg={14} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ maxWidth: '500px', width: '100%' }}>
                        <LoginIllustration />
                    </div>
                </Col>

                {/* 右侧登录表单区域 */}
                <Col xs={22} sm={16} md={12} lg={10} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <Card
                        style={{
                            width: '100%',
                            maxWidth: 400,
                            boxShadow: '0 4px 20px 0 rgba(0, 0, 0, 0.1)',
                            borderRadius: '12px',
                        }}
                    >
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <Avatar size={64} icon={<ApartmentOutlined />} style={{ backgroundColor: '#1890ff' }} />
                            <Title level={3} style={{ marginTop: '16px' }}>供应商与SD信息交换平台</Title>
                            <Text type="secondary">欢迎回来，请登录您的账户</Text>
                        </div>

                        <Form name="login_form" onFinish={onFinish} initialValues={{ role: 'SD' }} layout="vertical">
                            <Form.Item 
                                name="email" 
                                label="登录邮箱" 
                                rules={[{ required: true, message: '请输入您的邮箱地址!' }, { type: 'email', message: '请输入有效的邮箱格式!' }]}
                            >
                                <Input prefix={<UserOutlined />} placeholder="请输入注册邮箱" size="large" />
                            </Form.Item>

                            <Form.Item 
                                name="password" 
                                label="密码" 
                                rules={[{ required: true, message: '请输入密码!' }]}
                            >
                                <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" size="large" />
                            </Form.Item>
                            
                            <Form.Item 
                                name="role" 
                                label="登录角色" 
                                rules={[{ required: true, message: '请选择您的角色!' }]}
                            >
                                <Select placeholder="选择角色" size="large">
                                    <Option value="SD">SD</Option>
                                    <Option value="Manager">Manager</Option>
                                    <Option value="Supplier">Supplier</Option>
                                </Select>
                            </Form.Item>
                            
                            <Form.Item>
                                <Button type="primary" htmlType="submit" style={{ width: '100%' }} loading={loading} size="large">
                                    登 录
                                </Button>
                            </Form.Item>
                            
                            {/* --- 新增的联系信息 --- */}
                            <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    如遇登录、密码等问题，请联系：
                                    <Link href="mailto:louis.xin@volvo.com" style={{ fontSize: '12px', marginLeft: '4px' }}>
                                        louis.xin@volvo.com
                                    </Link>
                                </Text>
                            </div>

                        </Form>
                    </Card>
                </Col>
            </Row>
        </Layout>
    );
};

export default LoginPage;