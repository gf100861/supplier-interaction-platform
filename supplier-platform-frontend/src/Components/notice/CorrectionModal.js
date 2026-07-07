// src/Components/notice/CorrectionModal.js
import React from 'react';
import { Modal, Form, Select, Button, Divider, Popconfirm, Typography } from 'antd';

const { Title, Paragraph } = Typography;
const { Option } = Select;

export const CorrectionModal = ({ visible, notice, onCancel, onReassign, onVoid, suppliers }) => {
    const [reassignForm] = Form.useForm();

    return (
        <Modal
            title={`修正/撤回通知单: ${notice?.title || ''}`}
            open={visible}
            onCancel={onCancel}
            footer={null} // 自定义页脚
        >
            <Title level={5}>重新指派给其他供应商</Title>
            <Paragraph type="secondary">如果此通知单指派错误，您可以在此将其分配给正确的供应商，流程将为新供应商重新开始。</Paragraph>
            <Form form={reassignForm} layout="inline" onFinish={onReassign}>
                <Form.Item name="newSupplierId" rules={[{ required: true, message: '请选择供应商' }]} style={{ flex: 1 }}>
                    <Select placeholder="选择一个新的供应商">
                        {suppliers
                            .filter(s => s.id !== notice?.assignedSupplierId)
                            .map(s => <Option key={s.id} value={s.id}>{s.short_code}</Option>)
                        }
                    </Select>
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit">确认重派</Button>
                </Form.Item>
            </Form>
            <Divider>或</Divider>
            <Title level={5}>作废此通知单</Title>
            <Paragraph type="secondary">如果此通知单完全错误或不再需要，可以将其作废。此操作不可逆。</Paragraph>
            <Popconfirm
                title="确定要作废这个通知单吗？"
                description="作废后将无法进行任何操作。"
                onConfirm={onVoid}
                okText="确认作废"
                cancelText="取消"
            >
                <Button type="primary" danger>作废此通知单</Button>
            </Popconfirm>
        </Modal>
    );
};