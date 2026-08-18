// contexts/AuthContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  type: 'client' | 'partner' | 'candidate' | 'admin';
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, type: string) => Promise<boolean>;
  logout: () => void;
  register: (userData: any) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('sari_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (e) {
        localStorage.removeItem('sari_user');
      }
    }
  }, []);

  const login = async (email: string, password: string, type: string): Promise<boolean> => {
    // Simulation d'authentification (Phase 1)
    const demoUsers: Record<string, User> = {
      'client@sari.dz': { id: '1', name: 'Client Demo', email, type: 'client' },
      'partner@sari.dz': { id: '2', name: 'Partner Demo', email, type: 'partner' },
      'candidate@sari.dz': { id: '3', name: 'Candidate Demo', email, type: 'candidate' },
    };

    if (demoUsers[email] && password === 'demo123') {
      setUser(demoUsers[email]);
      localStorage.setItem('sari_user', JSON.stringify(demoUsers[email]));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('sari_user');
  };

  const register = async (userData: any): Promise<boolean> => {
    // Simulation d'inscription (Phase 1)
    const newUser: User = {
      id: Date.now().toString(),
      name: userData.name,
      email: userData.email,
      type: userData.type,
    };
    setUser(newUser);
    localStorage.setItem('sari_user', JSON.stringify(newUser));
    return true;
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}