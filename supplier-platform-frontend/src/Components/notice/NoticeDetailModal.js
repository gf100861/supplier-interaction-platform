import React, { useState, useMemo } from 'react';
import { Tag, Button, Modal, Typography, Divider, Timeline, Form, Input, DatePicker, Upload, Space, Card, Image, theme, Popconfirm } from 'antd';
import {
    PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, PaperClipOutlined, PictureOutlined, UploadOutlined, SolutionOutlined,
    CameraOutlined, UserOutlined as PersonIcon, CalendarOutlined, LeftOutlined, RightOutlined, MinusCircleOutlined, StarOutlined, StarFilled, TagsOutlined,
    InboxOutlined, // 用于 Upload.Dragger 的拖拽图标
    FileAddOutlined // 用于附件 Upload.Dragger 的图标
} from '@ant-design/icons';
import dayjs from 'dayjs';
// --- ✨ 1. 移除 mockData 导入 ---
import { ActionPlanReviewDisplay } from './ActionPlanReviewDisplay';

import { EnhancedImageDisplay } from '../common/EnhancedImageDisplay';
import { AttachmentsDisplay } from '../common/AttachmentsDisplay';
const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

// --- ✨ 2. 内置 categoryColumnConfig 以移除依赖 ---
const categoryColumnConfig = {
    'SEM': [
        { title: 'Criteria n°', dataIndex: 'criteria' },
        { title: 'SEM Parameter', dataIndex: 'parameter' },
        { title: 'Gap description', dataIndex: 'description' },
        { title: 'Actual SEM points', dataIndex: 'score' },
    ],
    'Process Audit': [
        { title: 'PROCESS/QUESTIONS', dataIndex: 'title' },
        { title: 'FINDINGS/DEVIATIONS', dataIndex: 'description' }
    ],
    // 您可以根据需要为其他类别添加配置
};

// --- 内部辅助组件 ---
const normFile = (e) => { if (Array.isArray(e)) return e; return e && e.fileList; };

const DynamicDetailsDisplay = ({ notice }) => {
    if (!notice?.category || !notice?.sdNotice?.details) return null;

    // --- 现在使用内置的 config ---
    const config = categoryColumnConfig[notice.category] || [];
    const dynamicFields = config.filter(
        col => col.dataIndex !== 'title' && col.dataIndex !== 'description'
    );

    if (dynamicFields.length === 0) return null;

    const toPlainText = (val) => {
        if (val == null) return '';
        if (typeof val === 'object' && Array.isArray(val.richText)) {
            return val.richText.map(r => r?.text || '').join('');
        }
        if (typeof val === 'object' && typeof val.richText === 'string') {
            return val.richText;
        }
        return String(val);
    };

    return (
        <>
            <Divider style={{ margin: '12px 0' }} />
            <Space direction="vertical" size="small">
                {dynamicFields.map(field => (
                    <Text key={field.dataIndex}>
                        <Text strong>{field.title}: </Text>
                        {/* 安全访问 details 属性 */}
                        {toPlainText(notice.sdNotice.details[field.dataIndex])}
                    </Text>
                ))}
            </Space>
        </>
    );
};

const PlanSubmissionForm = ({ onFinish, form, actionAreaStyle }) => (
    <div style={actionAreaStyle}>
        <Title level={5}><SolutionOutlined /> 提交行动计划</Title>
        <Form form={form} layout="vertical" onFinish={onFinish} autoComplete="off">
            <Form.List name="actionPlans" initialValue={[{ plan: '', responsible: '', deadline: null }]}>
                {(fields, { add, remove }) => (
                    <div style={{ display: 'flex', flexDirection: 'column', rowGap: 16 }}>
                        {fields.map((field, index) => (
                            <Card key={field.key} size="small" title={`行动项 #${index + 1}`} extra={<MinusCircleOutlined onClick={() => remove(field.name)} />}>
                                <Form.Item {...field} name={[field.name, 'plan']} label="行动方案" rules={[{ required: true, message: '请输入行动方案' }]}>
                                    <TextArea autoSize={{ minRows: 3, maxRows: 9 }} />
                                </Form.Item>
                                <Space wrap align="baseline">
                                    <Form.Item {...field} name={[field.name, 'responsible']} label="负责人" rules={[{ required: true, message: '请输入负责人' }]}>
                                        <Input />
                                    </Form.Item>
                                    <Form.Item {...field} name={[field.name, 'deadline']} label="完成日期" rules={[{ required: true, message: '请选择日期' }]}>
                                        <DatePicker />
                                    </Form.Item>
                                </Space>
                            </Card>
                        ))}
                        <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>添加行动项</Button>
                    </div>
                )}
            </Form.List>
            <Divider />
            <Form.Item><Button type="primary" htmlType="submit">提交计划</Button></Form.Item>
        </Form>
    </div>
);

