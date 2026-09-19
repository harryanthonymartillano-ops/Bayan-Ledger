import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import apiClient from '../lib/apiClient';

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
  const [user, setUser] = useState<User | null>(null);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

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

      try {
        const profile = await apiClient.getProfile(savedToken);
        const restoredUser = mapCurrentUser(profile);
        setToken(savedToken);
        setUser(restoredUser);
        await fetchUsers(savedToken, restoredUser);
      } catch (error) {
        console.warn('Failed to restore session:', error);
        localStorage.removeItem(AUTH_TOKEN_KEY);
        setToken(null);
        setUser(null);
        setRegisteredUsers([]);
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
    setUser(nextUser);
    await fetchUsers(nextToken, nextUser);
  };

  const refreshCurrentUser = async () => {
    if (!token) return;

    const profile = await apiClient.getProfile(token);
    const refreshedUser = mapCurrentUser(profile);
    setUser(refreshedUser);
    await fetchUsers(token, refreshedUser);
  };

  const logout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
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
