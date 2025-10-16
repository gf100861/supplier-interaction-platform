import React from 'react';
import { Typography, Space, Button, Divider } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

export const ApprovalArea = ({ 
    title, 
    description, 
    onApprove, 
    onReject, 
    approveText, 
    rejectText, 
    actionAreaStyle 
}) => {
    return (
        <div style={actionAreaStyle}>
            <Title level={5}>{title}</Title>
            <Paragraph type="secondary">
                {description || '请审核提交的内容，并执行相应的操作。'}
            </Paragraph>
            <Divider style={{ margin: '16px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Space>
                    <Button 
                        icon={<CloseCircleOutlined />} 
                        onClick={onReject}
                        danger
                    >
                        {rejectText || '驳回'}
                    </Button>
                    <Button 
                        type="primary" 
                        icon={<CheckCircleOutlined />} 
                        onClick={onApprove}
                    >
                        {approveText || '批准'}
                    </Button>
                </Space>
            </div>
        </div>
    );
};