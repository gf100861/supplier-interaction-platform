import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient'; // 1. 引入 Supabase 客户端

// 创建 Context (保持不变)
const SupplierContext = createContext();

// 2. 创建 Provider 组件 (核心修改)
export const SupplierProvider = ({ children }) => {
    // a. 使用 useState 管理供应商数据和加载状态
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);

    // b. 使用 useEffect 在组件加载时从 Supabase 获取数据
    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                // 从 'suppliers' 表中获取所有数据，并按名称排序
                const { data, error } = await supabase
                    .from('suppliers')
                    .select('*')
                    .order('name', { ascending: true });

                if (error) {
                    throw error; // 如果出错，抛出异常
                }

                setSuppliers(data || []); // 更新 suppliers 状态
            } catch (error) {
                console.error("Error fetching suppliers:", error.message);
            } finally {
                setLoading(false); // 无论成功或失败，最后都结束加载状态
            }
        };

        fetchSuppliers();
    }, []); // 空依赖数组 [] 意味着这个 effect 只在组件首次挂载时运行一次

    // c. 将 suppliers 和 loading 状态提供给所有子组件
    const value = { suppliers, loading };

    return (
        <SupplierContext.Provider value={value}>
            {children}
        </SupplierContext.Provider>
    );
};

// 3. 创建自定义 Hook (现在它会返回 suppliers 和 loading)
export const useSuppliers = () => {
    const context = useContext(SupplierContext);
    if (context === undefined) {
        throw new Error('useSuppliers must be used within a SupplierProvider');
    }
    return context;
};

