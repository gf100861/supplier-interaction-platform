import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext();

// --- 核心修改 1：定义动态的Socket URL ---
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

    useEffect(() => {
        if (currentUser?.id) {
            // --- 核心修改 2：使用动态URL ---
            const newSocket = io(SOCKET_URL, {
                query: { userId: currentUser.id }
            });
            
            newSocket.on('connect', () => {
                console.log(`✅ WebSocket 已成功连接！Socket ID: ${newSocket.id}`);
            });
            newSocket.on('disconnect', () => {
                console.log(`❌ WebSocket 已断开连接。`);
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