import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { EmailService } from '../services/EmailService';
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

const addNotices = async (newNoticesArray) => {
        try {
            const { data, error } = await supabase.from('notices').insert(newNoticesArray).select();
            if (error) throw error;

            // --- 新增：触发邮件通知 ---
            // 注意：这里需要获取供应商的邮箱。
            // 假设我们可以在 supplier 表里查到，或者 newNoticesArray 里包含了 supplierId
            // 这是一个异步操作，不应阻塞 UI，所以不加 await 或放在 setTimeout 里
            newNoticesArray.forEach(async (notice) => {
                // 这里需要额外查一下供应商的邮箱 (contact_email)
                // 简单起见，假设您有一个 fetchUserBySupplierId 的方法或者从缓存取
                const { data: supplierUsers } = await supabase
                    .from('users')
                    .select('email')
                    .eq('supplier_id', notice.assigned_supplier_id);
                
                if (supplierUsers && supplierUsers.length > 0) {
                    const emails = supplierUsers.map(u => u.email);
                    EmailService.notifySupplierNewNotice(emails, notice.title, notice.notice_code);
                }
            });

        } catch (err) {
            console.error("创建通知单失败:", err);
            throw err;
        }
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
            const { data, error } = await supabase
                .from('notices')
                .update(updates)
                .eq('id', noticeId)
                .select(`*, creator:users(email), supplier:suppliers(id)`) // 多查询一点信息
                .single();
            
            if (error) throw error;
            
            // --- 新增：根据状态变化触发邮件 ---
            const newStatus = updates.status;
            
            // A. 供应商提交了计划 -> 通知 SD (creator)
            if (newStatus === '待SD确认actions') {
                const sdEmail = data.creator?.email; 
                if (sdEmail) {
                    EmailService.notifySDPlanSubmitted(sdEmail, data.assigned_supplier_name, data.title);
                }
            }

            // B. SD 审核结果 (批准/驳回) -> 通知供应商
            // 假设我们在 updates 里能判断出是批准还是驳回，或者根据 status 字符串
            if (newStatus === '待供应商关闭' || newStatus === '待提交Action Plan') {
                 // 查找供应商的所有用户邮箱
                 const { data: supUsers } = await supabase
                    .from('users')
                    .select('email')
                    .eq('supplier_id', data.assigned_supplier_id);
                 
                 if (supUsers) {
                     const emails = supUsers.map(u => u.email);
                     const resultText = newStatus === '待供应商关闭' ? '计划已批准，请上传证据' : '计划被驳回，请修改';
                     // 获取最新的驳回原因 (如果有)
                     const lastHistory = data.history[data.history.length -1];
                     const comment = lastHistory?.description || '';
                     
                     EmailService.notifySupplierAuditResult(emails, data.title, resultText, comment);
                 }
            }
            
            // 更新本地状态...
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

    const deleteNotice = async (noticeId) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('notices')
                .delete()
                .eq('id', noticeId);

            if (error) {
                throw error;
            }

            // Remove the notice from the local state
            setNotices(prevNotices => prevNotices.filter(n => n.id !== noticeId));

        } catch (error) {
            console.error("Error deleting notice:", error);
            // Rethrow the error so the component can catch it and show a message
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const deleteMultipleNotices = async (noticeIds) => {
    if (!noticeIds || noticeIds.length === 0) {
        throw new Error("没有选择任何通知单进行删除。");
    }
    setLoading(true); // 可以考虑为批量操作添加单独的 loading 状态
    try {
        const { error } = await supabase
            .from('notices')
            .delete()
            .in('id', noticeIds); // <--- 使用 .in() 过滤器

        if (error) {
            throw error;
        }

        // 从本地状态中移除已删除的通知单
        setNotices(prevNotices => prevNotices.filter(n => !noticeIds.includes(n.id)));

    } catch (error) {
        console.error("Error deleting multiple notices:", error);
        // Rethrow the error so the component can catch it and show a message
        throw error;
    } finally {
        setLoading(false);
    }
};

    const value = { notices, loading, updateNotice, addNotices, deleteNotice,deleteMultipleNotices };

    return (
        <NoticeContext.Provider value={value}>
            {children}
        </NoticeContext.Provider>
    );
};

export const useNotices = () => {
    return useContext(NoticeContext);
};