import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Card, Typography, Table, Tabs, Tag, Space, Button, Modal, Form, Input, message, Spin, Transfer, Select, Radio, Popconfirm, Divider, List, Avatar, Image, Empty, Tooltip, Row, Col
} from 'antd';
import {
    EditOutlined, UserSwitchOutlined, FileTextOutlined, AppstoreAddOutlined, DeleteOutlined, SwapOutlined, MessageOutlined, BookOutlined, PaperClipOutlined, UserOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, StopOutlined, ExclamationCircleOutlined, SaveOutlined, FilterOutlined,
    UserAddOutlined, SoundOutlined, PlusOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNotification } from '../contexts/NotificationContext';
import { useNotices } from '../contexts/NoticeContext';
import SystemLogViewer from './SystemLogViewer';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;
const { Search, TextArea } = Input;

// 🔧 环境配置
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
// const BACKEND_URL = isDev
//     ? 'http://localhost:3001'
//     : 'https://supplier-interaction-platform-backend.vercel.app';
const BACKEND_URL = isDev
    ? 'http://localhost:3001' 
    : window.location.origin; // 必须是这句！

const feedbackStatuses = ['new', 'acked', 'resolved', 'wontfix', 'alarm'];
const feedbackStatusConfig = {
    new: { color: 'blue', label: '新反馈', icon: <ClockCircleOutlined /> },
    acked: { color: 'purple', label: '已确认', icon: <ExclamationCircleOutlined /> },
    resolved: { color: 'success', label: '已解决', icon: <CheckCircleOutlined /> },
    wontfix: { color: 'default', label: '不予处理', icon: <StopOutlined /> },
    alarm: { color: 'red', label: '紧急报警', icon: <CloseCircleOutlined /> }
};

