const COS = require('cos-nodejs-sdk-v5');
const { createClient } = require('@supabase/supabase-js');

const getEnv = (...names) => {
    for (const name of names) {
        if (process.env[name]) return process.env[name];
    }
    return '';
};

const sanitizeFileName = (name = 'file') => {
    const safeName = String(name)
        .replace(/[\\/:*?"<>|#%{}^~[\]`]/g, '_')
        .replace(/\s+/g, '_')
        .slice(-120);
    return safeName || 'file';
};

const normalizeRegion = (region = '') => {
    const value = String(region).trim();
    if (/^[a-z]+-[a-z]+(?:-\d+)?$/.test(value)) {
        return value;
    }

    const match = value.match(/\b[a-z]+-[a-z]+(?:-\d+)?\b/);
    return match ? match[0] : value;
};

const buildCosClient = () => {
    const SecretId = getEnv('TENCENT_COS_SECRET_ID', 'TENCENT_SECRET_ID');
    const SecretKey = getEnv('TENCENT_COS_SECRET_KEY', 'TENCENT_SECRET_KEY');

    if (!SecretId || !SecretKey) {
        throw new Error('Tencent COS credentials are not configured');
    }

    return new COS({ SecretId, SecretKey });
};

const verifySupabaseToken = async (req) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const fallbackUserId = req.headers['x-user-id'] || req.body?.userId;

    if (!token) {
        return null;
    }

    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
        if (!fallbackUserId) {
            console.warn('[COS Upload URL] Supabase token verification failed:', error?.message);
            return null;
        }

        const { data: profile, error: profileError } = await supabaseAdmin
            .from('users')
            .select('id,email,username,role')
            .eq('id', fallbackUserId)
            .single();

        if (profileError || !profile) {
            console.warn('[COS Upload URL] Fallback user lookup failed:', profileError?.message);
            return null;
        }

        console.warn('[COS Upload URL] Used fallback user lookup after token verification failed');
        return profile;
    }

    return data.user;
};

const getSignedPutUrl = (cos, params) => new Promise((resolve, reject) => {
    cos.getObjectUrl(params, (err, data) => {
        if (err) return reject(err);
        const url = data?.Url || data?.url;
        if (!url) return reject(new Error('Tencent COS did not return a signed URL'));
        resolve(url.startsWith('http') ? url : `https://${url}`);
    });
});

const getSignedGetUrl = (cos, params) => new Promise((resolve, reject) => {
    cos.getObjectUrl(params, (err, data) => {
        if (err) return reject(err);
        const url = data?.Url || data?.url;
        if (!url) return reject(new Error('Tencent COS did not return a signed URL'));
        resolve(url.startsWith('http') ? url : `https://${url}`);
    });
});

const getKeyFromUrl = (fileUrl, publicBaseUrl) => {
    if (!fileUrl) return '';

    try {
        const parsed = new URL(fileUrl);
        return decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
    } catch {
        const base = String(publicBaseUrl || '').replace(/\/$/, '');
        return String(fileUrl).replace(base, '').replace(/^\/+/, '').split('?')[0];
    }
};

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const user = await verifySupabaseToken(req);
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized: please log in again' });
        }

        const Bucket = getEnv('TENCENT_COS_BUCKET');
        const Region = normalizeRegion(getEnv('TENCENT_COS_REGION'));
        const PublicBaseUrl = getEnv('TENCENT_COS_PUBLIC_BASE_URL') || (
            Bucket && Region ? `https://${Bucket}.cos.${Region}.myqcloud.com` : ''
        );

        if (!Bucket || !Region || !PublicBaseUrl) {
            return res.status(500).json({ error: 'Tencent COS bucket configuration is incomplete' });
        }

        if (!/^[a-z]+-[a-z]+(?:-\d+)?$/.test(Region)) {
            return res.status(500).json({
                error: `Invalid TENCENT_COS_REGION: "${Region}". Expected format like "ap-shanghai".`,
            });
        }

        const { fileName, contentType, folder = 'uploads', intent = 'upload', key, url } = req.body || {};
        const cos = buildCosClient();

        if (intent === 'download') {
            const files = Array.isArray(req.body?.files) ? req.body.files : null;

            const signOne = async (item = {}, index = 0) => {
                const objectKey = String(
                    item.key
                    || item.cosKey
                    || getKeyFromUrl(item.url || item.thumbUrl || '', PublicBaseUrl)
                ).replace(/^\/+/, '');

                if (!objectKey) {
                    return { index, signedUrl: item.url || '', key: '' };
                }

                const signedUrl = await getSignedGetUrl(cos, {
                    Bucket,
                    Region,
                    Key: objectKey,
                    Method: 'GET',
                    Sign: true,
                    Expires: 600,
                });

                return {
                    index,
                    signedUrl,
                    key: objectKey,
                    expiresIn: 600,
                };
            };

            if (files) {
                const signedFiles = await Promise.all(files.map(signOne));
                return res.status(200).json({
                    files: signedFiles,
                    expiresIn: 600,
                });
            }

            const objectKey = String(key || getKeyFromUrl(url, PublicBaseUrl)).replace(/^\/+/, '');
            if (!objectKey) {
                return res.status(400).json({ error: 'Missing COS object key or url' });
            }

            const signedUrl = await getSignedGetUrl(cos, {
                Bucket,
                Region,
                Key: objectKey,
                Method: 'GET',
                Sign: true,
                Expires: 600,
            });

            return res.status(200).json({
                signedUrl,
                key: objectKey,
                expiresIn: 600,
            });
        }

        const safeFileName = sanitizeFileName(fileName);
        const safeFolder = String(folder).replace(/[^a-zA-Z0-9/_-]/g, '').replace(/^\/+|\/+$/g, '') || 'uploads';
        const today = new Date().toISOString().slice(0, 10);
        const random = Math.random().toString(36).slice(2, 10);
        const Key = `${safeFolder}/${today}/${Date.now()}_${random}_${safeFileName}`;

        const uploadUrl = await getSignedPutUrl(cos, {
            Bucket,
            Region,
            Key,
            Method: 'PUT',
            Sign: true,
            Expires: 600,
            Headers: contentType ? { 'Content-Type': contentType } : undefined,
        });

        return res.status(200).json({
            uploadUrl,
            publicUrl: `${PublicBaseUrl.replace(/\/$/, '')}/${Key}`,
            key: Key,
            bucket: Bucket,
            region: Region,
            expiresIn: 600,
        });
    } catch (error) {
        console.error('[COS Upload URL] Error:', error);
        return res.status(500).json({ error: error.message || 'Failed to create COS upload URL' });
    }
};
