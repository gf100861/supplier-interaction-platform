import React from 'react';
import { List, Tag, Button, Typography, Collapse, Space, Checkbox, Popconfirm, theme,Tooltip } from 'antd';
import { FileTextOutlined, ProfileOutlined, EyeOutlined } from '@ant-design/icons';

const { Text } = Typography;

// --- 子组件：单个通知单 ---
const getStatusTag = (status) => {
    let color;
    switch (status) {
        case '待供应商处理':
            color = 'processing'; // 蓝色
            break;
        case '待供应商上传证据':
            color = 'warning'; // 橙色
            break;
        case '待SD审核':
        case '待SD关闭':
            color = 'purple'; // 紫色
            break;
        case '已完成':
            color = 'success'; // 绿色
            break;
        case '已作废':
            color = 'default'; // 灰色
            break;
        default:
            color = 'default';
    }
    return <Tag color={color}>{status}</Tag>;
};


const SingleNoticeItem = ({ item, getActionsForItem, showDetailsModal, handleReviewToggle, token, currentUser, noticeCategoryDetails }) => {
    
    // --- 核心修正：在使用前，进行一次安全检查，防止极端情况下的崩溃 ---
     const displayTitle = (item.title && typeof item.title === 'object') 
        ? item.title.richText 
        : item.title;
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
                style={{ paddingLeft: '24px' }}
                avatar={<FileTextOutlined style={{ fontSize: '24px', color: token.colorPrimary }} />}
                title={
                     <Space>
                        <a onClick={() => showDetailsModal(item)}><Text strong>{displayTitle || ''}</Text></a>
                        {item.isReviewed && <Tag color="green" icon={<EyeOutlined />}>已审阅</Tag>}
                    </Space>
                }
                description={`编号: ${item.noticeCode || item.id} | 指派给: ${item.supplier.shortCode}`}
                
            />
            <Space size="middle">
                <Tag color={categoryInfo.color}>{item.category || '未分类'}</Tag>
                {/* ✨ 调用新函数来显示带颜色的状态 */}
                {getStatusTag(item.status)}
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
                         title={
                                <Tooltip title={batch.representative?.assignedSupplierName || '未知供应商'}>
                                    <Text strong style={{ fontSize: '16px' }}> {batch.representative?.supplier?.shortCode || '未知'}-{batch.representative?.category || '未知'}</Text>
                                </Tooltip>
                            }
                        description={`来自: ${batch.representative?.creator?.username || '未知创建人'} | 创建于: ${batch.representative.sdNotice.createTime.split(' ')[0]}`}
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