const jwt = require('jsonwebtoken');

function getJwtSecret() {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured');
    }
    return process.env.JWT_SECRET;
}

function signAccessToken(payload, options = {}) {
    return jwt.sign(payload, getJwtSecret(), {
        expiresIn: process.env.JWT_EXPIRES_IN || '8h',
        ...options,
    });
}

function verifyAccessToken(token) {
    return jwt.verify(token, getJwtSecret());
}

function getBearerToken(req) {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) return null;
    return authHeader.slice('Bearer '.length).trim();
}

module.exports = {
    getBearerToken,
    signAccessToken,
    verifyAccessToken,
};
