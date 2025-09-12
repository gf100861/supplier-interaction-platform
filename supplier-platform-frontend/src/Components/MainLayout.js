import { useState, useEffect, useMemo } from 'react';
import { Layout, Menu, Space, Avatar, Button, Typography, message } from 'antd';
import {
    HomeOutlined,
    UploadOutlined,
    UserOutlined,
    SolutionOutlined,
    LogoutOutlined,
    AuditOutlined,
    FormOutlined,
    LineChartOutlined,
    PrinterOutlined
} from '@ant-design/icons';
import './MainLayout.css';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
// 1. 在这里引入 AlertBell 组件 (请根据您的文件结构核对路径)
import { AlertBell } from '../Components/AlertBell';

const { Header, Content, Footer, Sider } = Layout;
const { Text } = Typography;

const allMenuItems = [
    { key: '/audit-plan', icon: <AuditOutlined />, label: '年度计划', roles: ['SD', 'Manager'] },
    { key: '/', icon: <HomeOutlined />, label: '仪表盘', roles: ['SD', 'Manager', 'Supplier'], },
    {
        key: 'notice-group',
        icon: <SolutionOutlined />,
        label: '通知单处理',
        roles: ['SD', 'Manager', 'Supplier'],
        children: [
            { key: '/notices', label: '整改通知单列表', roles: ['SD', 'Manager', 'Supplier'], },
            { key: '/upload', label: '创建单个通知', roles: ['SD', 'Manager'], },
            { key: '/batch-create', label: '批量创建 (Excel)', roles: ['SD', 'Manager'], },
        ]
    },
    { key: '/analysis', icon: <LineChartOutlined />, label: '历史问题分析', roles: ['SD', 'Manager'] },
    { key: '/reports', icon: <PrinterOutlined />, label: '综合报告', roles: ['SD', 'Manager', 'Supplier'] },
    {
        key: '/settings',
        icon: <UserOutlined />,
        label: '系统设置',
        roles: ['SD', 'Manager', 'Supplier'],
    },
];

const MainLayout = () => {
    const [collapsed, setCollapsed] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const [selectedKeys, setSelectedKeys] = useState([location.pathname]);

    useEffect(() => {
        const currentPath = location.pathname;
        if (currentPath === '/') {
            setSelectedKeys(['/']);
        } else {
            // 修正高亮逻辑，使其能正确匹配子菜单
            const matchedKey = allMenuItems
                .flatMap(item => item.children ? item.children : item)
                .find(item => currentPath.startsWith(item.key));
            if (matchedKey) {
                setSelectedKeys([matchedKey.key]);
            }
        }
    }, [location.pathname]);

    const handleLogout = () => {
        localStorage.removeItem('user');
        message.success('您已成功登出！');
        navigate('/login');
    };

    const handleMenuClick = (e) => {
        navigate(e.key);
    };

    const storedUser = useMemo(() => {
        const userString = localStorage.getItem('user');
        return userString ? JSON.parse(userString) : null;
    }, []);

    const userRole = storedUser ? storedUser.role : null;
    const userName = storedUser ? storedUser.name : '访客';

    const filterMenu = (menuItems, role) => {
        return menuItems
            .map(item => {
                if (role && item.roles && item.roles.includes(role)) {
                    if (item.children) {
                        const visibleChildren = filterMenu(item.children, role);
                        if (visibleChildren.length > 0) {
                            return { ...item, children: visibleChildren };
                        }
                        return null;
                    }
                    return item;
                }
                return null;
            })
            .filter(item => item !== null);
    };

    const visibleMenuItems = filterMenu(allMenuItems, userRole);

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
                <div className="logo" />
                <Menu
                    theme="dark"
                    selectedKeys={selectedKeys}
                    mode="inline"
                    items={visibleMenuItems}
                    onClick={handleMenuClick}
                />
            </Sider>
            <Layout className="site-layout">
                <Header
                    className="site-layout-background"
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
                        {/* 2. 将 AlertBell 组件放在用户信息区域 */}
                        <AlertBell />
                        
                        <Avatar style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
                        <Text>欢迎您, <Text strong>{userName}</Text></Text>
                        <Button type="primary" icon={<LogoutOutlined />} onClick={handleLogout}>
                            登出
                        </Button>
                    </Space>
                </Header>
                <Content style={{ margin: '16px' }}>
                    <div className="site-layout-background" style={{ padding: 24, minHeight: '100%' }}>
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
