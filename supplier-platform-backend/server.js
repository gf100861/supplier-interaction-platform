require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

// --- 引入 API 处理逻辑 ---
// ⚠️ 注意：请确保您的文件夹名确实是 'controllers' (复数)
const createUserHandler = require('./controllers/create-user');
const deleteUserHandler = require('./controllers/delete-user');
const smartSearchHandler = require('./controllers/smart-search');
const systemLogHandler = require('./controllers/system-log');
// ⚠️ 请确认 controllers 目录下是否有 admin 文件夹
const getSystemLogsHandler = require('./controllers/admin/system-logs'); 
// ⚠️ 请确认 controllers 目录下是否有 auth 文件夹
const loginHandler = require('./controllers/auth/login'); 

const categoriesHandler = require('./controllers/categories');
// 🔴 修正：统一改为 controllers (复数)
const configHandler = require('./controllers/config'); 
const alertsHandler = require('./controllers/alerts'); 
const usersHandler = require('./controllers/users'); 
const noticesHandler = require('./controllers/notices'); 
const suppliersHandler = require('./controllers/suppliers');
const adminUpdateUserHandler = require('./controllers/admin/update-user');
const adminManageAssignmentsHandler = require('./controllers/admin/manage-assignments');
const adminFeedbackHandler = require('./controllers/admin/feedback');
const adminSystemNoticesHandler = require('./controllers/admin/system-notices');
const emailController = require('./controllers/email');
const app = express();
const server = http.createServer(app);

// 初始化 Supabase Admin
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 允许跨域 (包含 PATCH)
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS', 'DELETE', 'PATCH'] }));
app.use(express.json());

// --- Socket.IO (仅本地有效) ---
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
io.on('connection', (socket) => {
    console.log('Local Socket connected:', socket.id);
});

// ==========================================
// --- 注册 API 路由 ---
// ==========================================
// 💡 优化：直接传入 Handler 函数，代码更干净

// Auth
app.post('/api/auth/login', loginHandler);

// Logs
app.post('/api/system-log', systemLogHandler);
app.get('/api/admin/system-logs', getSystemLogsHandler);

// Users
app.all('/api/create-user', createUserHandler);
app.all('/api/delete-user', deleteUserHandler);
app.all('/api/users', usersHandler); // 获取用户列表

// Core Business
app.post('/api/smart-search', smartSearchHandler);
app.get('/api/config', configHandler);
app.get('/api/categories', categoriesHandler);
app.get('/api/suppliers', suppliersHandler);

// Alerts & Notices (支持 GET/POST/PATCH/DELETE)
app.all('/api/alerts', alertsHandler);
app.all('/api/notices', noticesHandler);

// Admin 特定功能
app.patch('/api/admin/update-user', adminUpdateUserHandler);
app.post('/api/admin/manage-assignments', adminManageAssignmentsHandler);
app.all('/api/admin/feedback', adminFeedbackHandler);
app.all('/api/admin/system-notices', adminSystemNoticesHandler);
// Email (保留简单逻辑)
// 1. 发送安全警报邮件 (对应之前的 /api/send-alert-email)
app.post('/api/send-alert-email', emailController.sendAlertEmail);

// 2. 发送普通通知邮件 (对应之前的 /api/send-email)
// 如果您前端有用这个接口，可以注册它；如果没有，可以不加
app.post('/api/send-email', emailController.sendGeneralEmail);
// ==========================================
// --- 启动服务器 (Vercel 关键配置) ---
// ==========================================

const PORT = process.env.PORT || 3001;

// 🔴 关键修改：只有在本地直接运行 (node server.js) 时才监听端口
// Vercel 环境下不运行这一段，防止端口冲突
if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`✅ Local Backend running on http://localhost:${PORT}`);
        console.log(`Routes loaded: Login, Logs, Users, Alerts, Notices, Suppliers...`);
    });
}

// 🔴 关键修改：必须导出 app，供 Vercel 的 api/index.js 使用
module.exports = app;