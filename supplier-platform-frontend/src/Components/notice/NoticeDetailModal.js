// src/Components/notice/NoticeDetailModal.js
import React, { useState, useMemo } from 'react';
import { Tag, Button, Modal, Typography, Divider, Timeline, Form, Input, DatePicker, Upload, Space, Tabs, Card, Image, theme, Popconfirm } from 'antd';
import {
    PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, PaperClipOutlined, PictureOutlined, UploadOutlined, SolutionOutlined,
    CameraOutlined, UserOutlined as PersonIcon, CalendarOutlined, LeftOutlined, RightOutlined, MinusCircleOutlined, StarOutlined, StarFilled,
    InboxOutlined, // 用于 Upload.Dragger 的拖拽图标
    FileAddOutlined // 用于附件 Upload.Dragger 的图标
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { categoryColumnConfig } from '../../data/_mockData';
import { ActionPlanReviewDisplay } from './ActionPlanReviewDisplay';
import { EnhancedImageDisplay } from '../common/EnhancedImageDisplay';
const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

// --- 内部辅助组件 (代码无变化) ---
const normFile = (e) => { if (Array.isArray(e)) return e; return e && e.fileList; };

const DynamicDetailsDisplay = ({ notice }) => {
    // 修正 #2: 使用可选链 ?. 来安全地访问深层属性
    if (!notice?.category || !notice?.sdNotice?.details) return null;
    console.log('notice',notice.creator.username)

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
                        {toPlainText(notice.sdNotice.details[field.dataIndex])}
                    </Text>
                ))}
            </Space>
        </>
    );
};

const AttachmentsDisplay = ({ attachments }) => {
    if (!attachments || attachments.length === 0) return null;
    return (
        <div style={{ marginTop: 12 }}>
            <Text strong><PaperClipOutlined /> 附件:</Text>
            <div style={{ marginTop: 8 }}>
                <Space wrap>
                    {attachments.map((file, i) => (
                        <Button key={i} type="dashed" href={file.url} size="small" target="_blank" download={file.name} icon={<PaperClipOutlined />}>
                            {file.name}
                        </Button>
                    ))}
                </Space>
            </div>
        </div>
    );
};


const ImageScroller = ({ images, title }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    if (!images || images.length === 0) return null;

    const goToPrevious = () => {
        const isFirstSlide = currentIndex === 0;
        const newIndex = isFirstSlide ? images.length - 1 : currentIndex - 1;
        setCurrentIndex(newIndex);
    };

    const goToNext = () => {
        const isLastSlide = currentIndex === images.length - 1;
        const newIndex = isLastSlide ? 0 : currentIndex + 1;
        setCurrentIndex(newIndex);
    };
    const getHighResUrl = (image) => {
        // 优先使用我们生成的 'url'，其次才是 antd 的 'thumbUrl'
        return image.url || image.thumbUrl;
    };

    return (
        <div style={{ marginTop: 12 }}>
            <Text strong><PictureOutlined /> {title}:</Text>
            <div style={{ position: 'relative', marginTop: 8 }}>
                {/* 使用 antd 的 Image.PreviewGroup 来获得更高质量的预览体验 */}
                <Image.PreviewGroup
                    preview={{
                        current: currentIndex,
                        onChange: (current) => setCurrentIndex(current),
                    }}
                    items={images.map(img => getHighResUrl(img))}
                >
                    <Image
                        height={250}
                        style={{ objectFit: 'contain', width: '100%', backgroundColor: '#f0f2f5', borderRadius: '8px' }}
                        src={getHighResUrl(images[currentIndex])}
                    />
                </Image.PreviewGroup>

                {images.length > 1 && (
                    <>
                        <Button shape="circle" icon={<LeftOutlined />} onClick={goToPrevious} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }} />
                        <Button shape="circle" icon={<RightOutlined />} onClick={goToNext} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }} />
                        <Tag style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 10 }}>
                            {currentIndex + 1} / {images.length}
                        </Tag>
                    </>
                )}
            </div>
        </div>
    );
};


