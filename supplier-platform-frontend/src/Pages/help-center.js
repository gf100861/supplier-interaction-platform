import React, { useState, useMemo, useEffect, useRef } from 'react';
import { message, Upload, Avatar, Layout, Menu, Typography, Card, Row, Col, Anchor, Divider, Space, Tag, Button, Breadcrumb, Steps, Input, AutoComplete, Collapse, Timeline, List, Empty } from 'antd';
import {
    UserOutlined, SolutionOutlined, FileTextOutlined,
    QuestionCircleOutlined, RobotOutlined, CloudUploadOutlined,
    TeamOutlined, DashboardOutlined, SafetyCertificateOutlined,
    ArrowLeftOutlined, RocketOutlined, BookOutlined, BulbOutlined,
    CheckCircleOutlined, LoginOutlined, DownloadOutlined,
    ShopOutlined, QrcodeOutlined, MobileOutlined, DesktopOutlined,
    ArrowRightOutlined, FileImageOutlined, SyncOutlined, FilterOutlined, CalendarOutlined,
    ApiOutlined, BugOutlined, CodeOutlined, StopOutlined, SwapOutlined, FileExcelOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
// import { supabase } from '../supabaseClient'; // 假设您有这个文件导出
import './HelpCenterPage.css';
import SystemIntroVideo from './SystemIntroVideo';
import { useNotification } from '../contexts/NotificationContext';
const { Title, Paragraph, Text } = Typography;
const { Content, Sider } = Layout;
const { Step } = Steps;

const { Dragger } = Upload;

const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const BACKEND_URL = isDev
    ? 'http://localhost:3001'  // 本地开发环境
    : 'https://supplier-interaction-platform-backend.vercel.app'; // Vercel 生产环境

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
        const apiPath = isDev ? '/api/system-log' : '/api/system-log';
        const targetUrl = `${BACKEND_URL}${apiPath}`;

        await fetch(`${targetUrl}`, {

            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
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

            })

        });

        // // Fire-and-forget
        // supabase.from('system_logs').insert([{
        //     category,
        //     event_type: eventType,
        //     severity,
        //     message,
        //     user_id: userId,
        //     metadata: {
        //         ip_address: clientIp,
        //         session_id: sessionId,
        //         userAgent: navigator.userAgent,
        //         url: window.location.href,
        //         page: 'HelpCenterPage',
        //         ...meta,
        //         timestamp_client: new Date().toISOString()
        //     }
        // }]).then(({ error }) => {
        //     if (error) console.warn("Log upload failed:", error);
        // });
    } catch (e) {
        console.error("Logger exception:", e);
    }
};


