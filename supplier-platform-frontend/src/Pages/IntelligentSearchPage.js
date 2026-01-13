import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Layout, Menu, Input, Button, List, Card, Typography, Spin, Avatar, Space, Tooltip, Rate, Modal, Popconfirm, Tag, Select, Form, Tabs, message } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined, FileTextOutlined, LikeOutlined, DislikeOutlined, StarOutlined, PlusOutlined, DeleteOutlined, ThunderboltOutlined, MenuUnfoldOutlined, MenuFoldOutlined, LikeFilled, DislikeFilled, SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useNotices } from '../contexts/NoticeContext';
import { NoticeDetailModal } from '../Components/notice/NoticeDetailModal';
import { useNotification } from '../contexts/NotificationContext';
import { supabase } from '../supabaseClient';
import './IntelligentSearchPage.css';

const { Title, Paragraph, Text } = Typography;
const { Sider, Content } = Layout;
const { TextArea } = Input;

// --- CSS 动画样式 (内联注入，确保 Spinner 能转动) ---
const spinAnimationStyles = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;

// --- 日志系统工具函数 ---
const getSessionId = () => {
    let sid = sessionStorage.getItem('app_session_id');
    if (!sid) {
        sid = 'sess_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        sessionStorage.setItem('app_session_id', sid);
    }
    return sid;
};

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

const logSystemEvent = async (params) => {
    const { category = 'SYSTEM', eventType, severity = 'INFO', message, email = null, userId = null, meta = {} } = params;
    try {
        const clientIp = await getClientIp();
        const sessionId = getSessionId();
        const environmentInfo = {
            ip_address: clientIp,
            session_id: sessionId,
            userAgent: navigator.userAgent,
            url: window.location.href,
            page: 'IntelligentSearchPage'
        };
        supabase.from('system_logs').insert([{
            category, event_type: eventType, severity, message, user_email: email, user_id: userId,
            metadata: { ...environmentInfo, ...meta, timestamp_client: new Date().toISOString() }
        }]).then(({ error }) => {
            if (error) console.warn("Log upload failed:", error);
        });
    } catch (e) {
        console.error("Logger exception:", e);
    }
};

