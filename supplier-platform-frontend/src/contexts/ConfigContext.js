import React, { createContext, useContext, useState, useEffect } from 'react';
// ❌ 移除 Supabase 客户端
// import { supabase } from '../supabaseClient'; 

const ConfigContext = createContext();

// 🔧 配置 API 基础地址 (包含环境判断)
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_URL = isDev
    ? 'http://localhost:3001'
    : 'https://supplier-interaction-platform-backend.vercel.app'; // ⚠️ 替换为你真实的 Vercel 域名

export const ConfigProvider = ({ children }) => {
    const [config, setConfig] = useState({
        noticeCategories: [],
        noticeCategoryDetails: {},
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                // ✅ 修改点：Fetch 后端接口
                const apiPath = isDev ? `/api/config` : `/api/config`;
                const targetUrl = `${BACKEND_URL}${apiPath}`;
                const response = await fetch(targetUrl);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                // 后端返回的是原始数组 data
                const data = await response.json();

                // --- 保持原本的数据处理逻辑不变 ---
                // 1. 提取名称列表
                const categories = data.map(c => c.name); 
                
                // 2. 构建详情映射对象
                const details = data.reduce((acc, c) => {
                    acc[c.name] = { id: c.id, name: c.name, color: c.color };
                    return acc;
                }, {});

                setConfig({
                    noticeCategories: categories,
                    noticeCategoryDetails: details,
                });

            } catch (err) {
                console.error("从API获取配置数据失败:", err);
                // 可选：设置默认值防止页面崩溃
            } finally {
                setLoading(false);
            }
        };

        fetchConfig();
    }, []);

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

export const useConfig = () => {
    return useContext(ConfigContext);
};