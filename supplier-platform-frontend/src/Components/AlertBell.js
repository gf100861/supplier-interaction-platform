import React, { useMemo } from 'react';
import { Badge, Dropdown, List, Avatar, Button, Typography, Space } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useAlerts } from '../contexts/AlertContext';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { mockUsers } from '../data/_mockData';
import { useNavigate } from 'react-router-dom'; // 1. 引入 useNavigate
dayjs.extend(relativeTime);
const { Text } = Typography;

export const AlertBell = () => {
    const { alerts, markAsRead, markAllAsRead, clearAlerts } = useAlerts();
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);
    const navigate = useNavigate(); // 2. 获取 navigate 函数
    const userLookup = useMemo(() => {
        return Object.values(mockUsers).reduce((acc, user) => {
            acc[user.id] = user.name;
            return acc;
        }, {});
    }, []);

    const userAlerts = useMemo(() => {
        if (!currentUser) return [];
        return alerts.filter(alert => alert.recipientId === currentUser.id);
    }, [alerts, currentUser?.id]);

    const unreadCount = useMemo(() => {
        return userAlerts.filter(a => !a.isRead).length;
    }, [userAlerts]);
    
    const handleAlertClick = (alert) => {
        if (!alert.isRead) {
            markAsRead(alert.id);
        }
        // 如果提醒中包含链接，则执行跳转
        if (alert.link) {
            navigate(alert.link);
        }
    };
    
    const handleMarkAllAsRead = () => {
        if (currentUser) {
            markAllAsRead(currentUser.id);
        }
    };
    
    const handleClearAll = () => {
        if (currentUser) {
            clearAlerts(currentUser.id);
        }
    };

    const menu = (
        <div style={{ width: 350, backgroundColor: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', borderRadius: '4px' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong>提醒中心</Text>
                <Space>
                    {unreadCount > 0 && <Button type="link" size="small" onClick={handleMarkAllAsRead}>全部标为已读</Button>}
                    {userAlerts.length > 0 && <Button type="link" danger size="small" onClick={handleClearAll}>清空提醒</Button>}
                </Space>
            </div>
            <List
                itemLayout="horizontal"
                dataSource={userAlerts.slice(0, 10)}
                locale={{ emptyText: '暂无提醒' }}
                renderItem={item => {
                    const senderName = userLookup[item.senderId] || '系统';
                    return (
                        <List.Item
                            onClick={() => handleAlertClick(item)}
                            style={{ padding: '12px 16px', cursor: 'pointer', backgroundColor: item.isRead ? 'transparent' : '#e6f7ff' }}
                        >
                            <List.Item.Meta
                                avatar={<Avatar icon={<BellOutlined />} style={{ backgroundColor: '#1890ff' }} />}
                                title={<Text type={item.isRead ? 'secondary' : 'primary'}>{item.message}</Text>}
                                description={<Text type="secondary">来自: {senderName} • {dayjs(item.timestamp).fromNow()}</Text>}
                            />
                        </List.Item>
                    );
                }}
            />
        </div>
    );

    return (
        <Dropdown overlay={menu} trigger={['click']}>
            <span style={{ cursor: 'pointer', marginRight: '24px' }}>
                <Badge count={unreadCount}>
                    <BellOutlined style={{ fontSize: '20px' }} />
                </Badge>
            </span>
        </Dropdown>
    );
};