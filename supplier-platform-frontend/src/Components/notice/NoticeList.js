import React from 'react';
import { List, Tag, Button, Typography, Collapse, Space, Checkbox, Popconfirm, theme } from 'antd';
import { FileTextOutlined, ProfileOutlined, EyeOutlined } from '@ant-design/icons';

const { Text } = Typography;

// --- 子组件：单个通知单 ---
const SingleNoticeItem = ({ item, getActionsForItem, showDetailsModal, handleReviewToggle, token, currentUser, noticeCategoryDetails }) => {
    
    // --- 核心修正：在使用前，进行一次安全检查，防止极端情况下的崩溃 ---
    const categoryInfo = (noticeCategoryDetails && noticeCategoryDetails[item.category]) 
        ? noticeCategoryDetails[item.category] 
        : { id: 'N/A', color: 'default' };

    const isReviewable = currentUser && (currentUser.role === 'SD' || currentUser.role === 'Manager') && item.status === '待SD审核证据';

    return (
        <List.Item actions={getActionsForItem(item)}>
            {isReviewable && (
                <Checkbox 
                    checked={item.isReviewed}
                    onChange={(e) => handleReviewToggle(item, e)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ marginRight: '16px' }}
                />
            )}
            <List.Item.Meta
                avatar={<FileTextOutlined style={{ fontSize: '24px', color: token.colorPrimary }} />}
                title={
                    <Space>
                        <a onClick={() => showDetailsModal(item)}><Text strong>{item.title}</Text></a>
                        {item.isReviewed && <Tag color="green" icon={<EyeOutlined />}>已审阅</Tag>}
                    </Space>
                }
                description={`编号: ${item.id} | 指派给: ${item.assignedSupplierName}`}
            />
            <Space size="middle">
                <Tag color={categoryInfo.color}>{item.category || '未分类'}</Tag>
                <Tag color={item.status === '已完成' || item.status === '已作废' ? 'default' : item.status.includes('审核') ? 'warning' : 'processing'}>
                    {item.status}
                </Tag>
            </Space>
        </List.Item>
    );
};
// --- 子组件：批量任务包 ---
const NoticeBatchItem = ({ batch, activeCollapseKeys, setActiveCollapseKeys, ...props }) => (
    <List.Item style={{ display: 'block', padding: 0 }}>
        <Collapse
            bordered={false}
            style={{ width: '100%', backgroundColor: props.token.colorBgLayout }}
            expandIconPosition="end"
            activeKey={activeCollapseKeys}
            onChange={(keys) => setActiveCollapseKeys(keys)}
        >
            <Collapse.Panel
                key={batch.batchId}
                header={
                    <List.Item.Meta
                        avatar={<ProfileOutlined style={{ fontSize: '24px', color: props.token.colorPrimary }} />}
                        title={<Text strong>{`批量任务 (共 ${batch.notices.length} 项)`}</Text>}
                        description={`来自: ${batch.representative.sdNotice.creator} | 创建于: ${batch.representative.sdNotice.createTime.split(' ')[0]}`}
                    />
                }
            >
                 <List
                    dataSource={batch.notices}
                    // 2. Pass all props down to the inner SingleNoticeItem
                    renderItem={notice => <SingleNoticeItem item={notice} {...props} />}
                />
            </Collapse.Panel>
        </Collapse>
    </List.Item>
);

// --- 主组件：通知单列表 ---
export const NoticeList = (props) => {
    return (
        <List
            dataSource={props.data}
            renderItem={item => (
                // 2. Pass all props down to the child components
                item.isBatch 
                    ? <NoticeBatchItem batch={item} {...props} /> 
                    : <SingleNoticeItem item={item} {...props} />
            )}
            locale={{ emptyText: '暂无相关通知单' }}
        />
    );
};