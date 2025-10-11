import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Form, Input, Button, Select, Card, Layout, Row, Col, Typography, Avatar, Carousel, Image } from 'antd';
import { UserOutlined, LockOutlined, ApartmentOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../contexts/NotificationContext';
import { supabase } from '../supabaseClient';
import './LoginPage.css'; // 1. 我们将需要一点自定义CSS

const { Option } = Select;
const { Title, Text, Link, Paragraph } = Typography;


// Revised useTypingEffect hook
const useTypingEffect = (textToType, speed = 80) => {
    const [typedText, setTypedText] = useState('');
    const currentIndex = useRef(0);
    const typingRef = useRef(null);

    useEffect(() => {
        // 每次 textToType 变化时，都执行清理和重新开始
        // 清理旧的定时器
        if (typingRef.current) {
            clearInterval(typingRef.current);
        }

        // 重置状态
        setTypedText('');
        currentIndex.current = 0;

        if (textToType) {
            typingRef.current = setInterval(() => {
                setTypedText(prev => {
                    // 使用局部变量确保快照
                    const currentIdx = currentIndex.current;
                    if (currentIdx < textToType.length) {
                        currentIndex.current = currentIdx + 1;
                        return prev + textToType.charAt(currentIdx);
                    } else {
                        clearInterval(typingRef.current);
                        return prev;
                    }
                });
            }, speed);
        }

        // useEffect 的清理函数，在组件卸载或依赖项改变前执行
        return () => {
            if (typingRef.current) {
                clearInterval(typingRef.current);
            }
        };
    }, [textToType, speed]); // 依赖项数组确保当 textToType 变化时重新运行

    return typedText;
};


// --- 3. 核心：全新的、动态的图片轮播组件 ---
const LoginCarousel = () => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const carouselItems = useMemo(() => [
        {
            src: 'https://images.unsplash.com/photo-1556740738-b6a63e27c4df?w=800',
            title: '协同 · 无界',
            description: '打破部门壁垒，实时追踪每一个问题的生命周期，从发现到解决。',
        },
        {
            src: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800',
            title: '数据 · 驱动',
            description: '通过强大的数据分析，识别重复问题，量化供应商表现，驱动持续改进。',
        },
        {
            src: 'https://images.unsplash.com/photo-1587560699334-cc4262406a19?w=800',
            title: '效率 · 提升',
            description: '自动化流程，简化沟通，让每一位SD和供应商都能聚焦于核心价值。',
        },
    ], []);
    const currentItem = carouselItems[currentIndex];
    const typedDescription = useTypingEffect(currentItem.description);

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '40px',
                // 动态背景色
                backgroundColor: currentItem.bgColor,
                transition: 'background-color 0.5s ease-in-out'
            }}
        >
            <Carousel
                autoplay
                dots={false}
                fade
                style={{ width: '100%', maxWidth: '500px' }}
                afterChange={(current) => setCurrentIndex(current)} // ✅ 保留
            >

                {carouselItems.map((item, index) => (
                    <div key={index}>
                        <Image
                            src={item.src}
                            preview={false}
                            style={{
                                width: '100%',
                                aspectRatio: '16 / 10',
                                objectFit: 'cover',
                                borderRadius: '12px',
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)'
                            }}
                        />
                    </div>
                ))}
            </Carousel>
            <Card
                style={{
                    marginTop: '-60px',
                    width: '90%',
                    maxWidth: '450px',
                    zIndex: 10,
                    backdropFilter: 'blur(10px)',
                    backgroundColor: 'rgba(255, 255, 255, 0.7)',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                }}
            >
                <Title level={3}>{currentItem.title}</Title>
                <Paragraph type="secondary" className="typing-text">
                    {typedDescription}
                    <span className="typing-cursor">|</span>
                </Paragraph>
            </Card>
        </div>
    );
};

const LoginPage = () => {
    const navigate = useNavigate();
    const { messageApi } = useNotification();
    const [loading, setLoading] = useState(false);

    const onFinish = async (values) => {
        setLoading(true);
        try {
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: values.email,
                password: values.password,
            });

            if (authError) throw authError;

            // --- 核心修改：登录成功后，直接从数据库获取包括角色在内的所有信息 ---
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

            messageApi.success('登录成功!');
            // 将从数据库获取的、包含正确角色的完整用户信息存入 localStorage
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
                        <LoginCarousel />
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

                        <Form name="login_form" onFinish={onFinish} initialValues={{ role: 'Supplier' }} layout="vertical">
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