import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 🌟 核心魔法：拦截原生 localStorage，解决 SPA 路由跳转不刷新的问题
// 这样当你在任意页面 (如 LoginPage) 写入 user 缓存时，系统会自动发出信号，彻底告别必须按F5刷新的烦恼！
if (typeof window !== 'undefined') {
    const originalSetItem = window.localStorage.setItem;
    window.localStorage.setItem = function(key, value) {
        originalSetItem.apply(this, arguments);
        if (key === 'user' || key === 'access_token') {
            window.dispatchEvent(new Event('auth-change'));
        }
    };

    const originalRemoveItem = window.localStorage.removeItem;
    window.localStorage.removeItem = function(key) {
        originalRemoveItem.apply(this, arguments);
        if (key === 'user' || key === 'access_token') {
            window.dispatchEvent(new Event('auth-change'));
        }
    };
}

// 🗄️ 自定义简易版 IndexedDB 封装 (替代外部 localforage 依赖，确保环境编译通过)
const localforage = {
    config: () => {},
    _db: null,
    async getDb() {
        if (this._db) return this._db;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('AppStorage', 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('notices_cache')) {
                    db.createObjectStore('notices_cache');
                }
            };
            request.onsuccess = (e) => {
                this._db = e.target.result;
                resolve(this._db);
            };
            request.onerror = () => reject(request.error);
        });
    },
    async getItem(key) {
        try {
            const db = await this.getDb();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('notices_cache', 'readonly');
                const store = tx.objectStore('notices_cache');
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            return null;
        }
    },
    async setItem(key, value) {
        try {
            const db = await this.getDb();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('notices_cache', 'readwrite');
                const store = tx.objectStore('notices_cache');
                const request = store.put(value, key);
                request.onsuccess = () => resolve(value);
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            return value;
        }
    },
    async clear() {
        try {
            const db = await this.getDb();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('notices_cache', 'readwrite');
                const store = tx.objectStore('notices_cache');
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            console.warn(e);
        }
    }
};

const NoticeContext = createContext();

// 🔧 环境配置
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_URL = isDev
    ? 'http://localhost:3001'
    : window.location.origin;

// 🗄️ 配置 IndexedDB (替代 LocalStorage，解决容量限制与UI阻塞)
localforage.config({
    name: 'AppStorage',
    storeName: 'notices_cache'
});

// --- 辅助函数 ---
const toCamel = (s) => s.replace(/([-_][a-z])/ig, ($1) => $1.toUpperCase().replace('-', '').replace('_', ''));

const convertKeysToCamelCase = (obj) => {
    if (obj == null) return obj;
    if (Array.isArray(obj)) return obj.map(v => convertKeysToCamelCase(v));
    else if (Object.prototype.toString.call(obj) === '[object Object]') {
        return Object.keys(obj).reduce((result, key) => {
            result[toCamel(key)] = convertKeysToCamelCase(obj[key]);
            return result;
        }, {});
    }
    return obj;
};

const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
};

// 内部辅助：调用后端创建通知 (抽取出来以便复用)
const createSystemAlerts = async (payload) => {
    try {
        await fetch(`${BACKEND_URL}/api/alerts`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.error("创建站内通知异常:", err);
    }
};

// 🌟 初始化全局 QueryClient 实例 (解决 No QueryClient set 报错)
const queryClientInstance = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1, // 失败后默认重试1次
            refetchOnWindowFocus: true, // 切换后台再切回来时自动刷新
        },
    },
});

