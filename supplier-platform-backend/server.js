// server.js 

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const http = require('http');
const { Server } = require("socket.io");
const alertRoutes = require('./alertRoutes');

const app = express();
const server = http.createServer(app);

// --- CORS 配置 ---
const whitelist = [
    'http://localhost:3000',
    'https://supplier-interaction-platform-8myu.vercel.app',
    'https://supplier-interaction-platform.vercel.app'
];
const corsOptions = {
    origin: function (origin, callback) {
        if (whitelist.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: "POST", // 仅允许 POST 方法
    credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: whitelist,
    methods: ["GET", "POST"]
  }
});


// 设置io实例供路由使用
app.set('io', io);

// 使用提醒路由
app.use('/', alertRoutes);

const PORT = process.env.PORT || 3001;

// --- Socket.IO 配置 ---


let userSocketMap = {}; // 映射 userId 到 socketId

io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId;
  if (userId) {
    console.log(`✅ User connected for alerts: ${userId} with socket ID: ${socket.id}`);
    userSocketMap[userId] = socket.id;
  }

  socket.on('disconnect', () => {
    const disconnectedUserId = Object.keys(userSocketMap).find(key => userSocketMap[key] === socket.id);
    if (disconnectedUserId) {
      console.log(`❌ User disconnected: ${disconnectedUserId}`);
      delete userSocketMap[disconnectedUserId];
    }
  });
});

// --- 唯一的 API 端点 ---

// POST /api/alerts - 接收警报并实时转发
app.post('/api/alerts', (req, res) => {
    try {
        const newAlertData = req.body;
        console.log('[Alert Received]', newAlertData);

        // 通过 Socket.IO 将警报实时发送给指定用户
        const recipientSocketId = userSocketMap[newAlertData.recipientId];
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('new_alert', newAlertData);
            console.log(`[Socket.IO] 📡 Emitted 'new_alert' to user ${newAlertData.recipientId}`);
        } else {
            console.log(`[Socket.IO] ⚠️ User ${newAlertData.recipientId} is not connected. Alert was not sent in real-time.`);
        }
        
        // 成功接收并尝试转发后，返回成功状态
        res.status(200).json({ message: "Alert processed" });
    } catch (error) {
        console.error("Alert processing failed:", error);
        res.status(500).json({ message: "Alert processing failed", error });
    }
});

// --- 服务器监听 ---
if (process.env.NODE_ENV !== 'production') {
    server.listen(PORT, () => {
        console.log(`✅ Alerts-only microservice listening on port: ${PORT}`);
    });
}

// 为 Vercel 导出 app
module.exports = app;