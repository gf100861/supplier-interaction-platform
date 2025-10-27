import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useNotification } from './NotificationContext'; // 用于弹出通知

const AlertContext = createContext();

export const AlertProvider = ({ children }) => {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const { notificationApi } = useNotification();
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

    // 1. 在组件加载时，获取所有“未读”的提醒
    useEffect(() => {
        if (!currentUser?.id) {
            setLoading(false);
            return;
        }

        const fetchInitialAlerts = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('alerts')
                .select('*')
                .eq('is_read', false)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("获取提醒失败:", error);
            } else {
                setAlerts(data || []);
            }
            setLoading(false);
        };
        fetchInitialAlerts();
    }, [currentUser?.id]);

    // 2. 核心：使用 Supabase Realtime 监听 'alerts' 表
    useEffect(() => {
        if (!currentUser?.id) return;

        // 监听 'alerts' 表中所有新的“插入” (INSERT) 事件
        const channel = supabase.channel('public:alerts')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'alerts' },
                (payload) => {
                    // Supabase Realtime 会自动应用 RLS 策略
                    // 因此，我们只会收到“发给我们”的提醒
                    const newAlert = payload.new;
                    
                    // 在前端 state 中增加这条新提醒
                    setAlerts(prevAlerts => [newAlert, ...prevAlerts]);
                    
                    // 弹出桌面通知
                    notificationApi.info({
                        message: newAlert.creator_name ? `${newAlert.creator_name} 发来了新提醒` : '您有一条新提醒',
                        description: newAlert.message,
                        placement: 'bottomRight',
                    });
                }
            )
            .subscribe();

        // 组件卸载时，清理订阅
        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUser?.id, notificationApi]);

    // 3. (可选) 标记为已读的函数
    const markAsRead = async (alertId) => {
        // ... (在这里实现更新数据库 'is_read' 字段的逻辑)
    };

    const value = { alerts, loading, markAsRead };

    return (
        <AlertContext.Provider value={value}>
            {children}
        </AlertContext.Provider>
    );
};

export const useAlerts = () => {
    return useContext(AlertContext);
};