const EvidencePerActionForm = ({ onFinish, form, notice, handlePreview }) => {
    const lastApprovedPlans = useMemo(() => {
        const history = notice?.history || [];
        // 寻找最后一个被批准的计划或最近一次提交的计划（以防被驳回后重新提交）
        const lastPlanEvent = [...history].reverse().find(h => h.type === 'sd_plan_approval' || h.type === 'supplier_plan_submission');
        return lastPlanEvent?.actionPlans || [];
    }, [notice]);

    return (
        <Form form={form} layout="vertical" onFinish={onFinish}>
            <Title level={5}><CheckCircleOutlined /> 上传完成证据</Title>
            <Paragraph type="secondary">请为每一个已批准的行动项，填写完成说明并上传证据文件。</Paragraph>
            <div style={{ display: 'flex', flexDirection: 'column', rowGap: 16 }}>
                {lastApprovedPlans.map((plan, index) => (
                    <Card key={index} type="inner" title={<Text strong>{`行动项 #${index + 1}: ${plan.plan}`}</Text>}>
                        <Paragraph type="secondary">负责人: {plan.responsible} | 截止日期: {dayjs(plan.deadline).format('YYYY-MM-DD')}</Paragraph>
                        <Form.Item
                            name={['evidence', index, 'description']}
                            label="完成情况说明"
                            rules={[{ required: true, message: '请填写完成说明！' }]}
                        >
                            <TextArea autoSize={{ minRows: 3, maxRows: 8 }} placeholder="请简述此项任务的完成情况..." />
                        </Form.Item>
                        <Form.Item
                            name={['evidence', index, 'images']}
                            label="上传图片证据 (可拖拽)"
                            valuePropName="fileList"
                            getValueFromEvent={normFile}
                        >
                            <Upload.Dragger
                                listType="picture"
                                beforeUpload={() => false}
                                onPreview={handlePreview}
                                accept="image/*"
                                multiple
                            // --- ✨ 3. 移除固定样式 ---
                            >
                                <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                                <p className="ant-upload-text">点击或拖拽图片到此区域上传</p>
                            </Upload.Dragger>
                        </Form.Item>
                        <Form.Item
                            name={['evidence', index, 'attachments']}
                            label="上传附件 (可选, 可拖拽)"
                            valuePropName="fileList"
                            getValueFromEvent={normFile}
                        >
                            <Upload.Dragger
                                beforeUpload={() => false}
                                multiple
                            // --- ✨ 3. 移除固定样式 ---
                            >
                                <p className="ant-upload-drag-icon"><FileAddOutlined /></p>
                                <p className="ant-upload-text">点击或拖拽附件到此区域上传</p>
                            </Upload.Dragger>
                        </Form.Item>
                    </Card>
                ))}
            </div>
            <Divider />
            <Form.Item><Button type="primary" htmlType="submit">提交所有证据</Button></Form.Item>
        </Form>
    );
};

const ApprovalArea = ({ title, onApprove, onReject, approveText, rejectText, actionAreaStyle }) => (
    <div style={actionAreaStyle}>
        <Title level={5}>{title}</Title>
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={onApprove}
                style={{ flex: 1 }}
                size="large"
            >
                {approveText || '批准'}
            </Button>
            <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={onReject}
                style={{ flex: 1 }}
                size="large"
            >
                {rejectText || '驳回'}
            </Button>
        </div>
    </div>
);


