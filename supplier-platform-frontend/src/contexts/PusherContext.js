import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import Pusher from 'pusher-js';

const PusherContext = createContext();

// 环境变量，确保部署后也能正常工作
const PUSHER_KEY = process.env.REACT_APP_PUSHER_KEY;
const PUSHER_CLUSTER = process.env.REACT_APP_PUSHER_CLUSTER;

export const PusherProvider = ({ children }) => {
    const [pusher, setPusher] = useState(null);
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

    useEffect(() => {
        // 只有在获取到 Pusher Key 和 Cluster 后才初始化
        if (PUSHER_KEY && PUSHER_CLUSTER) {
            const pusherInstance = new Pusher(PUSHER_KEY, {
                cluster: PUSHER_CLUSTER,
            });

            console.log("✅ [Pusher] 客户端已成功初始化。");
            setPusher(pusherInstance);

            // 组件卸载时，断开连接
            return () => {
                console.log("🔴 [Pusher] 正在断开连接...");
                pusherInstance.disconnect();
            };
        } else {
            console.error("❌ [Pusher] 错误：未在 .env 文件中找到 Pusher Key 或 Cluster。");
        }
    }, []);

    return (
        <PusherContext.Provider value={pusher}>
            {children}
        </PusherContext.Provider>
    );
};

export const usePusher = () => {
    return useContext(PusherContext);
};