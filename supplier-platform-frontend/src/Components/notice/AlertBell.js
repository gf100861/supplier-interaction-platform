import React, { useState } from 'react';
import { Badge, Popover, List, Button, Avatar, Spin, Empty, Typography, Tooltip } from 'antd';
import { BellOutlined, MailOutlined, CheckCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAlerts } from '../../contexts/AlertContext';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text } = Typography;

export const AlertBell = () => {
    // 引入 deleteAlert
    const { alerts, loading, markAsRead, markAllAsRead, deleteAlert, unreadCount } = useAlerts();
    const [popoverVisible, setPopoverVisible] = useState(false);
    const navigate = useNavigate();

    const handleAlertClick = async (alert) => {
        if (!alert.is_read) {
            await markAsRead(alert.id);
        }
        
        if (alert.link) {
            navigate(alert.link);
        }
        
        setPopoverVisible(false);
    };

    const handleMarkAllAsRead = async () => {
        await markAllAsRead();
    };

    // 处理删除点击
    const handleDelete = async (e, alertId) => {
        e.stopPropagation(); // 阻止冒泡，防止触发 handleAlertClick
        await deleteAlert(alertId);
    };

    const content = (
        <div style={{ width: 380, maxHeight: 500, display: 'flex', flexDirection: 'column' }}>
            <div style={{ 
                padding: '12px 16px', 
                borderBottom: '1px solid #f0f0f0', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center' 
            }}>
                <Text strong style={{ fontSize: 16 }}>通知中心</Text>
                <Button 
                    type="link" 
                    onClick={handleMarkAllAsRead} 
                    disabled={unreadCount === 0}
                    size="small"
                    icon={<CheckCircleOutlined />}
                    style={{ padding: 0 }}
                >
                    全部已读
                </Button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 100 }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <Spin tip="加载中..." />
                    </div>
                ) : alerts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <Empty description="暂无通知" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    </div>
                ) : (
                    <List
                        itemLayout="horizontal"
                        dataSource={alerts}
                        renderItem={item => (
                            <List.Item
                                className="alert-item"
                                style={{ 
                                    cursor: 'pointer',
                                    padding: '12px 16px',
                                    backgroundColor: item.is_read ? '#fff' : '#e6f7ff', 
                                    borderBottom: '1px solid #f0f0f0',
                                    transition: 'all 0.3s',
                                    position: 'relative' // 为绝对定位做准备（如果需要）
                                }}
                                onClick={() => handleAlertClick(item)}
                                onMouseEnter={(e) => { 
                                    e.currentTarget.style.backgroundColor = item.is_read ? '#fafafa' : '#bae7ff'; 
                                    // 显示删除按钮逻辑可以加在这里，或者一直显示
                                }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = item.is_read ? '#fff' : '#e6f7ff'; }}
                                // 添加 actions
                                actions={[
                                    <Tooltip title="删除通知">
                                        <Button 
                                            type="text" 
                                            size="small" 
                                            icon={<DeleteOutlined />} 
                                            onClick={(e) => handleDelete(e, item.id)}
                                            style={{ color: '#999' }}
                                            className="delete-btn"
                                        />
                                    </Tooltip>
                                ]}
                            >
                                <List.Item.Meta
                                    avatar={
                                        <Badge dot={!item.is_read} offset={[-2, 2]} color="#1890ff">
                                            <Avatar 
                                                style={{ 
                                                    backgroundColor: item.is_read ? '#f0f0f0' : '#1890ff', 
                                                    color: item.is_read ? '#bfbfbf' : '#fff' 
                                                }} 
                                                icon={<MailOutlined />} 
                                            />
                                        </Badge>
                                    }
                                    title={
                                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '24px' }}>
                                            <Text 
                                                strong={!item.is_read} 
                                                style={{ color: item.is_read ? '#595959' : '#262626', fontSize: 14 }}
                                                ellipsis={{ tooltip: item.message }}
                                            >
                                                {item.message}
                                            </Text>
                                        </div>
                                    }
                                    description={
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                {item.creator_name || '系统通知'}
                                            </Text>
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                {dayjs(item.created_at).fromNow()}
                                            </Text>
                                        </div>
                                    }
                                />
                            </List.Item>
                        )}
                    />
                )}
            </div>
            
            {alerts.length > 0 && (
                <div style={{ 
                    padding: '8px 16px', 
                    borderTop: '1px solid #f0f0f0', 
                    textAlign: 'center',
                    backgroundColor: '#fafafa'
                }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>只显示最近 50 条通知</Text>
                </div>
            )}
        </div>
    );

    return (
        <Popover
            content={content}
            trigger="click"
            open={popoverVisible}
            onOpenChange={setPopoverVisible}
            placement="bottomRight"
            overlayInnerStyle={{ padding: 0, borderRadius: 8, boxShadow: '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)' }}
            arrow={false}
        >
            <span 
                className="alert-bell-trigger"
                style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    padding: '0 12px', 
                    cursor: 'pointer',
                    height: '64px',
                    transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.025)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
                <Badge count={unreadCount} overflowCount={99} size="small" offset={[4, -4]}>
                    <BellOutlined style={{ fontSize: '20px', color: '#000000e0' }} /> 
                </Badge>
            </span>
        </Popover>
    );
};