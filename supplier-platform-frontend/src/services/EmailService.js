// supplier-platform-frontend/src/services/EmailService.js

// 请替换为您实际的后端地址 (不要带 /api，因为后端路由会处理)
const API_BASE_URL = 'https://supplier-interaction-platform-backend.vercel.app';

 const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const BACKEND_URL = isDev
        ? 'http://localhost:3001'  // 本地开发环境
        : 'https://supplier-interaction-platform-backend.vercel.app'; // Vercel 生产环境

const getEmailLayout = (title, content, actionLink = 'https://supplier-interaction-platform.vercel.app/login', actionText = '登录平台查看') => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f7f6; }
            .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
            .header { background-color: #003057; padding: 30px 40px; text-align: center; } /* Volvo Blue-ish */
            .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 1px; }
            .content { padding: 40px; }
            .content h3 { color: #003057; margin-top: 0; font-size: 20px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px; margin-bottom: 20px; }
            .content p { margin-bottom: 15px; font-size: 15px; color: #555; }
            .info-box { background-color: #f8f9fa; border-left: 4px solid #003057; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .info-item { margin-bottom: 8px; }
            .info-item strong { color: #333; display: inline-block; width: 80px; }
            .btn-container { text-align: center; margin-top: 30px; margin-bottom: 20px; }
            .btn { display: inline-block; background-color: #003057; color: #ffffff !important; text-decoration: none; padding: 12px 30px; border-radius: 25px; font-weight: bold; font-size: 16px; transition: background-color 0.3s; }
            .btn:hover { background-color: #002040; }
            .footer { background-color: #f4f7f6; padding: 20px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #e1e4e8; }
            .status-tag { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; color: white; }
            .status-green { background-color: #52c41a; }
            .status-red { background-color: #f5222d; }
            .status-blue { background-color: #1890ff; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>供应商互动平台</h1>
            </div>
            <div class="content">
                ${content}
                
                ${actionLink ? `
                <div class="btn-container">
                    <a href="${actionLink}" class="btn">${actionText}</a>
                </div>
                ` : ''}
            </div>
            <div class="footer">
                <p>此邮件由系统自动发送，请勿直接回复。</p>
                <p>&copy; ${new Date().getFullYear()} Supplier Interaction Platform. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;
};
export const EmailService = {
    /**
     * 核心发送函数
     */
    async send({ to, subject, html }) {
        try {
            const response = await fetch(`${BACKEND_URL}/api/send-email`, {
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
    async notifySupplierNewNotice(supplierEmail, noticeTitle, noticeCode, supplierName, targetSdid) {
        if (!supplierEmail) return;

        const subject = `[待办] 您收到一个新的整改通知单 #${noticeCode}`;
        const content = `
            <h3>新任务通知</h3>
            <p>尊敬的供应商 <strong>${supplierName || '合作伙伴'}</strong>：</p>
            <p>${targetSdid}刚刚为您下发了一个新的整改通知单，请您及时登录平台进行查阅和处理。</p>
            <div class="info-box">
                <div class="info-item"><strong>编号：</strong> ${noticeCode}</div>
                <div class="info-item"><strong>标题：</strong> ${noticeTitle}</div>
                <div class="info-item"><strong>时间：</strong> ${new Date().toLocaleDateString()}</div>
            </div>
            <p>请点击下方按钮查看详情并开始处理。</p>
        `;

        await this.send({ to: supplierEmail, subject, html: getEmailLayout(subject, content) });
    },

    /**
     * 场景2：供应商提交计划 -> 通知 SD
     */
    async notifySDPlanSubmitted(sdEmail, supplierName, noticeTitle, sdName, notice_id) {
        if (!sdEmail) return;

        const subject = `[审核] 供应商 ${supplierName} 已提交行动计划${notice_id}`;
        const content = `
            <h3>行动计划待审核</h3>
            <p>您好，<strong>${sdName}</strong>：</p>
            <p>供应商 <strong>${supplierName}</strong> 已经针对通知单提交了最新的行动计划。</p>
            <div class="info-box">
                <div class="info-item"><strong>通知单：</strong> ${noticeTitle}</div>
                <div class="info-item"><strong>供应商：</strong> ${supplierName}</div>
                <div class="info-item"><strong>状态：</strong> <span style="color:#1890ff">待审核</span></div>
            </div>
            <p>请尽快登录平台进行审核。</p>
        `;

        await this.send({ to: sdEmail, subject, html: getEmailLayout(subject, content) });
    },


    /**
     * 场景3：SD 批准/驳回Actions -> 通知供应商
     */
    async notifySupplierAuditResult(supplierEmail, noticeTitle, status, comment, sdName = 'SD', notice_code) {
        if (!supplierEmail) return;

        const isApproved = status.includes('通过') || status.includes('关闭') || status.includes('批准');
        const statusColor = isApproved ? '#52c41a' : '#f5222d';
        const statusText = isApproved ? '通过 / 已批准' : '驳回 / 需修改';

        const subject = `[结果] 通知单 ${noticeTitle} 计划审核结果：${status} - ${notice_code}`;
        const content = `
            <h3>审核结果通知</h3>
            <p>您针对通知单 <strong>${noticeTitle}</strong> 提交的行动计划已被 <strong>${sdName}</strong> 审核。</p>
            <div class="info-box" style="border-left-color: ${statusColor};">
                <div class="info-item"><strong>审核结果：</strong> <span style="color:${statusColor};font-weight:bold;">${status}</span></div>
                ${comment ? `<div class="info-item"><strong>审核意见：</strong> ${comment}</div>` : ''}
            </div>
            <p>${isApproved ? '请继续后续流程。' : '请根据审核意见修改后重新提交。'}</p>
        `;

        await this.send({ to: supplierEmail, subject, html: getEmailLayout(subject, content) });
    },

    /**
    * 场景4：供应商提交Evidence -> 通知 SD
    */
    async notifySDEvidenceSubmitted(sdEmail, supplierName, noticeTitle, sdName = 'SD', notice_code) {
        if (!sdEmail) return;

        const subject = `[证据] 供应商 ${supplierName} 已提交完成证据${notice_code}`;
        const content = `
            <h3>证据待审核</h3>
            <p>您好，<strong>${sdName}</strong>：</p>
            <p>供应商 <strong>${supplierName}</strong> 已经针对通知单提交了整改完成证据。</p>
            <div class="info-box">
                <div class="info-item"><strong>通知单：</strong> ${noticeTitle}</div>
                <div class="info-item"><strong>供应商：</strong> ${supplierName}</div>
                <div class="info-item"><strong>提交内容：</strong> 完成证据</div>
            </div>
            <p>请尽快登录平台进行审核与确认。</p>
        `;

        await this.send({ to: sdEmail, subject, html: getEmailLayout(subject, content) });
    },

    /**
     * 场景5：SD 批准/驳回Evidence -> 通知供应商
     */
    async notifySupplierEvidenceResult(supplierEmail, noticeTitle, status, comment, sdName = 'SD', notice_code) {
        if (!supplierEmail) return;

        const isApproved = status.includes('通过') || status.includes('关闭') || status.includes('批准') || status.includes('完成');
        const statusColor = isApproved ? '#52c41a' : '#f5222d';

        const subject = `[结果] 通知单 ${noticeTitle} 证据审核结果：${status} - ${notice_code} `;
        const content = `
            <h3>证据审核结果</h3>
            <p>您针对通知单 <strong>${noticeTitle}</strong> 提交的完成证据已被 <strong>${sdName}</strong> 审核。</p>
            <div class="info-box" style="border-left-color: ${statusColor};">
                <div class="info-item"><strong>审核结果：</strong> <span style="color:${statusColor};font-weight:bold;">${status}</span></div>
                ${comment ? `<div class="info-item"><strong>审核意见：</strong> ${comment}</div>` : ''}
            </div>
            <p>${isApproved ? '恭喜，该通知单流程已全部完成。' : '请补充或修改证据后重新提交。'}</p>
        `;

        await this.send({ to: supplierEmail, subject, html: getEmailLayout(subject, content) });
    },
    /**
     * 场景6：SD/Manager 废除通知单 -> 通知SD/Manager (通常是通知供应商和SD，这里假设通知SD和供应商)
     * 根据上下文，通常废除操作会通知相关方。这里根据您的函数名 notifySDManagerAbortion，
     * 假设是通知 SD (如果操作者是 Manager) 或者通知 Manager (如果操作者是 SD)，或者只是通知 SD 该单据已废除。
     * 但考虑到一般逻辑，废除通知单应该通知供应商“不用做了”，同时也通知SD“这个单子废了”。
     * 为了简化，这里实现为一个通用的“通知单已作废”通知，可以发给任何人。
     */
    async notifyNoticeAbortion(email, noticeTitle, noticeCode, reason, operatorName = '管理员') {
        if (!email) return;

        const subject = `[作废] 通知单 ${noticeCode} 已被作废`;
        const content = `
            <h3 style="color: #8c8c8c;">通知单作废通知</h3>
            <p>我们通知您，以下通知单已被 <strong>${operatorName}</strong> 执行了作废操作。</p>
            <div class="info-box" style="border-left-color: #8c8c8c; background-color: #f5f5f5;">
                <div class="info-item"><strong>通知单号：</strong> ${noticeCode}</div>
                <div class="info-item"><strong>标题：</strong> ${noticeTitle}</div>
                <div class="info-item"><strong>作废原因：</strong> ${reason || '未提供具体原因'}</div>
            </div>
            <p>该通知单流程已终止，无需进行后续操作。</p>
        `;

        await this.send({ to: email, subject, html: getEmailLayout(subject, content, 'https://supplier-interaction-platform.vercel.app/login', '登录平台查看详情') });
    },


    /**
      * 场景7：更换供应商 -> 通知三方 (旧供应商，新供应商，SD)
      */
    async notifyReassignment({ oldSupplierEmail, newSupplierEmail, sdEmail, noticeTitle, noticeCode, oldSupplierName, newSupplierName, reason }) {
        // 1. 通知旧供应商：任务取消
        if (oldSupplierEmail && oldSupplierEmail.length > 0) {
            const subject = `[取消] 通知单 ${noticeCode} 已被重新分配`;
            const content = `
                <h3 style="color: #faad14;">任务取消通知</h3>
                <p>通知单 <strong>${noticeTitle} (${noticeCode})</strong> 已被管理员从您的任务列表中移除。</p>
                <div class="info-box" style="border-left-color: #faad14;">
                    <div class="info-item"><strong>操作类型：</strong> 供应商重分配</div>
                    <div class="info-item"><strong>原因说明：</strong> ${reason || '管理员重新分配'}</div>
                </div>
                <p>您无需再对此通知单采取任何行动。</p>
            `;
            await this.send({ to: oldSupplierEmail, subject, html: getEmailLayout(subject, content, '', '') }); // No action link needed really
        }

        // 2. 通知新供应商：新任务
        if (newSupplierEmail && newSupplierEmail.length > 0) {
            const subject = `[新任务] 您收到一个新的整改通知单 ${noticeCode} (转派)`;
            const content = `
                <h3>新任务通知 (转派)</h3>
                <p>尊敬的 <strong>${newSupplierName || '合作伙伴'}</strong>：</p>
                <p>管理员已将通知单 <strong>${noticeTitle}</strong> 转派给您，请及时处理。</p>
                <div class="info-box">
                    <div class="info-item"><strong>编号：</strong> ${noticeCode}</div>
                    <div class="info-item"><strong>标题：</strong> ${noticeTitle}</div>
                    <div class="info-item"><strong>转派说明：</strong> ${reason || '无'}</div>
                </div>
            `;
            await this.send({ to: newSupplierEmail, subject, html: getEmailLayout(subject, content) });
        }

        // 3. 通知 SD：供应商变更
        if (sdEmail) {
            const subject = `[变更] 通知单 ${noticeCode} 供应商已变更`;
            const content = `
                <h3>供应商变更通知</h3>
                <p>您负责的通知单 <strong>${noticeTitle} (${noticeCode})</strong> 的负责供应商已发生变更。</p>
                <div class="info-box" style="border-left-color: #1890ff;">
                    <div class="info-item"><strong>原供应商：</strong> ${oldSupplierName}</div>
                    <div class="info-item"><strong>新供应商：</strong> ${newSupplierName}</div>
                    <div class="info-item"><strong>变更原因：</strong> ${reason || '无'}</div>
                </div>
            `;
            await this.send({ to: sdEmail, subject, html: getEmailLayout(subject, content) });
        }
    },

    /**
     * 场景8：Admin发布通知 -> 通知系统全员
     */
    async notifySystemAnnouncement(emails, title, contentText, priority = '普通') {
        if (!emails || emails.length === 0) return;

        const subject = `[系统公告] ${title}`;
        const priorityColor = priority === '紧急' ? '#f5222d' : '#1890ff';

        const content = `
            <h3 style="color: ${priorityColor};">${title}</h3>
            <div style="margin-bottom: 20px;">
                <span style="background-color: ${priorityColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${priority}</span>
                <span style="color: #999; font-size: 12px; margin-left: 10px;">发布时间: ${new Date().toLocaleDateString()}</span>
            </div>
            <div style="background-color: #fff; padding: 15px; border: 1px solid #eee; border-radius: 4px; color: #555; line-height: 1.8;">
                ${contentText}
            </div>
        `;

        await this.send({ to: emails, subject, html: getEmailLayout(subject, content, 'https://supplier-interaction-platform.vercel.app/login', '登录系统查看') });
    }

};

