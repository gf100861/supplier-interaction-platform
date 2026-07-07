import React, { createContext, useContext, useState, useEffect } from 'react';
// import { EmailService } from '../services/EmailService'; // 如果不用可以注释掉

const NoticeContext = createContext();

// 🔧 环境配置
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_URL = isDev
    ? 'http://localhost:3001'  // 本地开发环境
    : 'http://43.143.114.28'; // 腾讯云生产环境

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

// 🌟 辅助：获取通用的请求头 (包含鉴权 Token)
const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
};

export const NoticeProvider = ({ children }) => {
    const [notices, setNotices] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- 1. 获取通知单 (GET) - 🚀 核心优化：按用户请求数据 ---
    useEffect(() => {
        const fetchNotices = async () => {
            try {
                const userStr = localStorage.getItem('user');
                if (!userStr) {
                    setLoading(false);
                    return; // 未登录时不请求数据
                }
                
                const user = JSON.parse(userStr);
                
                // 🌟 将 userId 和 role 作为参数传给后端，让数据库在查询时就拦截过滤
                const targetUrl = `${BACKEND_URL}/api/notices?userId=${user.id}&role=${user.role}`;
                
                const response = await fetch(targetUrl, {
                    method: 'GET',
                    headers: getAuthHeaders() // 携带 Token，确保后端安全校验
                });
                
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

    // --- 2. 内部辅助：调用后端创建通知 ---
    const createSystemAlerts = async (payload) => {
        try {
            const targetUrl = `${BACKEND_URL}/api/alerts`;
            await fetch(targetUrl, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });
        } catch (err) {
            console.error("创建站内通知异常:", err);
        }
    };

    // --- 3. 更新通知单 (PATCH) ---
    const updateNotice = async (noticeId, updates) => {
        try {
            const targetUrl = `${BACKEND_URL}/api/notices`;
            const response = await fetch(targetUrl, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ id: noticeId, updates })
            });

            if (!response.ok) throw new Error('Update failed');
            const data = await response.json(); 

            // 业务逻辑：发送通知
            const { old_supplier_id } = updates;
            const newStatus = data.status;
            const sdId = data.creator_id;
            const historyArray = data.history || [];
            const lastHistory = historyArray.length > 0 ? historyArray[historyArray.length - 1] : {};
            const historyType = lastHistory?.type;
            const supplierName = data?.supplier?.short_code || '供应商';

            // 1. 发给 SD 的通知
            const alertsForSD = [];
            if (newStatus === '待SD确认actions' && sdId) {
                alertsForSD.push({ target_user_id: sdId, message: `${supplierName} 已提交行动计划`, link: `/notices?open=${noticeId}`, created_at: new Date().toISOString() });
            }
            if (newStatus === '待SD关闭evidence' && sdId) {
                alertsForSD.push({ target_user_id: sdId, message: `${supplierName} 已提交完成证据`, link: `/notices?open=${noticeId}`, created_at: new Date().toISOString() });
            }
            if (alertsForSD.length > 0) {
                await createSystemAlerts({ alerts: alertsForSD });
            }

            // 2. 发给 供应商 的通知
            if (historyType === 'manager_reassignment' && old_supplier_id) {
                await createSystemAlerts({
                    createBySupplier: {
                        supplierId: old_supplier_id,
                        title: '任务移除',
                        message: `通知单 ${data.notice_code} 已被移出您的列表`,
                        link: `/notices`
                    }
                });
                await createSystemAlerts({
                    createBySupplier: {
                        supplierId: data.assigned_supplier_id,
                        title: '新任务分配',
                        message: `收到新分配的通知单: ${data.title}`,
                        link: `/notices?open=${noticeId}`
                    }
                });
            }

            const isPlanReview = (newStatus === '待供应商关闭' && historyType === 'sd_plan_approval') || (newStatus === '待提交Action Plan');
            const isEvidenceReview = (newStatus === '已完成') || (newStatus === '待供应商关闭' && historyType === 'sd_evidence_rejection');
            const isAborted = (newStatus === '已作废');

            if (isPlanReview || isEvidenceReview || isAborted) {
                let msg = '';
                let title = '审核结果更新';

                if (isPlanReview) msg = `计划审核结果: ${newStatus === '待供应商关闭' ? '通过' : '驳回'}`;
                else if (isEvidenceReview) msg = `证据审核结果: ${newStatus === '已完成' ? '通过/关闭' : '驳回'}`;
                else if (isAborted) { msg = `通知单已作废: ${data.title}`; title = '通知单作废'; }

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
        try {
            const targetUrl = `${BACKEND_URL}/api/users?action=all_users`;
            const res = await fetch(targetUrl, { headers: getAuthHeaders() });
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
            const targetUrl = `${BACKEND_URL}/api/notices`;
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(newNoticesArray)
            });

            if (!response.ok) throw new Error('Create failed');
            const noticesToProcess = await response.json();

            if (noticesToProcess && noticesToProcess.length > 0) {
                await Promise.all(noticesToProcess.map(async (notice) => {
                    const targetSupplierId = notice.assigned_supplier_id;
                    if (!targetSupplierId) return;

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
                headers: getAuthHeaders(),
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
                headers: getAuthHeaders(),
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