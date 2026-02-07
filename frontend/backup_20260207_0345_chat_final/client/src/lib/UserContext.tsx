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
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  allUsers: User[];
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  register: (username: string, email: string, password: string, inviteCode?: string) => Promise<{ success: boolean; error?: string; field?: string }>;
  sendInvitation: (email: string, code: string, type: 'vip' | 'invite') => Promise<boolean>;
  updateUserRole: (id: number, role: UserRole) => Promise<void>;
  deleteUser: (id: number) => Promise<boolean>;
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

  // Mock Database - utilisée en fallback si pas de backend (aligné sur base Neon)
  const mockUsers: User[] = [
    { id: 1, username: 'ADMINISTRATEUR', role: 'admin', email: 'courrier.bardoux@gmail.com', joinDate: '2026-01-02' },
    { id: 2, username: 'TestINVITE', role: 'invite', email: 'alerteprix@laposte.net', joinDate: '2026-01-02' },
    { id: 10, username: 'TestVIP', role: 'vip', email: 'contact.absolu@gmail.com', joinDate: '2026-01-03' },
    { id: 11, username: 'TestABONNE', role: 'abonne', email: 'wbusiness@laposte.net', joinDate: '2026-01-04' },
    { id: 12, username: 'cls', role: 'vip', email: 'courrier.login.s@gmail.com', joinDate: '2026-01-24' },
    { id: 13, username: 'clp', role: 'invite', email: 'courrier.login.p@gmail.com', joinDate: '2026-01-24' },
  ];

  // Vérifier la session au chargement
  useEffect(() => {
    async function checkSession() {
      console.log('[UserContext] ÉTAPE A: Début de checkSession - setIsLoading(true)');
      setIsLoading(true);
      
      // Pause pour observer
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('[UserContext] ÉTAPE B: Après pause initiale, vérification de l\'API...');
      
      // Vérifier si l'API est disponible
      console.log('[UserContext] ÉTAPE C: Appel isApiAvailable()...');
      const apiAvailable = await isApiAvailable();
      console.log('[UserContext] ÉTAPE D: isApiAvailable() retourné:', apiAvailable);
      setUseApi(apiAvailable);
      
      // Pause pour observer
      await new Promise(resolve => setTimeout(resolve, 200));
      
      if (apiAvailable) {
        console.log('[UserContext] ÉTAPE E: API disponible, appel /api/auth/me...');
        try {
          const response = await fetch('/api/auth/me', { credentials: 'include' });
          console.log('[UserContext] ÉTAPE F: Réponse /api/auth/me reçue, status:', response.status);
          const data = await response.json();
          console.log('[UserContext] ÉTAPE G: Données reçues:', data);
          if (data.user) {
            console.log('[UserContext] ÉTAPE H: Utilisateur trouvé dans la session:', data.user.username, 'role:', data.user.role);
            setUser(data.user);
          } else {
            console.log('[UserContext] ÉTAPE H: Aucun utilisateur dans la session (non connecté)');
          }
        } catch (error) {
          console.log('[UserContext] ÉTAPE E (ERREUR): API check failed, using mock mode', error);
          setUseApi(false);
        }
      } else {
        console.log('[UserContext] ÉTAPE E: Backend not available, using mock mode');
        setAllUsers(mockUsers);
      }
      
      // Pause avant de terminer le chargement
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('[UserContext] ÉTAPE I: Fin de checkSession - setIsLoading(false)');
      setIsLoading(false);
      console.log('[UserContext] ÉTAPE J: Chargement terminé, setIsLoading(false) exécuté');
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

  // Nettoyer les données utilisateur du localStorage (sauf console_state : priorité de tri et état console conservés pour même utilisateur)
  const clearUserData = () => {
    const keysToRemove = [
      'lf4l-grilles-jouees',
      'lf4l-grilles-gagnantes', 
      'lf4l-console-presets',
      'lf4l-console-settings',
      'playedGrids',
      'savedGrids',
      'consolePresets',
      'favoriteNumbers',
      'loto_console_presets',
      'loto_favorites',
    ];
    keysToRemove.forEach(key => localStorage.removeItem(key));
  };

  // Vider console_state seulement si un autre utilisateur se connecte (éviter d'hériter de l'état du précédent)
  const clearConsoleStateIfDifferentUser = (currentUsername: string) => {
    try {
      const raw = localStorage.getItem('console_state');
      if (!raw) return;
      const state = JSON.parse(raw) as { _owner?: string };
      if (state._owner != null && state._owner !== currentUsername) {
        localStorage.removeItem('console_state');
      }
    } catch {
      // ignore
    }
  };

  // Connexion
  const login = async (username: string, password: string): Promise<boolean> => {
    if (!useApi) {
      // Mode mock : vérification simple
      const mockUser = mockUsers.find(u => u.username === username);
      if (mockUser) {
        // Vérification mock des mots de passe (aligné backend / base Neon, fallback local)
        const validPasswords: Record<string, string> = {
          'ADMINISTRATEUR': '123456',
          'TestINVITE': '123456',
          'TestVIP': '123456',
          'TestABONNE': '123456',
          'cls': '123456',
          'clp': '123456',
        };
        
        if (validPasswords[username] === password) {
          clearUserData();
          clearConsoleStateIfDifferentUser(mockUser.username);
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
        clearUserData();
        clearConsoleStateIfDifferentUser(data.user.username);
        console.log('[UserContext] localStorage nettoyé au login');
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
    
    // Nettoyer le localStorage pour éviter que le prochain utilisateur hérite des données
    clearUserData();
    localStorage.removeItem('lf4l-euromillions-history'); // Aussi nettoyer l'historique
    console.log('[UserContext] localStorage nettoyé au logout');

    setUser(null);
    setLocation('/');
  };

  // Inscription - retourne { success, error?, field? }
  const register = async (username: string, email: string, password: string, inviteCode?: string): Promise<{ success: boolean; error?: string; field?: string }> => {
    if (!useApi) {
      // Mode mock : ajouter à la liste locale
      const newUser: User = {
        id: mockUsers.length + 1,
        username,
        email,
        role: inviteCode ? 'vip' : 'invite', // Simulation basique
        joinDate: new Date().toISOString().split('T')[0]
      };
      setAllUsers(prev => [...prev, newUser]);
      return { success: true };
    }
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, email, password, inviteCode }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        await refreshUsers(); // Rafraîchir la liste des abonnés
        return { success: true };
      }
      
      return { 
        success: false, 
        error: data.error || data.message || 'Erreur inscription',
        field: data.field 
      };
    } catch (error) {
      console.error('[UserContext] Register error:', error);
      return { success: false, error: 'Erreur de connexion au serveur' };
    }
  };

  // Envoyer une invitation (admin)
  const sendInvitation = async (email: string, code: string, type: 'vip' | 'invite'): Promise<boolean> => {
    if (!useApi) {
      console.log(`[Mock] Invitation ${type} envoyée à ${email} avec code ${code}`);
      return true;
    }
    
    try {
      const response = await fetch('/api/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, code, type }),
      });
      
      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('[UserContext] Send invitation error:', error);
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
  const deleteUser = async (id: number): Promise<boolean> => {
    if (!useApi) {
      setAllUsers(prev => prev.filter(u => u.id !== id));
      return true;
    }
    
    try {
      console.log('[UserContext] Deleting user:', id);
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json();
      console.log('[UserContext] Delete response:', data);
      
      if (data.success) {
        await refreshUsers();
        return true;
      } else {
        console.error('[UserContext] Delete failed:', data.error);
        return false;
      }
    } catch (error) {
      console.error('[UserContext] Delete user error:', error);
      return false;
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
      setUser,
      allUsers, 
      isLoading,
      login, 
      logout, 
      register, 
      updateUserRole, 
      deleteUser, 
      inviteUser,
      sendInvitation,
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
