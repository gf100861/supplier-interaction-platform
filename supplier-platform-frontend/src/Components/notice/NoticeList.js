import React, { useState, useMemo, useEffect } from 'react';
import { List, Tag, Button, Typography, Collapse, Space, Checkbox, Popconfirm, Tooltip, message, Upload, Grid, Card, Dropdown } from 'antd';
import {
    FileTextOutlined, ProfileOutlined, EyeOutlined, SortAscendingOutlined,
    SortDescendingOutlined, DeleteOutlined, DownloadOutlined, FileExcelOutlined,
    MoreOutlined, CalendarOutlined, UserOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNotices } from '../../contexts/NoticeContext';
import { useNotification } from '../../contexts/NotificationContext';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const { Text, Paragraph } = Typography;
const { useBreakpoint } = Grid;

// ... (HighlightText, getStatusTag, toPlainText functions remain unchanged)
const HighlightText = ({ text, keyword }) => {
    const strText = String(text || '');
    if (!keyword || !keyword.trim()) {
        return <>{strText}</>;
    }
    const keywords = keyword.toLowerCase().split(/[；;@,，\s]+/).filter(k => k.trim());
    if (keywords.length === 0) return <>{strText}</>;
    const escapedKeywords = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escapedKeywords.join('|')})`, 'gi');
    const parts = strText.split(regex);
    return (
        <span>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <span key={i} style={{ backgroundColor: '#ffc069', color: '#000', padding: '0 2px', borderRadius: '2px' }}>
                        {part}
                    </span>
                ) : part
            )}
        </span>
    );
};

const getStatusTag = (status) => {
    let color;
    switch (status) {
        case '待提交Action Plan':
        case '待供应商处理': color = 'processing'; break;
        case '待供应商关闭': color = 'warning'; break;
        case '待SD确认actions': color = 'red'; break;
        case '待SD关闭evidence' || '待SD审核关闭': color = 'orange'; break;
        case '待SD审核计划': color = 'purple'; break;
        case '已完成': color = 'success'; break;
        case '已作废': color = 'default'; break;
        default: color = 'default';
    }
    return <Tag color={color} style={{ marginRight: 0 }}>{status}</Tag>;
};

const toPlainText = (val) => {
    if (val == null) return '';
    if (typeof val === 'object' && val.richText) return val.richText.map(r => r?.text || '').join('');
    if (typeof val === 'object' && Array.isArray(val.richText)) return val.richText.map(r => r?.text || '').join('');
    if (typeof val === 'object' && typeof val.richText === 'string') return val.richText;
    return String(val);
};

// --- SingleNoticeItem (Unchanged) ---
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
    onSelectChange = () => { },
    searchTerm = ''
}) => {
    const screens = useBreakpoint();
    const isMobile = !screens.md;

    const getChineseOnly = (text = '') => text.match(/[\u4e00-\u9fa5]/g)?.join('') || '';
    const plainTitle = toPlainText(item.title);
    const chineseTitle = getChineseOnly(plainTitle)?.trim();
    const rawTitle = item.category === 'Historical 8D' && chineseTitle.length > 0 ? chineseTitle : plainTitle;

    const categoryInfo = (noticeCategoryDetails && noticeCategoryDetails[item.category])
        ? noticeCategoryDetails[item.category]
        : { id: 'N/A', color: 'orange' };

    const plainDetails = toPlainText(item.details?.rootCause || item.sdNotice?.details?.finding || item.sdNotice?.description);
    const highlightText = item.category === 'Historical 8D' && getChineseOnly(plainDetails) ? getChineseOnly(plainDetails) : plainDetails;

    const isReviewable = currentUser && (currentUser.role === 'SD' || currentUser.role === 'Manager') && item.status === '待SD确认证据' && !selectable;

    if (isMobile) {
        return (
            <div style={{
                padding: '12px',
                borderBottom: '1px solid #f0f0f0',
                backgroundColor: '#fff',
                position: 'relative'
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 8 }}>
                    {(selectable || isReviewable) && (
                        <Checkbox
                            checked={selectable ? selected : item.isReviewed}
                            onChange={(e) => selectable ? onSelectChange(item.id, e.target.checked) : handleReviewToggle(item, e)}
                            style={{ marginTop: 4, marginRight: 12 }}
                        />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                            <Text strong style={{ fontSize: '15px', lineHeight: 1.4, marginRight: 8 }} ellipsis={{ rows: 2 }}>
                                <HighlightText text={rawTitle} keyword={searchTerm} />
                            </Text>
                            <div style={{ flexShrink: 0, transform: 'scale(0.9)', transformOrigin: 'top right' }}>
                                {getStatusTag(item.status)}
                            </div>
                        </div>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                            <HighlightText text={item.noticeCode} keyword={searchTerm} />
                        </Text>
                    </div>
                </div>
                <div style={{ marginBottom: 8, paddingLeft: (selectable || isReviewable) ? 28 : 0 }}>
                    <Paragraph type="secondary" ellipsis={{ rows: 2, expandable: false }} style={{ fontSize: '13px', margin: 0 }}>
                        <HighlightText text={highlightText} keyword={searchTerm} />
                    </Paragraph>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: (selectable || isReviewable) ? 28 : 0 }}>
                    <Tag color={categoryInfo.color} style={{ fontSize: '12px', lineHeight: '20px' }}>
                        {item.category || '未分类'}
                    </Tag>
                    <div style={{ display: 'flex' }}>
                        {/* 使用 filter 过滤掉 key 为 'edit' (修改) 和 'correct' (修正/撤回) 的按钮 */}
                        {getActionsForItem(item).filter(action =>
                            action.key !== 'edit' && action.key !== 'correct'
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <List.Item
            actions={getActionsForItem(item)}
            style={{
                padding: '12px 24px',
                alignItems: 'center',
                display: 'flex'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden' }}>
                {(selectable || isReviewable) && (
                    <Checkbox
                        checked={selectable ? selected : item.isReviewed}
                        onChange={(e) => selectable ? onSelectChange(item.id, e.target.checked) : handleReviewToggle(item, e)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ marginRight: '16px' }}
                    />
                )}
                <FileTextOutlined style={{ fontSize: '24px', color: token.colorPrimary, marginRight: '16px', flexShrink: 0 }} />
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <a onClick={() => showDetailsModal(item)} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Text strong><HighlightText text={rawTitle} keyword={searchTerm} /></Text>
                        </a>
                        {item.isReviewed && <Tag color="green" icon={<EyeOutlined />} style={{ margin: 0 }}>已审阅</Tag>}
                        <Text type="secondary" style={{ fontSize: '12px', flexShrink: 0 }}>
                            (<HighlightText text={item.noticeCode} keyword={searchTerm} />)
                        </Text>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                        <div style={{
                            color: 'rgba(0, 0, 0, 0.45)',
                            fontSize: '14px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            flex: 1
                        }}>
                            <HighlightText text={highlightText} keyword={searchTerm} />
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                            <Tag color={categoryInfo.color} style={{ margin: 0 }}>{item.category || '未分类'}</Tag>
                            {getStatusTag(item.status)}
                        </div>
                    </div>
                </div>
            </div>
        </List.Item>
    );
};

const NoticeBatchItem = ({ batch, activeCollapseKeys, setActiveCollapseKeys, ...props }) => {
    const screens = useBreakpoint();
    const isMobile = !screens.md;

    const [sortOrder, setSortOrder] = useState('default');
    const supplierShortCode = batch.representative?.supplier?.shortCode || '未知';
    const category = batch.representative?.category || '未知类型';
    const sdNotice = batch.representative?.sdNotice;
    const createDate = sdNotice?.createTime
        ? dayjs(sdNotice.createTime).format('YYYY-MM-DD')
        : sdNotice?.planSubmitTime
            ? sdNotice.planSubmitTime.slice(0, 10)
            : '未知日期';

    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);
    const isRealBatch = batch.batchId.startsWith('BATCH-');

    // 移动端简化标题
    const titleText = isRealBatch
        ? `批量: ${supplierShortCode} - ${category}`
        : `${supplierShortCode} - ${category}`;

    const { deleteMultipleNotices, updateNotice } = useNotices();
    const [selectedNoticeKeys, setSelectedNoticeKeys] = useState([]);
    const [isDeletingBatchItems, setIsDeletingBatchItems] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const { messageApi } = useNotification();

    // ... (toPlainText 保持不变) ...
    const toPlainText = (val) => {
        if (val == null) return '';
        if (typeof val === 'object' && val.richText) return val.richText.map(r => r?.text || '').join('');
        if (typeof val === 'object' && Array.isArray(val.richText)) return val.richText.map(r => r?.text || '').join('');
        if (typeof val === 'object' && typeof val.richText === 'string') return val.richText;
        return String(val);
    };

    // ... (allowBatchActions, allowBatchEvidenceUpload, allowDeletion useMemos 保持不变) ...
    const allowBatchActions = useMemo(() => {
        const allPending = batch.notices.every(notice => notice.status === '待提交Action Plan' || notice.status === '待供应商处理');
        return allPending && currentUser.role === 'Supplier';
    }, [batch.notices, currentUser]);

    const allowBatchEvidenceUpload = useMemo(() => {
        const allPendingEvidence = batch.notices.every(notice => notice.status === '待供应商关闭');
        return allPendingEvidence && currentUser.role === 'Supplier';
    }, [batch.notices, currentUser]);

    const allowDeletion = useMemo(() => {
        const allPending = batch.notices.every(notice => notice.status === '待提交Action Plan' || notice.status === '待供应商处理');
        return allPending && ['SD', 'Manager', 'Admin'].includes(currentUser.role);
    }, [batch.notices, currentUser]);

    // ... (sortedNotices, handleSort, handleSelectChange, handleSelectAll 保持不变) ...
    const sortedNotices = useMemo(() => {
        const noticesToSort = [...batch.notices];
        if (sortOrder === 'asc') return noticesToSort.sort((a, b) => (toPlainText(a.title) || '').localeCompare(toPlainText(b.title) || ''));
        if (sortOrder === 'desc') return noticesToSort.sort((a, b) => (toPlainText(b.title) || '').localeCompare(toPlainText(a.title) || ''));
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
        setSelectedNoticeKeys(checked ? sortedNotices.map(n => n.id) : []);
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

    // --- 下载行动计划模板 ---
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
                richText: [{ font: { bold: true, color: { argb: 'FFFF0000' } }, text: '请勿修改 A, B, C 列！请在 D, E, F 列填写内容。如有多个行动项，您可以复制并粘贴 A, B, C 列的内容到新行。' }]
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
            // worksheet.getRow(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F7FF' } };

            const grayHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } }; // 深灰色
            const blueHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F7FF' } }; // 浅蓝色

            worksheet.getCell('A5').fill = grayHeaderFill;
            worksheet.getCell('B5').fill = grayHeaderFill;
            worksheet.getCell('C5').fill = grayHeaderFill;
            worksheet.getCell('D5').fill = blueHeaderFill;
            worksheet.getCell('E5').fill = blueHeaderFill;
            worksheet.getCell('F5').fill = blueHeaderFill;
            worksheet.columns = [
                { key: 'id', width: 38 },
                { key: 'process', width: 40 },
                { key: 'finding', width: 40 },
                { key: 'plan', width: 40 },
                { key: 'responsible', width: 20 },
                { key: 'deadline', width: 20 },
            ];

            const grayDataFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } }; // 浅灰色

            batch.notices.forEach(notice => {
                const processText = toPlainText(notice.title) || 'N/A';
                const findingText = toPlainText(notice.sdNotice?.details?.finding || notice.sdNotice?.details?.description) || 'N/A';


                worksheet.addRow({
                    id: notice.id,
                    process: processText,
                    finding: findingText,
                    plan: '',
                    responsible: '',
                    deadline: ''
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

    // --- 处理行动计划批量上传 ---
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

                // --- 1. 添加日志：打印表头 ---
                const headers = worksheet.getRow(5).values;
                console.log('[Action Upload] Excel Headers (Row 5):', JSON.stringify(headers));

                worksheet.eachRow((row, rowNumber) => {
                    if (rowNumber <= 5) return; // 跳过表头

                    const noticeId = row.getCell(1).value?.toString();

                    // --- 2. 添加日志：打印原始单元格数据 ---
                    const rawPlanValue = row.getCell(4).value;
                    const rawResponsibleValue = row.getCell(5).value;
                    const rawDeadlineValue = row.getCell(6).value;

                    // 使用 toPlainText 确保能处理富文本
                    const planText = toPlainText(rawPlanValue)?.toString() || '';
                    const responsible = toPlainText(rawResponsibleValue)?.toString() || '';
                    const deadlineValue = rawDeadlineValue; // 日期对象或字符串

                    // --- 4. 核心修正：仅要求 Action Plan 必填 ---
                    if (noticeId && planText.trim() && responsible.trim() && deadlineValue) {
                        if (!plansByNoticeId[noticeId]) {
                            plansByNoticeId[noticeId] = [];
                        }

                        plansByNoticeId[noticeId].push({
                            plan: planText.trim(),
                            responsible: responsible.trim(), // 允许为空
                            deadline: dayjs(deadlineValue).format('YYYY-MM-DD')// 允许为空
                        });
                        processedCount++;
                    }
                });

                console.log(`[Action Upload] Total processed rows: ${processedCount}`);

                if (processedCount === 0) {
                    messageApi.warning({ content: '未在Excel中找到有效的行动计划数据（请确保 "Action Plan","Responsable"和"Deadline" 列已填写）。', key: 'excelRead', duration: 4 });
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

                    return updateNotice(noticeId, {
                        status: '待SD确认actions',
                        history: [...currentHistory, newHistory]
                    });
                });

                await Promise.all(updatePromises.filter(Boolean));

                messageApi.success({ content: `成功处理 ${processedCount} 条行动计划，已提交 ${Object.keys(plansByNoticeId).length} 张通知单！`, key: 'excelRead', duration: 4 });
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
        return false;
    };

    // --- 下载证据模板 ---
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

            batch.notices.forEach(notice => {
                const lastApprovedPlan = [...(notice.history || [])].reverse().find(h => h.type === 'sd_plan_approval');
                if (lastApprovedPlan && lastApprovedPlan.actionPlans) {
                    const findingText = toPlainText(notice.sdNotice?.details?.finding || notice.sdNotice?.details?.description || notice.title) || 'N/A';
                    lastApprovedPlan.actionPlans.forEach(plan => {
                        worksheet.addRow({
                            id: notice.id,
                            finding: findingText,
                            plan: toPlainText(plan.plan),
                            responsible: plan.responsible,
                            deadline: dayjs(plan.deadline).format('YYYY-MM-DD'),
                            evidence: ''
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

    // --- 处理证据批量上传 ---
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

                // --- 5. 添加日志：打印表头 ---
                const headers = worksheet.getRow(6).values;

                worksheet.eachRow((row, rowNumber) => {
                    if (rowNumber <= 6) return;

                    const noticeId = row.getCell(1).value?.toString();
                    const planText = row.getCell(3).value?.toString() || '';
                    const responsible = row.getCell(4).value?.toString() || '';
                    const deadlineValue = row.getCell(5).value;

                    // --- 6. 添加日志：打印原始单元格数据 ---
                    const rawEvidenceValue = row.getCell(6).value;
                    const evidenceDescription = toPlainText(rawEvidenceValue)?.toString() || '';

                    // --- 7. 核心修正：仅要求 Evidence Description 必填 ---
                    if (noticeId && evidenceDescription.trim()) {
                        if (!plansByNoticeId[noticeId]) {
                            plansByNoticeId[noticeId] = [];
                        }
                        plansByNoticeId[noticeId].push({
                            plan: planText,
                            responsible: responsible.trim() || '',
                            deadline: deadlineValue ? dayjs(deadlineValue).format('YYYY-MM-DD') : null,
                            evidenceDescription: evidenceDescription.trim(),
                            evidenceImages: [],
                            evidenceAttachments: []
                        });
                        processedCount++;
                    }
                });

                console.log(`[Evidence Upload] Total processed rows: ${processedCount}`);

                if (processedCount === 0) {
                    messageApi.warning({ content: '未在Excel中找到有效的证据说明数据（请确保 "Evidence Description" 列已填写）。', key: 'excelRead', duration: 4 });
                    setIsUploading(false);
                    return;
                }

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
                        status: '待SD关闭evidence',
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
        return false;
    };

    const isAllSelected = sortedNotices.length > 0 && selectedNoticeKeys.length === sortedNotices.length;
    const isIndeterminate = selectedNoticeKeys.length > 0 && selectedNoticeKeys.length < sortedNotices.length;

    // --- 批量操作按钮渲染函数 (响应式适配) ---
    const renderBatchActions = () => {
        // 定义通用的按钮样式
        const btnStyle = isMobile ? { width: '100%', marginBottom: 8 } : {};
        const containerStyle = isMobile
            ? { padding: '16px', display: 'flex', flexDirection: 'column' }
            : { marginBottom: '16px', padding: '0 16px', display: 'flex', justifyContent: 'flex-end', gap: '16px' };

        if (allowBatchActions) {
            return (
                <div style={containerStyle}>
                    <Button icon={<DownloadOutlined />} onClick={handleActionDownloadTemplate} style={btnStyle}>
                        下载行动计划模板
                    </Button>
                    <Upload
                        beforeUpload={handleActionExcelUpload}
                        showUploadList={false}
                        accept=".xlsx, .xls"
                        disabled={isUploading}
                        style={{ width: isMobile ? '100%' : 'auto' }}
                    >
                        <Button type="primary" icon={<FileExcelOutlined />} loading={isUploading} style={btnStyle} block={isMobile}>
                            上传行动计划
                        </Button>
                    </Upload>
                </div>
            );
        }

        if (allowBatchEvidenceUpload) {
            return (
                <div style={containerStyle}>
                    <Button icon={<DownloadOutlined />} onClick={handleDownloadEvidenceTemplate} style={btnStyle}>
                        下载证据模板
                    </Button>
                    <Upload
                        beforeUpload={handleEvidenceExcelUpload}
                        showUploadList={false}
                        accept=".xlsx, .xls"
                        disabled={isUploading}
                        style={{ width: isMobile ? '100%' : 'auto' }}
                    >
                        <Button type="primary" icon={<FileExcelOutlined />} loading={isUploading} style={btnStyle} block={isMobile}>
                            上传证据 (仅文本)
                        </Button>
                    </Upload>
                </div>
            );
        }
        return null;
    };

    return (
        <List.Item style={{ display: 'block', padding: 0, marginBottom: 16 }}>
            <Collapse
                bordered={false}
                style={{ width: '100%', backgroundColor: props.token.colorBgLayout, borderRadius: 8 }}
                expandIconPosition="end"
                activeKey={activeCollapseKeys}
                onChange={(keys) => setActiveCollapseKeys(keys)}
            >
                <Collapse.Panel
                    key={batch.batchId}
                    header={
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <ProfileOutlined style={{ fontSize: isMobile ? '20px' : '24px', color: props.token.colorPrimary, marginRight: 12 }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Text strong style={{ fontSize: isMobile ? '14px' : '16px' }}>
                                        {batch.batchId.startsWith('BATCH-') ? `批量: ${batch.representative?.supplier?.shortCode || '未知'} - ${batch.representative?.category || '未知'}` : `${batch.representative?.supplier?.shortCode} - ${batch.representative?.category}`}
                                    </Text>
                                </div>
                                <div style={{ fontSize: '12px', color: '#888', marginTop: 4 }}>
                                    <CalendarOutlined style={{ marginRight: 4 }} />
                                    {batch.representative?.sdNotice?.createTime ? dayjs(batch.representative.sdNotice.createTime).format('YYYY-MM-DD') : '未知日期'}
                                    <span style={{ margin: '0 8px' }}>|</span>
                                    共 {batch.notices.length} 项
                                </div>
                            </div>
                        </div>
                    }
                >
                    {/* 批量删除 (SD/Manager/Admin) */}
                    {allowDeletion && (
                        <div style={{ padding: '0 16px 16px', borderBottom: '1px solid #eee' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Checkbox
                                    indeterminate={isIndeterminate}
                                    onChange={handleSelectAll}
                                    checked={isAllSelected}
                                >
                                    全选
                                </Checkbox>
                                <Space>
                                    {selectedNoticeKeys.length > 0 && <Text type="secondary" style={{ fontSize: '12px' }}>已选 {selectedNoticeKeys.length}</Text>}
                                    <Popconfirm
                                        title={`删除 ${selectedNoticeKeys.length} 项?`}
                                        onConfirm={handleBatchDeleteWithinBatch}
                                        okText="是"
                                        cancelText="否"
                                        disabled={selectedNoticeKeys.length === 0 || isDeletingBatchItems}
                                    >
                                        <Button
                                            danger
                                            size="small"
                                            icon={<DeleteOutlined />}
                                            disabled={selectedNoticeKeys.length === 0 || isDeletingBatchItems}
                                            loading={isDeletingBatchItems}
                                        >
                                            删除
                                        </Button>
                                    </Popconfirm>
                                </Space>
                            </div>
                        </div>
                    )}

                    {/* 批量操作区域 (下载/上传) */}
                    {renderBatchActions()}

                    <List
                        dataSource={sortedNotices}
                        renderItem={notice => (
                            <SingleNoticeItem
                                item={notice}
                                {...props}
                                selectable={allowDeletion}
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

// --- 主组件 ---
export const NoticeList = (props) => {
    // 提示：父组件(NoticePage)应该负责处理 filter 的UI (如 DatePicker)
    // 这里仅负责展示列表。
    // 如果 props.data 是空，显示 Empty 状态
    return (
        <List
            dataSource={props.data}
            pagination={props.pagination}
            split={false} // 移除默认分割线，使用组件内部的 border/margin
            renderItem={item => (
                item.isBatch
                    ? <NoticeBatchItem batch={item} {...props} searchTerm={props.searchTerm} />
                    : <SingleNoticeItem item={item} selectable={false} {...props} searchTerm={props.searchTerm} />
            )}
            locale={{ emptyText: '暂无相关通知单' }}
            style={{ backgroundColor: 'transparent' }} // 列表背景透明
        />
    );
};