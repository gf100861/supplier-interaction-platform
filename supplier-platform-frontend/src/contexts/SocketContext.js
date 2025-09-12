import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

    useEffect(() => {
        if (currentUser?.id) {
            const newSocket = io('http://localhost:3001', {
                query: { userId: currentUser.id }
            });
            
            // --- 在这里增加日志 ---
            newSocket.on('connect', () => {
                console.log(`✅ [FRONTEND-CHECKPOINT-2] WebSocket 已成功连接！Socket ID: ${newSocket.id}`);
            });
            newSocket.on('disconnect', () => {
                console.log(`❌ [FRONTEND-CHECKPOINT-2] WebSocket 已断开连接。`);
            });

            setSocket(newSocket);
            return () => newSocket.close();
        }
    }, [currentUser]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => {
    return useContext(SocketContext);
};