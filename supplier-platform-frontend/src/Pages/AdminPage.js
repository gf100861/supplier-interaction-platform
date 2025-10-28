import React, { useState, useEffect, useMemo } from 'react'; // 引入 useMemo
import { useNavigate } from 'react-router-dom';

import {
    Card, Typography, Table, Tabs, Tag, Space, Button, Modal, Form, Input, message, Spin, Transfer, Select, Radio, Popconfirm, Divider // 引入 Radio
} from 'antd';
import { EditOutlined, UserSwitchOutlined, FileTextOutlined, AppstoreAddOutlined, DeleteOutlined, SwapOutlined,MessageOutlined, BookOutlined } from '@ant-design/icons';
import { supabase } from '../supabaseClient';
import dayjs from 'dayjs';
import { useNotification } from '../contexts/NotificationContext';

const { Title, Paragraph, Text} = Typography;
const { TabPane } = Tabs;
const { Option } = Select;
const { Search,TextArea } = Input; // 从 Input 中解构 Search


const feedbackStatuses = ['new', 'acked', 'resolved', 'wontfix','alarm'];
const feedbackStatusColors = {
    new: 'blue',
    acked: 'purple',
    resolved: 'success',
    wontfix: 'yellow',
    alarm : 'red'
};



const AdminPage = () => {
    // --- State Management ---
    const [users, setUsers] = useState([]);
    const [allSuppliers, setAllSuppliers] = useState([]);
    const [notices, setNotices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState([]);
    const { messageApi, notificationApi } = useNotification();

    // --- ✨ 新增：搜索和筛选的状态 ---
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('全部');

    // --- Modal States ---
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [editForm] = Form.useForm();
    const [isManageModalVisible, setIsManageModalVisible] = useState(false);
    const [managingUser, setManagingUser] = useState(null);
    const [targetSupplierKeys, setTargetSupplierKeys] = useState([]);
    const [correctionModal, setCorrectionModal] = useState({ visible: false, type: null, notice: null });
    const [correctionForm] = Form.useForm();

    const [feedbackList, setFeedbackList] = useState([]); // 2. State for feedback
    const [feedbackLoading, setFeedbackLoading] = useState(true); // 3. Loading state for feedback
      const [feedbackResponses, setFeedbackResponses] = useState({}); // 1. State for admin responses

    const currentUser = JSON.parse(localStorage.getItem('user'));

      const navigate = useNavigate();

  if (currentUser.role !== 'Admin') {
      navigate('/'); // 跳转到初始页面
    }
    const filteredNotices = useMemo(() => {
        return notices.filter(notice => {
            // 状态筛选逻辑
            const statusMatch = statusFilter === '全部' || notice.status === statusFilter || (statusFilter === '待处理' && notice.status.includes('待'));

            // 搜索词筛选逻辑
            const searchMatch = searchTerm === '' ||
                notice.notice_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                notice.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                notice.assigned_supplier_name.toLowerCase().includes(searchTerm.toLowerCase());

            return statusMatch && searchMatch;
        });
    }, [notices, searchTerm, statusFilter]); // 当这三个值任意一个变化时，重新计算

    // --- Data Fetching ---
  

    // --- Data Fetching ---
    const fetchData = async () => {
        setLoading(true);
        setFeedbackLoading(true); // Start feedback loading
        try {
            // Fetch users, suppliers, notices (existing logic)
            const usersPromise = supabase.from('users').select(`id, username, email, phone, role, managed_suppliers:sd_supplier_assignments(supplier_id)`).in('role', ['SD', 'Manager']);
            const suppliersPromise = supabase.from('suppliers').select('id, name');
            const noticesPromise = supabase.from('notices').select('*').order('created_at', { ascending: false });
            // --- 4. Fetch Feedback Data ---
            const feedbackPromise = supabase
                .from('feedback')
                .select(`
                    *,
                    user:users ( username )
                `)
                .order('created_at', { ascending: false });


            const [
                { data: usersData, error: usersError },
                { data: suppliersData, error: suppliersError },
                { data: noticesData, error: noticesError },
                { data: feedbackData, error: feedbackError } // Destructure feedback results
            ] = await Promise.all([usersPromise, suppliersPromise, noticesPromise, feedbackPromise]);

            if (usersError) throw usersError;
            if (suppliersError) throw suppliersError;
            if (noticesError) throw noticesError;
            if (feedbackError) throw feedbackError; // Check for feedback error

            setUsers(usersData || []);
            setAllSuppliers(suppliersData.map(s => ({ key: s.id, title: s.name })) || []);
            setNotices(noticesData || []);
            setFeedbackList(feedbackData || []); // Set feedback data

        } catch (error) {
            messageApi.error(`数据加载失败: ${error.message}`);
        } finally {
            setLoading(false);
            setFeedbackLoading(false); // Stop feedback loading
        }
    };


    const fetchLogs = () => {
        setLogs([
            { id: 1, timestamp: '2025-09-29 10:30:05', level: 'INFO', message: '用户 louis.xin@volvo.com 登录成功' },
            { id: 2, timestamp: '2025-09-29 10:32:15', level: 'INFO', message: '用户 admin@example.com 创建了新的整改通知单 #N-20250929-ABCDEF' },
            { id: 3, timestamp: '2025-09-29 10:35:00', level: 'ERROR', message: '尝试连接到外部API失败: 超时' },
            { id: 4, timestamp: '2025-09-29 10:40:22', level: 'WARN', message: '用户密码将在 5 天后过期' },
        ]);
    }

    useEffect(() => {
        fetchData();
        fetchLogs();
    }, []);

    // 新增：打开重分配/作废模态框
    const showCorrectionModal = (type, notice) => {
        setCorrectionModal({ visible: true, type, notice });
    };

    // 新增：关闭重分配/作废模态框
    const handleCorrectionCancel = () => {
        setCorrectionModal({ visible: false, type: null, notice: null });
        correctionForm.resetFields();
    };

    // --- ✨ 适配后的“重分配”逻辑 ---
    const handleReassignment = async (values) => {
        const notice = correctionModal.notice;
        if (!notice) return;

        const newSupplier = allSuppliers.find(s => s.id === values.newSupplierId);
        if (!newSupplier) {
            messageApi.error('未找到指定的供应商！');
            return;
        }

        const newHistory = {
            type: 'manager_reassignment',
            submitter: currentUser.username, // Assuming username is the name
            time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            description: `[管理修正] 通知单已重分配给新的供应商。原因: ${values.reason || '未提供原因'}`,
        };

        const currentHistory = Array.isArray(notice.history) ? notice.history : [];

        const { error } = await supabase.from('notices').update({
            assigned_supplier_id: newSupplier.id,
            assigned_supplier_name: newSupplier.name,
            history: [...currentHistory, newHistory],
        }).eq('id', notice.id);

        if (error) {
            messageApi.error(`重分配失败: ${error.message}`);
            return;
        }

        // 假设您有一个 'alerts' 表
        const alertsToInsert = [
            { creator_id: currentUser.id, target_user_id: notice.assigned_supplier_id, message: `"${notice.title}" 已被重分配，您无需再处理。`, link: `/notices` },
            { creator_id: currentUser.id, target_user_id: newSupplier.id, message: `您有一个新的通知单被分配: "${notice.title}"。`, link: `/notices?open=${notice.id}` },
            { creator_id: currentUser.id, target_user_id: notice.creator_id, message: `您创建的 "${notice.title}" 已被重分配给 ${newSupplier.name}。`, link: `/notices?open=${notice.id}` },
        ];
        await supabase.from('alerts').insert(alertsToInsert);

        messageApi.success('通知单已成功重分配！');
        handleCorrectionCancel();
        fetchData(); // 重新加载数据
    };

    // --- ✨ 适配后的“作废”逻辑 ---
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

        const { error } = await supabase.from('notices').update({
            status: '已作废',
            history: [...currentHistory, newHistory],
        }).eq('id', notice.id);

        if (error) {
            messageApi.error(`作废失败: ${error.message}`);
            return;
        }

        // 假设您有一个 'alerts' 表
        const alertsToInsert = [
            { creator_id: currentUser.id, target_user_id: notice.assigned_supplier_id, message: `"${notice.title}" 已被作废，您无需再处理。`, link: `/notices` },
            { creator_id: currentUser.id, target_user_id: notice.creator_id, message: `您创建的 "${notice.title}" 已被作废。`, link: `/notices?open=${notice.id}` },
        ];
        await supabase.from('alerts').insert(alertsToInsert);

        messageApi.warning('通知单已作废！');
        handleCorrectionCancel();
        fetchData(); // 重新加载数据
    };


    // --- Modal Handlers ---
    const showEditModal = (user) => {
        setEditingUser(user);
        editForm.setFieldsValue({
            // --- 修改点 3 ---
            // 'name' 字段已更正为 'username'
            username: user.username,
            phone: user.phone,
            password: '', // Keep password field empty for security
        });
        setIsEditModalVisible(true);
    };

    const showManageModal = (user) => {
        setManagingUser(user);
        const assignedKeys = user.managed_suppliers.map(ms => ms.supplier_id);
        setTargetSupplierKeys(assignedKeys);
        setIsManageModalVisible(true);
    };

    const handleCancel = () => {
        setIsEditModalVisible(false);
        setEditingUser(null);
        setIsManageModalVisible(false);
        setManagingUser(null);
    };

    const handleEditUser = async (values) => {
        try {
            // --- 修改点 4 ---
            // 'name' 字段已更正为 'username'
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

    const handleManageSuppliers = async () => {
        try {
            // --- 修改点 5 ---
            // 'sd_id' 已更正为 'sd_user_id'
            const { error: deleteError } = await supabase
                .from('sd_supplier_assignments')
                .delete()
                .eq('sd_user_id', managingUser.id);
            if (deleteError) throw deleteError;

            if (targetSupplierKeys.length > 0) {
                const newAssignments = targetSupplierKeys.map(supplierId => ({
                    sd_user_id: managingUser.id, // 'sd_id' 已更正为 'sd_user_id'
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

    const onTransferChange = (nextTargetKeys) => {
        setTargetSupplierKeys(nextTargetKeys);
    };


     const handleFeedbackStatusChange = async (feedbackId, newStatus) => {
        messageApi.loading({ content: '正在更新状态...', key: `feedback-${feedbackId}` });
        try {
            const { error } = await supabase
                .from('feedback')
                .update({ status: newStatus })
                .eq('id', feedbackId);

            if (error) throw error;

            messageApi.success({ content: '状态更新成功！', key: `feedback-${feedbackId}`, duration: 2 });
            // Update local state for immediate UI feedback
            setFeedbackList(prevList => prevList.map(item =>
                item.id === feedbackId ? { ...item, status: newStatus } : item
            ));
            // Optional: Refetch all data if needed, but local update is faster
            // fetchData();
        } catch (error) {
            messageApi.error({ content: `状态更新失败: ${error.message}`, key: `feedback-${feedbackId}`, duration: 3 });
        }
    };

       const handleResponseChange = (feedbackId, value) => {
        setFeedbackResponses(prev => ({
            ...prev,
            [feedbackId]: value
        }));
    };

        const handleSaveFeedbackResponse = async (feedbackId) => {
        const responseText = feedbackResponses[feedbackId];
        // Check if the response actually changed from what's in the DB to avoid unnecessary updates
        const currentFeedbackItem = feedbackList.find(item => item.id === feedbackId);
        if (currentFeedbackItem && currentFeedbackItem.admin_response === responseText) {
            return; // No change, do nothing
        }

        messageApi.loading({ content: '正在保存回复...', key: `response-${feedbackId}` });
        try {
            const { error } = await supabase
                .from('feedback')
                .update({ admin_response: responseText })
                .eq('id', feedbackId);
            if (error) throw error;
            messageApi.success({ content: '回复已保存！', key: `response-${feedbackId}`, duration: 2 });
             // Update the main feedback list state as well
             setFeedbackList(prevList => prevList.map(item =>
                item.id === feedbackId ? { ...item, admin_response: responseText } : item
            ));
        } catch (error) {
            messageApi.error({ content: `回复保存失败: ${error.message}`, key: `response-${feedbackId}`, duration: 3 });
        }
    };

    // --- Table Column Definitions ---
    const userColumns = [
        // --- 修改点 6 ---
        // dataIndex 'name' 已更正为 'username'
        { title: '姓名', dataIndex: 'username', key: 'username' },
        { title: '邮箱', dataIndex: 'email', key: 'email' },
        { title: '电话', dataIndex: 'phone', key: 'phone', render: (text) => text || 'N/A' },
        { title: '角色', dataIndex: 'role', key: 'role', render: (role) => <Tag color={role === 'Manager' ? 'gold' : 'blue'}>{role}</Tag> },
        {
            title: '负责供应商数量',
            key: 'suppliers',
            render: (_, record) => record.managed_suppliers.length
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Space size="middle">
                    <Button icon={<EditOutlined />} onClick={() => showEditModal(record)}>编辑</Button>
                    {record.role === 'SD' && (
                        <Button icon={<UserSwitchOutlined />} onClick={() => showManageModal(record)}>管理供应商</Button>
                    )}
                </Space>
            ),
        },
    ];


    const noticeColumns = [
        { title: '通知单号', dataIndex: 'notice_code', key: 'notice_code', width: 150 },
        { title: '标题', dataIndex: 'title', key: 'title' },
        { title: '类型', dataIndex: 'category', key: 'category', width: 100 },
        { title: '当前供应商', dataIndex: 'assigned_supplier_name', key: 'assigned_supplier_name' },
        {
            title: '状态', dataIndex: 'status', key: 'status', render: (status) => {
                let color = 'geekblue';
                if (status === '已作废') color = 'grey';
                if (status === '已完成') color = 'green';
                if (status.includes('待处理')) color = 'volcano';
                return <Tag color={color}>{status}</Tag>
            }
        },
        { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: (text) => dayjs(text).format('YYYY-MM-DD') },
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

     const feedbackColumns = [
         { title: '提交用户', dataIndex: ['user', 'username'], key: 'username', width: 150, render: (username) => username || <Text type="secondary">未知用户</Text> },
         { title: '反馈内容', dataIndex: 'content', key: 'content', ellipsis: true },
         { title: '类别', dataIndex: 'category', key: 'category', width: 120, render: (cat) => cat || <Text type="secondary">无</Text> },
         { title: '状态', dataIndex: 'status', key: 'status', width: 130, render: (status, record) => ( <Select value={status || 'new'} size="small" style={{ width: '100%' }} onChange={(value) => handleFeedbackStatusChange(record.id, value)}> {feedbackStatuses.map(s => (<Option key={s} value={s}> <Tag color={feedbackStatusColors[s] || 'default'}>{s}</Tag> </Option> ))} </Select> ) },
         // --- 7. Add Admin Response Column ---
         {
            title: '管理员回复',
            dataIndex: 'admin_response',
            key: 'admin_response',
            width: 250, // Adjust width as needed
            render: (text, record) => (
                <TextArea
                    value={feedbackResponses[record.id] || ''}
                    onChange={(e) => handleResponseChange(record.id, e.target.value)}
                    onBlur={() => handleSaveFeedbackResponse(record.id)} // Save on blur
                    placeholder="输入回复或备注..."
                    autoSize={{ minRows: 1, maxRows: 4 }}
                />
            )
         },
         { title: '提交时间', dataIndex: 'created_at', key: 'created_at', width: 160, render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm') },
         { title: '操作', key: 'action', width: 80, render: (_, record) => ( <Popconfirm title="确定删除此反馈吗?" onConfirm={async () => { /* delete logic */ }}> <Button danger type="link" size="small" icon={<DeleteOutlined />} /> </Popconfirm> ) }
    ];


    const logColumns = [
        { title: '时间戳', dataIndex: 'timestamp', key: 'timestamp' },
        {
            title: '级别',
            dataIndex: 'level',
            key: 'level',
            render: level => {
                let color;
                if (level === 'ERROR') color = 'volcano';
                else if (level === 'WARN') color = 'orange';
                else color = 'geekblue';
                return <Tag color={color}>{level}</Tag>;
            }
        },
        { title: '信息', dataIndex: 'message', key: 'message' },
    ];

    if (loading) {
        return <Spin size="large" style={{ display: 'block', marginTop: '50px' }} />;
    }

    return (
        <div style={{ maxWidth: 1200, margin: 'auto', padding: '24px' }}>
            <Card>
                <Title level={2}>管理后台</Title>
                <Paragraph>在此页面管理系统用户、供应商分配以及查看系统日志。</Paragraph>

                <Tabs defaultActiveKey="1">
                    <TabPane tab={<Space><UserSwitchOutlined />用户与供应商管理</Space>} key="1">
                        <Table columns={userColumns} dataSource={users} rowKey="id" />
                    </TabPane>
                    {/* --- ✨ 新增的标签页 --- */}
                    <TabPane tab={<Space><AppstoreAddOutlined />通知单管理</Space>} key="2">
                        {/* --- ✨ 新增：搜索和筛选的 UI 组件 --- */}
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

                        {/* --- ✨ 修改：dataSource 使用过滤后的数据 --- */}
                        <Table columns={noticeColumns} dataSource={filteredNotices} rowKey="id" />
                    </TabPane>

                      <TabPane tab={<Space><MessageOutlined />用户反馈</Space>} key="3">
                        <Table columns={feedbackColumns} dataSource={feedbackList} rowKey="id" loading={feedbackLoading} />
                    </TabPane>

                    <TabPane tab={<Space><FileTextOutlined />系统日志</Space>} key="4">
                        <Table columns={logColumns} dataSource={logs} rowKey="id" />
                    </TabPane>
                      <TabPane tab={<Space><BookOutlined />开发文档</Space>} key="5">
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
                                 - 用户认证与权限管理<br/>
                                 - 通知单创建、流转与管理<br/>
                                 - 供应商管理与分配<br/>
                                 - 历史经验标签<br/>
                                 - 报表与统计<br/>
                                 - 实时提醒<br/>
                                 - 管理后台<br/>
                                 - (待开发) 智能检索与AI打标签
                             </Paragraph>
                             {/* Add more sections like Deployment, API Reference etc. */}
                         </Typography>
                    </TabPane>

                </Tabs>
            </Card>

            <Modal
                // --- 修改点 7 ---
                // 'name' 已更正为 'username'
                title={`编辑用户: ${editingUser?.username}`}
                open={isEditModalVisible}
                onCancel={handleCancel}
                footer={null}
            >
                <Form form={editForm} layout="vertical" onFinish={handleEditUser}>
                    <Form.Item name="username" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="phone" label="电话">
                        <Input />
                    </Form.Item>
                    <Form.Item name="password" label="新密码 (留空则不修改)">
                        <Input.Password placeholder="输入新密码" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit">保存更改</Button>
                    </Form.Item>
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
                footer={null} // We will use Form's button
            >
                <Paragraph>
                    正在处理通知单: <Text strong>{correctionModal.notice?.notice_code}</Text> - <Text>{correctionModal.notice?.title}</Text>
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
                            <Select showSearch placeholder="搜索并选择供应商" filterOption={(input, option) => option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0}>
                                {allSuppliers.map(s => (
                                    <Option key={s.id} value={s.id}>{s.name}</Option>
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