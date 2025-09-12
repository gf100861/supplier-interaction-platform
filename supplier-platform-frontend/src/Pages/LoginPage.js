import { Form, Input, Button, Select, Card } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../contexts/NotificationContext';
import { useState } from 'react'; // 引入 useState 用于加载状态

const { Option } = Select;

// --- 核心修改：移除了前端的 mockUsers，因为验证将由后端完成 ---

const LoginPage = () => {
    const navigate = useNavigate();
    const { messageApi } = useNotification();
    const [loading, setLoading] = useState(false); // 新增加载状态

    const onFinish = async (values) => {
        setLoading(true); // 开始登录，显示加载状态
        
        try {
            // 1. 向后端API发送POST请求
            const response = await fetch('http://localhost:3001/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(values), // 将表单数据转换为JSON字符串
            });

            // 2. 检查后端响应
            if (response.ok) {
                // 登录成功 (HTTP状态码 200-299)
                const userData = await response.json();
                
                messageApi.success('登录成功!');
                localStorage.setItem('user', JSON.stringify(userData)); // 存储后端返回的用户数据
                navigate('/'); // 跳转到仪表盘

            } else {
                // 登录失败 (例如，HTTP状态码 401)
                const errorData = await response.json();
                messageApi.error(errorData.message || '登录失败，请重试。');
            }

        } catch (error) {
            console.error('登录请求失败:', error);
            messageApi.error('无法连接到服务器，请检查网络或联系管理员。');
        } finally {
            setLoading(false); // 结束登录，隐藏加载状态
        }
    };

    return (
        <div style={{ background: '#f0f2f5', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Card title="供应商与SD信息交换平台" style={{ width: 400 }}>
                <Form name="login_form" onFinish={onFinish}>
                    <Form.Item name="username" rules={[{ required: true, message: '请输入用户名!' }]}>
                        <Input prefix={<UserOutlined />} placeholder="用户名 (philip, xiaobing, etc.)" />
                    </Form.Item>
                    <Form.Item name="password" rules={[{ required: true, message: '请输入密码!' }]}>
                        <Input.Password prefix={<LockOutlined />} placeholder="密码 (都是 '123')" />
                    </Form.Item>
                    <Form.Item name="role" rules={[{ required: true, message: '请选择您的角色!' }]}>
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