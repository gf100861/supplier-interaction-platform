import React, { useState, useEffect, useMemo } from 'react';
import {
    Layout, Menu, Space, Avatar, Button, Typography, message, Alert, Tag, Tooltip,
    Grid, Drawer // 新增 Grid 和 Drawer 组件
} from 'antd';
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
    InfoCircleOutlined, // 虽然没用到，但保持原有引用防止报错
    ExclamationOutlined,
    WarningOutlined,
    SoundOutlined,
    QuestionCircleOutlined,
    MenuOutlined,          // 新增：汉堡菜单图标
    FileAddOutlined,       // 新增：新建通知单图标
    UnorderedListOutlined, // 新增：列表图标
    SwapOutlined           // 新增：互传图标
} from '@ant-design/icons';
import './MainLayout.css';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { AlertBell } from './notice/AlertBell';
import { FileReceiver } from '../Pages/FileReceiver';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../supabaseClient';

const { Header, Content, Footer, Sider } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid; // 引入断点钩子

// --- 智能权限过滤函数 ---
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

// --- 滚动通知栏组件 ---
const RollingNoticeBar = () => {
    const [visible, setVisible] = useState(true);
    const [notices, setNotices] = useState([]);
    const STORAGE_KEY = 'system_notice_closed_date';

    useEffect(() => {
        const closedDate = localStorage.getItem(STORAGE_KEY);
        const today = new Date().toDateString();
        if (closedDate === today) {
            setVisible(false);
        }
    }, []);

    useEffect(() => {
        const fetchNotices = async () => {
            const { data, error } = await supabase
                .from('system_notices')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setNotices(data);
            }
        };

        fetchNotices();

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

    if (!visible || !notices || notices.length === 0) return null;

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

// --- MainLayout 主组件 ---
const MainLayout = () => {
    const [collapsed, setCollapsed] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const [selectedKeys, setSelectedKeys] = useState([]);
    const [openKeys, setOpenKeys] = useState([]);

    const { language, toggleLanguage, t } = useLanguage();

    // 1. 设备检测
    const screens = useBreakpoint();
    const isMobile = !screens.md; // 屏幕宽度小于 md (768px) 视为移动端
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // 2. 定义两套菜单配置

    // A. 桌面端完整菜单
    const desktopMenuItems = useMemo(() => [
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
                { key: '/secret-decrypt', label: t('menu.secretDecrypt'), roles: ['SD', 'Manager'] },
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

    // B. 移动端精简菜单 (只保留核心功能)
    const mobileMenuItemsRaw = useMemo(() => [
        {
            key: '/', // 仪表盘首页
            icon: <HomeOutlined />,
            label: t('menu.dashboard') || '仪表盘',
            roles: ['SD', 'Manager', 'Supplier', 'Admin']
        },
        {
            key: '/notices', // 1. 通知单列表 (用于审核/查看)
            icon: <UnorderedListOutlined />,
            label: t('menu.notices') || '通知单列表',
            roles: ['SD', 'Manager', 'Supplier']
        },
        {
            key: '/upload', // 2. 手动开设通知单
            icon: <FileAddOutlined />,
            label: t('menu.manualUpload') || '新建通知单',
            roles: ['SD', 'Manager'] // 注意：通常只有 SD/Manager 能开单
        },
        {
            key: '/offline-share', // 3. 文件互传
            icon: <SwapOutlined />,
            label: t('menu.offlineShare') || '文件互传',
            roles: ['SD', 'Manager', 'Admin', 'Supplier']
        },
        {
            key: '/intelligence-search', // 3. 智能搜索
            icon: <RobotOutlined />,
            label: t('menu.intelligenceSearch') || '智能搜索',
            roles: ['SD', 'Manager', 'Admin']
        }
    ], [language, t]);

    // 3. 根据设备选择菜单源
    const currentMenuItems = isMobile ? mobileMenuItemsRaw : desktopMenuItems;

    const getOpenKeys = (path) => {
        for (const item of currentMenuItems) {
            if (item.children && item.children.some(child => child.key === path)) {
                return [item.key];
            }
        }
        return [];
    };

    useEffect(() => {
        setSelectedKeys([location.pathname]);
        if (!collapsed && !isMobile) {
            const newOpenKeys = getOpenKeys(location.pathname);
            if (newOpenKeys.length > 0) setOpenKeys(prev => [...new Set([...prev, ...newOpenKeys])]);
        }
    }, [location.pathname, collapsed, currentMenuItems, isMobile]);

    const handleLogout = () => {
        localStorage.removeItem('user');
        message.success(t('common.logoutSuccess'));
        navigate('/login');
    };

    const handleMenuClick = (e) => {
        navigate(e.key);
        if (isMobile) setMobileMenuOpen(false); // 移动端点击后自动关闭抽屉
    };

    const storedUser = useMemo(() => {
        const userString = localStorage.getItem('user');
        return userString ? JSON.parse(userString) : null;
    }, [location.pathname]);

    const userRole = storedUser?.role || null;
    const userName = storedUser?.username || '访客';

    // 4. 计算最终可见菜单
    const visibleMenuItems = useMemo(() => filterMenu(currentMenuItems, userRole), [currentMenuItems, userRole]);

    // 提取 Menu 组件以便复用
    const MenuComponent = (
        <Menu
            theme="dark"
            selectedKeys={selectedKeys}
            openKeys={!isMobile ? openKeys : undefined} // 移动端通常不需要展开逻辑，因为是扁平的
            onOpenChange={!isMobile ? setOpenKeys : undefined}
            mode="inline"
            items={visibleMenuItems}
            onClick={handleMenuClick}
            style={{ borderRight: 0 }}
        />
    );

    return (
        <Layout style={{ minHeight: '100vh' }}>
            {/* --- PC端: 侧边栏 --- */}
            {!isMobile && (
                <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
                    <div className="logo-container">
                        <img src="/system-logo.png" alt="Logo" className="logo-img" />
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
                    {MenuComponent}
                </Sider>
            )}

            {/* --- 移动端: 抽屉导航 --- */}
            {isMobile && (
                <Drawer
                    placement="left"
                    onClose={() => setMobileMenuOpen(false)}
                    open={mobileMenuOpen}
                    styles={{ body: { padding: 0, backgroundColor: '#001529' } }}
                    width={250}
                    closable={false}
                >
                    <div className="logo-container" style={{ justifyContent: 'flex-start', paddingLeft: 24 }}>
                        <img src="/system-logo.png" alt="Logo" className="logo-img" />
                        <span style={{ color: 'white', marginLeft: 12, fontWeight: 600, fontSize: '16px' }}>
                            SD Platform
                        </span>
                    </div>
                    {MenuComponent}
                </Drawer>
            )}

            <Layout className="site-layout">
                <Header
                    style={{
                        padding: isMobile ? '0 12px' : '0 24px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: '#fff',
                        position: isMobile ? 'sticky' : 'relative', // 移动端头部吸顶
                        top: 0,
                        zIndex: 99,
                        boxShadow: isMobile ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        {/* 移动端汉堡菜单按钮 */}
                        {isMobile && (
                            <Button
                                type="text"
                                icon={<MenuOutlined />}
                                onClick={() => setMobileMenuOpen(true)}
                                style={{ marginRight: 8, fontSize: '18px' }}
                            />
                        )}
                        <h2 style={{
                            color: '#1890ff',
                            margin: 0,
                            fontSize: isMobile ? '18px' : '20px', // 移动端稍微调大一点，因为字数少了
                            fontWeight: 600,
                            whiteSpace: 'nowrap', // 强制不换行
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            {isMobile ? '信息交互平台' : t('app.title')}
                        </h2>
                    </div>

                    <Space size={isMobile ? "small" : "large"}>
                        {/* 移动端隐藏欢迎语 */}
                        {!isMobile && <Text>{t('header.welcome')}, <Text strong>{userName}</Text></Text>}

                        <Avatar style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />

                        {/* 移动端隐藏帮助和语言切换，保持 Header 简洁 */}
                        {!isMobile && (
                            <>
                                <Tooltip title={t('menu.helpCenter') || '帮助中心'}>
                                    <Button
                                        type="text"
                                        icon={<QuestionCircleOutlined style={{ fontSize: '16px' }} />}
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
                            </>
                        )}

                        <AlertBell />

                        {/* 移动端 Logout 仅显示图标 */}
                        <Button type="primary" icon={<LogoutOutlined />} onClick={handleLogout}>
                            {!isMobile && t('header.logout')}
                        </Button>
                    </Space>
                </Header>

                {/* 滚动通知栏 */}
                <RollingNoticeBar />

                <Content style={{ margin: isMobile ? '8px' : '16px' }}>
                    <div style={{
                        padding: isMobile ? 12 : 24,
                        minHeight: '100%',
                        background: '#fff',
                        borderRadius: '8px'
                    }}>
                        <Outlet />
                    </div>
                </Content>

                {!isMobile && (
                    <Footer style={{ textAlign: 'center' }}>
                        Supplier Platform ©2025 Created by Louis
                    </Footer>
                )}
            </Layout>
            <FileReceiver />
        </Layout>
    );
};

export default MainLayout;