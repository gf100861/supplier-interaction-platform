import React, { createContext, useContext } from 'react';
import { message, notification } from 'antd';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const [messageApi, messageContextHolder] = message.useMessage();
    const [notificationApi, notificationContextHolder] = notification.useNotification();

    const contextValue = {
        messageApi,
        notificationApi,
    };

    return (
        <NotificationContext.Provider value={contextValue}>
            {messageContextHolder}
            {notificationContextHolder}
            {children}
        </NotificationContext.Provider>
    );
};


export const useNotification = () => {
    return useContext(NotificationContext);
};