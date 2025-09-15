import React, { createContext, useContext, useState, useEffect } from 'react';

const ConfigContext = createContext();

// --- 核心修改 1：定义动态的API基础URL ---
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';


export const ConfigProvider = ({ children }) => {
    const [config, setConfig] = useState({
        noticeCategories: [],
        noticeCategoryDetails: {},
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 在应用加载时，从后端获取全局配置
        // --- 核心修改 2：使用动态URL ---
        fetch(`${API_BASE_URL}/api/config`)
            .then(res => res.json())
            .then(data => {
                setConfig(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("获取应用配置失败:", err);
                setLoading(false);
            });
    }, []); // 空依赖数组，确保只在启动时获取一次

    const value = {
        ...config,
        loading,
    };

    return (
        <ConfigContext.Provider value={value}>
            {children}
        </ConfigContext.Provider>
    );
};

// 创建一个自定义 Hook，方便其他组件使用
export const useConfig = () => {
    return useContext(ConfigContext);
};