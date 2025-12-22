import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Card, Typography, Table, Tabs, Tag, Space, Button, Modal, Form, Input, message, Spin, Transfer, Select, Radio, Popconfirm, Divider, List, Avatar, Image, Empty, Tooltip, Row, Col
} from 'antd';
import {
    EditOutlined, UserSwitchOutlined, FileTextOutlined, AppstoreAddOutlined, DeleteOutlined, SwapOutlined, MessageOutlined, BookOutlined, PaperClipOutlined, UserOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, StopOutlined, ExclamationCircleOutlined, SaveOutlined, FilterOutlined,
    UserAddOutlined
} from '@ant-design/icons';
import { supabase } from '../supabaseClient';
import dayjs from 'dayjs';
import { useNotification } from '../contexts/NotificationContext';
import { useNotices } from '../contexts/NoticeContext';
// 引入新的日志组件
import SystemLogViewer from './SystemLogViewer';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;
const { Search, TextArea } = Input;

// --- 配置后端 API 地址 ---
const isDev = process.env.NODE_ENV === 'development';
const API_BASE_URL = isDev
    ? 'http://localhost:3001'
    : 'https://supplier-interaction-platform-backend.vercel.app';

const feedbackStatuses = ['new', 'acked', 'resolved', 'wontfix', 'alarm'];
const feedbackStatusConfig = {
    new: { color: 'blue', label: '新反馈', icon: <ClockCircleOutlined /> },
    acked: { color: 'purple', label: '已确认', icon: <ExclamationCircleOutlined /> },
    resolved: { color: 'success', label: '已解决', icon: <CheckCircleOutlined /> },
    wontfix: { color: 'default', label: '不予处理', icon: <StopOutlined /> },
    alarm: { color: 'red', label: '紧急报警', icon: <CloseCircleOutlined /> }
};

