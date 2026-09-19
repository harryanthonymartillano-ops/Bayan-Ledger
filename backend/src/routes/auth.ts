import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { ethers } from 'ethers';
import { supabase } from '../db/config';
import { logger } from '../logger';
import { authenticateToken, authenticateTokenAllowInactive, AuthRequest } from '../middleware/auth';

const router = Router();
const isAdminRole = (role: string) => {
  const normalized = role.trim().toLowerCase();
  return normalized === 'admin' || normalized === 'admin / hr';
};

// Login with email and password
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    // Find user by email
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Check if account is active
    if (user.status === 'Inactive') {
      res.status(403).json({ error: 'Account is inactive. Contact an administrator.' });
      return;
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        walletAddress: user.wallet_address,
        status: user.status,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' } as any
    );

    logger.info(`User logged in: ${user.email} (${user.role})`);

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
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Register new user (admin only)
router.post('/register', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !isAdminRole(req.user.role)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const {
      email,
      password,
      role,
      walletAddress,
      firstName,
      middleName,
      lastName,
      chainRoleGranted,
      chainRoleGrantTxHash,
    } = req.body;

    if (!email || !password || !role) {
      res.status(400).json({ error: 'Email, password, and role required' });
      return;
    }

    if (!walletAddress) {
      res.status(400).json({ error: 'Wallet address is required' });
      return;
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const now = new Date().toISOString();
    const { data: user, error } = await supabase
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
        chain_role_granted: Boolean(chainRoleGranted),
        chain_role_granted_at: chainRoleGranted ? now : null,
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

    logger.info(`New user registered: ${user.email} (${user.role})`);

    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'USER_REGISTERED',
      resource_type: 'user',
      resource_id: user.id,
      details: {
        email: user.email,
        role: user.role,
        walletAddress: user.wallet_address,
        chainRoleGranted: Boolean(chainRoleGranted),
        chainRoleGrantTxHash: chainRoleGrantTxHash || null,
      },
      tx_hash: chainRoleGrantTxHash || null,
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        wallet_address: user.wallet_address,
        chain_role_granted: user.chain_role_granted,
        chain_role_granted_at: user.chain_role_granted_at,
      },
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Get current user profile
router.get('/profile', authenticateTokenAllowInactive, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role, wallet_address, status, last_login, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    logger.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get all users (admin only)
router.get('/users', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !isAdminRole(req.user.role)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ users });
  } catch (error) {
    logger.error('Users fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get current authenticated user
router.get('/me', authenticateTokenAllowInactive, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { data: user, error } = await supabase
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
  } catch (error) {
    logger.error('Me fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});



router.patch('/users/:id/status', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
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

    const { data, error } = await supabase
      .from('users')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'USER_STATUS_UPDATED',
      resource_type: 'user',
      resource_id: id,
      details: { status },
      tx_hash: null,
    });

    res.json({ user: data });
  } catch (error) {
    logger.error('User status update error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});



router.patch('/users/:id/chain-role', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !isAdminRole(req.user.role)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { id } = req.params;
    const { chainRoleGranted, walletAddress } = req.body;

    const { data, error } = await supabase
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

    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'CHAIN_ROLE_STATUS_UPDATED',
      resource_type: 'user',
      resource_id: id,
      details: { chainRoleGranted: Boolean(chainRoleGranted), walletAddress: data.wallet_address },
      tx_hash: null,
    });

    res.json({ user: data });
  } catch (error) {
    logger.error('Chain role update error:', error);
    res.status(500).json({ error: 'Failed to update chain role status' });
  }
});

// Edit user details (admin only)
router.patch('/users/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !isAdminRole(req.user.role)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { id } = req.params;
    const {
      firstName,
      middleName,
      lastName,
      email,
      walletAddress,
      role,
    } = req.body;

    // Fetch existing user to check for changes
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Prepare update object
    const updateObj: any = {};
    const changes: Record<string, any> = {};

    if (firstName !== undefined && firstName !== existingUser.first_name) {
      updateObj.first_name = firstName;
      changes.first_name = { old: existingUser.first_name, new: firstName };
    }
    if (middleName !== undefined && middleName !== existingUser.middle_name) {
      updateObj.middle_name = middleName;
      changes.middle_name = { old: existingUser.middle_name, new: middleName };
    }
    if (lastName !== undefined && lastName !== existingUser.last_name) {
      updateObj.last_name = lastName;
      changes.last_name = { old: existingUser.last_name, new: lastName };
    }
    if (email !== undefined && email !== existingUser.email) {
      updateObj.email = email.toLowerCase();
      changes.email = { old: existingUser.email, new: email.toLowerCase() };
    }
    if (walletAddress !== undefined && walletAddress !== existingUser.wallet_address) {
      updateObj.wallet_address = walletAddress ? String(walletAddress).toLowerCase() : null;
      changes.wallet_address = { old: existingUser.wallet_address, new: walletAddress ? String(walletAddress).toLowerCase() : null };
    }
    if (role !== undefined && role !== existingUser.role) {
      updateObj.role = role;
      changes.role = { old: existingUser.role, new: role };
    }

    // If no changes, return existing user
    if (Object.keys(updateObj).length === 0) {
      res.json({ user: existingUser });
      return;
    }

    // Update user
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateObj)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      if (updateError.code === '23505') {
        res.status(409).json({ error: 'Email already exists' });
        return;
      }
      throw updateError;
    }

    // Log the audit trail
    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'USER_DETAILS_UPDATED',
      resource_type: 'user',
      resource_id: id,
      details: changes,
      tx_hash: null,
    });

    logger.info(`User details updated: ${existingUser.email} by admin ${req.user.email}`);

    res.json({ user: updatedUser });
  } catch (error) {
    logger.error('User update error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Reset user password (admin only)
router.post('/users/:id/reset-password', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !isAdminRole(req.user.role)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      res.status(400).json({ error: 'New password is required' });
      return;
    }

    // Fetch existing user
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', id)
      .single();

    if (fetchError || !existingUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update user password
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ password_hash: newPasswordHash })
      .eq('id', id)
      .select('id, email, role, wallet_address, status, first_name, middle_name, last_name')
      .single();

    if (updateError) {
      throw updateError;
    }

    // Log the audit trail
    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'USER_PASSWORD_RESET',
      resource_type: 'user',
      resource_id: id,
      details: {
        email: existingUser.email,
        resetBy: req.user.email,
        resetAt: new Date().toISOString(),
      },
      tx_hash: null,
    });

    logger.info(`User password reset: ${existingUser.email} by admin ${req.user.email}`);

    res.json({
      success: true,
      message: `Password reset for ${existingUser.email}`,
      user: updatedUser,
    });
  } catch (error) {
    logger.error('Password reset error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

router.delete('/users/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
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

    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', id)
      .single();

    if (fetchError || !existingUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'USER_DELETED',
      resource_type: 'user',
      resource_id: id,
      details: { email: existingUser.email, role: existingUser.role },
      tx_hash: null,
    });

    res.json({ deleted: true, id });
  } catch (error) {
    logger.error('User delete error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
