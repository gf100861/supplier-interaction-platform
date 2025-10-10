// src/Components/ProductionAlertBell.js
import React, { useMemo, useState } from 'react';
import { Badge, Dropdown, List, Typography, Button, Space, Tag, Divider, Empty } from 'antd';
import { BellOutlined, CheckOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useProductionAlerts, ALERT_TYPES, ALERT_PRIORITY } from '../contexts/ProductionAlertContext';


dayjs.extend(relativeTime);
const { Text, Title } = Typography;

// 提醒类型图标映射
const ALERT_TYPE_ICONS = {
    [ALERT_TYPES.NOTICE_ASSIGNED]: '📋',
    [ALERT_TYPES.PLAN_SUBMITTED]: '📝',
    [ALERT_TYPES.PLAN_APPROVED]: '✅',
    [ALERT_TYPES.PLAN_REJECTED]: '❌',
    [ALERT_TYPES.EVIDENCE_SUBMITTED]: '📸',
    [ALERT_TYPES.EVIDENCE_APPROVED]: '✅',
    [ALERT_TYPES.EVIDENCE_REJECTED]: '❌',
    [ALERT_TYPES.NOTICE_CLOSED]: '🔒',
    [ALERT_TYPES.SYSTEM_NOTIFICATION]: '🔔',
};

// 优先级颜色映射
const PRIORITY_COLORS = {
    [ALERT_PRIORITY.LOW]: 'default',
    [ALERT_PRIORITY.MEDIUM]: 'processing',
    [ALERT_PRIORITY.HIGH]: 'warning',
    [ALERT_PRIORITY.URGENT]: 'error',
};

