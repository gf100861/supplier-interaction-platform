import React, { createContext, useContext } from 'react';
import { message, notification } from 'antd';

// 1. 创建 Context
const NotificationContext = createContext();

// 2. 创建 Provider 组件
export const NotificationProvider = ({ children }) => {
    const [messageApi, messageContextHolder] = message.useMessage();
    const [notificationApi, notificationContextHolder] = notification.useNotification();

    // 将 API 实例通过 value 传递下去
    const contextValue = {
        messageApi,
        notificationApi,
    };

    return (
        <NotificationContext.Provider value={contextValue}>
            {/* 3. 在这里渲染“上下文持有者”，这是最关键的一步 */}
            {messageContextHolder}
            {notificationContextHolder}
            {children}
        </NotificationContext.Provider>
    );
};

// 4. 创建一个自定义 Hook，方便子组件调用
export const useNotification = () => {
    return useContext(NotificationContext);
};