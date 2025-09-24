// supplier-platform-frontend/src/contexts/AlertContext.js (Corrected)

import React, { useState, createContext, useContext, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
// --- This is the corrected import statement ---
import { useSocket } from './SocketContext';

const AlertContext = createContext();
export const useAlerts = () => useContext(AlertContext);

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const AlertProvider = ({ children }) => {
    const [alerts, setAlerts] = useState([]);
    const socket = useSocket(); // Now this line will work correctly
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

    // Effect to fetch initial historical alerts
    useEffect(() => {
        if (currentUser) {
            const userId = currentUser.role === 'Supplier' ? currentUser.supplier_id : currentUser.id;
            if (userId) {
                console.log(`[AlertContext] Attempting to fetch historical alerts for user/supplier ID: ${userId}`);
                fetch(`${API_BASE_URL}/api/alerts/${userId}`)
                    .then(res => res.json())
                    .then(data => {
                        console.log(`[AlertContext] Successfully fetched ${data.length} historical alerts.`);
                        setAlerts(data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
                    })
                    .catch(err => console.error("[AlertContext] Failed to fetch historical alerts:", err));
            }
        }
    }, [currentUser]);

    // Effect to listen for real-time alerts
    useEffect(() => {
        if (socket) {
            console.log('[AlertContext] Socket instance is ready. Setting up "new_alert" listener...');

            const handleNewAlert = (newAlert) => {
                console.log('✅ [AlertContext] Received "new_alert" event:', newAlert);
                setAlerts(prevAlerts => [newAlert, ...prevAlerts]);
            };
        
            socket.on('new_alert', handleNewAlert);

            return () => {
                console.log('[AlertContext] Cleaning up "new_alert" listener...');
                socket.off('new_alert', handleNewAlert);
            };
        } else {
            console.log('[AlertContext] Waiting for socket instance...');
        }
    }, [socket]);

    // Function to create a new alert by calling the backend
    const addAlert = async (senderId, recipientId, message, link = '#') => {
        const newAlertData = {
            id: uuidv4(),
            senderId, recipientId, message, link,
            timestamp: new Date().toISOString(),
            isRead: false,
        };

        try {
            await fetch(`${API_BASE_URL}/api/alerts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newAlertData),
            });
        } catch (error) {
            console.error("Failed to create alert:", error);
        }
    };
    
    const markAsRead = (alertId) => {
        setAlerts(prev => prev.map(a => (a.id === alertId ? { ...a, isRead: true } : a)));
    };

    const markAllAsRead = (userId) => {
        setAlerts(prev => prev.map(a => (a.recipientId === userId ? { ...a, isRead: true } : a)));
    };

    const clearAlerts = (userId) => {
        setAlerts(prev => prev.filter(a => a.recipientId !== userId));
    };

    const value = { alerts, addAlert, markAsRead, markAllAsRead, clearAlerts };

    return (
        <AlertContext.Provider value={value}>
            {children}
        </AlertContext.Provider>
    );
};