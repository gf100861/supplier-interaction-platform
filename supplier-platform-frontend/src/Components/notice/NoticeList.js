import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { List, Tag, Button, Typography, Collapse, Space, Checkbox, Popconfirm, Tooltip, message, Upload } from 'antd'; // 1. 引入 Upload
// 2. 引入新图标
import { FileTextOutlined, ProfileOutlined, EyeOutlined, SortAscendingOutlined, SortDescendingOutlined, DeleteOutlined, DownloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNotices } from '../../contexts/NoticeContext';
import { useNotification } from '../../contexts/NotificationContext';
// 3. 引入 ExcelJS 和 FileSaver
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const { Text } = Typography;

// --- 子组件：单个通知单 ---
const getStatusTag = (status) => {
    let color;
    switch (status) {
        case '待提交Action Plan':
        case '待供应商处理':
            color = 'processing'; // 蓝色
            break;
        case '待供应商关闭':
            color = 'warning'; // 橙色
            break;
        case '待SD确认':
            color = 'red';
            break;
        case '待SD关闭':
        case '待SD审核计划':
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

    const isReviewable = currentUser && (currentUser.role === 'SD' || currentUser.role === 'Manager') && item.status === '待SD确认证据' && !selectable;


    return (
        <List.Item actions={getActionsForItem(item)}>
            {selectable && (
                <Checkbox
                    checked={selected}
                    onChange={(e) => onSelectChange(item.id, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ marginRight: '16px' }}
                />
            )}
            {isReviewable && (
                <Checkbox
                    checked={item.isReviewed}
                    onChange={(e) => handleReviewToggle(item, e)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ marginRight: '16px' }}
                />
            )}
            <List.Item.Meta
                style={{ paddingLeft: selectable || isReviewable ? '0px' : '24px' }}
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
    const supplierName = batch.representative.supplier?.name || '未知供应商';
    const category = batch.representative?.category || '未知类型';
    const createDate = batch.representative?.sdNotice?.createTime ? dayjs(batch.representative.sdNotice.createTime).format('YYYY-MM-DD') : '未知日期';
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);
    const isRealBatch = batch.batchId.startsWith('BATCH-');
    const titleText = isRealBatch
        ? `批量任务: ${supplierShortCode} - ${category}`
        : `每日任务: ${supplierShortCode}- ${category}`;

    // --- 4. 获取 updateNotice ---
    const { deleteMultipleNotices, updateNotice } = useNotices();
    const [selectedNoticeKeys, setSelectedNoticeKeys] = useState([]);
    const [isDeletingBatchItems, setIsDeletingBatchItems] = useState(false);
    const [isUploading, setIsUploading] = useState(false); // 5. 添加上传状态

    const { messageApi } = useNotification();

    // 6. 重命名为 allowBatchActions
      const allowBatchActions = useMemo(() => {
        // 检查是否所有通知单都处于待处理状态
        const allPending = batch.notices.every(notice => notice.status === '待提交Action Plan' || notice.status === '待供应商处理');
        return allPending && currentUser.role === 'Supplier'; // 只有供应商可以操作
    }, [batch.notices, currentUser]);


    const allowBatchEvidenceUpload = useMemo(() => {
        const allPendingEvidence = batch.notices.every(notice => notice.status === '待供应商关闭');
        // 只有供应商才能上传证据
        return allPendingEvidence && currentUser.role === 'Supplier';
    }, [batch.notices, currentUser]);

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

    const handleBatchDeleteWithinBatch = async () => {
        if (selectedNoticeKeys.length === 0) {
            messageApi.warning('请至少选择一项进行删除。');
            return;
        }
        setIsDeletingBatchItems(true);
        try {
            await deleteMultipleNotices(selectedNoticeKeys);
            messageApi.success(`成功删除了 ${selectedNoticeKeys.length} 条通知单。`);
            setSelectedNoticeKeys([]);
        } catch (error) {
            messageApi.error(`批量删除失败: ${error.message}`);
        } finally {
            setIsDeletingBatchItems(false);
        }
    };

    // --- 7. 新增：下载行动计划模板 ---
    const handleActionDownloadTemplate = async () => {
        messageApi.loading({ content: '正在生成模板...', key: 'template' });
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Batch Action Plan');

            worksheet.mergeCells('A1:F1');
            worksheet.getCell('A1').value = '批量行动计划模板';
            worksheet.getCell('A1').font = { bold: true, size: 16 };

            worksheet.mergeCells('A2:F2');
            worksheet.getCell('A2').value = `批量任务ID: ${batch.batchId}`;

            worksheet.mergeCells('A3:F3');
            worksheet.getCell('A3').value = {
                richText: [{ font: { bold: true, color: { argb: 'FFFF0000' } }, text: '请勿修改 A, B, C 列！请在 D, E, F 列填写内容。如有多个负责人，您可以复制单个通知项到其他行创建。' }]
            };

            worksheet.getRow(5).values = [
                'Notice ID (请勿修改)',
                'Process/Question (问题项)',
                'Finding/Deviation (问题描述)',
                'Action Plan (请填写)',
                'Responsible (请填写)',
                'Deadline (YYYY-MM-DD 请填写)'
            ];
            worksheet.getRow(5).font = { bold: true };
            worksheet.getRow(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F7FF' } };
            worksheet.columns = [
                { key: 'id', width: 38 },
                { key: 'process', width: 40 },
                { key: 'finding', width: 40 },
                { key: 'plan', width: 40 },
                { key: 'responsible', width: 20 },
                { key: 'deadline', width: 20 },
            ];

            // 填充所有问题项
            batch.notices.forEach(notice => {
                worksheet.addRow({
                    id: notice.id,
                    process: notice.title || 'N/A',
                    finding: notice.sdNotice?.details?.finding || notice.sdNotice?.details?.description || 'N/A',
                    plan: '', // 留空给用户
                    responsible: '', // 留空给用户
                    deadline: '' // 留空给用户
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `BatchPlan_${supplierShortCode}_${category}.xlsx`);
            messageApi.success({ content: '模板已开始下载。', key: 'template' });

        } catch (error) {
            console.error("生成模板失败:", error);
            messageApi.error({ content: '模板生成失败，请重试。', key: 'template' });
        }
    };

    // --- 8. 新增：处理行动计划批量上传 ---
    const handleActionExcelUpload = (file) => {
        setIsUploading(true);
        messageApi.loading({ content: '正在解析并批量提交行动计划...', key: 'excelRead' });
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const buffer = e.target.result;
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(buffer);
                const worksheet = workbook.getWorksheet(1);

                const plansByNoticeId = {};
                let processedCount = 0;

                worksheet.eachRow((row, rowNumber) => {
                    if (rowNumber <= 5) return; // 跳过表头

                    const noticeId = row.getCell(1).value?.toString();
                    const planText = row.getCell(4).value?.toString() || '';
                    const responsible = row.getCell(5).value?.toString() || '';
                    const deadlineValue = row.getCell(6).value;

                    // 必须三项都填写才算有效
                    if (noticeId && planText.trim() && responsible.trim() && deadlineValue) {
                        if (!plansByNoticeId[noticeId]) {
                            plansByNoticeId[noticeId] = [];
                        }
                        plansByNoticeId[noticeId].push({
                            plan: planText,
                            responsible: responsible,
                            deadline: dayjs(deadlineValue).format('YYYY-MM-DD') // 格式化日期
                        });
                        processedCount++;
                    }
                });

                if (processedCount === 0) {
                    messageApi.warning({ content: '未在Excel中找到有效的行动计划数据（请确保 Action Plan, Responsible, Deadline 均已填写）。', key: 'excelRead', duration: 4 });
                    setIsUploading(false);
                    return;
                }

                // --- 批量更新 Notice ---
                const updatePromises = Object.keys(plansByNoticeId).map(noticeId => {
                    const notice = batch.notices.find(n => n.id === noticeId);
                    if (!notice) {
                        console.warn(`未在批次中找到 Notice ID: ${noticeId}，跳过。`);
                        return null;
                    }

                    const newHistory = {
                        type: 'supplier_plan_submission',
                        submitter: currentUser.name || currentUser.username,
                        time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                        description: '供应商已批量提交行动计划。',
                        actionPlans: plansByNoticeId[noticeId]
                    };
                    const currentHistory = Array.isArray(notice.history) ? notice.history : [];

                    // 调用从 useNotices() 获取的 updateNotice 函数
                    return updateNotice(noticeId, {
                        status: '待SD确认', // 统一更新状态
                        history: [...currentHistory, newHistory]
                    });
                });

                await Promise.all(updatePromises.filter(Boolean));

                messageApi.success({ content: `成功处理 ${processedCount} 条行动计划，已提交 ${Object.keys(plansByNoticeId).length} 张通知单！`, key: 'excelRead', duration: 4 });
                // 刷新折叠面板
                setActiveCollapseKeys([]);

            } catch (error) {
                console.error("解析或提交Excel失败:", error);
                messageApi.error({ content: `处理失败: ${error.message}`, key: 'excelRead', duration: 4 });
            } finally {
                setIsUploading(false);
            }
        };
        reader.onerror = (error) => {
            messageApi.error({ content: `文件读取失败: ${error.message}`, key: 'excelRead' });
            setIsUploading(false);
        };
        reader.readAsArrayBuffer(file);
        return false; // 阻止 antd 自动上传
    };

    // --- 8. 新增：下载证据模板 ---
    const handleDownloadEvidenceTemplate = async () => {
        messageApi.loading({ content: '正在生成证据模板...', key: 'evidenceTemplate' });
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Batch Evidence Template');

            worksheet.mergeCells('A1:F1');
            worksheet.getCell('A1').value = '批量证据提交模板';
            worksheet.getCell('A1').font = { bold: true, size: 16 };
            worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF8E6' } };

            worksheet.mergeCells('A2:F2');
            worksheet.getCell('A2').value = `批量任务ID: ${batch.batchId}`;

            worksheet.mergeCells('A3:F3');
            worksheet.getCell('A3').value = {
                richText: [{ font: { bold: true, color: { argb: 'FFFF0000' } }, text: '请勿修改 A, B, C, D, E 列！请仅在 F 列填写“完成情况说明”。' }]
            };
            worksheet.mergeCells('A4:F4');
            worksheet.getCell('A4').value = {
                richText: [{ font: { bold: true, color: { argb: 'FFFF0000' } }, text: '图片和附件仍需进入通知单详情页单独上传。' }]
            };

            worksheet.getRow(6).values = [
                'Notice ID (请勿修改)',
                'Problem Finding (供参考)',
                'Approved Action Plan (供参考)',
                'Responsible (供参考)',
                'Deadline (供参考)',
                'Evidence Description (请填写)'
            ];
            worksheet.getRow(6).font = { bold: true };
            worksheet.getRow(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F7FF' } };
            worksheet.columns = [
                { key: 'id', width: 38 },
                { key: 'finding', width: 40 },
                { key: 'plan', width: 40 },
                { key: 'responsible', width: 20 },
                { key: 'deadline', width: 20 },
                { key: 'evidence', width: 50 },
            ];

            // 填充所有已批准的行动计划
            batch.notices.forEach(notice => {
                const lastApprovedPlan = [...(notice.history || [])].reverse().find(h => h.type === 'sd_plan_approval');
                if (lastApprovedPlan && lastApprovedPlan.actionPlans) {
                    lastApprovedPlan.actionPlans.forEach(plan => {
                        worksheet.addRow({
                            id: notice.id,
                            finding: notice.sdNotice?.details?.finding || notice.sdNotice?.details?.description || notice.title || 'N/A',
                            plan: plan.plan,
                            responsible: plan.responsible,
                            deadline: dayjs(plan.deadline).format('YYYY-MM-DD'),
                            evidence: '' // 留空给用户
                        });
                    });
                }
            });

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `BatchEvidence_${supplierShortCode}_${category}.xlsx`);
            messageApi.success({ content: '证据模板已开始下载。', key: 'evidenceTemplate' });

        } catch (error) {
            console.error("生成证据模板失败:", error);
            messageApi.error({ content: '模板生成失败，请重试。', key: 'evidenceTemplate' });
        }
    };

    // --- 9. 新增：处理证据批量上传 ---
    const handleEvidenceExcelUpload = (file) => {
        setIsUploading(true);
        messageApi.loading({ content: '正在解析并批量提交证据...', key: 'excelRead' });
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const buffer = e.target.result;
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(buffer);
                const worksheet = workbook.getWorksheet(1);

                const plansByNoticeId = {};
                let processedCount = 0;

                worksheet.eachRow((row, rowNumber) => {
                    if (rowNumber <= 6) return; // 跳过表头

                    const noticeId = row.getCell(1).value?.toString();
                    const planText = row.getCell(3).value?.toString() || ''; // Action Plan
                    const responsible = row.getCell(4).value?.toString() || ''; // Responsible
                    const deadlineValue = row.getCell(5).value; // Deadline
                    const evidenceDescription = row.getCell(6).value?.toString() || ''; // Evidence

                    // 只要有 Notice ID 和 Evidence Description，就认为有效
                    if (noticeId && evidenceDescription.trim()) {
                        if (!plansByNoticeId[noticeId]) {
                            plansByNoticeId[noticeId] = [];
                        }
                        plansByNoticeId[noticeId].push({
                            plan: planText,
                            responsible: responsible.trim() || '',
                            deadline: deadlineValue ? dayjs(deadlineValue).format('YYYY-MM-DD') : null,
                            evidenceDescription: evidenceDescription.trim(),
                            evidenceImages: [], // Excel 不上传图片
                            evidenceAttachments: [] // Excel 不上传附件
                        });
                        processedCount++;
                    }
                });

                if (processedCount === 0) {
                    messageApi.warning({ content: '未在Excel中找到有效的证据说明数据（请确保 "Evidence Description" 列已填写）。', key: 'excelRead', duration: 4 });
                    setIsUploading(false);
                    return;
                }

                // 批量更新 Notice
                const updatePromises = Object.keys(plansByNoticeId).map(noticeId => {
                    const notice = batch.notices.find(n => n.id === noticeId);
                    if (!notice) {
                        console.warn(`未在批次中找到 Notice ID: ${noticeId}，跳过。`);
                        return null;
                    }

                    const newHistory = {
                        type: 'supplier_evidence_submission',
                        submitter: currentUser.name || currentUser.username,
                        time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                        description: '供应商已批量提交完成证据。',
                        actionPlans: plansByNoticeId[noticeId]
                    };
                    const currentHistory = Array.isArray(notice.history) ? notice.history : [];

                    return updateNotice(noticeId, {
                        status: '待SD关闭', // 统一更新状态
                        history: [...currentHistory, newHistory]
                    });
                });

                await Promise.all(updatePromises.filter(Boolean));

                messageApi.success({ content: `成功处理 ${processedCount} 条证据，已更新 ${Object.keys(plansByNoticeId).length} 张通知单！`, key: 'excelRead', duration: 4 });
                setActiveCollapseKeys([]);

            } catch (error) {
                console.error("解析或提交Excel失败:", error);
                messageApi.error({ content: `处理失败: ${error.message}`, key: 'excelRead', duration: 4 });
            } finally {
                setIsUploading(false);
            }
        };
        reader.onerror = (error) => {
            messageApi.error({ content: `文件读取失败: ${error.message}`, key: 'excelRead' });
            setIsUploading(false);
        };
        reader.readAsArrayBuffer(file);
        return false; // 阻止 antd 自动上传
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
                    {/* --- 9. 核心修改：添加批量操作区域 --- */}
                    {allowBatchActions && (
                        <div style={{ marginBottom: '16px', padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                            {/* 批量删除区域 */}
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

                            {/* 批量行动计划区域 */}
                            <Space>
                                <Button icon={<DownloadOutlined />} onClick={handleActionDownloadTemplate}>
                                    下载行动计划模板
                                </Button>
                                <Upload
                                    beforeUpload={handleActionExcelUpload}
                                    showUploadList={false}
                                    accept=".xlsx, .xls"
                                    disabled={isUploading}
                                >
                                    <Button icon={<FileExcelOutlined />} loading={isUploading}>
                                        上传行动计划
                                    </Button>
                                </Upload>
                            </Space>
                        </div>
                    )}
                    {allowBatchEvidenceUpload && (
                        <div style={{ marginBottom: '16px', padding: '0 16px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                            <Space>
                                <Button icon={<DownloadOutlined />} onClick={handleDownloadEvidenceTemplate}>
                                    下载证据模板
                                </Button>
                                <Upload
                                    beforeUpload={handleEvidenceExcelUpload}
                                    showUploadList={false}
                                    accept=".xlsx, .xls"
                                    disabled={isUploading}
                                >
                                    <Button icon={<FileExcelOutlined />} loading={isUploading}>
                                        上传证据 (仅文本)
                                    </Button>
                                </Upload>
                            </Space>
                        </div>
                    )}

                    <List
                        dataSource={sortedNotices}
                        renderItem={notice => (
                            <SingleNoticeItem
                                item={notice}
                                {...props}
                                selectable={allowBatchActions} // <-- 使用 allowBatchActions
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
                    ? <NoticeBatchItem batch={item} {...props} />
                    : <SingleNoticeItem item={item} selectable={false} {...props} />
            )}
            locale={{ emptyText: '暂无相关通知单' }}
        />
    );
};