# 🚨 生产级别提醒系统使用指南

## 📋 系统概述

本系统实现了一个完整的生产级别提醒系统，支持：
- ✅ 小红点实时提醒
- ✅ Socket.IO实时通信
- ✅ 提醒持久化存储
- ✅ 浏览器通知
- ✅ 提醒分类和优先级
- ✅ 生产环境降级处理

## 🏗️ 架构设计

### 前端组件
```
ProductionAlertContext.js    # 提醒状态管理
ProductionAlertBell.js       # 提醒铃铛组件
AlertService.js             # 提醒服务类
```

### 后端API
```
alertRoutes.js              # 提醒相关API路由
server.js                   # Socket.IO服务器
```

## 🚀 快速开始

### 1. 在组件中使用提醒服务

```javascript
import { useAlertService } from '../services/AlertService';

const MyComponent = () => {
    const alertService = useAlertService();
    
    const handlePlanSubmit = async (notice) => {
        // 业务逻辑...
        
        // 发送提醒
        await alertService.notifyPlanSubmitted(notice, currentUser.name);
    };
};
```

### 2. 在页面中显示提醒铃铛

```javascript
import { ProductionAlertBell } from '../Components/ProductionAlertBell';

const Header = () => {
    return (
        <Header>
            <ProductionAlertBell />
        </Header>
    );
};
```

## 📱 功能特性

### 小红点提醒
- 🔴 实时显示未读提醒数量
- 🔴 点击后自动消失
- 🔴 支持全部标记已读

### 提醒类型
```javascript
const ALERT_TYPES = {
    NOTICE_ASSIGNED: 'notice_assigned',           // 通知单分配
    PLAN_SUBMITTED: 'plan_submitted',            // 计划提交
    PLAN_APPROVED: 'plan_approved',               // 计划批准
    PLAN_REJECTED: 'plan_rejected',               // 计划驳回
    EVIDENCE_SUBMITTED: 'evidence_submitted',     // 证据提交
    EVIDENCE_APPROVED: 'evidence_approved',       // 证据批准
    EVIDENCE_REJECTED: 'evidence_rejected',       // 证据驳回
    NOTICE_CLOSED: 'notice_closed',               // 通知单关闭
    SYSTEM_NOTIFICATION: 'system_notification',    // 系统通知
};
```

### 优先级系统
```javascript
const ALERT_PRIORITY = {
    LOW: 'low',        // 低优先级
    MEDIUM: 'medium',  // 中等优先级
    HIGH: 'high',      // 高优先级
    URGENT: 'urgent',  // 紧急
};
```

## 🔧 API接口

### 创建提醒
```javascript
POST /api/alerts
{
    "recipientId": "user123",
    "type": "plan_submitted",
    "priority": "medium",
    "title": "行动计划已提交",
    "message": "供应商已提交行动计划，请审核",
    "link": "/notices?open=123",
    "metadata": {
        "noticeId": "123",
        "submitterName": "张三"
    }
}
```

### 获取用户提醒
```javascript
GET /api/alerts/:userId
```

### 标记已读
```javascript
PUT /api/alerts/:alertId/read
```

### 批量操作
```javascript
PUT /api/alerts/:userId/read-all    # 全部标记已读
DELETE /api/alerts/:userId          # 删除所有提醒
POST /api/alerts/batch              # 批量创建提醒
```

## 🌐 实时通信

### Socket.IO事件
- `new_alert`: 新提醒事件
- `connection`: 用户连接
- `disconnect`: 用户断开

### 连接管理
```javascript
// 前端连接
const socket = io('http://localhost:3001', {
    query: { userId: currentUser.id }
});

// 后端处理
io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;
    userSocketMap[userId] = socket.id;
});
```

## 🛡️ 生产环境考虑

### 1. 错误处理
- ✅ 网络失败时降级到本地存储
- ✅ API失败时显示错误信息
- ✅ Socket连接断开时自动重连

### 2. 性能优化
- ✅ 提醒分页加载
- ✅ 本地缓存机制
- ✅ 防抖处理

### 3. 安全考虑
- ✅ 用户身份验证
- ✅ CORS配置
- ✅ 输入验证

### 4. 监控和日志
- ✅ 详细的操作日志
- ✅ 错误追踪
- ✅ 性能监控

## 📊 部署配置

### 环境变量
```bash
# 前端
REACT_APP_API_URL=https://your-api-domain.com

# 后端
PORT=3001
NODE_ENV=production
```

### Docker部署
```dockerfile
# 后端Dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### 负载均衡
```nginx
upstream alert_backend {
    server alert1:3001;
    server alert2:3001;
}

server {
    location /socket.io/ {
        proxy_pass http://alert_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 🔄 升级指南

### 从旧系统迁移
1. 保持旧AlertContext运行
2. 逐步迁移到ProductionAlertContext
3. 更新组件引用
4. 测试功能完整性

### 数据迁移
```javascript
// 迁移脚本示例
const migrateAlerts = async () => {
    const oldAlerts = await fetch('/api/old-alerts');
    const newAlerts = oldAlerts.map(alert => ({
        ...alert,
        type: mapOldTypeToNewType(alert.type),
        priority: mapOldPriorityToNewPriority(alert.priority),
    }));
    
    await fetch('/api/alerts/batch', {
        method: 'POST',
        body: JSON.stringify({ recipientIds: [userId], alertData: newAlerts })
    });
};
```

## 🐛 故障排除

### 常见问题

1. **小红点不显示**
   - 检查Socket连接状态
   - 验证用户ID映射
   - 查看浏览器控制台错误

2. **提醒不实时**
   - 检查网络连接
   - 验证Socket.IO配置
   - 查看服务器日志

3. **数据丢失**
   - 检查本地存储权限
   - 验证API响应
   - 查看错误日志

### 调试工具
```javascript
// 开启调试模式
localStorage.setItem('debug_alerts', 'true');

// 查看提醒状态
console.log(useProductionAlerts());
```

## 📈 性能指标

### 关键指标
- 提醒送达率: >99%
- 实时延迟: <100ms
- 错误率: <0.1%
- 并发连接: >1000

### 监控面板
```javascript
// 性能监控
const performanceMetrics = {
    alertDeliveryTime: Date.now() - alert.timestamp,
    socketLatency: socketLatency,
    errorRate: errorCount / totalRequests,
};
```

## 🎯 最佳实践

1. **提醒频率控制**
   - 避免重复提醒
   - 设置提醒间隔
   - 用户偏好设置

2. **内容优化**
   - 简洁明了的消息
   - 包含必要信息
   - 提供操作链接

3. **用户体验**
   - 及时反馈
   - 清晰的状态指示
   - 便捷的操作方式

---

## 📞 技术支持

如有问题，请联系开发团队或查看：
- 📖 [API文档](./API_DOCS.md)
- 🐛 [问题报告](./ISSUES.md)
- 💬 [讨论区](./DISCUSSIONS.md)

