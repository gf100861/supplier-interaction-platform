import React, { useState, useEffect, useRef } from 'react';
import { Drawer, Input, Button, List, Avatar, Space, Popover } from 'antd';
import { SendOutlined, SmileOutlined } from '@ant-design/icons';
import EmojiPicker from 'emoji-picker-react';
import { useSocket } from '../contexts/SocketContext';

const { TextArea } = Input;

const getRoomId = (id1, id2) => {
  if (!id1 || !id2) return null;
  return [id1, id2].sort().join('_');
};

const ChatDrawer = ({ open, onClose, contact }) => {
    const [inputValue, setInputValue] = useState('');
    const [pickerVisible, setPickerVisible] = useState(false);
    const messagesEndRef = useRef(null);
    const { messageStore, sendMessage, currentUser } = useSocket();

    const roomId = getRoomId(currentUser?.id, contact?.id);
    const messages = messageStore[roomId] || [];
    

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    if (!contact || !currentUser) {
        return null;
    }

    const handleSendMessage = () => {
        if (inputValue.trim() === '') return;

        const newMessage = {
            id: Date.now(),
            text: inputValue,
            sender: currentUser.id,
            receiver: contact.id,
            senderName: currentUser.name,
            senderAvatar: `https://api.dicebear.com/7.x/miniavs/svg?seed=${currentUser.id}`
        };
        
         sendMessage(newMessage);
        
        setInputValue('');
        setPickerVisible(false);
    };
    
    const onEmojiClick = (emojiObject) => {
        setInputValue(prevInput => prevInput + emojiObject.emoji);
    };

    const currentUserAvatar = `https://api.dicebear.com/7.x/miniavs/svg?seed=${currentUser.id}`;

    return (
        <Drawer
            title={`与 ${contact.name} 的对话`}
            placement="right"
            onClose={onClose}
            open={open}
            width={400}
            bodyStyle={{ padding: 0 }}
            destroyOnClose={true}
        >
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                    <List
                        dataSource={messages}
                        renderItem={item => {
                            const isMe = item.sender === currentUser.id;
                            return (
                                <List.Item style={{ border: 'none', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                                        <Avatar src={isMe ? currentUserAvatar : contact.avatar} />
                                        <div style={{
                                            backgroundColor: isMe ? '#1890ff' : '#f0f0f0',
                                            color: isMe ? 'white' : 'black',
                                            padding: '8px 12px',
                                            borderRadius: '12px',
                                            margin: '0 8px',
                                            maxWidth: '250px',
                                            wordBreak: 'break-word',
                                        }}>
                                            {item.text}
                                        </div>
                                    </div>
                                </List.Item>
                            );
                        }}
                    />
                    <div ref={messagesEndRef} />
                </div>
                
                <div style={{ padding: '16px', borderTop: '1px solid #f0f0f0' }}>
                    <Space.Compact style={{ width: '100%' }}>
                        <Popover
                            content={ <EmojiPicker onEmojiClick={onEmojiClick} lazyLoadEmojis={true} width={350} height={400} /> }
                            trigger="click"
                            open={pickerVisible}
                            onOpenChange={setPickerVisible}
                        >
                            <Button icon={<SmileOutlined />} />
                        </Popover>
                        <TextArea
                            value={inputValue}
                            // --- 在这里修正了拼写错误 ---
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="输入消息..."
                            autoSize={{ minRows: 1, maxRows: 4 }}
                            onPressEnter={(e) => {
                                if (!e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                        />
                        <Button type="primary" icon={<SendOutlined />} onClick={handleSendMessage} />
                    </Space.Compact>
                </div>
            </div>
        </Drawer>
    );
};

export default ChatDrawer;