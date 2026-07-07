const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_URL = isDev ? 'http://localhost:3001' : window.location.origin;
const SIGN_CACHE_TTL_MS = 8 * 60 * 1000;
const signedUrlCache = new Map();

const getContentType = (file) => file?.type || 'application/octet-stream';

const getCurrentUser = () => {
    try {
        return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
        return null;
    }
};

const buildAuth = () => {
    const token = localStorage.getItem('access_token');
    const currentUser = getCurrentUser();
    if (!token) {
        throw new Error('登录凭证丢失，请重新登录');
    }

    return {
        token,
        userId: currentUser?.id || null,
    };
};

const signedRequest = async (body) => {
    const auth = buildAuth();
    const response = await fetch(`${BACKEND_URL}/api/cos/upload-url`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${auth.token}`,
            'X-User-Id': auth.userId || '',
        },
        body: JSON.stringify({
            ...body,
            userId: auth.userId,
        }),
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'COS 签名请求失败');
    }

    return response.json();
};

const getFileUrl = (file) => typeof file === 'string'
    ? file
    : (file?.url || file?.thumbUrl || '');

const getFileKey = (file) => typeof file === 'object'
    ? (file?.cosKey || file?.key || '')
    : '';

const isCosFile = (file) => {
    const url = getFileUrl(file);
    return !!getFileKey(file) || /\.cos\.[^.]+\.myqcloud\.com/.test(url);
};

const getCacheKey = (file) => getFileKey(file) || getFileUrl(file);

const getCachedSignedUrl = (file) => {
    const cacheKey = getCacheKey(file);
    if (!cacheKey) return null;

    const cached = signedUrlCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.url;
    }

    signedUrlCache.delete(cacheKey);
    return null;
};

const setCachedSignedUrl = (file, signedUrl) => {
    const cacheKey = getCacheKey(file);
    if (!cacheKey || !signedUrl) return;

    signedUrlCache.set(cacheKey, {
        url: signedUrl,
        expiresAt: Date.now() + SIGN_CACHE_TTL_MS,
    });
};

export const uploadFileToCos = async (file, originalName, options = {}) => {
    if (!file) {
        throw new Error('No file provided for COS upload');
    }

    const fileName = originalName || file.name || 'file';
    const contentType = getContentType(file);
    const uploadConfig = await signedRequest({
        fileName,
        contentType,
        folder: options.folder || 'uploads',
    });

    const uploadResponse = await fetch(uploadConfig.uploadUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': contentType,
        },
        body: file,
    });

    if (!uploadResponse.ok) {
        throw new Error(`COS 上传失败：${uploadResponse.status}`);
    }

    return {
        url: uploadConfig.publicUrl,
        key: uploadConfig.key,
        bucket: uploadConfig.bucket,
        region: uploadConfig.region,
    };
};

export const getCosSignedReadUrl = async (file) => {
    if (!isCosFile(file)) return getFileUrl(file);

    const cachedUrl = getCachedSignedUrl(file);
    if (cachedUrl) return cachedUrl;

    const data = await signedRequest({
        intent: 'download',
        key: getFileKey(file),
        url: getFileUrl(file),
    });

    const signedUrl = data.signedUrl || getFileUrl(file);
    setCachedSignedUrl(file, signedUrl);
    return signedUrl;
};

export const signCosFileList = async (files = []) => {
    if (!Array.isArray(files) || files.length === 0) return files || [];

    const result = [...files];
    const filesToSign = [];
    const indexesToSign = [];

    files.forEach((file, index) => {
        if (!isCosFile(file)) return;

        const cachedUrl = getCachedSignedUrl(file);
        if (cachedUrl) {
            result[index] = typeof file === 'string'
                ? cachedUrl
                : { ...file, originalUrl: file.url, url: cachedUrl, thumbUrl: cachedUrl };
            return;
        }

        filesToSign.push({
            key: getFileKey(file),
            url: getFileUrl(file),
        });
        indexesToSign.push(index);
    });

    if (filesToSign.length > 0) {
        const data = await signedRequest({
            intent: 'download',
            files: filesToSign,
        });

        (data.files || []).forEach((signedFile, responseIndex) => {
            const originalIndex = indexesToSign[responseIndex];
            const originalFile = files[originalIndex];
            const signedUrl = signedFile.signedUrl || getFileUrl(originalFile);

            setCachedSignedUrl(originalFile, signedUrl);
            result[originalIndex] = typeof originalFile === 'string'
                ? signedUrl
                : {
                    ...originalFile,
                    originalUrl: originalFile.url,
                    url: signedUrl,
                    thumbUrl: signedUrl,
                };
        });
    }

    return result;
};
