// src/Components/notice/RejectionModal.js (最终修复版)

import React from 'react';
import { Modal, Form, Input } from 'antd';

const { TextArea } = Input;

export const RejectionModal = ({ visible, notice, form, onCancel, onSubmit }) => {
    // 这个组件的逻辑很简单，主要就是显示一个带验证的输入框
    
    // 关键点：Ant Design v5 之后，Modal 的显示属性是 `open`
    return (
        <Modal
            open={visible} // ✅ 使用 'open' 替代 'visible'
            title={`退回通知单: ${typeof notice?.title === 'object' && notice?.title?.richText ? notice.title.richText : (notice?.title || '')}`}
            okText="确认退回"
            cancelText="取消"
            onCancel={onCancel}
            // 交由父级统一校验与处理，避免重复校验导致的混淆
            onOk={() => onSubmit()}
        >
            <Form form={form} layout="vertical" name="rejection_form">
                <Form.Item
                    name="rejectionReason"
                    label="退回原因"
                    rules={[{ required: true, message: '请输入退回原因！' }]}
                >
                    <TextArea rows={4} placeholder="请详细说明需要供应商补充或修改的内容..." />
                </Form.Item>
            </Form>
        </Modal>
    );
};