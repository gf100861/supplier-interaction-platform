const { createClient } = require('@supabase/supabase-js');

// 1. 在这里初始化 Supabase Admin
// (虽然 server.js 里也有，但模块化后这里需要独立的实例，或者你可以单独搞一个 utils/db.js 来共享)
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 2. 导出处理函数 (Handler)
// 注意：这里不需要再写 CORS 中间件，因为 server.js 里的 app.use(cors(...)) 已经全局处理了
module.exports = async (req, res) => {
    try {
        // 简单的数据校验
        if (!req.body) {
            return res.status(400).json({ error: 'Request body is empty' });
        }

        const logData = req.body;
        
        // 异步写入
        const { error } = await supabaseAdmin.from('system_logs').insert([logData]);

        if (error) {
            console.error('[Log] Insert failed:', error.message);
            return res.status(500).json({ error: error.message });
        }

        res.json({ success: true });

    } catch (error) {
        console.error('[Log] Handler error:', error);
        // 确保只有在 headers 没发送过的情况下才发送错误响应
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
};