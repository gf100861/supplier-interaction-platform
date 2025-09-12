import React, { createContext, useContext, useState, useEffect } from 'react'; // 1. 引入 useEffect

// 移除了从 _mockData 导入，因为我们即将从API获取
// import { mockNoticesData } from '../data/_mockData'; 
import { useSocket } from './SocketContext'; // 1. 导入 useSocket
const NoticeContext = createContext();

export const NoticeProvider = ({ children }) => {
    // 2. 将初始数据设为空数组，并增加 loading 和 error 状态
    const [notices, setNotices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const socket = useSocket(); // 2. 获取 socket 实例

    // 3. --- 核心修改：使用 useEffect 在组件加载时从后端获取数据 ---
    useEffect(() => {
        const fetchNotices = async () => {
            try {
                // 向我们的后端服务器发起请求
                const response = await fetch('http://localhost:3001/api/notices');
                
                if (!response.ok) {
                    throw new Error(`HTTP 错误！状态: ${response.status}`);
                }
                
                const data = await response.json();
                setNotices(data); // 将获取到的数据存入 state
                setError(null); // 清除之前的错误

            } catch (err) {
                console.error("从后端获取数据失败:", err);
                setError("无法加载数据，请确保后端服务已开启。");
            } finally {
                setLoading(false); // 无论成功或失败，都结束加载状态
            }
        };

        fetchNotices();
    }, []); // 空依赖数组 [] 意味着这个 effect 只在应用首次加载时运行一次


     useEffect(() => {
        if (!socket) return; // 确保 socket 已连接

        // 定义监听器
        const handleNoticeUpdate = (updatedNotice) => {
            console.log('收到实时更新:', updatedNotice);
            setNotices(prevNotices => 
                prevNotices.map(n => 
                    n.id === updatedNotice.id ? updatedNotice : n
                )
            );
        };

         const handleNoticesAdded = (addedNotices) => {
            console.log('收到[批量新增]实时更新:', addedNotices);
            setNotices(prevNotices => [...prevNotices, ...addedNotices]);
        };
        

        // 绑定监听
        socket.on('notice_updated', handleNoticeUpdate);
        socket.on('notices_added', handleNoticesAdded); // 绑定新事件

        // 组件卸载时，解除监听，防止内存泄漏
        return () => {
            socket.off('notice_updated', handleNoticeUpdate);
            socket.off('notices_added', handleNoticesAdded); // 解除新事件
        };
    }, [socket]); // 当 socket 连接成功后，执行此 effect


   const updateNotice = async (noticeId, updates) => {
        try {
            const response = await fetch(`http://localhost:3001/api/notices/${noticeId}`, {
                method: 'PUT', // 使用 PUT 方法
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updates), // 将要更新的数据转换为JSON字符串
            });

            if (!response.ok) {
                throw new Error(`HTTP 错误！状态: ${response.status}`);
            }
            
            const updatedNoticeFromServer = await response.json();

            // 更新成功后，用后端返回的最新数据来更新前端的 state
            setNotices(prevNotices => 
                prevNotices.map(n => 
                    n.id === noticeId ? updatedNoticeFromServer : n
                )
            );

        } catch (err) {
            console.error("更新通知单失败:", err);
            // 在这里可以向用户显示一个错误提示
            // 例如: messageApi.error("更新失败，请重试！");
        }
    };
     const addNotices = async (newNoticesArray) => {
        try {
            const response = await fetch('http://localhost:3001/api/notices/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newNoticesArray),
            });

            if (!response.ok) {
                throw new Error(`HTTP 错误！状态: ${response.status}`);
            }
            
            // 注意：我们在这里不手动 setNotices。
            // 因为后端会通过 WebSocket 广播更新，我们的监听器会自动处理。
            // 这确保了数据来源的唯一性，所有客户端（包括提交者自己）都通过同样的方式接收更新。

        } catch (err) {
            console.error("批量创建通知单失败:", err);
            // 这里可以向用户显示一个错误提示
        }
    };

    const value = {
        notices,
        loading, // 4. 将 loading 和 error 状态也传递下去
        error,
        updateNotice,
        addNotices,
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