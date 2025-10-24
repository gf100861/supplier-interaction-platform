import React, { useState, useEffect, useMemo } from 'react';
import { Form, Input, Button, Card, Layout, Row, Col, Typography, Avatar, Carousel, Image, Divider, Spin } from 'antd';
import { UserOutlined, LockOutlined, ApartmentOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../contexts/NotificationContext';
import { supabase } from '../supabaseClient';
import './LoginPage.css'; // Make sure this CSS file is created

const { Title, Paragraph, Text, Link } = Typography;

// --- 1. Custom Hook: Typing Effect ---
const useTypingEffect = (textToType, speed = 50) => {
    const [displayedText, setDisplayedText] = useState("");
    const [index, setIndex] = useState(0);

    useEffect(() => {
        setDisplayedText("");
        setIndex(0);
    }, [textToType]);

    useEffect(() => {
        if (index < textToType.length) {
            const timeout = setTimeout(() => {
                setDisplayedText((prev) => prev + textToType.charAt(index));
                setIndex((prevIndex) => prevIndex + 1);
            }, speed);
            return () => clearTimeout(timeout);
        }
    }, [index, textToType, speed]);

    return displayedText;
};


// --- 2. Dynamic Image Carousel Component ---
const LoginCarousel = () => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [imagesLoaded, setImagesLoaded] = useState({});

    // --- ✨ 核心修正: 在 useMemo 内部为每个图片 URL 添加时间戳 ---
    const carouselItems = useMemo(() => {
        const timestamp = Date.now(); // 获取当前时间戳
        return [
            {
                src: `/images/Carousel1.jpg?t=${timestamp}`, // 附加时间戳
                title: '协同 · 无界',
                description: '打破部门壁垒，实时追踪每一个问题的生命周期，从发现到解决。',
                bgColor: '#e0f2fe',
                cardBgColor: 'rgba(240, 249, 255, 0.7)',
            },
            {
                src: `/images/Carousel2.jpg?t=${timestamp}`, // 附加时间戳
                title: '数据 · 驱动',
                description: '通过强大的数据分析，识别重复问题，量化供应商表现，驱动持续改进。',
                bgColor: '#f0fdf4',
                cardBgColor: 'rgba(240, 253, 244, 0.7)',
            },
            {
                src: `/images/Carousel3.jpg?t=${timestamp}`, // 附加时间戳
                title: '效率 · 提升',
                description: '自动化流程，简化沟通，让每一位SD和供应商都能聚焦于核心价值。',
                bgColor: '#f5f3ff',
                cardBgColor: 'rgba(245, 243, 255, 0.75)',
            },
        ];
    }, []); // 依赖项为空，时间戳在组件挂载时生成一次

    useEffect(() => {
        console.log("Starting image preloading with cache busting...");
        carouselItems.forEach((item) => {
            const img = new window.Image();
            img.src = item.src; // 使用带时间戳的 URL 进行预加载

            img.onload = () => {
                console.log(`Image loaded successfully (cache busted): ${item.src}`);
                setImagesLoaded((prevLoaded) => ({
                    ...prevLoaded,
                    [item.src]: true, // 使用带时间戳的 URL 作为 key
                }));
            };

            img.onerror = (error) => {
                console.error(`Failed to load image (cache busted): ${item.src}`, error);
            };
        });
    }, [carouselItems]); // 依赖于 carouselItems (虽然它只生成一次)

    const currentItem = carouselItems[currentIndex];
    // 检查加载状态时也使用带时间戳的 URL
    const isCurrentImageLoaded = !!imagesLoaded[currentItem.src];

    const typedDescription = useTypingEffect(
        isCurrentImageLoaded ? currentItem.description : '图片加载中...'
    );

    useEffect(() => {
        document.body.style.backgroundColor = currentItem.bgColor;
        document.body.style.transition = 'background-color 0.5s ease-in-out';
        return () => {
            document.body.style.backgroundColor = '';
            document.body.style.transition = '';
        };
    }, [currentItem]);

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <Carousel
                autoplay
                dots={false}
                fade
                style={{ width: '100%', maxWidth: '500px' }}
                afterChange={(current) => setCurrentIndex(current)}
            >
                {carouselItems.map((item, index) => (
                    <div key={index}>
                        {/* 渲染时也使用带时间戳的 URL */}
                        <Image src={item.src} preview={false} style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)' }} />
                    </div>
                ))}
            </Carousel>
            <Card style={{ marginTop: '-60px', width: '90%', maxWidth: '450px', zIndex: 10, backdropFilter: 'blur(10px)', backgroundColor: currentItem.cardBgColor, border: '1px solid rgba(255, 255, 255, 0.2)', transition: 'background-color 0.5s ease-in-out' }}>
                <Title level={3}>{currentItem.title}</Title>
                <div
                    className="typing-text-container"
                    style={{ position: 'relative', minHeight: '72px' }}
                >
                    <Paragraph type="secondary" style={{ visibility: 'hidden' }}>
                        {currentItem.description}
                    </Paragraph>
                    <Paragraph
                        type="secondary"
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                    >
                        {!isCurrentImageLoaded && <Spin size="small" />}
                        {typedDescription}
                        {/* 仅在图片加载完成后显示光标 */}
                        {isCurrentImageLoaded && <span className="typing-cursor">|</span>}
                    </Paragraph>
                </div>
            </Card>
        </div>
    );
};


