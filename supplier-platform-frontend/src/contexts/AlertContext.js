import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';

const AlertContext = createContext();

export const AlertProvider = ({ children }) => {
    const [alerts, setAlerts] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    // 获取当前用户信息
    const getCurrentUser = () => {
        try {
            const userStr = localStorage.getItem('user');
            return userStr ? JSON.parse(userStr) : null;
        } catch (e) {
            return null;
        }
    };

    // 辅助函数：根据 alerts 数组计算未读数量
    const calculateUnreadCount = (alertsList) => {
        return (alertsList || []).filter(a => !a.is_read).length;
    };

    const fetchAlerts = useCallback(async () => {
        const user = getCurrentUser();
        if (!user) {
            setAlerts([]);
            setUnreadCount(0);
            setLoading(false);
            return;
        }

        try {
            // 只获取发送给当前登录用户的通知
            let query = supabase
                .from('alerts')
                .select('*')
                .eq('target_user_id', user.id) 
                .order('created_at', { ascending: false })
                .limit(50); // 限制最近50条，避免数据过多

            const { data, error } = await query;

            if (error) throw error;

            setAlerts(data || []);
            setUnreadCount(calculateUnreadCount(data));
        } catch (error) {
            console.error("Error fetching alerts:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    // 标记单个通知为已读
const markAsRead = async (alertId) => {
        try {
            // 1. 乐观更新
            setAlerts(prev => {
                const newAlerts = prev.map(a => a.id === alertId ? { ...a, is_read: true } : a);
                setUnreadCount(calculateUnreadCount(newAlerts));
                return newAlerts;
            });

            // 2. 数据库更新
            const { error } = await supabase
                .from('alerts')
                .update({ is_read: true })
                .eq('id', alertId);

            if (error) {
                // --- 重点：查看这里的报错信息 ---
                console.error("数据库更新失败详细信息:", error.message, error.details); 
                // 如果是 RLS 错误，这里会显示 "new row violates row-level security policy"
                
                // 回滚状态
                fetchAlerts(); 
                throw error;
            } else {
                console.log("数据库已读状态更新成功");
            }
        } catch (error) {
            console.error("Error marking alert as read:", error);
        }
    };
    // 标记所有通知为已读
    const markAllAsRead = async () => {
        const user = getCurrentUser();
        if (!user) return;

        try {
            // 1. 乐观更新
            setAlerts(prev => {
                const newAlerts = prev.map(a => ({ ...a, is_read: true }));
                setUnreadCount(0);
                return newAlerts;
            });

            // 2. 后端更新
            const { error } = await supabase
                .from('alerts')
                .update({ is_read: true })
                .eq('target_user_id', user.id)
                .eq('is_read', false); // 只更新那些未读的，减少数据库压力

            if (error) {
                console.error("Error marking all alerts as read (DB):", error);
                fetchAlerts();
                throw error;
            }
        } catch (error) {
            console.error("Error marking all alerts as read:", error);
        }
    };

    // --- 新增：删除单个通知 ---
    const deleteAlert = async (alertId) => {
        try {
            // 1. 乐观更新：先从 UI 移除
            setAlerts(prev => {
                const newAlerts = prev.filter(a => a.id !== alertId);
                setUnreadCount(calculateUnreadCount(newAlerts)); // 重新计算未读数
                return newAlerts;
            });

            // 2. 后端删除
            const { error } = await supabase
                .from('alerts')
                .delete()
                .eq('id', alertId);

            if (error) {
                console.error("Error deleting alert (DB):", error);
                fetchAlerts(); // 失败兜底
                throw error;
            }
        } catch (error) {
            console.error("Error deleting alert:", error);
        }
    };

    // 实时订阅逻辑
    useEffect(() => {
        fetchAlerts();

        const user = getCurrentUser();
        if (!user) return;

        const channel = supabase.channel(`public:alerts:target_user_id=eq.${user.id}`)
            .on('postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'alerts', 
                    filter: `target_user_id=eq.${user.id}` 
                }, 
                (payload) => {
                    console.log('收到新警报:', payload.new);
                    setAlerts(prev => {
                        // 防止重复添加 (虽然 insert 事件一般是新的)
                        if (prev.some(a => a.id === payload.new.id)) return prev;
                        
                        const newAlerts = [payload.new, ...prev];
                        setUnreadCount(calculateUnreadCount(newAlerts));
                        return newAlerts;
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchAlerts]);

    const value = {
        alerts,
        unreadCount,
        loading,
        fetchAlerts,
        markAsRead,
        markAllAsRead,
        deleteAlert // 导出删除方法
    };

    return (
        <AlertContext.Provider value={value}>
            {children}
        </AlertContext.Provider>
    );
};

// 导出 Hook，方便组件使用
export const useAlert = () => {
    return useContext(AlertContext);
};