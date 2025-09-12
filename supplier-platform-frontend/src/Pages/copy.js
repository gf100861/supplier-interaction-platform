import React, { useState, useMemo, useEffect } from 'react';
import { Card, Typography, Input, Tabs, Form, Spin, List, Button, Space, Select, Modal, Divider, Timeline, Collapse, Popconfirm, Image } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';

// 1. 导入所有需要的组件、Hooks 和数据
import { NoticeList } from '../Components/notice/NoticeList';
import { RejectionModal } from '../Components/notice/RejectionModal';
import { CorrectionModal } from '../Components/notice/CorrectionModal';
import { NoticeDetailModal } from '../Components/notice/NoticeDetailModal';
import { useNotification } from '../contexts/NotificationContext';
import { useSuppliers } from '../contexts/SupplierContext';
import { useNotices } from '../contexts/NoticeContext';
import { useAlerts } from '../contexts/AlertContext';
import { useConfig } from '../contexts/ConfigContext'; // <-- 关键导入
import { allPossibleStatuses } from '../data/_mockData';

const { Title, Paragraph } = Typography;
const { Search } = Input;
const { TabPane } = Tabs;

const NoticePage = () => {
    // --- 状态管理 ---
    const { notices, updateNotice, loading: noticesLoading } = useNotices();
    const { suppliers } = useSuppliers();
    const { messageApi } = useNotification();
    const { token } = theme.useToken();
    const { addAlert } = useAlerts();
    
    // --- 核心修正 1：从 useConfig 中正确获取配置和加载状态 ---
    const { noticeCategoryDetails, noticeCategories, loading: configLoading } = useConfig();
    
    const [selectedNotice, setSelectedNotice] = useState(null);
    const [form] = Form.useForm();
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [activeCollapseKeys, setActiveCollapseKeys] = useState([]);
    const [rejectionModal, setRejectionModal] = useState({ visible: false, notice: null, handler: null });
    const [correctionModal, setCorrectionModal] = useState({ visible: false, notice: null });

    // --- 数据逻辑 (保持不变) ---
    const userVisibleNotices = useMemo(() => { /* ... */ }, [notices, currentUser]);
    const searchedNotices = useMemo(() => { /* ... */ }, [searchTerm, userVisibleNotices, selectedCategories]);
    const groupedNotices = useMemo(() => { /* ... */ }, [searchedNotices]);

    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => { /* ... (深度链接逻辑不变) ... */ }, [location.search, notices, navigate]);

    // --- 所有 handler 函数 (showDetailsModal, handlePlanSubmit 等) 保持不变 ---
    
    const renderTabs = () => {
        if (!currentUser) return <p>请先登录</p>;
        
        // --- 核心修正 2：添加“加载守卫”，确保在数据返回前不渲染列表 ---
        if (configLoading || noticesLoading) {
            return (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                    <Spin size="large" />
                </div>
            );
        }

        const tabsConfig = { /* ... */ };
        const userTabs = tabsConfig[currentUser.role];
        return (
            <Tabs defaultActiveKey={userTabs[0].key} type="card">
                {userTabs.map(tab => {
                    const tabGroupedData = groupedNotices.filter(/* ... */);
                    return (
                        <TabPane tab={`${tab.label} (${/*...*/})`} key={tab.key}>
                            {/* --- 核心修正 3：在这里将所有需要的 props 完整地传递下去 --- */}
                            <NoticeList
                                data={tabGroupedData}
                                getActionsForItem={getActionsForItem}
                                showDetailsModal={showDetailsModal}
                                handleReviewToggle={handleReviewToggle}
                                token={token}
                                currentUser={currentUser}
                                noticeCategoryDetails={noticeCategoryDetails}
                                activeCollapseKeys={activeCollapseKeys}
                                setActiveCollapseKeys={setActiveCollapseKeys}
                            />
                        </TabPane>
                    );
                })}
            </Tabs>
        );
    };

    return (
        <div style={{ padding: '24px' }}>
            <Card style={{ marginBottom: '16px' }}>
                {/* ... 顶部筛选和搜索栏 ... */}
            </Card>
            <Card>
                {renderTabs()}
            </Card>
            <NoticeDetailModal open={!!selectedNotice} notice={selectedNotice} onCancel={() => setSelectedNotice(null)} /* ... 其他 props ... */ />
            {/* ... 其他 Modals ... */}
        </div>
    );
};

export default NoticePage;