// --- 3. Main Login Page Component (保持不变) ---
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

            const { data: userData, error: userError } = await supabase
                .from('users')
                .select(`*, managed_suppliers:sd_supplier_assignments(supplier:suppliers(*))`)
                .eq('id', authData.user.id)
                .single();
            if (userError) throw userError;

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
            <Row justify="center" align="middle" style={{ flex: 1 }}>
                {/* Left Side: Visuals and Branding */}
                <Col xs={0} sm={0} md={12} lg={14} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                        {/* Logo can be added back here if needed */}
                        <Title level={2} style={{ marginTop: '16px', color: '#1f2937' }}>供应商与SD信息交换平台</Title>
                        <Paragraph type="secondary" style={{ fontSize: '16px', maxWidth: '450px' }}>
                           连接供应链的每一个环节，实现数据驱动的智能决策。
                        </Paragraph>
                    </div>
                    <div style={{ maxWidth: '500px', width: '100%' }}>
                        <LoginCarousel />
                    </div>
                </Col>

                {/* Right Side: Login Form */}
                <Col xs={22} sm={16} md={12} lg={10} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <Card style={{ width: '100%', maxWidth: 400, boxShadow: '0 4px 20px 0 rgba(0, 0, 0, 0.1)', borderRadius: '12px' }}>
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <Avatar size={64} icon={<ApartmentOutlined />} style={{ backgroundColor: '#1890ff' }} />
                            <Title level={3} style={{ marginTop: '16px' }}>欢迎回来</Title>
                            <Text type="secondary">请登录您的账户</Text>
                        </div>

                        <Form name="login_form" onFinish={onFinish} layout="vertical" autoComplete="off">
                            <Form.Item label="登录邮箱" name="email" rules={[{ required: true, message: '请输入您的邮箱地址!' }, { type: 'email', message: '请输入有效的邮箱格式!' }]}>
                                <Input prefix={<UserOutlined />} placeholder="请输入注册邮箱" size="large" />
                            </Form.Item>

                            <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码!' }]}>
                                <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" size="large" />
                            </Form.Item>
                            
                            <Form.Item>
                                <div style={{ textAlign: 'right' }}>
                                    <Link href="/forgot-password" target="_blank">忘记密码？</Link>
                                </div>
                            </Form.Item>

                            <Form.Item>
                                <Button type="primary" htmlType="submit" style={{ width: '100%' }} loading={loading} size="large">登 录</Button>
                            </Form.Item>
                            
                            <div style={{ textAlign: 'center' }}>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    如遇登录问题，请联系：
                                    <Link href="mailto:louis.xin@volvo.com" style={{ fontSize: '12px', marginLeft: '4px' }}>louis.xin@volvo.com</Link>
                                </Text>
                            </div>
                        </Form>

                        <Divider style={{ margin: '16px 0' }} />

                        <div style={{ textAlign: 'center' }}>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                <Link href="/help-center" target="_blank" style={{ fontSize: '12px' }}>帮助中心</Link>
                                <Divider type="vertical" />
                                <Link href="/privacy-policy" target="_blank" style={{ fontSize: '12px' }}>隐私政策</Link>
                            </Text>
                        </div>
                    </Card>
                </Col>
            </Row>

            <Layout.Footer style={{ textAlign: 'center', background: 'transparent' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                    © {new Date().getFullYear()} Volvo Construction Equipment. All Rights Reserved. (
                    {new Date().toLocaleDateString('cn-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                    )
                </Text>
            </Layout.Footer>
        </Layout>
    );
};

export default LoginPage;