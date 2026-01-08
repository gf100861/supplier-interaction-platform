import React, { createContext, useContext, useState, useEffect } from 'react';
// ❌ 移除 Supabase 客户端引用
// import { supabase } from '../supabaseClient';

const CategoryContext = createContext();

// 🔧 配置 API 基础地址
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const BACKEND_URL = isDev
        ? 'http://localhost:3001'  // 本地开发环境
        : 'https://supplier-interaction-platform-backend.vercel.app'; // Vercel 生产环境
export const CategoryProvider = ({ children }) => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                // ✅ 修改点：改为 fetch 后端 API
                const apiPath = isDev ? `/api/categories` : `/api/categories`;
                const targetUrl = `${BACKEND_URL}${apiPath}`;
                const response = await fetch(`${targetUrl}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                // 后端已经做好了转换 (返回的是字符串数组)，前端直接用即可
                const data = await response.json();
                setCategories(data);

            } catch (error) {
                console.error("获取问题类型数据失败:", error);
                // 这里可以加一个 fallback 数据，以防后端挂了影响下拉框
                // setCategories(['产品质量', '物流交付', '服务响应']); 
            } finally {
                setLoading(false);
            }
        };

        fetchCategories();
    }, []); 

    const value = { categories, loading };

    return (
        <CategoryContext.Provider value={value}>
            {children}
        </CategoryContext.Provider>
    );
};

export const useCategories = () => {
    return useContext(CategoryContext);
};