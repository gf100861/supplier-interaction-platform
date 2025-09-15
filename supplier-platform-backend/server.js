const express = require('express');
const cors = require('cors');
require('dotenv').config();
const Pusher = require("pusher");
const { mockUsers, mockNoticesData, suppliersList, mockEventsData, noticeCategoryDetails, noticeCategories } = require('./_mockData');

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

const app = express();

// --- 核心修正：配置 CORS 白名单 ---
const whitelist = [
    'http://localhost:3000', // 允许本地开发环境访问
    'https://supplier-interaction-platform-8myu.vercel.app' // 允许线上前端访问
];

const corsOptions = {
    origin: function (origin, callback) {
        if (whitelist.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
};
app.use(cors(corsOptions));


app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let alertsData = [];
const PORT = process.env.PORT || 3001;

// --- API Endpoints ---

// User Authentication
app.post('/api/login', (req, res) => {
    const { username, password, role } = req.body;
    const user = mockUsers[username];
    if (user && user.password === password && user.role === role) {
        const userData = { username, name: user.name, role: user.role, id: user.id, token: `fake-jwt-token-${Date.now()}` };
        res.status(200).json(userData);
    } else {
        res.status(401).json({ message: '用户名、密码或角色错误！' });
    }
});

// Data Retrieval
app.get('/api/notices', (req, res) => res.status(200).json(mockNoticesData));
app.get('/api/suppliers', (req, res) => res.status(200).json(suppliersList));
app.get('/api/events', (req, res) => res.status(200).json(mockEventsData));
app.get('/api/config', (req, res) => res.status(200).json({ noticeCategories, noticeCategoryDetails }));
app.get('/api/alerts/:userId', (req, res) => {
    const { userId } = req.params;
    const userAlerts = alertsData.filter(a => a.recipientId === userId);
    res.status(200).json(userAlerts);
});

// Data Creation & Updates
app.post('/api/alerts', (req, res) => {
    const newAlert = req.body;
    alertsData.unshift(newAlert);
    const channelName = `private-${newAlert.recipientId}`;
    pusher.trigger(channelName, "new_alert", newAlert);
    res.status(201).json(newAlert);
});

app.put('/api/notices/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const noticeIndex = mockNoticesData.findIndex(n => n.id === id);
    if (noticeIndex === -1) {
        return res.status(404).json({ message: "未找到指定的通知单" });
    }
    mockNoticesData[noticeIndex] = { ...mockNoticesData[noticeIndex], ...updates };
    const updatedNotice = mockNoticesData[noticeIndex];
    pusher.trigger("updates", "notice_updated", updatedNotice);
    res.status(200).json(updatedNotice);
});

app.post('/api/notices/batch', (req, res) => {
    const newNotices = req.body;
    if (!Array.isArray(newNotices) || newNotices.length === 0) {
        return res.status(400).json({ message: "请求体必须是一个非空数组" });
    }
    mockNoticesData.push(...newNotices);
    pusher.trigger("updates", "notices_added", newNotices);
    res.status(201).json({ message: "批量创建成功", data: newNotices });
});

// Server Listening (for local development) & Export (for Vercel)
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`✅ 本地测试服务器已成功启动！正在监听端口: ${PORT}`);
    });
}

module.exports = app;