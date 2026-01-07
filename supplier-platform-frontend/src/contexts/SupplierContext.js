import React, { createContext, useContext, useState, useEffect } from 'react';
// ❌ 移除 Supabase 客户端引用
// import { supabase } from '../supabaseClient';

const SupplierContext = createContext();

// 🔧 动态配置 API 基础地址
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_URL = isDev
    ? 'http://localhost:3001'
    : 'https://supplier-interaction-backend.vercel.app'; // ⚠️ 请替换为你真实的 Vercel 项目域名

export const SupplierProvider = ({ children }) => {
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                // ✅ 修改点：Fetch 后端 API
                const apiPath = isDev ? `/api/suppliers` : `/api/suppliers.js`;
                const targetUrl = `${BACKEND_URL}${apiPath}`;


                const response = await fetch(targetUrl);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();

                // 确保数据是数组，防止后端报错导致前端崩溃
                setSuppliers(Array.isArray(data) ? data : []);

            } catch (error) {
                console.error("Error fetching suppliers from API:", error.message);
                // 可选：失败时可以设置为空数组，或者显示错误提示
                setSuppliers([]);
            } finally {
                setLoading(false);
            }
        };

        fetchSuppliers();
    }, []);

    const value = { suppliers, loading };

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