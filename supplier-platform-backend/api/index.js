// Vercel API 入口文件
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const alertRoutes = require('../alertRoutes');

const app = express();

// --- CORS 配置 ---
const whitelist = [
    'http://localhost:3000',
    'https://supplier-interaction-platform-8myu.vercel.app',
    'https://supplier-interaction-platform.vercel.app',
    // 添加你的新后端域名
    'https://supplier-platform-backend.vercel.app'
];

const corsOptions = {
    origin: function (origin, callback) {
        if (whitelist.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// 使用提醒路由
app.use('/', alertRoutes);

// 健康检查端点
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Supplier Platform Backend API is running',
        timestamp: new Date().toISOString()
    });
});

// 根路径
app.get('/', (req, res) => {
    res.json({ 
        message: 'Supplier Platform Backend API',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            alerts: '/api/alerts'
        }
    });
});

// 导出给 Vercel
module.exports = app;