// 将原本的 NoticeProvider 逻辑重命名为内部组件
const NoticeProviderInner = ({ children }) => {
    const queryClient = useQueryClient();
    
    // 监听当前用户状态
    const [currentUser, setCurrentUser] = useState(() => {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    });

    // 🚀 核心优化 1：废除 setInterval，改用事件驱动监听登录状态 (彻底解决发热耗电问题)
    useEffect(() => {
        const handleAuthChange = () => {
            const userStr = window.localStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            
            // 使用函数式更新，避免闭包陷阱
            setCurrentUser(prevUser => {
                if (user?.id !== prevUser?.id) {
                    if (!user) {
                        // 注销时：清空查询缓存和本地 IndexedDB
                        queryClient.removeQueries({ queryKey: ['notices'] });
                        localforage.clear();
                    }
                    return user;
                }
                return prevUser; // 身份未变，不重置状态
            });
        };

        // 监听其他 Tab 页的登录/注销
        window.addEventListener('storage', handleAuthChange);
        // 监听当前 Tab 页我们自己拦截分发的代码触发
        window.addEventListener('auth-change', handleAuthChange);

        // 初始化主动检查一次（防漏防呆）
        handleAuthChange();

        return () => {
            window.removeEventListener('storage', handleAuthChange);
            window.removeEventListener('auth-change', handleAuthChange);
        };
    }, [queryClient]);

    // 🚀 核心优化 2：首屏秒开机制 (从 IndexedDB 提取旧数据注入到 React Query 缓存中)
    useEffect(() => {
        if (currentUser?.id) {
            const cacheKey = `notices_${currentUser.id}`;
            localforage.getItem(cacheKey).then(cachedData => {
                // 如果 React Query 当前没有内存缓存，且有本地数据，则先用本地数据占位（实现界面秒开）
                const existingData = queryClient.getQueryData(['notices', currentUser.id]);
                if (cachedData && !existingData) {
                    queryClient.setQueryData(['notices', currentUser.id], cachedData);
                }
            });
        }
    }, [currentUser?.id, queryClient]);

    // 🌐 数据获取 (React Query 自动管理 Loading 和后台重新验证)
    const { data: notices = [], isLoading: loading } = useQuery({
        queryKey: ['notices', currentUser?.id],
        queryFn: async ({ queryKey }) => {
            const userId = queryKey[1];
            const targetUrl = `${BACKEND_URL}/api/notices?userId=${userId}&role=${currentUser?.role}`;
            const response = await fetch(targetUrl, { method: 'GET', headers: getAuthHeaders() });
            
            if (!response.ok) throw new Error('Fetch notices failed');
            
            const data = await response.json();
            const camelCaseData = convertKeysToCamelCase(data);
            
            // 异步写入 IndexedDB，不阻塞主线程。
            // 因为容量无限，我们不再需要剥离 Base64 和 history！只限制前 200 条防无限增长即可。
            localforage.setItem(`notices_${userId}`, camelCaseData.slice(0, 200));
            
            return camelCaseData;
        },
        // 只有当存在 currentUser 时才发起请求
        enabled: !!currentUser?.id,
        // 默认 30 秒内的数据认为是新鲜的，不会重复触发后台请求
        staleTime: 1000 * 30, 
    });

    const fetchNoticeDetail = async (noticeId) => {
        if (!noticeId) return null;

        const response = await fetch(`${BACKEND_URL}/api/notices?id=${noticeId}&detail=true`, {
            method: 'GET',
            headers: getAuthHeaders(),
        });

        if (!response.ok) throw new Error('Fetch notice detail failed');

        const detail = convertKeysToCamelCase(await response.json());
        const hydratedDetail = { ...detail, isLightweight: false };

        queryClient.setQueryData(['notices', currentUser?.id], old => {
            if (!old) return [hydratedDetail];
            const exists = old.some(n => n.id === noticeId);
            return exists
                ? old.map(n => n.id === noticeId ? { ...n, ...hydratedDetail } : n)
                : [hydratedDetail, ...old];
        });

        return hydratedDetail;
    };

    // 🚀 核心优化 3：乐观更新 (Optimistic Update)
    // 移动端弱网时，点击按钮立刻反馈成功，后台静默请求。如果请求失败再自动回滚。
    const updateMutation = useMutation({
        mutationFn: async ({ noticeId, updates }) => {
            const response = await fetch(`${BACKEND_URL}/api/notices`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ id: noticeId, updates })
            });
            if (!response.ok) throw new Error('Update failed');
            return response.json();
        },
        // 💡 1. 提交前，先乐观地在前端修改状态
        onMutate: async ({ noticeId, updates }) => {
            await queryClient.cancelQueries({ queryKey: ['notices', currentUser?.id] });
            const previousNotices = queryClient.getQueryData(['notices', currentUser?.id]);

            queryClient.setQueryData(['notices', currentUser?.id], old => {
                if (!old) return old;
                return old.map(n => n.id === noticeId ? { ...n, ...convertKeysToCamelCase(updates) } : n);
            });

            return { previousNotices }; // 保存快照用于失败回滚
        },
        // 💡 2. 如果网络请求失败，使用快照回滚 UI
        onError: (err, variables, context) => {
            console.error("更新失败，自动回滚 UI", err);
            if (context?.previousNotices) {
                queryClient.setQueryData(['notices', currentUser?.id], context.previousNotices);
            }
        },
        // 💡 3. 如果请求成功，执行附带的业务逻辑（发站内信等）
        onSuccess: async (data, { updates, noticeId }) => {
            // 将后端的最终数据同步到本地缓存
            const finalData = convertKeysToCamelCase(data);
            queryClient.setQueryData(['notices', currentUser?.id], old => 
                old ? old.map(n => n.id === noticeId ? { ...n, ...finalData } : n) : []
            );

            // --- 你原有的业务逻辑 (发站内信) ---
            const { old_supplier_id } = updates;
            const newStatus = data.status;
            const sdId = data.creator_id;
            const historyArray = data.history || [];
            const lastHistory = historyArray.length > 0 ? historyArray[historyArray.length - 1] : {};
            const historyType = lastHistory?.type;
            const supplierName = data?.supplier?.short_code || '供应商';

            // 1. 发给 SD
            const alertsForSD = [];
            if (newStatus === '待SD确认actions' && sdId) {
                alertsForSD.push({ target_user_id: sdId, message: `${supplierName} 已提交行动计划`, link: `/notices?open=${noticeId}`, created_at: new Date().toISOString() });
            }
            if (newStatus === '待SD关闭evidence' && sdId) {
                alertsForSD.push({ target_user_id: sdId, message: `${supplierName} 已提交完成证据`, link: `/notices?open=${noticeId}`, created_at: new Date().toISOString() });
            }
            if (alertsForSD.length > 0) await createSystemAlerts({ alerts: alertsForSD });

            // 2. 发给 供应商
            if (historyType === 'manager_reassignment' && old_supplier_id) {
                await createSystemAlerts({ createBySupplier: { supplierId: old_supplier_id, title: '任务移除', message: `通知单 ${data.notice_code} 已被移出您的列表`, link: `/notices` } });
                await createSystemAlerts({ createBySupplier: { supplierId: data.assigned_supplier_id, title: '新任务分配', message: `收到新分配的通知单: ${data.title}`, link: `/notices?open=${noticeId}` } });
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
                    createBySupplier: { supplierId: data.assigned_supplier_id, title, message: `${msg} (${data.notice_code})`, link: `/notices?open=${noticeId}` }
                });
            }
        },
        // 💡 4. 无论成功失败，让相关缓存标记为过期，触发后台重新拉取，确保100%一致
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['notices', currentUser?.id] });
        }
    });

    const addMutation = useMutation({
        mutationFn: async (newNoticesArray) => {
            const response = await fetch(`${BACKEND_URL}/api/notices`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(newNoticesArray)
            });
            if (!response.ok) throw new Error('Create failed');
            return response.json();
        },
        onSuccess: async (noticesToProcess) => {
            if (noticesToProcess && noticesToProcess.length > 0) {
                await Promise.all(noticesToProcess.map(async (notice) => {
                    const targetSupplierId = notice.assigned_supplier_id;
                    if (!targetSupplierId) return;
                    await createSystemAlerts({
                        createBySupplier: { supplierId: targetSupplierId, title: '收到新通知单', message: `新任务: ${notice.title} (${notice.notice_code})`, link: `/notices?open=${notice.id}` }
                    });
                }));
            }
            queryClient.invalidateQueries({ queryKey: ['notices', currentUser?.id] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (noticeIds) => {
            await fetch(`${BACKEND_URL}/api/notices`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
                body: JSON.stringify({ ids: noticeIds })
            });
        },
        onMutate: async (noticeIds) => {
            await queryClient.cancelQueries({ queryKey: ['notices', currentUser?.id] });
            const previousNotices = queryClient.getQueryData(['notices', currentUser?.id]);
            // 乐观删除
            queryClient.setQueryData(['notices', currentUser?.id], old => 
                old ? old.filter(n => !noticeIds.includes(n.id)) : []
            );
            return { previousNotices };
        },
        onError: (err, variables, context) => {
            if (context?.previousNotices) {
                queryClient.setQueryData(['notices', currentUser?.id], context.previousNotices);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['notices', currentUser?.id] });
        }
    });

    // 暴露与原来完全一致的 API，保证旧组件兼容
    const updateNotice = (id, updates) => updateMutation.mutateAsync({ noticeId: id, updates });
    const addNotices = (array) => addMutation.mutateAsync(array);
    const deleteNotice = (id) => deleteMutation.mutateAsync([id]);
    const deleteMultipleNotices = (ids) => deleteMutation.mutateAsync(ids);
    
    const sendSystemAnnouncement = async (title, content, priority) => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/users?action=all_users`, { headers: getAuthHeaders() });
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

    const value = {
        notices,
        loading,
        updateNotice,
        addNotices,
        deleteNotice,
        deleteMultipleNotices,
        sendSystemAnnouncement,
        fetchNoticeDetail
    };

    return (
        <NoticeContext.Provider value={value}>
            {children}
        </NoticeContext.Provider>
    );
};

// 🌟 导出带有 React Query 运行环境的全新 Provider
export const NoticeProvider = ({ children }) => {
    return (
        <QueryClientProvider client={queryClientInstance}>
            <NoticeProviderInner>
                {children}
            </NoticeProviderInner>
        </QueryClientProvider>
    );
};

export const useNotices = () => {
    const context = useContext(NoticeContext);
    if (context === undefined) {
        throw new Error('useNotices must be used within a NoticeProvider');
    }
    return context;
};
