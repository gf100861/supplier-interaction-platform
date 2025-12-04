import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Menu, Space, Avatar, Button, Typography, message } from 'antd';
import {
    HomeOutlined,
    UserOutlined,
    SolutionOutlined,
    LogoutOutlined,
    AuditOutlined,
    BookOutlined,
    PrinterOutlined,
    ShareAltOutlined,
    OpenAIOutlined,
    GlobalOutlined,
    CrownOutlined
} from '@ant-design/icons';
import './MainLayout.css';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { AlertBell } from './notice/AlertBell';
import { FileReceiver } from '../Pages/FileReceiver';
import { useLanguage } from '../contexts/LanguageContext';

const { Header, Content, Footer, Sider } = Layout;
const { Text } = Typography;

// 智能的权限过滤函数
const filterMenu = (menuItems, role) => {
    return menuItems
        .map(item => {
            if (!role || !item.roles || !item.roles.includes(role)) return null;
            if (item.children) {
                const visibleChildren = filterMenu(item.children, role);
                if (visibleChildren.length === 0) return null;
                // 如果子菜单只有一个，且没有显式设置不扁平化，逻辑上可以扁平化，但 Antd Menu 需要层级，这里保留层级
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

    const { language, toggleLanguage, t } = useLanguage();

    // --- 核心修正：将菜单定义移入组件内部，以便使用 t() ---
    // 使用 useMemo 并在依赖中加入 'language'，确保切换语言时重新生成菜单
    const allMenuItems = useMemo(() => [
        { key: '/', icon: <HomeOutlined />, label: t('menu.dashboard'), roles: ['SD', 'Manager', 'Supplier', 'Admin'] },
        { key: '/audit-plan', icon: <AuditOutlined />, label: t('menu.auditPlan'), roles: ['SD', 'Manager'] },
        {
            key: 'notice-group',
            icon: <SolutionOutlined />,
            label: t('menu.noticeGroup'),
            roles: ['SD', 'Manager', 'Supplier'],
            children: [
                { key: '/notices', label: t('menu.notices'), roles: ['SD', 'Manager', 'Supplier'] },
                { key: '/upload', label: t('menu.manualUpload'), roles: ['SD', 'Manager'] },
                { key: '/batch-create', label: t('menu.batchCreate'), roles: ['SD', 'Manager'] },
            ]
        },
        {
            key: '/intelligence-search',
            icon: <OpenAIOutlined />,
            label: t('menu.intelligenceSearch'),
            roles: ['SD', 'Manager', 'Admin']
        },
        { key: '/analysis', icon: <BookOutlined />, label: t('menu.analysis'), roles: ['SD', 'Manager', 'Admin'] },
        { key: '/reports', icon: <PrinterOutlined />, label: t('menu.reports'), roles: ['SD', 'Manager', 'Supplier'] },
        {
            key: '/offline-share',
            icon: <ShareAltOutlined />,
            label: t('menu.offlineShare'),
            roles: ['SD', 'Manager', 'Admin']
        },
        { key: '/settings', icon: <UserOutlined />, label: t('menu.settings'), roles: ['SD', 'Manager', 'Supplier'] },
        {
            key: '/admin',
            icon: <CrownOutlined />,
            label: t('menu.admin'),
            roles: ['Admin']
        }
    ], [language, t]); // 依赖项包含 language

    const getOpenKeys = (path) => {
        for (const item of allMenuItems) {
            if (item.children && item.children.some(child => child.key === path)) {
                return [item.key];
            }
        }
        return [];
    };

    useEffect(() => {
        const currentPath = '/' + location.pathname.split('/')[1];
        // 特殊处理根路径
        const effectiveKey = location.pathname === '/' ? '/' : currentPath;

        setSelectedKeys([location.pathname]); // 精确匹配
        if (!collapsed) {
            // 如果已经在 submenu 中，保持展开
            const newOpenKeys = getOpenKeys(location.pathname);
            if (newOpenKeys.length > 0) setOpenKeys(prev => [...new Set([...prev, ...newOpenKeys])]);
        }
    }, [location.pathname, collapsed, allMenuItems]);

    const handleLogout = () => {
        localStorage.removeItem('user');
        message.success(t('common.logoutSuccess'));
        navigate('/login');
    };

    const handleMenuClick = (e) => {
        navigate(e.key);
    };

    const storedUser = useMemo(() => {
        const userString = localStorage.getItem('user');
        return userString ? JSON.parse(userString) : null;
    }, [location.pathname]);

    const userRole = storedUser?.role || null;
    const userName = storedUser?.username || '访客';
    const visibleMenuItems = useMemo(() => filterMenu(allMenuItems, userRole), [allMenuItems, userRole]);

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>

                {/* 使用新的 class 容器 */}
                {/* 使用 class 控制样式，移除内联 style */}
                <div className="logo-container">
                    <img
                        src="/system-logo.png"
                        alt="Logo"
                        className="logo-img"
                    />
                    {/* 如果需要显示文字，且在收起时隐藏 */}
                    {!collapsed && (
                        <span style={{
                            color: 'white',
                            marginLeft: 8,
                            fontWeight: 600,
                            fontSize: '14px',
                            whiteSpace: 'nowrap', // 防止文字换行
                            overflow: 'hidden'
                        }}>
                            SD Platform
                        </span>
                    )}
                </div>
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
                    <h2 style={{ color: '#1890ff', margin: 0, fontSize: '20px' }}>{t('app.title')}</h2>
                    <Space size="large">

                        <Avatar style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
                        <Text>{t('header.welcome')}, <Text strong>{userName}</Text></Text>

                        <Button
                            type="text"
                            icon={<GlobalOutlined />}
                            onClick={toggleLanguage}
                        >
                            {language === 'zh' ? 'English' : '中文'}
                        </Button>
                        <AlertBell />
                        <Button type="primary" icon={<LogoutOutlined />} onClick={handleLogout}>{t('header.logout')}</Button>
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
            <FileReceiver />
        </Layout>
    );
};

export default MainLayout;