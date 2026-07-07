import React from 'react';
import { Badge, Popover, List, Button, Typography, Empty, Space, Tooltip, Grid } from 'antd';
import { BellOutlined, CheckCircleOutlined, DeleteOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAlert } from '../../contexts/AlertContext';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Text } = Typography;
const { useBreakpoint } = Grid;

export const AlertBell = () => {
    const { 
        alerts, 
        unreadCount, 
        markAsRead, 
        markAllAsRead, 
        deleteAlert 
    } = useAlert();
    
    const navigate = useNavigate();
    const screens = useBreakpoint();
    const isMobile = !screens.md;

    const handleItemClick = (item) => {
        if (!item.is_read) {
            markAsRead(item.id);
        }
        if (item.link) {
            navigate(item.link);
        }
    };

    const handleDelete = (e, itemId) => {
        e.stopPropagation();
        deleteAlert(itemId);
    };

    const content = (
        <div style={{ 
            width: isMobile ? 250 : 360, 
            maxHeight: isMobile ? '60vh' : 450, 
            display: 'flex', 
            flexDirection: 'column' 
        }}>
            {/* 顶部栏 */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '12px 16px',
                borderBottom: '1px solid #f0f0f0'
            }}>
                <Text strong>消息通知 ({unreadCount})</Text>
                
                {/* 修改部分：只保留图标，去除文字，增加 Tooltip */}
                <Tooltip title="全部已读">
                    <Button 
                        type="text" // 改为 text 类型，看起来更像纯图标
                        size="small" 
                        icon={<CheckCircleOutlined style={{ fontSize: '16px', color: unreadCount > 0 ? '#1890ff' : undefined }} />} 
                        onClick={markAllAsRead}
                        disabled={unreadCount === 0}
                    />
                </Tooltip>
            </div>
            
            {/* 列表区域 */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                <List
                    dataSource={alerts}
                    renderItem={(item) => (
                        <List.Item 
                            onClick={() => handleItemClick(item)}
                            style={{ 
                                cursor: 'pointer', 
                                background: item.is_read ? '#fff' : '#e6f7ff',
                                padding: '12px 16px',
                                transition: 'background 0.3s',
                                position: 'relative'
                            }}
                            className="alert-item-hover"
                            actions={[
                                <Tooltip title="删除">
                                    <Button 
                                        type="text" 
                                        size="small" 
                                        icon={<DeleteOutlined style={{ fontSize: '12px', color: '#999' }} />} 
                                        onClick={(e) => handleDelete(e, item.id)}
                                    />
                                </Tooltip>
                            ]}
                        >
                            <List.Item.Meta
                                title={
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                        {!item.is_read && (
                                            <Badge status="processing" color="#1890ff" style={{ marginTop: '6px' }} />
                                        )}
                                        <Text 
                                            ellipsis={{ tooltip: item.message }} 
                                            style={{ 
                                                fontWeight: item.is_read ? 'normal' : 'bold', 
                                                fontSize: '13px',
                                                color: item.is_read ? '#595959' : '#262626',
                                                flex: 1
                                            }}
                                        >
                                            {item.message}
                                        </Text>
                                    </div>
                                }
                                description={
                                    <Space size={4} style={{ fontSize: '11px', color: '#8c8c8c', marginTop: '4px', marginLeft: item.is_read ? 0 : 14 }}>
                                        <ClockCircleOutlined />
                                        {dayjs(item.created_at).fromNow()}
                                    </Space>
                                }
                            />
                        </List.Item>
                    )}
                    locale={{ 
                        emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无通知" style={{ margin: '20px 0' }} /> 
                    }}
                />
            </div>
        </div>
    );

    return (
        <Popover 
            content={content} 
            trigger="click" 
            placement="bottomRight"
            overlayInnerStyle={{ padding: 0 }}
            arrow={false}
        >
            <span style={{ padding: '0 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', height: '100%' }}>
                <Badge count={unreadCount} size="small" offset={[2, -2]} overflowCount={99}>
                    <BellOutlined style={{ fontSize: '20px', color: 'inherit' }} />
                </Badge>
            </span>
        </Popover>
    );
};