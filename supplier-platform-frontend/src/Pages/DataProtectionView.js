import React from 'react';
import { Card, Typography, Row, Col, Steps, Divider, Tag, Alert } from 'antd';
import { 
    SafetyCertificateOutlined, 
    CloudServerOutlined, 
    LockOutlined, 
    EyeInvisibleOutlined,
    FileProtectOutlined,
    GlobalOutlined
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const DataProtectionView = () => {
    return (
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            
            {/* 1. 顶部核心承诺 */}
            <Alert
                message="我们承诺保护您的商业机密与个人隐私"
                description="在供应商互动平台，数据安全是我们开发与运营的首要原则。我们遵循 ISO 27001 信息安全管理标准及 PIPL 个人信息保护法。"
                type="info"
                showIcon
                icon={<SafetyCertificateOutlined style={{ fontSize: 24, color: '#1890ff' }} />}
                style={{ 
                    marginBottom: 32, 
                    border: '1px solid #91d5ff', 
                    background: '#e6f7ff',
                    borderRadius: 8,
                    padding: '24px'
                }}
            />

            {/* 2. 数据生命周期 (可视化) */}
            <div style={{ marginBottom: 40 }}>
                <Title level={4} style={{ marginBottom: 24, textAlign: 'center' }}>数据全生命周期管理</Title>
                <Steps 
                    current={1} 
                    status="process"
                    items={[
                        {
                            title: '收集',
                            subTitle: '最小化原则',
                            description: '仅收集业务必须的姓名、联系方式及审核证据。',
                            icon: <FileProtectOutlined />,
                        },
                        {
                            title: '传输',
                            subTitle: '全程加密',
                            description: '所有数据通过 SSL/TLS 协议加密传输，防止中途截获。',
                            icon: <GlobalOutlined />,
                        },
                        {
                            title: '存储',
                            subTitle: '安全云端',
                            description: '数据存储于 Supabase 高可用集群，每日自动备份。',
                            icon: <CloudServerOutlined />,
                        },
                        {
                            title: '访问',
                            subTitle: '权限管控',
                            description: '严格的 RLS 行级安全策略，确保供应商只能看到自家数据。',
                            icon: <LockOutlined />,
                        },
                    ]}
                />
            </div>

            <Divider />

            {/* 3. 安全技术矩阵 (卡片网格) */}
            <Title level={4} style={{ marginBottom: 24 }}>我们的安全技术保障</Title>
            <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                    <Card hoverable style={{ height: '100%', borderColor: '#f0f0f0' }}>
                        <Card.Meta 
                            avatar={<AvatarIcon icon={<LockOutlined />} color="#52c41a" />}
                            title="端到端加密"
                            description="您的密码经过 Bcrypt 哈希处理，敏感业务数据在数据库层面进行加密存储，管理员也无法直接查看明文密码。"
                        />
                    </Card>
                </Col>
                <Col xs={24} md={12}>
                    <Card hoverable style={{ height: '100%', borderColor: '#f0f0f0' }}>
                        <Card.Meta 
                            avatar={<AvatarIcon icon={<EyeInvisibleOutlined />} color="#1890ff" />}
                            title="严格的访问控制 (RLS)"
                            description="系统应用了 Row Level Security (行级安全策略)。即使在同一张表中，A供应商绝对无法查询到 B供应商的数据。"
                        />
                    </Card>
                </Col>
                <Col xs={24} md={12}>
                    <Card hoverable style={{ height: '100%', borderColor: '#f0f0f0' }}>
                        <Card.Meta 
                            avatar={<AvatarIcon icon={<CloudServerOutlined />} color="#722ed1" />}
                            title="高可用与灾备"
                            description="主数据库位于高可用区域，支持时间点恢复（PITR）。即使发生意外，我们可以将数据回滚至任意秒级时刻。"
                        />
                    </Card>
                </Col>
                <Col xs={24} md={12}>
                    <Card hoverable style={{ height: '100%', borderColor: '#f0f0f0' }}>
                        <Card.Meta 
                            avatar={<AvatarIcon icon={<SafetyCertificateOutlined />} color="#faad14" />}
                            title="合规与审计"
                            description="关键操作（如删除通知单、修改计划）会被系统日志永久记录。我们会定期进行内审，确保符合合规要求。"
                        />
                    </Card>
                </Col>
            </Row>

            {/* 4. 底部补充说明 */}
            <div style={{ marginTop: 40, background: '#fafafa', padding: 24, borderRadius: 8 }}>
                <Title level={5}>数据使用声明</Title>
                <Paragraph style={{ fontSize: 13, color: '#666' }}>
                    <ul>
                        <li><Text strong>业务改进：</Text> 我们可能会对脱敏后的数据进行统计分析（如常见缺陷类型），以优化审核流程。</li>
                        <li><Text strong>第三方披露：</Text> 除非法律法规要求或经过您的明确授权，我们绝不会将您的原始数据出售或披露给任何无关第三方。</li>
                        <li><Text strong>您的权利：</Text> 您有权通过“导出”功能获取您的数据副本，或联系管理员申请注销账户并清除数据。</li>
                    </ul>
                </Paragraph>
                <div style={{ textAlign: 'right', marginTop: 16 }}>
                    <Tag color="default">最后更新：2025年10月</Tag>
                </div>
            </div>
        </div>
    );
};

// 辅助组件：漂亮的图标背景
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
        color: color
    }}>
        {icon}
    </div>
);

export default DataProtectionView;