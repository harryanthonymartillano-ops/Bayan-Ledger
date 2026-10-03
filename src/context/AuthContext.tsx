import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import apiClient, { ApiError } from '../lib/apiClient';

export type Role = 'MPDC (Planning)' | 'Budget Officer' | 'Treasurer' | 'Admin';

export interface User {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  role: Role;
  email?: string;
  walletAddress?: string;
  chainRoleGranted?: boolean;
  status?: 'Active' | 'Inactive';
  name?: string; // legacy
}

export interface RegisteredUser extends User {
  name: string;
  chainRoleGrantedAt?: string;
}

interface AuthContextType {
  user: User | null;
  registeredUsers: RegisteredUser[];
  token: string | null;
  isAuthLoading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => void;
  refreshCurrentUser: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  addRegisteredUser: (user: {
    email: string;
    password: string;
    role: Role;
    firstName: string;
    middleName?: string;
    lastName: string;
    walletAddress: string;
    chainRoleGranted?: boolean;
    chainRoleGrantTxHash?: string;
  }) => Promise<RegisteredUser>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TOKEN_KEY = 'sta-cruz-auth-token';
const AUTH_USER_KEY = 'sta-cruz-auth-user';

const isTokenExpired = (tokenString: string): boolean => {
  try {
    const base64Url = tokenString.split('.')[1];
    if (!base64Url) return false;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    if (parsed.exp && typeof parsed.exp === 'number') {
      return Date.now() >= parsed.exp * 1000;
    }
    return false;
  } catch {
    return false;
  }
};

const mapRole = (role: string): Role => {
  const normalized = role.trim().toLowerCase();

  if (normalized === 'mpdc (planning)' || normalized === 'mpdc') return 'MPDC (Planning)';
  if (normalized === 'budget officer') return 'Budget Officer';
  if (normalized === 'treasurer') return 'Treasurer';
  if (normalized === 'admin / hr' || normalized === 'admin') return 'Admin';
  if (normalized === 'proposer') return 'MPDC (Planning)';
  return 'Admin';
};

const mapBackendUser = (user: any): RegisteredUser => ({
  id: user.id,
  firstName: user.first_name || user.firstName || '',
  middleName: user.middle_name || user.middleName || undefined,
  lastName: user.last_name || user.lastName || '',
  name: `${user.first_name || ''} ${user.middle_name ? user.middle_name.charAt(0) + '. ' : ''}${user.last_name || user.full_name || user.name || user.email || ''}`.trim(),
  role: mapRole(user.role),
  email: user.email,
  status: user.status as 'Active' | 'Inactive',
  walletAddress: user.wallet_address || user.walletAddress || '',
  chainRoleGranted: Boolean(user.chain_role_granted || user.chainRoleGranted),
  chainRoleGrantedAt: user.chain_role_granted_at,
});

const mapCurrentUser = (user: any): User => ({
  id: user.id,
  firstName: user.firstName || user.first_name || '',
  middleName: user.middleName || user.middle_name || undefined,
  lastName: user.lastName || user.last_name || '',
  name: `${user.firstName || user.first_name || ''} ${user.middleName || user.middle_name ? (user.middleName || user.middle_name).charAt(0) + '. ' : ''}${user.lastName || user.last_name || user.full_name || user.email || ''}`.trim(),
  role: mapRole(user.role),
  email: user.email,
  walletAddress: user.walletAddress || user.wallet_address,
  chainRoleGranted: Boolean(user.chainRoleGranted || user.chain_role_granted),
  status: user.status as 'Active' | 'Inactive',
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!saved || isTokenExpired(saved)) return null;
    return saved;
  });

  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!savedToken || isTokenExpired(savedToken)) return null;
    try {
      const savedUser = localStorage.getItem(AUTH_USER_KEY);
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!savedToken || isTokenExpired(savedToken)) return false;
    const savedUser = localStorage.getItem(AUTH_USER_KEY);
    return !savedUser;
  });

  const fetchUsers = async (activeToken: string, activeUser?: User | null) => {
    const currentUser = activeUser ?? user;

    if (!currentUser) {
      setRegisteredUsers([]);
      return;
    }

    if (currentUser.role === 'Admin') {
      const response = await apiClient.getUsers(activeToken) as { users: any[] };
      setRegisteredUsers((response.users || []).map(mapBackendUser));
      return;
    }

    setRegisteredUsers([mapBackendUser({ ...currentUser, status: currentUser.status } as any)]);
  };

  useEffect(() => {
    const restoreSession = async () => {
      const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!savedToken) {
        setIsAuthLoading(false);
        return;
      }

      if (isTokenExpired(savedToken)) {
        console.warn('Stored auth token has expired.');
        logout();
        setIsAuthLoading(false);
        return;
      }

      try {
        const profile = await apiClient.getProfile(savedToken);
        const restoredUser = mapCurrentUser(profile);
        setToken(savedToken);
        setUser(restoredUser);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(restoredUser));
        await fetchUsers(savedToken, restoredUser);
      } catch (error: any) {
        console.warn('Failed to refresh session from server:', error);
        // ONLY log out if the backend definitively rejected the token (401 or 403)
        // Never log out on network disconnects, timeouts, or server 5xx errors (e.g. Render spin-up)
        const isUnauthorized = error instanceof ApiError && (error.status === 401 || error.status === 403);
        if (isUnauthorized) {
          console.warn('Session expired or revoked by server (401/403). Logging out.');
          logout();
        } else {
          console.info('Preserving active user session despite transient network/server glitch.');
        }
      } finally {
        setIsAuthLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = async (email: string, password?: string) => {
    if (!password) {
      throw new Error('Password is required.');
    }

    const response = await apiClient.login(email, password) as { token: string; user: any };
    const nextToken = response.token;
    localStorage.setItem(AUTH_TOKEN_KEY, nextToken);
    setToken(nextToken);

    const profile = await apiClient.getProfile(nextToken);
    const nextUser = mapCurrentUser(profile);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    await fetchUsers(nextToken, nextUser);
  };

  const refreshCurrentUser = async () => {
    if (!token) return;

    try {
      const profile = await apiClient.getProfile(token);
      const refreshedUser = mapCurrentUser(profile);
      setUser(refreshedUser);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(refreshedUser));
      await fetchUsers(token, refreshedUser);
    } catch (error: any) {
      console.warn('Failed to refresh user profile:', error);
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        logout();
      }
    }
  };

  const logout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    setToken(null);
    setUser(null);
    setRegisteredUsers([]);
  };

  const refreshUsers = async () => {
    if (!token) return;
    await fetchUsers(token);
  };

  const addRegisteredUser = async (newUser: {
    email: string;
    password: string;
    role: Role;
    firstName: string;
    middleName?: string;
    lastName: string;
    walletAddress: string;
    chainRoleGranted?: boolean;
    chainRoleGrantTxHash?: string;
  }) => {
    if (!token) {
      throw new Error('You must be logged in to add users.');
    }

    const response = await apiClient.registerUser(token, newUser) as { user: any };

    await refreshUsers();
    return mapBackendUser(response.user);
  };

  return (
    <AuthContext.Provider value={{ user, registeredUsers, token, isAuthLoading, login, logout, refreshCurrentUser, refreshUsers, addRegisteredUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
