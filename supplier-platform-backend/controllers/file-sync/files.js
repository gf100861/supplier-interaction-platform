// supplier-platform-backend/controllers/file-sync/files.js
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const corsMiddleware = cors({
    origin: true,
    methods: ['GET', 'DELETE', 'OPTIONS'],
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

module.exports = async (req, res) => {
    // CORS Headers
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await runMiddleware(req, res, corsMiddleware);

        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // ✅ [新增] POST: 生成下载链接 (Signed URL)
        // 我们利用 POST 请求来区分，或者在 body 里加 action
        if (req.method === 'POST') {
            const { action, filePath } = req.body;

            if (action === 'download') {
                if (!filePath) return res.status(400).json({ error: 'Missing filePath' });

                // 生成一个有效期为 60 秒的临时链接
                const { data, error } = await supabaseAdmin.storage
                    .from('file_sync')
                    .createSignedUrl(filePath, 60);

                if (error) throw error;

                // 返回这个安全的临时链接
                return res.json({ downloadUrl: data.signedUrl });
            }
        }

        // ==========================================
        // GET: 获取用户的同步文件列表
        // ==========================================
        if (req.method === 'GET') {
            const { userId } = req.query;
            
            if (!userId) {
                return res.status(400).json({ error: 'Missing userId' });
            }

            const { data, error } = await supabaseAdmin
                .from('user_files')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return res.json(data);
        }

        // ==========================================
        // DELETE: 删除文件 (同时删 DB 和 Storage)
        // ==========================================
        if (req.method === 'DELETE') {
            const { fileId, filePath } = req.body;

            if (!fileId || !filePath) {
                return res.status(400).json({ error: 'Missing fileId or filePath' });
            }

            // 1. 从 Storage 删除
            const { error: storageError } = await supabaseAdmin.storage
                .from('file_sync')
                .remove([filePath]);

            if (storageError) {
                console.error("Storage delete failed:", storageError);
                // 这里可以选择继续删 DB，或者报错
            }

            // 2. 从 DB 删除
            const { error: dbError } = await supabaseAdmin
                .from('user_files')
                .delete()
                .eq('id', fileId);

            if (dbError) throw dbError;

            return res.json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('[Files API] Error:', error);
        res.status(500).json({ error: error.message });
    }
};