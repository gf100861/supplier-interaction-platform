// supplier-platform-backend/alertRoutes.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// 内存存储（生产环境应使用数据库）
let alertsData = [];

// 获取用户提醒
router.get('/api/alerts/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const userAlerts = alertsData.filter(alert => alert.recipientId === userId);
        
        // 按时间排序，最新的在前
        userAlerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        res.json(userAlerts);
    } catch (error) {
        console.error('获取提醒失败:', error);
        res.status(500).json({ message: '获取提醒失败', error: error.message });
    }
});

// 创建新提醒
router.post('/api/alerts', (req, res) => {
    try {
        const alertData = req.body;
        
        // 验证必需字段
        if (!alertData.recipientId || !alertData.message) {
            return res.status(400).json({ 
                message: '缺少必需字段', 
                required: ['recipientId', 'message'] 
            });
        }

        const newAlert = {
            id: alertData.id || uuidv4(),
            senderId: alertData.senderId,
            recipientId: alertData.recipientId,
            type: alertData.type || 'system_notification',
            priority: alertData.priority || 'medium',
            title: alertData.title,
            message: alertData.message,
            link: alertData.link || '#',
            timestamp: alertData.timestamp || new Date().toISOString(),
            isRead: alertData.isRead || false,
            metadata: alertData.metadata || {},
        };

        // 添加到存储
        alertsData.unshift(newAlert);

        // 通过Socket.IO发送实时通知（仅在本地开发环境）
        const io = req.app.get('io');
        if (io) {
            // 发送给特定用户
            io.to(alertData.recipientId).emit('new_alert', newAlert);
            console.log(`[AlertAPI] 实时通知已发送给用户: ${alertData.recipientId}`);
        } else {
            console.log(`[AlertAPI] Socket.IO 不可用（Vercel环境），通知已保存但未实时推送`);
        }

        console.log(`[AlertAPI] 新提醒已创建: ${newAlert.id}`);
        res.status(201).json(newAlert);
    } catch (error) {
        console.error('创建提醒失败:', error);
        res.status(500).json({ message: '创建提醒失败', error: error.message });
    }
});

// 标记提醒为已读
router.put('/api/alerts/:alertId/read', (req, res) => {
    try {
        const { alertId } = req.params;
        const alertIndex = alertsData.findIndex(alert => alert.id === alertId);
        
        if (alertIndex === -1) {
            return res.status(404).json({ message: '提醒不存在' });
        }

        alertsData[alertIndex].isRead = true;
        alertsData[alertIndex].readAt = new Date().toISOString();

        console.log(`[AlertAPI] 提醒已标记为已读: ${alertId}`);
        res.json(alertsData[alertIndex]);
    } catch (error) {
        console.error('标记已读失败:', error);
        res.status(500).json({ message: '标记已读失败', error: error.message });
    }
});

// 标记用户所有提醒为已读
router.put('/api/alerts/:userId/read-all', (req, res) => {
    try {
        const { userId } = req.params;
        const readAt = new Date().toISOString();
        
        alertsData.forEach(alert => {
            if (alert.recipientId === userId && !alert.isRead) {
                alert.isRead = true;
                alert.readAt = readAt;
            }
        });

        const updatedCount = alertsData.filter(alert => 
            alert.recipientId === userId && alert.readAt === readAt
        ).length;

        console.log(`[AlertAPI] 用户 ${userId} 的 ${updatedCount} 条提醒已标记为已读`);
        res.json({ message: `已标记 ${updatedCount} 条提醒为已读` });
    } catch (error) {
        console.error('批量标记已读失败:', error);
        res.status(500).json({ message: '批量标记已读失败', error: error.message });
    }
});

// 删除单个提醒
router.delete('/api/alerts/:alertId', (req, res) => {
    try {
        const { alertId } = req.params;
        const alertIndex = alertsData.findIndex(alert => alert.id === alertId);
        
        if (alertIndex === -1) {
            return res.status(404).json({ message: '提醒不存在' });
        }

        const deletedAlert = alertsData.splice(alertIndex, 1)[0];
        console.log(`[AlertAPI] 提醒已删除: ${alertId}`);
        res.json({ message: '提醒已删除', alert: deletedAlert });
    } catch (error) {
        console.error('删除提醒失败:', error);
        res.status(500).json({ message: '删除提醒失败', error: error.message });
    }
});

// 删除用户所有提醒
router.delete('/api/alerts/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const originalLength = alertsData.length;
        
        alertsData = alertsData.filter(alert => alert.recipientId !== userId);
        
        const deletedCount = originalLength - alertsData.length;
        console.log(`[AlertAPI] 用户 ${userId} 的 ${deletedCount} 条提醒已删除`);
        res.json({ message: `已删除 ${deletedCount} 条提醒` });
    } catch (error) {
        console.error('批量删除提醒失败:', error);
        res.status(500).json({ message: '批量删除提醒失败', error: error.message });
    }
});

// 获取提醒统计信息
router.get('/api/alerts/:userId/stats', (req, res) => {
    try {
        const { userId } = req.params;
        const userAlerts = alertsData.filter(alert => alert.recipientId === userId);
        
        const stats = {
            total: userAlerts.length,
            unread: userAlerts.filter(alert => !alert.isRead).length,
            byType: {},
            byPriority: {},
            recent: userAlerts.slice(0, 5), // 最近5条
        };

        // 按类型统计
        userAlerts.forEach(alert => {
            stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
        });

        // 按优先级统计
        userAlerts.forEach(alert => {
            stats.byPriority[alert.priority] = (stats.byPriority[alert.priority] || 0) + 1;
        });

        res.json(stats);
    } catch (error) {
        console.error('获取提醒统计失败:', error);
        res.status(500).json({ message: '获取提醒统计失败', error: error.message });
    }
});

// 批量创建提醒（用于系统通知）
router.post('/api/alerts/batch', (req, res) => {
    try {
        const { recipientIds, alertData } = req.body;
        
        if (!Array.isArray(recipientIds) || !alertData) {
            return res.status(400).json({ 
                message: '缺少必需字段', 
                required: ['recipientIds (array)', 'alertData'] 
            });
        }

        const createdAlerts = [];
        const io = req.app.get('io');

        recipientIds.forEach(recipientId => {
            const newAlert = {
                id: uuidv4(),
                senderId: alertData.senderId,
                recipientId: recipientId,
                type: alertData.type || 'system_notification',
                priority: alertData.priority || 'medium',
                title: alertData.title,
                message: alertData.message,
                link: alertData.link || '#',
                timestamp: new Date().toISOString(),
                isRead: false,
                metadata: { ...alertData.metadata, isBatchOperation: true },
            };

            alertsData.unshift(newAlert);
            createdAlerts.push(newAlert);

            // 发送实时通知（仅在本地开发环境）
            if (io) {
                io.to(recipientId).emit('new_alert', newAlert);
            }
        });

        console.log(`[AlertAPI] 批量创建了 ${createdAlerts.length} 条提醒`);
        res.status(201).json({ 
            message: `已创建 ${createdAlerts.length} 条提醒`,
            alerts: createdAlerts 
        });
    } catch (error) {
        console.error('批量创建提醒失败:', error);
        res.status(500).json({ message: '批量创建提醒失败', error: error.message });
    }
});

module.exports = router;

