// supplier-platform-frontend/src/services/EmailService.js

// 请替换为您实际的后端地址 (不要带 /api，因为后端路由会处理)
const API_BASE_URL = 'https://supplier-interaction-platform-backend.vercel.app.js'; 

export const EmailService = {
    /**
     * 核心发送函数
     */
    async send({ to, subject, html }) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/send-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to, subject, html })
            });
            
            if (!response.ok) {
                const err = await response.json();
                console.error('邮件发送失败:', err);
                return false;
            }
            return true;
        } catch (error) {
            console.error('邮件网络错误:', error);
            return false;
        }
    },

    /**
     * 场景1：SD下发新通知单 -> 通知供应商
     */
    async notifySupplierNewNotice(supplierEmail, noticeTitle, noticeCode) {
        if (!supplierEmail) return;
        
        const subject = `[待办] 您收到一个新的整改通知单 #${noticeCode}`;
        const html = `
            <h3>您好，供应商合作伙伴：</h3>
            <p>SD 刚刚下发了一个新的整改通知单，请及时登录平台处理。</p>
            <ul>
                <li><strong>编号：</strong> ${noticeCode}</li>
                <li><strong>标题：</strong> ${noticeTitle}</li>
            </ul>
            <p><a href="https://supplier-platform-frontend.vercel.app/login">点击此处登录平台</a></p>
        `;
        await this.send({ to: supplierEmail, subject, html });
    },

    /**
     * 场景2：供应商提交计划 -> 通知 SD
     */
    async notifySDPlanSubmitted(sdEmail, supplierName, noticeTitle) {
        if (!sdEmail) return;

        const subject = `[审核] 供应商 ${supplierName} 已提交行动计划`;
        const html = `
            <h3>您好，SD：</h3>
            <p>供应商 <strong>${supplierName}</strong> 已经针对通知单 <strong>${noticeTitle}</strong> 提交了行动计划。</p>
            <p>请尽快登录平台进行审核。</p>
        `;
        await this.send({ to: sdEmail, subject, html });
    },

    /**
     * 场景3：SD 批准/驳回 -> 通知供应商
     */
    async notifySupplierAuditResult(supplierEmail, noticeTitle, status, comment) {
        if (!supplierEmail) return;
        
        const isApproved = status.includes('通过') || status.includes('关闭') || status.includes('批准');
        const color = isApproved ? 'green' : 'red';
        
        const subject = `[结果] 通知单 ${noticeTitle} 审核结果：${status}`;
        const html = `
            <h3>审核结果通知</h3>
            <p>您提交的关于 <strong>${noticeTitle}</strong> 的内容已被 SD 审核。</p>
            <p><strong>状态：</strong> <span style="color:${color};font-weight:bold;">${status}</span></p>
            ${comment ? `<p><strong>SD 意见：</strong> ${comment}</p>` : ''}
        `;
        await this.send({ to: supplierEmail, subject, html });
    }
};