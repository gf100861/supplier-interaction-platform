import React, { createContext, useContext, useMemo } from 'react';
// 从我们统一的数据源导入供应商列表
import { suppliersList } from '../data/_mockData';

// 1. 创建 Context
const SupplierContext = createContext();

// 2. 创建 Provider 组件
export const SupplierProvider = ({ children }) => {
    // 在真实应用中，这里可能会用 useEffect 从API获取数据
    // 目前我们直接从模拟数据文件中读取
    const suppliers = useMemo(() => suppliersList, []);

    return (
        <SupplierContext.Provider value={{ suppliers }}>
            {children}
        </SupplierContext.Provider>
    );
};

// 3. 创建一个自定义 Hook，方便其他组件使用
export const useSuppliers = () => {
    return useContext(SupplierContext);
};