const AdminPage = () => {
    // --- State ---
    const [systemNotices, setSystemNotices] = useState([]);
    const [isNoticeModalVisible, setIsNoticeModalVisible] = useState(false);
    const [noticeForm] = Form.useForm();

    const [users, setUsers] = useState([]);
    const [allSuppliers, setAllSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);

    const { messageApi } = useNotification();
    const { notices, updateNotice, loading: noticesLoading } = useNotices(); // NoticeContext 已经改过 fetch 了

    // --- Filters ---
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('全部');
    const [feedbackStatusFilter, setFeedbackStatusFilter] = useState('all');
    const [feedbackCategoryFilter, setFeedbackCategoryFilter] = useState('all');

    // --- Modals ---
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [editForm] = Form.useForm();

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

    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);
    const navigate = useNavigate();

    useEffect(() => {
        if (currentUser?.role !== 'Admin') {
            navigate('/');
        }
    }, [currentUser, navigate]);


    // --- Filter Logic ---
    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            // const statusMatch = statusFilter === '全部' || user.status === statusFilter || (statusFilter === '待处理' && user.status.includes('待'));

            const searchMatch = searchTerm === '' ||
                (user.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (user.role || '').toLowerCase().includes(searchTerm.toLowerCase());
            return searchMatch;
        });
    }, [users, searchTerm]);

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

    // --- 1. Fetch Data (改为调用后端 API) ---
    const fetchData = async () => {
        setLoading(true);
        setFeedbackLoading(true);
        try {
            // 我们需要创建一个聚合接口 /api/admin/dashboard-data 或者分别调用
            // 这里为了简单，复用已有的 api/users, api/suppliers，并新增 feedback 和 system_notices 接口
            const token = localStorage.getItem('access_token');

            // 安全检查：如果没有 Token，强制登出
            if (!token) {
                messageApi.error('登录凭证丢失，请重新登录');
                navigate('/login');
                return;
            }

            // 2. 封装统一的请求头 (Header)
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // ✅ 关键：携带 Bearer Token
            };

            // A. 获取用户
            const usersRes = await fetch(`${BACKEND_URL}/api/users?includeManaged=true`, { headers }); // 需要后端支持 includeManaged 参数
            // B. 获取供应商
            const suppliersRes = await fetch(`${BACKEND_URL}/api/suppliers`, { headers });
            // C. 获取反馈 (需要新增 API)
            const feedbackRes = await fetch(`${BACKEND_URL}/api/admin/feedback`, { headers });
            // D. 获取系统公告 (需要新增 API)
            const systemNoticesRes = await fetch(`${BACKEND_URL}/api/admin/system-notices`, { headers });

            // 4. 处理 Token 过期 (401 Unauthorized)
            // 如果后端验证 Token 失败，通常会返回 401 状态码
            if (usersRes.status === 401 || suppliersRes.status === 401) {
                throw new Error('UNAUTHORIZED'); // 抛出特定错误以便 catch 捕获
            }

            const [usersData, suppliersData, feedbackData, systemNoticesData] = await Promise.all([
                usersRes.ok ? usersRes.json() : [],
                suppliersRes.ok ? suppliersRes.json() : [],
                feedbackRes.ok ? feedbackRes.json() : [],
                systemNoticesRes.ok ? systemNoticesRes.json() : []
            ]);

            setUsers(usersData);
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

            setSystemNotices(systemNoticesData);

        } catch (error) {
            console.error(error);
            if (error.message === 'UNAUTHORIZED') {
                messageApi.error('登录已过期，请重新登录');
                localStorage.removeItem('user');
                localStorage.removeItem('access_token'); // 清理 Token
                navigate('/login');
            } else {

                messageApi.error(`数据加载失败: ${error.message}`);
            }


        } finally {
            setLoading(false);
            setFeedbackLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
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

    // 2. 创建用户 (复用已有的 create-user API)
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

            const response = await fetch(`${BACKEND_URL}/api/create-user`, {
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

    // 3. 删除用户 (复用已有的 delete-user API)
    const handleDeleteUser = async (userId) => {
        setLoading(true);
        try {
            const response = await fetch(`${BACKEND_URL}/api/delete-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });

            const result = await response.json();

            if (!response.ok) throw new Error(result.error || '删除失败');

            messageApi.success('用户已彻底删除（包括登录账号）！');
            setUsers(prev => prev.filter(u => u.id !== userId));

        } catch (error) {
            messageApi.error(`删除用户失败: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const showCorrectionModal = (type, notice) => { setCorrectionModal({ visible: true, type, notice }); };
    const handleCorrectionCancel = () => { setCorrectionModal({ visible: false, type: null, notice: null }); correctionForm.resetFields(); };

    // 4. 重分配 (逻辑已在 NoticeContext 中封装，这里只负责调用 updateNotice)
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
            // NoticeContext 的 updateNotice 已经改为调用 API
            await updateNotice(notice.id, {
                assigned_supplier_id: newSupplier.key,
                assigned_supplier_name: newSupplier.title,
                old_supplier_id: notice.assignedSupplierId, // 传给后端发通知用
                history: [...currentHistory, newHistory],
            });

            messageApi.success('通知单已成功重分配！');
            handleCorrectionCancel();
        } catch (error) {
            messageApi.error(`重分配失败: ${error.message}`);
        }
    };

    // 5. 作废 (逻辑已在 NoticeContext 中封装)
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

            messageApi.warning('通知单已作废！');
            handleCorrectionCancel();
        } catch (error) {
            messageApi.error(`作废失败: ${error.message}`);
        }
    };

    const showEditModal = (user) => { setEditingUser(user); editForm.setFieldsValue({ username: user.username, phone: user.phone, password: '' }); setIsEditModalVisible(true); };
    const handleCancel = () => { setIsEditModalVisible(false); setEditingUser(null); setIsManageModalVisible(false); setManagingUser(null); };

    // 6. 编辑用户 (需要新增 API: /api/admin/update-user)
    const handleEditUser = async (values) => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/admin/update-user`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: editingUser.id,
                    username: values.username,
                    phone: values.phone,
                    password: values.password // 仅当有值时传给后端处理
                })
            });

            if (!response.ok) throw new Error('Update failed');

            messageApi.success('用户信息更新成功!');
            setIsEditModalVisible(false);
            setEditingUser(null);
            fetchData();
        } catch (error) {
            messageApi.error(`更新失败: ${error.message}`);
        }
    };
    const showManageModal = (user) => {
        setManagingUser(user);

        // 1. 检查 managed_suppliers 是否存在
        // 2. 提取所有的 supplier_id 组成一个数组 [ID1, ID2, ...]
        // 3. 赋值给 TargetKeys，这样 Transfer 组件的右侧才会显示已分配的供应商
        const currentKeys = user.managed_suppliers
            ? user.managed_suppliers.map(ms => ms.supplier_id)
            : [];

        setTargetSupplierKeys(currentKeys);
        setIsManageModalVisible(true);
    };
    // 7. 管理供应商分配 (需要新增 API: /api/admin/manage-assignments)
    const handleManageSuppliers = async () => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/admin/manage-assignments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: managingUser.id,
                    supplierIds: targetSupplierKeys
                })
            });

            if (!response.ok) throw new Error('Assignment failed');

            messageApi.success('供应商分配更新成功!');
            setIsManageModalVisible(false);
            setManagingUser(null);
            fetchData();
        } catch (error) {
            messageApi.error(`分配失败: ${error.message}`);
        }
    };

    const onTransferChange = (nextTargetKeys) => { setTargetSupplierKeys(nextTargetKeys); };

    // 8. 更新反馈状态 (需要新增 API: /api/admin/feedback)
    const handleFeedbackStatusChange = async (id, status) => {
        messageApi.loading({ content: '正在更新状态...', key: `feedback-${id}` });
        try {
            const response = await fetch(`${BACKEND_URL}/api/admin/feedback`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status })
            });

            if (!response.ok) throw new Error('Update failed');

            messageApi.success({ content: '状态更新成功！', key: `feedback-${id}`, duration: 2 });
            setFeedbackList(prevList => prevList.map(item =>
                item.id === id ? { ...item, status: status } : item
            ));
        } catch (error) {
            messageApi.error({ content: `状态更新失败: ${error.message}`, key: `feedback-${id}`, duration: 3 });
        }
    };

    const handleResponseChange = (id, value) => {
        setFeedbackResponses(prev => ({ ...prev, [id]: value }));
    };

    // 9. 保存反馈回复 (复用 feedback API)
    const handleSaveFeedbackResponse = async (id) => {
        const responseText = feedbackResponses[id];
        const currentFeedbackItem = feedbackList.find(item => item.id === id);
        if (currentFeedbackItem && currentFeedbackItem.admin_response === responseText) return;

        messageApi.loading({ content: '正在保存回复...', key: `response-${id}` });
        try {
            const response = await fetch(`${BACKEND_URL}/api/admin/feedback`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, admin_response: responseText })
            });

            if (!response.ok) throw new Error('Save failed');

            messageApi.success({ content: '回复已保存！', key: `response-${id}`, duration: 2 });
            setFeedbackList(prevList => prevList.map(item =>
                item.id === id ? { ...item, admin_response: responseText } : item
            ));
        } catch (error) {
            messageApi.error({ content: `回复保存失败: ${error.message}`, key: `response-${id}`, duration: 3 });
        }
    };

    // 10. 删除反馈 (复用 feedback API)
    const handleDeleteFeedback = async (id) => {
        messageApi.loading({ content: '正在删除反馈...', key: `delete-${id}` });
        try {
            const response = await fetch(`${BACKEND_URL}/api/admin/feedback?id=${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Delete failed');

            messageApi.success({ content: '反馈已删除！', key: `delete-${id}`, duration: 2 });
            setFeedbackList(prevList => prevList.filter(item => item.id !== id));
        } catch (error) {
            messageApi.error({ content: `删除失败: ${error.message}`, key: `delete-${id}`, duration: 3 });
        }
    };

    // 11. 发布公告 (需要新增 API: /api/admin/system-notices)
    const handlePublishNotice = async (values) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('access_token');
            if (!token) {
                messageApi.error('登录凭证丢失，请重新登录');
                navigate('/login');
                return;
            }

            const response = await fetch(`${BACKEND_URL}/api/admin/system-notices`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    type: values.type,
                    content: values.content,
                    is_active: true
                })
            });

            if (!response.ok) throw new Error('Publish failed');

            messageApi.success('系统公告发布成功！');
            setIsNoticeModalVisible(false);
            fetchData();
        } catch (error) {
            messageApi.error(`发布失败: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // 12. 删除公告 (复用 system-notices API)
    const handleDeleteNotice = async (id) => {
        try {
            const token = localStorage.getItem('access_token');
            if (!token) {
                messageApi.error('登录凭证丢失，请重新登录');
                navigate('/login');
                return;
            }

            const response = await fetch(`${BACKEND_URL}/api/admin/system-notices?id=${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) throw new Error('Delete failed');

            messageApi.success('公告已删除');
            setSystemNotices(prev => prev.filter(n => n.id !== id));
        } catch (error) {
            messageApi.error(`删除失败: ${error.message}`);
        }
    };

    // --- Table Columns (保持不变，只是渲染逻辑) ---
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

    const systemNoticeColumns = [
        {
            title: '类型',
            dataIndex: 'type',
            key: 'type',
            width: 100,
            render: (type) => {
                const config = {
                    error: { color: 'red', text: '故障/紧急' },
                    warning: { color: 'orange', text: '警告/维护' },
                    info: { color: 'blue', text: '一般消息' }
                };
                const c = config[type] || config.info;
                return <Tag color={c.color}>{c.text}</Tag>;
            }
        },
        {
            title: '公告内容',
            dataIndex: 'content',
            key: 'content',
        },
        {
            title: '发布时间',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 200,
            render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
        },
        {
            title: '操作',
            key: 'action',
            width: 100,
            render: (_, record) => (
                <Popconfirm title="确定删除此公告?" onConfirm={() => handleDeleteNotice(record.id)}>
                    <Button danger icon={<DeleteOutlined />} size="small">删除</Button>
                </Popconfirm>
            )
        }
    ];

    // --- Tabs Items ---
    const items = [
        {
            key: '1',
            label: <Space><UserSwitchOutlined />用户与供应商管理</Space>,
            children: (
                <>
                    <Space style={{ marginBottom: 16 }}>
                        <Search
                            placeholder="搜索人员..."
                            onSearch={value => setSearchTerm(value)}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ width: 300 }}
                            allowClear
                        />
                    </Space>
                    <Table columns={userColumns} dataSource={filteredUsers} rowKey="id" size="middle" pagination={{ pageSize: 10, showSizeChanger: true }} />
                </>
            )

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
                        <Radio.Group value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <Radio.Button value="全部">全部</Radio.Button>
                            <Radio.Button value="待处理">待处理</Radio.Button>
                            <Radio.Button value="已完成">已完成</Radio.Button>
                            <Radio.Button value="已作废">已作废</Radio.Button>
                        </Radio.Group>
                    </Space>
                    <Table columns={noticeColumns} dataSource={filteredNotices} rowKey="id" size="middle" pagination={{ pageSize: 10, showSizeChanger: true }} />
                </>
            )
        },
        {
            key: '3',
            label: <Space><MessageOutlined />用户反馈</Space>,
            children: (
                <>
                    <Card bordered={false} style={{ marginBottom: 16, backgroundColor: '#fafafa' }} bodyStyle={{ padding: '12px 24px' }}>
                        {/* 筛选器 UI 保持不变 */}
                        <Row gutter={24} align="middle">
                            <Col>
                                <Space>
                                    <FilterOutlined />
                                    <Text strong>筛选:</Text>
                                </Space>
                            </Col>
                            <Col>
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
                                        avatar={<Avatar style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />}
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
                                                >
                                                    {feedbackStatuses.map(s => {
                                                        const config = feedbackStatusConfig[s] || { color: 'default', label: s };
                                                        return (
                                                            <Option key={s} value={s}>
                                                                <Tag color={config.color}>{config.icon} {config.label}</Tag>
                                                            </Option>
                                                        )
                                                    })}
                                                </Select>
                                            </div>
                                        }
                                        description={
                                            <div>
                                                <Paragraph style={{ fontSize: 15, lineHeight: 1.6 }}>{item.content}</Paragraph>
                                                {/* Images */}
                                                {item.images && item.images.length > 0 && (
                                                    <div style={{ marginTop: 16 }}>
                                                        <Image.PreviewGroup>
                                                            <Space size={8} wrap>
                                                                {item.images.map((img, idx) => {
                                                                    const imgSrc = typeof img === 'object' ? (img.url || img.thumbUrl) : img;
                                                                    return <Image key={idx} width={100} height={100} src={imgSrc} style={{ objectFit: 'cover', borderRadius: 8 }} />;
                                                                })}
                                                            </Space>
                                                        </Image.PreviewGroup>
                                                    </div>
                                                )}
                                                {/* Admin Response */}
                                                <div style={{ marginTop: 24, backgroundColor: '#fafafa', padding: 16, borderRadius: 8 }}>
                                                    <Text strong style={{ color: '#595959' }}><MessageOutlined /> 管理员回复</Text>
                                                    <TextArea
                                                        value={feedbackResponses[item.id] || ''}
                                                        onChange={(e) => handleResponseChange(item.id, e.target.value)}
                                                        placeholder="在此输入处理意见..."
                                                        autoSize={{ minRows: 2, maxRows: 6 }}
                                                        style={{ marginBottom: 8, marginTop: 8 }}
                                                    />
                                                    <div style={{ textAlign: 'right' }}>
                                                        <Popconfirm title="删除?" onConfirm={() => handleDeleteFeedback(item.id)}>
                                                            <Button type="text" danger size="small" icon={<DeleteOutlined />} style={{ float: 'left' }}>删除</Button>
                                                        </Popconfirm>
                                                        <Button type="primary" size="small" icon={<SaveOutlined />} onClick={() => handleSaveFeedbackResponse(item.id)}>保存回复</Button>
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                    />
                                </Card>
                            </List.Item>
                        )}
                    />
                </>
            )
        },
        {
            key: '4',
            label: <Space><FileTextOutlined />系统日志</Space>,
            children: <SystemLogViewer />
        },
        {
            key: '5',
            label: <Space><BookOutlined />开发文档</Space>,
            children: <Typography><Title level={4}>系统开发文档</Title><Paragraph>...</Paragraph></Typography>
        },
        {
            key: '6',
            label: <Space><SoundOutlined />系统公告管理</Space>,
            children: (
                <div>
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => { noticeForm.resetFields(); setIsNoticeModalVisible(true); }}>
                            发布新公告
                        </Button>
                    </div>
                    <Table
                        columns={systemNoticeColumns}
                        dataSource={systemNotices}
                        rowKey="id"
                        size="middle"
                        pagination={{ pageSize: 5 }}
                        locale={{ emptyText: <Empty description="暂无历史公告" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                    />
                </div>
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
                <Tabs defaultActiveKey="1" items={items} tabBarExtraContent={<Button type="primary" icon={<UserAddOutlined />} onClick={showCreateModal}>新增用户</Button>} />
            </Card>

            {/* Modals 保持不变 */}
            <Modal title="新增系统用户" open={isCreateModalVisible} onCancel={handleCreateCancel} footer={null} width={600}>
                <Form form={createForm} layout="vertical" onFinish={handleCreateUser} initialValues={{ role: 'SD', supplierMode: 'existing' }}>
                    <Form.Item name="role" label="用户角色"><Radio.Group onChange={(e) => setSelectedRole(e.target.value)} buttonStyle="solid"><Radio.Button value="SD">SD</Radio.Button><Radio.Button value="Manager">Manager</Radio.Button><Radio.Button value="Admin">Admin</Radio.Button><Radio.Button value="Supplier">Supplier</Radio.Button></Radio.Group></Form.Item>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="email" label="邮箱" rules={[{ required: true }]}><Input /></Form.Item></Col>
                        <Col span={12}><Form.Item name="username" label="姓名" rules={[{ required: true }]}><Input /></Form.Item></Col>
                    </Row>
                    <Form.Item name="password" label="初始密码" rules={[{ required: true }]}><Input.Password /></Form.Item>
                    {selectedRole === 'Supplier' && (
                        <div style={{ background: '#f9f9f9', padding: 16 }}>
                            <Form.Item label="模式"><Radio.Group value={supplierMode} onChange={e => setSupplierMode(e.target.value)}><Radio value="existing">绑定已有</Radio><Radio value="new">新建</Radio></Radio.Group></Form.Item>
                            {supplierMode === 'existing' ? (
                                <Form.Item name="existingSupplierId" label="选择供应商" rules={[{ required: true }]}><Select showSearch options={allSuppliers} /></Form.Item>
                            ) : (
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <Form.Item name="newSupplierName" label="全称" rules={[{ required: true }]}><Input /></Form.Item>
                                    <Space><Form.Item name="newSupplierCode" label="Code" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="newSupplierParma" label="Parma" rules={[{ required: true }]}><Input /></Form.Item></Space>
                                </Space>
                            )}
                        </div>
                    )}
                    <div style={{ textAlign: 'right', marginTop: 24 }}><Button onClick={handleCreateCancel}>取消</Button><Button type="primary" htmlType="submit" loading={loading} style={{ marginLeft: 8 }}>确认</Button></div>
                </Form>
            </Modal>

            <Modal title={`编辑用户: ${editingUser?.username}`} open={isEditModalVisible} onCancel={handleCancel} footer={null}>
                <Form form={editForm} layout="vertical" onFinish={handleEditUser}>
                    <Form.Item name="username" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="phone" label="电话"><Input /></Form.Item>
                    <Form.Item
                        name="password"
                        label="新密码 (留空则不修改)"
                        rules={[
                            { min: 6, message: '密码长度不能少于6位' } // ✅ 添加这一行
                        ]}
                    >
                        <Input.Password />
                    </Form.Item>
                    <Button type="primary" htmlType="submit">保存更改</Button>
                </Form>
            </Modal>

            <Modal title={`管理 ${managingUser?.name} 的供应商`} open={isManageModalVisible} onOk={handleManageSuppliers} onCancel={handleCancel} width={700}>
                <Transfer dataSource={allSuppliers} targetKeys={targetSupplierKeys} onChange={onTransferChange} render={item => item.title} listStyle={{ width: 300, height: 400 }} />
            </Modal>

            <Modal title={correctionModal.type === 'reassign' ? '重分配' : '作废'} open={correctionModal.visible} onCancel={handleCorrectionCancel} footer={null}>
                <Form form={correctionForm} layout="vertical" onFinish={correctionModal.type === 'reassign' ? handleReassignment : handleVoidNotice}>
                    {correctionModal.type === 'reassign' && <Form.Item name="newSupplierId" label="新供应商" rules={[{ required: true }]}><Select showSearch options={allSuppliers} /></Form.Item>}
                    <Form.Item name="reason" label="原因" rules={[{ required: true }]}><Input.TextArea rows={4} /></Form.Item>
                    <Button type="primary" htmlType="submit">确认</Button>
                </Form>
            </Modal>

            <Modal title="发布公告" open={isNoticeModalVisible} onCancel={() => setIsNoticeModalVisible(false)} footer={null}>
                <Form form={noticeForm} layout="vertical" onFinish={handlePublishNotice} initialValues={{ type: 'info' }}>
                    <Form.Item name="type" label="类型" rules={[{ required: true }]}><Radio.Group><Radio.Button value="info">Info</Radio.Button><Radio.Button value="warning">Warning</Radio.Button><Radio.Button value="error">Error</Radio.Button></Radio.Group></Form.Item>
                    <Form.Item name="content" label="内容" rules={[{ required: true }]}><Input.TextArea rows={4} /></Form.Item>
                    <Button type="primary" htmlType="submit" loading={loading}>发布</Button>
                </Form>
            </Modal>
        </div>
    );
};

export default AdminPage;
