import React, { useState } from 'react';
import { Form, Input, Button, Select, Card } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../contexts/NotificationContext';
import { supabase } from '../supabaseClient';

const { Option } = Select;

const LoginPage = () => {
    const navigate = useNavigate();
    const { messageApi } = useNotification();
    const [loading, setLoading] = useState(false);

    const onFinish = async (values) => {
        setLoading(true);
        try {
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: values.email,
                password: values.password,
            });

            if (authError) throw authError;

            // --- 核心修改：使用关联查询，一次性获取用户及其管理的供应商 ---
            // 这个查询的意思是：
            // 1. 从 'users' 表中查找用户
            // 2. 同时，通过 'sd_supplier_assignments' 这张关联表...
            // 3. ...将该用户关联的所有 'suppliers' 表的完整信息(*)也一并取回
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select(`
                    *,
                    managed_suppliers:sd_supplier_assignments (
                        supplier:suppliers (*)
                    )
                `)
                .eq('id', authData.user.id)
                .single();
            
            if (userError) throw userError;

            if (userData.role !== values.role) {
                throw new Error("凭证或角色选择不正确！");
            }

            console.log("登录成功！从数据库获取到的、包含完整关联供应商信息的 User 对象如下:", userData);
            
            messageApi.success('登录成功!');
            localStorage.setItem('user', JSON.stringify(userData));
            navigate('/');

        } catch (error) {
            messageApi.error(error.message || '登录失败，请检查您的凭证。');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ background: '#f0f2f5', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Card title="供应商与SD信息交换平台" style={{ width: 400 }}>
                <Form name="login_form" onFinish={onFinish} initialValues={{ role: 'SD' }}>
                    
                    <Form.Item 
                        name="email" 
                        label="登录邮箱" 
                        rules={[{ required: true, message: '请输入您的邮箱地址!' }, { type: 'email', message: '请输入有效的邮箱格式!' }]}
                    >
                        <Input prefix={<UserOutlined />} placeholder="请输入注册邮箱" />
                    </Form.Item>

                    <Form.Item 
                        name="password" 
                        label="密码" 
                        rules={[{ required: true, message: '请输入密码!' }]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
                    </Form.Item>
                    
                    <Form.Item 
                        name="role" 
                        label="登录角色" 
                        rules={[{ required: true, message: '请选择您的角色!' }]}
                    >
                        <Select placeholder="选择角色">
                            <Option value="SD">SD</Option>
                            <Option value="Manager">Manager</Option>
                            <Option value="Supplier">Supplier</Option>
                        </Select>
                    </Form.Item>
                    
                    <Form.Item>
                        <Button type="primary" htmlType="submit" style={{ width: '100%' }} loading={loading}>
                            登 录
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};

export default LoginPage;