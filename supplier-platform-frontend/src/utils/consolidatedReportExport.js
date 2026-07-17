import ExcelJS from 'exceljs';
import dayjs from 'dayjs';
import {
    getActionPlanLines,
    getEvidenceLines,
    getNoticeProduct,
    toPlainText,
} from './consolidatedReportData';

export const REPORT_COLUMNS = [
    { header: 'Parma', key: 'parmaId', width: 15 },
    { header: '供应商', key: 'supplierShortCode', width: 18 },
    { header: 'PRODUCT', key: 'product', width: 22 },
    { header: '状态', key: 'status', width: 18 },
    { header: 'PROCESS/QUESTIONS', key: 'process', width: 36 },
    { header: 'FINDINGS / DEVIATIONS', key: 'finding', width: 42 },
    { header: 'ACTION PLAN', key: 'actions', width: 48 },
    { header: 'EVIDENCE', key: 'evidence', width: 55 },
    { header: '创建时间', key: 'createTime', width: 15 },
    { header: '预计完成', key: 'deadline', width: 15 },
];

const BORDER = {
    top: { style: 'thin', color: { argb: 'FFD9E2F3' } },
    left: { style: 'thin', color: { argb: 'FFD9E2F3' } },
    bottom: { style: 'thin', color: { argb: 'FFD9E2F3' } },
    right: { style: 'thin', color: { argb: 'FFD9E2F3' } },
};

const normalizeSheetName = (category, usedNames) => {
    const base = (toPlainText(category).replace(/[\\/?*:[\]]/g, ' ').trim() || '未分类').slice(0, 31);
    let candidate = base;
    let suffix = 2;
    while (usedNames.has(candidate)) {
        const marker = ` (${suffix++})`;
        candidate = `${base.slice(0, 31 - marker.length)}${marker}`;
    }
    usedNames.add(candidate);
    return candidate;
};

const getRowHeight = (row) => {
    const lineCount = Math.max(
        1,
        ...['process', 'finding', 'actions', 'evidence'].map(key => String(row[key] || '').split('\n').length)
    );
    return Math.min(120, Math.max(24, lineCount * 16));
};

const mapNoticeToRow = (notice) => {
    const actionsFromHistory = getActionPlanLines(notice.history);
    const evidenceFromHistory = getEvidenceLines(notice.history);
    const actions = actionsFromHistory.length > 0
        ? actionsFromHistory
        : (Array.isArray(notice.actions) ? notice.actions : []);
    const evidence = evidenceFromHistory.length > 0
        ? evidenceFromHistory
        : (Array.isArray(notice.evidence)
            ? notice.evidence
            : (Array.isArray(notice.findings) ? notice.findings : []));
    return {
        parmaId: toPlainText(notice?.supplier?.parmaId || notice?.supplier?.parma_id),
        supplierShortCode: toPlainText(notice?.supplier?.shortCode || notice?.supplier?.short_code || notice?.assignedSupplierName),
        product: getNoticeProduct(notice),
        status: toPlainText(notice?.status),
        process: toPlainText(notice?.details?.title || notice?.details?.process || notice?.details?.parameter || notice?.title),
        finding: toPlainText(notice?.details?.description || notice?.details?.finding),
        actions: actions.filter(Boolean).map((item, index) => `${index + 1}. ${toPlainText(item)}`).join('\n'),
        evidence: evidence.filter(Boolean).map((item, index) => `${index + 1}. ${toPlainText(item)}`).join('\n'),
        createTime: notice?.sdNotice?.createTime ? dayjs(notice.sdNotice.createTime).format('YYYY-MM-DD') : '',
        deadline: notice?.deadline && notice.deadline !== 'N/A' ? dayjs(notice.deadline).format('YYYY-MM-DD') : '',
    };
};

export const createConsolidatedReportWorkbook = ({ groupedData, categories, generatedAt = new Date() }) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SD Platform';
    workbook.created = generatedAt;
    workbook.modified = generatedAt;

    const usedNames = new Set();
    categories.forEach(category => {
        const worksheet = workbook.addWorksheet(normalizeSheetName(category, usedNames), {
            views: [{ state: 'frozen', xSplit: 3, ySplit: 4 }],
            properties: { defaultRowHeight: 20 },
            pageSetup: {
                orientation: 'landscape',
                paperSize: 9,
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0,
                margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
            },
        });

        worksheet.views = [{ state: 'frozen', xSplit: 3, ySplit: 4, showGridLines: false }];
        worksheet.columns = REPORT_COLUMNS.map(column => ({ key: column.key, width: column.width }));

        worksheet.mergeCells(1, 1, 1, REPORT_COLUMNS.length);
        const titleCell = worksheet.getCell('A1');
        titleCell.value = `供应商问题综合报告 - ${category}`;
        titleCell.font = { name: 'Aptos Display', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
        titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
        worksheet.getRow(1).height = 34;

        worksheet.mergeCells(2, 1, 2, REPORT_COLUMNS.length);
        const metaCell = worksheet.getCell('A2');
        const count = groupedData[category]?.length || 0;
        metaCell.value = `生成时间: ${dayjs(generatedAt).format('YYYY-MM-DD HH:mm')}    记录数: ${count}`;
        metaCell.font = { name: 'Aptos', size: 10, color: { argb: 'FF44546A' } };
        metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
        metaCell.alignment = { horizontal: 'left', vertical: 'middle' };
        worksheet.getRow(2).height = 22;

        const headerRow = worksheet.getRow(4);
        REPORT_COLUMNS.forEach((column, index) => {
            const cell = headerRow.getCell(index + 1);
            cell.value = column.header;
            cell.font = { name: 'Aptos', bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = BORDER;
        });
        headerRow.height = 30;

        (groupedData[category] || []).map(mapNoticeToRow).forEach((rowData, rowIndex) => {
            const row = worksheet.addRow(rowData);
            row.height = getRowHeight(rowData);
            row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
                cell.font = { name: 'Aptos', size: 10, color: { argb: 'FF1F1F1F' } };
                cell.alignment = {
                    vertical: 'top',
                    horizontal: columnNumber === 4 || columnNumber >= 9 ? 'center' : 'left',
                    wrapText: true,
                };
                cell.border = BORDER;
                if (rowIndex % 2 === 1) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FC' } };
                }
            });

            const statusCell = row.getCell(4);
            if (String(rowData.status).includes('完成')) {
                statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2F0D9' } };
                statusCell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF375623' } };
            } else if (String(rowData.status).includes('作废')) {
                statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } };
            } else {
                statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
            }
        });

        const lastRow = Math.max(4, worksheet.rowCount);
        worksheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: lastRow, column: REPORT_COLUMNS.length } };
        worksheet.pageSetup.printTitlesRow = '1:4';
        worksheet.pageSetup.printArea = `A1:J${lastRow}`;
        worksheet.headerFooter.oddFooter = '第 &P / &N 页';
    });

    return workbook;
};
