import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
// ❌ 移除 Supabase
// import { supabase } from '../supabaseClient';

const AlertContext = createContext();

// 🔧 环境配置
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_URL = isDev
    ? 'http://localhost:3001'
    : 'https://supplier-interaction-backend.vercel.app'; // ⚠️ 替换为真实域名

export const AlertProvider = ({ children }) => {
    const [alerts, setAlerts] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const getCurrentUser = () => {
        try {
            const userStr = localStorage.getItem('user');
            return userStr ? JSON.parse(userStr) : null;
        } catch (e) {
            return null;
        }
    };

    const calculateUnreadCount = (alertsList) => {
        return (alertsList || []).filter(a => !a.is_read).length;
    };

    // --- 1. 获取通知 (GET) ---
    const fetchAlerts = useCallback(async () => {
        const user = getCurrentUser();
        if (!user) {
            setAlerts([]);
            setLoading(false);
            return;
        }

        try {
            const apiPath = isDev ? `/api/alerts` : `/api/alerts.js`;
            const targetUrl = `${BACKEND_URL}${apiPath}`;
            const response = await fetch(`${targetUrl}?userId=${user.id}`);
            if (!response.ok) throw new Error('Fetch failed');
            
            const data = await response.json();
            setAlerts(data || []);
            setUnreadCount(calculateUnreadCount(data));
        } catch (error) {
            console.error("Error fetching alerts:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    // --- 2. 标记单个已读 (PATCH) ---
    const markAsRead = async (alertId) => {
        try {
            // 乐观更新
            setAlerts(prev => {
                const newAlerts = prev.map(a => a.id === alertId ? { ...a, is_read: true } : a);
                setUnreadCount(calculateUnreadCount(newAlerts));
                return newAlerts;
            });

            // 调用后端
            const apiPath = isDev ? `/api/alerts` : `/api/alerts.js`;
            const targetUrl = `${BACKEND_URL}${apiPath}`;
            await fetch(`${targetUrl}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'markAsRead', alertId })
            });
        } catch (error) {
            console.error("Error marking alert as read:", error);
            fetchAlerts(); // 回滚
        }
    };

    // --- 3. 标记全部已读 (PATCH) ---
    const markAllAsRead = async () => {
        const user = getCurrentUser();
        if (!user) return;

        try {
            // 乐观更新
            setAlerts(prev => {
                const newAlerts = prev.map(a => ({ ...a, is_read: true }));
                setUnreadCount(0);
                return newAlerts;
            });

            // 调用后端
            const apiPath = isDev ? `/api/alerts` : `/api/alerts.js`;
            const targetUrl = `${BACKEND_URL}${apiPath}`;
            await fetch(`${targetUrl}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'markAllAsRead', userId: user.id })
            });
        } catch (error) {
            console.error("Error marking all read:", error);
            fetchAlerts();
        }
    };

    // --- 4. 删除通知 (DELETE) ---
    const deleteAlert = async (alertId) => {
        try {
            // 乐观更新
            setAlerts(prev => {
                const newAlerts = prev.filter(a => a.id !== alertId);
                setUnreadCount(calculateUnreadCount(newAlerts));
                return newAlerts;
            });

            // 调用后端
            const apiPath = isDev ? `/api/alerts` : `/api/alerts.js`;
            const targetUrl = `${BACKEND_URL}${apiPath}`;
            await fetch(`${targetUrl}?alertId=${alertId}`, {
                method: 'DELETE'
            });
        } catch (error) {
            console.error("Error deleting alert:", error);
            fetchAlerts();
        }
    };

    // --- 实时订阅逻辑 (暂时移除) ---
    // 由于我们移除了前端 Supabase 客户端，前端无法直接监听数据库变更。
    // 在迁移到 Azure + Socket.IO 架构完善前，建议使用短轮询或手动刷新。
    useEffect(() => {
        fetchAlerts();
        
        // 可选：简单的轮询 (每30秒刷新一次)
        const interval = setInterval(fetchAlerts, 30000);
        return () => clearInterval(interval);
    }, [fetchAlerts]);

    const value = {
        alerts,
        unreadCount,
        loading,
        fetchAlerts,
        markAsRead,
        markAllAsRead,
        deleteAlert
    };

    return (
        <AlertContext.Provider value={value}>
            {children}
        </AlertContext.Provider>
    );
};

export const useAlert = () => {
    return useContext(AlertContext);
};