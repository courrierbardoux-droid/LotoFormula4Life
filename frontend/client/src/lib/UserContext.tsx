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
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  updateUserRole: (id: number, role: UserRole) => Promise<void>;
  deleteUser: (id: number) => Promise<void>;
  inviteUser: (email: string) => Promise<void>;
  refreshUsers: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// Helper pour détecter si l'API backend est disponible
async function isApiAvailable(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/me', { 
      method: 'GET',
      credentials: 'include'
    });
    return response.ok || response.status === 401 || response.status === 200;
  } catch {
    return false;
  }
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [useApi, setUseApi] = useState(true);
  const [, setLocation] = useLocation();

  // Mock Database - utilisée en fallback si pas de backend
  const mockUsers: User[] = [
    { id: 1, username: 'AntoAbso', role: 'admin', email: 'admin@loto.com', joinDate: '2024-01-01' },
    { id: 2, username: 'JeanDupont', role: 'abonne', email: 'jean@test.com', joinDate: '2025-01-15' },
    { id: 3, username: 'MarieCurie', role: 'vip', email: 'marie@science.com', joinDate: '2025-02-20' },
    { id: 4, username: 'Guest123', role: 'invite', email: 'guest@temp.com', joinDate: '2025-03-10' },
  ];

  // Vérifier la session au chargement
  useEffect(() => {
    async function checkSession() {
      setIsLoading(true);
      
      // Vérifier si l'API est disponible
      const apiAvailable = await isApiAvailable();
      setUseApi(apiAvailable);
      
      if (apiAvailable) {
        try {
          const response = await fetch('/api/auth/me', { credentials: 'include' });
          const data = await response.json();
          if (data.user) {
            setUser(data.user);
          }
        } catch (error) {
          console.log('[UserContext] API check failed, using mock mode');
          setUseApi(false);
        }
      } else {
        console.log('[UserContext] Backend not available, using mock mode');
        setAllUsers(mockUsers);
      }
      
      setIsLoading(false);
    }
    
    checkSession();
  }, []);

  // Récupérer la liste des utilisateurs (admin)
  const refreshUsers = async () => {
    if (!useApi) {
      setAllUsers(mockUsers);
      return;
    }
    
    try {
      const response = await fetch('/api/users', { credentials: 'include' });
      if (response.ok) {
        const users = await response.json();
        setAllUsers(users);
      }
    } catch (error) {
      console.error('[UserContext] Error fetching users:', error);
    }
  };

  // Connexion
  const login = async (username: string, password: string): Promise<boolean> => {
    if (!useApi) {
      // Mode mock : vérification simple
      const mockUser = mockUsers.find(u => u.username === username);
      if (mockUser) {
        // Vérification mock des mots de passe
        const validPasswords: Record<string, string> = {
          'AntoAbso': 'AntoAbso',
          'Guest123': 'guest',
          'JeanDupont': 'abonne',
          'MarieCurie': 'vip'
        };
        
        if (validPasswords[username] === password) {
          setUser(mockUser);
          return true;
        }
      }
      return false;
    }
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      
      const data = await response.json();
      
      if (data.success && data.user) {
        setUser(data.user);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[UserContext] Login error:', error);
      return false;
    }
  };

  // Déconnexion
  const logout = async (): Promise<void> => {
    if (useApi) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
        });
      } catch (error) {
        console.error('[UserContext] Logout error:', error);
      }
    }
    
    setUser(null);
    setLocation('/');
  };

  // Inscription
  const register = async (username: string, email: string, password: string): Promise<boolean> => {
    if (!useApi) {
      // Mode mock : ajouter à la liste locale
      const newUser: User = {
        id: mockUsers.length + 1,
        username,
        email,
        role: 'abonne',
        joinDate: new Date().toISOString().split('T')[0]
      };
      setAllUsers(prev => [...prev, newUser]);
      return true;
    }
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, email, password }),
      });
      
      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('[UserContext] Register error:', error);
      return false;
    }
  };

  // Modifier le rôle d'un utilisateur (admin)
  const updateUserRole = async (id: number, role: UserRole): Promise<void> => {
    if (!useApi) {
      setAllUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u));
      return;
    }
    
    try {
      await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role }),
      });
      await refreshUsers();
    } catch (error) {
      console.error('[UserContext] Update role error:', error);
    }
  };

  // Supprimer un utilisateur (admin)
  const deleteUser = async (id: number): Promise<void> => {
    if (!useApi) {
      setAllUsers(prev => prev.filter(u => u.id !== id));
      return;
    }
    
    try {
      await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      await refreshUsers();
    } catch (error) {
      console.error('[UserContext] Delete user error:', error);
    }
  };

  // Inviter un utilisateur (admin)
  const inviteUser = async (email: string): Promise<void> => {
    if (!useApi) {
      const newUser: User = {
        id: allUsers.length + 1,
        username: email.split('@')[0],
        email,
        role: 'vip',
        joinDate: new Date().toISOString().split('T')[0]
      };
      setAllUsers(prev => [...prev, newUser]);
      return;
    }
    
    // En mode API, on pourrait envoyer un email d'invitation
    // Pour l'instant, on crée juste l'utilisateur avec un mot de passe temporaire
    try {
      await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          username: email.split('@')[0], 
          email, 
          password: 'temp123' // À changer par l'utilisateur
        }),
      });
      await refreshUsers();
    } catch (error) {
      console.error('[UserContext] Invite user error:', error);
    }
  };

  return (
    <UserContext.Provider value={{ 
      user, 
      allUsers, 
      isLoading,
      login, 
      logout, 
      register, 
      updateUserRole, 
      deleteUser, 
      inviteUser,
      refreshUsers
    }}>
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