export const ProductionAlertBell = () => {
    const {
        alerts,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        deleteAlert,
        clearAllAlerts,
        getUnreadAlerts,
    } = useProductionAlerts();

    const mockUsers = {
    'philip': { id: 'sd_01', password: '123', role: 'Manager', name: 'Philip Wang (Manager)', email: '325579336a@gmail.com', },
    'xiaobing': { id: 'sd_02', password: '123', role: 'SD', name: 'Xiaobing Wu (SD)', email: '325579336a@gmail.com' },
    // --- 新增用户 ---
    'anna': { id: 'sd_03', password: '123', role: 'SD', name: 'Anna Li (SD)', email: 'anna.li@example.com' },
    // 为供应商添加邮箱
    'zhangsan': { id: 'sup_A', password: '123', role: 'Supplier', name: '张三 (供应商A)', email: '325579336a@gmail.com' },
    'lisi': { id: 'sup_B', password: '123', role: 'Supplier', name: '李四 (供应商B)', email: '325579336a@gmail.com' },
};

    const navigate = useNavigate();
    const [dropdownVisible, setDropdownVisible] = useState(false);
     const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

     console.log(currentUser)
    // 用户名称映射
    const userLookup = useMemo(() => {
        return Object.values(mockUsers).reduce((acc, user) => {
            acc[user.id] = user.name;
            return acc;
        }, {});
    }, []);

    // 处理提醒点击
    const handleAlertClick = async (alert) => {
        if (!alert.isRead) {
            await markAsRead(alert.id);
        }
        
        // 关闭下拉菜单
        setDropdownVisible(false);
        
        // 如果有链接，则跳转
        if (alert.link && alert.link !== '#') {
            navigate(alert.link);
        }
    };

    // 处理全部已读
    const handleMarkAllAsRead = async () => {
        await markAllAsRead();
        setDropdownVisible(false);
    };

    // 处理清空所有
    const handleClearAll = async () => {
        await clearAllAlerts();
        setDropdownVisible(false);
    };

    // 处理删除单个提醒
    const handleDeleteAlert = async (alertId, e) => {
        e.stopPropagation();
        await deleteAlert(alertId);
    };

    // 渲染提醒项
    const renderAlertItem = (alert) => {
        const isUnread = !alert.isRead;
        const typeIcon = ALERT_TYPE_ICONS[alert.type] || '🔔';
        const priorityColor = PRIORITY_COLORS[alert.priority] || 'default';
        const senderName = userLookup[alert.senderId] || '系统';

        return (
            <List.Item
                key={alert.id}
                className={`alert-item ${isUnread ? 'unread' : ''}`}
                onClick={() => handleAlertClick(alert)}
                style={{
                    cursor: 'pointer',
                    backgroundColor: isUnread ? '#f0f9ff' : 'transparent',
                    borderLeft: isUnread ? '3px solid #1890ff' : '3px solid transparent',
                    padding: '12px 16px',
                }}
                actions={[
                    <Button
                        key="delete"
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={(e) => handleDeleteAlert(alert.id, e)}
                        style={{ color: '#ff4d4f' }}
                    />,
                ]}
            >
                <List.Item.Meta
                    avatar={
                        <div style={{ fontSize: '20px' }}>
                            {typeIcon}
                        </div>
                    }
                    title={
                        <Space>
                            <Text strong={isUnread} style={{ fontSize: '14px' }}>
                                {alert.title || '新提醒'}
                            </Text>
                            <Tag color={priorityColor} size="small">
                                {alert.priority}
                            </Tag>
                            {isUnread && <div className="unread-dot" />}
                        </Space>
                    }
                    description={
                        <div>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                {alert.message}
                            </Text>
                            <br />
                            <Space size="small" style={{ marginTop: 4 }}>
                                <Text type="secondary" style={{ fontSize: '11px' }}>
                                    来自: {senderName}
                                </Text>
                                <Text type="secondary" style={{ fontSize: '11px' }}>
                                    {dayjs(alert.timestamp).fromNow()}
                                </Text>
                            </Space>
                        </div>
                    }
                />
            </List.Item>
        );
    };

    // 下拉菜单内容
    const dropdownContent = (
        <div style={{ width: 400, maxHeight: 500 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Title level={5} style={{ margin: 0 }}>
                        提醒中心
                        {unreadCount > 0 && (
                            <Badge count={unreadCount} size="small" style={{ marginLeft: 8 }} />
                        )}
                    </Title>
                    <Space>
                        {unreadCount > 0 && (
                            <Button
                                type="text"
                                size="small"
                                icon={<CheckOutlined />}
                                onClick={handleMarkAllAsRead}
                            >
                                全部已读
                            </Button>
                        )}
                        <Button
                            type="text"
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={handleClearAll}
                            danger
                        >
                            清空
                        </Button>
                    </Space>
                </Space>
            </div>

            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {alerts.length === 0 ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="暂无提醒"
                        style={{ padding: '40px 20px' }}
                    />
                ) : (
                    <List
                        dataSource={alerts}
                        renderItem={renderAlertItem}
                        loading={isLoading}
                        size="small"
                    />
                )}
            </div>

            {alerts.length > 0 && (
                <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
                    <Button type="link" size="small" onClick={() => navigate('/alerts')}>
                        查看全部提醒
                    </Button>
                </div>
            )}
        </div>
    );

    return (
        <Dropdown
            overlay={dropdownContent}
            trigger={['click']}
            placement="bottomRight"
            visible={dropdownVisible}
            onVisibleChange={setDropdownVisible}
        >
            <Badge count={unreadCount} size="small" offset={[-5, 5]}>
                <Button
                    type="text"
                    icon={<BellOutlined />}
                    style={{
                        fontSize: '18px',
                        color: unreadCount > 0 ? '#1890ff' : '#8c8c8c',
                        transition: 'color 0.3s',
                    }}
                />
            </Badge>
        </Dropdown>
    );
};

// 添加CSS样式
const styles = `
.alert-item.unread {
    position: relative;
}

.unread-dot {
    width: 6px;
    height: 6px;
    background-color: #ff4d4f;
    border-radius: 50%;
    display: inline-block;
    margin-left: 4px;
}

.alert-item:hover {
    background-color: #f5f5f5 !important;
}

.alert-item.unread:hover {
    background-color: #e6f7ff !important;
}
`;

// 动态添加样式
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
}


