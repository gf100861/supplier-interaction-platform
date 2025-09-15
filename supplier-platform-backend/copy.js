// --- 1. 核心修改：移除 http 和 socket.io, 引入 dotenv 和 pusher ---
const express = require('express');
const cors = require('cors');
require('dotenv').config(); // 用于加载 .env 文件中的密钥
const Pusher = require("pusher");
const { mockUsers, mockNoticesData, suppliersList, mockEventsData, noticeCategoryDetails, noticeCategories } = require('./_mockData');

// --- 2. 核心修改：初始化 Pusher ---
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let alertsData = [];
const PORT = process.env.PORT || 3001;

// --- API 端点 ---
// (所有 GET 和 POST /api/login API 保持不变)
app.get('/api/notices', (req, res) => res.status(200).json(mockNoticesData));
// ... etc ...

// --- 提醒(Alerts)相关的 API ---
app.post('/api/alerts', (req, res) => {
    const newAlert = req.body;
    alertsData.unshift(newAlert);
    
    // --- 3. 核心修改：使用 pusher.trigger 替代 io.emit ---
    // 我们将消息发送到以接收者ID命名的“私人频道”
    const channelName = `private-${newAlert.recipientId}`;
    console.log(`[Pusher] 📡 Triggering event 'new_alert' on channel '${channelName}'`);
    pusher.trigger(channelName, "new_alert", newAlert);
    
    res.status(201).json(newAlert);
});

// --- 数据更新 API ---
app.put('/api/notices/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const noticeIndex = mockNoticesData.findIndex(n => n.id === id);
    if (noticeIndex === -1) {
        return res.status(404).json({ message: "未找到指定的通知单" });
    }
    mockNoticesData[noticeIndex] = { ...mockNoticesData[noticeIndex], ...updates };
    const updatedNotice = mockNoticesData[noticeIndex];
    
    // --- 3. 核心修改：使用 pusher.trigger 替代 io.emit ---
    // 我们将消息发送到一个所有登录用户都订阅的“公共频道”
    console.log(`[Pusher] 📡 Triggering event 'notice_updated' on channel 'updates'`);
    pusher.trigger("updates", "notice_updated", updatedNotice);
    
    res.status(200).json(updatedNotice);
});

app.post('/api/notices/batch', (req, res) => {
    const newNotices = req.body;
    if (!Array.isArray(newNotices) || newNotices.length === 0) {
        return res.status(400).json({ message: "请求体必须是一个非空数组" });
    }
    mockNoticesData.push(...newNotices);
    
    // --- 3. 核心修改：使用 pusher.trigger 替代 io.emit ---
    console.log(`[Pusher] 📡 Triggering event 'notices_added' on channel 'updates'`);
    pusher.trigger("updates", "notices_added", newNotices);
    
    res.status(201).json({ message: "批量创建成功", data: newNotices });
});

// --- 4. 核心修改：移除所有 socket.io 的 io.on('connection', ...) 逻辑 ---

// 为了同时兼容本地测试 (node server.js) 和 Vercel 部署
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`✅ 本地测试服务器已成功启动！正在监听端口: ${PORT}`);
    });
}

// 导出 app，这是 Vercel 部署所必需的
module.exports = app;