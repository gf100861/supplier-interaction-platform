import React, { createContext, useContext, useState, useEffect } from 'react';
// ❌ 移除 Supabase
// import { supabase } from '../supabaseClient';
import { EmailService } from '../services/EmailService';

const NoticeContext = createContext();

// 🔧 环境配置
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_URL = isDev
    ? 'http://localhost:3001'
    : 'https://supplier-interaction-platform-backend.vercel.app'; 

// --- 辅助函数 ---
const toCamel = (s) => {
    return s.replace(/([-_][a-z])/ig, ($1) => {
        return $1.toUpperCase().replace('-', '').replace('_', '');
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

    // --- 1. 获取通知单 (GET) ---
    useEffect(() => {
        const fetchNotices = async () => {
            try {
                const apiPath = isDev ? `/api/notices` : `/api/notices.js`;
                const targetUrl = `${BACKEND_URL}${apiPath}`;

                const response = await fetch(targetUrl);
                if (!response.ok) throw new Error('Fetch notices failed');
                
                const data = await response.json();
                const camelCaseData = convertKeysToCamelCase(data);
                setNotices(camelCaseData);

            } catch (err) {
                console.error("从API获取通知单失败:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchNotices();
        
        // ⚠️ 实时订阅功能 (Realtime) 已暂停
        // 迁移到 API 模式后，无法直接使用 Supabase Channel。
        // 下一步计划：使用 Socket.IO 在后端实现实时推送。
        
    }, []);

    // --- 2. 内部辅助：批量创建站内信 (调用后端 API) ---
    const createSystemAlerts = async (alertsData) => {
        if (!alertsData || alertsData.length === 0) return;
        try {
            const apiPath = isDev ? `/api/alerts` : `/api/alerts.js`;
            const targetUrl = `${BACKEND_URL}${apiPath}`;
            await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alertsData)
            });
        } catch (err) {
            console.error("创建站内通知异常:", err);
        }
    };

    // --- 3. 辅助：获取用户列表 (调用后端 API) ---
    const fetchUsersBySupplier = async (supplierId) => {
        try {
            const apiPath = isDev ? `/api/users` : `/api/users.js`;
            const targetUrl = `${BACKEND_URL}${apiPath}`;
            const res = await fetch(`${targetUrl}?supplierId=${supplierId}`);
            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            return [];
        }
    };

    // --- 4. 更新通知单 (PATCH) ---
    const updateNotice = async (noticeId, updates) => {
        try {
            // A. 调用后端更新数据
            const apiPath = isDev ? `/api/notices` : `/api/notices.js`;
            const targetUrl = `${BACKEND_URL}${apiPath}`;
            const response = await fetch(targetUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: noticeId, updates })
            });

            if (!response.ok) throw new Error('Update failed');
            const data = await response.json(); // 后端返回最新的 notice (snake_case)

            // B. 业务逻辑：发送邮件和通知 (保持前端原有逻辑，但数据源来自后端返回)
            const { old_supplier_id } = updates;
            const newStatus = data.status; // data 是后端返回的 DB 记录
            const sdName = data.creator?.username || 'SD';
            const sdEmail = data.creator?.email;
            const sdId = data.creator_id;
            
            // 解析历史记录 (注意：后端返回的可能是 snake_case 字段，这里尽量兼容)
            const historyArray = data.history || [];
            const lastHistory = historyArray.length > 0 ? historyArray[historyArray.length - 1] : {};
            const comment = lastHistory?.description || '';
            const historyType = lastHistory?.type;

            const alertsToCreate = [];

            // --- 逻辑块：SD 通知 ---
            if (newStatus === '待SD确认actions') {
                if (sdEmail) EmailService.notifySDPlanSubmitted(sdEmail, data.assigned_supplier_name, data.title, sdName, data.notice_code);
                if (sdId) alertsToCreate.push({ target_user_id: sdId, message: `供应商 ${data.assigned_supplier_name} 已提交行动计划: ${data.title}`, link: `/notices?open=${noticeId}`, created_at: new Date().toISOString() });
            }

            if (newStatus === '待SD关闭evidence') {
                if (sdEmail) EmailService.notifySDEvidenceSubmitted(sdEmail, data.assigned_supplier_name, data.title, sdName, data.notice_code);
                if (sdId) alertsToCreate.push({ target_user_id: sdId, message: `供应商 ${data.assigned_supplier_name} 已提交完成证据: ${data.title}`, link: `/notices?open=${noticeId}`, created_at: new Date().toISOString() });
            }

            // --- 逻辑块：重分配 ---
            if (historyType === 'manager_reassignment' && old_supplier_id) {
                // 调用新写的 Users API 获取用户
                const oldSupUsers = await fetchUsersBySupplier(old_supplier_id);
                const newSupUsers = await fetchUsersBySupplier(data.assigned_supplier_id);

                const oldEmails = oldSupUsers.map(u => u.email).filter(Boolean);
                const newEmails = newSupUsers.map(u => u.email).filter(Boolean);

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

                // 构造 Alerts
                oldSupUsers.forEach(u => alertsToCreate.push({ target_user_id: u.id, message: `通知单 ${data.notice_code} 已被移出您的列表 (重分配)`, link: `/notices`, created_at: new Date().toISOString() }));
                newSupUsers.forEach(u => alertsToCreate.push({ target_user_id: u.id, message: `收到新分配的通知单: ${data.title} (${data.notice_code})`, link: `/notices?open=${noticeId}`, created_at: new Date().toISOString() }));
                if (sdId) alertsToCreate.push({ target_user_id: sdId, message: `通知单 ${data.notice_code} 供应商已变更为 ${data.assigned_supplier_name}`, link: `/notices?open=${noticeId}`, created_at: new Date().toISOString() });
            }

            // --- 逻辑块：审核结果/作废 ---
            const isPlanReview = (newStatus === '待供应商关闭' && historyType === 'sd_plan_approval') || (newStatus === '待提交Action Plan');
            const isEvidenceReview = (newStatus === '已完成') || (newStatus === '待供应商关闭' && historyType === 'sd_evidence_rejection');
            const isAborted = (newStatus === '已作废');

            if (isPlanReview || isEvidenceReview || isAborted) {
                const supUsers = await fetchUsersBySupplier(data.assigned_supplier_id);
                if (supUsers.length > 0) {
                    const emails = supUsers.map(u => u.email).filter(Boolean);
                    
                    if (isPlanReview) {
                        const resultText = (newStatus === '待供应商关闭') ? '计划已批准，请上传证据' : '计划被驳回，请修改';
                        EmailService.notifySupplierAuditResult(emails, data.title, resultText, comment, sdName, data.notice_code);
                    } else if (isEvidenceReview) {
                        const resultText = (newStatus === '已完成') ? '所有证据已通过，通知单已关闭' : '部分证据被驳回，请补充提交';
                        EmailService.notifySupplierEvidenceResult(emails, data.title, resultText, comment, sdName, data.notice_code);
                    } else if (isAborted) {
                        EmailService.notifyNoticeAbortion(emails, data.title, data.notice_code, comment, '管理员');
                    }

                    supUsers.forEach(u => {
                        let msg = '';
                        if (isPlanReview) msg = `计划审核结果: ${newStatus === '待供应商关闭' ? '通过' : '驳回'}`;
                        else if (isEvidenceReview) msg = `证据审核结果: ${newStatus === '已完成' ? '通过/关闭' : '驳回'}`;
                        else if (isAborted) msg = `通知单已作废: ${data.title}`;
                        alertsToCreate.push({ target_user_id: u.id, message: `${msg} (${data.notice_code})`, link: `/notices?open=${noticeId}`, created_at: new Date().toISOString() });
                    });
                }
            }

            if (isAborted && sdEmail) {
                EmailService.notifyNoticeAbortion(sdEmail, data.title, data.notice_code, comment, '管理员');
                if (sdId) alertsToCreate.push({ target_user_id: sdId, message: `通知单已作废: ${data.title}`, link: `/notices?open=${noticeId}`, created_at: new Date().toISOString() });
            }

            // C. 提交 Alerts 到后端
            if (alertsToCreate.length > 0) {
                await createSystemAlerts(alertsToCreate);
            }

            // D. 更新本地状态 (CamelCase)
            setNotices(prev => prev.map(n => n.id === noticeId ? { ...n, ...convertKeysToCamelCase(data) } : n));

        } catch (err) {
            console.error("更新通知单失败:", err);
            throw err;
        }
    };

    // --- 5. 发送系统公告 ---
    const sendSystemAnnouncement = async (title, content, priority) => {
        try {
            // A. 获取所有用户
            const apiPath = isDev ? `/api/users` : `/api/users.js`;
            const targetUrl = `${BACKEND_URL}${apiPath}`;
            const res = await fetch(`${targetUrl}?action=all_users`);
            const users = await res.json();
            
            const emails = [...new Set(users.map(u => u.email).filter(Boolean))];
            if (emails.length === 0) return false;

            // B. 发邮件 (前端服务)
            await EmailService.notifySystemAnnouncement(emails, title, content, priority);
            
            // C. 发站内信 (后端 API)
            const alertsData = users.map(u => ({
                target_user_id: u.id,
                message: `[系统公告] ${title}`,
                link: '#',
                created_at: new Date().toISOString()
            }));
            await createSystemAlerts(alertsData);
            
            return true;
        } catch (err) {
            console.error("发送系统公告失败:", err);
            return false;
        }
    };

    // --- 6. 添加通知单 (POST) ---
    const addNotices = async (newNoticesArray) => {
        try {
            // A. 调用后端 API 创建
            const apiPath = isDev ? `/api/notices` : `/api/notices.js`;
            const targetUrl = `${BACKEND_URL}${apiPath}`;
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newNoticesArray)
            });

            if (!response.ok) throw new Error('Create failed');
            const noticesToProcess = await response.json(); // 后端返回已创建的数据(含creator)

            const allAlerts = [];

            // B. 处理邮件和通知逻辑
            if (noticesToProcess && noticesToProcess.length > 0) {
                await Promise.all(noticesToProcess.map(async (notice) => {
                    const targetSupplierId = notice.assigned_supplier_id;
                    const targetSdid = notice.creator?.username || 'SD';

                    if (!targetSupplierId) return;

                    // 获取供应商用户
                    const supplierUsers = await fetchUsersBySupplier(targetSupplierId);

                    if (supplierUsers.length > 0) {
                        const validUsers = supplierUsers.filter(u => u.email);
                        const emails = validUsers.map(u => u.email);
                        const usernames = validUsers.map(u => u.username || '合作伙伴');

                        // 发邮件
                        await EmailService.notifySupplierNewNotice(emails, notice.title, notice.notice_code, usernames, targetSdid);
                        
                        // 准备 Alerts
                        supplierUsers.forEach(u => {
                            allAlerts.push({
                                creator_id: notice.creator_id,
                                target_user_id: u.id,
                                message: `收到新通知单: ${notice.title} (${notice.notice_code})`,
                                link: `/notices?open=${notice.id}`,
                                created_at: new Date().toISOString(),
                                is_read: false
                            });
                        });
                    }
                }));

                // C. 提交 Alerts
                if (allAlerts.length > 0) {
                    await createSystemAlerts(allAlerts);
                }
            }
            
            // D. 更新本地状态 (添加到列表顶部)
            // 重新 Fetch 一次或者直接 push，这里为了简单直接 push 转换后的数据
            const camelCaseNewNotices = convertKeysToCamelCase(noticesToProcess);
            setNotices(prev => [...camelCaseNewNotices, ...prev]);

            return noticesToProcess;

        } catch (err) {
            console.error("创建通知单失败:", err);
            throw err;
        }
    };

    // --- 7. 删除通知单 (DELETE) ---
    const deleteNotice = async (noticeId) => {
        setLoading(true);
        try {
            const apiPath = isDev ? `/api/notices` : `/api/notices.js`;
            const targetUrl = `${BACKEND_URL}${apiPath}`;
            await fetch(targetUrl, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [noticeId] })
            });
            setNotices(prev => prev.filter(n => n.id !== noticeId));
        } catch (error) {
            console.error("Error deleting notice:", error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const deleteMultipleNotices = async (noticeIds) => {
        if (!noticeIds || noticeIds.length === 0) throw new Error("未选择");
        setLoading(true);
        try {
            const apiPath = isDev ? `/api/notices` : `/api/notices.js`;
            const targetUrl = `${BACKEND_URL}${apiPath}`;
            await fetch(targetUrl, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: noticeIds })
            });
            setNotices(prev => prev.filter(n => !noticeIds.includes(n.id)));
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