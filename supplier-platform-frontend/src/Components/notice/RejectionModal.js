// src/Components/notice/RejectionModal.js
import React, { useEffect } from 'react';
import { Modal, Form, Input } from 'antd';

const { TextArea } = Input;

export const RejectionModal = ({ visible, notice, onCancel, onSubmit }) => {
    const [form] = Form.useForm();

    // 当弹窗打开时，清空表单，防止显示旧数据
    useEffect(() => {
        if (visible) {
            form.resetFields();
        }
    }, [visible, form]);

    const handleOk = () => {
        form.validateFields()
            .then(values => {
                onSubmit(values); // 将表单数据传给父组件处理
            })
            .catch(info => {
                console.log('Validate Failed:', info);
            });
    };

    return (
        <Modal
            title={`退回通知单: ${notice?.title || ''}`}
            open={visible}
            onOk={handleOk}
            onCancel={onCancel}
            okText="确认退回"
            cancelText="取消"
            destroyOnClose
        >
            <Form form={form} layout="vertical" name="rejection_form">
                <Form.Item
                    name="rejectionReason"
                    label="退回原因"
                    rules={[{ required: true, message: '请填写详细的退回原因！' }]}
                >
                    <TextArea rows={4} placeholder="请详细说明不通过的原因，以便供应商能清晰地进行下一步整改..." />
                </Form.Item>
            </Form>
        </Modal>
    );
};