import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Role = 'MPDC (Planning)' | 'Budget Officer' | 'Treasurer' | 'Admin / HR';

export interface User {
  id: string;
  name: string;
  role: Role;
}

export interface RegisteredUser {
  id: string;
  name: string;
  role: Role;
  email: string;
  status: 'Active' | 'Inactive';
  walletAddress: string;
}

interface AuthContextType {
  user: User | null;
  registeredUsers: RegisteredUser[];
  login: (role: Role) => void;
  logout: () => void;
  addRegisteredUser: (user: Omit<RegisteredUser, 'id'>) => void;
  updateUserStatus: (id: string, status: 'Active' | 'Inactive') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([
    { id: 'user-mpdc-1', name: 'Maria Santos', role: 'MPDC (Planning)', email: 'maria.santos@stacruz.gov.ph', status: 'Active', walletAddress: '0x71C...976F' },
    { id: 'user-budget-1', name: 'Juan Dela Cruz', role: 'Budget Officer', email: 'juan.delacruz@stacruz.gov.ph', status: 'Active', walletAddress: '0x89D...12A4' },
    { id: 'user-treasurer-1', name: 'Elena Reyes', role: 'Treasurer', email: 'elena.reyes@stacruz.gov.ph', status: 'Active', walletAddress: '0x45B...88C2' },
    { id: 'user-admin-1', name: 'Admin User', role: 'Admin / HR', email: 'admin@stacruz.gov.ph', status: 'Active', walletAddress: '0x12A...34B5' },
  ]);

  const login = (role: Role) => {
    // Find the first active user with this role
    const activeUser = registeredUsers.find(u => u.role === role && u.status === 'Active');
    
    if (activeUser) {
      setUser({
        id: activeUser.id,
        name: activeUser.name,
        role: activeUser.role,
      });
    } else {
      // Fallback if no active user exists for the role
      setUser({
        id: `user-${role.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        name: `${role} Official`,
        role,
      });
    }
  };

  const logout = () => {
    setUser(null);
  };

  const addRegisteredUser = (newUser: Omit<RegisteredUser, 'id'>) => {
    const id = `user-${Date.now()}`;
    setRegisteredUsers(prev => [...prev, { ...newUser, id }]);
  };

  const updateUserStatus = (id: string, status: 'Active' | 'Inactive') => {
    setRegisteredUsers(prev => prev.map(u => u.id === id ? { ...u, status } : u));
  };

  return (
    <AuthContext.Provider value={{ user, registeredUsers, login, logout, addRegisteredUser, updateUserStatus }}>
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
