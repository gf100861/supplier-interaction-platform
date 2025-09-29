import React, { useState, useEffect } from 'react';
import {
    Card,
    Typography,
    Table,
    Tabs,
    Tag,
    Space,
    Button,
    Modal,
    Form,
    Input,
    message,
    Spin,
    Transfer
} from 'antd';
import { EditOutlined, UserSwitchOutlined, FileTextOutlined } from '@ant-design/icons';
import { supabase } from '../supabaseClient';

const { Title, Paragraph } = Typography;
const { TabPane } = Tabs;

const AdminPage = () => {
    // --- State Management ---
    const [users, setUsers] = useState([]);
    const [allSuppliers, setAllSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState([]); // Mock logs for now

    // Edit User Modal State
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [editForm] = Form.useForm();

    // Manage Suppliers Modal State
    const [isManageModalVisible, setIsManageModalVisible] = useState(false);
    const [managingUser, setManagingUser] = useState(null);
    const [targetSupplierKeys, setTargetSupplierKeys] = useState([]);

    // --- Data Fetching ---
    const fetchData = async () => {
        setLoading(true);
        try {
            // --- 修改点 1 ---
            // 'name' 字段已更正为 'username'
            const { data: usersData, error: usersError } = await supabase
                .from('users')
                .select(`
                    id, username, email, phone, role,
                    managed_suppliers:sd_supplier_assignments (
                        supplier_id
                    )
                `)
                .in('role', ['SD', 'Manager']);

            if (usersError) throw usersError;
            setUsers(usersData);

            // Fetch all suppliers for the Transfer component
            // --- 修改点 2 ---
            // suppliers 表中的 'name' 字段是正确的，无需修改，但为保持一致性检查
            const { data: suppliersData, error: suppliersError } = await supabase
                .from('suppliers')
                .select('id, name');

            if (suppliersError) throw suppliersError;
            setAllSuppliers(suppliersData.map(s => ({ key: s.id, title: s.name })));

        } catch (error) {
            message.error(`数据加载失败: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };
    
    // Mock log fetching
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
    
            message.success('用户信息更新成功!');
            setIsEditModalVisible(false);
            setEditingUser(null);
            fetchData();
        } catch (error) {
            message.error(`更新失败: ${error.message}`);
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
        } catch(error) {
            message.error(`分配失败: ${error.message}`);
        }
    };

    const onTransferChange = (nextTargetKeys) => {
        setTargetSupplierKeys(nextTargetKeys);
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
                    <TabPane tab={<Space><FileTextOutlined />系统日志</Space>} key="2">
                        <Table columns={logColumns} dataSource={logs} rowKey="id" />
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
                title={`管理 ${managingUser?.username} 的供应商`}
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
        </div>
    );
};

export default AdminPage;