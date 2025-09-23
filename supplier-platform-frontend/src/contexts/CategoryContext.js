import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const CategoryContext = createContext();

export const CategoryProvider = ({ children }) => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                // 从 Supabase 的 'notice_categories' 表中获取所有记录的 name 字段
                const { data, error } = await supabase
                    .from('notice_categories')
                    .select('name')
                    .order('created_at', { ascending: true }); // 按创建时间排序

                if (error) throw error;
                
                // 将返回的对象数组 [{name: '产品质量'}, ...] 转换为字符串数组 ['产品质量', ...]
                const categoryNames = data.map(c => c.name);
                setCategories(categoryNames);

            } catch (error) {
                console.error("获取问题类型数据失败:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchCategories();
    }, []); // 空依赖数组，确保只在应用启动时获取一次

    const value = { categories, loading };

    return (
        <CategoryContext.Provider value={value}>
            {children}
        </CategoryContext.Provider>
    );
};

// 创建一个自定义 Hook，方便其他组件使用
export const useCategories = () => {
    return useContext(CategoryContext);
};