const IntelligentSearchPage = () => {
    const [inputValue, setInputValue] = useState('');
    const [placeholderValue, setPlaceholderValue] = useState('');
    const [messages, setMessages] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [collapsed, setCollapsed] = useState(false);
    
    // 状态
    const [isLoading, setIsLoading] = useState(false);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    
    // 计时器状态
    const [liveTimer, setLiveTimer] = useState(0.0);
    const timerRef = useRef(null); 


    const { notices } = useNotices();
    const [detailsModal, setDetailsModal] = useState({ visible: false, notice: null });
    const { messageApi } = useNotification();
    const currentUser = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem('user'));
        } catch (e) { return null; }
    }, []);
    const messagesEndRef = useRef(null);

    const [showRatingModal, setShowRatingModal] = useState(false);
    const [currentRating, setCurrentRating] = useState(0);
    const [ratingComment, setRatingComment] = useState('');

    const navigate = useNavigate();

    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    const BACKEND_URL = isDev
        ? 'http://localhost:3001'  // 本地开发环境
        : 'https://supplier-interaction-platform-backend.vercel.app'; // Vercel 生产环境

    const MODEL_OPTIONS = [
        { label: 'Google Gemini', value: 'gemini' },
        { label: '阿里通义千问(Better)', value: 'qwen' },
    ];

    const [currentModel, setCurrentModel] = useState('qwen');
    const [showSettings, setShowSettings] = useState(false);

    const [apiKeys, setApiKeys] = useState({
        gemini: '',
        openai: '',
        qwen: '',
        openaiBaseUrl: 'https://api.openai.com/v1',
        qwenBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    });

    const LS_KEYS = {
        GEMINI: 'api_key_gemini',
        OPENAI: 'api_key_openai',
        QWEN: 'api_key_qwen',
        BASE_URL_OPENAI: 'base_url_openai',
        BASE_URL_QWEN: 'base_url_qwen',
    };

    useEffect(() => {
        setApiKeys({
            gemini: localStorage.getItem(LS_KEYS.GEMINI) || '',
            openai: localStorage.getItem(LS_KEYS.OPENAI) || '',
            qwen: localStorage.getItem(LS_KEYS.QWEN) || '',
            openaiBaseUrl: localStorage.getItem(LS_KEYS.BASE_URL_OPENAI) || 'https://api.openai.com/v1',
            qwenBaseUrl: localStorage.getItem(LS_KEYS.BASE_URL_QWEN) || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        });
    }, []);



    // --- 全局错误监听 ---
    useEffect(() => {
        if (currentUser?.role === 'Supplier') {
            navigate('/');
            return;
        }
        if (currentUser) {
            logSystemEvent({
                category: 'INTERACTION', eventType: 'PAGE_VIEW', severity: 'INFO',
                message: 'User visited Intelligent Search Page', userId: currentUser.id
            });
        }
    }, [currentUser, navigate]);

    // --- 加载会话列表 ---
    const fetchSessions = async () => {
        if (!currentUser?.id) { setIsHistoryLoading(false); return; }
        setIsHistoryLoading(true);
        try {
            const { data, error } = await supabase
                .from('chat_sessions')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setSessions(data || []);
            if (data && data.length > 0) setActiveSessionId(data[0].id);
            else handleNewChat(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsHistoryLoading(false);
        }
    };
    
    // --- TypewriterText 组件 (放在文件顶部 imports 下面) ---
const TypewriterText = ({ content, onComplete }) => {
    const [displayedText, setDisplayedText] = useState('');
    const [isTyping, setIsTyping] = useState(true);

    useEffect(() => {
        // 如果内容为空，直接结束
        if (!content) {
            setDisplayedText('');
            setIsTyping(false);
            return;
        }

        let currentIndex = 0;
        const totalLength = content.length;
        
        // 动态计算打字速度：字数越多越快，避免长文等太久
        // 基础速度 30ms，最快 10ms
        const speed = Math.max(10, 30 - Math.floor(totalLength / 100));

        const timer = setInterval(() => {
            if (currentIndex < totalLength) {
                // 每次增加一个字
                setDisplayedText(content.slice(0, currentIndex + 1));
                currentIndex++;
            } else {
                clearInterval(timer);
                setIsTyping(false);
                if (onComplete) onComplete();
            }
        }, speed);

        return () => clearInterval(timer);
    }, [content]);

    return (
        <span style={{ whiteSpace: 'pre-wrap' }}>
            {displayedText}
            {isTyping && <span className="typing-cursor"></span>}
        </span>
    );
};
    // --- 处理消息反馈 ---
    const handleFeedback = async (messageId, type) => {
        setMessages(prev => prev.map(msg =>
            msg.id === messageId
                ? { ...msg, feedback: msg.feedback === type ? null : type }
                : msg
        ));

        const currentMsg = messages.find(m => m.id === messageId);
        const newFeedback = currentMsg.feedback === type ? null : type;

        try {
            const { error } = await supabase
                .from('chat_messages')
                .update({ feedback: newFeedback })
                .eq('id', messageId);

            if (error) throw error;

            logSystemEvent({
                category: 'INTERACTION', eventType: 'MESSAGE_FEEDBACK', message: `User ${newFeedback || 'removed feedback'} for message`,
                userId: currentUser.id, meta: { message_id: messageId, feedback_type: newFeedback }
            });

        } catch (error) {
            console.error("Feedback update failed:", error);
            messageApi.error("反馈提交失败");
            setMessages(prev => prev.map(msg =>
                msg.id === messageId ? { ...msg, feedback: currentMsg.feedback } : msg
            ));
        }
    };

    // --- 渲染消息内容 (修改版) ---
    const renderMessageContent = (msg) => {
        // 【核心修改】如果正在思考，显示打点计时器，而不是简单的 Spin
        if (msg.isThinking) {
            return (
                <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* 注入 CSS 动画 */}
                    <style>{spinAnimationStyles}</style>
                    
                    {/* 自定义 Spinner */}
                    <div className="spinner" style={{
                        width: '16px', 
                        height: '16px',
                        border: '2px solid #ccc', 
                        borderTopColor: '#1890ff',
                        borderRadius: '50%', 
                        animation: 'spin 1s linear infinite'
                    }} />
                    
                    <div style={{ fontSize: '14px', color: '#666' }}>
                        AI 正在阅读文档并思考...
                        <span style={{ 
                            fontFamily: 'monospace', 
                            fontWeight: 'bold', 
                            color: '#1890ff', 
                            marginLeft: '8px',
                            display: 'inline-block',
                            minWidth: '40px'
                        }}>
                            {liveTimer.toFixed(1)}s
                        </span>
                    </div>
                </div>
            );
        }

        let content = msg.content;
        let parsedContent = null;
        let isRag = false;

        try {
            const parsed = JSON.parse(content);
            parsedContent = parsed;
            if (parsed && (parsed.type === 'rag_result' || parsed.type === 'search_result')) {
                isRag = true;
            }
        } catch (e) {
            // Not JSON
        }

        return (
            <div className="message-container-inner">
                {isRag ? (
                    <div className="rag-message-container">
                        {/* 显示智能改写后的查询（如果有） */}
                        {parsedContent.meta?.optimizedQuery && (
                            <div style={{ fontSize: 12, color: '#999', marginBottom: 8, fontStyle: 'italic' }}>
                                <ThunderboltOutlined /> 已为您优化搜索: "{parsedContent.meta.optimizedQuery}"
                            </div>
                        )}

                        <div className="rag-answer-section">
                            <Paragraph style={{ marginBottom: 12 }}>
                                <RobotOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                                <span style={{ whiteSpace: 'pre-wrap' }}>{parsedContent.answer}</span>
                            </Paragraph>
                            
                            {/* 显示最终耗时 */}
                            <div style={{ fontSize: '10px', color: '#888', marginTop: '5px', textAlign: 'right' }}>
                                ⚡ 耗时: {parsedContent.meta?.duration || parsedContent.thinkingTime || 0}s
                            </div>
                        </div>

                        {(() => {
                            const sourceIds = parsedContent.sources || [];
                            const sourceDocs = sourceIds.map(id => notices.find(n => n.id === id)).filter(Boolean);

                            if (sourceDocs.length > 0) {
                                return (
                                    <div className="rag-sources-section">
                                        <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                                            <FileTextOutlined /> 参考来源 ({sourceDocs.length})
                                        </Text>
                                        <List
                                            grid={{ gutter: 16, column: 1 }}
                                            dataSource={sourceDocs}
                                            renderItem={item => (
                                                <List.Item style={{ marginBottom: '8px' }}>
                                                    <Card
                                                        size="small"
                                                        hoverable
                                                        onClick={() => showDetailsModal(item)}
                                                        className="source-card"
                                                        bodyStyle={{ padding: '8px 12px' }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                                                <Text ellipsis strong>{item.title || '无标题'}</Text>
                                                            </div>
                                                            <Tag color="blue" style={{ marginLeft: 8 }}>{item.noticeCode || item.notice_code}</Tag>
                                                        </div>
                                                        <div style={{ marginTop: 4, fontSize: 12, color: '#888' }}>
                                                            供应商: {item.supplier?.shortCode || 'N/A'}
                                                        </div>
                                                    </Card>
                                                </List.Item>
                                            )}
                                        />
                                    </div>
                                );
                            }
                            return null;
                        })()}
                    </div>
                ) : (
                    <div>{content}</div>
                )}

                {msg.sender === 'system' && !msg.isThinking && (
                    <div className="message-feedback-actions" style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-start', gap: 8 }}>
                        <Tooltip title="回答有帮助">
                            <Button type="text" size="small" icon={msg.feedback === 'like' ? <LikeFilled style={{ color: '#1890ff' }} /> : <LikeOutlined />} onClick={() => handleFeedback(msg.id, 'like')} />
                        </Tooltip>
                        <Tooltip title="不能帮助我">
                            <Button type="text" size="small" icon={msg.feedback === 'dislike' ? <DislikeFilled style={{ color: '#ff4d4f' }} /> : <DislikeOutlined />} onClick={() => handleFeedback(msg.id, 'dislike')} />
                        </Tooltip>
                    </div>
                )}
            </div>
        );
    };

    const fetchMessages = async (sessionId) => {
        if (!sessionId) {
            setMessages([{ id: Date.now(), sender: 'system', content: '您好！我是接入了 Node.js 大脑的智能助手，请问有什么可以帮您？', feedback: null }]);
            return;
        }
        setIsHistoryLoading(true);
        try {
            const { data, error } = await supabase.from('chat_messages').select('*').eq('session_id', sessionId).order('created_at', { ascending: true });
            if (error) throw error;
            setMessages(data);
        } catch (error) {
            messageApi.error("加载消息失败");
        } finally {
            setIsHistoryLoading(false);
        }
    };

    useEffect(() => { fetchSessions(); }, [currentUser?.id]);
    useEffect(() => {
        if (activeSessionId && !isLoading) fetchMessages(activeSessionId);
        else if (!activeSessionId) setMessages([{ id: Date.now(), sender: 'system', content: '您好！我是接入了 Node.js 大脑的智能助手，请问有什么可以帮您？', feedback: null }]);
    }, [activeSessionId]);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    const handleNewChat = (activate = true) => {
        if (activate) setActiveSessionId(null);
        setMessages([{ id: Date.now(), sender: 'system', content: '您好！我是接入了 Node.js 大脑的智能助手，请问有什么可以帮您？', feedback: null }]);
    };

    const handleDeleteSession = async (e, sessionId) => {
        e.stopPropagation();
        try {
            await supabase.from('chat_sessions').delete().eq('id', sessionId);
            const newSessions = sessions.filter(s => s.id !== sessionId);
            setSessions(newSessions);
            if (activeSessionId === sessionId) {
                newSessions.length > 0 ? setActiveSessionId(newSessions[0].id) : handleNewChat(true);
            }
            messageApi.success('已删除');
        } catch (error) {
            messageApi.error('删除失败');
        }
    };

    useEffect(() => {
        const texts = ["总结电柜问题", '总结线束问题', 'Yongqing 12月的问题'];
        let index = 0;
        const intervalId = setInterval(() => {
            setPlaceholderValue(texts[index]);
            index = (index + 1) % texts.length;
        }, 5000);
        return () => clearInterval(intervalId);
    }, []);

    const handleSaveSettings = (values) => {
        localStorage.setItem(LS_KEYS.GEMINI, values.gemini);
        localStorage.setItem(LS_KEYS.OPENAI, values.openai);
        localStorage.setItem(LS_KEYS.QWEN, values.qwen);
        localStorage.setItem(LS_KEYS.BASE_URL_OPENAI, values.openaiBaseUrl);
        setApiKeys(values);
        setShowSettings(false);
        messageApi.success('配置已更新');
    };

    // --- 核心：发送消息处理 (整合版) ---
    const handleSendMessage = async () => {
        const userQuery = inputValue.trim();
        if (!userQuery || !currentUser?.id) {
            messageApi.warning('请输入问题');
            return;
        };

        setIsLoading(true);
        setLiveTimer(0); // 重置计时器

        // 1. 【新增】启动打点计时器 (每 100ms 更新一次)
        if (timerRef.current) clearInterval(timerRef.current); // 防止重复启动
        timerRef.current = setInterval(() => {
            setLiveTimer(prev => parseFloat((prev + 0.1).toFixed(1)));
        }, 100);

        const startTime = Date.now();

        // 1. Session 管理
        let currentSessionId = activeSessionId;
        if (!currentSessionId) {
            const firstTitle = userQuery.length > 8 ? `${userQuery.substring(0, 8)}...` : userQuery;
            const { data: newSession, error } = await supabase.from('chat_sessions').insert({ user_id: currentUser.id, title: firstTitle }).select().single();
            if (error) { messageApi.error('创建会话失败'); setIsLoading(false); if(timerRef.current) clearInterval(timerRef.current); return; }
            currentSessionId = newSession.id;
            setActiveSessionId(currentSessionId);
            setSessions(prev => [newSession, ...prev]);
            setMessages([]);
        }

        // 2. 乐观 UI 更新
        const tempSystemMsgId = `temp-sys-${Date.now()}`;
        setMessages(prev => [
            ...prev,
            { id: `temp-${Date.now()}`, sender: 'user', content: userQuery, timestamp: new Date().toISOString() },
            // isThinking: true 会触发 renderMessageContent 里的计时器界面
            { id: tempSystemMsgId, sender: 'system', content: '', isThinking: true }
        ]);
        setInputValue('');

        await supabase.from('chat_messages').insert({ user_id: currentUser.id, session_id: currentSessionId, sender: 'user', content: userQuery });

        // 3. 路由判断 (根据环境决定是否加 .js)
        const apiPath = isDev ? '/api/smart-search' : '/api/smart-search';
        const targetUrl = `${BACKEND_URL}${apiPath}`;

        console.log(`[Environment] isDev=${isDev}, Requesting: ${targetUrl}`);

        try {
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: userQuery,
                    model: currentModel
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `Request failed with status ${response.status}`);
            }

            const data = await response.json();

            // 4. 请求结束，停止计时
            if (timerRef.current) clearInterval(timerRef.current);

            // 构造符合前端渲染结构的数据
            const resultPayload = {
                type: "rag_result",
                answer: data.answer,
                sources: data.sources.map(doc => doc.id),
                // 优先使用后端返回的精确耗时，如果没有则计算总耗时
                thinkingTime: data.thinkingTime, 
                meta: {
                    method: 'node-hybrid',
                    model: 'qwen-plus',
                    optimizedQuery: data.optimizedQuery,
                    duration: data.thinkingTime || ((Date.now() - startTime) / 1000).toFixed(2)
                }
            };

            const resultString = JSON.stringify(resultPayload);

            const { data: savedSystemMsg } = await supabase.from('chat_messages').insert({
                user_id: currentUser.id,
                session_id: currentSessionId,
                sender: 'system',
                content: resultString,
                duration: data.thinkingTime || ((Date.now() - startTime) / 1000).toFixed(2)
            }).select().single();

            // 更新 UI：将 isThinking 设为 false，替换为真实内容
            setMessages(prev => prev.map(msg =>
                msg.id === tempSystemMsgId ? { ...savedSystemMsg } : msg
            ));

        } catch (error) {
            console.error(error);
            messageApi.error(`处理失败: ${error.message}`);
            
            // 出错也要停止计时
            if (timerRef.current) clearInterval(timerRef.current);
            
            setMessages(prev => prev.map(msg =>
                msg.id === tempSystemMsgId ? { ...msg, content: `服务出错: ${error.message}`, isThinking: false } : msg
            ));
        } finally {
            setIsLoading(false);
        }
    };

    const handleRatingSubmit = async () => {
        if (!activeSessionId) return;
        await supabase.from('chat_ratings').insert({ user_id: currentUser.id, session_id: activeSessionId, rating: currentRating, comment: ratingComment });
        messageApi.success('感谢反馈');
        setShowRatingModal(false);
    };

    const handleEndSession = () => setShowRatingModal(true);
    const handleRatingCancel = () => { setShowRatingModal(false); setCurrentRating(0); };
    const showDetailsModal = (notice) => setDetailsModal({ visible: true, notice });
    const handleDetailsCancel = () => setDetailsModal({ visible: false, notice: null });
    const handlePlaceholder = () => messageApi.info('此操作在此页面不可用。');

    return (
        <Layout className="intelligent-search-layout">
            <Sider width={260} theme="light" className="chat-sider" collapsible collapsed={collapsed} onCollapse={setCollapsed} trigger={null}>
                <div className="chat-sider-header" style={{ padding: collapsed ? '16px 8px' : '16px', textAlign: 'center' }}>
                    {collapsed ? (
                        <Tooltip title="新建对话" placement="right">
                            <Button type="primary" shape="circle" icon={<PlusOutlined />} onClick={() => handleNewChat(true)} size="large" />
                        </Tooltip>
                    ) : (
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleNewChat(true)} block className="new-chat-btn">
                            新建对话
                        </Button>
                    )}
                </div>

                <div className="chat-list-container">
                    <Menu
                        mode="inline"
                        selectedKeys={[activeSessionId]}
                        onClick={(e) => setActiveSessionId(e.key)}
                        inlineCollapsed={collapsed}
                        items={sessions.map(s => ({
                            key: s.id,
                            icon: <RobotOutlined />,
                            label: (
                                <div className="session-item">
                                    <span className="session-title">{s.title}</span>
                                    {!collapsed && (
                                        <Popconfirm title="删除对话?" onConfirm={(e) => handleDeleteSession(e, s.id)} onCancel={e => e.stopPropagation()}>
                                            <DeleteOutlined className="delete-icon" onClick={e => e.stopPropagation()} />
                                        </Popconfirm>
                                    )}
                                </div>
                            )
                        }))}
                    />
                </div>

                <div
                    onClick={() => setShowSettings(true)}
                    className="sider-footer"
                    style={{
                        padding: '16px',
                        borderTop: '1px solid #f0f0f0',
                        cursor: 'pointer',
                        color: '#666',
                        display: 'flex',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        alignItems: 'center',
                        transition: 'background 0.3s'
                    }}
                >
                    <SettingOutlined style={{ fontSize: '18px' }} />
                    {!collapsed && <span style={{ marginLeft: 10 }}>API 设置</span>}
                </div>

                <div onClick={() => setCollapsed(!collapsed)} style={{ height: '48px', lineHeight: '48px', textAlign: 'center', cursor: 'pointer', borderTop: '1px solid #f0f0f0', color: 'rgba(0, 0, 0, 0.45)', fontSize: '16px' }}>
                    {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                </div>
            </Sider>

            <Layout className="chat-content-layout">
                <div className="chat-main-header">
                    <div className="header-left">
                        <Title level={4} style={{ margin: 0 }}>AI 助手 </Title>
                        <span style={{ marginLeft: 12, color: '#999', fontSize: 12 }}>基于{notices.length}条发现项</span>
                    </div>
                    <div className="header-center">
                        <Select
                            value={currentModel}
                            onChange={setCurrentModel}
                            style={{ width: 220 }}
                            bordered={false}
                            className="model-selector"
                            options={MODEL_OPTIONS.map(m => ({
                                label: <span>{m.icon} {m.label}</span>,
                                value: m.value
                            }))}
                        />
                    </div>
                    <div className="header-right">
                        <Tooltip title="配置 API Key">
                            <Button type="text" icon={<SettingOutlined style={{ fontSize: 18 }} />} onClick={() => setShowSettings(true)} style={{ marginRight: 8 }} />
                        </Tooltip>
                        <Button icon={<StarOutlined />} onClick={handleEndSession} disabled={!activeSessionId}>评价</Button>
                    </div>
                </div>

                <Content className="chat-main-area">
                    <div className="chat-messages-viewport">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`chat-row ${msg.sender === 'user' ? 'row-user' : 'row-system'}`}>
                                <div className="avatar-container">
                                    {msg.sender === 'user' ? <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#87d068' }} /> : <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#1890ff' }} />}
                                </div>
                                <div className="chat-bubble">
                                    {renderMessageContent(msg)}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="chat-input-wrapper">
                        <div className="input-box-container">
                            <TextArea
                                placeholder={isLoading ? `正在生成回答...` : `请输入您的问题...示例: "${placeholderValue}"`}
                                autoSize={{ minRows: 1, maxRows: 6 }}
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                onPressEnter={(e) => { if (!e.shiftKey && !isLoading) { e.preventDefault(); handleSendMessage(); } }}
                                disabled={isLoading}
                                className="styled-textarea"
                            />
                            <Button type="primary" shape="circle" size="large" icon={<SendOutlined />} onClick={handleSendMessage} loading={isLoading} className="send-btn" />
                        </div>
                        <div className="footer-tips">
                            AI 生成内容可能不准确，请参考原文。Powered by Node.js RAG Engine
                        </div>
                    </div>
                </Content>
            </Layout>

            <Modal title="模型设置 & API Keys" open={showSettings} onCancel={() => setShowSettings(false)} footer={null}>
                <Form layout="vertical" initialValues={apiKeys} onFinish={handleSaveSettings}>
                    <Tabs defaultActiveKey="3" items={[
                        {
                            key: '3', label: 'Qwen (服务端)', children: (
                                <>
                                    <div style={{ marginBottom: 16, color: '#666', fontSize: 12 }}>
                                        注意：当前模式下，搜索逻辑由 Node.js 后端接管，此处的 Key 仅用于本地调试或前端直接调用模式。生产环境请在服务器 .env 中配置。
                                    </div>
                                    <Form.Item label="DashScope API Key" name="qwen">
                                        <Input.Password placeholder="sk-..." />
                                    </Form.Item>
                                </>
                            )
                        },
                        {
                            key: '1', label: 'Google Gemini', children: (
                                <Form.Item label="Gemini API Key" name="gemini"><Input.Password placeholder="AIzaSy..." /></Form.Item>
                            )
                        },
                        {
                            key: '2', label: 'OpenAI', children: (
                                <>
                                    <Form.Item label="OpenAI API Key" name="qwen"><Input.Password placeholder="sk-..." /></Form.Item>
                                    <Form.Item label="API Base URL" name="openaiBaseUrl"><Input placeholder="https://api.openai.com/v1" /></Form.Item>
                                </>
                            )
                        }
                    ]} />
                    <Button type="primary" htmlType="submit" block>保存配置</Button>
                </Form>
            </Modal>

            <NoticeDetailModal
                notice={detailsModal.notice}
                open={detailsModal.visible}
                onCancel={handleDetailsCancel}
                currentUser={currentUser}
                form={null}
                onPlanSubmit={handlePlaceholder}
                onPlanApprove={handlePlaceholder}
                showPlanRejectionModal={handlePlaceholder}
                onEvidenceSubmit={handlePlaceholder}
                onClosureApprove={handlePlaceholder}
                onApproveEvidenceItem={handlePlaceholder}
                onRejectEvidenceItem={handlePlaceholder}
                onLikeToggle={handlePlaceholder}
            />
            <Modal
                title="评价本次会话"
                open={showRatingModal}
                onOk={handleRatingSubmit}
                onCancel={handleRatingCancel}
                okText="提交评价"
                cancelText="取消"
                okButtonProps={{ disabled: currentRating === 0 && !ratingComment.trim() }}
            >
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <Paragraph>请为本次智能检索的体验打分：</Paragraph>
                    <Rate allowHalf value={currentRating} onChange={setCurrentRating} style={{ fontSize: 36, marginBottom: 20 }} />
                    <TextArea rows={3} placeholder="您可以留下具体的评论或建议（可选）" value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} />
                </div>
            </Modal>
        </Layout>
    );
};

export default IntelligentSearchPage;