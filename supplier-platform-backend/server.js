require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

// --- 引入 API 处理逻辑 ---
const createUserHandler = require('./controllers/create-user');
const deleteUserHandler = require('./controllers/delete-user');
const smartSearchHandler = require('./controllers/smart-search'); // 确认文件名是否正确 (可能是 search.js ?)
const systemLogHandler = require('./controllers/system-log');
const getSystemLogsHandler = require('./controllers/admin/system-logs'); 
const loginHandler = require('./controllers/auth/login'); 

const categoriesHandler = require('./controllers/categories');
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
const auditPlansHandler = require('./controllers/audit-plan');
const settingsHandler = require('./controllers/setting');
const knowledgeBaseHandler = require('./controllers/knowledge-base');
const fileSyncHandler = require('./controllers/file-sync');
const aiHandler = require('./controllers/ai');
const resetPasswordHandler = require('./controllers/auth/reset-password');
const updatePasswordHandler = require('./controllers/auth/update-password');
const chatMessagesHandler = require('./controllers/chat/messages');

const chatSessionsHandler = require('./controllers/chat/sessions');
const chatRatingsHandler = require('./controllers/chat/ratings');
const analyzeDocumentHandler = require('./controllers/ai/analyze-document');
const archiveHistoricalHandler = require('./controllers/notices/archive-historical');

const fileUploadHandler = require('./controllers/file-sync/upload');

const filesHandler = require('./controllers/file-sync/files'); // 新增
const app = express();
const server = http.createServer(app);

// 初始化 Supabase Admin (如果其他地方需要用)
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ==========================================
// 鉴权中间件函数
// ==========================================
function checkAuth(req) {
    // 1. 获取环境变量中设置的密钥
    const validSecret = process.env.EXTERNAL_API_SECRET; 
    
    // 如果没设置环境变量，默认不开启鉴权（方便调试，生产环境强烈建议开启）
    if (!validSecret) return true;

    // 2. 检查 Authorization Header (格式: Bearer sk-xxxxx)
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader === `Bearer ${validSecret}`) {
        return true;
    }

    // 3. 兼容前端：如果是来自允许的 Origin (CORS)，也放行
    // 这样前端不需要改代码，只有 Dify/Postman 等外部调用才需要 Key
    const origin = req.headers['origin'];
    // 请根据实际前端域名修改这里
    const allowedOrigins = [
        'http://localhost:3000', 
        'https://supplier-interaction-platform.vercel.app', // 假设这是你的前端域名
        'https://your-frontend-domain.vercel.app'
    ];
    
    if (origin && allowedOrigins.some(o => origin.startsWith(o))) {
        return true;
    }

    return false;
}


// 允许跨域 (包含 PATCH)
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS', 'DELETE', 'PATCH'] }));
// 关键修改：增加 body-parser 限制，防止大文件上传报错
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

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

// Auth
app.post('/api/auth/login', loginHandler);

// Logs
app.post('/api/system-log', systemLogHandler);
app.get('/api/admin/system-logs', getSystemLogsHandler);

// Users
app.all('/api/create-user', createUserHandler);
app.all('/api/delete-user', deleteUserHandler);
app.all('/api/users', usersHandler); 

// Core Business - Search (✅ 应用鉴权)
app.post('/api/smart-search', (req, res, next) => {
    // 排除 OPTIONS 请求，防止 CORS 预检失败
    if (req.method === 'OPTIONS') return next();
    
    if (!checkAuth(req)) {
        return res.status(401).json({ 
            error: "Unauthorized: Invalid API Key. Please provide 'Authorization: Bearer <YOUR_SECRET>'." 
        });
    }
    next();
}, smartSearchHandler);

app.get('/api/config', configHandler);
app.get('/api/categories', categoriesHandler);
app.get('/api/suppliers', suppliersHandler);

// Alerts & Notices
app.all('/api/alerts', alertsHandler);
app.all('/api/notices', noticesHandler);

// Admin
app.patch('/api/admin/update-user', adminUpdateUserHandler);
app.post('/api/admin/manage-assignments', adminManageAssignmentsHandler);
app.all('/api/admin/feedback', adminFeedbackHandler);
app.all('/api/admin/system-notices', adminSystemNoticesHandler);

// Email
app.post('/api/send-alert-email', emailController.sendAlertEmail);
app.post('/api/send-email', emailController.sendGeneralEmail);

// Other Features
app.all('/api/audit-plans', auditPlansHandler);
app.all('/api/settings', settingsHandler);
app.all('/api/knowledge-base', knowledgeBaseHandler);
app.all('/api/file-sync/download', fileSyncHandler);
app.all('/api/ai/embedding', aiHandler);

app.post('/api/auth/reset-password', resetPasswordHandler);
app.post('/api/auth/update-password', updatePasswordHandler);

app.all('/api/chat/messages', chatMessagesHandler);
app.all('/api/chat/sessions', chatSessionsHandler);
app.post('/api/chat/ratings', chatRatingsHandler);

app.post('/api/ai/analyze-document', analyzeDocumentHandler);

// Historical Archive
app.post('/api/notices/archive-historical', archiveHistoricalHandler);

app.post('/api/file-sync/upload', fileUploadHandler);

app.all('/api/file-sync/files', filesHandler); // 新增
const PORT = process.env.PORT || 3001;

// Vercel 环境下不运行监听，仅导出 app
if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`✅ Local Backend running on http://localhost:${PORT}`);
    });
}

module.exports = app;