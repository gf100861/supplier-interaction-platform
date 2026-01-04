import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Layout, Menu, Input, Button, List, Card, Typography, Spin, Avatar, Space, Tooltip, Rate, Modal, Popconfirm, Tag, Select, Form, Tabs, Divider, message } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined, FileTextOutlined, LikeOutlined, DislikeOutlined, StarOutlined, PlusOutlined, DeleteOutlined, WarningOutlined, ThunderboltOutlined, MenuUnfoldOutlined, MenuFoldOutlined, LikeFilled, DislikeFilled, SettingOutlined, ApiOutlined } from '@ant-design/icons';
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

// --- 日志系统工具函数 (保持不变) ---
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

const LS_API_KEY_KEY = 'gemini_api_key_local_storage';


const IntelligentSearchPage = () => {
    const [inputValue, setInputValue] = useState('');
    const [placeholderValue, setPlaceholderValue] = useState('');
    const [messages, setMessages] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [collapsed, setCollapsed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);

    const MODEL_OPTIONS = [
        { label: 'Google Gemini 2.5 Flash', value: 'gemini', icon: '💎' },
        { label: 'OpenAI GPT-4o', value: 'openai', icon: '🤖' },
        { label: '阿里通义千问 (Qwen-Plus)', value: 'qwen', icon: '🇨🇳' },
    ];

    const LS_KEYS = {
        GEMINI: 'api_key_gemini',
        OPENAI: 'api_key_openai',
        QWEN: 'api_key_qwen',
        BASE_URL_OPENAI: 'base_url_openai', // 支持自定义代理地址
        BASE_URL_QWEN: 'base_url_qwen',     // 阿里通常兼容OpenAI格式，或者直接调用DashScope
    };

    const [currentModel, setCurrentModel] = useState('gemini');
    const [showSettings, setShowSettings] = useState(false);
    const [apiKeys, setApiKeys] = useState({
        gemini: '',
        openai: '',
        qwen: '',
        openaiBaseUrl: 'https://api.openai.com/v1',
        qwenBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', // Qwen 兼容 OpenAI 接口地址
    });

    useEffect(() => {
        setApiKeys({
            gemini: localStorage.getItem(LS_KEYS.GEMINI) || '',
            openai: localStorage.getItem(LS_KEYS.OPENAI) || '',
            qwen: localStorage.getItem(LS_KEYS.QWEN) || '',
            openaiBaseUrl: localStorage.getItem(LS_KEYS.BASE_URL_OPENAI) || 'https://api.openai.com/v1',
            qwenBaseUrl: localStorage.getItem(LS_KEYS.BASE_URL_QWEN) || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        });
    }, []);

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

    // --- API Key ---
    const [apiKey, setApiKey] = useState('');
    useEffect(() => {
        const savedKey = localStorage.getItem(LS_API_KEY_KEY);
        if (savedKey) setApiKey(savedKey);
    }, []);

    // --- 1. Embedding 生成函数 ---
    const getGeminiEmbedding = async (text) => {
        if (!text || !text.trim() || !apiKey) return null;
        const cleanText = text.replace(/\s+/g, ' ').trim().substring(0, 8000);

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: "models/text-embedding-004",
                        content: { parts: [{ text: cleanText }] }
                    })
                }
            );

            if (!response.ok) throw new Error("Embedding API request failed");
            const result = await response.json();
            return result.embedding.values;
        } catch (error) {
            console.error("生成向量失败:", error);
            return null;
        }
    };

    // --- 2. 通用 LLM 调用接口 (核心修改) ---
    const callLLMService = async (prompt, modelType) => {
        const headers = { 'Content-Type': 'application/json' };
        let url = '';
        let body = {};

        switch (modelType) {
            case 'gemini':
                if (!apiKeys.gemini) throw new Error("请在设置中配置 Gemini API Key");
                url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKeys.gemini}`;
                body = { contents: [{ parts: [{ text: prompt }] }] };
                break;

            case 'openai':
                if (!apiKeys.openai) throw new Error("请在设置中配置 OpenAI API Key");
                url = `${apiKeys.openaiBaseUrl}/chat/completions`;
                headers['Authorization'] = `Bearer ${apiKeys.openai}`;
                body = {
                    model: "gpt-4o", // 或 gpt-3.5-turbo
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.3
                };
                break;

            case 'qwen':
                if (!apiKeys.qwen) throw new Error("请在设置中配置 Qwen API Key");
                // Qwen 使用兼容 OpenAI 的接口
                url = `${apiKeys.qwenBaseUrl}/chat/completions`;
                headers['Authorization'] = `Bearer ${apiKeys.qwen}`;
                body = {
                    model: "qwen-plus",
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.3
                };
                break;

            default:
                throw new Error("未知模型类型");
        }

        const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API 请求失败: ${response.statusText} - ${errText}`);
        }

        const data = await response.json();

        // 统一响应格式解析
        if (modelType === 'gemini') {
            return data.candidates[0].content.parts[0].text;
        } else {
            // OpenAI 和 Qwen (兼容格式) 结构一致
            return data.choices[0].message.content;
        }
    };

    // --- 2. RAG 生成函数 ---
    const generateRAGResponse = async (query, contextDocuments, modelType) => {
        if (!apiKey) return { text: "未配置 API Key，无法生成回答。", usedIndices: [] };

        const contextText = contextDocuments.map((doc, index) => {
            const contentStr = typeof doc.content === 'object' ? JSON.stringify(doc.content) : String(doc.content);
            const titleStr = doc.title || '无标题';
            const codeStr = doc.notice_code || doc.noticeCode || 'N/A';
            return `[文档索引: ${index}] 编号:${codeStr} | 标题:${titleStr}\n内容摘要: ${contentStr}`;
        }).join("\n\n---\n\n");

        const prompt = `
你是一个专业的企业质量管理助手。请根据以下[参考文档]来回答用户的[问题]。

核心规则：
1. 严禁编造信息，必须完全基于[参考文档]回答。
2. 如果参考文档无法回答问题，请直接说明。
3. **关键步骤**：在回答结束时，必须在最后一行严格按照以下格式列出你实际引用了哪些文档的索引（从0开始的数字）：
   $$REFS$$: [0, 2] 
   (如果没有引用任何文档，输出 $$REFS$$: [])

[参考文档]:
${contextText}

[问题]:
${query}
`;

        try {

            const rawText = await callLLMService(prompt, modelType); // 参数一定一一对应

            let aiText = rawText;
            let usedIndices = [];

            const refMatch = rawText.match(/\$\$REFS\$\$: \s*\[(.*?)\]/);

            if (refMatch) {
                try {
                    usedIndices = refMatch[1].split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                    aiText = rawText.replace(refMatch[0], '').trim();
                } catch (e) {
                    console.error("解析引用索引失败", e);
                    usedIndices = contextDocuments.map((_, i) => i);
                }
            } else {
                usedIndices = contextDocuments.map((_, i) => i);
            }

            return { text: aiText, usedIndices };

        } catch (error) {
            console.error("RAG 生成失败:", error);
            return { text: "抱歉，生成答案时出现错误。", usedIndices: [] };
        }
    };

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

    // --- 新增：处理单条消息的点赞/点踩反馈 ---
    const handleFeedback = async (messageId, type) => {
        // 1. 乐观更新 UI
        setMessages(prev => prev.map(msg =>
            msg.id === messageId
                // 如果已经是这个状态，则取消(null)，否则设为 type
                ? { ...msg, feedback: msg.feedback === type ? null : type }
                : msg
        ));

        // 2. 更新数据库
        // 注意：这里需要根据当前 UI 状态判断是写入 'like'/'dislike' 还是 null
        const currentMsg = messages.find(m => m.id === messageId);
        const newFeedback = currentMsg.feedback === type ? null : type; // Toggle logic

        try {
            const { error } = await supabase
                .from('chat_messages')
                .update({ feedback: newFeedback })
                .eq('id', messageId);

            if (error) throw error;

            // 3. 记录日志
            logSystemEvent({
                category: 'INTERACTION', eventType: 'MESSAGE_FEEDBACK', message: `User ${newFeedback || 'removed feedback'} for message`,
                userId: currentUser.id, meta: { message_id: messageId, feedback_type: newFeedback }
            });

        } catch (error) {
            console.error("Feedback update failed:", error);
            messageApi.error("反馈提交失败");
            // 回滚 UI
            setMessages(prev => prev.map(msg =>
                msg.id === messageId ? { ...msg, feedback: currentMsg.feedback } : msg
            ));
        }
    };

    // --- 渲染消息内容 ---
    const renderMessageContent = (msg) => {
        if (msg.isThinking) return <Spin size="small" tip="正在检索并思考..." />;

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
                        {parsedContent.type === 'rag_result' ? (
                            <div className="rag-answer-section">
                                <Paragraph style={{ marginBottom: 12 }}>
                                    <RobotOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                                    <span style={{ whiteSpace: 'pre-wrap' }}>{parsedContent.answer}</span>
                                </Paragraph>
                            </div>
                        ) : (
                            <Paragraph>{parsedContent.text}</Paragraph>
                        )}

                        {(() => {
                            const sourceIds = parsedContent.sources || parsedContent.noticeIds || [];
                            const sourceDocs = sourceIds.map(id => notices.find(n => n.id === id)).filter(Boolean);

                            if (sourceDocs.length > 0) {
                                return (
                                    <div className="rag-sources-section">
                                        <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                                            <ThunderboltOutlined /> 参考来源 ({sourceDocs.length})
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
                                                                <FileTextOutlined style={{ color: '#52c41a' }} />
                                                                <Text ellipsis strong>{item.title || '无标题'}</Text>
                                                            </div>
                                                            <Tag color="blue">{item.noticeCode || item.notice_code}</Tag>
                                                        </div>
                                                        <div style={{ marginTop: 4, fontSize: 12, color: '#888' }}>
                                                            供应商: {item.supplier?.short_code || 'N/A'}
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

                {/* --- 渲染反馈按钮 (仅对 AI 消息且非 Loading 状态显示) --- */}
                {msg.sender === 'system' && !msg.isThinking && (
                    <div className="message-feedback-actions" style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Tooltip title="回答有帮助">
                            <Button
                                type="text"
                                size="small"
                                icon={msg.feedback === 'like' ? <LikeFilled style={{ color: '#1890ff' }} /> : <LikeOutlined />}
                                onClick={() => handleFeedback(msg.id, 'like')}
                            />
                        </Tooltip>
                        <Tooltip title="不能帮助我">
                            <Button
                                type="text"
                                size="small"
                                icon={msg.feedback === 'dislike' ? <DislikeFilled style={{ color: '#ff4d4f' }} /> : <DislikeOutlined />}
                                onClick={() => handleFeedback(msg.id, 'dislike')}
                            />
                        </Tooltip>
                    </div>
                )}
            </div>
        );
    };

    // --- 加载消息记录 ---
    const fetchMessages = async (sessionId) => {
        if (!sessionId) {
            setMessages([{ id: Date.now(), sender: 'system', content: '您好！我是智能助手，请输入您的问题，我将基于数据库为您检索答案。', feedback: null }]);
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
            // 注意：这里不需要再重新 renderMessageContent，因为 render 是在 return JSX 时调用的
            // 我们只需要存原始数据，React 会处理渲染
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
        else if (!activeSessionId) setMessages([{ id: Date.now(), sender: 'system', content: '您好！我是智能助手，请输入您的问题，我将基于数据库为您检索答案。', feedback: null }]);
    }, [activeSessionId]);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    const handleNewChat = (activate = true) => {
        if (activate) setActiveSessionId(null);
        setMessages([{ id: Date.now(), sender: 'system', content: '您好！我是智能助手，请输入您的问题，我将基于数据库为您检索答案。', feedback: null }]);
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
    // --- 核心：发送消息处理 ---
    const handleSendMessage = async () => {
        const userQuery = inputValue.trim();
        if (!userQuery || !currentUser?.id) {
            messageApi.warning('请输入问题');
            return;
        };

        setIsLoading(true);
        const startTime = Date.now();

        // 1. Session 管理
        let currentSessionId = activeSessionId;
        if (!currentSessionId) {
            const firstTitle = userQuery.length > 8 ? `${userQuery.substring(0, 8)}...` : userQuery;
            const { data: newSession, error } = await supabase.from('chat_sessions').insert({ user_id: currentUser.id, title: firstTitle }).select().single();
            if (error) { messageApi.error('创建会话失败'); setIsLoading(false); return; }
            currentSessionId = newSession.id;
            setActiveSessionId(currentSessionId);
            setSessions(prev => [newSession, ...prev]);
            setMessages([]);
        }

        // 2. 乐观 UI 更新
        const tempUserMsgId = `temp-${Date.now()}`;
        const tempSystemMsgId = `temp-sys-${Date.now()}`;
        const optimisticUserMsg = { id: tempUserMsgId, sender: 'user', content: userQuery, timestamp: new Date().toISOString() };
        // 注意：isThinking 时不应该显示点赞按钮
        const thinkingMsg = { id: tempSystemMsgId, sender: 'system', content: <Spin size="small" tip="AI 正在阅读文档并生成回答..." />, isThinking: true };

        setMessages(prev => [...prev, optimisticUserMsg, thinkingMsg]);
        setInputValue('');

        // 3. 保存用户消息
        await supabase.from('chat_messages').insert({ user_id: currentUser.id, session_id: currentSessionId, sender: 'user', content: userQuery });

        try {
            // ... (STEP A 检索代码保持不变) ...
            let ragDocs = [];
            let searchMethod = 'keyword';

            if (apiKey) {
                const queryVector = await getGeminiEmbedding(userQuery);
                if (queryVector) {
                    searchMethod = 'vector';
                    const { data, error } = await supabase.rpc('match_notices', {
                        query_embedding: queryVector,
                        match_threshold: 0.45,
                        match_count: Math.max(1, Math.floor(notices.length * 0.25)),
                        query_text: userQuery
                    });

                    if (!error && data) ragDocs = data;
                }
            }

            if (ragDocs.length === 0) {
                searchMethod = 'keyword';
                const lowerCaseQuery = userQuery.toLowerCase();
                const keywords = lowerCaseQuery.split(/[\s,，+]+/);
                ragDocs = notices.filter(n => {
                    const text = JSON.stringify(n).toLowerCase();
                    return keywords.every(k => text.includes(k));
                }).slice(0, 3).map(n => ({ id: n.id, title: n.title, notice_code: n.noticeCode, content: n, similarity: 1 }));
            }

            // ... (STEP B 生成代码保持不变) ...
            let aiAnswerText = "";
            let finalSourceDocs = [];

            if (ragDocs.length > 0) {
                const { text, usedIndices } = await generateRAGResponse(userQuery, ragDocs, currentModel);
                console.log("RAG Generated Text:", text, "Used Indices:", usedIndices, currentModel);
                aiAnswerText = text;
                if (usedIndices && usedIndices.length > 0) {
                    finalSourceDocs = usedIndices.map(idx => ragDocs[idx]).filter(Boolean);
                }
            } else {
                aiAnswerText = "抱歉，在知识库中未找到相关内容，无法回答您的问题。";
            }

            // ... (STEP C 存储代码) ...
            const resultPayload = {
                type: "rag_result",
                answer: aiAnswerText,
                sources: finalSourceDocs.map(d => d.id),
                // ✅ 在 meta 中增加 model 字段，记录这次回答是用哪个模型生成的
                meta: {
                    method: searchMethod,
                    model: currentModel, // <--- 新增这行
                    duration: Date.now() - startTime
                }
            };
            const resultString = JSON.stringify(resultPayload);

            const { data: savedSystemMsg } = await supabase.from('chat_messages').insert({
                user_id: currentUser.id,
                session_id: currentSessionId,
                sender: 'system',
                content: resultString
            }).select().single();

            // 更新 UI (替换 thinking message)
            setMessages(prev => prev.map(msg =>
                msg.id === tempSystemMsgId
                    ? { ...savedSystemMsg } // 这里会包含数据库返回的 ID 和 feedback 字段 (默认为 null)
                    : msg
            ));

        } catch (error) {
            console.error(error);
            messageApi.error(`处理失败: ${error.message}`);
            setMessages(prev => prev.filter(msg => msg.id !== tempSystemMsgId));
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
            <Sider
                width={260}
                theme="light"
                className="chat-sider"
                collapsible
                collapsed={collapsed}
                onCollapse={(value) => setCollapsed(value)}
                breakpoint="lg"
                collapsedWidth="80"
                trigger={null}
            >
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
                    onClick={() => setCollapsed(!collapsed)}
                    style={{ height: '48px', lineHeight: '48px', textAlign: 'center', cursor: 'pointer', borderTop: '1px solid #f0f0f0', color: 'rgba(0, 0, 0, 0.45)', fontSize: '16px' }}
                >
                    {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                </div>
            </Sider>

            <Layout className="chat-content-layout">
                {/* 顶部 Header 改造 */}
                <div className="chat-main-header">
                    <div className="header-left">
                        <Title level={4} style={{ margin: 0 }}>AI 助手</Title><span style={{ margin: '0 8px' }}>|</span>
                        <Text type="secondary" style={{ fontSize: 12 }}>基于 {notices.length} 条通知单</Text>
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
                            <Button
                                type="text"
                                icon={<SettingOutlined style={{ fontSize: 18 }} />}
                                onClick={() => setShowSettings(true)}
                                style={{ marginRight: 8 }}
                            />
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
                        {/* 增加 Loading 状态遮罩或禁用 */}
                        <div className="input-box-container">
                            <TextArea
                                placeholder={ isLoading ? `正在生成回答...` : `向 ${MODEL_OPTIONS.find(m => m.value === currentModel)?.label} 提问... (Shift+Enter 换行)。示例问题: ${placeholderValue}`}
                                autoSize={{ minRows: 1, maxRows: 6 }}
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                onPressEnter={(e) => { if (!e.shiftKey && !isLoading) { e.preventDefault(); handleSendMessage(); } }}
                                disabled={isLoading}
                                className="styled-textarea"
                            />
                            <Button
                                type="primary"
                                shape="circle"
                                size="large"
                                icon={<SendOutlined />}
                                onClick={handleSendMessage}
                                loading={isLoading}
                                className="send-btn"
                            />
                        </div>
                        <div className="footer-tips">
                            AI 生成内容可能不准确，请参考原文。当前使用: {MODEL_OPTIONS.find(m => m.value === currentModel)?.label}
                        </div>
                    </div>
                </Content>
            </Layout>

            <Modal
                title="模型设置 & API Keys"
                open={showSettings}
                onCancel={() => setShowSettings(false)}
                footer={null}
            >
                <Form layout="vertical" initialValues={apiKeys} onFinish={handleSaveSettings}>
                    <Tabs defaultActiveKey="1" items={[
                        {
                            key: '1', label: 'Google Gemini', children: (
                                <Form.Item label="Gemini API Key" name="gemini" help="用于生成回答以及向量检索(Embedding)">
                                    <Input.Password placeholder="AIzaSy..." />
                                </Form.Item>
                            )
                        },
                        {
                            key: '2', label: 'OpenAI', children: (
                                <>
                                    <Form.Item label="OpenAI API Key" name="openai">
                                        <Input.Password placeholder="sk-..." />
                                    </Form.Item>
                                    <Form.Item label="API Base URL (可选, 用于代理)" name="openaiBaseUrl">
                                        <Input placeholder="https://api.openai.com/v1" />
                                    </Form.Item>
                                </>
                            )
                        },
                        {
                            key: '3', label: 'Qwen (通义千问)', children: (
                                <>
                                    <Form.Item label="DashScope API Key" name="qwen">
                                        <Input.Password placeholder="sk-..." />
                                    </Form.Item>
                                    <Form.Item label="兼容接口地址" name="qwenBaseUrl">
                                        <Input placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" />
                                    </Form.Item>
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