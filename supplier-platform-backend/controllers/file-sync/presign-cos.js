const cors = require('cors');
const {
    buildObjectKey,
    createGetObjectUrl,
    createPutObjectUrl,
    getCosConfig,
} = require('../../lib/tencent-cos');

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

function sanitizeFileName(fileName) {
    return String(fileName || 'file')
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, '_')
        .slice(0, 180);
}

module.exports = async (req, res) => {
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        await runMiddleware(req, res, corsMiddleware);

        const { targetUserId, fileName, contentType, intent = 'upload' } = req.body || {};
        if (!targetUserId || !fileName) {
            return res.status(400).json({ error: 'Missing targetUserId or fileName' });
        }

        const config = getCosConfig();
        const key = buildObjectKey([
            config.uploadPrefix,
            targetUserId,
            `${Date.now()}-${sanitizeFileName(fileName)}`,
        ]);

        const signedUrl = intent === 'download'
            ? createGetObjectUrl({ key })
            : createPutObjectUrl({ key, contentType });

        return res.json({
            key,
            method: intent === 'download' ? 'GET' : 'PUT',
            signedUrl,
            publicUrl: config.publicBaseUrl ? `${config.publicBaseUrl.replace(/\/$/, '')}/${key}` : null,
            expiresIn: config.signExpiresSeconds,
        });
    } catch (error) {
        console.error('[COS Presign API] Error:', error);
        return res.status(500).json({ error: error.message });
    }
};
