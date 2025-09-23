import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const NoticeContext = createContext();

// --- 辅助函数：将 snake_case 转换为 camelCase (保持不变) ---
const toCamel = (s) => {
  return s.replace(/([-_][a-z])/ig, ($1) => {
    return $1.toUpperCase()
      .replace('-', '')
      .replace('_', '');
  });
};
const convertKeysToCamelCase = (obj) => {
    if (Array.isArray(obj)) {
        return obj.map(v => convertKeysToCamelCase(v));
    } else if (obj !== null && obj.constructor === Object) {
        return Object.keys(obj).reduce((result, key) => {
            result[toCamel(key)] = convertKeysToCamelCase(obj[key]);
            return result;
        }, {});
    }
    return obj;
};

export const NoticeProvider = ({ children }) => {
    const [notices, setNotices] = useState([]);
    const [loading, setLoading] = useState(true);

     useEffect(() => {
        const fetchNotices = async () => {
            try {
                // --- 核心修改：在 select 语句中加入对 suppliers 表的关联查询 ---
                // 这个查询的意思是:
                // 1. 从 'notices' 表获取所有列 (*)
                // 2. 同时，获取关联的 'users' 表的信息，并重命名为 'creator'
                // 3. 同时，获取关联的 'suppliers' 表的信息，并选择我们需要的 parma_id 和 short_code
                const { data, error } = await supabase
                    .from('notices')
                    .select(`
                        *,
                        creator:users ( id, username, email, role ),
                        supplier:suppliers ( parma_id, short_code )
                    `)
                    .order('created_at', { ascending: false });
                
                if (error) throw error;

                // 对所有返回的数据（包括嵌套的关联数据）进行“翻译”
                const camelCaseData = convertKeysToCamelCase(data);
                setNotices(camelCaseData);

            } catch (err) {
                console.error("从Supabase获取通知单数据失败:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchNotices();

        const channel = supabase.channel('public:notices')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, (payload) => {
                // 对实时推送的数据也进行“翻译”，这部分逻辑是正确的
                if (payload.eventType === 'INSERT') {
                    setNotices(prev => [convertKeysToCamelCase(payload.new), ...prev]);
                }
                if (payload.eventType === 'UPDATE') {
                    const updatedNotice = convertKeysToCamelCase(payload.new);
                    setNotices(prev => prev.map(n => n.id === updatedNotice.id ? updatedNotice : n));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);


    // --- 4. 重写 updateNotice 函数，使用 Supabase API ---
    const updateNotice = async (noticeId, updates) => {
        try {
            console.log('[NoticeContext.updateNotice] request', { noticeId, updates });
            const { data, error } = await supabase
                .from('notices')
                .update(updates)
                .eq('id', noticeId)
                .select('*')
                .single();
            if (error) throw error;

            // 乐观更新：立即在本地状态中合并更新，避免等待实时推送
            console.log('[NoticeContext.updateNotice] response', data);
            setNotices(prev => prev.map(n => n.id === noticeId ? { ...n, ...convertKeysToCamelCase(data) } : n));
        } catch (err) {
            console.error("更新通知单失败:", err);
            throw err;
        }
    };
    
    // --- 5. 重写 addNotices 函数，使用 Supabase API ---
    const addNotices = async (newNoticesArray) => {
        try {
            const { error } = await supabase
                .from('notices')
                .insert(newNoticesArray);
            if (error) throw error;
        } catch (err) {
            console.error("创建通知单失败:", err);
            throw err;
        }
    };

    const value = { notices, loading, updateNotice, addNotices };

    return (
        <NoticeContext.Provider value={value}>
            {children}
        </NoticeContext.Provider>
    );
};

export const useNotices = () => {
    return useContext(NoticeContext);
};