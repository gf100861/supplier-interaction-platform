import React, { useState, useMemo } from 'react';
import { List, Tag, Button, Typography, Collapse, Space, Checkbox, Popconfirm,Tooltip} from 'antd'; // 1. Import message
// 2. 引入删除图标
import { FileTextOutlined, ProfileOutlined, EyeOutlined, SortAscendingOutlined, SortDescendingOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNotices } from '../../contexts/NoticeContext';
import { useNotification } from '../../contexts/NotificationContext';
const { Text } = Typography;

// --- 子组件：单个通知单 ---
const getStatusTag = (status) => {
    let color;
    switch (status) {
        case '待提交Action Plan':
            color = 'processing'; // 蓝色
            break;
        case '待供应商关闭':
            color = 'warning'; // 橙色
            break;
        case '待SD确认':
            color = 'red';
            break; // Added break statement
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


const SingleNoticeItem = ({
    item,
    getActionsForItem,
    showDetailsModal,
    handleReviewToggle,
    token,
    currentUser,
    noticeCategoryDetails,
    // --- 3. 添加批量选择相关 props ---
    selectable = false,
    selected = false,
    onSelectChange = () => { }
}) => {

    const displayTitle = (item.title && typeof item.title === 'object')
        ? item.title.richText
        : item.title;
    const categoryInfo = (noticeCategoryDetails && noticeCategoryDetails[item.category])
        ? noticeCategoryDetails[item.category]
        : { id: 'N/A', color: 'default' };

    const isReviewable = currentUser && (currentUser.role === 'SD' || currentUser.role === 'Manager') && item.status === '待SD确认证据';

    return (
        <List.Item actions={getActionsForItem(item)}>
            {/* --- 4. 添加用于批量选择的 Checkbox --- */}
            {selectable && (
                <Checkbox
                    checked={selected}
                    onChange={(e) => onSelectChange(item.id, e.target.checked)}
                    onClick={(e) => e.stopPropagation()} // 防止点击 Checkbox 时触发 List.Item 的点击事件
                    style={{ marginRight: '16px' }}
                />
            )}
            {/* --- (可选) 为 SD/Manager 添加审阅 Checkbox --- */}
            {isReviewable && !selectable && (
                <Checkbox
                    checked={item.isReviewed}
                    onChange={(e) => handleReviewToggle(item, e)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ marginRight: '16px' }}
                />
            )}
            <List.Item.Meta
                style={{ paddingLeft: selectable || isReviewable ? '0px' : '24px' }} // 根据是否有 Checkbox 调整内边距
                avatar={<FileTextOutlined style={{ fontSize: '24px', color: token.colorPrimary }} />}
                title={
                    <Space>
                        <a onClick={() => showDetailsModal(item)}><Text strong>{displayTitle || ''}</Text></a>
                        {item.isReviewed && <Tag color="green" icon={<EyeOutlined />}>已审阅</Tag>}
                    </Space>
                }
            />
            <Space size="middle">
                <Tag color={categoryInfo.color}>{item.category || '未分类'}</Tag>
                {getStatusTag(item.status)}
            </Space>
        </List.Item>
    );
};

const NoticeBatchItem = ({ batch, activeCollapseKeys, setActiveCollapseKeys, ...props }) => {

    const [sortOrder, setSortOrder] = useState('default');
    const supplierShortCode = batch.representative?.supplier?.shortCode || '未知';
    const supplierName = batch.representative.supplier?.name || '未知供应商'; // Corrected access
    const category = batch.representative?.category || '未知类型';
    const createDate = batch.representative?.sdNotice?.createTime ? dayjs(batch.representative.sdNotice.createTime).format('YYYY-MM-DD') : '未知日期';
    const isRealBatch = batch.batchId.startsWith('BATCH-');
    const titleText = isRealBatch
        ? `批量任务: ${supplierShortCode} - ${category}`
        : `每日任务: ${supplierShortCode}- ${category}`;

    // --- 5. 从 props 中获取 deleteMultipleNotices ---
    const { notices, deleteMultipleNotices } = useNotices();
    const [selectedNoticeKeys, setSelectedNoticeKeys] = useState([]); // 存储选中的子项 ID
    const [isDeletingBatchItems, setIsDeletingBatchItems] = useState(false); // 删除加载状态

    const { messageApi } = useNotification();

    const allowBatchDelete = useMemo(() => {

        return batch.notices.every(notice => notice.status === '待提交Action Plan' || notice.status === '待供应商处理'); // Also allow '待供应商处理' for flexibility

    }, [batch.notices]);

    const sortedNotices = useMemo(() => {
        const noticesToSort = [...batch.notices];
        if (sortOrder === 'asc') {
            return noticesToSort.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        }
        if (sortOrder === 'desc') {
            return noticesToSort.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
        }
        return noticesToSort;
    }, [batch.notices, sortOrder]);

    const handleSort = (order) => {
        setSortOrder(prevOrder => prevOrder === order ? 'default' : order);
    };

    // --- 6. 子项选择逻辑 ---
    const handleSelectChange = (noticeId, checked) => {
        setSelectedNoticeKeys(prevKeys =>
            checked ? [...prevKeys, noticeId] : prevKeys.filter(key => key !== noticeId)
        );
    };

    const handleSelectAll = (e) => {
        const checked = e.target.checked;
        if (checked) {
            setSelectedNoticeKeys(sortedNotices.map(n => n.id));
        } else {
            setSelectedNoticeKeys([]);
        }
    };

    // --- 7. 批量删除内部项的逻辑 ---
    const handleBatchDeleteWithinBatch = async () => {
        if (selectedNoticeKeys.length === 0) {
            messageApi.warning('请至少选择一项进行删除。');
            return;
        }
        setIsDeletingBatchItems(true);
        try {
            await deleteMultipleNotices(selectedNoticeKeys);
            messageApi.success(`成功删除了 ${selectedNoticeKeys.length} 条通知单。`);
            setSelectedNoticeKeys([]); // 清空选择
            // 注意：这里需要父组件在删除后重新获取数据或更新状态，以反映列表变化

        } catch (error) {
            messageApi.error(`批量删除失败: ${error.message}`);

        } finally {
            setIsDeletingBatchItems(false);
        }
    };

    const isAllSelected = sortedNotices.length > 0 && selectedNoticeKeys.length === sortedNotices.length;
    const isIndeterminate = selectedNoticeKeys.length > 0 && selectedNoticeKeys.length < sortedNotices.length;


    return (
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
                                <Space align="center">
                                    <Tooltip title={isRealBatch ? `${supplierName} - ${category}` : `${supplierName} - ${createDate}`}>
                                        <Text strong style={{ fontSize: '16px' }}>
                                            {titleText}
                                        </Text>
                                    </Tooltip>
                                    {batch.notices.length > 1 && (
                                        <>
                                            <Tooltip title="按标题升序排列">
                                                <Button type={sortOrder === 'asc' ? 'primary' : 'text'} size="small" shape="circle" icon={<SortAscendingOutlined />} onClick={(e) => { e.stopPropagation(); handleSort('asc'); }} />
                                            </Tooltip>
                                            <Tooltip title="按标题降序排列">
                                                <Button type={sortOrder === 'desc' ? 'primary' : 'text'} size="small" shape="circle" icon={<SortDescendingOutlined />} onClick={(e) => { e.stopPropagation(); handleSort('desc'); }} />
                                            </Tooltip>
                                        </>
                                    )}
                                </Space>
                            }
                            description={`通知日期: ${createDate} | (共 ${batch.notices.length} 项)`}
                        />
                    }
                >
                    {/* --- 8. 添加批量删除操作栏 --- */}

                    {allowBatchDelete && (
                        <div style={{ marginBottom: '16px', padding: '0 16px' }}>
                            <Space>
                                <Checkbox
                                    indeterminate={isIndeterminate}
                                    onChange={handleSelectAll}
                                    checked={isAllSelected}
                                >
                                    全选
                                </Checkbox>
                                <Popconfirm
                                    title={`确定要删除选中的 ${selectedNoticeKeys.length} 项吗？`}
                                    onConfirm={handleBatchDeleteWithinBatch}
                                    okText="确认删除"
                                    cancelText="取消"
                                    disabled={selectedNoticeKeys.length === 0 || isDeletingBatchItems}
                                >
                                    <Button
                                        danger
                                        icon={<DeleteOutlined />}
                                        disabled={selectedNoticeKeys.length === 0 || isDeletingBatchItems}
                                        loading={isDeletingBatchItems}
                                    >
                                        删除选中项
                                    </Button>
                                </Popconfirm>
                                {selectedNoticeKeys.length > 0 && <Text type="secondary">已选择 {selectedNoticeKeys.length} 项</Text>}
                            </Space>
                        </div>
                    )}

                    <List
                        dataSource={sortedNotices}
                        renderItem={notice => (
                            <SingleNoticeItem
                                item={notice}
                                {...props}
                                // --- 9. 传递选择相关的 props ---
                                selectable={allowBatchDelete}
                                selected={selectedNoticeKeys.includes(notice.id)}
                                onSelectChange={handleSelectChange}
                            />
                        )}
                    />
                </Collapse.Panel>
            </Collapse>
        </List.Item>
    );
};

// --- 主组件：通知单列表 ---
export const NoticeList = (props) => {
    return (
        <List
            dataSource={props.data}
            renderItem={item => (
                item.isBatch
                    // --- 10. 确保将所有 props (包括 deleteMultipleNotices) 传递给 NoticeBatchItem ---
                    ? <NoticeBatchItem batch={item} {...props} />
                    : <SingleNoticeItem item={item} selectable={false} {...props} />
            )}
            locale={{ emptyText: '暂无相关通知单' }}
        />
    );
};
