// supplier-platform-backend/controllers/file-sync/upload.js
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const cors = require('cors');

// 配置 multer：使用内存存储，因为我们要直接转传给 Supabase
const upload = multer({ storage: multer.memoryStorage() });

const corsMiddleware = cors({
    origin: true,
    methods: ['POST', 'OPTIONS'],
    credentials: true,
});

function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) return reject(result);
            return resolve(result);
        });
    });
}

// 核心处理函数
const handleUpload = async (req, res) => {
    // CORS Headers
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await runMiddleware(req, res, corsMiddleware);

        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // 1. 获取参数 (multer 解析后的 req.file 和 req.body)
        const file = req.file;
        const { targetUserId } = req.body;

        if (!file || !targetUserId) {
            return res.status(400).json({ error: 'Missing file or targetUserId' });
        }

        // 2. 生成文件名和路径
        const fileExt = file.originalname.split('.').pop();
        // 处理文件名中的非 ASCII 字符，防止报错
        const safeOriginalName = Buffer.from(file.originalname, 'latin1').toString('utf8'); 
        const safeFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
        const filePath = `${targetUserId}/${safeFileName}`;

        // 3. 上传到 Supabase Storage
        const { error: uploadError } = await supabaseAdmin.storage
            .from('file_sync')
            .upload(filePath, file.buffer, {
                contentType: file.mimetype
            });

        if (uploadError) throw uploadError;

        // 4. 写入数据库记录 (触发 PC 端 Realtime)
        const { error: insertError } = await supabaseAdmin
            .from('user_files')
            .insert({
                user_id: targetUserId,
                file_name: file.originalname, // 使用原始文件名方便用户识别
                file_path: filePath,
                source_device: 'mobile_scan'
            });

        if (insertError) throw insertError;

        return res.json({ success: true });

        

    } catch (error) {
        console.error('[Mobile Upload Error]', error);
        res.status(500).json({ error: error.message });
    }
};

// 导出：先经过 multer 中间件，再进入 handleUpload
module.exports = [upload.single('file'), handleUpload];