// --- 新增：美化版角色标签栏 ---
const RoleTagBar = ({ roles }) => {
    // 角色配置：颜色、图标、背景色、边框色
    const roleConfig = {
        Admin: {
            label: 'Admin',
            color: '#ff4d4f', // 红色文字
            icon: <SafetyCertificateOutlined />,
            bg: '#fff1f0',    // 浅红背景
            border: '#ffa39e' // 红色边框
        },
        SD: {
            label: 'SD',
            color: '#13c2c2', // 青色文字
            icon: <TeamOutlined />,
            bg: '#e6fffb',
            border: '#87e8de'
        },
        Manager: {
            label: 'Manager',
            color: '#1890ff', // 蓝色文字
            icon: <SolutionOutlined />,
            bg: '#e6f7ff',
            border: '#91d5ff'
        },
        Supplier: {
            label: 'Supplier',
            color: '#722ed1', // 紫色文字
            icon: <ShopOutlined />,
            bg: '#f9f0ff',
            border: '#d3adf7'
        },
    };

    return (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center' }}>
            {/* <span style={{ color: '#8c8c8c', fontSize: 13, marginRight: 8 }}>适用角色:</span> */}
            <Space size={8}>
                {roles.map(r => {
                    const config = roleConfig[r] || { label: r, color: '#595959', icon: <UserOutlined />, bg: '#f5f5f5', border: '#d9d9d9' };
                    return (
                        <Tag
                            key={r}
                            color={config.bg}
                            style={{
                                color: config.color,
                                borderColor: config.border,
                                fontSize: 12,
                                padding: '1px 10px',
                                borderRadius: '12px', // 圆角胶囊风格
                                border: `1px solid ${config.border}`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                margin: 0,
                                fontWeight: 500
                            }}
                        >
                            {config.icon}
                            {config.label}
                        </Tag>
                    );
                })}
            </Space>
        </div>
    );
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
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
            <RoleTagBar roles={['Admin', 'Manager', 'SD', 'Supplier']} />
        </div>

        <Paragraph style={{ fontSize: 16 }}>
            通知单是平台的核心对象。本节将详细介绍不同角色如何创建、处理和关闭通知单。
        </Paragraph>

        <div id="create-notice" className="section-block">
            <Title level={3}>1. 创建通知单</Title>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                <RoleTagBar roles={['Admin', 'Manager', 'SD']} />
            </div>

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
                <BulbOutlined /> <strong>提示：</strong> 创建时请准确选择“问题类型”（如 SEM[未推出], Process Audit），这决定了后续表单的字段结构。
            </div>
        </div>

        <Divider />

        <div id="handle-notice" className="section-block">
            <Title level={3}>2. 供应商处理流程</Title>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                <RoleTagBar roles={['Supplier']} />
            </div>

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

        <Divider />

        <div id="admin-actions" className="section-block">
            <Title level={3}>3. 高级管理功能</Title>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                <RoleTagBar roles={['Admin', 'Manager']} />
            </div>
            <Paragraph>
                当通知单出现异常（如填写错误、供应商变更）时，拥有高级权限的用户可以进行干预。这些操作入口位于“通知单管理”页面的列表操作栏。
            </Paragraph>
            <Row gutter={[16, 16]}>
                <Col span={24} md={12}>
                    <Card
                        size="small"
                        title={<Space><StopOutlined style={{ color: '#ff4d4f' }} /> 废除通知单 (Void)</Space>}
                        bordered={false}
                        className="guide-sub-card"
                    >
                        <Paragraph type="secondary">
                            当通知单因误操作创建或不再需要处理时，可将其标记为“已作废”。
                        </Paragraph>
                        <ul>
                            <li>作废后，该单据将变为<strong>只读状态</strong>，不可再进行任何编辑或提交。</li>
                            <li>系统会自动通知相关的供应商和创建人。</li>
                            <li>作废操作不可撤销，请谨慎操作。</li>
                        </ul>
                    </Card>
                </Col>
                <Col span={24} md={12}>
                    <Card
                        size="small"
                        title={<Space><SwapOutlined style={{ color: '#1890ff' }} /> 改派供应商 (Reassign)</Space>}
                        bordered={false}
                        className="guide-sub-card"
                    >
                        <Paragraph type="secondary">
                            如果通知单被错误地分配给了其他供应商，或者业务发生变更，可以使用此功能。
                        </Paragraph>
                        <ul>
                            <li>选择新的供应商后，系统会将单据的所有权转移。</li>
                            <li>原供应商将不再看到此单据，新供应商会收到通知。</li>
                            <li>系统会记录改派的历史轨迹，确保流程可追溯。</li>
                        </ul>
                    </Card>
                </Col>
            </Row>
        </div>
    </div>
);
const FileTransferGuideContent = () => {
    const [demoFiles, setDemoFiles] = useState([]);
    const { messageApi } = useNotification();

    // 模拟上传请求
    const handleDemoUpload = ({ file, onSuccess, onError }) => {
        // 模拟网络延迟 1.5s
        setTimeout(() => {
            const newFile = {
                uid: file.uid,
                name: file.name,
                status: 'done',
                size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
                uploadTime: new Date().toLocaleTimeString()
            };
            setDemoFiles(prev => [newFile, ...prev]);
            messageApi.success(`${file.name} 上传成功！`);
            onSuccess("ok");
        }, 1500);
    };

    const handleClearDemo = () => {
        setDemoFiles([]);
        messageApi.info('演示列表已清空');
    };

    return (
        <div className="animate-fade-in">
            <div className="hero-section">
                <Title level={2}>📂 文件互传指南</Title>
                <RoleTagBar roles={['Supplier', 'Manager', 'SD', 'Admin']} />
                <Paragraph style={{ fontSize: 14, color: '#666', maxWidth: 800 }}>
                    告别数据线和微信传输助手。通过本平台的“文件互传”功能，您可以轻松将手机拍摄的现场照片、视频直接同步到电脑端进行编辑和汇报。
                    电脑端实时接收上传的文件，并在所有已登录设备上收到通知提醒。
                </Paragraph>
            </div>

            {/* Interactive Demo Section - 真实可交互 */}
            <div className="section-block" style={{ marginTop: 32 }}>
                <Card
                    title={<span><RocketOutlined style={{ marginRight: 8, color: '#1890ff' }} />互动演示：试一试文件传输（我们不会记录您的数据！）</span>}
                    className="demo-card"
                    style={{ background: '#f9f9f9', border: '1px solid #e8e8e8' }}
                    extra={<Button size="small" onClick={handleClearDemo} disabled={demoFiles.length === 0}>清空列表</Button>}
                >
                    <Row gutter={24} align="middle">
                        {/* 左侧：模拟手机端 (发送方) */}
                        <Col xs={24} md={10} style={{ marginBottom: 16 }}>
                            <div style={{
                                height: 260,
                                background: '#fff',
                                border: '1px solid #f0f0f0',
                                borderRadius: 16,
                                padding: 20,
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, height: 40,
                                    background: '#fafafa', borderBottom: '1px solid #f0f0f0',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 12
                                }}>
                                    <MobileOutlined style={{ marginRight: 4 }} /> 模拟手机端界面
                                </div>

                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', marginTop: 30 }}>
                                    <Dragger
                                        customRequest={handleDemoUpload}
                                        showUploadList={false}
                                        style={{ border: '1px dashed #1890ff', background: '#f0f5ff' }}
                                    >
                                        <p className="ant-upload-drag-icon">
                                            <CloudUploadOutlined style={{ color: '#1890ff' }} />
                                        </p>
                                        <p className="ant-upload-text" style={{ fontSize: 14 }}>点击此处</p>
                                        <p className="ant-upload-hint" style={{ fontSize: 12 }}>选择一张图片模拟手机上传</p>
                                    </Dragger>
                                </div>
                            </div>
                        </Col>

                        {/* 中间：箭头动画 */}
                        <Col xs={0} md={2} style={{ textAlign: 'center' }}>
                            <div style={{ position: 'relative' }}>
                                <ArrowRightOutlined style={{ fontSize: 24, color: '#1890ff', opacity: demoFiles.length > 0 ? 1 : 0.2 }} />
                                {demoFiles.length > 0 && <span style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', fontSize: 12, color: '#1890ff', whiteSpace: 'nowrap' }}>同步中...</span>}
                            </div>
                        </Col>

                        {/* 右侧：模拟PC端 (接收方) */}
                        <Col xs={24} md={12}>
                            <div style={{
                                height: 260,
                                background: '#fff',
                                border: '1px solid #f0f0f0',
                                borderRadius: 8,
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                <div style={{
                                    padding: '12px 16px',
                                    borderBottom: '1px solid #f0f0f0',
                                    background: '#fafafa',
                                    borderTopLeftRadius: 8,
                                    borderTopRightRadius: 8,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <Text strong><DesktopOutlined /> PC 端接收列表</Text>
                                    <Tag color="blue">{demoFiles.length} 个文件</Tag>
                                </div>

                                <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
                                    {demoFiles.length === 0 ? (
                                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                                            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="等待文件传输..." />
                                        </div>
                                    ) : (
                                        <List
                                            size="small"
                                            dataSource={demoFiles}
                                            renderItem={item => (
                                                <List.Item className="animate-pop-in" style={{ padding: '12px 0' }}>
                                                    <List.Item.Meta
                                                        avatar={<Avatar icon={<FileImageOutlined />} style={{ backgroundColor: '#e6f7ff', color: '#1890ff' }} />}
                                                        title={<Text style={{ fontSize: 14 }}>{item.name}</Text>}
                                                        description={<Text type="secondary" style={{ fontSize: 12 }}>{item.size} • {item.uploadTime}</Text>}
                                                    />
                                                    <Tag color="success" icon={<CheckCircleOutlined />}>已同步</Tag>
                                                </List.Item>
                                            )}
                                        />
                                    )}
                                </div>
                            </div>
                        </Col>
                    </Row>
                </Card>
            </div>

            <Divider />

            {/* Step by Step Guide */}
            <div id="transfer-steps" className="section-block">
                <Title level={3}>操作流程详解</Title>
                <Steps direction="vertical" current={-1} items={[
                    {
                        title: '步骤 1: 打开左侧导航栏',
                        description: '请选择“文件互传”图标，打开文件互传功能。',
                        icon: <div className="icon-wrapper blue" style={{ width: 32, height: 32, fontSize: 16, margin: 0 }}><CloudUploadOutlined /></div>
                    },
                    {
                        title: '步骤 2: 获取二维码',
                        description: '点击“从手机上传”按钮，系统将生成一个临时的安全二维码。',
                        icon: <div className="icon-wrapper gold" style={{ width: 32, height: 32, fontSize: 16, margin: 0 }}><QrcodeOutlined /></div>
                    },
                    {
                        title: '步骤 3: 手机扫码上传',
                        description: '使用手机浏览器或微信扫描二维码，选择相册中的照片或直接拍照上传。支持自动压缩加速。',
                        icon: <div className="icon-wrapper green" style={{ width: 32, height: 32, fontSize: 16, margin: 0 }}><MobileOutlined /></div>
                    },
                    {
                        title: '步骤 4: PC端实时接收',
                        description: '无需刷新页面，文件上传完成后会自动出现在您的PC端列表中，可直接下载或关联到通知单。并在所有已登录的设备上产生通知。',
                        icon: <div className="icon-wrapper blue" style={{ width: 32, height: 32, fontSize: 16, margin: 0 }}><DesktopOutlined /></div>
                    }
                ]} />
            </div>
        </div>
    );
};

const AuditPlanGuideContent = () => (
    <div className="animate-fade-in">
        <div className="hero-section">
            <Title level={2}>📅 年度规划管理指南</Title>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <RoleTagBar roles={['Manager', 'SD']} />
            </div>
            <Paragraph style={{ fontSize: 16 }}>
                年度规划模块帮助 SD 团队制定和跟踪全年的供应商审计、QRM 会议及质量评审计划。通过可视化的矩阵视图，Manager可以轻松掌握整体进度并进行动态调整。
            </Paragraph>

        </div>

        <div id="plan-overview" className="section-block">
            <Title level={3}>1. 规划矩阵概览</Title>
            <Paragraph>
                系统提供了一个以<strong>“供应商 x 月份”</strong>为维度的全景视图。
            </Paragraph>

            <Row gutter={[16, 16]}>
                <Col span={24} md={12}>
                    <Card size="small" title="可视化追踪" bordered={false} className="guide-sub-card">
                        <ul style={{ paddingLeft: 20 }}>
                            <li><strong>颜色标识：</strong> 不同类型的事件（<Tag color="blue">审计</Tag> <Tag color="orange">QRM</Tag><Tag color="cyan">评审</Tag>）使用不同颜色区分。</li>
                            <li><strong>状态标记：</strong> <Tag color="success">已完成</Tag> 任务会高亮显示，待办任务保持默认状态。</li>
                            <li><strong>实时统计：</strong> 顶部仪表盘实时显示本年度的计划总数及完成率。</li>
                        </ul>
                    </Card>
                </Col>
                <Col span={24} md={12}>
                    <Card size="small" title="灵活筛选" bordered={false} className="guide-sub-card">
                        <p style={{ marginBottom: 8 }}><FilterOutlined /> 支持多维度筛选：</p>
                        <Space size={[0, 8]} wrap>
                            <Tag>按供应商</Tag>
                            <Tag>按计划类型</Tag>
                            <Tag>按完成状态</Tag>
                        </Space>
                        <p style={{ marginTop: 8 }}>帮助您在海量数据中快速聚焦关注点。</p>
                    </Card>
                </Col>
            </Row>
        </div>
        <div className="tip-box">
            <BulbOutlined /> <strong>提示：</strong> 您只能操作自己负责的供应商计划。如需查看/处理全部计划，请联系系统管理员提升权限。
        </div>

        <Divider />

        <div id="manage-plan" className="section-block">
            <Title level={3}>2. 计划管理与调整</Title>
            <Timeline
                mode="left"
                items={[
                    {
                        color: 'blue',
                        children: (
                            <>
                                <Text strong>新建计划</Text>
                                <Paragraph type="secondary">
                                    点击顶部的功能按钮（如“新建审计计划”），选择供应商、月份和类型即可快速创建。
                                </Paragraph>
                            </>
                        ),
                    },
                    {
                        color: 'orange',
                        children: (
                            <>
                                <Text strong>调整月份 (Reschedule)</Text>
                                <Paragraph type="secondary">
                                    计划变动？点击卡片上的 <CalendarOutlined style={{ color: '#1890ff' }} /> 图标，即可将计划移动到其他月份。支持<strong>滚动选择未来12个月</strong>，实现跨年调整。
                                </Paragraph>
                            </>
                        ),
                    },
                    {
                        color: 'green',
                        children: (
                            <>
                                <Text strong>状态更新与闭环</Text>
                                <Paragraph type="secondary">
                                    任务完成后，点击 <CheckCircleOutlined /> 标记为完成。您还可以点击 <FileTextOutlined /> 按钮直接跳转到通知单列表，查看具体的整改详情。
                                </Paragraph>
                            </>
                        ),
                    },
                ]}
            />
        </div>

        <div id="export-data" className="section-block">
            <Title level={3}>3. 数据导出</Title>
            <Paragraph>
                需要Excel视图？点击右上角的 <Button size="small" icon={<DownloadOutlined />}>导出为Excel</Button>，系统将生成格式规范的年度规划报表。
                Excel 文件包含富文本状态标识（<span style={{ color: 'green', fontWeight: 'bold' }}>[已完成]</span> / <span style={{ color: '#faad14' }}>[待办]</span>），可直接用于后续数据分析。
            </Paragraph>
        </div>
    </div>
);

const McpGuideContent = () => (
    <div className="animate-fade-in">
        <div className="hero-section">
            <Title level={2}>🔌 开发者接口 (MCP)</Title>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <RoleTagBar roles={['Admin', 'Manager']} />
                <Tag icon={<ApiOutlined />} color="#2db7f5" style={{ marginBottom: 16 }}>Beta</Tag>
            </div>
            <Paragraph style={{ fontSize: 16 }}>
                本平台支持 <strong>Model Context Protocol (MCP)</strong> 标准。通过此接口，您可以将本系统的数据（供应商、通知单、计划）安全地暴露给 Claude、ChatGPT 或自定义 AI Agent，实现自动化运维与智能分析。未来我们将开放给供应商伙伴使用，敬请期待！
            </Paragraph>
        </div>

        <div id="mcp-concept" className="section-block">
            <Title level={3}>1. 什么是 MCP？</Title>
            <Card style={{ background: '#f9f9f9' }}>
                <Row gutter={24} align="middle">
                    <Col xs={24} md={16}>
                        <Paragraph>
                            MCP (Model Context Protocol) 是一种开放标准，它像 USB 接口一样，允许 AI 模型连接到外部数据源。
                        </Paragraph>
                        <Paragraph>
                            在本系统中，我们充当 <strong>MCP Server</strong>，提供以下能力：
                        </Paragraph>
                        <ul>
                            <li><strong>Resources (资源):</strong> 直接读取供应商档案、审计计划表。</li>
                            <li><strong>Tools (工具):</strong> 允许 AI 执行搜索通知单、创建计划等操作。</li>
                            <li><strong>Prompts (提示词):</strong> 预设的业务分析模版（如“供应商月度绩效分析”）。</li>
                        </ul>
                    </Col>
                    <Col xs={24} md={8} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 64, color: '#1890ff' }}><ApiOutlined /></div>
                        <Text type="secondary">System API &lt;-&gt; MCP &lt;-&gt; AI Agent</Text>
                    </Col>
                </Row>
            </Card>
        </div>

        <Divider />

        <div id="mcp-setup" className="section-block">
            <Title level={3}>2. 如何连接？</Title>
            <Paragraph>
                要将本系统连接到您的 AI 客户端（如 Claude Desktop），请在您的 MCP Client 配置文件中添加以下服务配置：
            </Paragraph>

            <div className="code-block" style={{ background: '#1e1e1e', padding: 20, borderRadius: 8, color: '#d4d4d4', fontFamily: 'monospace', overflowX: 'auto' }}>
                <div>{`{`}</div>
                <div style={{ paddingLeft: 20 }}>{`"mcpServers": {`}</div>
                <div style={{ paddingLeft: 40 }}>{`"supplier-platform": {`}</div>
                <div style={{ paddingLeft: 60 }}>{`"command": "node",`}</div>
                <div style={{ paddingLeft: 60 }}>{`"args": ["path/to/mcp-server/index.js"],`}</div>
                <div style={{ paddingLeft: 60 }}>{`"env": {`}</div>
                <div style={{ paddingLeft: 80 }}>{`"SUPABASE_URL": "YOUR_SUPABASE_URL",`}</div>
                <div style={{ paddingLeft: 80 }}>{`"SUPABASE_KEY": "YOUR_SERVICE_ROLE_KEY"`}</div>
                <div style={{ paddingLeft: 60 }}>{`}`}</div>
                <div style={{ paddingLeft: 40 }}>{`}`}</div>
                <div style={{ paddingLeft: 20 }}>{`}`}</div>
                <div>{`}`}</div>
            </div>

            <div style={{ marginTop: 16 }}>
                <Text type="secondary">
                    <BugOutlined /> 注意：请联系管理员获取专用的 Service Role Key，并确保仅在安全环境中使用。
                </Text>
            </div>
        </div>

        <div id="mcp-capabilities" className="section-block" style={{ marginTop: 32 }}>
            <Title level={3}>3. 可用能力列表</Title>
            <List
                grid={{ gutter: 16, column: 2 }}
                dataSource={[
                    { title: 'search_suppliers', desc: '根据名称或代码搜索供应商信息', type: 'Tool' },
                    { title: 'get_audit_plan', desc: '获取指定年份的审计计划矩阵', type: 'Resource' },
                    { title: 'analyze_defects', desc: '分析特定物料的历史缺陷模式', type: 'Prompt' },
                    { title: 'create_notice', desc: '自动创建草稿状态的通知单', type: 'Tool' },
                ]}
                renderItem={item => (
                    <List.Item>
                        <Card size="small" title={<Space><CodeOutlined /> {item.title}</Space>} extra={<Tag color={item.type === 'Tool' ? 'blue' : item.type === 'Resource' ? 'green' : 'orange'}>{item.type}</Tag>}>
                            {item.desc}
                        </Card>
                    </List.Item>
                )}
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
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                    <RoleTagBar roles={['Admin', 'Manager']} />
                    <Tag icon={<ApiOutlined />} color="#2db7f5" style={{ marginBottom: 16 }}>Beta</Tag>
                </div>

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

// --- 新增：历史导入指南组件 ---
const HistoricalImportGuideContent = () => (
    <div className="animate-fade-in">
        <div className="hero-section">
            <Title level={2}>📚 历史 8D 报告归档指南</Title>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <RoleTagBar roles={['Manager', 'SD', 'Admin']} />
            </div>
            <Paragraph style={{ fontSize: 16, color: '#666', maxWidth: 800 }}>
                将散落在Sharepoint中的历史 PDF 报告或 Excel 跟踪表导入系统。利用 <strong>AI 智能识别</strong> 技术，快速构建企业质量知识库，为后续的 AI 检索提供数据基础。
            </Paragraph>
        </div>

        <div id="pdf-import" className="section-block">
            <Title level={3}>1. PDF 智能解析 (AI/OCR)</Title>
            <Paragraph>
                适用于将已签字的 8D 报告（PDF格式）数字化。系统会自动提取关键信息（如供应商、问题描述、根本原因、对策等）。
            </Paragraph>

            <Row gutter={[24, 24]}>
                <Col xs={24} md={14}>
                    <Card bordered={false} className="steps-card">
                        <Steps direction="vertical" items={[
                            {
                                title: '批量上传',
                                description: '支持一次性上传多个 PDF 文件。建议单次不超过 20 个文件以保证解析速度。',
                                icon: <CloudUploadOutlined />
                            },
                            {
                                title: 'AI 自动提取',
                                description: (
                                    <span>
                                        请您选择 <strong>大模型</strong> 或 <strong>本地 OCR解析</strong> 引擎。系统将自动识别：
                                        <Tag color="blue">零件号</Tag>
                                        <Tag color="cyan">问题描述</Tag>
                                        <Tag color="purple">根本原因 (D4)</Tag>
                                        <Tag color="geekblue">解决措施 (D5/D6)</Tag>
                                    </span>
                                ),
                                icon: <RobotOutlined />
                            },
                            {
                                title: '人工校对与归档',
                                description: '解析完成后，点击“查看/编辑”核对关键字段。确认无误后点击归档，文件将存入数据库并支持全文检索。',
                                icon: <CheckCircleOutlined />
                            }
                        ]} />
                    </Card>
                </Col>
                <Col xs={24} md={10}>
                    <Card title="💡 提高识别率的小技巧" size="small" style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}>
                        <ul style={{ paddingLeft: 20, margin: 0 }}>
                            <li style={{ marginBottom: 8 }}><strong>清晰度：</strong> 尽量上传原版导出的 PDF，若是扫描件，请确保字迹清晰、无歪斜。</li>
                            <li style={{ marginBottom: 8 }}><strong>语言：</strong> AI 对中英文混合排版的识别效果最好。</li>
                            <li><strong>隐私：</strong> 系统会自动过滤掉大部分页眉页脚的无关信息。</li>
                        </ul>
                    </Card>
                </Col>
            </Row>
        </div>

        <Divider />

        <div id="excel-import" className="section-block">
            <Title level={3}>2. Excel 存量数据迁移</Title>
            <Paragraph>
                适用于将旧的 Excel 跟踪清单（Log Sheet）批量导入系统。
            </Paragraph>
            <Card className="guide-sub-card">
                <Space align="start">
                    <FileExcelOutlined style={{ fontSize: 24, color: '#52c41a', marginTop: 4 }} />
                    <div>
                        <Text strong>操作步骤：</Text>
                        <ol>
                            <li>在“历史导入”页面切换到 <strong>Excel 批量迁移</strong> 标签页。</li>
                            <li>下载标准模板，将历史数据复制到模板中（注意保留表头）。</li>
                            <li>上传 Excel 文件，系统将自动创建“已完成”状态的通知单记录。</li>
                        </ol>
                        <div className="tip-box" style={{ marginTop: 12 }}>
                            <BulbOutlined /> <strong>注意：</strong> Excel 导入的数据通常缺乏详细的过程附件，主要用于保留追溯记录和统计分析。
                        </div>
                    </div>
                </Space>
            </Card>
        </div>
    </div>
);

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
        { q: "在批量输入actions的阶段时输入错误日期（2025/31/12）？", a: "系统会自动转换成正确的格式（建议SD请求Manager/Admin作废）" },
        { q: "为什么无法将日期重分配到下一年", a: "请在年度战略规划面板下拉选择年份，或联系系统管理员。" },
        { q: "供应商可以填写空的action plan吗", a: "支持空的action plan提交，请删除所有提交框即可" },
        { q: "为什么我的界面出现了不属于我的供应商的发现项", a: "可能是由于其他SD重分配了发现项" },
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
    { value: 'audit-plan', label: '年度审计计划管理' },
    { value: 'ai-guide', label: 'AI 智慧搜索使用' },
    { value: 'mcp-guide', label: '开发者 MCP 接口' }, // Added
    { value: 'file-transfer', label: '文件互传使用指南' },
    { value: 'faq', label: '忘记密码怎么办' },
    { value: 'history-import', label: '如何导入历史8D报告' }, // 新增
    { value: 'history-import-pdf', label: 'PDF 智能解析OCR' }, // 新增
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

    const menuItems = [
        { key: 'quick-start', icon: <RocketOutlined />, label: '快速入门' },
        { type: 'divider' },
        {
            key: 'guide',
            label: '功能指南',
            icon: <BookOutlined />,
            children: [
                { key: 'notice-guide', label: '通知单处理' },
                { key: 'audit-plan', label: '年度规划管理' },
                { key: 'file-transfer', label: '文件互传' },
                { key: 'ai-guide', label: 'AI 与搜索' },
                { key: 'history-import', label: '历史导入' }, // 新增
            ]
        },
        {
            key: 'dev',
            label: '开发者中心',
            icon: <CodeOutlined />,
            children: [
                { key: 'mcp-guide', label: 'MCP 接口集成' }, // Added
            ]
        },
        { key: 'faq', icon: <QuestionCircleOutlined />, label: '常见问题' },
    ];

    const renderContent = () => {
        switch (selectedKey) {
            case 'quick-start': return <QuickStartContent />;
            case 'notice-guide': return <NoticeGuideContent />;
            case 'audit-plan': return <AuditPlanGuideContent />;
            case 'file-transfer': return <FileTransferGuideContent />;
            case 'ai-guide': return <AiSearchGuideContent currentUser={currentUser} />;
            case 'mcp-guide': return <McpGuideContent />; // Added
            case 'history-import': return <HistoricalImportGuideContent />;
            case 'faq': return <FaqContent />;
            default: return null;
        }
    };

    const getAnchorItems = () => {
        if (selectedKey === 'notice-guide') {
            return [
                { key: 'create-notice', href: '#create-notice', title: '创建通知单' },
                { key: 'handle-notice', href: '#handle-notice', title: '供应商处理' },
                { key: 'admin-actions', href: '#admin-actions', title: '管理功能 (废除/改派)' }, // 新增锚点
            ];
        }
        if (selectedKey === 'audit-plan') {
            return [
                { key: 'plan-overview', href: '#plan-overview', title: '规划矩阵' },
                { key: 'manage-plan', href: '#manage-plan', title: '管理与调整' },
                { key: 'export-data', href: '#export-data', title: '数据导出' },
            ];
        }
        if (selectedKey === 'ai-guide') {
            return [{ key: 'ai-chat', href: '#ai-chat', title: '智能检索' }];
        }
        if (selectedKey === 'file-transfer') {
            return [{ key: 'transfer-steps', href: '#transfer-steps', title: '操作流程' }];
        }
        if (selectedKey === 'history-import') { // <--- 新增
            return [
                { key: 'pdf-import', href: '#pdf-import', title: 'PDF 智能解析' },
                { key: 'excel-import', href: '#excel-import', title: 'Excel 迁移' },
            ];
        }
        if (selectedKey === 'mcp-guide') { // Added
            return [
                { key: 'mcp-concept', href: '#mcp-concept', title: '概念介绍' },
                { key: 'mcp-setup', href: '#mcp-setup', title: '连接配置' },
                { key: 'mcp-capabilities', href: '#mcp-capabilities', title: '能力列表' },
            ];
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
        } else if (value.includes('history') || value.includes('导入') || value.includes('归档') || value.includes('pdf')) {
            // ^--- 修改这里，匹配 history, 导入, 归档, pdf
            setSelectedKey('history-import');
        } else if (value.includes('audit') || value.includes('plan') || value.includes('规划')) {
            setSelectedKey('audit-plan');
        } else if (value.includes('ai')) {
            setSelectedKey('ai-guide');
        } else if (value.includes('file') || value.includes('transfer') || value.includes('传')) {
            setSelectedKey('file-transfer');
        } else if (value.includes('mcp') || value.includes('api') || value.includes('开发')) { // Added
            setSelectedKey('mcp-guide');
        } else if (value.includes('密码') || value.includes('faq')) {
            setSelectedKey('faq');
        }

        if (currentUser) {
            logSystemEvent({
                category: 'INTERACTION',
                eventType: 'SEARCH_HELP',
                message: `User searched help: ${value}`,
                userId: currentUser.id,
                meta: { term: value }
            });
        }
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
                        defaultOpenKeys={['guide', 'dev']}
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

                {/* 内容区域 */}
                <Layout
                    style={{
                        padding: '24px',
                        flex: 1,
                        width: 0,
                        overflowX: 'hidden'
                    }}
                >
                    <Content className="help-content-wrapper">
                        <Row gutter={24}>
                            <Col
                                xs={24}
                                lg={showRightAnchor ? 19 : 24}
                                xl={showRightAnchor ? 20 : 24}
                            >
                                <div className="help-article">
                                    <Breadcrumb style={{ marginBottom: 24 }}>
                                        <Breadcrumb.Item>帮助中心</Breadcrumb.Item>
                                        <Breadcrumb.Item>{menuItems.find(i => i.key === selectedKey)?.label || menuItems.find(group => group.children?.find(child => child.key === selectedKey))?.children.find(child => child.key === selectedKey)?.label || '文档'}</Breadcrumb.Item>
                                    </Breadcrumb>
                                    {renderContent()}
                                </div>
                            </Col>

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