// module.exports = (req, res) => {
//     res.status(200).json({
//         status: 'Online',
//         message: 'Supplier Platform Backend on Vercel',
//         time: new Date().toISOString()
//     });
// };

// 1. 引入上一级目录的 server.js (这里面包含了您的完整 Express 应用)
const app = require('../server');

// 2. 导出 app
// Vercel 会自动识别这是一个 Express 实例，并将收到的 HTTP 请求转交给它处理
module.exports = app;