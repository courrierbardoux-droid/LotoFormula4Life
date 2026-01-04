import React, { useState } from 'react';
import { CasinoLayout } from '@/components/layout/CasinoLayout';
import { useUser } from '@/lib/UserContext';
import { CasinoButton } from '@/components/casino/CasinoButton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Mail, User, Lock, Eye, EyeOff } from 'lucide-react';

export default function Profile() {
  const { user, setUser } = useUser();
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  // États pour les formulaires
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const handleUpdateEmail = async () => {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      toast.error('Email invalide');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: newEmail.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setUser(data.user);
        toast.success('Email mis à jour !');
        setShowEmailModal(false);
        setNewEmail('');
      } else {
        toast.error(data.error || 'Erreur lors de la mise à jour');
      }
    } catch (err) {
      toast.error('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUsername = async () => {
    if (!newUsername.trim()) {
      toast.error('L\'identifiant ne peut pas être vide');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: newUsername.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setUser(data.user);
        toast.success('Identifiant mis à jour !');
        setShowUsernameModal(false);
        setNewUsername('');
      } else {
        toast.error(data.error || 'Erreur lors de la mise à jour');
      }
    } catch (err) {
      toast.error('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword) {
      toast.error('Mot de passe actuel requis');
      return;
    }
    if (newPassword.length < 4) {
      toast.error('Le nouveau mot de passe doit faire au moins 4 caractères');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success('Mot de passe mis à jour !');
        setShowPasswordModal(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(data.error || 'Erreur lors de la mise à jour');
      }
    } catch (err) {
      toast.error('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrateur';
      case 'vip': return 'VIP';
      case 'abonne': return 'Abonné';
      default: return 'Invité';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'text-red-400';
      case 'vip': return 'text-purple-400';
      case 'abonne': return 'text-blue-400';
      default: return 'text-zinc-400';
    }
  };

  return (
    <CasinoLayout>
      <div className="max-w-2xl mx-auto p-6 md:p-12 mt-10">
        <div className="bg-zinc-900/90 border border-zinc-700 rounded-xl p-8 shadow-2xl transform scale-[1.15] origin-top min-w-[500px]" style={{ height: '120%' }}>
          <h1 className="text-3xl font-orbitron text-casino-gold mb-8 border-b border-zinc-700 pb-4">MON PROFIL</h1>
          
          <div className="space-y-6 font-rajdhani text-lg">
            {/* Identifiant avec bouton */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-sm text-zinc-500 uppercase tracking-widest">Identifiant</span>
                <span className="text-white text-xl font-bold">{user.username}</span>
              </div>
              <CasinoButton 
                variant="metal" 
                size="sm"
                className="bg-gradient-to-b from-[#e8f0f8] via-[#d0e0f0] to-[#a8c0d8] text-white border-blue-300 font-bold shadow-lg hover:shadow-xl hover:from-[#f0f8ff] hover:via-[#d8e8f8] hover:to-[#b0d0e8]"
                onClick={() => {
                  setNewUsername(user.username);
                  setShowUsernameModal(true);
                }}
              >
                Modifier identifiant
              </CasinoButton>
            </div>

            {/* Email avec bouton */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-sm text-zinc-500 uppercase tracking-widest">Email</span>
                <span className="text-white">{user.email}</span>
              </div>
              <CasinoButton 
                variant="metal" 
                size="sm"
                className="bg-gradient-to-b from-[#e8f0f8] via-[#d0e0f0] to-[#a8c0d8] text-white border-blue-300 font-bold shadow-lg hover:shadow-xl hover:from-[#f0f8ff] hover:via-[#d8e8f8] hover:to-[#b0d0e8]"
                onClick={() => {
                  setNewEmail(user.email);
                  setShowEmailModal(true);
                }}
              >
                Modifier email
              </CasinoButton>
            </div>

            {/* Rôle */}
            <div className="flex flex-col gap-1">
              <span className="text-sm text-zinc-500 uppercase tracking-widest">Rôle</span>
              <span className={`font-bold uppercase ${getRoleColor(user.role)}`}>
                {getRoleLabel(user.role)}
              </span>
            </div>

            {/* Mot de passe avec bouton */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-sm text-zinc-500 uppercase tracking-widest">Mot de passe</span>
                <span className="text-white">••••••••</span>
              </div>
              <CasinoButton 
                variant="metal" 
                size="sm"
                className="bg-gradient-to-b from-[#e8f0f8] via-[#d0e0f0] to-[#a8c0d8] text-white border-blue-300 font-bold shadow-lg hover:shadow-xl hover:from-[#f0f8ff] hover:via-[#d8e8f8] hover:to-[#b0d0e8]"
                onClick={() => setShowPasswordModal(true)}
              >
                Modifier mot de passe
              </CasinoButton>
            </div>

            {/* Membre depuis */}
            <div className="flex flex-col gap-1">
              <span className="text-sm text-zinc-500 uppercase tracking-widest">Membre depuis</span>
              <span className="text-white">{user.joinDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Email */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-casino-gold font-orbitron">
              <Mail className="h-5 w-5" />
              MODIFIER L'EMAIL
            </DialogTitle>
            <DialogDescription className="text-zinc-400 font-rajdhani">
              Entrez votre nouvel adresse email
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-zinc-500 uppercase tracking-widest mb-2 block">Nouvel email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full bg-black border border-zinc-600 rounded px-3 py-2 text-white focus:border-casino-gold outline-none"
                placeholder="nouveau@email.com"
                disabled={loading}
                onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleUpdateEmail(); }}
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <CasinoButton 
              variant="secondary" 
              onClick={() => setShowEmailModal(false)}
              disabled={loading}
            >
              Annuler
            </CasinoButton>
            <CasinoButton 
              onClick={handleUpdateEmail}
              disabled={loading}
            >
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </CasinoButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Username */}
      <Dialog open={showUsernameModal} onOpenChange={setShowUsernameModal}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-casino-gold font-orbitron">
              <User className="h-5 w-5" />
              MODIFIER L'IDENTIFIANT
            </DialogTitle>
            <DialogDescription className="text-zinc-400 font-rajdhani">
              Entrez votre nouvel identifiant
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-zinc-500 uppercase tracking-widest mb-2 block">Nouvel identifiant</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full bg-black border border-zinc-600 rounded px-3 py-2 text-white focus:border-casino-gold outline-none"
                placeholder="Nouvel identifiant"
                disabled={loading}
                onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleUpdateUsername(); }}
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <CasinoButton 
              variant="secondary" 
              onClick={() => setShowUsernameModal(false)}
              disabled={loading}
            >
              Annuler
            </CasinoButton>
            <CasinoButton 
              onClick={handleUpdateUsername}
              disabled={loading}
            >
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </CasinoButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Password */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-casino-gold font-orbitron">
              <Lock className="h-5 w-5" />
              MODIFIER LE MOT DE PASSE
            </DialogTitle>
            <DialogDescription className="text-zinc-400 font-rajdhani">
              Entrez votre mot de passe actuel et le nouveau
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-zinc-500 uppercase tracking-widest mb-2 block">Mot de passe actuel</label>
              <div className="relative">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-black border border-zinc-600 rounded px-3 py-2 text-white focus:border-casino-gold outline-none pr-10"
                  placeholder="Mot de passe actuel"
                  disabled={loading}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm text-zinc-500 uppercase tracking-widest mb-2 block">Nouveau mot de passe</label>
              <div className="relative">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-black border border-zinc-600 rounded px-3 py-2 text-white focus:border-casino-gold outline-none pr-10"
                  placeholder="Nouveau mot de passe"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm text-zinc-500 uppercase tracking-widest mb-2 block">Confirmer</label>
              <div className="relative">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-black border border-zinc-600 rounded px-3 py-2 text-white focus:border-casino-gold outline-none pr-10"
                  placeholder="Confirmer le nouveau mot de passe"
                  disabled={loading}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleUpdatePassword(); }}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <CasinoButton 
              variant="secondary" 
              onClick={() => {
                setShowPasswordModal(false);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
              }}
              disabled={loading}
            >
              Annuler
            </CasinoButton>
            <CasinoButton 
              onClick={handleUpdatePassword}
              disabled={loading}
            >
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </CasinoButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CasinoLayout>
  );
}
