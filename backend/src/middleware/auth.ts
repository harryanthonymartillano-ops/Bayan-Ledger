import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/config';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    walletAddress?: string;
    status?: 'Active' | 'Inactive';
  };
}

const extractBearerToken = (req: AuthRequest) => {
  const authHeader = req.headers['authorization'];
  return authHeader && authHeader.split(' ')[1];
};

const verifyJwt = (token: string) => jwt.verify(token, process.env.JWT_SECRET!) as {
  id: string;
  email: string;
  role: string;
  walletAddress?: string;
  status?: 'Active' | 'Inactive';
};

const loadCurrentUser = async (id: string) => {
  const { data: user, error } = await supabase
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
    status: user.status === 'Inactive' ? 'Inactive' : 'Active' as 'Active' | 'Inactive',
  };
};

const buildAuthenticator = (options?: { allowInactive?: boolean }) => async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
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

    if (!options?.allowInactive && currentUser.status !== 'Active') {
      res.status(403).json({ error: 'Account is not active' });
      return;
    }

    req.user = currentUser;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const authenticateToken = buildAuthenticator();
export const authenticateTokenAllowInactive = buildAuthenticator({ allowInactive: true });

const normalizeRole = (role: string) => role.trim().toLowerCase();

const roleMatches = (requiredRole: string, actualRole: string) => {
  const required = normalizeRole(requiredRole);
  const actual = normalizeRole(actualRole);

  if (required === actual) return true;

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

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.some((role) => roleMatches(role, req.user!.role))) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};
