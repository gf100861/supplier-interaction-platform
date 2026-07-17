import dayjs from 'dayjs';

export const toPlainText = (value) => {
    if (value == null) return '';
    if (typeof value === 'object' && Array.isArray(value.richText)) {
        return value.richText.map(part => part?.text || '').join('');
    }
    if (typeof value === 'object' && typeof value.richText === 'string') {
        return value.richText;
    }
    if (typeof value === 'object' && typeof value.text === 'string') {
        return value.text;
    }
    return String(value);
};

const asArray = (value) => Array.isArray(value) ? value : [];

const getActionPlans = (historyItem) => asArray(
    historyItem?.actionPlans || historyItem?.action_plans
);

const findLatestHistoryItem = (history, types) => {
    const allowedTypes = new Set(types);
    const items = asArray(history);
    for (let index = items.length - 1; index >= 0; index -= 1) {
        if (allowedTypes.has(items[index]?.type)) {
            return items[index];
        }
    }
    return null;
};

const formatFile = (file) => {
    if (!file) return '';
    if (typeof file === 'string') return file;

    const url = toPlainText(
        file.url || file.thumbUrl || file.downloadUrl || file.response?.url || ''
    ).trim();
    const name = toPlainText(file.name || file.fileName || file.filename || '').trim();

    if (name && url) return `${name}: ${url}`;
    return name || url;
};

export const getActionPlanLines = (history) => {
    const submission = findLatestHistoryItem(history, ['supplier_plan_submission'])
        || findLatestHistoryItem(history, ['sd_plan_approval'])
        || findLatestHistoryItem(history, ['supplier_evidence_submission']);

    return getActionPlans(submission).map(plan => {
        const action = toPlainText(plan?.plan || plan?.actionPlan || plan?.action_plan).trim();
        const responsible = toPlainText(plan?.responsible || plan?.owner).trim();
        const parts = [action || '未填写计划'];
        if (responsible) parts.push(`负责人: ${responsible}`);
        return parts.join(' | ');
    });
};

export const getLatestActionPlanDeadline = (history) => {
    const submission = findLatestHistoryItem(history, ['supplier_plan_submission'])
        || findLatestHistoryItem(history, ['sd_plan_approval'])
        || findLatestHistoryItem(history, ['supplier_evidence_submission']);

    return getActionPlans(submission).reduce((latest, plan) => {
        const rawDeadline = toPlainText(plan?.deadline || plan?.dueDate || plan?.due_date).trim();
        const deadline = dayjs(rawDeadline);
        if (!rawDeadline || !deadline.isValid()) return latest;
        if (!latest || deadline.isAfter(latest)) return deadline;
        return latest;
    }, null)?.format('YYYY-MM-DD') || '';
};

export const getEvidenceLines = (history) => {
    const submission = findLatestHistoryItem(history, ['supplier_evidence_submission']);

    return getActionPlans(submission).reduce((lines, plan) => {
        if (!plan) return lines;

        const parts = [];
        const action = toPlainText(plan.plan || plan.actionPlan || plan.action_plan).trim();
        const description = toPlainText(
            plan.evidenceDescription || plan.evidence_description || plan.description
        ).trim();
        if (action) parts.push(`对应计划: ${action}`);
        if (description) parts.push(`完成说明: ${description}`);

        const images = asArray(plan.evidenceImages || plan.evidence_images || plan.images)
            .map(formatFile)
            .filter(Boolean);
        if (images.length) parts.push(`图片: ${images.join('; ')}`);

        const attachments = asArray(
            plan.evidenceAttachments || plan.evidence_attachments || plan.attachments
        )
            .map(formatFile)
            .filter(Boolean);
        if (attachments.length) parts.push(`附件: ${attachments.join('; ')}`);

        if (parts.length) lines.push(parts.join('\n'));
        return lines;
    }, []);
};

const mergeNoticeDetail = (summary, detail) => {
    const history = Array.isArray(detail?.history) ? detail.history : asArray(summary?.history);
    const sdNotice = { ...(summary?.sdNotice || {}), ...(detail?.sdNotice || {}) };
    const details = sdNotice.details || detail?.details || summary?.details || {};
    const actions = getActionPlanLines(history);
    const evidence = getEvidenceLines(history);
    const deadline = getLatestActionPlanDeadline(history);

    return {
        ...summary,
        ...detail,
        supplier: { ...(summary?.supplier || {}), ...(detail?.supplier || {}) },
        sdNotice,
        details,
        history,
        actions,
        evidence,
        findings: evidence,
        deadline,
        isLightweight: false,
    };
};

export const hydrateReportGroups = async ({
    groupedData,
    categories,
    fetchDetail,
    concurrency = 5,
}) => {
    const sourceGroups = groupedData || {};
    const orderedNotices = (categories || []).flatMap(category => sourceGroups[category] || []);
    const noticesById = new Map();

    orderedNotices.forEach(notice => {
        if (notice?.id && !noticesById.has(notice.id)) noticesById.set(notice.id, notice);
    });

    const noticesToFetch = [...noticesById.values()].filter(notice =>
        notice.isLightweight === true || !Array.isArray(notice.history)
    );
    const detailsById = new Map();
    let nextIndex = 0;

    const worker = async () => {
        while (nextIndex < noticesToFetch.length) {
            const notice = noticesToFetch[nextIndex];
            nextIndex += 1;
            const detail = await fetchDetail(notice.id);
            if (!detail) throw new Error(`Notice detail is empty: ${notice.id}`);
            detailsById.set(notice.id, detail);
        }
    };

    const workerCount = Math.min(Math.max(1, concurrency), noticesToFetch.length);
    await Promise.all(Array.from({ length: workerCount }, worker));

    return (categories || []).reduce((result, category) => {
        result[category] = (sourceGroups[category] || []).map(notice =>
            mergeNoticeDetail(notice, detailsById.get(notice.id) || notice)
        );
        return result;
    }, {});
};

export const getNoticeProduct = (notice) => toPlainText(
    notice?.details?.product ||
    notice?.sdNotice?.details?.product ||
    notice?.sdNotice?.problemSource ||
    notice?.sdNotice?.problem_source ||
    ''
);
