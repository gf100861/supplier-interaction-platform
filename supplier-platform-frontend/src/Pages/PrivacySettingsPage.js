import React from 'react';
import { Layout, Typography, Card, Row, Col, Steps, Divider, Alert, Tag, Avatar } from 'antd';
import { 
    SafetyCertificateOutlined, 
    CloudServerOutlined, 
    LockOutlined, 
    EyeInvisibleOutlined,
    FileProtectOutlined,
    GlobalOutlined,
    HeatMapOutlined
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;
const { Content } = Layout;

// 辅助组件：图标背景圆圈
const AvatarIcon = ({ icon, color }) => (
    <div style={{ 
        width: 48, 
        height: 48, 
        borderRadius: 12, 
        background: `${color}15`, // 极淡的背景色
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontSize: 24,
        color: color,
        marginBottom: 16
    }}>
        {icon}
    </div>
);

const PrivacySettingsPage = () => {
    return (
        <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
            <Content style={{ padding: '40px 24px', maxWidth: 1000, margin: '0 auto', width: '100%' }}>
                
                {/* 1. 顶部 Header (更加简洁大气) */}
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <Avatar 
                        size={64} 
                        icon={<HeatMapOutlined />} 
                        style={{ backgroundColor: '#003057', marginBottom: 16, boxShadow: '0 4px 10px rgba(0,48,87,0.2)' }} 
                    />
                    <Title level={2} style={{ margin: '0 0 8px 0', color: '#003057' }}>数据安全与隐私保护说明</Title>
                    <Text type="secondary" style={{ fontSize: 16 }}>
                        了解我们如何通过技术手段与管理规范，全方位守护您的商业机密。
                    </Text>
                </div>

                {/* 2. 主体文档区域 (模拟纸张效果) */}
                <Card 
                    bordered={false} 
                    style={{ 
                        borderRadius: 16, 
                        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                        padding: '24px' // 增加内部边距
                    }}
                >
                    {/* 核心承诺 Alert */}
                    <Alert
                        message={<span style={{ fontSize: 16, fontWeight: 600 }}>安全承诺</span>}
                        description="在供应商互动平台，数据安全是我们的生命线。我们严格遵循 ISO 27001 信息安全管理标准及 PIPL 个人信息保护法，确保您的数据在采集、传输、存储及销毁的全生命周期中均得到最高级别的保护。"
                        type="info"
                        showIcon
                        icon={<SafetyCertificateOutlined style={{ fontSize: 24, color: '#1890ff' }} />}
                        style={{ 
                            marginBottom: 40, 
                            border: '1px solid #91d5ff', 
                            background: '#e6f7ff',
                            borderRadius: 12,
                            padding: '24px 32px'
                        }}
                    />

                    {/* 数据生命周期 */}
                    <div style={{ marginBottom: 60, padding: '0 20px' }}>
                        <Divider orientation="center" style={{ marginBottom: 40 }}>
                            <span style={{ color: '#8c8c8c', fontSize: 14 }}>DATA LIFECYCLE MANAGEMENT</span>
                        </Divider>
                        <Title level={4} style={{ textAlign: 'center', marginBottom: 40 }}>数据全生命周期管理</Title>
                        
                        <Steps 
                            current={1} 
                            // status="process"
                            items={[
                                {
                                    title: '收集 (Collection)',
                                    subTitle: '最小化原则',
                                    description: '仅收集业务必需信息，杜绝过度采集。',
                                    icon: <FileProtectOutlined style={{ fontSize: 20 }} />,
                                },
                                {
                                    title: '传输 (Transit)',
                                    subTitle: '全程加密',
                                    description: 'SSL/TLS 高强度加密通道传输。',
                                    icon: <GlobalOutlined style={{ fontSize: 20 }} />,
                                },
                                {
                                    title: '存储 (Storage)',
                                    subTitle: '云端保险箱',
                                    description: '高可用集群存储，每日自动异地备份。',
                                    icon: <CloudServerOutlined style={{ fontSize: 20 }} />,
                                },
                                {
                                    title: '访问 (Access)',
                                    subTitle: '严格隔离',
                                    description: 'RLS 行级权限控制，数据绝对隔离。',
                                    icon: <LockOutlined style={{ fontSize: 20 }} />,
                                },
                            ]}
                        />
                    </div>

                    {/* 技术保障矩阵 */}
                    <div style={{ marginBottom: 40, background: '#fafafa', padding: '32px', borderRadius: 16 }}>
                        <Title level={4} style={{ marginBottom: 24 }}>硬核技术保障</Title>
                        <Row gutter={[24, 24]}>
                            <Col xs={24} md={12}>
                                <div style={{ display: 'flex', gap: 16 }}>
                                    <AvatarIcon icon={<LockOutlined />} color="#52c41a" />
                                    <div>
                                        <Text strong style={{ fontSize: 16 }}>敏感数据加密</Text>
                                        <Paragraph type="secondary" style={{ marginTop: 4 }}>
                                            密码采用 Bcrypt 哈希算法处理，核心业务数据在数据库底层进行加密存储，即使是系统管理员也无法直接查看明文信息。
                                        </Paragraph>
                                    </div>
                                </div>
                            </Col>
                            <Col xs={24} md={12}>
                                <div style={{ display: 'flex', gap: 16 }}>
                                    <AvatarIcon icon={<EyeInvisibleOutlined />} color="#1890ff" />
                                    <div>
                                        <Text strong style={{ fontSize: 16 }}>行级安全策略 (RLS)</Text>
                                        <Paragraph type="secondary" style={{ marginTop: 4 }}>
                                            我们在数据库内核层面实施了 Row Level Security。这从根本上保证了供应商 A 绝对无法查询到供应商 B 的任何数据。
                                        </Paragraph>
                                    </div>
                                </div>
                            </Col>
                            <Col xs={24} md={12}>
                                <div style={{ display: 'flex', gap: 16 }}>
                                    <AvatarIcon icon={<CloudServerOutlined />} color="#722ed1" />
                                    <div>
                                        <Text strong style={{ fontSize: 16 }}>灾备与恢复</Text>
                                        <Paragraph type="secondary" style={{ marginTop: 4 }}>
                                            支持 PITR (Point-in-Time Recovery) 时间点恢复技术。即使发生极端意外，我们也能将数据无损回滚至任意秒级时刻。
                                        </Paragraph>
                                    </div>
                                </div>
                            </Col>
                            <Col xs={24} md={12}>
                                <div style={{ display: 'flex', gap: 16 }}>
                                    <AvatarIcon icon={<SafetyCertificateOutlined />} color="#faad14" />
                                    <div>
                                        <Text strong style={{ fontSize: 16 }}>操作审计</Text>
                                        <Paragraph type="secondary" style={{ marginTop: 4 }}>
                                            关键的业务操作（如删除、修改）都会被系统审计日志永久记录，确保所有操作可追溯，符合企业合规要求。
                                        </Paragraph>
                                    </div>
                                </div>
                            </Col>
                        </Row>
                    </div>

                    {/* 底部声明 */}
                    <Divider />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            如有任何安全疑问，请联系您的供应商开发 (SD) 经理。
                        </Text>
                        <Tag color="default">政策版本：v2025.10</Tag>
                    </div>
                </Card>

                {/* 底部留白 */}
                <div style={{ height: 40 }}></div>

            </Content>
        </Layout>
    );
};

export default PrivacySettingsPage;