// src/Components/notice/ActionPlanReviewDisplay.js

import React from 'react';
import { Collapse, Typography, Space, Divider, Tag } from 'antd';
import { UserOutlined, CalendarOutlined } from '@ant-design/icons';
import { EnhancedImageDisplay } from '../common/EnhancedImageDisplay';

const { Panel } = Collapse;
const { Text, Paragraph } = Typography;

export const ActionPlanReviewDisplay = ({ historyItem }) => {
    // 安全检查，如果传入的数据无效则不渲染任何内容
    if (!historyItem || !Array.isArray(historyItem.actionPlans) || historyItem.actionPlans.length === 0) {
        return <Text type="secondary">（无行动计划详情）</Text>;
    }

    const safeText = (val) => {
        if (val == null) return '';
        if (typeof val === 'object' && 'richText' in val) return val.richText;
        return String(val);
    };

    return (
        <Collapse defaultActiveKey={['0']} style={{ marginTop: '12px' }}>
            {historyItem.actionPlans.map((plan, index) => (
                <Panel
                    key={index}
                    header={
                        <Text strong>
                            {`行动项 #${index + 1}: ${safeText(plan.plan)}`}
                        </Text>
                    }
                >
                    {/* ===== 计划详情 ===== */}
                    <Space size="large" wrap>
                        <Text type="secondary"><UserOutlined style={{ marginRight: 8 }} />负责人: {plan.responsible || '未指定'}</Text>
                        <Text type="secondary"><CalendarOutlined style={{ marginRight: 8 }} />截止日期: {plan.deadline || '未指定'}</Text>
                    </Space>
                    
                    <Divider style={{ margin: '12px 0' }} />

                    {/* ===== 证据详情 (仅在有证据时显示) ===== */}
                    {historyItem.type === 'supplier_evidence_submission' && (
                        <div>
                            <Paragraph>
                                <Text strong>完成情况说明:</Text>
                                <br />
                                <Text type="secondary">{safeText(plan.evidenceDescription) || "（供应商未提供文字说明）"}</Text>
                            </Paragraph>

                            <EnhancedImageDisplay 
                                images={plan.evidenceImages} 
                                title="图片证据" 
                                size="large"
                                showTitle={true}
                            />
                        </div>
                    )}
                </Panel>
            ))}
        </Collapse>
    );
};