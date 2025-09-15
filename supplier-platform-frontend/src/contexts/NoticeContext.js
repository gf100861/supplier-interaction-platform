import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePusher } from './PusherContext'; // <-- 1. 替换 useSocket
const NoticeContext = createContext();

// --- 核心修改 1：定义动态的API基础URL ---
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const NoticeProvider = ({ children }) => {
    const [notices, setNotices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
     const pusher = usePusher(); // <-- 2. 获取 pusher 实例

    useEffect(() => {
        const fetchNotices = async () => {
            try {
                // --- 核心修改 2：使用动态URL ---
                const response = await fetch(`${API_BASE_URL}/api/notices`);
                if (!response.ok) {
                    throw new Error(`HTTP 错误！状态: ${response.status}`);
                }
                const data = await response.json();
                setNotices(data);
                setError(null);
            } catch (err) {
                console.error("从后端获取数据失败:", err);
                setError("无法加载数据，请确保后端服务已开启。");
            } finally {
                setLoading(false);
            }
        };
        fetchNotices();
    }, []);

   useEffect(() => {
        if (!pusher) return;

        // 订阅一个名为 'updates' 的公共频道
        const channel = pusher.subscribe('updates');
        
        const handleNoticeUpdate = (updatedNotice) => {
            console.log('✅ [Pusher] 收到 notice_updated 事件:', updatedNotice);
            setNotices(prev => prev.map(n => n.id === updatedNotice.id ? updatedNotice : n));
        };
        const handleNoticesAdded = (addedNotices) => {
            console.log('✅ [Pusher] 收到 notices_added 事件:', addedNotices);
            setNotices(prev => [...prev, ...addedNotices]);
        };

        // 绑定事件监听
        channel.bind('notice_updated', handleNoticeUpdate);
        channel.bind('notices_added', handleNoticesAdded);

        // 组件卸载时，解除绑定和订阅
        return () => {
            channel.unbind_all();
            pusher.unsubscribe('updates');
        };
    }, [pusher]); // 当 pusher 连接成功后，执行此 effect

    const updateNotice = async (noticeId, updates) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/notices/${noticeId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!response.ok) {
                throw new Error(`HTTP 错误！状态: ${response.status}`);
            }
            // 成功后，我们不再手动更新state，而是等待WebSocket广播
        } catch (err) {
            console.error("更新通知单失败:", err);
            // 这里可以抛出错误或用 messageApi 显示
            throw err; 
        }
    };

    const addNotices = async (newNoticesArray) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/notices/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newNoticesArray),
            });
            if (!response.ok) {
                throw new Error(`HTTP 错误！状态: ${response.status}`);
            }
        } catch (err) {
            console.error("批量创建通知单失败:", err);
            throw err;
        }
    };

    const value = { notices, loading, error, updateNotice, addNotices };

    return (
        <NoticeContext.Provider value={value}>
            {children}
        </NoticeContext.Provider>
    );
};

export const useNotices = () => {
    return useContext(NoticeContext);
};