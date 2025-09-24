import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Menu, Space, Avatar, Button, Typography, message } from 'antd';
import {
    HomeOutlined,
    UserOutlined,
    SolutionOutlined,
    LogoutOutlined,
    AuditOutlined,
    LineChartOutlined,
    PrinterOutlined
} from '@ant-design/icons';
import './MainLayout.css';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { AlertBell } from './AlertBell';
import { ProductionAlertBell } from './ProductionAlertBell';

const { Header, Content, Footer, Sider } = Layout;
const { Text } = Typography;

const allMenuItems = [
    { key: '/', icon: <HomeOutlined />, label: '仪表盘', roles: ['SD', 'Manager', 'Supplier'] },
    { key: '/audit-plan', icon: <AuditOutlined />, label: '年度计划', roles: ['SD', 'Manager'] },
    {
        key: 'notice-group',
        icon: <SolutionOutlined />,
        label: '通知单处理',
        roles: ['SD', 'Manager', 'Supplier'],
        children: [
            { key: '/notices', label: '整改通知单列表', roles: ['SD', 'Manager', 'Supplier'] },
            { key: '/upload', label: '输入新的审核结果', roles: ['SD', 'Manager'] },
            { key: '/batch-create', label: '批量创建 (Excel)', roles: ['SD', 'Manager'] },
        ]
    },
    { key: '/analysis', icon: <LineChartOutlined />, label: '历史问题分析', roles: ['SD', 'Manager'] },
    { key: '/reports', icon: <PrinterOutlined />, label: '综合报告', roles: ['SD', 'Manager', 'Supplier'] },
    { key: '/settings', icon: <UserOutlined />, label: '系统设置', roles: ['SD', 'Manager', 'Supplier'] },
];

const getOpenKeys = (path) => {
    for (const item of allMenuItems) {
        if (item.children && item.children.some(child => child.key === path)) {
            return [item.key];
        }
    }
    return [];
};

// 智能的权限过滤函数
const filterMenu = (menuItems, role) => {
    return menuItems
        .map(item => {
            if (!role || !item.roles || !item.roles.includes(role)) return null;
            if (item.children) {
                const visibleChildren = filterMenu(item.children, role);
                if (visibleChildren.length === 0) return null;
                if (visibleChildren.length === 1) {
                    return { ...item, key: visibleChildren[0].key, children: undefined };
                }
                return { ...item, children: visibleChildren };
            }
            return item;
        })
        .filter(item => item !== null);
};

const MainLayout = () => {
    const [collapsed, setCollapsed] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const [selectedKeys, setSelectedKeys] = useState([]);
    const [openKeys, setOpenKeys] = useState([]);
    
    // --- 核心修正 1：优化菜单高亮和展开的 useEffect ---
    useEffect(() => {
        const currentPath = '/' + location.pathname.split('/')[1];
        setSelectedKeys([currentPath]);
        if (!collapsed) {
            setOpenKeys(getOpenKeys(currentPath));
        }
    }, [location.pathname, collapsed]);

    const handleLogout = () => {
        localStorage.removeItem('user');
        message.success('您已成功登出！');
        navigate('/login');
    };

    const handleMenuClick = (e) => {
        navigate(e.key);
    };

    // --- 核心修正 2：让用户信息在每次路由变化时都重新获取 ---
    const storedUser = useMemo(() => {
        const userString = localStorage.getItem('user');
        return userString ? JSON.parse(userString) : null;
    }, [location.pathname]); // 依赖于路由路径

    const userRole = storedUser?.role || null;
    const userName = storedUser?.username || '访客';
    const visibleMenuItems = useMemo(() => filterMenu(allMenuItems, userRole), [userRole]);

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
                <div className="logo" />
                <Menu 
                    theme="dark" 
                    selectedKeys={selectedKeys}
                    openKeys={openKeys}
                    onOpenChange={setOpenKeys}
                    mode="inline" 
                    items={visibleMenuItems}
                    onClick={handleMenuClick}
                />
            </Sider>
            <Layout className="site-layout">
                <Header 
                    style={{ 
                        padding: '0 24px', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        backgroundColor: '#fff',
                    }}
                >
                    <h2 style={{ color: '#1890ff', margin: 0, fontSize: '20px' }}>供应商与SD信息交换平台</h2>
                    <Space size="large">
                        <ProductionAlertBell />
                        <Avatar style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
                        <Text>欢迎您, <Text strong>{userName}</Text></Text>
                        <Button type="primary" icon={<LogoutOutlined />} onClick={handleLogout}>登出</Button>
                    </Space>
                </Header>
                <Content style={{ margin: '16px' }}>
                    <div style={{ padding: 24, minHeight: '100%', background: '#fff', borderRadius: '8px' }}>
                        <Outlet />
                    </div>
                </Content>
                <Footer style={{ textAlign: 'center' }}>
                    Supplier Platform ©2025 Created by Louis
                </Footer>
            </Layout>
        </Layout>
    );
};

export default MainLayout;