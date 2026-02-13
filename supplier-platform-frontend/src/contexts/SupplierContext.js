import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const SupplierContext = createContext();

const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_URL = isDev
    ? 'http://localhost:3001'
    : 'https://supplier-interaction-platform-backend.vercel.app';

export const SupplierProvider = ({ children }) => {
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);

    // ✅ 改动 1: 使用 useCallback，并移除顶层的 token 定义
    const fetchSuppliers = useCallback(async () => {
        // ✅ 改动 2: 在函数执行的瞬间，才去 LocalStorage 拿 Token
        // 这样能保证哪怕你是刚登录跳转过来的，也能拿到最新的 Token
        const token = localStorage.getItem('access_token');
        
        if (!token) {
            setLoading(false);
            return;
        }

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        try {
            // 这里为了用户体验，可以不置为 true，实现“静默更新”
            // setLoading(true); 
            
            const apiPath = `/api/suppliers`;
            const targetUrl = `${BACKEND_URL}${apiPath}`;

            const response = await fetch(targetUrl, { headers });
            
            if (response.status === 401) {
                console.error("Token 过期");
                // 可以在这里处理登出逻辑
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setSuppliers(Array.isArray(data) ? data : []);

        } catch (error) {
            console.error("Error fetching suppliers:", error.message);
        } finally {
            setLoading(false);
        }
    }, []); 

    // ✅ 改动 3: 初始化时尝试获取一次
    useEffect(() => {
        fetchSuppliers();
    }, [fetchSuppliers]);

    const value = { 
        suppliers, 
        loading, 
        refreshSuppliers: fetchSuppliers // 暴露刷新方法
    };

    return (
        <SupplierContext.Provider value={value}>
            {children}
        </SupplierContext.Provider>
    );
};

export const useSuppliers = () => {
    const context = useContext(SupplierContext);
    if (context === undefined) {
        throw new Error('useSuppliers must be used within a SupplierProvider');
    }
    return context;
};