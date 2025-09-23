const express = require('express');
const cors = require('cors');
require('dotenv').config();
const Pusher = require("pusher");
const mongoose = require('mongoose');

// --- 1. 引入 Mongoose 模型 ---
const Notice = require('./models/Notice');
const Alert = require('./models/Alert');
const User = require('./models/User'); // 引入 User 模型

// --- 2. 只从 _mockData 导入静态配置 ---
const { suppliersList, mockEventsData, noticeCategoryDetails, noticeCategories } = require('./_mockData');

// --- Pusher 初始化 ---
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

const app = express();

// --- CORS 配置 ---
const whitelist = [
    'http://localhost:3000',
    'https://supplier-interaction-platform-8myu.vercel.app'
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

const PORT = process.env.PORT || 3001;

// --- 连接到 MongoDB Atlas ---
mongoose.connect(process.env.DATABASE_URL)
    .then(() => console.log("✅ 成功连接到 MongoDB Atlas 数据库!"))
    .catch(err => console.error("❌ 数据库连接失败:", err));

// --- API Endpoints (完全数据库驱动) ---

// --- 用户认证 ---
app.post('/api/login', async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const user = await User.findOne({ username: username });
        if (user && user.password === password && user.role === role) {
            const userData = { username: user.username, name: user.name, role: user.role, id: user._id, token: `real-db-token-${Date.now()}` };
            res.status(200).json(userData);
        } else {
            res.status(401).json({ message: '用户名、密码或角色错误！' });
        }
    } catch (error) {
        res.status(500).json({ message: '服务器内部错误' });
    }
});

// --- 数据获取 ---
app.get('/api/notices', async (req, res) => {
    try {
        const notices = await Notice.find().sort({ 'sdNotice.createTime': -1 });
        res.status(200).json(notices);
    } catch (error) {
        res.status(500).json({ message: "获取通知单失败", error });
    }
});

app.get('/api/alerts/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const userAlerts = await Alert.find({ recipientId: userId }).sort({ timestamp: -1 });
        res.status(200).json(userAlerts);
    } catch (error) {
        res.status(500).json({ message: "获取提醒失败", error });
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
app.get('/api/notices', async (req, res) => {
    try {
        const notices = await Notice.find().sort({ 'sdNotice.createTime': -1 });
        res.status(200).json(notices);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch notices", error });
    }
});

// POST /api/notices/batch - Creates multiple new notices in the database
app.post('/api/notices/batch', async (req, res) => {
    const newNotices = req.body;
    if (!Array.isArray(newNotices) || newNotices.length === 0) {
        return res.status(400).json({ message: "Request body must be a non-empty array" });
    }
    try {
        const insertedNotices = await Notice.insertMany(newNotices);
        pusher.trigger("updates", "notices_added", insertedNotices);
        res.status(201).json({ message: "Batch creation successful", data: insertedNotices });
    } catch (error) {
        res.status(500).json({ message: "Batch creation failed", error });
    }
});

// PUT /api/notices/:id - Updates a single notice in the database
app.put('/api/notices/:id', async (req, res) => {
    try {
        const updatedNotice = await Notice.findOneAndUpdate(
            { id: req.params.id }, // Find by custom 'id' field
            req.body,
            { new: true } // Return the updated document
        );
        if (!updatedNotice) {
            return res.status(404).json({ message: "Notice not found" });
        }
        pusher.trigger("updates", "notice_updated", updatedNotice);
        res.status(200).json(updatedNotice);
    } catch (error) {
        res.status(500).json({ message: "Update failed", error });
    }
});

// POST /api/alerts - Creates a new alert in the database
app.post('/api/alerts', async (req, res) => {
    try {
        const newAlertData = req.body;
        const alert = new Alert(newAlertData);
        const savedAlert = await alert.save();
        
        const channelName = `private-${savedAlert.recipientId}`;
        pusher.trigger(channelName, "new_alert", savedAlert);
        
        res.status(201).json(savedAlert);
    } catch (error) {
        res.status(500).json({ message: "Alert creation failed", error });
    }
});

// Server Listening (for local development) & Export (for Vercel)
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`✅ 本地测试服务器已成功启动！正在监听端口: ${PORT}`);
    });
}

module.exports = app;