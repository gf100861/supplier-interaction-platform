// supplier-platform-backend/controllers/file-sync.js
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

// Standard middleware setup (same as your other controllers)
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

module.exports = async (req, res) => {
    // Basic CORS headers
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

        if (req.method === 'POST') {
            const { filePath } = req.body;

            if (!filePath) {
                return res.status(400).json({ error: 'Missing filePath' });
            }

            // Generate a signed URL valid for 60 seconds
            const { data, error } = await supabaseAdmin
                .storage
                .from('file_sync')
                .createSignedUrl(filePath, 60, {
                    download: true // This forces the browser to download, not just view
                });

            if (error) throw error;

            return res.json({ downloadUrl: data.signedUrl });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('[FileSync API] Error:', error);
        res.status(500).json({ error: error.message });
    }
};