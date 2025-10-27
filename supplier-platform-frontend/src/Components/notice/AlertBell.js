import React, { useState } from 'react';
import { Badge, Popover, List, Button, Avatar, Spin, Empty } from 'antd';
import { BellOutlined, MailOutlined } from '@ant-design/icons';
import { useAlerts } from '../../contexts/AlertContext';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export const AlertBell = () => {
    const { alerts, loading, markAsRead } = useAlerts();
    const [popoverVisible, setPopoverVisible] = useState(false);
    const navigate = useNavigate();

    const unreadCount = alerts.filter(alert => !alert.is_read).length;

    const handleAlertClick = (alert) => {
        // 标记为已读 (这个函数您需要在 AlertContext 中实现)
        // markAsRead(alert.id); 
        
        // 跳转到链接
        if (alert.link) {
            navigate(alert.link);
        }
        setPopoverVisible(false);
    };

    const handleMarkAllAsRead = () => {
        // 在这里调用一个函数来将所有 alerts 标记为已读
        // 示例：alerts.forEach(a => markAsRead(a.id));
        console.log("（功能待实现）标记所有为已读");
    };

    const content = (
        <div style={{ width: 350 }}>
            {loading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                    <Spin />
                </div>
            ) : unreadCount === 0 ? (
                <Empty description="没有未读提醒" />
            ) : (
                <List
                    itemLayout="horizontal"
                    dataSource={alerts.filter(a => !a.is_read).slice(0, 5)} // 最多显示5条
                    renderItem={item => (
                        <List.Item
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleAlertClick(item)}
                        >
                            <List.Item.Meta
                                avatar={<Avatar style={{ backgroundColor: '#1890ff' }} icon={<MailOutlined />} />}
                                title={<a>{item.message}</a>}
                                description={`${item.creator_name || '系统'} · ${dayjs(item.created_at).fromNow()}`}
                            />
                        </List.Item>
                    )}
                />
            )}
            <div style={{ borderTop: '1px solid #f0f0f0', padding: '8px', textAlign: 'center' }}>
                <Button type="link" onClick={handleMarkAllAsRead} disabled={unreadCount === 0}>
                    全部标记为已读
                </Button>
            </div>
        </div>
    );

    return (
        <Popover
            content={content}
            title="未读提醒"
            trigger="click"
            open={popoverVisible}
            onOpenChange={setPopoverVisible}
            placement="bottomRight"
        >
            <Badge count={unreadCount} size="small">
                <BellOutlined style={{ fontSize: '20px', cursor: 'pointer' }} />
            </Badge>
        </Popover>
    );
};