// --- 主弹窗组件 ---
export const NoticeDetailModal = ({
    notice, open, onCancel, currentUser, form,
    onPlanSubmit, onPlanApprove, showPlanRejectionModal,
    onEvidenceSubmit, onClosureApprove,
    onApproveEvidenceItem, onRejectEvidenceItem,
    onLikeToggle
}) => {
    const { token } = theme.useToken();

    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState('');
    const [previewTitle, setPreviewTitle] = useState('');

    if (!notice) {
        return null;
    }

    const isLiked = notice.likes && notice.likes.includes(currentUser?.id);
    const isSDOrManager = currentUser?.role === 'SD' || currentUser?.role === 'Manager';

    const getBase64 = (file) =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
        });

    const handleCancel = () => setPreviewOpen(false);

    const handlePreview = async (file) => {
        if (!file.url && !file.preview && file.originFileObj) {
            file.preview = await getBase64(file.originFileObj);
        }
        setPreviewImage(file.url || file.preview);
        setPreviewOpen(true);
        setPreviewTitle(file.name || file.url.substring(file.url.lastIndexOf('/') + 1));
    };

    const actionAreaStyle = {
        background: token.colorFillAlter,
        padding: '16px',
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
    };

    const toPlainText = (val) => {
        if (val == null) return '';
        if (typeof val === 'object' && Array.isArray(val.richText)) {
            return val.richText.map(r => r?.text || '').join('');
        }
        if (typeof val === 'object' && typeof val.richText === 'string') {
            return val.richText;
        }
        return String(val);
    };
    const safeTitle = toPlainText(notice.title || '');

    const renderActionArea = () => {
        const isAssignedSupplier = currentUser?.role === 'Supplier' && currentUser.supplier_id === notice.assignedSupplierId;
        const isSDOrManager = currentUser?.role === 'SD' || currentUser?.role === 'Manager';

        switch (notice.status) {
            case '待提交Action Plan':
                return isAssignedSupplier && <PlanSubmissionForm form={form} onFinish={onPlanSubmit} actionAreaStyle={actionAreaStyle} />;
            case '待SD确认':
            case '待SD确认计划':
                return isSDOrManager && <ApprovalArea title="审核行动计划" onApprove={onPlanApprove} onReject={showPlanRejectionModal} actionAreaStyle={actionAreaStyle} />;
            case '待供应商关闭':
                return isAssignedSupplier && <EvidencePerActionForm form={form} onFinish={onEvidenceSubmit} notice={notice} handlePreview={handlePreview} />;
            case '待SD关闭': {
                if (!isSDOrManager) return null;
                // 渲染逐条证据审批区
                const history = notice.history || [];
                const lastEvidenceIndex = [...history].reverse().findIndex(h => h.type === 'supplier_evidence_submission');
                const realIndex = lastEvidenceIndex >= 0 ? history.length - 1 - lastEvidenceIndex : -1;
                const lastEvidence = realIndex >= 0 ? history[realIndex] : null;
                const evidenceList = lastEvidence?.actionPlans || [];

                console.log('[NoticeDetailModal] Evidence debug info:', {
                    noticeId: notice.id,
                    lastEvidenceIndex: realIndex,
                    lastEvidence: lastEvidence,
                    evidenceList: evidenceList
                });
                const approvedSet = new Set();
                if (realIndex >= 0) {
                    for (let i = realIndex + 1; i < history.length; i++) {
                        const h = history[i];
                        if (h.type === 'sd_evidence_item_approval' && typeof h.evidenceIndex === 'number') {
                            approvedSet.add(h.evidenceIndex);
                        }
                    }
                }
                const approvedFlags = evidenceList.map((_, idx) => approvedSet.has(idx));
                return (
                    <div style={actionAreaStyle}>
                        <Title level={5}>逐条审核证据</Title>
                        <Space direction="vertical" style={{ width: '100%' }}>
                            {evidenceList.map((plan, index) => (
                                <Card key={index} size="small" title={<Text strong>{`证据 #${index + 1}: ${plan.plan}`}</Text>}>
                                    <Paragraph type="secondary">{plan.evidenceDescription || '（供应商未提供文字说明）'}</Paragraph>
                                    <EnhancedImageDisplay
                                        images={plan.evidenceImages}
                                        title=""
                                        size="xlarge"
                                        showTitle={false}
                                    />
                                    <AttachmentsDisplay

                                        attachments={plan.evidenceAttachments}
                                        title=""
                                        size="xlarge"
                                        showTitle={false}

                                    />
                                    <Space style={{ marginTop: 8 }}>
                                        <Button type="primary" icon={<CheckCircleOutlined />} disabled={approvedFlags[index]} onClick={() => onApproveEvidenceItem?.(index)}>
                                            {approvedFlags[index] ? '已批准' : '批准此证据'}
                                        </Button>
                                        <Button danger icon={<CloseCircleOutlined />} onClick={() => onRejectEvidenceItem?.(index)}>驳回此证据并退回</Button>
                                    </Space>
                                </Card>
                            ))}
                            <Divider />
                            {/* 用一个箭头函数 () => yourFunction() 来包裹它。这个箭头函数就像一个“防火墙”，可以“吞掉”不想要的参数。 */}
                            <Popconfirm title="确定所有证据均已审核通过并关闭吗？" onConfirm={() => onClosureApprove()}>
                                <Button type="primary">全部批准并关闭</Button>
                            </Popconfirm>
                        </Space>
                    </div>
                );
            }
            default:
                return null;
        }
    };

    const getHistoryItemLabel = (h) => {
        const typeMap = {
            supplier_plan_submission: "供应商提交了行动计划",
            sd_plan_approval: "SD批准了行动计划",
            sd_plan_rejection: "SD驳回了行动计划",
            supplier_evidence_submission: "供应商提交了完成证据",
            sd_evidence_rejection: "SD驳回了完成证据",
            sd_closure_approve: "SD批准关闭",
            manager_reassignment: "管理员重分配了供应商",
            manager_void: "管理员作废了通知单",
        };

        const colorMap = {
            submission: 'blue',
            approval: 'green',
            rejection: 'red',
            reassignment: 'orange',
            void: 'grey',
        };

        const key = Object.keys(colorMap).find(k => h.type.includes(k));

        return {
            text: typeMap[h.type] || "执行了操作",
            color: colorMap[key] || 'grey'
        };
    };


    return (
        <Modal title={`通知单详情: ${safeTitle} - ${notice?.noticeCode || ''}`} open={open} onCancel={onCancel} footer={null} width={800}>
            <Title level={5} style={{ marginTop: 24 }}>初始通知内容</Title>
            <Card size="small" type="inner">
                <Paragraph><strong>问题描述:</strong> {toPlainText(notice?.sdNotice?.description || notice?.sdNotice?.details?.finding)}</Paragraph>
                <DynamicDetailsDisplay notice={notice} />
                <EnhancedImageDisplay images={notice?.sdNotice?.images} title="初始图片" />
                <AttachmentsDisplay attachments={notice?.sdNotice?.attachments} />

                {(notice?.sdNotice?.problemSource || notice?.sdNotice?.cause || notice?.sdNotice?.details?.product) && (
                    <div style={{ marginTop: '12px' }}>
                        <Space wrap>
                            <Text strong><TagsOutlined /> 历史经验标签:</Text>
                            {notice.sdNotice?.problemSource && <Tag color="geekblue">{notice?.sdNotice?.problemSource}</Tag>}
                            {notice?.sdNotice?.cause && <Tag color="purple">{notice?.sdNotice?.cause}</Tag>}
                            {<Tag color="purple">{notice?.sdNotice?.details?.product}</Tag>}
                        </Space>
                    </div>
                )}
                <Divider style={{ margin: '8px 0' }} />
                <Text type="secondary">由 {notice?.creator?.username || 'SD'} 于 {dayjs(notice?.sdNotice?.createTime).format('YYYY-MM-DD HH:mm')} 发起给 {notice?.supplier?.shortCode}</Text>

            </Card>
            <Divider />

            <Title level={5}>处理历史</Title>
            <Timeline>
                <Timeline.Item color="green">
                    <p><b>{notice?.creator?.username || '发起人'}</b> 在 {dayjs(notice.createdAt).format('YYYY-MM-DD HH:mm')} 发起了通知</p>

                </Timeline.Item>

                {(notice.history || []).map((h, index) => {
                    const label = getHistoryItemLabel(h);
                    const historyArray = notice.history || [];

                    let historyItemForDisplay = h; // 默认显示当前项的详情
                    let shouldRenderItem = false; // 默认不渲染

                    // 1. 只显示“批准”节点
                    if (h.type === 'sd_plan_approval' || h.type === 'sd_closure_approve') {
                        shouldRenderItem = true;

                        // 2. 如果是“批准关闭”，则详情需要替换为“证据提交”的详情
                        if (h.type === 'sd_closure_approve') {
                            // 寻找此批准节点之前的 *最后一次* 证据提交
                            const lastEvidenceSubmission = [...historyArray.slice(0, index)] // 只看此节点之前的记录
                                .reverse()
                                .find(item => item.type === 'supplier_evidence_submission');

                            if (lastEvidenceSubmission) {
                                // 检查这个证据提交是否被驳回过
                                const nextItem = historyArray[historyArray.indexOf(lastEvidenceSubmission) + 1];
                                if (!nextItem || (nextItem.type !== 'sd_evidence_rejection' && nextItem.type !== 'sd_plan_rejection')) {
                                    historyItemForDisplay = lastEvidenceSubmission;
                                }
                            }
                        }
                    }

                    // 3. 如果不应该渲染，则返回 null
                    if (!shouldRenderItem) {
                        return null;
                    }

                    return (
                        <Timeline.Item key={index} color={label.color}>
                            <p><b>{h.submitter || '发起人'}</b> 在 {h.time} {label.text}</p>

                            {/* - 'sd_plan_approval' 会显示其 actionPlans (批准的计划)
                              - 'sd_closure_approve' 会显示 'historyItemForDisplay' (即最后一次提交的证据) 的 actionPlans
                            */}
                            <ActionPlanReviewDisplay historyItem={historyItemForDisplay} />
                        </Timeline.Item>
                    );
                })}
            </Timeline>

            {notice.status === '已完成' && isSDOrManager && (
                <>
                    <Divider />
                    <div style={{ textAlign: 'center' }}>
                        <Button
                            type={isLiked ? "primary" : "default"}
                            icon={isLiked ? <StarFilled /> : <StarOutlined />}
                            onClick={() => onLikeToggle(notice)}
                            size="large"
                        >
                            {isLiked ? '已赞' : '点赞表彰'}
                        </Button>
                        <Paragraph type="secondary" style={{ marginTop: '8px' }}>为优秀的整改案例点赞，以在仪表盘上进行展示。
                        </Paragraph>
                    </div>
                </>
            )}

            <Divider />

            {renderActionArea()}
        </Modal>
    );
};