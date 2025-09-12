// src/Components/notice/NoticeDetailModal.js

import React, { useState, useMemo } from 'react';
import { List, Tag, Button, Modal, Typography, Divider, Timeline, Form, Input, DatePicker, Upload, Space, Tabs, Card, Image, theme, Collapse, Popconfirm, Select, Carousel } from 'antd';
import {
    FileTextOutlined, PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, PaperClipOutlined, PictureOutlined, UploadOutlined, SolutionOutlined,
    CameraOutlined, UserOutlined as PersonIcon, CalendarOutlined, LeftOutlined, RightOutlined, MinusCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { categoryColumnConfig } from '../../data/_mockData';


const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

// --- 内部辅助组件 ---
const normFile = (e) => { if (Array.isArray(e)) return e; return e && e.fileList; };


//动态显示根据不同的column
const DynamicDetailsDisplay = ({ notice }) => {
    if (!notice.category || !notice.sdNotice.details) return null;

    // 从配置中心获取当前类别的专属列定义
    const config = categoryColumnConfig[notice.category] || [];
    // 过滤掉我们已经手动显示过的 title 和 description
    const dynamicFields = config.filter(
        col => col.dataIndex !== 'title' && col.dataIndex !== 'description'
    );

    if (dynamicFields.length === 0) return null;

    return (
        <>
            <Divider style={{ margin: '12px 0' }} />
            <Space direction="vertical" size="small">
                {dynamicFields.map(field => (
                    <Text key={field.dataIndex}>
                        <Text strong>{field.title}: </Text>
                        {/* 从 sdNotice.details 中获取对应的值 */}
                        {notice.sdNotice.details[field.dataIndex]}
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
                        <Button key={i} type="dashed" href={file.url} size="small" target="_blank" icon={<PaperClipOutlined />}>
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

    return (
        <div style={{ marginTop: 12 }}>
            <Text strong><PictureOutlined /> {title}:</Text>
            <div style={{ position: 'relative', marginTop: 8 }}>
                <Image
                    height={250}
                    style={{ objectFit: 'contain', width: '100%', backgroundColor: '#f0f2f5', borderRadius: '8px' }}
                    src={images[currentIndex].url || images[currentIndex].thumbUrl}
                />
                {images.length > 1 && (
                    <>
                        {/* 左箭头 */}
                        <Button
                            shape="circle"
                            icon={<LeftOutlined />}
                            onClick={goToPrevious}
                            style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }}
                        />
                        {/* 右箭头 */}
                        <Button
                            shape="circle"
                            icon={<RightOutlined />}
                            onClick={goToNext}
                            style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)' }}
                        />
                        {/* 图片计数器 */}
                        <Tag style={{ position: 'absolute', bottom: 16, right: 16 }}>
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
        <Paragraph type="secondary">您可以添加多个行动项，并为每一项指定负责人和完成日期。</Paragraph>
        <Form form={form} layout="vertical" onFinish={onFinish} autoComplete="off">
            <Form.List name="actionPlans" initialValue={[{ plan: '', responsible: '', deadline: null }]}>
                {(fields, { add, remove }) => (
                    <div style={{ display: 'flex', flexDirection: 'column', rowGap: 16 }}>
                        {fields.map(({ key, name, ...restField }) => (
                            <Card key={key} size="small"
                                extra={<MinusCircleOutlined onClick={() => remove(name)} />}
                            >
                                <Form.Item
                                    {...restField}
                                    name={[name, 'plan']}
                                    label="行动方案"
                                    rules={[{ required: true, message: '请输入行动方案' }]}
                                >
                                    <TextArea rows={2} placeholder="具体的行动方案..." />
                                </Form.Item>
                                <Space wrap align="baseline">
                                    <Form.Item
                                        {...restField}
                                        name={[name, 'responsible']}
                                        label="负责人"
                                        rules={[{ required: true, message: '请输入负责人' }]}
                                    >
                                        <Input placeholder="负责人姓名" />
                                    </Form.Item>
                                    <Form.Item
                                        {...restField}
                                        name={[name, 'deadline']}
                                        label="完成日期"
                                        rules={[{ required: true, message: '请选择日期' }]}
                                    >
                                        <DatePicker />
                                    </Form.Item>
                                </Space>
                            </Card>
                        ))}
                        <Form.Item>
                            <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                添加行动项
                            </Button>
                        </Form.Item>
                    </div>
                )}
            </Form.List>
            <Form.Item style={{ marginTop: 24 }}>
                <Button type="primary" htmlType="submit">提交所有计划</Button>
            </Form.Item>
        </Form>
    </div>
);

const EvidenceSubmissionForm = ({ onFinish, form, handlePreview, actionAreaStyle}) => (<div style={actionAreaStyle}><Title level={5}><CameraOutlined /> 上传完成证据</Title><Form form={form} layout="vertical" onFinish={onFinish}><Form.Item name="description" label="完成情况说明"><TextArea rows={3} placeholder="可以补充说明完成情况..." /></Form.Item><Form.Item name="images" label="上传图片证据" valuePropName="fileList" getValueFromEvent={normFile} rules={[{ required: true, message: '请至少上传一张图片作为证据' }]}><Upload listType="picture-card" beforeUpload={() => false} onPreview={handlePreview} accept="image/*"><div><PlusOutlined /><div style={{ marginTop: 8 }}>上传</div></div></Upload></Form.Item><Form.Item name="attachments" label="上传附件 (可选)" valuePropName="fileList" getValueFromEvent={normFile}><Upload beforeUpload={() => false} multiple><Button icon={<UploadOutlined />}>点击上传附件</Button></Upload></Form.Item><Form.Item><Button type="primary" htmlType="submit">提交证据</Button></Form.Item></Form></div>);

const ApprovalArea = ({ onApprove, showRejectionModal, title, notice, actionAreaStyle }) => (
    <div style={actionAreaStyle}>
        <Title level={5}>{title}</Title>
        <Space direction="vertical" style={{ width: '100%' }}>
            <Button type="primary" icon={<CheckCircleOutlined />} style={{ width: '100%' }} onClick={onApprove}>
                审核通过
            </Button>
            <Divider style={{ margin: '8px 0' }}>或</Divider>
            <Button danger icon={<CloseCircleOutlined />} style={{ width: '100%' }} onClick={() => showRejectionModal(notice)}>
                退回供应商
            </Button>
        </Space>
    </div>
);


const getHistoryItemDetails = (historyItem) => {
    switch (historyItem.type) {
        case 'supplier_plan_submission': return { color: 'blue', text: '提交了行动计划' };
        case 'supplier_evidence_submission': return { color: 'blue', text: '提交了完成证据' };
        case 'sd_plan_approval': return { color: 'green', text: '批准了行动计划' };
        case 'sd_plan_rejection': return { color: 'red', text: '退回了行动计划' };
        case 'sd_evidence_approval': return { color: 'green', text: '审核通过了证据' };
        case 'sd_evidence_rejection': return { color: 'red', text: '退回了提交的证据' };
        case 'manager_reassignment': return { color: 'orange', text: '重分配了供应商' };
        case 'manager_void': return { color: 'black', text: '作废了通知单' };
        default: return { color: 'grey', text: '执行了未知操作' };
    }
};

// --- 主弹窗组件 ---
export const NoticeDetailModal = ({
    notice, visible, onCancel, currentUser, form,
    onPlanSubmit, onEvidenceSubmit, onPlanApprove, onEvidenceApprove,
    showRejectionModal, handlePreview
}) => {
    // 修正 #1: Hook 必须在组件的最顶层调用
    const { token } = theme.useToken();

    // 修正 #2: 依赖 hook 结果的变量，必须定义在 hook 之后
    const actionAreaStyle = {
        background: token.colorFillAlter,
        padding: '16px',
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
    };

    if (!notice) return null;

    const renderActionArea = () => {
        const isAssignedSupplier = currentUser.role === 'Supplier' && currentUser.id === notice.assignedSupplierId;
        const isSDOrManager = currentUser.role === 'SD' || currentUser.role === 'Manager';

        switch (notice.status) {
            // 修正 #3: 将 actionAreaStyle 作为 prop 传递下去
            case '待供应商提交行动计划':
                return isAssignedSupplier && <PlanSubmissionForm form={form} onFinish={onPlanSubmit} actionAreaStyle={actionAreaStyle} />;
            case '待SD审核行动计划':
                return isSDOrManager && <ApprovalArea onApprove={onPlanApprove} title="审核行动计划" notice={notice} showRejectionModal={showRejectionModal} actionAreaStyle={actionAreaStyle} />;
            case '待供应商上传证据':
                return isAssignedSupplier && <EvidenceSubmissionForm form={form} onFinish={onEvidenceSubmit} handlePreview={handlePreview} actionAreaStyle={actionAreaStyle} />;
            case '待SD审核证据':
                return isSDOrManager && <ApprovalArea onApprove={onEvidenceApprove} title="审核完成证据" notice={notice} showRejectionModal={showRejectionModal} actionAreaStyle={actionAreaStyle} />;
            default:
                return null;
        }
    };

    return (
        <Modal title={`通知单详情: ${notice.title}`} open={visible} onCancel={onCancel} footer={null} width={800}>
            <Title level={5} style={{ marginTop: 24 }}>初始通知内容</Title>
            <Card size="small" type="inner">
                <Paragraph><strong>问题描述:</strong> {notice.sdNotice.description}</Paragraph>
                <DynamicDetailsDisplay notice={notice} />
                <ImageScroller images={notice.sdNotice.images} title="初始图片" />
                <AttachmentsDisplay attachments={notice.sdNotice.attachments} />
                <Divider style={{ margin: '12px 0' }} />
                <Text type="secondary">由 {notice.sdNotice.creator} 于 {notice.sdNotice.createTime} 发起</Text>
            </Card>

            <Divider />
            <Title level={5}>处理历史</Title>
           {/* 请将这段代码粘贴到 NoticeDetailModal.js 中 */}

<Timeline>
    <Timeline.Item color="green">
        <p><b>{notice.sdNotice.creator}</b> 发起了通知</p>
        <small>{notice.sdNotice.createTime}</small>
    </Timeline.Item>

    {notice.history.map((h, index) => {
        const details = getHistoryItemDetails(h);

        // 判断这条历史记录是否有需要特殊展示的内容
        const hasCardContent = h.description ||
            (h.actionPlans && h.actionPlans.length > 0) ||
            (h.images && h.images.length > 0) ||
            (h.attachments && h.attachments.length > 0);

        return (
            <Timeline.Item key={index} color={details.color}>
                <p><b>{h.submitter}</b> {details.text}</p>

                {/* 如果有内容，就用一个卡片把它们包起来展示 */}
                {hasCardContent && (
                    <Card size="small" type="inner" style={{ marginTop: 8 }}>
                        {/* 显示文字描述 */}
                        {h.description && <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{h.description}</Paragraph>}

                        {/* 如果是行动计划提交，则渲染计划列表 */}
                        {h.type === 'supplier_plan_submission' && h.actionPlans && h.actionPlans.length > 0 && (
                            <>
                                <Divider style={{ margin: '12px 0' }} />
                                <List
                                    size="small"
                                    header={<Text strong>行动计划:</Text>}
                                    dataSource={h.actionPlans}
                                    renderItem={(planItem, idx) => (
                                        <List.Item>
                                            <div>
                                                <Text strong>{idx + 1}. {planItem.plan}</Text><br />
                                                <Text type="secondary" style={{ marginLeft: '18px' }}>
                                                    <PersonIcon style={{ marginRight: 8 }} />{planItem.responsible}
                                                    <Divider type="vertical" />
                                                    <CalendarOutlined style={{ marginRight: 8 }} />{planItem.deadline}
                                                </Text>
                                            </div>
                                        </List.Item>
                                    )}
                                />
                            </>
                        )}

                        {/* 显示提交的图片 */}
                        <ImageScroller images={h.images} title="提交的图片" />

                        {/* 显示提交的附件 */}
                        <AttachmentsDisplay attachments={h.attachments} />
                    </Card>
                )}

                <small>{h.time}</small>
            </Timeline.Item>
        );
    })}

    {notice.status === '已完成' && (
        <Timeline.Item color="green"><b>流程已完成</b></Timeline.Item>
    )}
</Timeline>
            <Divider />
            {renderActionArea()}
        </Modal>
    );
};