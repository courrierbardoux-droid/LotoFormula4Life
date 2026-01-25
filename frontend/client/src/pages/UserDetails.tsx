import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { CasinoLayout } from '@/components/layout/CasinoLayout';
import { CasinoButton } from '@/components/casino/CasinoButton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr as frLocale } from 'date-fns/locale';
import { ArrowLeft, Clock, Grid, User, Mail, Calendar, Shield, Edit2, Check, Lock, Eye, EyeOff } from 'lucide-react';

interface UserData {
  id: number;
  username: string;
  email: string;
  role: string;
  createdAt: string;
  popupStatus: string;
  consoleAccessCount: number;
}

interface Connection {
  id: number;
  loginAt: string;
  logoutAt: string | null;
  ipAddress: string;
  userAgent: string;
}

interface PlayedGrid {
  id: number;
  numbers: number[];
  stars: number[];
  playedAt: string;
  targetDate: string | null;
  name: string | null;
}

export default function UserDetails() {
  const params = useParams<{ userId: string }>();
  const [, setLocation] = useLocation();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [playedGrids, setPlayedGrids] = useState<PlayedGrid[]>([]);
  const [loading, setLoading] = useState(true);
  // (Gagnants) : supprimé — aucun calcul/affichage "gagnant" ici.
  
  // Tri
  const [connectionSort, setConnectionSort] = useState<'date' | 'alpha'>('date');
  const [gridSort, setGridSort] = useState<'date' | 'alpha'>('date');
  
  // États pour l'édition
  const [editingField, setEditingField] = useState<'username' | 'email' | 'password' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const editInputRef = React.useRef<HTMLDivElement>(null);
  
  // Gestionnaire de clic en dehors pour annuler l'édition
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editingField && editInputRef.current && !editInputRef.current.contains(event.target as Node)) {
        // Vérifier si le clic n'est pas sur le bouton vert
        const target = event.target as HTMLElement;
        if (!target.closest('button[class*="bg-green-600"]')) {
          cancelEdit();
        }
      }
    };

    if (editingField) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingField]);
  
  useEffect(() => {
    const loadUserDetails = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const backParam = urlParams.get('back');

        const res = await fetch(`/api/admin/user/${params.userId}/details`, {
          credentials: 'include',
        });
        
        if (!res.ok) {
          toast.error('Utilisateur non trouvé');
          setLocation(backParam ? decodeURIComponent(backParam) : '/settings/users');
          return;
        }
        
        const data = await res.json();
        setUserData(data.user);
        setConnections(data.connections);
        setPlayedGrids(data.playedGrids);
      } catch (err) {
        toast.error('Erreur de chargement');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    loadUserDetails();
  }, [params.userId]);

  // (Gagnants) : supprimé — aucun chargement du dernier tirage / calcul de gains / logs associés.
  
  const handleTogglePopup = async () => {
    if (!userData) return;
    
    const nextStatus = userData.popupStatus === 'active' ? 'reduced' 
                     : userData.popupStatus === 'reduced' ? 'disabled' 
                     : 'active';
    
    try {
      const res = await fetch(`/api/users/${userData.id}/popup`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ popupStatus: nextStatus }),
      });
      
      if (res.ok) {
        setUserData(prev => prev ? { ...prev, popupStatus: nextStatus } : null);
        const statusLabel = nextStatus === 'active' ? 'Actif' : nextStatus === 'reduced' ? 'Réduit' : 'Désactivé';
        toast.success(`Popup ${statusLabel}`);
      }
    } catch (err) {
      toast.error('Erreur mise à jour popup');
    }
  };
  
  // Fonctions d'édition email/login/password
  const startEdit = (field: 'username' | 'email' | 'password') => {
    if (!userData) return;
    setEditingField(field);
    if (field === 'password') {
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setEditValue(field === 'username' ? userData.username : userData.email);
    }
  };
  
  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };
  
  const saveEdit = async () => {
    if (!userData || !editingField) return;
    
    if (editingField === 'password') {
      if (!newPassword.trim()) {
        toast.error('Le mot de passe ne peut pas être vide');
        return;
      }
      if (newPassword.length < 6) {
        toast.error('Le mot de passe doit contenir au moins 6 caractères');
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error('Les mots de passe ne correspondent pas');
        return;
      }
    } else {
      if (!editValue.trim()) {
        toast.error('La valeur ne peut pas être vide');
        return;
      }
      if (editingField === 'email' && !editValue.includes('@')) {
        toast.error('Email invalide');
        return;
      }
    }
    
    setSaving(true);
    try {
      const body: any = {};
      if (editingField === 'password') {
        body.password = newPassword.trim();
      } else {
        body[editingField] = editValue.trim();
      }
      
      console.log('[Frontend] Sending update request:', { userId: userData.id, field: editingField, body });
      
      const res = await fetch(`/api/admin/user/${userData.id}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      
      const data = await res.json();
      console.log('[Frontend] Update response:', { status: res.status, ok: res.ok, data });
      
      if (res.ok && data.success) {
        // Recharger les données utilisateur depuis le serveur pour avoir les valeurs à jour
        try {
          const detailsRes = await fetch(`/api/admin/user/${userData.id}/details`, {
            credentials: 'include',
          });
          if (detailsRes.ok) {
            const detailsData = await detailsRes.json();
            setUserData(detailsData.user);
          } else {
            // Fallback : mettre à jour localement si le rechargement échoue
            if (editingField !== 'password') {
              setUserData(prev => prev ? { ...prev, [editingField]: editValue.trim() } : null);
            }
          }
        } catch (reloadErr) {
          console.error('[Frontend] Error reloading user details:', reloadErr);
          // Fallback : mettre à jour localement si le rechargement échoue
          if (editingField !== 'password') {
            setUserData(prev => prev ? { ...prev, [editingField]: editValue.trim() } : null);
          }
        }
        toast.success(`${editingField === 'username' ? 'Identifiant' : editingField === 'email' ? 'Email' : 'Mot de passe'} mis à jour !`);
        cancelEdit();
      } else {
        const errorMsg = data.error || data.message || 'Erreur lors de la mise à jour';
        console.error('[Frontend] Update failed:', errorMsg);
        toast.error(errorMsg);
      }
    } catch (err) {
      console.error('[Frontend] Network error:', err);
      toast.error('Erreur de connexion au serveur');
    } finally {
      setSaving(false);
    }
  };
  
  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd MMM yyyy HH:mm', { locale: frLocale });
    } catch {
      return dateStr;
    }
  };
  
  const calculateDuration = (login: string, logout: string | null) => {
    if (!logout) return 'En cours...';
    const start = new Date(login).getTime();
    const end = new Date(logout).getTime();
    const diff = end - start;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    if (hours > 0) return `${hours}h ${mins % 60}m`;
    return `${mins}m`;
  };
  
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-900 text-red-200 border-red-500/50';
      case 'vip': return 'bg-purple-900 text-purple-200 border-purple-500/50';
      case 'abonne': return 'bg-blue-900 text-blue-200 border-blue-500/50';
      default: return 'bg-zinc-800 text-zinc-400 border-zinc-600';
    }
  };
  
  const sortedConnections = [...connections].sort((a, b) => {
    if (connectionSort === 'date') {
      return new Date(b.loginAt).getTime() - new Date(a.loginAt).getTime();
    }
    return 0; // Alpha doesn't make sense for connections
  });
  
  const sortedGrids = [...playedGrids].sort((a, b) => {
    if (gridSort === 'date') {
      return new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime();
    }
    return (a.name || '').localeCompare(b.name || '');
  });
  
  if (loading) {
    return (
      <CasinoLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-casino-gold font-orbitron text-xl animate-pulse">
            Chargement...
          </div>
        </div>
      </CasinoLayout>
    );
  }
  
  if (!userData) return null;
  
  return (
    <CasinoLayout>
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => {
              const urlParams = new URLSearchParams(window.location.search);
              const backParam = urlParams.get('back');
              setLocation(backParam ? decodeURIComponent(backParam) : '/settings/users');
            }}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-3xl font-orbitron text-casino-gold">DÉTAILS UTILISATEUR</h1>
        </div>
        
        {/* User Info Card */}
        <div className="bg-zinc-900/90 border border-zinc-700 rounded-xl p-6 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Username - Éditable */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => startEdit('username')}
                className="w-12 h-12 rounded-full bg-gradient-to-br from-casino-gold to-yellow-600 flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
                title="Cliquer pour modifier l'identifiant"
              >
                <User className="text-black" size={24} />
              </button>
              <div className="flex-1">
                <div className="text-zinc-500 text-sm">Identifiant</div>
                {editingField === 'username' ? (
                  <div ref={editInputRef} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !saving) saveEdit(); }}
                      className="bg-black border border-casino-gold/50 rounded px-2 py-1 text-white focus:border-casino-gold outline-none text-lg"
                      autoFocus
                    />
                    <button onClick={saveEdit} disabled={saving} className="p-1 bg-green-600 hover:bg-green-500 rounded text-white">
                      <Check size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-lg">{userData.username}</span>
                    <button onClick={() => startEdit('username')} className="p-1 text-zinc-500 hover:text-casino-gold transition-colors">
                      <Edit2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Email - Éditable */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => startEdit('email')}
                className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center hover:scale-110 transition-transform cursor-pointer hover:bg-zinc-700"
                title="Cliquer pour modifier l'email"
              >
                <Mail className="text-zinc-400" size={24} />
              </button>
              <div className="flex-1">
                <div className="text-zinc-500 text-sm">Email</div>
                {editingField === 'email' ? (
                  <div ref={editInputRef} className="flex items-center gap-2">
                    <input
                      type="email"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !saving) saveEdit(); }}
                      className="bg-black border border-casino-gold/50 rounded px-2 py-1 text-white focus:border-casino-gold outline-none text-lg flex-1"
                      autoFocus
                    />
                    <button onClick={saveEdit} disabled={saving} className="p-1 bg-green-600 hover:bg-green-500 rounded text-white">
                      <Check size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-white text-lg">{userData.email}</span>
                    <button onClick={() => startEdit('email')} className="p-1 text-zinc-500 hover:text-casino-gold transition-colors">
                      <Edit2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Password - Éditable */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => startEdit('password')}
                className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center hover:scale-110 transition-transform cursor-pointer hover:bg-zinc-700"
                title="Cliquer pour modifier le mot de passe"
              >
                <Lock className="text-zinc-400" size={24} />
              </button>
              <div className="flex-1">
                <div className="text-zinc-500 text-sm">Mot de passe</div>
                {editingField === 'password' ? (
                  <div ref={editInputRef} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !saving) saveEdit(); }}
                          className="bg-black border border-casino-gold/50 rounded px-2 py-1 text-white focus:border-casino-gold outline-none text-lg w-full pr-8"
                          placeholder="Nouveau mot de passe"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="bg-black border border-casino-gold/50 rounded px-2 py-1 text-white focus:border-casino-gold outline-none text-lg w-full pr-8"
                          placeholder="Confirmer le mot de passe"
                          onKeyDown={(e) => { if (e.key === 'Enter' && !saving) saveEdit(); }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <button onClick={saveEdit} disabled={saving} className="p-1 bg-green-600 hover:bg-green-500 rounded text-white">
                        <Check size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-white text-lg">••••••••</span>
                    <button onClick={() => startEdit('password')} className="p-1 text-zinc-500 hover:text-casino-gold transition-colors">
                      <Edit2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Role */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                <Shield className="text-zinc-400" size={24} />
              </div>
              <div>
                <div className="text-zinc-500 text-sm">Statut</div>
                <span className={cn(
                  "px-3 py-1 rounded font-bold uppercase text-sm border",
                  getRoleColor(userData.role)
                )}>
                  {userData.role}
                </span>
              </div>
            </div>
            
            {/* Registration Date */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                <Calendar className="text-zinc-400" size={24} />
              </div>
              <div>
                <div className="text-zinc-500 text-sm">Inscription</div>
                <div className="text-white text-lg">
                  {userData.createdAt ? formatDate(userData.createdAt) : 'N/A'}
                </div>
              </div>
            </div>
          </div>
          
          {/* Popup Toggle (for VIP/Abonné only) */}
          {(userData.role === 'vip' || userData.role === 'abonne') && (
            <div className="mt-6 pt-6 border-t border-zinc-700 flex items-center justify-between">
              <div>
                <div className="text-white font-bold mb-1">Popup Gratitude</div>
                <div className="text-zinc-500 text-sm">
                  {userData.popupStatus === 'active' && 'Affiché à chaque accès console'}
                  {userData.popupStatus === 'reduced' && 'Affiché 1 fois sur 10'}
                  {userData.popupStatus === 'disabled' && 'Désactivé par l\'administrateur'}
                </div>
                <div className="text-zinc-600 text-xs mt-1">
                  Accès console: {userData.consoleAccessCount}
                </div>
              </div>
              <button
                onClick={handleTogglePopup}
                className={cn(
                  "w-12 h-12 rounded-full transition-all duration-200 shadow-lg border-4 flex items-center justify-center",
                  userData.popupStatus === 'active' && "bg-green-500 border-green-400 shadow-green-500/50",
                  userData.popupStatus === 'reduced' && "bg-red-500 border-red-400 shadow-red-500/50",
                  userData.popupStatus === 'disabled' && "bg-zinc-600 border-zinc-500 shadow-none",
                )}
                title="Cliquer pour changer le statut"
              >
                <span className="text-white font-bold text-xs">
                  {userData.popupStatus === 'active' ? 'ON' : userData.popupStatus === 'reduced' ? '1/10' : 'OFF'}
                </span>
              </button>
            </div>
          )}
        </div>
        
        {/* Connection History */}
        <div className="bg-zinc-900/90 border border-zinc-700 rounded-xl overflow-hidden shadow-xl">
          <div className="bg-black px-6 py-4 flex items-center justify-between border-b border-zinc-700">
            <div className="flex items-center gap-3">
              <Clock className="text-casino-gold" size={20} />
              <h2 className="text-lg font-orbitron text-zinc-300">HISTORIQUE CONNEXIONS</h2>
            </div>
            <button
              onClick={() => setConnectionSort(s => s === 'date' ? 'alpha' : 'date')}
              className="text-sm text-zinc-500 hover:text-white transition-colors"
            >
              Tri: {connectionSort === 'date' ? 'Date' : 'Alpha'}
            </button>
          </div>
          
          <div className="max-h-[300px] overflow-y-auto">
            {sortedConnections.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">Aucune connexion enregistrée</div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-zinc-800/50 sticky top-0">
                  <tr className="text-zinc-400 text-sm uppercase">
                    <th className="p-3">Connexion</th>
                    <th className="p-3">Déconnexion</th>
                    <th className="p-3">Durée</th>
                    <th className="p-3">IP</th>
                  </tr>
                </thead>
                <tbody className="font-rajdhani">
                  {sortedConnections.map(conn => (
                    <tr key={conn.id} className="border-b border-zinc-800 hover:bg-white/5">
                      <td className="p-3 text-green-400">{formatDate(conn.loginAt)}</td>
                      <td className="p-3 text-red-400">
                        {conn.logoutAt ? formatDate(conn.logoutAt) : '—'}
                      </td>
                      <td className="p-3 text-zinc-300">{calculateDuration(conn.loginAt, conn.logoutAt)}</td>
                      <td className="p-3 text-zinc-500 text-sm">{conn.ipAddress || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        
        {/* Played Grids */}
        <div className="bg-zinc-900/90 border border-zinc-700 rounded-xl overflow-hidden shadow-xl">
          <div className="bg-black px-6 py-4 flex items-center justify-between border-b border-zinc-700">
            <div className="flex items-center gap-3">
              <Grid className="text-casino-gold" size={20} />
              <h2 className="text-lg font-orbitron text-zinc-300">GRILLES JOUÉES ({playedGrids.length})</h2>
            </div>
            <button
              onClick={() => setGridSort(s => s === 'date' ? 'alpha' : 'date')}
              className="text-sm text-zinc-500 hover:text-white transition-colors"
            >
              Tri: {gridSort === 'date' ? 'Date' : 'Alpha'}
            </button>
          </div>
          
          <div className="max-h-[400px] overflow-y-auto">
            {sortedGrids.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">Aucune grille jouée</div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-zinc-800/50 sticky top-0">
                  <tr className="text-zinc-400 text-sm uppercase">
                    <th className="p-3">Date</th>
                    <th className="p-3">Numéros</th>
                    <th className="p-3">Étoiles</th>
                    <th className="p-3">Tirage visé</th>
                  </tr>
                </thead>
                <tbody className="font-rajdhani">
                  {sortedGrids.map(grid => {
                    return (
                    <tr
                      key={grid.id}
                      className="border-b border-zinc-800 hover:bg-white/5"
                    >
                      <td className="p-3 text-zinc-300">{formatDate(grid.playedAt)}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          {(grid.numbers as number[]).map(n => (
                            <span
                              key={n}
                              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all bg-blue-600 text-white"
                            >
                              {n}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          {(grid.stars as number[]).map(s => (
                            <span
                              key={s}
                              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all bg-yellow-500 text-black"
                            >
                              ★{s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-zinc-500">
                        {grid.targetDate || '—'}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
        
        {/* Back Button */}
        <div className="flex justify-center pt-4">
          <CasinoButton
            variant="secondary"
            onClick={() => setLocation('/settings/users')}
          >
            ← Retour à la gestion des abonnés
          </CasinoButton>
        </div>
      </div>
    </CasinoLayout>
  );
}

