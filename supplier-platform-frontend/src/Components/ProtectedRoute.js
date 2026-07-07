import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = () => {
    // 检查localStorage中是否有用户信息（或token）
    const user = localStorage.getItem('user');

    // 如果用户存在（已登录），则渲染子路由（Outlet）
    // 否则，重定向到登录页面
    return user ? <Outlet /> : <Navigate to="/login" />;
};

export default ProtectedRoute;