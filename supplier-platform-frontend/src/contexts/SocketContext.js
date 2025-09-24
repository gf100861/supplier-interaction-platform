import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext();

// 确保这个 URL 指向您部署的后端服务
const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

    useEffect(() => {
        // --- 核心修改开始 ---

        // 根据用户角色，决定用于 Socket 连接的唯一标识符
        let socketId;
        if (currentUser?.role === 'Supplier') {
            // 如果是供应商，使用其公司ID (supplier_id) 进行连接，以便接收发给该公司的通知
            socketId = currentUser.supplier_id; 
        } else if (currentUser?.id) {
            // 如果是SD或经理，使用他们个人的用户ID进行连接
            socketId = currentUser.id;
        }

        // 只有在确定了用于连接的 ID 后，才开始建立连接
        if (socketId) {
            const newSocket = io(SOCKET_URL, {
                query: { userId: socketId } // 使用上面确定的 ID
            });
            
            newSocket.on('connect', () => {
                console.log(`✅ WebSocket 已成功连接！Socket ID: ${newSocket.id}, for User/Supplier ID: ${socketId}`);
            });
            
            newSocket.on('disconnect', () => {
                console.log(`❌ WebSocket 已断开连接。`);
            });

            setSocket(newSocket);
            
            // 组件卸载时，自动断开连接以清理资源
            return () => newSocket.close();
        }
    }, [currentUser]); // 当 currentUser 变化时（例如用户登录或退出），重新执行此 effect

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => {
    return useContext(SocketContext);
};