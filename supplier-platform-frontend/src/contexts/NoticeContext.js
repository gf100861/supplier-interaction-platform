import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { EmailService } from '../services/EmailService';

const NoticeContext = createContext();

// --- 辅助函数：将 snake_case 转换为 camelCase ---
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
                const { data, error } = await supabase
                    .from('notices')
                    .select(`
                        *,
                        creator:users ( id, username, email, role ),
                        supplier:suppliers ( parma_id, short_code )
                    `)
                    .order('created_at', { ascending: false });

                if (error) throw error;

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


    // --- 4. updateNotice 函数 ---
    // noticeId: ID
    // updates: 更新对象。如果是重分配，需要在 updates 中包含 { old_supplier_id: '...' }
    const updateNotice = async (noticeId, updates) => {
        try {
            // 提取辅助参数，避免写入数据库报错
            const { old_supplier_id, ...dbUpdates } = updates;

            const { data, error } = await supabase
                .from('notices')
                .update(dbUpdates)
                .eq('id', noticeId)
                .select(`*, creator:users(email, username), supplier:suppliers(id, name)`)
                .single();

            if (error) throw error;

            // --- 邮件触发逻辑 ---
            const newStatus = dbUpdates.status; // 使用传入的新状态
            const sdName = data.creator?.username || 'SD';
            const sdEmail = data.creator?.email;

            console.log('就供应商id', old_supplier_id)

            // 获取历史记录以便提取评论和操作类型
            const historyArray = data.history || [];
            const lastHistory = historyArray.length > 0 ? historyArray[historyArray.length - 1] : {};
            const comment = lastHistory?.description || '';
            const historyType = lastHistory?.type;

            // 1. 供应商提交了行动计划 -> 通知 SD
            if (newStatus === '待SD确认actions') {
                if (sdEmail) {
                    EmailService.notifySDPlanSubmitted(sdEmail, data.assigned_supplier_name, data.title, sdName);
                }
            }

            // 2. 供应商提交了证据 -> 通知 SD
            if (newStatus === '待SD关闭evidence') {
                if (sdEmail) {
                    EmailService.notifySDEvidenceSubmitted(sdEmail, data.assigned_supplier_name, data.title, sdName);
                }
            }

            // 3. 场景7：管理员重分配供应商 (Reassignment)
            if (historyType === 'manager_reassignment' && old_supplier_id) {
                // A. 获取旧供应商邮箱

                const { data: oldSupUsers } = await supabase.from('users').select('email').eq('supplier_id', old_supplier_id);
                const oldEmails = oldSupUsers?.map(u => u.email).filter(Boolean) || [];

                // B. 获取新供应商邮箱 (当前的 assigned_supplier_id)
                const { data: newSupUsers } = await supabase.from('users').select('email').eq('supplier_id', data.assigned_supplier_id);
                const newEmails = newSupUsers?.map(u => u.email).filter(Boolean) || [];

                console.log('旧的邮件', oldEmails)
                console.log('新的的邮件', newEmails)

                // C. 触发三方邮件
                await EmailService.notifyReassignment({
                    oldSupplierEmail: oldEmails,
                    newSupplierEmail: newEmails,
                    sdEmail: sdEmail,
                    noticeTitle: data.title,
                    noticeCode: data.notice_code,
                    oldSupplierName: '旧供应商', // 如果前端没传名字，这里暂时用占位符，或者在select里关联查出来
                    newSupplierName: data.assigned_supplier_name,
                    reason: comment // 提取历史记录中的描述作为原因
                });
            }

            // 4. SD 审核结果 (计划/证据) / 作废 -> 通知供应商
            const isPlanReview = (newStatus === '待供应商关闭' && historyType === 'sd_plan_approval') ||
                (newStatus === '待提交Action Plan');

            const isEvidenceReview = (newStatus === '已完成') ||
                (newStatus === '待供应商关闭' && historyType === 'sd_evidence_rejection');

            const isAborted = (newStatus === '已作废');

            if (isPlanReview || isEvidenceReview || isAborted) {
                const { data: supUsers } = await supabase
                    .from('users')
                    .select('email')
                    .eq('supplier_id', data.assigned_supplier_id);

                if (supUsers && supUsers.length > 0) {
                    const emails = supUsers.map(u => u.email).filter(Boolean);

                    if (isPlanReview) {
                        const resultText = (newStatus === '待供应商关闭') ? '计划已批准，请上传证据' : '计划被驳回，请修改';
                        EmailService.notifySupplierAuditResult(emails, data.title, resultText, comment, sdName);
                    } else if (isEvidenceReview) {
                        let resultText = '';
                        if (newStatus === '已完成') {
                            resultText = '所有证据已通过，通知单已关闭';
                        } else {
                            resultText = '部分证据被驳回，请补充提交';
                        }
                        EmailService.notifySupplierEvidenceResult(emails, data.title, resultText, comment, sdName);
                    } else if (isAborted) {
                        // 场景 6: 通知单作废 (通知供应商)
                        EmailService.notifyNoticeAbortion(emails, data.title, data.notice_code, comment, '管理员');
                    }
                }
            }

            // 5. 通知单作废 -> 通知 SD
            if (isAborted && sdEmail) {
                EmailService.notifyNoticeAbortion(sdEmail, data.title, data.notice_code, comment, '管理员');
            }

            // 更新本地状态
            setNotices(prev => prev.map(n => n.id === noticeId ? { ...n, ...convertKeysToCamelCase(data) } : n));

        } catch (err) {
            console.error("更新通知单失败:", err);
            throw err;
        }
    };

    // --- 场景 8: 系统全员公告 (独立方法) ---
    const sendSystemAnnouncement = async (title, content, priority) => {
        try {
            // 1. 获取所有活跃用户的邮箱 (根据需要可以加 .eq('status', 'active') 等过滤)
            const { data: users, error } = await supabase.from('users').select('email');

            if (error) throw error;

            // 提取并去重邮箱
            const emails = [...new Set(users.map(u => u.email).filter(Boolean))];



            if (emails.length === 0) {
                console.warn('没有找到可发送的用户邮箱');
                return false;
            }

            console.log(`正在向 ${emails.length} 位用户发送系统公告...`);

            // 2. 调用 EmailService 进行发送
            await EmailService.notifySystemAnnouncement(emails, title, content, priority);

            const result = await EmailService.notifySystemAnnouncement(emails, title, content, priority);

            if (!result.success) {
                // 如果是因为限额风险
                if (result.reason === 'quota_risk' || result.reason === 'quota_exceeded') {
                    // 这里可以抛出错误，或者返回特定的状态对象给 UI
                    throw new Error(result.message);
                }
                console.error("邮件发送失败:", result.message);
                return false;
            }
            return true;

            return true;


        } catch (err) {
            console.error("发送系统公告失败:", err);
            return false;
        }
    };

    // --- 5. addNotices 函数 ---
    const addNotices = async (newNoticesArray) => {
        try {
            const { data, error } = await supabase
                .from('notices')
                .insert(newNoticesArray)
                .select();

            if (error) throw error;

            const noticesToProcess = newNoticesArray;

            noticesToProcess.forEach(async (notice) => {
                const targetSupplierId = notice.assigned_supplier_id;

                if (!targetSupplierId) {
                    return;
                }

                const { data: supplierUsers, error: userError } = await supabase
                    .from('users')
                    .select('email')
                    .eq('supplier_id', targetSupplierId);

                if (userError) {
                    console.error("查找供应商邮箱出错:", userError);
                    return;
                }

                console.log('Supplier邮箱', data)

                if (supplierUsers && supplierUsers.length > 0) {
                    const emails = supplierUsers.map(u => u.email).filter(Boolean);
                    const sdUsername = data.map(u => u.assigned_supplier_name)
                    EmailService.notifySupplierNewNotice(emails, notice.title, notice.notice_code, sdUsername);
                }
            });

        } catch (err) {
            console.error("创建通知单失败:", err);
            throw err;
        }
    };

    const deleteNotice = async (noticeId) => {
        setLoading(true);
        try {
            const { error } = await supabase.from('notices').delete().eq('id', noticeId);
            if (error) throw error;
            setNotices(prevNotices => prevNotices.filter(n => n.id !== noticeId));
        } catch (error) {
            console.error("Error deleting notice:", error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const deleteMultipleNotices = async (noticeIds) => {
        if (!noticeIds || noticeIds.length === 0) {
            throw new Error("没有选择任何通知单进行删除。");
        }
        setLoading(true);
        try {
            const { error } = await supabase.from('notices').delete().in('id', noticeIds);
            if (error) throw error;
            setNotices(prevNotices => prevNotices.filter(n => !noticeIds.includes(n.id)));
        } catch (error) {
            console.error("Error deleting multiple notices:", error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const value = {
        notices,
        loading,
        updateNotice,
        addNotices,
        deleteNotice,
        deleteMultipleNotices,
        sendSystemAnnouncement // 导出此方法供 AdminPage 使用
    };

    return (
        <NoticeContext.Provider value={value}>
            {children}
        </NoticeContext.Provider>
    );
};

export const useNotices = () => {
    return useContext(NoticeContext);
};