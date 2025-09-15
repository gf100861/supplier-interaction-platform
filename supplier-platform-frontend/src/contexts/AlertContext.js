import React, { useState, createContext, useContext, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { usePusher } from './PusherContext'; // <-- 1. 替换 useSocket
const AlertContext = createContext();
export const useAlerts = () => useContext(AlertContext);

// --- 核心修改 1：定义动态的API基础URL ---
// 如果环境变量存在（在Vercel部署时），则使用它；否则，回退到本地地址
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';


export const AlertProvider = ({ children }) => {
    const [alerts, setAlerts] = useState([]);
   const pusher = usePusher(); // <-- 2. 获取 pusher 实例
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

    // 1. 首次加载时，从后端API获取该用户的历史提醒
    useEffect(() => {
        if (currentUser?.id) {
            // --- 核心修改 2：使用动态URL ---
            fetch(`${API_BASE_URL}/api/alerts/${currentUser.id}`)
                .then(res => res.json())
                .then(data => setAlerts(data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))))
                .catch(err => console.error("获取提醒数据失败:", err));
        }
    }, [currentUser?.id]);

    // 2. 监听来自服务器的实时新提醒
     // --- 3. 核心修改：监听 Pusher 的私人频道 ---
    useEffect(() => {
        if (!pusher || !currentUser?.id) return;

        // 订阅一个以用户ID命名的“私人频道”
        const channelName = `private-${currentUser.id}`;
        const channel = pusher.subscribe(channelName);
        console.log(`[Pusher] 正在订阅私人频道: ${channelName}`);

        const handleNewAlert = (newAlert) => {
            console.log(`✅ [Pusher] 在频道 ${channelName} 收到 new_alert 事件:`, newAlert);
            setAlerts(prev => [newAlert, ...prev]);
        };
        
        channel.bind('new_alert', handleNewAlert);

        return () => {
            channel.unbind_all();
            pusher.unsubscribe(channelName);
        };
    }, [pusher, currentUser?.id]);

    // 3. addAlert 现在是调用后端API
    const addAlert = async (senderId, recipientId, message, link = '#') => {
        const newAlert = {
            id: uuidv4(),
            senderId, recipientId, message, link,
            timestamp: new Date().toISOString(),
            isRead: false,
        };

        try {
            // --- 核心修改 2：使用动态URL ---
            await fetch(`${API_BASE_URL}/api/alerts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newAlert),
            });
        } catch (error) {
            console.error("创建提醒失败:", error);
        }
    };
    
    const markAsRead = (alertId) => {
        setAlerts(prev => prev.map(a => (a.id === alertId ? { ...a, isRead: true } : a)));
    };

    const markAllAsRead = (userId) => {
        setAlerts(prev => prev.map(a => (a.recipientId === userId ? { ...a, isRead: true } : a)));
    };

    const clearAlerts = (userId) => {
        setAlerts(prev => prev.filter(a => a.recipientId !== userId));
    };

    const value = { alerts, addAlert, markAsRead, markAllAsRead, clearAlerts };

    return (
        <AlertContext.Provider value={value}>
            {children}
        </AlertContext.Provider>
    );
};