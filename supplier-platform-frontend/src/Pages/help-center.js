import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Layout, Menu, Typography, Card, Row, Col, Anchor, Divider, Space, Tag, Button, Breadcrumb, Steps, Input, AutoComplete, Collapse, Timeline, Spin } from 'antd';
import {
    UserOutlined, SolutionOutlined, FileTextOutlined,
    QuestionCircleOutlined, RobotOutlined, CloudUploadOutlined,
    TeamOutlined, DashboardOutlined, SafetyCertificateOutlined,
    ArrowLeftOutlined, RocketOutlined, BookOutlined, BulbOutlined,
    CheckCircleOutlined, LoginOutlined, DownloadOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient'; // 假设您有这个文件导出
import './HelpCenterPage.css';
import SystemIntroVideo from './SystemIntroVideo';
const { Title, Paragraph, Text } = Typography;
const { Content, Sider } = Layout;
const { Step } = Steps;

// --- 日志系统工具函数 (复用逻辑) ---
// 如果没有 session id，生成一个
const getSessionId = () => {
    let sid = sessionStorage.getItem('app_session_id');
    if (!sid) {
        sid = 'sess_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        sessionStorage.setItem('app_session_id', sid);
    }
    return sid;
};

// 获取IP (带缓存)
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

// 简单的日志上报
const logSystemEvent = async (params) => {
    const {
        category = 'SYSTEM',
        eventType,
        severity = 'INFO',
        message,
        userId = null,
        meta = {}
    } = params;

    try {
        const clientIp = await getClientIp();
        const sessionId = getSessionId();

        // Fire-and-forget
        supabase.from('system_logs').insert([{
            category,
            event_type: eventType,
            severity,
            message,
            user_id: userId,
            metadata: {
                ip_address: clientIp,
                session_id: sessionId,
                userAgent: navigator.userAgent,
                url: window.location.href,
                page: 'HelpCenterPage',
                ...meta,
                timestamp_client: new Date().toISOString()
            }
        }]).then(({ error }) => {
            if (error) console.warn("Log upload failed:", error);
        });
    } catch (e) {
        console.error("Logger exception:", e);
    }
};

// --- 1. 子内容组件定义 ---

// 1.1 快速入门
const QuickStartContent = () => (
    <div id="quick-start" className="animate-fade-in">
        <div className="hero-section">
            <Title level={1} style={{ marginBottom: 16 }}>👋 欢迎使用供应商交互平台</Title>
            <div style={{ marginBottom: 32 }}>
                <SystemIntroVideo />
            </div>
            <Paragraph style={{ fontSize: 18, color: '#666', maxWidth: 800 }}>
                这是一个连接供应商与 SD (Supplier Development) 团队的高效协作平台，旨在实现质量问题的全流程闭环管理、数据透明化及经验共享。
            </Paragraph>
        </div>

        <Divider orientation="left"><span className="divider-title">核心价值</span></Divider>

        <Row gutter={[24, 24]}>
            <Col xs={24} md={8}>
                <Card hoverable className="feature-card" bordered={false}>
                    <div className="icon-wrapper blue"><SolutionOutlined /></div>
                    <Title level={4}>问题闭环</Title>
                    <Paragraph type="secondary">从发现问题到整改关闭的全流程在线追踪，杜绝推诿扯皮。</Paragraph>
                </Card>
            </Col>
            <Col xs={24} md={8}>
                <Card hoverable className="feature-card" bordered={false}>
                    <div className="icon-wrapper green"><RobotOutlined /></div>
                    <Title level={4}>AI 赋能</Title>
                    <Paragraph type="secondary">智能检索历史经验库，辅助决策与分析，让数据发挥价值。</Paragraph>
                </Card>
            </Col>
            <Col xs={24} md={8}>
                <Card hoverable className="feature-card" bordered={false}>
                    <div className="icon-wrapper gold"><DashboardOutlined /></div>
                    <Title level={4}>数据洞察</Title>
                    <Paragraph type="secondary">实时仪表盘与自动综合报表，随时掌控质量趋势。</Paragraph>
                </Card>
            </Col>
        </Row>

        <Divider orientation="left"><span className="divider-title">上手流程</span></Divider>

        <Card bordered={false} className="steps-card">
            <Steps current={-1} progressDot items={[
                { title: '登录系统', description: '使用分配的账号密码登录' },
                { title: '查看仪表盘', description: '了解待办事项和KPI' },
                { title: '处理通知单', description: '提交计划或审核证据' },
                { title: '查看报告', description: '导出月度/年度综合报告' },
            ]} />
        </Card>
    </div>
);

// 1.2 通知单指南
const NoticeGuideContent = () => (
    <div className="animate-fade-in">
        <Title level={2}>📝 通知单处理指南</Title>
        <Paragraph style={{ fontSize: 16 }}>
            通知单是平台的核心对象。本节将详细介绍不同角色如何创建、处理和关闭通知单。
        </Paragraph>

        <div id="create-notice" className="section-block">
            <Title level={3}>1. 创建通知单 (SD/Manager)</Title>
            <Paragraph>SD 可以通过两种方式创建通知单：</Paragraph>
            <Row gutter={[16, 16]}>
                <Col span={24} md={12}>
                    <Card size="small" title="方式 A: 手工单条创建" bordered={false} className="guide-sub-card">
                        适用于现场发现的单一问题。支持直接拍照上传，操作灵活便捷。
                    </Card>
                </Col>
                <Col span={24} md={12}>
                    <Card size="small" title="方式 B: Excel 批量导入" bordered={false} className="guide-sub-card">
                        适用于审计后的批量问题录入。请务必使用系统提供的最新模板。
                    </Card>
                </Col>
            </Row>
            <div className="tip-box">
                <BulbOutlined /> <strong>提示：</strong> 创建时请准确选择“问题类型”（如 SEM, Process Audit），这决定了后续表单的字段结构。
            </div>
        </div>

        <Divider />

        <div id="handle-notice" className="section-block">
            <Title level={3}>2. 供应商处理流程</Title>
            <Timeline
                mode="left"
                items={[
                    {
                        color: 'blue',
                        children: (
                            <>
                                <Text strong style={{ fontSize: 16 }}>步骤 A: 提交行动计划</Text>
                                <Paragraph type="secondary">
                                    收到通知后，进入详情页。针对问题填写<strong>“根本原因”、“纠正措施”、“负责人”</strong>和<strong>“截止日期”</strong>，然后点击提交。
                                    <div style={{ marginTop: 8, color: '#096dd9', fontSize: 13, background: '#e6f7ff', padding: '8px 12px', borderRadius: 6, border: '1px solid #bae7ff' }}>
                                        <DownloadOutlined style={{ marginRight: 6 }} />
                                        <strong>支持批量处理：</strong> 您可以在列表页“下载模板”，批量填写后重新导入 Action Plans。
                                    </div>
                                </Paragraph>
                            </>
                        ),
                    },
                    {
                        color: 'orange',
                        children: (
                            <>
                                <Text strong style={{ fontSize: 16 }}>等待 SD 审核</Text>
                                <Paragraph type="secondary">SD 可能会批准或驳回您的计划。如果被驳回，请根据意见修改后重新提交。</Paragraph>
                            </>
                        ),
                    },
                    {
                        color: 'green',
                        children: (
                            <>
                                <Text strong style={{ fontSize: 16 }}>步骤 B: 上传完成证据</Text>
                                <Paragraph type="secondary">
                                    计划批准后，请在截止日期前完成整改。再次进入详情页，上传<strong>整改后的照片</strong>并填写说明。
                                    <div style={{ marginTop: 8, color: '#096dd9', fontSize: 13, background: '#e6f7ff', padding: '8px 12px', borderRadius: 6, border: '1px solid #bae7ff' }}>
                                        <CloudUploadOutlined style={{ marginRight: 6 }} />
                                        <strong>支持批量处理：</strong> 系统支持批量上传整改证据文件，以及批量下载已有证据。
                                    </div>
                                </Paragraph>
                            </>
                        ),
                    },
                    {
                        dot: <CheckCircleOutlined style={{ fontSize: 16 }} />,
                        color: 'green',
                        children: <Text strong>流程结束（通知单关闭）</Text>,
                    },
                ]}
            />
        </div>
    </div>
);

// 1.3 AI 指南 (动态生动版)
const AiSearchGuideContent = () => {
    const demos = useMemo(() => [
        { q: "查询供应商A最近的质量问题...", a: "过去1星期内，供应商A共发生2起质量问题，均为‘尺寸超差’，主要原因是加工中心刀具磨损未及时更换。" },
        {
            q: "查询物料编码 10023568 在过去半年的主要缺陷模式。",
            a: "该物料在过去半年内共发生 5 次异常，主要缺陷模式为‘表面喷涂不均’（占比 60%）和‘安装孔位置度超差’（占比 40%）。"
        },
        { q: "焊接气孔问题的常见原因？", a: "历史数据显示，焊接气孔主要由：焊材受潮、气体保护不足或工件表面油污引起。建议优先检查气体流量。" },
        {
        q: "注塑件出现‘缩水’（Sink Marks）通常是什么原因？",
        a: "根据历史案例库，‘缩水’通常由以下原因引起：1. 保压压力不足或时间太短；2. 模具温度过高；3. 浇口设计过小。建议优先检查注塑工艺参数表。"
    },
    ], []);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [displayedAnswer, setDisplayedAnswer] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    useEffect(() => {
        let typingTimer;
        let switchTimer;
        const currentData = demos[currentIndex];

        setDisplayedAnswer('');
        setIsTyping(true);

        let charIndex = 0;
        const typeNextChar = () => {
            if (charIndex < currentData.a.length) {
                setDisplayedAnswer(currentData.a.substring(0, charIndex + 1));
                charIndex++;
                typingTimer = setTimeout(typeNextChar, 40);
            } else {
                setIsTyping(false);
                switchTimer = setTimeout(() => {
                    setCurrentIndex((prev) => (prev + 1) % demos.length);
                }, 1000);
            }
        };

        const startDelay = setTimeout(typeNextChar, 1000);

        return () => {
            clearTimeout(typingTimer);
            clearTimeout(switchTimer);
            clearTimeout(startDelay);
        };
    }, [currentIndex, demos]);

    return (
        <div className="animate-fade-in">
            <div className="ai-header-bg">
                <Title level={2} style={{ color: '#1f2937' }}>🤖 AI 智慧搜索</Title>
                <Paragraph style={{ fontSize: 16, color: '#4b5563' }}>
                    基于 RAG 技术的智能助手，帮您瞬间找回历史经验。
                </Paragraph>
            </div>

            <div id="ai-chat" className="section-block">
                <Title level={3}>如何使用？</Title>
                <Row gutter={24} align="middle">
                    <Col xs={24} md={14}>
                        <Paragraph>
                            点击菜单栏的 <Tag color="geekblue"><RobotOutlined /> AI 检索通知单</Tag>。您可以像和同事聊天一样提问，AI 会自动分析数据库中的所有历史记录，为您生成总结并提供来源。
                        </Paragraph>
                        <Card title="推荐提问示例" size="small" className="example-card">
                            <ul className="example-list">
                                <li>“最近一个月关于防锈油的质量问题有哪些？”</li>
                                <li>“查询供应商 A 在焊接工艺上的历史整改记录。”</li>
                                <li>“帮我总结一下 Process Audit 类问题的常见原因。”</li>
                            </ul>
                        </Card>
                    </Col>
                    <Col xs={24} md={10}>
                        <div className="ai-demo-box">
                            <div key={`q-${currentIndex}`} className="bubble user animate-pop-in">
                                {demos[currentIndex].q}
                            </div>
                            <div className="bubble ai">
                                {displayedAnswer}
                                {isTyping && <span className="typing-cursor"></span>}
                            </div>
                        </div>
                    </Col>
                </Row>
            </div>
        </div>
    );
};

// 1.4 常见问题
const FaqContent = () => {
    const faqs = [
        {
            q: "无法批量上传actions/evidence",
            a: (
                <span>
                    因为您可能使用了列表的选项造成无法批量上传，请您使用点击分组并筛选
                    <b>待提交Action Plans/待供应商关闭</b>
                    即可出现
                </span>
            )
        },
        { q: "忘记密码怎么办？", a: "在登录页面点击“忘记密码”，输入您的注册邮箱。系统会发送一封重置邮件，请点击邮件中的链接设置新密码。" },
        { q: "为什么我看不到某些菜单？", a: "菜单基于角色权限显示。供应商只能看到与自己相关的通知单；SD可以看到计划管理功能。如有疑问请联系管理员。" },
        { q: "上传文件失败？", a: "请检查文件大小（建议<10MB）和格式。目前不支持 .exe, .bat 等可执行文件。图片建议使用 jpg/png。" },
        { q: "在批量输入actions的阶段时输入错误日期（2025/31/12）？", a: "系统会自动转换成正确的格式（建议SD作废）" },
    ];
    return (
        <div className="animate-fade-in">
            <Title level={2}>❓ 常见问题 (FAQ)</Title>
            <div style={{ marginTop: 24 }}>
                <Collapse accordion defaultActiveKey={['0']} size="large" bordered={false} style={{ background: 'transparent' }}>
                    {faqs.map((faq, idx) => (
                        <Collapse.Panel
                            header={<Text strong style={{ fontSize: 16 }}>{faq.q}</Text>}
                            key={idx}
                            style={{ background: '#fff', marginBottom: 16, borderRadius: 8, border: '1px solid #f0f0f0' }}
                        >
                            <div style={{ color: '#666', paddingLeft: 24 }}>{faq.a}</div>
                        </Collapse.Panel>
                    ))}
                </Collapse>
            </div>
        </div>
    );
};

// 搜索建议选项
const searchOptions = [
    { value: 'create-notice', label: '如何创建通知单' },
    { value: 'handle-notice', label: '供应商如何提交计划' },
    { value: 'ai-guide', label: 'AI 智慧搜索使用' },
    { value: 'faq', label: '忘记密码怎么办' },
];

// --- 2. 主布局组件 ---
const HelpCenterPage = () => {
    const navigate = useNavigate();
    const [selectedKey, setSelectedKey] = useState('quick-start');

    // 获取用户信息判断是否登录
    const currentUser = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem('user'));
        } catch (e) { return null; }
    }, []);

    // 埋点：记录进入帮助中心
    useEffect(() => {
        if (currentUser) {
            logSystemEvent({
                category: 'INTERACTION',
                eventType: 'PAGE_VIEW',
                message: 'User visited Help Center',
                userId: currentUser.id
            });
        }
    }, [currentUser]);

    const menuItems = [
        { key: 'quick-start', icon: <RocketOutlined />, label: '快速入门' },
        { type: 'divider' },
        {
            key: 'guide',
            label: '功能指南',
            icon: <BookOutlined />,
            children: [
                { key: 'notice-guide', label: '通知单处理' },
                { key: 'ai-guide', label: 'AI 与搜索' },
            ]
        },
        { key: 'faq', icon: <QuestionCircleOutlined />, label: '常见问题' },
    ];

    const renderContent = () => {
        switch (selectedKey) {
            case 'quick-start': return <QuickStartContent />;
            case 'notice-guide': return <NoticeGuideContent />;
            case 'ai-guide': return <AiSearchGuideContent />;
            case 'faq': return <FaqContent />;
            default: return null;
        }
    };

    const getAnchorItems = () => {
        if (selectedKey === 'notice-guide') {
            return [
                { key: 'create-notice', href: '#create-notice', title: '创建通知单' },
                { key: 'handle-notice', href: '#handle-notice', title: '供应商处理' },
            ];
        }
        if (selectedKey === 'ai-guide') {
            return [{ key: 'ai-chat', href: '#ai-chat', title: '智能检索' }];
        }
        return [];
    };

    // 获取当前页面的锚点
    const currentAnchorItems = getAnchorItems();
    // 判断是否需要显示右侧锚点栏
    const showRightAnchor = currentAnchorItems.length > 0;

    const handleSearchSelect = (value) => {
        if (value.includes('notice') || value.includes('创建') || value.includes('提交')) {
            setSelectedKey('notice-guide');
        } else if (value.includes('ai')) {
            setSelectedKey('ai-guide');
        } else if (value.includes('密码') || value.includes('faq')) {
            setSelectedKey('faq');
        }

        // 埋点：记录搜索行为
        logSystemEvent({
            category: 'INTERACTION',
            eventType: 'SEARCH_HELP',
            message: `User searched help: ${value}`,
            userId: currentUser?.id,
            meta: { term: value }
        });
    };

    return (
        <Layout style={{ minHeight: '100vh', background: '#f8f9fa' }}>
            {/* Header */}
            <div className="help-header">
                <div className="header-left" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
                    <img src="/system-logo.png" alt="Logo" className="help-logo-img" />
                    <span className="help-app-name">帮助中心</span>
                </div>

                <div className="header-search">
                    <AutoComplete
                        style={{ width: 400 }}
                        options={searchOptions}
                        onSelect={handleSearchSelect}
                        filterOption={(inputValue, option) =>
                            option.label.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                        }
                    >
                        <Input.Search
                            size="large"
                            placeholder="搜索文档..."
                            allowClear
                        />
                    </AutoComplete>
                </div>

                <div className="header-right">
                    {currentUser ? (
                        <Button type="primary" ghost icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
                            返回系统
                        </Button>
                    ) : (
                        <Button type="primary" icon={<LoginOutlined />} onClick={() => navigate('/login')}>
                            去登录
                        </Button>
                    )}
                </div>
            </div>

            <Layout className="help-body-layout">
                {/* 左侧菜单 */}
                <Sider width={260} theme="light" className="help-sider">
                    <Menu
                        mode="inline"
                        selectedKeys={[selectedKey]}
                        onClick={({ key }) => setSelectedKey(key)}
                        items={menuItems}
                        style={{ height: '100%', borderRight: 0, padding: '16px 0' }}
                        defaultOpenKeys={['guide']}
                    />
                    <div className="help-contact-area">
                        <Card size="small" bordered={false} className="contact-card">
                            <Space direction="vertical" size={4}>
                                <Text strong><BulbOutlined /> 需要更多支持？</Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>如遇紧急问题，请联系管理员。</Text>
                                <Button type="link" size="small" style={{ paddingLeft: 0 }} href="mailto:louis.xin@volvo.com">
                                    发送邮件
                                </Button>
                            </Space>
                        </Card>
                    </div>
                </Sider>

                {/* 内容区域 - 关键修复 */}
                <Layout
                    style={{
                        padding: '24px',
                        flex: 1,       // 强制占满剩余空间
                        width: 0,      // Flexbox 技巧：防止子元素最小宽度撑破布局
                        overflowX: 'hidden' // 防止水平溢出
                    }}
                >
                    <Content className="help-content-wrapper">
                        <Row gutter={24}>
                            <Col
                                xs={24}
                                // 如果有锚点，在大屏上占 19 份；如果没有锚点，占 24 份（全宽）
                                lg={showRightAnchor ? 19 : 24}
                                xl={showRightAnchor ? 20 : 24}
                            >
                                <div className="help-article">
                                    <Breadcrumb style={{ marginBottom: 24 }}>
                                        {/* 面包屑导航占位 */}
                                        <Breadcrumb.Item>帮助中心</Breadcrumb.Item>
                                        <Breadcrumb.Item>{menuItems.find(i => i.key === selectedKey)?.label || '文档'}</Breadcrumb.Item>
                                    </Breadcrumb>
                                    {renderContent()}
                                </div>
                            </Col>

                            {/* 仅当有锚点时才渲染这一列 */}
                            {showRightAnchor && (
                                <Col xs={0} lg={5} xl={4}>
                                    <div className="help-anchor-wrapper">
                                        <Text strong style={{ marginBottom: 12, display: 'block', paddingLeft: 16 }}>本页内容</Text>
                                        <Anchor
                                            offsetTop={100}
                                            items={currentAnchorItems}
                                            targetOffset={80}
                                        />
                                    </div>
                                </Col>
                            )}
                        </Row>
                    </Content>
                </Layout>
            </Layout>
        </Layout>
    );
};

export default HelpCenterPage;