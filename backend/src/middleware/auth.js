"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.requireRole = exports.authenticateTokenAllowInactive = exports.authenticateToken = void 0;
const jsonwebtoken_1 = require("jsonwebtoken");
const config_js_1 = require("../db/config.js");
const extractBearerToken = (req) => {
    const authHeader = req.headers['authorization'];
    return authHeader && authHeader.split(' ')[1];
};
const verifyJwt = (token) => jsonwebtoken_1.verify(token, process.env.JWT_SECRET);
const loadCurrentUser = async (id) => {
    const { data: user, error } = await config_js_1.supabase
        .from('users')
        .select('id, email, role, wallet_address, status')
        .eq('id', id)
        .single();
    if (error || !user) {
        return null;
    }
    return {
        id: user.id,
        email: user.email,
        role: user.role,
        walletAddress: user.wallet_address || undefined,
        status: user.status === 'Inactive' ? 'Inactive' : 'Active',
    };
};
const buildAuthenticator = (options) => async (req, res, next) => {
    const token = extractBearerToken(req);
    if (!token) {
        res.status(401).json({ error: 'Access token required' });
        return;
    }
    try {
        const decoded = verifyJwt(token);
        const currentUser = await loadCurrentUser(decoded.id);
        if (!currentUser) {
            res.status(401).json({ error: 'User not found' });
            return;
        }
        if (!(options === null || options === void 0 ? void 0 : options.allowInactive) && currentUser.status !== 'Active') {
            res.status(403).json({ error: 'Account is not active' });
            return;
        }
        req.user = currentUser;
        next();
    }
    catch (_error) {
        res.status(403).json({ error: 'Invalid or expired token' });
    }
};
const authenticateToken = buildAuthenticator();
exports.authenticateToken = authenticateToken;
const authenticateTokenAllowInactive = buildAuthenticator({ allowInactive: true });
exports.authenticateTokenAllowInactive = authenticateTokenAllowInactive;
const normalizeRole = (role) => role.trim().toLowerCase();
const roleMatches = (requiredRole, actualRole) => {
    const required = normalizeRole(requiredRole);
    const actual = normalizeRole(actualRole);
    if (required === actual)
        return true;
    if (required === 'admin') {
        return actual === 'admin' || actual === 'admin / hr';
    }
    if (required === 'official') {
        return [
            'mpdc (planning)',
            'budget officer',
            'treasurer',
            'admin / hr',
            'admin',
        ].includes(actual);
    }
    return false;
};
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        if (!roles.some((role) => roleMatches(role, req.user.role))) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
const optionalAuth = async (req, _res, next) => {
    const token = extractBearerToken(req);
    if (!token) {
        next();
        return;
    }
    try {
        const decoded = verifyJwt(token);
        const currentUser = await loadCurrentUser(decoded.id);
        if (currentUser) {
            req.user = currentUser;
        }
    }
    catch (_error) {
    }
    next();
};
exports.optionalAuth = optionalAuth;
