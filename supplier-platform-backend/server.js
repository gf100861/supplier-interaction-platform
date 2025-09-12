const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const { mockUsers, mockNoticesData, suppliersList, mockEventsData, noticeCategoryDetails, noticeCategories } = require('./_mockData');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST", "PUT"]
    }
});

app.use(cors());

// Increase the limit for JSON and URL-encoded payloads to 50mb
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

const PORT = 3001;

// --- 核心修正：在这里声明用于存储提醒数据的数组 ---
let alertsData = [];

// --- API 端点 (已添加详细日志) ---

// --- 用户认证 ---
app.post('/api/login', (req, res) => {
    const { username, password, role } = req.body;
    console.log(`[API-IN] /api/login: User trying to log in: ${username}`);
    const user = mockUsers[username];
    if (user && user.password === password && user.role === role) {
        const userData = { username, name: user.name, role: user.role, id: user.id, token: `fake-jwt-token-${Date.now()}` };
        console.log(`[API-OUT] /api/login: ✅ Authentication successful for ${username}`);
        res.status(200).json(userData);
    } else {
        console.log(`[API-OUT] /api/login: ❌ Authentication failed for ${username}`);
        res.status(401).json({ message: '用户名、密码或角色错误！' });
    }
});

// --- 数据获取 ---
app.get('/api/notices', (req, res) => {
    console.log(`[API-IN] /api/notices: Request to get all notices.`);
    console.log(`[API-OUT] /api/notices: ✅ Responding with ${mockNoticesData.length} notices.`);
    res.status(200).json(mockNoticesData);
});

app.get('/api/suppliers', (req, res) => {
    console.log(`[API-IN] /api/suppliers: Request to get all suppliers.`);
    console.log(`[API-OUT] /api/suppliers: ✅ Responding with ${suppliersList.length} suppliers.`);
    res.status(200).json(suppliersList);
});

app.get('/api/events', (req, res) => {
    console.log(`[API-IN] /api/events: Request to get all events.`);
    console.log(`[API-OUT] /api/events: ✅ Responding with ${mockEventsData.length} events.`);
    res.status(200).json(mockEventsData);
});

app.get('/api/config', (req, res) => {
    console.log(`[API-IN] /api/config: Request to get app configuration.`);
    console.log(`[API-OUT] /api/config: ✅ Responding with configuration data.`);
    res.status(200).json({ noticeCategories, noticeCategoryDetails });
});

// --- 提醒(Alerts)相关的 API ---
app.get('/api/alerts/:userId', (req, res) => {
    const { userId } = req.params;
    console.log(`[API-IN] /api/alerts: Request to get alerts for user ID: ${userId}`);
    const userAlerts = alertsData.filter(a => a.recipientId === userId);
    console.log(`[API-OUT] /api/alerts: ✅ Found ${userAlerts.length} alerts for user ${userId}.`);
    res.status(200).json(userAlerts);
});

// API Endpoint for creating alerts
app.post('/api/alerts', (req, res) => {
    const newAlert = req.body;
    alertsData.unshift(newAlert);
    
    // --- 在这里增加日志 ---
    console.log(`✅ [BACKEND-CHECKPOINT-1] 准备向所有客户端广播 'new_alert' 事件...`);
    io.emit('new_alert', newAlert);
    console.log(`✅ [BACKEND-CHECKPOINT-1] 'new_alert' 事件已发送！`);
    
    res.status(201).json(newAlert);
});

app.put('/api/notices/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    console.log(`[API-IN] /api/notices/${id}: Request to update notice.`);
    console.log(" -> Received updates:", updates);
    const noticeIndex = mockNoticesData.findIndex(n => n.id === id);
    if (noticeIndex === -1) {
        console.log(`[API-OUT] /api/notices/${id}: ❌ Notice with ID ${id} not found.`);
        return res.status(404).json({ message: "未找到指定的通知单" });
    }
    mockNoticesData[noticeIndex] = { ...mockNoticesData[noticeIndex], ...updates };
    const updatedNotice = mockNoticesData[noticeIndex];
    console.log(`[WebSocket] 📡 Broadcasting 'notice_updated' for notice ID: ${id}`);
    io.emit('notice_updated', updatedNotice);
    console.log(`[API-OUT] /api/notices/${id}: ✅ Notice updated and broadcasted successfully.`);
    res.status(200).json(updatedNotice);
});
 

app.post('/api/notices/batch', (req, res) => {
    const newNotices = req.body;
    console.log(`[API-IN] /api/notices/batch: Request to create ${newNotices.length} notices.`);
    if (!Array.isArray(newNotices) || newNotices.length === 0) {
        console.log(`[API-OUT] /api/notices/batch: ❌ Invalid request body.`);
        return res.status(400).json({ message: "请求体必须是一个非空数组" });
    }
    mockNoticesData.push(...newNotices);
    console.log(`[WebSocket] 📡 Broadcasting 'notices_added' with ${newNotices.length} new notices.`);
    io.emit('notices_added', newNotices);
    console.log(`[API-OUT] /api/notices/batch: ✅ Batch notices created and broadcasted successfully.`);
    res.status(201).json({ message: "批量创建成功", data: newNotices });
});

// --- WebSocket 连接逻辑 ---
io.on('connection', (socket) => {
    // 房间逻辑可以暂时保留，以备未来更复杂的场景
    const userId = socket.handshake.query.userId;
    if (userId) {
        console.log(`[WebSocket] ✅ User ${userId} connected (Socket ID: ${socket.id}) and joined room: ${userId}`);
        socket.join(userId);
    } else {
        console.log(`[WebSocket] ⚠️ Anonymous user connected (Socket ID: ${socket.id})`);
    }
    socket.on('disconnect', () => {
        console.log(`[WebSocket] ❌ User ${userId || 'anonymous'} disconnected (Socket ID: ${socket.id})`);
    });
});

server.listen(PORT, () => {
    console.log(`\n✅ 后端服务器已成功启动！`);
    console.log(`   - 正在监听端口: ${PORT}`);
    console.log(`   - API 地址: http://localhost:${PORT}`);
});