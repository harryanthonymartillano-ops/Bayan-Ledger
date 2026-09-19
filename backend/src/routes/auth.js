"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = require("bcrypt");
const jsonwebtoken_1 = require("jsonwebtoken");
const crypto_1 = require("crypto");
const ethers_1 = require("ethers");
const config_js_1 = require("../db/config.js");
const logger_js_1 = require("../logger.js");
const auth_js_1 = require("../middleware/auth.js");
const router = (0, express_1.Router)();
const isAdminRole = (role) => {
    const normalized = role.trim().toLowerCase();
    return normalized === 'admin' || normalized === 'admin / hr';
};
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: 'Email and password required' });
            return;
        }
        const { data: user, error } = await config_js_1.supabase
            .from('users')
            .select('*')
            .eq('email', email.toLowerCase())
            .single();
        if (error || !user) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }
        const isValidPassword = await bcrypt_1.compare(password, user.password_hash);
        if (!isValidPassword) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }
        await config_js_1.supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', user.id);
        const token = jsonwebtoken_1.sign({
            id: user.id,
            email: user.email,
            role: user.role,
            walletAddress: user.wallet_address,
            status: user.status,
        }, process.env.JWT_SECRET, { expiresIn: '7d' });
        logger_js_1.logger.info(`User logged in: ${user.email} (${user.role})`);
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                walletAddress: user.wallet_address,
                status: user.status,
            },
        });
    }
    catch (error) {
        logger_js_1.logger.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});
router.post('/register', auth_js_1.authenticateToken, async (req, res) => {
    try {
        if (!req.user || !isAdminRole(req.user.role)) {
            res.status(403).json({ error: 'Admin access required' });
            return;
        }
        const { email, password, role, walletAddress, firstName, middleName, lastName } = req.body;
        if (!email || !password || !role) {
            res.status(400).json({ error: 'Email, password, and role required' });
            return;
        }
        const saltRounds = 12;
        const passwordHash = await (0, bcrypt_1.hash)(password, saltRounds);
        const { data: user, error } = await config_js_1.supabase
            .from('users')
            .insert({
            email: email.toLowerCase(),
            password_hash: passwordHash,
            wallet_address: walletAddress ? walletAddress.toLowerCase() : null,
            first_name: firstName || null,
            middle_name: middleName || null,
            last_name: lastName || null,
            role,
            status: 'Active',
            chain_role_granted: false,
        })
            .select()
            .single();
        if (error) {
            if (error.code === '23505') {
                res.status(409).json({ error: 'Email already exists' });
                return;
            }
            throw error;
        }
        logger_js_1.logger.info(`New user registered: ${user.email} (${user.role})`);
        res.status(201).json({
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                wallet_address: user.wallet_address,
            },
        });
    }
    catch (error) {
        logger_js_1.logger.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});
router.get('/profile', auth_js_1.authenticateTokenAllowInactive, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const { data: user, error } = await config_js_1.supabase
            .from('users')
            .select('id, email, role, wallet_address, status, last_login, created_at')
            .eq('id', req.user.id)
            .single();
        if (error || !user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json({ user });
    }
    catch (error) {
        logger_js_1.logger.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});
