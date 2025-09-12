import React, { useState, createContext, useContext, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useSocket } from './SocketContext';

const AlertContext = createContext();
export const useAlerts = () => useContext(AlertContext);

export const AlertProvider = ({ children }) => {
    const [alerts, setAlerts] = useState([]);
    const socket = useSocket();
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

    // 1. 首次加载时，从后端API获取该用户的历史提醒
    useEffect(() => {
        if (currentUser?.id) {
            fetch(`http://localhost:3001/api/alerts/${currentUser.id}`)
                .then(res => res.json())
                .then(data => setAlerts(data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))))
                .catch(err => console.error("获取提醒数据失败:", err));
        }
    }, [currentUser?.id]);

    // 2. 监听来自服务器的实时新提醒
      useEffect(() => {
        if (!socket) {
            console.log("🟡 [FRONTEND-CHECKPOINT-3] AlertContext 正在等待 WebSocket 连接...");
            return;
        }

        console.log("🟢 [FRONTEND-CHECKPOINT-3] WebSocket 已连接，正在绑定 'new_alert' 监听器。");
        
        const handleNewAlert = (newAlert) => {
            console.log("🎉🎉🎉 [FRONTEND-CHECKPOINT-3] 成功！已收到 'new_alert' 事件:", newAlert);
            setAlerts(prev => [newAlert, ...prev]);
        };

        socket.on('new_alert', handleNewAlert);

        return () => {
            console.log("🔴 [FRONTEND-CHECKPOINT-3] 正在清理 'new_alert' 监听器。");
            socket.off('new_alert', handleNewAlert);
        };
    }, [socket]);

    // 3. addAlert 调用后端API
    const addAlert = async (senderId, recipientId, message, link = '#') => {
        const newAlert = {
            id: uuidv4(),
            senderId, recipientId, message, link,
            timestamp: new Date().toISOString(),
            isRead: false,
        };

        try {
            await fetch('http://localhost:3001/api/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newAlert),
            });
            // 成功后无需任何操作，等待WebSocket推送
        } catch (error) {
            console.error("创建提醒失败:", error);
        }
    };
    
    // 4. --- 核心修正：清理并简化其他函数 ---
    // 在真实应用中，这些也应该是API调用，但为了演示，我们暂时只修改前端state
    const markAsRead = (alertId) => {
        setAlerts(prev => prev.map(a => (a.id === alertId ? { ...a, isRead: true } : a)));
    };

    const markAllAsRead = (userId) => {
        setAlerts(prev => prev.map(a => (a.recipientId === userId ? { ...a, isRead: true } : a)));
    };

    const clearAlerts = (userId) => {
        setAlerts(prev => prev.filter(a => a.recipientId !== userId));
        // 在真实应用中，这里应该调用后端的 DELETE /api/alerts/:userId
    };

    const value = { alerts, addAlert, markAsRead, markAllAsRead, clearAlerts };

    return (
        <AlertContext.Provider value={value}>
            {children}
        </AlertContext.Provider>
    );
};