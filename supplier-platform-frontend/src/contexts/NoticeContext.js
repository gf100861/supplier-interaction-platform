import React, { createContext, useContext, useState, useEffect } from 'react';
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
                const targetUrl = `${BACKEND_URL}/api/notices`;
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
    }, []);

    // --- 2. 内部辅助：调用后端创建通知 (支持两种模式) ---
    // 模式 A: 传 alerts 数组 (直接插入)
    // 模式 B: 传 createBySupplier 对象 (后端自动分发)
    const createSystemAlerts = async (payload) => {
        try {
            const targetUrl = `${BACKEND_URL}/api/alerts`;
            await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload) // 直接把 payload 发给后端
            });
        } catch (err) {
            console.error("创建站内通知异常:", err);
        }
    };

    // --- 3. 更新通知单 (PATCH) ---
    const updateNotice = async (noticeId, updates) => {
        try {
            // A. 调用后端更新数据
            const targetUrl = `${BACKEND_URL}/api/notices`;
            const response = await fetch(targetUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: noticeId, updates })
            });

            if (!response.ok) throw new Error('Update failed');
            const data = await response.json(); // 后端返回最新的 notice (snake_case)

            // B. 业务逻辑：发送通知
            const { old_supplier_id } = updates;
            const newStatus = data.status;
            const sdId = data.creator_id;
            
            const historyArray = data.history || [];
            const lastHistory = historyArray.length > 0 ? historyArray[historyArray.length - 1] : {};
            const historyType = lastHistory?.type;

            // 1. 发给 SD 的通知 (SD 只有一个人，还是手动构建比较方便)
            const alertsForSD = [];
            if (newStatus === '待SD确认actions' && sdId) {
                alertsForSD.push({ target_user_id: sdId, message: `供应商 ${data.assigned_supplier_name} 已提交行动计划`, link: `/notices?open=${noticeId}`, created_at: new Date().toISOString() });
            }
            if (newStatus === '待SD关闭evidence' && sdId) {
                alertsForSD.push({ target_user_id: sdId, message: `供应商 ${data.assigned_supplier_name} 已提交完成证据`, link: `/notices?open=${noticeId}`, created_at: new Date().toISOString() });
            }
            if (alertsForSD.length > 0) {
                await createSystemAlerts({ alerts: alertsForSD });
            }

            // 2. 发给 供应商 的通知 (使用 createBySupplier 模式)
            // Case 1: 重分配 (通知旧供应商和新供应商)
            if (historyType === 'manager_reassignment' && old_supplier_id) {
                // 通知旧供应商
                await createSystemAlerts({
                    createBySupplier: {
                        supplierId: old_supplier_id,
                        title: '任务移除',
                        message: `通知单 ${data.notice_code} 已被移出您的列表`,
                        link: `/notices`
                    }
                });
                // 通知新供应商
                await createSystemAlerts({
                    createBySupplier: {
                        supplierId: data.assigned_supplier_id,
                        title: '新任务分配',
                        message: `收到新分配的通知单: ${data.title}`,
                        link: `/notices?open=${noticeId}`
                    }
                });
            }

            // Case 2: 审核结果通知
            const isPlanReview = (newStatus === '待供应商关闭' && historyType === 'sd_plan_approval') || (newStatus === '待提交Action Plan');
            const isEvidenceReview = (newStatus === '已完成') || (newStatus === '待供应商关闭' && historyType === 'sd_evidence_rejection');
            const isAborted = (newStatus === '已作废');

            if (isPlanReview || isEvidenceReview || isAborted) {
                let msg = '';
                let title = '审核结果更新';
                
                if (isPlanReview) msg = `计划审核结果: ${newStatus === '待供应商关闭' ? '通过' : '驳回'}`;
                else if (isEvidenceReview) msg = `证据审核结果: ${newStatus === '已完成' ? '通过/关闭' : '驳回'}`;
                else if (isAborted) { msg = `通知单已作废: ${data.title}`; title = '通知单作废'; }

                // 一键通知该供应商下所有人
                await createSystemAlerts({
                    createBySupplier: {
                        supplierId: data.assigned_supplier_id,
                        title: title,
                        message: `${msg} (${data.notice_code})`,
                        link: `/notices?open=${noticeId}`
                    }
                });
            }

            // C. 更新本地状态
            setNotices(prev => prev.map(n => n.id === noticeId ? { ...n, ...convertKeysToCamelCase(data) } : n));

        } catch (err) {
            console.error("更新通知单失败:", err);
            throw err;
        }
    };

    // --- 4. 发送系统公告 ---
    const sendSystemAnnouncement = async (title, content, priority) => {
        // 系统公告比较特殊，是发给“所有人”，目前的后端 createBySupplier 只支持按供应商发。
        // 所以这里保留原来的逻辑：先 fetch all users，再批量发。
        // 或者您可以在后端加一个 createBroadcast 模式，这里为了简单先不动。
        try {
            const targetUrl = `${BACKEND_URL}/api/users?action=all_users`;
            const res = await fetch(targetUrl);
            const users = await res.json();
            
            const alertsData = users.map(u => ({
                target_user_id: u.id,
                message: `[系统公告] ${title}`,
                link: '#',
                created_at: new Date().toISOString()
            }));
            await createSystemAlerts({ alerts: alertsData });
            return true;
        } catch (err) {
            console.error("发送系统公告失败:", err);
            return false;
        }
    };

    // --- 5. 添加通知单 (POST) ---
    const addNotices = async (newNoticesArray) => {
        try {
            // A. 调用后端 API 创建
            const targetUrl = `${BACKEND_URL}/api/notices`;
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newNoticesArray)
            });

            if (!response.ok) throw new Error('Create failed');
            const noticesToProcess = await response.json();

            // B. 使用进阶模式通知供应商
            if (noticesToProcess && noticesToProcess.length > 0) {
                await Promise.all(noticesToProcess.map(async (notice) => {
                    const targetSupplierId = notice.assigned_supplier_id;
                    if (!targetSupplierId) return;

                    // 🚀 核心修改：直接发指令，不用自己查用户了
                    await createSystemAlerts({
                        createBySupplier: {
                            supplierId: targetSupplierId,
                            title: '收到新通知单',
                            message: `新任务: ${notice.title} (${notice.notice_code})`,
                            link: `/notices?open=${notice.id}`
                        }
                    });
                }));
            }
            
            // C. 更新本地状态
            const camelCaseNewNotices = convertKeysToCamelCase(noticesToProcess);
            setNotices(prev => [...camelCaseNewNotices, ...prev]);

            return noticesToProcess;

        } catch (err) {
            console.error("创建通知单失败:", err);
            throw err;
        }
    };

    // --- 6. 删除通知单 (DELETE) ---
    const deleteNotice = async (noticeId) => {
        setLoading(true);
        try {
            const targetUrl = `${BACKEND_URL}/api/notices`;
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
            const targetUrl = `${BACKEND_URL}/api/notices`;
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