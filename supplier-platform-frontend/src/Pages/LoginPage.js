import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Form, Input, Button, Card, Layout, Row, Col, Typography, Avatar, Carousel, Image, Divider, Spin } from 'antd';
import { UserOutlined, LockOutlined, ApartmentOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../contexts/NotificationContext';
import './LoginPage.css';

const { Title, Paragraph, Text, Link } = Typography;

// --- 🔧 新增：定义后端 API 基础地址 ---
// 如果你在 .env 文件里配置了 REACT_APP_API_URL 就用那个，否则默认连本地 3001
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// --- 错误翻译函数 (保持不变) ---
const translateError = (errorMsg) => {
    const msg = typeof errorMsg === 'string' ? errorMsg : (errorMsg?.message || '未知错误');
    if (msg.includes('Invalid login credentials')) return '登录凭证无效或已过期，请尝试重新登录';
    if (msg.includes('User not found')) return '用户不存在';
    if (msg.includes('JWT expired')) return '登录会话已过期，请刷新页面';
    if (msg.includes('Failed to fetch')) return '无法连接到服务器，请确认后端服务(Port 3001)已启动';
    return msg;
};

// --- 工具函数：获取或生成 Session ID ---
const getSessionId = () => {
    let sid = sessionStorage.getItem('app_session_id');
    if (!sid) {
        sid = 'sess_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        sessionStorage.setItem('app_session_id', sid);
    }
    return sid;
};

// --- IP 获取 ---
let cachedIpAddress = null;
const getClientIp = async () => {
    if (cachedIpAddress) return cachedIpAddress;
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        cachedIpAddress = data.ip;
        return data.ip;
    } catch (error) {
        return 'unknown';
    }
};

