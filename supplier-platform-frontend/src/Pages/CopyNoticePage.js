import React, { useState, useMemo, useRef, useEffect } from 'react';

import { Input, Button, List, Card, Typography, Spin, Empty, Avatar, Space, message, Tooltip, Rate, Modal, Layout, Menu } from 'antd'; // 1. Import Layout, Menu

import { SendOutlined, RobotOutlined, UserOutlined, FileTextOutlined, LikeOutlined, DislikeOutlined, StarOutlined, PlusOutlined } from '@ant-design/icons';

import { useNotices } from '../contexts/NoticeContext';

import { NoticeDetailModal } from '../Components/notice/NoticeDetailModal';

import { useNotification } from '../contexts/NotificationContext';

import dayjs from 'dayjs';

import { supabase } from '../supabaseClient';



const { Title, Paragraph, Text } = Typography;



const { Sider, Content } = Layout; // 3. Destructure Layout components

const { TextArea } = Input; // 4. Import TextArea



const IntelligentSearchPage = () => {

    const [inputValue, setInputValue] = useState('');

    const [messages, setMessages] = useState([]);

    const [isLoading, setIsLoading] = useState(false);

    const [isHistoryLoading, setIsHistoryLoading] = useState(true);

    const { notices } = useNotices();

    const [detailsModal, setDetailsModal] = useState({ visible: false, notice: null });

    const { messageApi } = useNotification();

    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

    const messagesEndRef = useRef(null);

    const [showRatingModal, setShowRatingModal] = useState(false);

    const [currentRating, setCurrentRating] = useState(0);

      const [ratingComment, setRatingComment] = useState(''); // 5. State for rating comment



    useEffect(() => {

        const fetchHistory = async () => {

            if (!currentUser?.id) {

                console.error("User not found, cannot fetch chat history.");

                setMessages([{ id: Date.now(), sender: 'system', content: '无法加载历史记录，请确保您已登录。', feedback: null, isError: true }]);

                setIsHistoryLoading(false);

                return;

            }



            setIsHistoryLoading(true);

            try {

                const { data, error } = await supabase

                    .from('chat_messages')

                    .select('*')

                    .eq('user_id', currentUser.id)

                    .order('created_at', { ascending: true });



                if (error) throw error;



                if (data && data.length > 0) {

                    const formattedMessages = data.map(msg => ({

                        ...msg,

                        content: typeof msg.content === 'string' && msg.content.startsWith('{"type":"Spin"') ? <Spin size="small" /> : msg.content

                    }));

                    setMessages(formattedMessages);

                } else {

                    setMessages([{ id: Date.now(), sender: 'system', content: '您好！我是智能助手，请问您想查找哪方面的通知单？', feedback: null }]);

                }

            } catch (error) {

                console.error("Failed to load chat history:", error);

                messageApi.error(`加载聊天记录失败: ${error.message}`);

                setMessages([{ id: Date.now(), sender: 'system', content: '加载历史记录时出错。', feedback: null, isError: true }]);

            } finally {

                setIsHistoryLoading(false);

            }

        };



        fetchHistory();

    }, [currentUser?.id, messageApi]);



    useEffect(() => {

        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    }, [messages]);



    const handleSendMessage = async () => {

        const userQuery = inputValue.trim();

        if (!userQuery || !currentUser?.id) {

            message.warning(!userQuery ? '请输入您的问题或关键词！' : '无法发送消息，用户未登录。');

            return;

        }



        const newUserMessageData = {

            user_id: currentUser.id,

            sender: 'user',

            content: userQuery,

            timestamp: new Date().toISOString(),

            feedback: null

        };



        const optimisticUserMessage = { ...newUserMessageData, id: `temp-${Date.now()}` };

        setMessages(prev => [...prev, optimisticUserMessage]);

        setInputValue('');

        setIsLoading(true);



        const thinkingMessageId = `temp-${Date.now()}-thinking`;

        const thinkingMessageUI = { id: thinkingMessageId, sender: 'system', content: <Spin size="small" />, timestamp: dayjs().format('HH:mm'), isThinking: true, feedback: null };

        setMessages(prev => [...prev, thinkingMessageUI]);



        let systemMessageData = {

            user_id: currentUser.id,

            sender: 'system',

            content: '',

            timestamp: new Date().toISOString(),

            feedback: null

        };



        try {

            const { data: savedUserData, error: userSaveError } = await supabase

                .from('chat_messages')

                .insert(newUserMessageData)

                .select()

                .single();



            if (userSaveError) throw userSaveError;

            // Update optimistic ID (optional)

            setMessages(prev => prev.map(msg => msg.id === optimisticUserMessage.id ? { ...msg, id: savedUserData.id } : msg));





            // --- TODO: Replace with actual Supabase Edge Function call ---

            await new Promise(resolve => setTimeout(resolve, 1500));

            const mockResults = notices.filter(notice =>

                (notice.title?.toLowerCase() || '').includes(userQuery.toLowerCase()) ||

                (notice.sdNotice?.description?.toLowerCase() || '').includes(userQuery.toLowerCase()) ||

                (notice.noticeCode?.toLowerCase() || '').includes(userQuery.toLowerCase())

            ).slice(0, 3);



            let systemResponseContent;

            let systemResponseRenderableContent;



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

                                        description={`编号: ${item.noticeCode} | 供应商: ${item.assignedSupplierName}`}

                                    />

                                </List.Item>

                            )}

                        />

                    </div>

                );

                systemMessageData.content = `根据您的描述，找到了 ${mockResults.length} 个相关通知单: ${mockResults.map(n => n.noticeCode).join(', ')}`;



            } else {

                systemResponseRenderableContent = "抱歉，未能根据您的描述找到相关的通知单。您可以尝试更换关键词或描述得更详细一些。";

                systemMessageData.content = systemResponseRenderableContent;

            }



            const { data: savedSystemData, error: systemSaveError } = await supabase

                .from('chat_messages')

                .insert(systemMessageData)

                .select()

                .single();



            if (systemSaveError) throw systemSaveError;



            setMessages(prev => prev.map(msg =>

                msg.id === thinkingMessageId

                    ? { ...savedSystemData, content: systemResponseRenderableContent }

                    : msg

            ));



        } catch (error) {

            console.error("Send message or search failed:", error);

            const errorMessage = `发送或检索失败: ${error.message}`;

            systemMessageData.content = errorMessage;



            try {

                const { data: savedErrorData, error: errorSaveError } = await supabase

                    .from('chat_messages')

                    .insert(systemMessageData)

                    .select()

                    .single();

                if (errorSaveError) throw errorSaveError;

                setMessages(prev => prev.map(msg =>

                    msg.id === thinkingMessageId

                        ? { ...savedErrorData, isError: true }

                        : msg

                ));

            } catch (dbError) {

                console.error("Failed to save error message to DB:", dbError);

                setMessages(prev => prev.map(msg =>

                    msg.id === thinkingMessageId

                        ? { ...thinkingMessageUI, id: `temp-error-${Date.now()}`, content: errorMessage, isError: true, isThinking: false }

                        : msg

                ));

            }

        } finally {

            setIsLoading(false);

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

            console.log(`Feedback updated for message ID ${messageId}: ${newFeedback}`);

        } catch (error) {

            console.error("Failed to update feedback:", error);

            messageApi.error(`更新反馈失败: ${error.message}`);

        }

    };



    // --- ✨ 核心修正: 确保 handleEndSession 函数已定义 ---

    const handleEndSession = () => {

        setShowRatingModal(true);

    };



    const handleRatingSubmit = async () => {

        if (currentRating === 0) {

            message.warning('请选择星级后再提交。');

            return;

        }

        if (!currentUser?.id) {

            message.error('无法提交评分，用户未登录。');

            return;

        }



        const ratingData = {

            user_id: currentUser.id,

            rating: currentRating,

            created_at: new Date().toISOString()

        };



        try {

            const { error } = await supabase.from('chat_ratings').insert(ratingData);

            if (error) throw error;



            console.log(`User rated the session: ${currentRating} stars`);

            message.success(`感谢您的评分 (${currentRating} 星)!`);

            setShowRatingModal(false);

            setCurrentRating(0);

        } catch (error) {

            console.error("Failed to save rating:", error);

            messageApi.error(`提交评分失败: ${error.message}`);

        }

    };



    const handleRatingCancel = () => {

        setShowRatingModal(false);

        setCurrentRating(0);

    };



    const showDetailsModal = (notice) => setDetailsModal({ visible: true, notice });

    const handleDetailsCancel = () => setDetailsModal({ visible: false, notice: null });

    const handlePlaceholder = () => messageApi.info('此操作在此页面不可用。');



    return (

        <div style={{

            display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)',

            maxWidth: 900, margin: '40px auto', border: '1px solid #f0f0f0', borderRadius: '8px', overflow: 'hidden'

        }}>

            <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0', backgroundColor: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

                <Space>

                    <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#1890ff' }} />

                    <Title level={4} style={{ margin: 0 }}>智能检索助手</Title>

                </Space>

                {/* Ensure onClick calls the defined function */}

                <Button icon={<StarOutlined />} onClick={handleEndSession}>评价本次会话</Button>

            </div>



            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '24px' }}>

                {isHistoryLoading ? (

                    <div style={{ textAlign: 'center', padding: '50px' }}><Spin /></div>

                ) : (

                    messages.map((msg) => (

                        <div key={msg.id} style={{ marginBottom: '16px', display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>

                            <Card

                                size="small"

                                style={{

                                    maxWidth: '75%',

                                    backgroundColor: msg.sender === 'user' ? '#e6f7ff' : '#ffffff',

                                    border: msg.sender === 'user' ? '1px solid #91d5ff' : '1px solid #f0f0f0',

                                    borderRadius: '10px',

                                }}

                                bodyStyle={{ padding: '10px 15px' }}

                            >

                                <div style={{ color: msg.isError ? 'red' : 'inherit' }}>{msg.content}</div>

                                {msg.sender === 'system' && !msg.isThinking && !msg.isError && (

                                    <Space size="small" style={{ marginTop: '8px', fontSize: '12px' }}>

                                        <Tooltip title="点赞">

                                            <Button

                                                type="text"

                                                size="small"

                                                shape="circle"

                                                icon={<LikeOutlined />}

                                                style={{ color: msg.feedback === 'like' ? '#1890ff' : 'inherit' }}

                                                onClick={() => handleFeedback(msg.id, 'like')}

                                            />

                                        </Tooltip>

                                        <Tooltip title="点踩">

                                            <Button

                                                type="text"

                                                size="small"

                                                shape="circle"

                                                icon={<DislikeOutlined />}

                                                style={{ color: msg.feedback === 'dislike' ? '#ff4d4f' : 'inherit' }}

                                                onClick={() => handleFeedback(msg.id, 'dislike')}

                                            />

                                        </Tooltip>

                                    </Space>

                                )}

                                {msg.timestamp && !msg.isThinking && <Text type="secondary" style={{ fontSize: '11px', display: 'block', textAlign: msg.sender === 'user' ? 'right' : 'left', marginTop: msg.sender === 'system' ? '0px' : '5px' }}>{dayjs(msg.timestamp).format('HH:mm')}</Text>}

                            </Card>

                        </div>

                    ))

                )}

                <div ref={messagesEndRef} />

            </div>



            <div style={{ padding: '15px 24px', borderTop: '1px solid #f0f0f0', backgroundColor: '#ffffff' }}>

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

            >

                <div style={{ textAlign: 'center', padding: '20px 0' }}>

                    <Paragraph>请为本次智能检索的体验打分：</Paragraph>

                    <Rate allowHalf value={currentRating} onChange={setCurrentRating} style={{ fontSize: 36 }} />

                </div>

            </Modal>

        </div>

    );

};



export default IntelligentSearchPage;


