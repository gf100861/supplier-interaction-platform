// src/services/AlertService.js
import React from 'react';
import { useProductionAlerts, ALERT_TYPES, ALERT_PRIORITY } from '../contexts/ProductionAlertContext';

class AlertService {
    constructor() {
        this.alertContext = null;
    }

    // 设置AlertContext（在组件中使用时调用）
    setAlertContext(context) {
        this.alertContext = context;
    }

    // 发送提醒的通用方法
    async sendAlert(alertData) {
        if (!this.alertContext) {
            console.error('[AlertService] AlertContext 未设置');
            return;
        }

        try {
            await this.alertContext.addAlert(alertData);
            console.log('[AlertService] 提醒发送成功:', alertData);
        } catch (error) {
            console.error('[AlertService] 提醒发送失败:', error);
        }
    }

    // 通知单分配提醒
    async notifyNoticeAssigned(notice, assignedSupplierId, assignedSupplierName) {
        await this.sendAlert({
            recipientId: assignedSupplierId,
            type: ALERT_TYPES.NOTICE_ASSIGNED,
            priority: ALERT_PRIORITY.HIGH,
            title: '新通知单分配',
            message: `您收到了新的通知单："${notice.title}"，请及时处理。`,
            link: `/notices?open=${notice.id}`,
            metadata: {
                noticeId: notice.id,
                noticeTitle: notice.title,
                category: notice.category,
            },
        });
    }

    // 计划提交提醒
    async notifyPlanSubmitted(notice, submitterName) {
        const creatorId = notice.sdNotice?.creatorId;
        if (!creatorId) return;

        await this.sendAlert({
            senderId: notice.assignedSupplierId,
            recipientId: creatorId,
            type: ALERT_TYPES.PLAN_SUBMITTED,
            priority: ALERT_PRIORITY.MEDIUM,
            title: '行动计划已提交',
            message: `供应商 ${submitterName} 已为通知单 "${notice.title}" 提交行动计划，请审核。`,
            link: `/notices?open=${notice.id}`,
            metadata: {
                noticeId: notice.id,
                noticeTitle: notice.title,
                submitterName,
            },
        });
    }

    // 计划批准提醒
    async notifyPlanApproved(notice, approverName) {
        await this.sendAlert({
            senderId: notice.creatorId,
            recipientId: notice.assignedSupplierId,
            type: ALERT_TYPES.PLAN_APPROVED,
            priority: ALERT_PRIORITY.MEDIUM,
            title: '行动计划已批准',
            message: `您的行动计划已获得 ${approverName} 批准，请开始执行并准备上传完成证据。`,
            link: `/notices?open=${notice.id}`,
            metadata: {
                noticeId: notice.id,
                noticeTitle: notice.title,
                approverName,
            },
        });
    }

    // 计划驳回提醒
    async notifyPlanRejected(notice, rejectorName, rejectionReason) {
        await this.sendAlert({
            senderId: notice.creatorId,
            recipientId: notice.assignedSupplierId,
            type: ALERT_TYPES.PLAN_REJECTED,
            priority: ALERT_PRIORITY.HIGH,
            title: '行动计划被驳回',
            message: `您的行动计划被 ${rejectorName} 驳回：${rejectionReason}。请修改后重新提交。`,
            link: `/notices?open=${notice.id}`,
            metadata: {
                noticeId: notice.id,
                noticeTitle: notice.title,
                rejectorName,
                rejectionReason,
            },
        });
    }

    // 证据提交提醒
    async notifyEvidenceSubmitted(notice, submitterName) {
        const creatorId = notice.sdNotice?.creatorId;
        if (!creatorId) return;

        await this.sendAlert({
            senderId: notice.assignedSupplierId,
            recipientId: creatorId,
            type: ALERT_TYPES.EVIDENCE_SUBMITTED,
            priority: ALERT_PRIORITY.MEDIUM,
            title: '完成证据已提交',
            message: `供应商 ${submitterName} 已为通知单 "${notice.title}" 提交完成证据，请审核。`,
            link: `/notices?open=${notice.id}`,
            metadata: {
                noticeId: notice.id,
                noticeTitle: notice.title,
                submitterName,
            },
        });
    }

    // 证据批准提醒
    async notifyEvidenceApproved(notice, approverName) {
        await this.sendAlert({
            senderId: notice.creatorId,
            recipientId: notice.assignedSupplierId,
            type: ALERT_TYPES.EVIDENCE_APPROVED,
            priority: ALERT_PRIORITY.MEDIUM,
            title: '完成证据已批准',
            message: `您的完成证据已获得 ${approverName} 批准，通知单 "${notice.title}" 已关闭。`,
            link: `/notices?open=${notice.id}`,
            metadata: {
                noticeId: notice.id,
                noticeTitle: notice.title,
                approverName,
            },
        });
    }

    // 证据驳回提醒
    async notifyEvidenceRejected(notice, rejectorName, rejectionReason) {
        await this.sendAlert({
            senderId: notice.creatorId,
            recipientId: notice.assignedSupplierId,
            type: ALERT_TYPES.EVIDENCE_REJECTED,
            priority: ALERT_PRIORITY.HIGH,
            title: '完成证据被驳回',
            message: `您的完成证据被 ${rejectorName} 驳回：${rejectionReason}。请修改后重新提交。`,
            link: `/notices?open=${notice.id}`,
            metadata: {
                noticeId: notice.id,
                noticeTitle: notice.title,
                rejectorName,
                rejectionReason,
            },
        });
    }

    // 通知单关闭提醒
    async notifyNoticeClosed(notice, closerName) {
        await this.sendAlert({
            senderId: notice.creatorId,
            recipientId: notice.assignedSupplierId,
            type: ALERT_TYPES.NOTICE_CLOSED,
            priority: ALERT_PRIORITY.MEDIUM,
            title: '通知单已关闭',
            message: `通知单 "${notice.title}" 已被 ${closerName} 关闭，感谢您的配合。`,
            link: `/notices?open=${notice.id}`,
            metadata: {
                noticeId: notice.id,
                noticeTitle: notice.title,
                closerName,
            },
        });
    }

    // 系统通知
    async notifySystemMessage(recipientId, title, message, priority = ALERT_PRIORITY.MEDIUM) {
        await this.sendAlert({
            recipientId,
            type: ALERT_TYPES.SYSTEM_NOTIFICATION,
            priority,
            title,
            message,
            metadata: {
                isSystemMessage: true,
            },
        });
    }

    // 批量通知（用于批量操作）
    async notifyBatchOperation(recipientIds, title, message, metadata = {}) {
        const promises = recipientIds.map(recipientId => 
            this.sendAlert({
                recipientId,
                type: ALERT_TYPES.SYSTEM_NOTIFICATION,
                priority: ALERT_PRIORITY.MEDIUM,
                title,
                message,
                metadata: {
                    ...metadata,
                    isBatchOperation: true,
                },
            })
        );

        await Promise.all(promises);
    }

    // 紧急通知
    async notifyUrgent(recipientId, title, message, link = '#') {
        await this.sendAlert({
            recipientId,
            type: ALERT_TYPES.SYSTEM_NOTIFICATION,
            priority: ALERT_PRIORITY.URGENT,
            title,
            message,
            link,
            metadata: {
                isUrgent: true,
            },
        });
    }
}

// 创建单例实例
export const alertService = new AlertService();

// Hook for using AlertService in components
export const useAlertService = () => {
    const alertContext = useProductionAlerts();
    
    // 设置AlertContext到服务中
    React.useEffect(() => {
        alertService.setAlertContext(alertContext);
    }, [alertContext]);

    return alertService;
};
