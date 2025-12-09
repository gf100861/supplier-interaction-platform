import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Layout, Menu, Input, Button, List, Card, Typography, Spin, Avatar, Space, Tooltip, Rate, Modal, Popconfirm } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined, FileTextOutlined, LikeOutlined, DislikeOutlined, StarOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useNotices } from '../contexts/NoticeContext';
import { NoticeDetailModal } from '../Components/notice/NoticeDetailModal'; 
import { useNotification } from '../contexts/NotificationContext';
import dayjs from 'dayjs';
import { supabase } from '../supabaseClient';
import './IntelligentSearchPage.css'; 

const { Title, Paragraph, Text } = Typography;
const { Sider, Content } = Layout;
const { TextArea } = Input;

// --- 日志系统工具函数 (复用自 LoginPage/OfflineSharePage) ---

// 1. Session ID 管理 (用于串联用户单次访问的操作路径)
const getSessionId = () => {
    let sid = sessionStorage.getItem('app_session_id');
    if (!sid) {
        sid = 'sess_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        sessionStorage.setItem('app_session_id', sid);
    }
    return sid;
};

// 2. IP 获取与缓存
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

// 3. 通用日志上报函数
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
            url: window.location.href,
            page: 'IntelligentSearchPage' // 标记来源页面
        };

        // Fire-and-forget
        supabase.from('system_logs').insert([{
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
        }]).then(({ error }) => {
            if (error) console.warn("Log upload failed:", error);
        });
    } catch (e) {
        console.error("Logger exception:", e);
    }
};