// --- [API] 通用系统日志上报函数 ---
const logSystemEvent = async (params) => {
    const { 
        category = 'SYSTEM', 
        eventType, 
        severity = 'INFO', 
        message, 
        email = null, 
        userId = null,
        meta = {} 
    } = params;

    try {
        const clientIp = await getClientIp();
        const sessionId = getSessionId();

        const environmentInfo = {
            ip_address: clientIp,
            session_id: sessionId,
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            windowSize: `${window.innerWidth}x${window.innerHeight}`,
            url: window.location.href,
            referrer: document.referrer
        };

        // ✅ 修改点 1: 使用 API_BASE_URL 拼接完整路径
        await fetch(`${API_BASE_URL}/api/system-log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category,
                event_type: eventType,
                severity,
                message,
                user_email: email,
                user_id: userId,
                metadata: {
                    ...environmentInfo,
                    ...meta,
                    timestamp_client: new Date().toISOString()
                }
            })
        });

    } catch (e) {
        console.warn("Logger exception:", e);
    }
};

// --- Custom Hook: Typing Effect (保持不变) ---
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

// --- LoginCarousel (保持不变) ---
const LoginCarousel = () => {
    const [currentIndex, setCurrentIndex] = useState(0);
    
    const carouselItems = useMemo(() => [
        {
            src: '/images/Carousel1.jpg', 
            title: '协同 · 无界',
            description: '打破部门壁垒，实时追踪每一个问题的生命周期，从发现到解决。',
            bgColor: '#e0f2fe',
            cardBgColor: 'rgba(240, 249, 255, 0.7)',
        },
        {
            src: '/images/Carousel2.jpg', 
            title: '数据 · 驱动',
            description: '通过强大的数据分析，识别重复问题，量化供应商表现，驱动持续改进。',
            bgColor: '#f0fdf4',
            cardBgColor: 'rgba(240, 253, 244, 0.7)',
        },
        {
            src: '/images/Carousel3.jpg',
            title: '效率 · 提升',
            description: '自动化流程，简化沟通，让每一位SD和供应商都能聚焦于核心价值。',
            bgColor: '#f5f3ff',
            cardBgColor: 'rgba(245, 243, 255, 0.75)',
        },
    ], []);

    const currentItem = carouselItems[currentIndex];
    const typedDescription = useTypingEffect(currentItem.description);

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
                autoplaySpeed={5000}
                dots={false}
                fade
                style={{ width: '100%', maxWidth: '500px' }}
                afterChange={(current) => setCurrentIndex(current)}
            >
                {carouselItems.map((item, index) => (
                    <div key={index}>
                        <Image 
                            src={item.src} 
                            preview={false} 
                            placeholder={<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}><Spin /></div>}
                            style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)' }} 
                        />
                    </div>
                ))}
            </Carousel>
            
            <Card 
                style={{ marginTop: '-60px', width: '90%', maxWidth: '450px', zIndex: 10, backdropFilter: 'blur(10px)', backgroundColor: currentItem.cardBgColor, border: '1px solid rgba(255, 255, 255, 0.2)', transition: 'background-color 0.5s ease-in-out' }}
            >
                <Title level={3}>{currentItem.title}</Title>
                <div className="typing-text-container" style={{ position: 'relative', minHeight: '72px' }}>
                    <Paragraph type="secondary" style={{ visibility: 'hidden', marginBottom: 0 }}>{currentItem.description}</Paragraph>
                    <Paragraph type="secondary" style={{ position: 'absolute', top: 0, left: 0, width: '100%', margin: 0 }}>
                        {typedDescription}<span className="typing-cursor">|</span>
                    </Paragraph>
                </div>
            </Card>
        </div>
    );
};

// --- Main Login Page ---
const LoginPage = () => {
    const navigate = useNavigate();
    const { messageApi } = useNotification();
    const [loading, setLoading] = useState(false);
    
    // 记录页面初始化时间
    const pageInitTime = useRef(Date.now());
    // 记录表单交互
    const [isAutoFill, setIsAutoFill] = useState(false);

    useEffect(() => {
        // 全局错误监听
        const handleRuntimeError = (event) => {
            logSystemEvent({
                category: 'RUNTIME',
                eventType: 'JS_ERROR',
                severity: 'ERROR',
                message: event.message,
                meta: { filename: event.filename, lineno: event.lineno, stack: event.error?.stack }
            });
        };
        const handleUnhandledRejection = (event) => {
            logSystemEvent({
                category: 'RUNTIME',
                eventType: 'UNHANDLED_PROMISE',
                severity: 'ERROR',
                message: event.reason?.message || 'Unknown Promise Error',
                meta: { reason: JSON.stringify(event.reason) }
            });
        };

        window.addEventListener('error', handleRuntimeError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        // 页面访问埋点
        logSystemEvent({
            category: 'INTERACTION',
            eventType: 'PAGE_VIEW',
            severity: 'INFO',
            message: 'User visited Login Page'
        });

        return () => {
            window.removeEventListener('error', handleRuntimeError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, []);

    // 监听输入框变化
    const handleFormChange = (changedValues) => {
        if (Date.now() - pageInitTime.current < 500) {
            setIsAutoFill(true);
        }
    };

    const onFinish = async (values) => {
        setLoading(true);
        const submitTime = Date.now();
        const stayDuration = submitTime - pageInitTime.current;

        // 1. 记录尝试
        logSystemEvent({
            category: 'AUTH',
            eventType: 'LOGIN_ATTEMPT',
            severity: 'INFO',
            message: 'User attempting to login',
            email: values.email,
            meta: { stay_duration_ms: stayDuration, is_likely_autofill: isAutoFill }
        });

        try {
            // ✅ 修改点 2: 使用 API_BASE_URL 拼接完整路径
            // 后端对应 server.js 中的 app.post('/api/auth/login', ...)
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: values.email,
                    password: values.password
                })
            });

            const result = await response.json();

            if (!response.ok) {
                // 如果后端返回错误，抛出异常
                throw new Error(result.error || '登录失败');
            }

            // result 应该包含 { user: ..., session: ... }
            const userData = result.user;
            const apiDuration = Date.now() - submitTime;

            // 2. 记录成功
            logSystemEvent({
                category: 'AUTH',
                eventType: 'LOGIN_SUCCESS',
                severity: 'INFO',
                message: 'Login successful',
                email: values.email,
                userId: userData.id,
                meta: {
                    api_duration_ms: apiDuration,
                    role: userData.role,
                    stay_duration_ms: stayDuration
                }
            });

            messageApi.success('登录成功!');
            localStorage.setItem('user', JSON.stringify(userData));
            
            navigate('/');

        } catch (error) {
            const apiDuration = Date.now() - submitTime;
            const translatedMsg = translateError(error.message);
            messageApi.error(translatedMsg);

            // 3. 记录失败
            logSystemEvent({
                category: 'AUTH',
                eventType: 'LOGIN_FAILED',
                severity: 'WARN',
                message: translatedMsg,
                email: values.email,
                meta: {
                    original_error: error.message,
                    api_duration_ms: apiDuration,
                    stay_duration_ms: stayDuration,
                    is_likely_autofill: isAutoFill,
                }
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Row justify="center" align="middle" style={{ flex: 1 }}>
                <Col xs={0} sm={0} md={12} lg={14} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                        <Title level={2} style={{ marginTop: '16px', color: '#1f2937' }}>供应商与SD信息交换平台</Title>
                        <Paragraph type="secondary" style={{ fontSize: '16px', maxWidth: '450px' }}>
                            连接供应链的每一个环节，实现数据驱动的智能决策。
                        </Paragraph>
                    </div>
                    <div style={{ maxWidth: '500px', width: '100%' }}>
                        <LoginCarousel />
                    </div>
                </Col>

                <Col xs={22} sm={16} md={12} lg={10} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <Card style={{ width: '100%', maxWidth: 400, boxShadow: '0 4px 20px 0 rgba(0, 0, 0, 0.1)', borderRadius: '12px' }}>
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <Avatar size={64} icon={<ApartmentOutlined />} style={{ backgroundColor: '#1890ff' }} />
                            <Title level={3} style={{ marginTop: '16px' }}>欢迎回来</Title>
                            <Text type="secondary">请登录您的账户</Text>
                        </div>

                        <Form 
                            name="login_form" 
                            onFinish={onFinish} 
                            onValuesChange={handleFormChange}
                            layout="vertical" 
                            autoComplete="off"
                        >
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
                    © {new Date().getFullYear()} Volvo Construction Equipment. All Rights Reserved.
                </Text>
            </Layout.Footer>
        </Layout>
    );
};

export default LoginPage;