const AdminPage = () => {
    // --- State Management ---
    const [users, setUsers] = useState([]);
    const [allSuppliers, setAllSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    // const [logs, setLogs] = useState([]); // Removed old logs state
    const { messageApi } = useNotification();
    const { notices, updateNotice, loading: noticesLoading } = useNotices();

    // --- Filter States ---
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('全部');
    const [feedbackStatusFilter, setFeedbackStatusFilter] = useState('all');
    const [feedbackCategoryFilter, setFeedbackCategoryFilter] = useState('all');

    // --- Modal States ---
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [editForm] = Form.useForm();

    // --- 新增：创建用户相关状态 ---
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [createForm] = Form.useForm();
    const [selectedRole, setSelectedRole] = useState('SD');
    const [supplierMode, setSupplierMode] = useState('existing');

    const [isManageModalVisible, setIsManageModalVisible] = useState(false);
    const [managingUser, setManagingUser] = useState(null);
    const [targetSupplierKeys, setTargetSupplierKeys] = useState([]);
    const [correctionModal, setCorrectionModal] = useState({ visible: false, type: null, notice: null });
    const [correctionForm] = Form.useForm();

    const [feedbackList, setFeedbackList] = useState([]);
    const [feedbackLoading, setFeedbackLoading] = useState(true);
    const [feedbackResponses, setFeedbackResponses] = useState({});

    const currentUser = JSON.parse(localStorage.getItem('user'));
    const navigate = useNavigate();

    useEffect(() => {
        if (currentUser?.role !== 'Admin') {
            navigate('/');
        }
    }, [currentUser, navigate]);

    // --- Filter Logic ---
    const filteredNotices = useMemo(() => {
        return notices.filter(notice => {
            const statusMatch = statusFilter === '全部' || notice.status === statusFilter || (statusFilter === '待处理' && notice.status.includes('待'));
            const searchMatch = searchTerm === '' ||
                (notice.noticeCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (notice.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (notice.assignedSupplierName || '').toLowerCase().includes(searchTerm.toLowerCase());
            return statusMatch && searchMatch;
        });
    }, [notices, searchTerm, statusFilter]);

    const filteredFeedbackList = useMemo(() => {
        return feedbackList.filter(item => {
            const statusMatch = feedbackStatusFilter === 'all' || item.status === feedbackStatusFilter;
            const categoryMatch = feedbackCategoryFilter === 'all' || item.category === feedbackCategoryFilter;
            return statusMatch && categoryMatch;
        });
    }, [feedbackList, feedbackStatusFilter, feedbackCategoryFilter]);


    // --- Data Fetching ---
    const fetchData = async () => {
        setLoading(true);
        setFeedbackLoading(true);
        try {
            const usersPromise = supabase.from('users').select(`id, username, email, phone, role, managed_suppliers:sd_supplier_assignments(supplier_id)`).in('role', ['SD', 'Manager', 'Supplier', 'Admin']); // 获取所有角色的用户
            const suppliersPromise = supabase.from('suppliers').select('id, name, short_code');
            const feedbackPromise = supabase.from('feedback').select(`*, user:users ( username )`).order('created_at', { ascending: false });

            const [
                { data: usersData, error: usersError },
                { data: suppliersData, error: suppliersError },
                { data: feedbackData, error: feedbackError }
            ] = await Promise.all([usersPromise, suppliersPromise, feedbackPromise]);

            if (usersError) throw usersError;
            if (suppliersError) throw suppliersError;
            if (feedbackError) throw feedbackError;

            setUsers(usersData || []);
            // 统一格式：key=id, title=name (为了Transfer组件), label=name (为了Select)
            setAllSuppliers((suppliersData || []).map(s => ({
                ...s,
                key: s.id,
                title: s.name,
                value: s.id,
                label: `${s.short_code} - ${s.name}`
            })));

            const processedFeedback = (feedbackData || []).map(item => ({
                ...item,
                images: Array.isArray(item.images) ? item.images : [],
                attachments: Array.isArray(item.attachments) ? item.attachments : []
            }));
            setFeedbackList(processedFeedback);

            const initialResponses = {};
            processedFeedback.forEach(item => {
                if (item.admin_response) initialResponses[item.id] = item.admin_response;
            });
            setFeedbackResponses(initialResponses);

        } catch (error) {
            messageApi.error(`数据加载失败: ${error.message}`);
        } finally {
            setLoading(false);
            setFeedbackLoading(false);
        }
    };

    // Removed old fetchLogs function

    useEffect(() => {
        fetchData();
        // fetchLogs(); // Removed
    }, []);

    // --- Handlers ---
    const showCreateModal = () => {
        createForm.resetFields();
        setSelectedRole('SD');
        setSupplierMode('existing');
        setIsCreateModalVisible(true);
    };

    const handleCreateCancel = () => {
        setIsCreateModalVisible(false);
    };

    const handleCreateUser = async (values) => {
        setLoading(true);
        try {
            const payload = {
                email: values.email,
                password: values.password,
                username: values.username,
                role: values.role,
                supplierData: null
            };

            if (values.role === 'Supplier') {
                if (supplierMode === 'existing') {
                    payload.supplierData = { isNew: false, id: values.existingSupplierId };
                } else {
                    payload.supplierData = {
                        isNew: true,
                        name: values.newSupplierName,
                        shortCode: values.newSupplierCode,
                        parmaId: values.newSupplierParma
                    };
                }
            }

            const response = await fetch(`${API_BASE_URL}/api/create-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || '创建失败');
            }

            messageApi.success('用户及关联数据创建成功！');
            setIsCreateModalVisible(false);
            fetchData();

        } catch (error) {
            messageApi.error(`操作失败: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // --- 新增：删除用户逻辑 ---
    // src/AdminPage.js 中的 handleDeleteUser 函数片段
    const handleDeleteUser = async (userId) => {
        setLoading(true);
        try {
            // 调用后端 API 删除
            const response = await fetch(`${API_BASE_URL}/api/delete-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || '删除失败');
            }

            messageApi.success('用户已彻底删除（包括登录账号）！');
            // 更新 UI
            setUsers(prev => prev.filter(u => u.id !== userId));

        } catch (error) {
            messageApi.error(`删除用户失败: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const showCorrectionModal = (type, notice) => { setCorrectionModal({ visible: true, type, notice }); };
    const handleCorrectionCancel = () => { setCorrectionModal({ visible: false, type: null, notice: null }); correctionForm.resetFields(); };

    const handleReassignment = async (values) => {
        const notice = correctionModal.notice;
        if (!notice) return;

        const newSupplier = allSuppliers.find(s => s.key === values.newSupplierId);
        if (!newSupplier) {
            messageApi.error('未找到指定的供应商！');
            return;
        }

        const newHistory = {
            type: 'manager_reassignment',
            submitter: currentUser.username,
            time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            description: `[管理修正] 通知单已重分配给新的供应商。原因: ${values.reason || '未提供原因'}`,
        };

        const currentHistory = Array.isArray(notice.history) ? notice.history : [];

        try {
            await updateNotice(notice.id, {
                assigned_supplier_id: newSupplier.key,
                assigned_supplier_name: newSupplier.title,
                // old_supplier_id: notice.assignedSupplierId, 
                history: [...currentHistory, newHistory],
            });

            const alertsToInsert = [
                { creator_id: currentUser.id, target_user_id: notice.assignedSupplierId, message: `"${notice.title}" 已被重分配，您无需再处理。`, link: `/notices` },
                { creator_id: currentUser.id, target_user_id: newSupplier.key, message: `您有一个新的通知单被分配: "${notice.title}"。`, link: `/notices?open=${notice.id}` },
                { creator_id: currentUser.id, target_user_id: notice.creatorId, message: `您创建的 "${notice.title}" 已被重分配给 ${newSupplier.title}。`, link: `/notices?open=${notice.id}` },
            ];
            await supabase.from('alerts').insert(alertsToInsert);

            messageApi.success('通知单已成功重分配！');
            handleCorrectionCancel();
        } catch (error) {
            messageApi.error(`重分配失败: ${error.message}`);
        }
    };

    const handleVoidNotice = async (values) => {
        const notice = correctionModal.notice;
        if (!notice) return;

        const newHistory = {
            type: 'manager_void',
            submitter: currentUser.username,
            time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            description: `[管理修正] 通知单已作废。原因: ${values.reason || '未提供原因'}`,
        };

        const currentHistory = Array.isArray(notice.history) ? notice.history : [];

        try {
            await updateNotice(notice.id, {
                status: '已作废',
                history: [...currentHistory, newHistory],
            });

            const alertsToInsert = [
                { creator_id: currentUser.id, target_user_id: notice.assignedSupplierId, message: `"${notice.title}" 已被作废，您无需再处理。`, link: `/notices` },
                { creator_id: currentUser.id, target_user_id: notice.creatorId, message: `您创建的 "${notice.title}" 已被作废。`, link: `/notices?open=${notice.id}` },
            ];

            await supabase.from('alerts').insert(alertsToInsert);

            messageApi.warning('通知单已作废！');
            handleCorrectionCancel();
        } catch (error) {
            messageApi.error(`作废失败: ${error.message}`);
        }
    };

    const showEditModal = (user) => { setEditingUser(user); editForm.setFieldsValue({ username: user.username, phone: user.phone, password: '' }); setIsEditModalVisible(true); };
    const handleCancel = () => { setIsEditModalVisible(false); setEditingUser(null); setIsManageModalVisible(false); setManagingUser(null); };
    const handleEditUser = async (values) => {
        try {
            const { error: profileError } = await supabase
                .from('users')
                .update({ username: values.username, phone: values.phone })
                .eq('id', editingUser.id);
            if (profileError) throw profileError;

            if (values.password) {
                const { error: authError } = await supabase.auth.admin.updateUserById(
                    editingUser.id,
                    { password: values.password }
                );
                if (authError) throw authError;
            }

            messageApi.success('用户信息更新成功!');
            setIsEditModalVisible(false);
            setEditingUser(null);
            fetchData();
        } catch (error) {
            messageApi.error(`更新失败: ${error.message}`);
        }
    };
    const showManageModal = (user) => { setManagingUser(user); setTargetSupplierKeys(user.managed_suppliers.map(ms => ms.supplier_id)); setIsManageModalVisible(true); };
    const handleManageSuppliers = async () => {
        try {
            const { error: deleteError } = await supabase
                .from('sd_supplier_assignments')
                .delete()
                .eq('sd_user_id', managingUser.id);
            if (deleteError) throw deleteError;

            if (targetSupplierKeys.length > 0) {
                const newAssignments = targetSupplierKeys.map(supplierId => ({
                    sd_user_id: managingUser.id,
                    supplier_id: supplierId,
                }));
                const { error: insertError } = await supabase
                    .from('sd_supplier_assignments')
                    .insert(newAssignments);
                if (insertError) throw insertError;
            }

            message.success('供应商分配更新成功!');
            setIsManageModalVisible(false);
            setManagingUser(null);
            fetchData();
        } catch (error) {
            message.error(`分配失败: ${error.message}`);
        }
    };
    const onTransferChange = (nextTargetKeys) => { setTargetSupplierKeys(nextTargetKeys); };
    const handleFeedbackStatusChange = async (id, status) => {
        messageApi.loading({ content: '正在更新状态...', key: `feedback-${id}` });
        try {
            const { error } = await supabase
                .from('feedback')
                .update({ status: status })
                .eq('id', id);

            if (error) throw error;

            messageApi.success({ content: '状态更新成功！', key: `feedback-${id}`, duration: 2 });
            setFeedbackList(prevList => prevList.map(item =>
                item.id === id ? { ...item, status: status } : item
            ));
        } catch (error) {
            messageApi.error({ content: `状态更新失败: ${error.message}`, key: `feedback-${id}`, duration: 3 });
        }
    };
    const handleResponseChange = (id, value) => {
        setFeedbackResponses(prev => ({
            ...prev,
            [id]: value
        }));
    };
    const handleSaveFeedbackResponse = async (id) => {
        const responseText = feedbackResponses[id];
        const currentFeedbackItem = feedbackList.find(item => item.id === id);
        if (currentFeedbackItem && currentFeedbackItem.admin_response === responseText) {
            return;
        }

        messageApi.loading({ content: '正在保存回复...', key: `response-${id}` });
        try {
            const { error } = await supabase
                .from('feedback')
                .update({ admin_response: responseText })
                .eq('id', id);
            if (error) throw error;
            messageApi.success({ content: '回复已保存！', key: `response-${id}`, duration: 2 });
            setFeedbackList(prevList => prevList.map(item =>
                item.id === id ? { ...item, admin_response: responseText } : item
            ));
        } catch (error) {
            messageApi.error({ content: `回复保存失败: ${error.message}`, key: `response-${id}`, duration: 3 });
        }
    };
    const handleDeleteFeedback = async (id) => {
        messageApi.loading({ content: '正在删除反馈...', key: `delete-${id}` });
        try {
            const { error } = await supabase
                .from('feedback')
                .delete()
                .eq('id', id);

            if (error) throw error;

            messageApi.success({ content: '反馈已删除！', key: `delete-${id}`, duration: 2 });
            setFeedbackList(prevList => prevList.filter(item => item.id !== id));
        } catch (error) {
            messageApi.error({ content: `删除失败: ${error.message}`, key: `delete-${id}`, duration: 3 });
        }
    };

    // --- Table Columns ---
    const userColumns = [
        { title: '姓名', dataIndex: 'username', key: 'username' },
        { title: '邮箱', dataIndex: 'email', key: 'email' },
        { title: '电话', dataIndex: 'phone', key: 'phone', render: (text) => text || 'N/A' },
        { title: '角色', dataIndex: 'role', key: 'role', render: (role) => <Tag color={role === 'Manager' ? 'gold' : (role === 'Admin' ? 'red' : 'blue')}>{role}</Tag> },
        {
            title: '负责供应商数量',
            key: 'suppliers',
            render: (_, record) => record.managed_suppliers?.length || 0
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Space size="middle">
                    <Button icon={<EditOutlined />} onClick={() => showEditModal(record)}>编辑</Button>
                    {/* --- 新增：删除用户按钮 --- */}
                    <Popconfirm
                        title="确定删除此用户吗?"
                        description="此操作将删除该用户的所有数据（不包括已创建的通知单）。"
                        onConfirm={() => handleDeleteUser(record.id)}
                        okText="删除"
                        cancelText="取消"
                    >
                        <Button icon={<DeleteOutlined />} danger>删除</Button>
                    </Popconfirm>

                    {record.role === 'SD' && (
                        <Button icon={<UserSwitchOutlined />} onClick={() => showManageModal(record)}>管理供应商</Button>
                    )}
                </Space>
            ),
        },
    ];

    const noticeColumns = [
        { title: '通知单号', dataIndex: 'noticeCode', key: 'noticeCode', width: 150 },
        { title: '标题', dataIndex: 'title', key: 'title' },
        { title: '类型', dataIndex: 'category', key: 'category', width: 100 },
        { title: '当前供应商', dataIndex: 'assignedSupplierName', key: 'assignedSupplierName' },
        {
            title: '状态', dataIndex: 'status', key: 'status', render: (status) => {
                let color = 'geekblue';
                if (status === '已作废') color = 'grey';
                if (status === '已完成') color = 'green';
                if (status.includes('待处理')) color = 'volcano';
                return <Tag color={color}>{status}</Tag>
            }
        },
        { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (text) => dayjs(text).format('YYYY-MM-DD') },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Space size="middle">
                    <Button icon={<SwapOutlined />} onClick={() => showCorrectionModal('reassign', record)} disabled={record.status === '已作废' || record.status === '已完成'}>重分配</Button>
                    <Button icon={<DeleteOutlined />} danger onClick={() => showCorrectionModal('void', record)} disabled={record.status === '已作废' || record.status === '已完成'}>作废</Button>
                </Space>
            ),
        },
    ];

    // Removed logColumns

    // --- 核心修复：使用 items 属性定义 Tabs ---
    const items = [
        {
            key: '1',
            label: <Space><UserSwitchOutlined />用户与供应商管理</Space>,
            children: <Table columns={userColumns} dataSource={users} rowKey="id" />
        },
        {
            key: '2',
            label: <Space><AppstoreAddOutlined />通知单管理</Space>,
            children: (
                <>
                    <Space style={{ marginBottom: 16 }}>
                        <Search
                            placeholder="搜索通知单号、标题、供应商..."
                            onSearch={value => setSearchTerm(value)}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ width: 300 }}
                            allowClear
                        />
                        <Radio.Group
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                        >
                            <Radio.Button value="全部">全部</Radio.Button>
                            <Radio.Button value="待处理">待处理</Radio.Button>
                            <Radio.Button value="已完成">已完成</Radio.Button>
                            <Radio.Button value="已作废">已作废</Radio.Button>
                        </Radio.Group>
                    </Space>
                    <Table columns={noticeColumns} dataSource={filteredNotices} rowKey="id" />
                </>
            )
        },
        {
            key: '3',
            label: <Space><MessageOutlined />用户反馈</Space>,
            children: (
                <>
                    <Card bordered={false} style={{ marginBottom: 16, backgroundColor: '#fafafa' }} bodyStyle={{ padding: '12px 24px' }}>
                        <Row gutter={24} align="middle">
                            <Col>
                                <Space>
                                    <FilterOutlined />
                                    <Text strong>筛选:</Text>
                                </Space>
                            </Col>
                            <Col>
                                <Space>
                                    <span>状态:</span>
                                    <Select
                                        value={feedbackStatusFilter}
                                        onChange={setFeedbackStatusFilter}
                                        style={{ width: 120 }}
                                        bordered={false}
                                    >
                                        <Option value="all">全部状态</Option>
                                        {feedbackStatuses.map(s => (
                                            <Option key={s} value={s}>{feedbackStatusConfig[s]?.label || s}</Option>
                                        ))}
                                    </Select>
                                </Space>
                            </Col>
                            <Col>
                                <Space>
                                    <span>分类:</span>
                                    <Select
                                        value={feedbackCategoryFilter}
                                        onChange={setFeedbackCategoryFilter}
                                        style={{ width: 120 }}
                                        bordered={false}
                                    >
                                        <Option value="all">全部分类</Option>
                                        <Option value="bug_report">系统缺陷 (Bug)</Option>
                                        <Option value="feature_request">功能建议</Option>
                                        <Option value="general_feedback">一般性反馈</Option>
                                    </Select>
                                </Space>
                            </Col>
                            <Col style={{ marginLeft: 'auto' }}>
                                <Text type="secondary">共 {filteredFeedbackList.length} 条反馈</Text>
                            </Col>
                        </Row>
                    </Card>

                    <List
                        grid={{ gutter: 16, column: 1 }}
                        dataSource={filteredFeedbackList}
                        loading={feedbackLoading}
                        renderItem={item => (
                            <List.Item key={item.id}>
                                <Card
                                    style={{ width: '100%', borderColor: '#f0f0f0' }}
                                    bodyStyle={{ padding: '20px' }}
                                    hoverable
                                >
                                    <List.Item.Meta
                                        avatar={
                                            <Avatar style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
                                        }
                                        title={
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                                <Space>
                                                    <Text strong style={{ fontSize: 16 }}>{item.user?.username || '未知用户'}</Text>
                                                    <Tag color={item.category === 'Bug' ? 'red' : 'blue'}>{item.category || '一般反馈'}</Tag>
                                                    <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}</Text>
                                                </Space>
                                                <Select
                                                    value={item.status || 'new'}
                                                    size="small"
                                                    style={{ width: 140 }}
                                                    onChange={(value) => handleFeedbackStatusChange(item.id, value)}
                                                    bordered={false}
                                                    className="status-select"
                                                >
                                                    {feedbackStatuses.map(s => {
                                                        const config = feedbackStatusConfig[s] || { color: 'default', label: s };
                                                        return (
                                                            <Option key={s} value={s}>
                                                                <Tag color={config.color} style={{ marginRight: 0 }}>
                                                                    {config.icon} {config.label}
                                                                </Tag>
                                                            </Option>
                                                        )
                                                    })}
                                                </Select>

                                                <div style={{ paddingLeft: 48, marginTop: 12 }}>
                                                    <Paragraph style={{ fontSize: 15, lineHeight: 1.6 }}>
                                                        {item.content}
                                                    </Paragraph>

                                                    {/* 图片展示区域 - 九宫格样式 */}
                                                    {item.images && item.images.length > 0 && (
                                                        <div style={{ marginTop: 16 }}>
                                                            <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>附图 ({item.images.length})</Text>
                                                            <Image.PreviewGroup>
                                                                <Space size={8} wrap>
                                                                    {item.images.map((img, idx) => {
                                                                        const imgSrc = typeof img === 'object' ? (img.url || img.thumbUrl || img.response?.url) : img;
                                                                        return (
                                                                            <div key={idx} style={{
                                                                                width: 100,
                                                                                height: 100,
                                                                                borderRadius: 8,
                                                                                overflow: 'hidden',
                                                                                border: '1px solid #f0f0f0',
                                                                                backgroundColor: '#fafafa',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center'
                                                                            }}>
                                                                                <Image
                                                                                    width={100}
                                                                                    height={100}
                                                                                    src={imgSrc}
                                                                                    style={{ objectFit: 'cover' }}
                                                                                    fallback="https://via.placeholder.com/100x100?text=Image+Error"
                                                                                />
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </Space>
                                                            </Image.PreviewGroup>
                                                        </div>
                                                    )}

                                                    {/* 附件展示区域 */}
                                                    {item.attachments && item.attachments.length > 0 && (
                                                        <div style={{ marginTop: 16 }}>
                                                            <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>附件 ({item.attachments.length})</Text>
                                                            <Space wrap>
                                                                {item.attachments.map((file, idx) => {
                                                                    const fileUrl = typeof file === 'object' ? (file.url || file.response?.url) : file;
                                                                    const fileName = typeof file === 'object' ? file.name : `附件 ${idx + 1}`;

                                                                    return (
                                                                        <Button
                                                                            key={idx}
                                                                            icon={<PaperClipOutlined />}
                                                                            size="small"
                                                                            onClick={() => window.open(fileUrl, '_blank')}
                                                                        >
                                                                            {fileName}
                                                                        </Button>
                                                                    );
                                                                })}
                                                            </Space>
                                                        </div>
                                                    )}

                                                    {/* 管理员回复区域 */}
                                                    <div style={{ marginTop: 24, backgroundColor: '#fafafa', padding: 16, borderRadius: 8, border: '1px solid #f0f0f0' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                            <Text strong style={{ color: '#595959' }}><MessageOutlined /> 管理员回复</Text>
                                                            {feedbackResponses[item.id] !== item.admin_response && (
                                                                <Text type="warning" style={{ fontSize: 12 }}>* 未保存</Text>
                                                            )}
                                                        </div>
                                                        <TextArea
                                                            value={feedbackResponses[item.id] || ''}
                                                            onChange={(e) => handleResponseChange(item.id, e.target.value)}
                                                            placeholder="在此输入处理意见或回复..."
                                                            autoSize={{ minRows: 2, maxRows: 6 }}
                                                            style={{ marginBottom: 8, backgroundColor: '#fff' }}
                                                        />
                                                        <div style={{ textAlign: 'right' }}>
                                                            <Popconfirm title="确定删除此反馈吗?" onConfirm={() => handleDeleteFeedback(item.id)}>
                                                                <Button type="text" danger size="small" icon={<DeleteOutlined />} style={{ float: 'left' }}>删除</Button>
                                                            </Popconfirm>
                                                            <Button
                                                                type="primary"
                                                                size="small"
                                                                icon={<SaveOutlined />}
                                                                onClick={() => handleSaveFeedbackResponse(item.id)}
                                                                disabled={feedbackResponses[item.id] === item.admin_response}
                                                            >
                                                                保存回复
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                    />
                                </Card>
                            </List.Item>
                        )}
                        locale={{ emptyText: <Empty description="暂无用户反馈" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                    />
                </>
            )
        },
        {
            key: '4',
            label: <Space><FileTextOutlined />系统日志</Space>,
            children: <SystemLogViewer /> // 使用新组件
        },
        {
            key: '5',
            label: <Space><BookOutlined />开发文档</Space>,
            children: (
                <Typography>
                    <Title level={4}>系统开发文档</Title>
                    <Paragraph>
                        这里是开发文档的占位符内容。您可以将您的 Markdown 文件内容或通过其他方式获取的文档信息渲染在这里。
                    </Paragraph>
                    <Divider />
                    <Title level={5}>技术栈</Title>
                    <ul>
                        <li>前端: React, Ant Design</li>
                        <li>后端/数据库: Supabase (PostgreSQL, Auth, Edge Functions)</li>
                        {/* Add more details */}
                    </ul>
                    <Title level={5}>主要功能模块</Title>
                    <Paragraph>
                        - 用户认证与权限管理<br />
                        - 通知单创建、流转与管理<br />
                        - 供应商管理与分配<br />
                        - 历史经验标签<br />
                        - 报表与统计<br />
                        - 实时提醒<br />
                        - 管理后台<br />
                        - 智能检索与AI打标签
                    </Paragraph>
                    <Title level={5}>记录开发要点</Title>
                    <Paragraph>
                        - 如果需要在后端引入API别忘了在server.js进行注册<br />
                        - 注意Supabase的Row Level Security (RLS)策略配置<br />
                        - 前端与后端的数据交互均通过Supabase客户端完成<br />
                        - 使用Supabase的Storage存储用户上传的文件和图片<br />
                        - 详细的代码注释请参考各个组件和函数的实现
                    </Paragraph>
                </Typography>
            )
        }
    ];

    if (loading || noticesLoading) {
        return <Spin size="large" style={{ display: 'block', marginTop: '50px' }} />;
    }

    return (
        <div style={{ maxWidth: 1200, margin: 'auto', padding: '24px' }}>
            <Card>
                <Title level={2}>管理后台</Title>
                <Paragraph>在此页面管理系统用户、供应商分配以及查看系统日志。</Paragraph>

                {/* Use items prop for Tabs */}
                <Tabs
                    defaultActiveKey="1"
                    items={items}
                    tabBarExtraContent={
                        <Button type="primary" icon={<UserAddOutlined />} onClick={showCreateModal}>
                            新增用户
                        </Button>
                    }
                />
            </Card>

            <Modal
                title="新增系统用户"
                open={isCreateModalVisible}
                onCancel={handleCreateCancel}
                footer={null}
                width={600}
            >
                <Form
                    form={createForm}
                    layout="vertical"
                    onFinish={handleCreateUser}
                    initialValues={{ role: 'SD', supplierMode: 'existing' }}
                >
                    <Form.Item name="role" label="用户角色">
                        <Radio.Group
                            onChange={(e) => setSelectedRole(e.target.value)}
                            buttonStyle="solid"
                        >
                            <Radio.Button value="SD">SD (工程师)</Radio.Button>
                            <Radio.Button value="Manager">Manager (经理)</Radio.Button>
                            <Radio.Button value="Admin">Admin (管理员)</Radio.Button>
                            <Radio.Button value="Supplier">Supplier (供应商)</Radio.Button>
                        </Radio.Group>
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="email"
                                label="登录邮箱"
                                rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}
                            >
                                <Input placeholder="user@volvo.com" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="username"
                                label="显示名称"
                                rules={[{ required: true, message: '请输入姓名' }]}
                            >
                                <Input placeholder="John Doe" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item
                        name="password"
                        label="初始密码"
                        rules={[{ required: true, min: 6, message: '密码至少6位' }]}
                    >
                        <Input.Password placeholder="设置初始登录密码" />
                    </Form.Item>

                    {/* 仅当角色为供应商时显示 */}
                    {selectedRole === 'Supplier' && (
                        <div style={{ background: '#f9f9f9', padding: '16px', borderRadius: '8px', marginBottom: '24px', border: '1px solid #eee' }}>
                            <Divider orientation="left" style={{ marginTop: 0, fontSize: '14px' }}>供应商归属配置</Divider>

                            <Form.Item label="归属模式" style={{ marginBottom: 16 }}>
                                <Radio.Group
                                    value={supplierMode}
                                    onChange={e => setSupplierMode(e.target.value)}
                                >
                                    <Radio value="existing">绑定已有公司</Radio>
                                    <Radio value="new">注册新公司</Radio>
                                </Radio.Group>
                            </Form.Item>

                            {supplierMode === 'existing' ? (
                                <Form.Item
                                    name="existingSupplierId"
                                    label="选择已有供应商"
                                    rules={[{ required: true, message: '请选择一个供应商' }]}
                                >
                                    <Select
                                        showSearch
                                        placeholder="搜索公司名或代码..."
                                        optionFilterProp="label"
                                        options={allSuppliers}
                                    />
                                </Form.Item>
                            ) : (
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <Form.Item name="newSupplierName" label="公司全称" rules={[{ required: true, message: '请输入公司全称' }]}>
                                        <Input placeholder="例如: Volvo Construction Equipment Ltd." />
                                    </Form.Item>
                                    <Space>
                                        <Form.Item name="newSupplierCode" label="Short Code" rules={[{ required: true, message: '请输入简码' }]}>
                                            <Input placeholder="例如: VCE" />
                                        </Form.Item>
                                        <Form.Item name="newSupplierParma" label="Parma ID" rules={[{ required: true, message: '请输入Parma ID' }]}>
                                            <Input placeholder="例如: 123456" />
                                        </Form.Item>
                                    </Space>
                                </Space>
                            )}
                        </div>
                    )}

                    <div style={{ textAlign: 'right', marginTop: 24 }}>
                        <Space>
                            <Button onClick={handleCreateCancel}>取消</Button>
                            <Button type="primary" htmlType="submit" loading={loading}>
                                确认创建
                            </Button>
                        </Space>
                    </div>
                </Form>
            </Modal>

            {/* ... (其他 Modals: EditUser, ManageSupplier, Correction 保持不变) ... */}
            <Modal title={`编辑用户: ${editingUser?.username}`} open={isEditModalVisible} onCancel={handleCancel} footer={null}>
                <Form form={editForm} layout="vertical" onFinish={handleEditUser}>
                    <Form.Item name="username" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="phone" label="电话"><Input /></Form.Item>
                    <Form.Item name="password" label="新密码 (留空则不修改)"><Input.Password /></Form.Item>
                    <Form.Item><Button type="primary" htmlType="submit">保存更改</Button></Form.Item>
                </Form>
            </Modal>

            <Modal
                title={`管理 ${managingUser?.name} 的供应商`}
                open={isManageModalVisible}
                onOk={handleManageSuppliers}
                onCancel={handleCancel}
                width={700}
                okText="保存分配"
                cancelText="取消"
            >
                <Transfer
                    dataSource={allSuppliers}
                    targetKeys={targetSupplierKeys}
                    onChange={onTransferChange}
                    render={item => item.title}
                    listStyle={{ width: 300, height: 400 }}
                    titles={['所有供应商', '已分配的供应商']}
                />
            </Modal>

            <Modal
                title={correctionModal.type === 'reassign' ? '重分配通知单' : '作废通知单'}
                open={correctionModal.visible}
                onCancel={handleCorrectionCancel}
                footer={null}
            >
                <Paragraph>
                    正在处理通知单: <Text strong>{correctionModal.notice?.noticeCode}</Text> - <Text>{correctionModal.notice?.title}</Text>
                </Paragraph>
                <Form
                    form={correctionForm}
                    layout="vertical"
                    onFinish={correctionModal.type === 'reassign' ? handleReassignment : handleVoidNotice}
                >
                    {correctionModal.type === 'reassign' && (
                        <Form.Item
                            name="newSupplierId"
                            label="选择新的供应商"
                            rules={[{ required: true, message: '请选择一个新的供应商！' }]}
                        >
                            <Select
                                showSearch
                                placeholder="搜索并选择供应商"
                                filterOption={(input, option) =>
                                    (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                                getPopupContainer={triggerNode => triggerNode.parentNode}
                            >
                                {allSuppliers.map(s => (
                                    // Ensure we use s.key as value because that's how we mapped it in fetchData
                                    <Option key={s.key} value={s.key}>{s.title}</Option>
                                ))}
                            </Select>
                        </Form.Item>
                    )}
                    <Form.Item
                        name="reason"
                        label="原因说明"
                        rules={[{ required: true, message: '请输入原因说明！' }]}
                    >
                        <Input.TextArea rows={4} placeholder="请详细说明操作原因" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit">确认{correctionModal.type === 'reassign' ? '重分配' : '作废'}</Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default AdminPage;