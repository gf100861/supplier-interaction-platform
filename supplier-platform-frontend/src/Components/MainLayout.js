import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Menu, Space, Avatar, Button, Typography, message, Alert, Tag, Tooltip } from 'antd'; // 引入 Tooltip 用于 Header 按钮
import {
    HomeOutlined,
    UserOutlined,
    SolutionOutlined,
    LogoutOutlined,
    AuditOutlined,
    BookOutlined,
    PrinterOutlined,
    ShareAltOutlined,
    GlobalOutlined,
    CrownOutlined,
    RobotOutlined,
    InfoCircleOutlined,
    ExclamationOutlined,
    CloseCircleOutlined,
    WarningOutlined,
    SoundOutlined,
    QuestionCircleOutlined // 1. 引入帮助图标
} from '@ant-design/icons';
import './MainLayout.css';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { AlertBell } from './notice/AlertBell';
import { FileReceiver } from '../Pages/FileReceiver';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../supabaseClient';

const { Header, Content, Footer, Sider } = Layout;
const { Text } = Typography;

// --- 智能权限过滤函数 (保持不变) ---
const filterMenu = (menuItems, role) => {
    return menuItems
        .map(item => {
            if (!role || !item.roles || !item.roles.includes(role)) return null;
            if (item.children) {
                const visibleChildren = filterMenu(item.children, role);
                if (visibleChildren.length === 0) return null;
                return { ...item, children: visibleChildren };
            }
            return item;
        })
        .filter(item => item !== null);
};

// --- 修改后的组件：滚动通知栏 (支持后端数据 + 实时更新) ---
const RollingNoticeBar = () => {
    // 控制显示的状态
    const [visible, setVisible] = useState(true);
    // 存储从后端获取的通知数据
    const [notices, setNotices] = useState([]);

    // 定义存储在 localStorage 中的 key
    const STORAGE_KEY = 'system_notice_closed_date';

    // 1. 初始化检查本地缓存 (是否今日已关闭)
    useEffect(() => {
        const closedDate = localStorage.getItem(STORAGE_KEY);
        const today = new Date().toDateString();
        if (closedDate === today) {
            setVisible(false);
        }
    }, []);

    // 2. 从 Supabase 获取数据并建立实时监听
    useEffect(() => {
        const fetchNotices = async () => {
            const { data, error } = await supabase
                .from('system_notices')
                .select('*')
                .eq('is_active', true) // 只获取激活状态的公告
                .order('created_at', { ascending: false });

            if (!error && data) {
                setNotices(data);
            }
        };

        // 初次加载
        fetchNotices();

        // 订阅实时变化 (新增/删除公告时自动刷新)
        const channel = supabase
            .channel('public:system_notices')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'system_notices' }, () => {
                fetchNotices();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // 如果没有通知，或者用户已经关闭，直接不渲染
    if (!visible || !notices || notices.length === 0) return null;

    // --- 动态颜色逻辑 ---
    // 优先级: Error (红) > Warning (橙) > Info (蓝)
    const hasError = notices.some(n => n.type === 'error');
    const hasWarning = notices.some(n => n.type === 'warning');

    let alertType = 'info';
    let icon = <SoundOutlined />;

    if (hasError) {
        alertType = 'error';
        icon = <ExclamationOutlined />;
    } else if (hasWarning) {
        alertType = 'warning';
        icon = <WarningOutlined />;
    }

    // 处理关闭事件
    const handleClose = () => {
        const today = new Date().toDateString();
        localStorage.setItem(STORAGE_KEY, today);
        setVisible(false);
    };

    const renderContent = () => (
        <div className="scrolling-notice-content">
            {notices.map((notice) => (
                <span key={notice.id} style={{ marginRight: '60px', display: 'inline-flex', alignItems: 'center' }}>
                    <Tag color={notice.type === 'error' ? 'red' : notice.type === 'warning' ? 'orange' : 'blue'}>
                        {notice.type === 'error' ? 'OUTAGE' : notice.type === 'warning' ? 'WARN' : 'NEWS'}
                    </Tag>
                    <span style={{ fontWeight: 500 }}>{notice.content}</span>
                </span>
            ))}
        </div>
    );

    return (
        <Alert
            banner
            type={alertType}
            icon={icon}
            message={
                <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {renderContent()}
                </div>
            }
            className="notice-bar-full-width"
            closable
            onClose={handleClose}
        />
    );
};

const MainLayout = () => {
    const [collapsed, setCollapsed] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const [selectedKeys, setSelectedKeys] = useState([]);
    const [openKeys, setOpenKeys] = useState([]);

    const { language, toggleLanguage, t } = useLanguage();

    // 菜单定义
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
                { key: '/historical-import', label: t('menu.historicalImport'), roles: ['SD', 'Manager'] },
            ]
        },
        {
            key: '/intelligence-search',
            icon: <RobotOutlined />,
            label: t('menu.intelligenceSearch'),
            roles: ['SD', 'Manager', 'Admin']
        },
        { key: '/analysis', icon: <BookOutlined />, label: t('menu.analysis'), roles: ['SD', 'Manager', 'Admin'] },
        { key: '/reports', icon: <PrinterOutlined />, label: t('menu.reports'), roles: ['SD', 'Manager', 'Supplier'] },
        {
            key: '/offline-share',
            icon: <ShareAltOutlined />,
            label: t('menu.offlineShare'),
            roles: ['SD', 'Manager', 'Admin', 'Supplier']
        },
        { key: '/settings', icon: <UserOutlined />, label: t('menu.settings'), roles: ['SD', 'Manager', 'Supplier'] },
        {
            key: '/admin',
            icon: <CrownOutlined />,
            label: t('menu.admin'),
            roles: ['Admin']
        }
    ], [language, t]);

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
        // const effectiveKey = location.pathname === '/' ? '/' : currentPath; 

        setSelectedKeys([location.pathname]);
        if (!collapsed) {
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
                <div className="logo-container">
                    <img
                        src="/system-logo.png"
                        alt="Logo"
                        className="logo-img"
                    />
                    {!collapsed && (
                        <span style={{
                            color: 'white',
                            marginLeft: 8,
                            fontWeight: 600,
                            fontSize: '14px',
                            whiteSpace: 'nowrap',
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

                        <Tooltip title={t('menu.helpCenter') || '帮助中心'}>
                            <Button
                                type="text"
                                icon={<QuestionCircleOutlined style={{ fontSize: '16px' }} />}
                                // ❌ 删除: onClick={() => navigate('/help-center')}
                                // ✅ 修改: 使用 window.open 打开新标签页
                                onClick={() => window.open('/help-center', '_blank')}
                            />
                        </Tooltip>
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

                {/* --- 动态滚动的通知栏 --- */}
                <RollingNoticeBar />

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