const IntelligentSearchPage = () => {
    const [inputValue, setInputValue] = useState('');
    const [messages, setMessages] = useState([]); // 当前对话的消息
    const [sessions, setSessions] = useState([]); // 侧边栏的会话列表
    const [activeSessionId, setActiveSessionId] = useState(null); // 当前激活的会话

    const [isLoading, setIsLoading] = useState(false); // AI回复的加载状态
    const [isHistoryLoading, setIsHistoryLoading] = useState(true); // 页面初始加载状态

    const { notices } = useNotices(); 
    const [detailsModal, setDetailsModal] = useState({ visible: false, notice: null });
    const { messageApi } = useNotification();
    const currentUser = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem('user'));
        } catch (e) { return null; }
    }, []);
    const messagesEndRef = useRef(null);

    // --- 评星弹窗 State ---
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [currentRating, setCurrentRating] = useState(0);
    const [ratingComment, setRatingComment] = useState('');

    const navigate = useNavigate();

    // --- 全局错误监听与页面访问日志 ---
    useEffect(() => {
        if (currentUser?.role === 'Supplier') {
            navigate('/'); 
            return;
        }

        // 1. 记录页面访问
        if (currentUser) {
            logSystemEvent({
                category: 'INTERACTION',
                eventType: 'PAGE_VIEW',
                severity: 'INFO',
                message: 'User visited Intelligent Search Page',
                userId: currentUser.id,
                email: currentUser.email
            });
        }

        // 2. 运行时错误监听
        const handleRuntimeError = (event) => {
            logSystemEvent({
                category: 'RUNTIME',
                eventType: 'JS_ERROR',
                severity: 'ERROR',
                message: event.message,
                userId: currentUser?.id,
                meta: { filename: event.filename, lineno: event.lineno, stack: event.error?.stack }
            });
        };
        const handleUnhandledRejection = (event) => {
            logSystemEvent({
                category: 'RUNTIME',
                eventType: 'UNHANDLED_PROMISE',
                severity: 'ERROR',
                message: event.reason?.message || 'Unknown Promise Error',
                userId: currentUser?.id,
                meta: { reason: JSON.stringify(event.reason) }
            });
        };

        window.addEventListener('error', handleRuntimeError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        return () => {
            window.removeEventListener('error', handleRuntimeError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, [currentUser, navigate]);


    // 1. --- 加载会话列表 (Sider) ---
    const fetchSessions = async () => {
        if (!currentUser?.id) {
            setIsHistoryLoading(false);
            return;
        }
        setIsHistoryLoading(true);
        try {
            const { data, error } = await supabase
                .from('chat_sessions')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setSessions(data || []);

            // 自动激活最新的会话，如果没有则保持 null
            if (data && data.length > 0) {
                setActiveSessionId(data[0].id);
            } else {
                handleNewChat(false); // 第一次加载，自动创建一个新会话（但不激活）
            }
        } catch (error) {
            messageApi.error(`加载会话列表失败: ${error.message}`);
            // 日志：加载会话失败
            logSystemEvent({
                category: 'DATA',
                eventType: 'FETCH_SESSIONS_FAILED',
                severity: 'ERROR',
                message: error.message,
                userId: currentUser?.id
            });
        } finally {
            setIsHistoryLoading(false);
        }
    };

    // 2. --- 加载选中会话的消息 (Content) ---
    const renderMessageContent = (msg) => {
        if (msg.isThinking) return <Spin size="small" />;

        let content = msg.content;
        try {
            const parsed = JSON.parse(content);
            if (parsed && parsed.type === 'search_result') {
                const resultNotices = parsed.noticeIds
                    .map(id => notices.find(n => n.id === id)) // 使用完整的 notices 列表
                    .filter(Boolean);

                return (
                    <div>
                        <Paragraph>{parsed.text}</Paragraph>
                        <List
                            size="small"
                            dataSource={resultNotices}
                            renderItem={item => (
                                <List.Item key={item.id} style={{ padding: '8px 0' }}>
                                    <List.Item.Meta
                                        avatar={<FileTextOutlined style={{ fontSize: '18px', color: '#1890ff', marginTop: '4px' }} />}
                                        title={<a onClick={() => showDetailsModal(item)}>{item.title || item.noticeCode}</a>}
                                        // --- ✨ 核心修正: 使用 .supplier.short_code 和 .creator.username ---
                                        description={`编号: ${item.noticeCode} | 供应商: ${item.supplier?.short_code || 'N/A'} | 发起人: ${item.creator?.username || 'N/A'}`}
                                    />
                                </List.Item>
                            )}
                        />
                    </div>
                );
            }
        } catch (e) {
            // 不是JSON，只是纯文本
        }
        return content; // 返回纯文本内容
    };


    // --- 2. 核心修正：fetchMessages 现在使用“消息渲染器” ---
    const fetchMessages = async (sessionId) => {
        if (!sessionId) {
            setMessages([{ id: Date.now(), sender: 'system', content: '您好！我是智能助手，请问您想查找哪方面的通知单？', feedback: null }]);
            setIsHistoryLoading(false);
            return;
        }
        setIsHistoryLoading(true);
        try {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: true });
            if (error) throw error;

            setMessages(data.map(msg => ({
                ...msg,
                content: renderMessageContent(msg) // 渲染时解析内容
            })));
        } catch (error) {
            messageApi.error(`加载聊天记录失败: ${error.message}`);
            // 日志：加载消息失败
            logSystemEvent({
                category: 'DATA',
                eventType: 'FETCH_MESSAGES_FAILED',
                severity: 'ERROR',
                message: error.message,
                userId: currentUser?.id,
                meta: { session_id: sessionId }
            });
        } finally {
            setIsHistoryLoading(false);
        }
    };

    // --- 初始加载 ---
    useEffect(() => {
        fetchSessions();
    }, [currentUser?.id]);

    // --- ✨ 核心修正: 修复竞态条件 ---
    // 仅在 activeSessionId 改变时 (用户点击Sider) 且不在加载中时，才获取消息
    useEffect(() => {
        if (activeSessionId && !isLoading) {
            fetchMessages(activeSessionId);
        } else if (!activeSessionId) {
            // 这是 "新建对话" 状态
            setMessages([{ id: Date.now(), sender: 'system', content: '您好！我是智能助手，请问您想查找哪方面的通知单？', feedback: null }]);
        }
    }, [activeSessionId]); 

    // --- ✨ 核心修正: 新增 Effect，当 notices 列表更新时，重新渲染消息内容 ---
    // 这解决了消息（含ID）先加载，而 `notices` 数据后加载导致无法显示详情的问题
    useEffect(() => {
        if (notices.length > 0) { // 仅当 notices 确实有数据时才重渲
            setMessages(prevMessages =>
                prevMessages.map(msg => ({
                    ...msg,
                    content: renderMessageContent(msg) // 重新运行渲染函数以获取最新数据
                }))
            );
        }
    }, [notices]); 

    // 滚动到底部
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // --- 3. 核心：开始一个新聊天 ---
    const handleNewChat = (activate = true) => {
        if (activate) {
            setActiveSessionId(null);
            // 日志：用户点击新建会话
            logSystemEvent({
                category: 'INTERACTION',
                eventType: 'NEW_CHAT_INITIATED',
                userId: currentUser?.id
            });
        }
        setMessages([{ id: Date.now(), sender: 'system', content: '您好！我是智能助手，请问您想查找哪方面的通知单？', feedback: null }]);
    };


    const handleDeleteSession = async (e, sessionId) => {
        e.stopPropagation(); // 阻止点击事件冒泡，防止Sider意外切换

        try {
            const { error } = await supabase
                .from('chat_sessions')
                .delete()
                .eq('id', sessionId)
                .eq('user_id', currentUser.id); // 确保用户只能删除自己的

            if (error) throw error;

            messageApi.success('对话已删除！');

            // 日志：删除会话成功
            logSystemEvent({
                category: 'INTERACTION',
                eventType: 'SESSION_DELETED',
                userId: currentUser?.id,
                meta: { session_id: sessionId }
            });

            // 立即从Sider的UI上移除
            const newSessions = sessions.filter(s => s.id !== sessionId);
            setSessions(newSessions);

            // 如果被删除的是当前激活的会话，则自动切换到新会话或欢迎页
            if (activeSessionId === sessionId) {
                if (newSessions.length > 0) {
                    setActiveSessionId(newSessions[0].id);
                } else {
                    handleNewChat(true); // 如果没有会话了，就新建一个
                }
            }

        } catch (error) {
            messageApi.error(`删除失败: ${error.message}`);
            // 日志：删除会话失败
            logSystemEvent({
                category: 'INTERACTION',
                eventType: 'SESSION_DELETE_FAILED',
                severity: 'ERROR',
                message: error.message,
                userId: currentUser?.id,
                meta: { session_id: sessionId }
            });
        }
    };

    // --- 4. 核心：发送消息（智能处理新会话） ---
    const handleSendMessage = async () => {
        const userQuery = inputValue.trim();
        if (!userQuery || !currentUser?.id) {
            messageApi.warning(!userQuery ? '请输入您的问题或关键词！' : '无法发送消息，用户未登录。');
            return;
        };

        setIsLoading(true);
        const startTime = Date.now(); // 记录开始时间

        // 日志：搜索尝试
        logSystemEvent({
            category: 'AI',
            eventType: 'SEARCH_ATTEMPT',
            message: 'User initiated a search',
            userId: currentUser.id,
            meta: { query_length: userQuery.length } // 隐私考虑，通常不直接记录原始query，只记录长度或脱敏信息
        });

        let currentSessionId = activeSessionId;
        let isNewSession = false;

        try {
            // --- 如果是新会话，先创建会话 ---
            if (!currentSessionId) {
                isNewSession = true;
                // --- ✨ 核心修正: 使用您要求的标题格式 ---
                const firstTitle = userQuery.length > 4 ? `${userQuery.substring(0, 4)}...` : userQuery;

                const { data: newSession, error: sessionError } = await supabase
                    .from('chat_sessions')
                    .insert({ user_id: currentUser.id, title: firstTitle })
                    .select()
                    .single();
                if (sessionError) throw sessionError;

                currentSessionId = newSession.id;
                setActiveSessionId(currentSessionId); // 激活新会话
                setSessions(prev => [newSession, ...prev]); // 更新Sider列表
                setMessages([]); // 清空欢迎语
            }

            // 乐观更新UI
            const optimisticUserMessage = { id: `temp-${Date.now()}`, sender: 'user', content: userQuery, timestamp: new Date().toISOString() };
            const thinkingMessageId = `temp-${Date.now()}-thinking`;
            const thinkingMessageUI = { id: thinkingMessageId, sender: 'system', content: <Spin size="small" />, isThinking: true };

            // --- ✨ 核心修正: 确保新会话也能正确显示第一条消息 ---
            setMessages(prev => isNewSession ? [optimisticUserMessage, thinkingMessageUI] : [...prev, optimisticUserMessage, thinkingMessageUI]);
            setInputValue('');

            // 1. 保存用户消息到数据库
            const { error: userSaveError } = await supabase
                .from('chat_messages')
                .insert({ user_id: currentUser.id, session_id: currentSessionId, sender: 'user', content: userQuery, timestamp: optimisticUserMessage.timestamp });
            if (userSaveError) throw userSaveError;

            // 2. --- TODO: 调用您的 AI Edge Function (这里模拟) ---
            await new Promise(resolve => setTimeout(resolve, 1500));
            const lowerCaseQuery = userQuery.toLowerCase();
            const mockResults = notices.filter(n => {
                // 将整个通知单对象（包括所有历史记录和详情）转换为一个可搜索的字符串
                const searchableText = JSON.stringify(n).toLowerCase();
                return searchableText.includes(lowerCaseQuery);
            }).slice(0, 5); 

            // 计算耗时
            const durationMs = Date.now() - startTime;

            // 日志：搜索完成（记录性能和结果数量）
            logSystemEvent({
                category: 'AI',
                eventType: 'SEARCH_COMPLETED',
                severity: 'INFO',
                message: `Search returned ${mockResults.length} results`,
                userId: currentUser.id,
                meta: { 
                    result_count: mockResults.length,
                    duration_ms: durationMs,
                    session_id: currentSessionId
                }
            });

            let systemResponseContent; // <-- 存入DB的 (将是JSON字符串)
            let systemResponseRenderableContent; // <-- 立即显示的 (将是JSX)

            if (mockResults.length > 0) {
                systemResponseRenderableContent = (
                    <div>
                        <Paragraph>根据您的描述，我找到了以下相关的通知单：</Paragraph>
                        <List
                            size="small"
                            dataSource={mockResults}
                            renderItem={item => (
                                <List.Item key={item.id} style={{ padding: '8px 0' }}>
                                    <List.Item.Meta
                                        avatar={<FileTextOutlined style={{ fontSize: '18px', color: '#1890ff', marginTop: '4px' }} />}
                                        title={<a onClick={() => showDetailsModal(item)}>{item.title || item.noticeCode}</a>}
                                        description={`编号: ${item.noticeCode} | 供应商: ${item?.supplier?.shortCode}`}
                                    />
                                </List.Item>
                            )}
                        />
                    </div>
                );
                const contentForDB = {
                    type: "search_result",
                    text: "根据您的描述，我找到了以下相关的通知单：",
                    noticeIds: mockResults.map(n => n.id) // 只存储ID
                };
                systemResponseContent = JSON.stringify(contentForDB); // 转换为字符串存入DB
            } else {
                systemResponseRenderableContent = "抱歉，未能找到相关通知单。";
                systemResponseContent = systemResponseRenderableContent; // 纯文本直接存
            }


            // 3. 保存系统消息到数据库
            const { data: savedSystemData, error: systemSaveError } = await supabase
                .from('chat_messages')
                .insert({ user_id: currentUser.id, session_id: currentSessionId, sender: 'system', content: systemResponseContent })
                .select()
                .single();
            if (systemSaveError) throw systemSaveError;

            // 4. 更新UI，用真实数据替换“思考中”
            setMessages(prev => prev.map(msg =>
                msg.id === thinkingMessageId
                    ? { ...savedSystemData, content: systemResponseRenderableContent }
                    : msg
            ));

        } catch (error) {
            const durationMs = Date.now() - startTime;
            messageApi.error(`发送失败: ${error.message}`);
            setMessages(prev => prev.filter(msg => !msg.isThinking)); // 移除“思考中”

            // 日志：搜索失败
            logSystemEvent({
                category: 'AI',
                eventType: 'SEARCH_FAILED',
                severity: 'ERROR',
                message: error.message,
                userId: currentUser.id,
                meta: { duration_ms: durationMs }
            });
        } finally {
            setIsLoading(false);
        }
    };

    // --- 5. 核心：提交评分（现在关联到会话） ---
    const handleRatingSubmit = async () => {
        if (currentRating === 0 || !activeSessionId) {
            messageApi.warning('请选择星级后再提交。');
            return;
        }
        try {
            const { error } = await supabase.from('chat_ratings').insert({
                user_id: currentUser.id,
                session_id: activeSessionId,
                rating: currentRating,
                comment: ratingComment // 如果有评论表字段，可以一起插入
            });
            if (error) throw error;
            messageApi.success(`感谢您的评分 (${currentRating} 星)!`);
            
            // 日志：用户评分
            logSystemEvent({
                category: 'INTERACTION',
                eventType: 'SESSION_RATED',
                message: 'User rated session',
                userId: currentUser.id,
                meta: { 
                    session_id: activeSessionId,
                    rating: currentRating,
                    has_comment: !!ratingComment
                }
            });

            setShowRatingModal(false);
            setCurrentRating(0);
            setRatingComment('');
        } catch (error) {
            messageApi.error(`提交评分失败: ${error.message}`);
            logSystemEvent({
                category: 'INTERACTION',
                eventType: 'RATE_FAILED',
                severity: 'ERROR',
                message: error.message,
                userId: currentUser.id
            });
        }
    };

    const handleFeedback = async (messageId, feedbackType) => {
        const originalFeedback = messages.find(msg => msg.id === messageId)?.feedback;
        const newFeedback = originalFeedback === feedbackType ? null : feedbackType;

        setMessages(prevMessages => prevMessages.map(msg =>
            msg.id === messageId ? { ...msg, feedback: newFeedback } : msg
        ));

        try {
            const { error } = await supabase
                .from('chat_messages')
                .update({ feedback: newFeedback })
                .eq('id', messageId)
                .eq('user_id', currentUser?.id);

            if (error) {
                setMessages(prevMessages => prevMessages.map(msg =>
                    msg.id === messageId ? { ...msg, feedback: originalFeedback } : msg
                ));
                throw error;
            }
            
            // 日志：用户点赞/点踩
            if (newFeedback) {
                logSystemEvent({
                    category: 'INTERACTION',
                    eventType: 'MESSAGE_FEEDBACK',
                    message: `User ${newFeedback}d a message`,
                    userId: currentUser.id,
                    meta: { 
                        session_id: activeSessionId,
                        message_id: messageId,
                        feedback_type: newFeedback
                    }
                });
            }

        } catch (error) {
            console.error("Failed to update feedback:", error);
            messageApi.error(`更新反馈失败: ${error.message}`);
        }
    };

    // --- ✨ 核心修正: 确保 handleEndSession 函数已定义 ---
    const handleEndSession = () => {
        setShowRatingModal(true);
    };

    const handleRatingCancel = () => {
        setShowRatingModal(false);
        setCurrentRating(0);
    };

    const showDetailsModal = (notice) => {
        // 日志：查看详情
        logSystemEvent({
            category: 'INTERACTION',
            eventType: 'VIEW_NOTICE_DETAIL',
            userId: currentUser?.id,
            meta: { notice_id: notice.id, notice_code: notice.noticeCode }
        });
        setDetailsModal({ visible: true, notice });
    };

    const handleDetailsCancel = () => setDetailsModal({ visible: false, notice: null });

    const handlePlaceholder = () => messageApi.info('此操作在此页面不可用。');

    return (
        <Layout className="intelligent-search-layout">
            {/* --- 6. 核心：渲染Sider (会话列表) --- */}
            <Sider width={250} className="chat-sider">
                <div className="chat-sider-header">
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => handleNewChat(true)} block>
                        新建对话
                    </Button>
                </div>
                <Menu
                    mode="inline"
                    selectedKeys={[activeSessionId]}
                    onClick={(e) => setActiveSessionId(e.key)}
                    className="chat-sider-menu"
                >
                    {sessions.map(session => (
                        // --- 3. 核心修正：为 Menu.Item 添加删除按钮和确认框 ---
                        <Menu.Item key={session.id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text ellipsis style={{ width: '150px' }}>{session.title}</Text>
                                <Popconfirm
                                    title="确定要删除此对话吗？"
                                    description="此操作不可撤销。"
                                    onConfirm={(e) => handleDeleteSession(e, session.id)}
                                    onCancel={(e) => e.stopPropagation()}
                                    okText="删除"
                                    cancelText="取消"
                                >
                                    <Button
                                        type="text"
                                        icon={<DeleteOutlined />}
                                        danger
                                        size="small"
                                        onClick={(e) => e.stopPropagation()} // 阻止菜单项被点击
                                    />
                                </Popconfirm>
                            </div>
                        </Menu.Item>
                    ))}
                </Menu>
            </Sider>

            {/* --- 7. 核心：渲染Content (聊天窗口) --- */}
            <Layout className="chat-content-layout">
                <Content style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div className="chat-content-header">
                        <Space>
                            <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#1890ff' }} />
                            <Title level={4} style={{ margin: 0 }}>智能检索助手</Title>
                            <Paragraph type="secondary" style={{ display: 'contents' }}>检索通知单的所有内容</Paragraph>
                        </Space>
                        <Button icon={<StarOutlined />} onClick={handleEndSession} disabled={!activeSessionId || messages.length <= 1}>
                            评价本次会话
                        </Button>
                    </div>

                    <div className="chat-messages-container">
                        {isHistoryLoading ? (
                            <div className="chat-spin-container"><Spin /></div>
                        ) : (
                            messages.map((msg) => (
                                <div key={msg.id} className={`chat-message ${msg.sender === 'user' ? 'user' : 'system'}`}>
                                    <Card
                                        size="small"
                                        className="chat-message-card"
                                        style={{
                                            backgroundColor: msg.sender === 'user' ? '#e6f7ff' : '#ffffff',
                                            borderColor: msg.sender === 'user' ? '#91d5ff' : '#f0f0f0',
                                        }}
                                    >
                                        <div style={{ color: msg.isError ? 'red' : 'inherit' }}>{msg.content}</div>
                                        {msg.sender === 'system' && !msg.isThinking && !msg.isError && (
                                            <Space size="small" className="feedback-buttons">
                                                <Tooltip title="点赞"><Button type="text" size="small" shape="circle" icon={<LikeOutlined />} style={{ color: msg.feedback === 'like' ? '#1890ff' : 'inherit' }} onClick={() => handleFeedback(msg.id, 'like')} /></Tooltip>
                                                <Tooltip title="点踩"><Button type="text" size="small" shape="circle" icon={<DislikeOutlined />} style={{ color: msg.feedback === 'dislike' ? '#ff4d4f' : 'inherit' }} onClick={() => handleFeedback(msg.id, 'dislike')} /></Tooltip>
                                            </Space>
                                        )}
                                        {msg.timestamp && !msg.isThinking && (
                                            <Text type="secondary" className="chat-message-timestamp">
                                                {dayjs(msg.timestamp).format('YYYY.MM.DD HH:mm')}
                                            </Text>
                                        )}
                                    </Card>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="chat-input-area">
                        <Space.Compact style={{ width: '100%' }}>
                            <Input
                                size="large"
                                placeholder="输入您的问题或关键词..."
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onPressEnter={!isLoading ? handleSendMessage : undefined}
                                disabled={isLoading || isHistoryLoading}
                            />
                            <Button
                                type="primary"
                                size="large"
                                icon={<SendOutlined />}
                                onClick={handleSendMessage}
                                loading={isLoading}
                                disabled={isHistoryLoading}
                            />
                        </Space.Compact>
                    </div>
                </Content>
            </Layout>

            {/* --- 8. 弹窗 (保持不变) --- */}
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
                    <TextArea
                        rows={3}
                        placeholder="您可以留下具体的评论或建议（可选）"
                        value={ratingComment}
                        onChange={(e) => setRatingComment(e.target.value)}
                    />
                </div>
            </Modal>
        </Layout>
    );
};

export default IntelligentSearchPage;