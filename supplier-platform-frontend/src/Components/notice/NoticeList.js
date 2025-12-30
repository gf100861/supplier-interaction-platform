import React, { useState, useMemo, useEffect } from 'react';
import { List, Tag, Button, Typography, Collapse, Space, Checkbox, Popconfirm, Tooltip, message, Upload } from 'antd';
import { FileTextOutlined, ProfileOutlined, EyeOutlined, SortAscendingOutlined, SortDescendingOutlined, DeleteOutlined, DownloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNotices } from '../../contexts/NoticeContext';
import { useNotification } from '../../contexts/NotificationContext';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';


const { Text } = Typography;

// --- 1. 新增：高亮文本辅助组件 ---
// 支持多关键词 (例如用逗号分隔的)
const HighlightText = ({ text, keyword }) => {
    const strText = String(text || '');
    if (!keyword || !keyword.trim()) {
        return <>{strText}</>;
    }

    // 1. 将搜索词按分隔符拆分为数组，并过滤空值
    const keywords = keyword.toLowerCase().split(/[；;@,，\s]+/).filter(k => k.trim());
    if (keywords.length === 0) return <>{strText}</>;

    // 2. 构建正则：(keyword1|keyword2|...)，注意转义特殊字符
    const escapedKeywords = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escapedKeywords.join('|')})`, 'gi');

    // 3. 拆分并高亮
    const parts = strText.split(regex);

    return (
        <span>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <span key={i} style={{ backgroundColor: '#ffc069', color: '#000', padding: '0 2px', borderRadius: '2px' }}>
                        {part}
                    </span>
                ) : (
                    part
                )
            )}
        </span>
    );
};

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
        case '待SD确认actions':
            color = 'red';
            break;
        case '待SD关闭evidence':
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

const toPlainText = (val) => {
    if (val == null) return '';
    if (typeof val === 'object' && val.richText) {
        return val.richText.map(r => r?.text || '').join('');
    }
    if (typeof val === 'object' && Array.isArray(val.richText)) {
        return val.richText.map(r => r?.text || '').join('');
    }
    if (typeof val === 'object' && typeof val.richText === 'string') {
        return val.richText;
    }
    return String(val);
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
    onSelectChange = () => { },
    searchTerm = '' // --- 2. 接收 searchTerm ---
}) => {

    const getChineseOnly = (text = '') =>
        text.match(/[\u4e00-\u9fa5]/g)?.join('') || '';

    // 获取纯文本标题用于高亮
    const plainTitle = toPlainText(item.title);
    const chineseTitle = getChineseOnly(plainTitle)?.trim();

    const rawTitle =
        item.category === 'Historical 8D' && chineseTitle.length > 0
            ? chineseTitle
            : plainTitle;

    // const rawTitle = item.category === 'Historical 8D' ? getChineseOnly(toPlainText(item.title)) : toPlainText(item.title);

    const categoryInfo = (noticeCategoryDetails && noticeCategoryDetails[item.category])
        ? noticeCategoryDetails[item.category]
        : { id: 'N/A', color: 'orange' };

    const plainDetails = toPlainText(
        item.details?.rootCause ||
        item.sdNotice?.details?.finding ||
        item.sdNotice?.description
    );

    const chineseDetails = getChineseOnly(plainDetails)?.trim();

    const highlightText =
        item.category === 'Historical 8D' && chineseDetails
            ? chineseDetails
            : plainDetails;


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
                        <a onClick={() => showDetailsModal(item)}>
                            <Text strong>
                                {/* --- 3. 使用 HighlightText 包裹标题 --- */}
                                <HighlightText text={rawTitle} keyword={searchTerm} />
                            </Text>
                        </a>
                        {item.isReviewed && <Tag color="green" icon={<EyeOutlined />}>已审阅</Tag>}
                        {/* 也可以选择高亮显示编号 */}
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                            (<HighlightText text={item.noticeCode} keyword={searchTerm} />)
                        </Text>
                    </Space>
                }
                // 也可以选择高亮描述
                description={
                    <div style={{ maxHeight: '42px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <HighlightText
                            text={highlightText}
                            keyword={searchTerm}
                        />

                    </div>
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
    // const supplierName = batch.representative.supplier?.name || '未知供应商';
    const category = batch.representative?.category || '未知类型';
    const sdNotice = batch.representative?.sdNotice;
    //三元表达式应用
    const createDate = sdNotice?.createTime
        ? dayjs(sdNotice.createTime).format('YYYY-MM-DD')
        : sdNotice?.planSubmitTime
            ? sdNotice.planSubmitTime.slice(0, 10)
            : '未知日期';
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);
    const isRealBatch = batch.batchId.startsWith('BATCH-');
    const titleText = isRealBatch
        ? `批量任务: ${supplierShortCode} - ${category}`
        : `每日任务: ${supplierShortCode}- ${category}`;

    const { deleteMultipleNotices, updateNotice } = useNotices();
    const [selectedNoticeKeys, setSelectedNoticeKeys] = useState([]);
    const [isDeletingBatchItems, setIsDeletingBatchItems] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const { messageApi } = useNotification();


    // 辅助函数：用于安全地将富文本转为纯文本
    const toPlainText = (val) => {
        if (val == null) return '';
        // 检查 ExcelJS 可能返回的富文本对象
        if (typeof val === 'object' && val.richText) {
            console.log('检测到 Excel RichText:', val);
            return val.richText.map(r => r?.text || '').join('');
        }
        // 检查您系统中存储的富文本对象
        if (typeof val === 'object' && Array.isArray(val.richText)) {
            console.log('检测到 System RichText Array:', val);
            return val.richText.map(r => r?.text || '').join('');
        }
        if (typeof val === 'object' && typeof val.richText === 'string') {
            console.log('检测到 System RichText String:', val);
            return val.richText;
        }
        // 已经是纯文本或数字
        return String(val);
    };

    const allowBatchActions = useMemo(() => {
        const allPending = batch.notices.every(notice => notice.status === '待提交Action Plan' || notice.status === '待供应商处理');
        return allPending && currentUser.role === 'Supplier'; // 只有供应商可以操作
    }, [batch.notices, currentUser]);


    const allowBatchEvidenceUpload = useMemo(() => {
        const allPendingEvidence = batch.notices.every(notice => notice.status === '待供应商关闭');
        return allPendingEvidence && currentUser.role === 'Supplier';
    }, [batch.notices, currentUser]);

    // 修正：SD/Manager/Admin 都可以批量删除
    const allowDeletion = useMemo(() => {
        const allPending = batch.notices.every(notice => notice.status === '待提交Action Plan' || notice.status === '待供应商处理');
        return allPending && ['SD', 'Manager', 'Admin'].includes(currentUser.role);
    }, [batch.notices, currentUser]);


    const sortedNotices = useMemo(() => {
        const noticesToSort = [...batch.notices];
        if (sortOrder === 'asc') {
            return noticesToSort.sort((a, b) => (toPlainText(a.title) || '').localeCompare(toPlainText(b.title) || ''));
        }
        if (sortOrder === 'desc') {
            return noticesToSort.sort((a, b) => (toPlainText(b.title) || '').localeCompare(toPlainText(a.title) || ''));
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

                    // --- 3. 添加日志：打印解析后的每行数据 ---
                    //  console.log(`[Action Upload] Row ${rowNumber}:`, {
                    //     noticeId: noticeId,
                    //     rawPlan: rawPlanValue,
                    //     parsedPlan: planText.trim(),
                    //     rawResp: rawResponsibleValue,
                    //     parsedResp: responsible.trim(),
                    //     rawDeadline: deadlineValue,
                    //     isPlanValid: !!(noticeId && planText.trim()) // <-- 修正后的逻辑
                    // });

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
                console.log('[Evidence Upload] Excel Headers (Row 6):', JSON.stringify(headers));

                worksheet.eachRow((row, rowNumber) => {
                    if (rowNumber <= 6) return;

                    const noticeId = row.getCell(1).value?.toString();
                    const planText = row.getCell(3).value?.toString() || '';
                    const responsible = row.getCell(4).value?.toString() || '';
                    const deadlineValue = row.getCell(5).value;

                    // --- 6. 添加日志：打印原始单元格数据 ---
                    const rawEvidenceValue = row.getCell(6).value;
                    const evidenceDescription = toPlainText(rawEvidenceValue)?.toString() || '';

                    console.log(`[Evidence Upload] Row ${rowNumber}:`, {
                        noticeId: noticeId,
                        rawEvidence: rawEvidenceValue,
                        parsedEvidence: evidenceDescription.trim(),
                    });

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
                                    <Tooltip title={isRealBatch ? `${supplierShortCode} - ${category}` : `${supplierShortCode} - ${createDate}`}>
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
                    {/* --- 10. 核心修改：条件渲染操作区域 --- */}
                    {/* 批量删除 (SD/Manager/Admin) */}
                    {allowDeletion && (
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

                    {/* 批量提交行动计划 (Supplier) */}
                    {allowBatchActions && (
                        <div style={{ marginBottom: '16px', padding: '0 16px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                            <Space>
                                <Button icon={<DownloadOutlined />} onClick={handleActionDownloadTemplate}>
                                    下载行动计划模板
                                </Button>
                                <Upload
                                    beforeUpload={handleActionExcelUpload} // <-- 确保调用正确的函数
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

                    {/* 批量提交证据 (Supplier) */}
                    {allowBatchEvidenceUpload && (
                        <div style={{ marginBottom: '16px', padding: '0 16px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                            <Space>
                                <Button icon={<DownloadOutlined />} onClick={handleDownloadEvidenceTemplate}>
                                    下载证据模板
                                </Button>
                                <Upload
                                    beforeUpload={handleEvidenceExcelUpload} // <-- 确保调用正确的函数
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
                                selectable={allowDeletion} // 仅在允许删除时才可选择
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
    // props.searchTerm 应该由父组件传入
    return (
        <List
            dataSource={props.data}
            pagination={props.pagination}
            renderItem={item => (
                item.isBatch
                    ? <NoticeBatchItem batch={item} {...props} searchTerm={props.searchTerm} /> // --- 6. 传递 searchTerm ---
                    : <SingleNoticeItem item={item} selectable={false} {...props} searchTerm={props.searchTerm} /> // --- 7. 传递 searchTerm ---
            )}
            locale={{ emptyText: '暂无相关通知单' }}
        />
    );
};