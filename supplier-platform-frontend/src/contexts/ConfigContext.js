import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient'; // 1. 导入我们创建的 Supabase 客户端

const ConfigContext = createContext();

export const ConfigProvider = ({ children }) => {
    const [config, setConfig] = useState({
        noticeCategories: [],
        noticeCategoryDetails: {},
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                // --- 2. 核心修正：从 Supabase 的 'notice_categories' 表中获取数据 ---
                const { data, error } = await supabase
                    .from('notice_categories')
                    .select('*')
                    .order('created_at', { ascending: true });
                
                if (error) throw error;

                // --- 3. 将从数据库获取的数据，处理成我们前端需要的两种格式 ---
                const categories = data.map(c => c.name); //  -> ['产品质量', '现场管理', ...]
                
                const details = data.reduce((acc, c) => {
                    acc[c.name] = { id: c.id, name: c.name, color: c.color };
                    return acc;
                }, {}); // -> { '产品质量': { id: 'QC', ..., color: 'blue' }, ... }

                setConfig({
                    noticeCategories: categories,
                    noticeCategoryDetails: details,
                });

            } catch (err) {
                console.error("从Supabase获取配置数据失败:", err);
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