router.get('/users', auth_js_1.authenticateToken, async (req, res) => {
    try {
        if (!req.user || !isAdminRole(req.user.role)) {
            res.status(403).json({ error: 'Admin access required' });
            return;
        }
        const { data: users, error } = await config_js_1.supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        res.json({ users });
    }
    catch (error) {
        logger_js_1.logger.error('Users fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});
router.get('/me', auth_js_1.authenticateTokenAllowInactive, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const { data: user, error } = await config_js_1.supabase
            .from('users')
            .select('*')
            .eq('id', req.user.id)
            .single();
        if (error) {
            throw error;
        }
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json({
            id: user.id,
            email: user.email,
            role: user.role,
            walletAddress: user.wallet_address,
            firstName: user.first_name,
            middleName: user.middle_name,
            lastName: user.last_name,
            chainRoleGranted: user.chain_role_granted,
            chainRoleGrantedAt: user.chain_role_granted_at,
            status: user.status,
        });
    }
    catch (error) {
        logger_js_1.logger.error('Me fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});
router.post('/wallet-link/challenge', auth_js_1.authenticateTokenAllowInactive, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const nonce = (0, crypto_1.randomBytes)(16).toString('hex');
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        const { error } = await config_js_1.supabase
            .from('users')
            .update({
            wallet_link_nonce: nonce,
            wallet_link_nonce_expires_at: expiresAt,
        })
            .eq('id', req.user.id);
        if (error) {
            throw error;
        }
        res.json({
            nonce,
            message: `StaCruz Chain wallet link request:${nonce}`,
            expiresAt,
        });
    }
    catch (error) {
        logger_js_1.logger.error('Wallet challenge generation error:', error);
        res.status(500).json({ error: 'Failed to generate wallet link challenge' });
    }
});
router.patch('/users/:id/status', auth_js_1.authenticateToken, async (req, res) => {
    try {
        if (!req.user || !isAdminRole(req.user.role)) {
            res.status(403).json({ error: 'Admin access required' });
            return;
        }
        const { id } = req.params;
        const { status } = req.body;
        if (status !== 'Active' && status !== 'Inactive') {
            res.status(400).json({ error: 'Valid status is required' });
            return;
        }
        const { data, error } = await config_js_1.supabase
            .from('users')
            .update({ status })
            .eq('id', id)
            .select('*')
            .single();
        if (error) {
            throw error;
        }
        await config_js_1.supabase.from('audit_logs').insert({
            user_id: req.user.id,
            action: 'USER_STATUS_UPDATED',
            resource_type: 'user',
            resource_id: id,
            details: { status },
        });
        res.json({ user: data });
    }
    catch (error) {
        logger_js_1.logger.error('User status update error:', error);
        res.status(500).json({ error: 'Failed to update user status' });
    }
});
router.post('/wallet-link/verify', auth_js_1.authenticateTokenAllowInactive, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const { walletAddress, signature } = req.body;
        if (!walletAddress || !signature) {
            res.status(400).json({ error: 'walletAddress and signature are required' });
            return;
        }
        const { data: user, error: userError } = await config_js_1.supabase
            .from('users')
            .select('id, wallet_link_nonce, wallet_link_nonce_expires_at')
            .eq('id', req.user.id)
            .single();
        if (userError || !(user === null || user === void 0 ? void 0 : user.wallet_link_nonce)) {
            res.status(400).json({ error: 'No active wallet link challenge found' });
            return;
        }
        const expiresAt = user.wallet_link_nonce_expires_at ? new Date(user.wallet_link_nonce_expires_at).getTime() : 0;
        if (!expiresAt || expiresAt < Date.now()) {
            res.status(400).json({ error: 'Wallet link challenge has expired' });
            return;
        }
        const expectedMessage = `StaCruz Chain wallet link request:${user.wallet_link_nonce}`;
        const recoveredAddress = ethers_1.ethers.utils.verifyMessage(expectedMessage, signature);
        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            res.status(400).json({ error: 'Signature does not match wallet address' });
            return;
        }
        const { error: updateError } = await config_js_1.supabase
            .from('users')
            .update({
            wallet_address: walletAddress.toLowerCase(),
            wallet_link_nonce: null,
            wallet_link_nonce_expires_at: null,
        })
            .eq('id', req.user.id);
        if (updateError) {
            throw updateError;
        }
        await config_js_1.supabase.from('audit_logs').insert({
            user_id: req.user.id,
            action: 'WALLET_LINKED',
            resource_type: 'user',
            resource_id: req.user.id,
            details: { walletAddress: walletAddress.toLowerCase() },
        });
        res.json({ walletAddress: walletAddress.toLowerCase(), linked: true });
    }
    catch (error) {
        logger_js_1.logger.error('Wallet link verification error:', error);
        res.status(500).json({ error: 'Failed to verify wallet link' });
    }
});
router.patch('/users/:id/chain-role', auth_js_1.authenticateToken, async (req, res) => {
    try {
        if (!req.user || !isAdminRole(req.user.role)) {
            res.status(403).json({ error: 'Admin access required' });
            return;
        }
        const { id } = req.params;
        const { chainRoleGranted, walletAddress } = req.body;
        const { data, error } = await config_js_1.supabase
            .from('users')
            .update({
            chain_role_granted: Boolean(chainRoleGranted),
            chain_role_granted_at: chainRoleGranted ? new Date().toISOString() : null,
            wallet_address: walletAddress ? String(walletAddress).toLowerCase() : undefined,
        })
            .eq('id', id)
            .select('id, email, role, wallet_address, chain_role_granted, chain_role_granted_at')
            .single();
        if (error) {
            throw error;
        }
        await config_js_1.supabase.from('audit_logs').insert({
            user_id: req.user.id,
            action: 'CHAIN_ROLE_STATUS_UPDATED',
            resource_type: 'user',
            resource_id: id,
            details: { chainRoleGranted: Boolean(chainRoleGranted), walletAddress: data.wallet_address },
        });
        res.json({ user: data });
    }
    catch (error) {
        logger_js_1.logger.error('Chain role update error:', error);
        res.status(500).json({ error: 'Failed to update chain role status' });
    }
});
router.delete('/users/:id', auth_js_1.authenticateToken, async (req, res) => {
    try {
        if (!req.user || !isAdminRole(req.user.role)) {
            res.status(403).json({ error: 'Admin access required' });
            return;
        }
        const { id } = req.params;
        if (id === req.user.id) {
            res.status(400).json({ error: 'You cannot delete your own account' });
            return;
        }
        const { data: existingUser, error: fetchError } = await config_js_1.supabase
            .from('users')
            .select('id, email, role')
            .eq('id', id)
            .single();
        if (fetchError || !existingUser) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const { error } = await config_js_1.supabase
            .from('users')
            .delete()
            .eq('id', id);
        if (error) {
            throw error;
        }
        await config_js_1.supabase.from('audit_logs').insert({
            user_id: req.user.id,
            action: 'USER_DELETED',
            resource_type: 'user',
            resource_id: id,
            details: { email: existingUser.email, role: existingUser.role },
        });
        res.json({ deleted: true, id });
    }
    catch (error) {
        logger_js_1.logger.error('User delete error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});
exports.default = router;
