const COS = require('cos-nodejs-sdk-v5');

function requireEnv(name) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not configured`);
    return value;
}

function createCosClient() {
    return new COS({
        SecretId: requireEnv('TENCENT_COS_SECRET_ID'),
        SecretKey: requireEnv('TENCENT_COS_SECRET_KEY'),
    });
}

function getCosConfig() {
    return {
        Bucket: requireEnv('TENCENT_COS_BUCKET'),
        Region: requireEnv('TENCENT_COS_REGION'),
        publicBaseUrl: process.env.TENCENT_COS_PUBLIC_BASE_URL || '',
        uploadPrefix: process.env.TENCENT_COS_UPLOAD_PREFIX || 'uploads',
        signExpiresSeconds: Number(process.env.TENCENT_COS_SIGN_EXPIRES_SECONDS || 600),
    };
}

function buildObjectKey(parts) {
    return parts
        .filter(Boolean)
        .map(part => String(part).replace(/^\/+|\/+$/g, ''))
        .join('/');
}

function createPutObjectUrl({ key }) {
    const cos = createCosClient();
    const config = getCosConfig();

    return cos.getObjectUrl({
        Bucket: config.Bucket,
        Region: config.Region,
        Key: key,
        Method: 'PUT',
        Expires: config.signExpiresSeconds,
    });
}

function createGetObjectUrl({ key }) {
    const cos = createCosClient();
    const config = getCosConfig();

    return cos.getObjectUrl({
        Bucket: config.Bucket,
        Region: config.Region,
        Key: key,
        Method: 'GET',
        Expires: config.signExpiresSeconds,
    });
}

module.exports = {
    buildObjectKey,
    createGetObjectUrl,
    createPutObjectUrl,
    getCosConfig,
};
