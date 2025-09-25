// server.js - 本地开发服务器

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
    'https://supplier-interaction-platform.vercel.app',
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

// 健康检查端点
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Supplier Platform Backend API is running (Local Development)',
        timestamp: new Date().toISOString(),
        socketConnections: Object.keys(userSocketMap).length
    });
});

// --- 服务器监听 ---
if (process.env.NODE_ENV !== 'production') {
    server.listen(PORT, () => {
        console.log(`✅ Supplier Platform Backend listening on port: ${PORT}`);
        console.log(`📡 Socket.IO enabled for real-time notifications`);
    });
}

// 为 Vercel 导出 app (但本地开发时使用 server)
module.exports = app;