const PlanSubmissionForm = ({ onFinish, form, actionAreaStyle }) => (
    <div style={actionAreaStyle}>
        <Title level={5}><SolutionOutlined /> 提交行动计划</Title>
        <Form form={form} layout="vertical" onFinish={onFinish} autoComplete="off">
            <Form.List name="actionPlans" initialValue={[{ plan: '', responsible: '', deadline: null }]}>
                {(fields, { add, remove }) => (
                    <div style={{ display: 'flex', flexDirection: 'column', rowGap: 16 }}>
                        {/* --- 核心修改 1: 修改 map 的参数，获取 index --- */}
                        {fields.map((field, index) => (
                            // --- 核心修改 2: Card 的 key 属性必须继续使用 field.key ---
                            <Card key={field.key} size="small" title={`行动项 #${index + 1}`} extra={<MinusCircleOutlined onClick={() => remove(field.name)} />}>
                                {/* 注意: 这里的 name 和 ...restField 都需要从 field 对象中获取
                        例如: name={[field.name, 'plan']}
                    */}
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

// 仅用于提交证据的表单
// 仅用于提交证据的表单
const EvidencePerActionForm = ({ onFinish, form, notice, handlePreview }) => { // ✨ 注意：传入 handlePreview
    // 找到上一次提交并被批准的行动计划
    const lastApprovedPlans = useMemo(() => {
        const history = notice?.history || [];
        const lastPlanSubmission = [...history].reverse().find(h => h.type === 'sd_plan_approval' || h.type === 'supplier_plan_submission');
        return lastPlanSubmission?.actionPlans || [];
    }, [notice]);

    return (
        // --- 这是修正后的代码 ---
        <Form form={form} layout="vertical" onFinish={onFinish}>
            <Title level={5}><CheckCircleOutlined /> 上传完成证据</Title>
            <Paragraph type="secondary">请为每一个已批准的行动项，填写完成说明并上传证据文件。</Paragraph>

            {/* ✨ 核心修改：直接遍历 lastApprovedPlans，移除了 Form.List */}
            <div style={{ display: 'flex', flexDirection: 'column', rowGap: 16 }}>
                {lastApprovedPlans.map((plan, index) => (
                    <Card key={index} type="inner" title={<Text strong>{`行动项 #${index + 1}: ${plan.plan}`}</Text>}>
                        <Paragraph type="secondary">负责人: {plan.responsible} | 截止日期: {plan.deadline}</Paragraph>

                        {/* 这个 Form.Item 的 name 写法是完全正确的，它会自动在 onFinish 的 values 中创建 evidence 数组 */}
                        <Form.Item
                            name={['evidence', index, 'description']} // ✨ 最佳实践：在 name 中也加入父级 'evidence'
                            label="完成情况说明"
                            rules={[{ required: true, message: '请填写完成说明！' }]}
                        >
                            <TextArea autoSize={{ minRows: 3, maxRows: 8 }} placeholder="请简述此项任务的完成情况..." />
                        </Form.Item>

                        <Form.Item
                            name={['evidence', index, 'images']} // ✨ 最佳实践：在 name 中也加入父级 'evidence'
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
                                style={{ width: 250, height: 100 }}
                            >
                                <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                                <p className="ant-upload-text">点击或拖拽图片到此区域上传</p>
                            </Upload.Dragger>
                        </Form.Item>

                        <Form.Item
                            name={['evidence', index, 'attachments']} // ✨ 最佳实践：在 name 中也加入父级 'evidence'
                            label="上传附件 (可选, 可拖拽)"
                            valuePropName="fileList"
                            getValueFromEvent={normFile}
                        >
                            <Upload.Dragger
                                beforeUpload={() => false}
                                multiple
                                style={{ width: 250, height: 100 }}
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

// 通用的审核操作区
const ApprovalArea = ({ title, onApprove, onReject, approveText, rejectText, actionAreaStyle }) => (
    <div style={actionAreaStyle}>
        <Title level={5}>{title}</Title>
        <Space direction="vertical" style={{ width: '100%' }}>
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={onApprove}>{approveText || '批准'}</Button>
            <Button danger icon={<CloseCircleOutlined />} onClick={onReject}>{rejectText || '驳回'}</Button>
        </Space>
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

    // 3. 检查当前用户是否已经点赞
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
        if (!file.url && !file.preview) {
            file.preview = await getBase64(file.originFileObj);
        }
        setPreviewImage(file.url || file.preview);
        setPreviewOpen(true);
        setPreviewTitle(file.name || file.url.substring(file.url.lastIndexOf('/') + 1));
    };
    // --- 新增结束 ---

    const actionAreaStyle = {
        background: token.colorFillAlter,
        padding: '16px',
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
    };

    if (!notice) return null;
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
    console.log('Notice的值为：', notice)

    const renderActionArea = () => {
        const isAssignedSupplier = currentUser?.role === 'Supplier' && currentUser.supplier_id === notice.assignedSupplierId;
        const isSDOrManager = currentUser?.role === 'SD' || currentUser?.role === 'Manager';

        switch (notice.status) {
            case '待供应商处理':
                return isAssignedSupplier && <PlanSubmissionForm form={form} onFinish={onPlanSubmit} />;
            case '待SD审核':
            case '待SD审核计划':
                return isSDOrManager && <ApprovalArea title="审核行动计划" onApprove={onPlanApprove} onReject={showPlanRejectionModal} />;
            case '待供应商上传证据':
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
                                    <Space style={{ marginTop: 8 }}>
                                        <Button type="primary" icon={<CheckCircleOutlined />} disabled={approvedFlags[index]} onClick={() => onApproveEvidenceItem?.(index)}>
                                            {approvedFlags[index] ? '已批准' : '批准此证据'}
                                        </Button>
                                        <Button danger icon={<CloseCircleOutlined />} onClick={() => onRejectEvidenceItem?.(index)}>驳回此证据并退回</Button>
                                    </Space>
                                </Card>
                            ))}
                            <Divider />
                            <Popconfirm title="确定所有证据均已审核通过并关闭吗？" onConfirm={onClosureApprove}>
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
            // --- 核心修正：在这里新增对 like 和 unlike 的处理 ---
            // like: "点赞了此改善",
            // unlike: "取消了点赞"
        };

        const colorMap = {
            submission: 'blue',
            approval: 'green',
            rejection: 'red',
            reassignment: 'orange',
            void: 'grey',
            // --- 核心修正：为新类型定义颜色 ---
            like: 'gold',
            unlike: 'default'
        };

        const key = Object.keys(colorMap).find(k => h.type.includes(k));

        return {
            text: typeMap[h.type] || "执行了操作",
            color: colorMap[key] || 'grey'
        };
    };


    return (
        // 修正 #1: 将 open={visible} 修改为 open={open}
        <Modal title={`通知单详情: ${safeTitle} - ${notice?.noticeCode || ''}`} open={open} onCancel={onCancel} footer={null} width={800}>
            <Title level={5} style={{ marginTop: 24 }}>初始通知内容</Title>
            <Card size="small" type="inner">
                {/* 修正 #2: 将富文本数组转换为纯文本 */}
                <Paragraph><strong>问题描述:</strong> {toPlainText(notice?.sdNotice?.description || notice?.sdNotice?.details?.finding)}</Paragraph>
                <DynamicDetailsDisplay notice={notice} />
                <ImageScroller images={notice?.sdNotice?.images} title="初始图片" />
                <AttachmentsDisplay attachments={notice?.sdNotice?.attachments} />
                <Divider style={{ margin: '12px 0' }} />
                <Text type="secondary">由 {notice?.creator?.username|| 'SD'} 于 {notice?.sdNotice?.createTime} 发起</Text>
            </Card>
            <Divider />

            <Title level={5}>处理历史</Title>
            <Timeline>
                <Timeline.Item color="green">
                    <p><b>{notice?.creator?.username || '发起人'}</b> 在 {dayjs(notice.createdAt).format('YYYY-MM-DD HH:mm')} 发起了通知</p>
                </Timeline.Item>

                {(notice.history || []).map((h, index) => {
                    const label = getHistoryItemLabel(h);
                    console.log('h是什么',h)
                    return (
                        <Timeline.Item key={index} color={label.color}>
                            <p><b>{h.submitter||'发起人'}</b> 在 {h.time} {label.text}</p>

                            {/* 如果历史记录中有描述，则显示 */}
                            {h.description && h.description.startsWith('[') && <Text type="danger">{h.description}</Text>}

                            {/* ✨ 在对应的历史节点，调用新组件来显示计划/证据详情 */}
                            {(h.type === 'supplier_plan_submission' || h.type === 'supplier_evidence_submission') && (
                                <ActionPlanReviewDisplay historyItem={h} />
                            )}
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