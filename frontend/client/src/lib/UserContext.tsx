
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'wouter';

export type UserRole = 'admin' | 'vip' | 'abonne' | 'invite';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  email?: string;
  joinDate?: string;
}

interface UserContextType {
  user: User | null;
  allUsers: User[];
  login: (username: string, role?: UserRole) => void;
  logout: () => void;
  register: (username: string, email: string) => boolean;
  updateUserRole: (id: number, role: UserRole) => void;
  deleteUser: (id: number) => void;
  inviteUser: (email: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [, setLocation] = useLocation();

  // Mock Database - moved from SubscriberManagement to here to be shared
  const [allUsers, setAllUsers] = useState<User[]>([
    { id: 1, username: 'AntoAbso', role: 'admin', email: 'admin@loto.com', joinDate: '2024-01-01' },
    { id: 2, username: 'JeanDupont', role: 'abonne', email: 'jean@test.com', joinDate: '2025-01-15' },
    { id: 3, username: 'MarieCurie', role: 'vip', email: 'marie@science.com', joinDate: '2025-02-20' },
    { id: 4, username: 'Guest123', role: 'invite', email: 'guest@temp.com', joinDate: '2025-03-10' },
  ]);

  const login = (username: string, role: UserRole = 'abonne') => {
    // Mock user data - in a real app we would fetch this
    // We assign a temporary ID if not found in mock DB, or find it
    const existingUser = allUsers.find(u => u.username === username);
    
    setUser({
      id: existingUser ? existingUser.id : 999,
      username,
      role,
      email: existingUser ? existingUser.email : `${username.toLowerCase()}@example.com`,
      joinDate: existingUser ? existingUser.joinDate : new Date().toISOString().split('T')[0]
    });
  };

  const logout = () => {
    setUser(null);
    setLocation('/');
  };

  const register = (username: string, email: string) => {
    // Add to our mock database
    const newUser: User = {
        id: allUsers.length + 1,
        username,
        email,
        role: 'abonne',
        joinDate: new Date().toISOString().split('T')[0]
    };
    
    setAllUsers(prev => [...prev, newUser]);
    return true;
  };

  const updateUserRole = (id: number, role: UserRole) => {
      setAllUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u));
  };

  const deleteUser = (id: number) => {
      setAllUsers(prev => prev.filter(u => u.id !== id));
  };

  const inviteUser = (email: string) => {
      const newUser: User = {
          id: allUsers.length + 1,
          username: email.split('@')[0], // Generate username from email
          email,
          role: 'vip', // Default to VIP for invitation
          joinDate: new Date().toISOString().split('T')[0]
      };
      setAllUsers(prev => [...prev, newUser]);
  };

  return (
    <UserContext.Provider value={{ user, allUsers, login, logout, register, updateUserRole, deleteUser, inviteUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
