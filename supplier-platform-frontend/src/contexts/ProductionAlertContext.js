// src/contexts/ProductionAlertContext.js
import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useSocket } from './SocketContext';
import { message } from 'antd';

const AlertContext = createContext();
export const useProductionAlerts = () => useContext(AlertContext);

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// 提醒类型枚举
export const ALERT_TYPES = {
    NOTICE_ASSIGNED: 'notice_assigned',           // 通知单分配
    PLAN_SUBMITTED: 'plan_submitted',            // 计划提交
    PLAN_APPROVED: 'plan_approved',               // 计划批准
    PLAN_REJECTED: 'plan_rejected',               // 计划驳回
    EVIDENCE_SUBMITTED: 'evidence_submitted',     // 证据提交
    EVIDENCE_APPROVED: 'evidence_approved',       // 证据批准
    EVIDENCE_REJECTED: 'evidence_rejected',       // 证据驳回
    NOTICE_CLOSED: 'notice_closed',               // 通知单关闭
    SYSTEM_NOTIFICATION: 'system_notification',    // 系统通知
};

// 提醒优先级
export const ALERT_PRIORITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent',
};

export const AlertProvider = ({ children }) => {
    const [alerts, setAlerts] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const socket = useSocket();
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

    // 获取用户ID（支持供应商和SD/Manager）
    const getUserId = useCallback(() => {
        if (!currentUser) return null;
        return currentUser.role === 'Supplier' ? currentUser.supplier_id : currentUser.id;
    }, [currentUser]);

    // 计算未读提醒数量
    const calculateUnreadCount = useCallback((alertsList) => {
        const userId = getUserId();
        if (!userId) return 0;
        return alertsList.filter(alert => 
            alert.recipientId === userId && !alert.isRead
        ).length;
    }, [getUserId]);

    // 获取历史提醒
    const fetchHistoricalAlerts = useCallback(async () => {
        const userId = getUserId();
        if (!userId) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/api/alerts/${userId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`, // 如果有token的话
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const sortedAlerts = data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            setAlerts(sortedAlerts);
            setUnreadCount(calculateUnreadCount(sortedAlerts));
            
            console.log(`[ProductionAlertContext] 成功获取 ${data.length} 条历史提醒`);
        } catch (err) {
            console.error("[ProductionAlertContext] 获取历史提醒失败:", err);
            setError(err.message);
            
            // 生产环境下的降级处理：从localStorage获取
            try {
                const localAlerts = JSON.parse(localStorage.getItem(`alerts_${userId}`) || '[]');
                setAlerts(localAlerts);
                setUnreadCount(calculateUnreadCount(localAlerts));
            } catch (localErr) {
                console.error("[ProductionAlertContext] 本地存储也失败:", localErr);
            }
        } finally {
            setIsLoading(false);
        }
    }, [getUserId, calculateUnreadCount]);

    // 初始化时获取历史提醒
    useEffect(() => {
        fetchHistoricalAlerts();
    }, [fetchHistoricalAlerts]);

    // 监听实时提醒
    useEffect(() => {
        if (socket) {
            console.log('[ProductionAlertContext] 设置实时提醒监听器');

            const handleNewAlert = (newAlert) => {
                console.log('✅ [ProductionAlertContext] 收到新提醒:', newAlert);
                
                setAlerts(prevAlerts => {
                    const updatedAlerts = [newAlert, ...prevAlerts];
                    
                    // 更新本地存储
                    const userId = getUserId();
                    if (userId) {
                        localStorage.setItem(`alerts_${userId}`, JSON.stringify(updatedAlerts));
                    }
                    
                    return updatedAlerts;
                });

                // 显示浏览器通知（如果用户允许）
                if (Notification.permission === 'granted') {
                    new Notification(newAlert.title || '新提醒', {
                        body: newAlert.message,
                        icon: '/favicon.ico',
                        tag: newAlert.id,
                    });
                }

                // 显示Antd消息提示
                message.info({
                    content: newAlert.message,
                    duration: 4,
                });
            };

            socket.on('new_alert', handleNewAlert);

            return () => {
                console.log('[ProductionAlertContext] 清理实时提醒监听器');
                socket.off('new_alert', handleNewAlert);
            };
        }
    }, [socket, getUserId]);

    // 请求浏览器通知权限
    useEffect(() => {
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    // 创建新提醒
    const addAlert = useCallback(async (alertData) => {
        const userId = getUserId();
        if (!userId) {
            console.error('[ProductionAlertContext] 无法创建提醒：用户未登录');
            return;
        }

        const newAlert = {
            id: uuidv4(),
            senderId: alertData.senderId || userId,
            recipientId: alertData.recipientId,
            type: alertData.type || ALERT_TYPES.SYSTEM_NOTIFICATION,
            priority: alertData.priority || ALERT_PRIORITY.MEDIUM,
            title: alertData.title,
            message: alertData.message,
            link: alertData.link || '#',
            timestamp: new Date().toISOString(),
            isRead: false,
            metadata: alertData.metadata || {},
        };

        try {
            const response = await fetch(`${API_BASE_URL}/api/alerts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify(newAlert),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            console.log('[ProductionAlertContext] 提醒创建成功');
            return newAlert;
        } catch (error) {
            console.error('[ProductionAlertContext] 创建提醒失败:', error);
            
            // 降级处理：直接添加到本地状态
            setAlerts(prevAlerts => {
                const updatedAlerts = [newAlert, ...prevAlerts];
                localStorage.setItem(`alerts_${userId}`, JSON.stringify(updatedAlerts));
                return updatedAlerts;
            });
            
            throw error;
        }
    }, [getUserId]);

    // 标记为已读
    const markAsRead = useCallback(async (alertId) => {
        const userId = getUserId();
        if (!userId) return;

        try {
            // 先更新本地状态
            setAlerts(prevAlerts => {
                const updatedAlerts = prevAlerts.map(alert => 
                    alert.id === alertId ? { ...alert, isRead: true } : alert
                );
                
                // 更新本地存储
                localStorage.setItem(`alerts_${userId}`, JSON.stringify(updatedAlerts));
                
                return updatedAlerts;
            });

            // 然后同步到服务器
            await fetch(`${API_BASE_URL}/api/alerts/${alertId}/read`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });

            // 更新未读数量
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('[ProductionAlertContext] 标记已读失败:', error);
        }
    }, [getUserId]);

    // 全部标记为已读
    const markAllAsRead = useCallback(async () => {
        const userId = getUserId();
        if (!userId) return;

        try {
            setAlerts(prevAlerts => {
                const updatedAlerts = prevAlerts.map(alert => 
                    alert.recipientId === userId ? { ...alert, isRead: true } : alert
                );
                
                localStorage.setItem(`alerts_${userId}`, JSON.stringify(updatedAlerts));
                return updatedAlerts;
            });

            await fetch(`${API_BASE_URL}/api/alerts/${userId}/read-all`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });

            setUnreadCount(0);
        } catch (error) {
            console.error('[ProductionAlertContext] 全部标记已读失败:', error);
        }
    }, [getUserId]);

    // 删除提醒
    const deleteAlert = useCallback(async (alertId) => {
        const userId = getUserId();
        if (!userId) return;

        try {
            setAlerts(prevAlerts => {
                const updatedAlerts = prevAlerts.filter(alert => alert.id !== alertId);
                localStorage.setItem(`alerts_${userId}`, JSON.stringify(updatedAlerts));
                return updatedAlerts;
            });

            await fetch(`${API_BASE_URL}/api/alerts/${alertId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });

            // 重新计算未读数量
            setUnreadCount(calculateUnreadCount(alerts.filter(alert => alert.id !== alertId)));
        } catch (error) {
            console.error('[ProductionAlertContext] 删除提醒失败:', error);
        }
    }, [getUserId, alerts, calculateUnreadCount]);

    // 清空所有提醒
    const clearAllAlerts = useCallback(async () => {
        const userId = getUserId();
        if (!userId) return;

        try {
            setAlerts([]);
            setUnreadCount(0);
            localStorage.removeItem(`alerts_${userId}`);

            await fetch(`${API_BASE_URL}/api/alerts/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });
        } catch (error) {
            console.error('[ProductionAlertContext] 清空提醒失败:', error);
        }
    }, [getUserId]);

    // 获取用户相关提醒
    const getUserAlerts = useCallback(() => {
        const userId = getUserId();
        if (!userId) return [];
        return alerts.filter(alert => alert.recipientId === userId);
    }, [alerts, getUserId]);

    // 获取未读提醒
    const getUnreadAlerts = useCallback(() => {
        return getUserAlerts().filter(alert => !alert.isRead);
    }, [getUserAlerts]);

    // 按类型获取提醒
    const getAlertsByType = useCallback((type) => {
        return getUserAlerts().filter(alert => alert.type === type);
    }, [getUserAlerts]);

    // 按优先级获取提醒
    const getAlertsByPriority = useCallback((priority) => {
        return getUserAlerts().filter(alert => alert.priority === priority);
    }, [getUserAlerts]);

    const value = {
        // 状态
        alerts: getUserAlerts(),
        unreadCount,
        isLoading,
        error,
        
        // 操作方法
        addAlert,
        markAsRead,
        markAllAsRead,
        deleteAlert,
        clearAllAlerts,
        
        // 查询方法
        getUserAlerts,
        getUnreadAlerts,
        getAlertsByType,
        getAlertsByPriority,
        
        // 工具方法
        refreshAlerts: fetchHistoricalAlerts,
    };

    return (
        <AlertContext.Provider value={value}>
            {children}
        </AlertContext.Provider>
    );
};


