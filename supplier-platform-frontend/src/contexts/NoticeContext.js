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

    // --- 内部辅助：批量创建站内通知 ---
    const createSystemAlerts = async (alertsData) => {
        if (!alertsData || alertsData.length === 0) return;
        try {
            const { error } = await supabase.from('alerts').insert(alertsData);
            if (error) console.error("创建站内通知失败:", error);
        } catch (err) {
            console.error("创建站内通知异常:", err);
        }
    };

    // --- 4. updateNotice 函数 ---
    const updateNotice = async (noticeId, updates) => {
        try {
            // 提取辅助参数
            const { old_supplier_id, ...dbUpdates } = updates;

            const { data, error } = await supabase
                .from('notices')
                .update(dbUpdates)
                .eq('id', noticeId)
                .select(`*, creator:users(id, email, username), supplier:suppliers(id, name)`)
                .single();

            if (error) throw error;

            // --- 通知逻辑 (邮件 + 站内信) ---
            const newStatus = dbUpdates.status; 
            const sdName = data.creator?.username || 'SD';
            const sdEmail = data.creator?.email;
            const sdId = data.creator_id; // 获取 SD 的 User ID 用于发站内信
            
            const historyArray = data.history || [];
            const lastHistory = historyArray.length > 0 ? historyArray[historyArray.length - 1] : {};
            const comment = lastHistory?.description || '';
            const historyType = lastHistory?.type;

            const alertsToCreate = [];

            // 1. 供应商提交了行动计划 -> 通知 SD
            if (newStatus === '待SD确认actions') {
                // Email
                if (sdEmail) {
                    EmailService.notifySDPlanSubmitted(sdEmail, data.assigned_supplier_name, data.title, sdName);
                }
                // Alert
                if (sdId) {
                    alertsToCreate.push({
                        target_user_id: sdId,
                        message: `供应商 ${data.assigned_supplier_name} 已提交行动计划: ${data.title}`,
                        link: `/notices?open=${noticeId}`,
                        created_at: new Date().toISOString()
                    });
                }
            }

            // 2. 供应商提交了证据 -> 通知 SD
            if (newStatus === '待SD关闭evidence') {
                // Email
                if (sdEmail) {
                    EmailService.notifySDEvidenceSubmitted(sdEmail, data.assigned_supplier_name, data.title, sdName);
                }
                // Alert
                if (sdId) {
                    alertsToCreate.push({
                        target_user_id: sdId,
                        message: `供应商 ${data.assigned_supplier_name} 已提交完成证据: ${data.title}`,
                        link: `/notices?open=${noticeId}`,
                        created_at: new Date().toISOString()
                    });
                }
            }

            // 3. 场景7：管理员重分配供应商
            if (historyType === 'manager_reassignment' && old_supplier_id) {
                // A. 获取旧供应商用户
                const { data: oldSupUsers } = await supabase.from('users').select('id, email').eq('supplier_id', old_supplier_id);
                
                // B. 获取新供应商用户
                const { data: newSupUsers } = await supabase.from('users').select('id, email').eq('supplier_id', data.assigned_supplier_id);

                const oldEmails = oldSupUsers?.map(u => u.email).filter(Boolean) || [];
                const newEmails = newSupUsers?.map(u => u.email).filter(Boolean) || [];

                // Email
                await EmailService.notifyReassignment({
                    oldSupplierEmail: oldEmails,
                    newSupplierEmail: newEmails,
                    sdEmail: sdEmail,
                    noticeTitle: data.title,
                    noticeCode: data.notice_code,
                    oldSupplierName: '旧供应商', 
                    newSupplierName: data.assigned_supplier_name,
                    reason: comment
                });

                // Alerts - 旧供应商
                oldSupUsers?.forEach(u => {
                    alertsToCreate.push({
                        target_user_id: u.id,
                        message: `通知单 ${data.notice_code} 已被移出您的列表 (重分配)`,
                        link: `/notices`, // 旧供应商看不了详情了，跳列表
                        created_at: new Date().toISOString()
                    });
                });

                // Alerts - 新供应商
                newSupUsers?.forEach(u => {
                    alertsToCreate.push({
                        target_user_id: u.id,
                        message: `收到新分配的通知单: ${data.title} (${data.notice_code})`,
                        link: `/notices?open=${noticeId}`,
                        created_at: new Date().toISOString()
                    });
                });

                // Alerts - SD
                if (sdId) {
                    alertsToCreate.push({
                        target_user_id: sdId,
                        message: `通知单 ${data.notice_code} 供应商已变更为 ${data.assigned_supplier_name}`,
                        link: `/notices?open=${noticeId}`,
                        created_at: new Date().toISOString()
                    });
                }
            }

            // 4. SD 审核结果 / 作废 -> 通知供应商
            const isPlanReview = (newStatus === '待供应商关闭' && historyType === 'sd_plan_approval') || 
                                 (newStatus === '待提交Action Plan');
            
            const isEvidenceReview = (newStatus === '已完成') || 
                                     (newStatus === '待供应商关闭' && historyType === 'sd_evidence_rejection');
            
            const isAborted = (newStatus === '已作废');

            if (isPlanReview || isEvidenceReview || isAborted) {
                const { data: supUsers } = await supabase
                    .from('users')
                    .select('id, email')
                    .eq('supplier_id', data.assigned_supplier_id);

                if (supUsers && supUsers.length > 0) {
                    const emails = supUsers.map(u => u.email).filter(Boolean);
                    
                    // Email Logic
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
                        EmailService.notifyNoticeAbortion(emails, data.title, data.notice_code, comment, '管理员'); 
                    }

                    // Alert Logic - 统一通知所有供应商用户
                    supUsers.forEach(u => {
                        let msg = '';
                        if (isPlanReview) msg = `计划审核结果: ${newStatus === '待供应商关闭' ? '通过' : '驳回'}`;
                        else if (isEvidenceReview) msg = `证据审核结果: ${newStatus === '已完成' ? '通过/关闭' : '驳回'}`;
                        else if (isAborted) msg = `通知单已作废: ${data.title}`;

                        alertsToCreate.push({
                            target_user_id: u.id,
                            message: `${msg} (${data.notice_code})`,
                            link: `/notices?open=${noticeId}`,
                            created_at: new Date().toISOString()
                        });
                    });
                }
            }
            
            // 5. 通知单作废 -> 通知 SD
            if (isAborted && sdEmail) {
                 EmailService.notifyNoticeAbortion(sdEmail, data.title, data.notice_code, comment, '管理员');
                 if (sdId) {
                     alertsToCreate.push({
                        target_user_id: sdId,
                        message: `通知单已作废: ${data.title}`,
                        link: `/notices?open=${noticeId}`,
                        created_at: new Date().toISOString()
                    });
                 }
            }

            // --- 统一执行插入 ---
            if (alertsToCreate.length > 0) {
                await createSystemAlerts(alertsToCreate);
            }

            // 更新本地状态
            setNotices(prev => prev.map(n => n.id === noticeId ? { ...n, ...convertKeysToCamelCase(data) } : n));

        } catch (err) {
            console.error("更新通知单失败:", err);
            throw err;
        }
    };

    // --- 8. 系统公告 (独立方法) ---
    const sendSystemAnnouncement = async (title, content, priority) => {
        try {
            const { data: users, error } = await supabase.from('users').select('id, email');
            if (error) throw error;
            
            const emails = [...new Set(users.map(u => u.email).filter(Boolean))];
            if (emails.length === 0) return false;

            // 1. 发邮件
            await EmailService.notifySystemAnnouncement(emails, title, content, priority);
            
            // 2. 发站内信
            const alertsData = users.map(u => ({
                target_user_id: u.id,
                message: `[系统公告] ${title}`,
                link: '#', // 或者跳转到专门的公告页
                created_at: new Date().toISOString()
            }));
            await createSystemAlerts(alertsData);
            
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
            const allAlerts = [];

            // 我们需要遍历处理，因为每个 notice 可能对应不同的供应商
            // 注意：forEach 是同步的，里面的 await 不会阻塞外层，但这里我们希望并发处理即可
            // 为了确保 alert 数据完整，最好用 map + Promise.all
            await Promise.all(noticesToProcess.map(async (notice) => {
                const targetSupplierId = notice.assigned_supplier_id;
                if (!targetSupplierId) return;

                const { data: supplierUsers } = await supabase
                    .from('users')
                    .select('id, email')
                    .eq('supplier_id', targetSupplierId);

                if (supplierUsers && supplierUsers.length > 0) {
                    // Email
                    const emails = supplierUsers.map(u => u.email).filter(Boolean);
                    EmailService.notifySupplierNewNotice(emails, notice.title, notice.notice_code, '合作伙伴');

                    // Alert Collection
                    supplierUsers.forEach(u => {
                        allAlerts.push({
                            target_user_id: u.id,
                            message: `收到新通知单: ${notice.title} (${notice.notice_code})`,
                            link: `/notices?open=${notice.id || 'unknown'}`, // 注意：这里如果不重新查库，可能拿不到 id (除非 Supabase insert 返回了)
                            // 修正：上面的 .insert(...).select() 会让 data 包含 id。
                            // 但这里的 notice 变量是入参 newNoticesArray 的项，它没有 ID。
                            // 我们应该用 `data` 里的项。
                            created_at: new Date().toISOString()
                        });
                    });
                }
            }));

            // 修正：使用 insert 返回的 data 来构建 Alert (因为需要 ID)
            // 这里简化处理：重新遍历 data
            const alertsFromData = [];
            if (data) {
                await Promise.all(data.map(async (insertedNotice) => {
                     const { data: supplierUsers } = await supabase
                        .from('users')
                        .select('id')
                        .eq('supplier_id', insertedNotice.assigned_supplier_id);
                     
                     if (supplierUsers) {
                         supplierUsers.forEach(u => {
                             alertsFromData.push({
                                 target_user_id: u.id,
                                 message: `收到新通知单: ${insertedNotice.title} (${insertedNotice.notice_code})`,
                                 link: `/notices?open=${insertedNotice.id}`,
                                 created_at: new Date().toISOString()
                             });
                         });
                     }
                }));
            }

            if (alertsFromData.length > 0) {
                await createSystemAlerts(alertsFromData);
            }

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
        sendSystemAnnouncement 
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