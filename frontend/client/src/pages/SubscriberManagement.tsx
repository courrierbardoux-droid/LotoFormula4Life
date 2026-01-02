
import React, { useState } from 'react';
import { CasinoLayout } from '@/components/layout/CasinoLayout';
import { CasinoButton } from '@/components/casino/CasinoButton';
import { useUser, UserRole } from '@/lib/UserContext';
import { toast } from 'sonner';

export default function SubscriberManagement() {
  // Use global state instead of local state
  const { allUsers, updateUserRole, deleteUser, inviteUser, user } = useUser();
  const [inviteEmail, setInviteEmail] = useState('');

  const handleRoleChange = (id: number, newRole: string) => {
    updateUserRole(id, newRole as UserRole);
    toast.success('Rôle mis à jour');
  };

  const handleInvite = () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
        toast.error('Email invalide');
        return;
    }
    inviteUser(inviteEmail);
    setInviteEmail('');
    toast.success(`Invitation envoyée à ${inviteEmail}`);
  };

  const handleDelete = (id: number, username: string) => {
      if (window.confirm(`Êtes-vous sûr de vouloir supprimer ${username} ?`)) {
          deleteUser(id);
          toast.success(`${username} supprimé`);
      }
  };

  const handleEdit = (id: number) => {
      // For mockup: simple alert or prompt to simulate edit
      // Since we don't have a full edit form in context yet, we'll just show a message or maybe implement a simple rename if I added renameUser to context.
      // But for now, let's just say "Feature de modification complète à venir" or use prompt to "mock" it visually.
      // Actually, user context doesn't support update name/email yet.
      // Let's stick to Role update which is inline.
      toast.info("La modification des détails utilisateur sera disponible dans la version finale.");
  };

  return (
    <CasinoLayout>
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row justify-center items-center gap-8 mb-8">
            <h1 className="text-3xl font-orbitron text-casino-gold">GESTION DES ABONNÉS</h1>
            <div className="flex items-center gap-4">
                <input 
                    type="email" 
                    placeholder="Email pour invitation VIP" 
                    className="bg-black border border-zinc-700 p-2.5 rounded text-xl text-white font-rajdhani w-80 placeholder:text-zinc-600 h-[42px]"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                />
                <CasinoButton variant="primary" size="sm" className="h-[42px] px-6" onClick={handleInvite}>INVITER VIP</CasinoButton>
            </div>
        </div>

        <div className="bg-zinc-900/90 border border-zinc-700 rounded-xl overflow-hidden shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              {/* Increased font size from text-xs to text-lg (+2 levels approx: xs->sm->base->lg) */}
              <tr className="bg-black text-zinc-400 text-lg uppercase font-orbitron tracking-wider border-b border-zinc-700">
                <th className="p-4">Identifiant</th>
                <th className="p-4">Email</th>
                <th className="p-4">Statut</th>
                <th className="p-4">Inscription</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            {/* Increased font size from text-sm to text-xl (+2 levels approx: sm->base->lg->xl) */}
            <tbody className="font-rajdhani text-xl">
              {allUsers.map((sub) => (
                <tr key={sub.id} className="border-b border-zinc-800 hover:bg-white/5 transition-colors">
                  <td className="p-4 text-white font-bold">{sub.username}</td>
                  <td className="p-4 text-zinc-400">{sub.email}</td>
                  <td className="p-4">
                    <select 
                        value={sub.role}
                        onChange={(e) => handleRoleChange(sub.id, e.target.value)}
                        className={`px-2 py-1 rounded font-bold uppercase border-none focus:ring-1 focus:ring-casino-gold cursor-pointer appearance-none text-center ${
                            sub.role === 'vip' ? 'bg-purple-900 text-purple-200' :
                            sub.role === 'admin' ? 'bg-red-900 text-red-200' :
                            sub.role === 'abonne' ? 'bg-blue-900 text-blue-200' : 'bg-zinc-800 text-zinc-400'
                        }`}
                        // Disable admin selection for users unless it's the main admin account (AntoAbso)
                        // Actually, per request "Enlève admin de tout les inscrit sauf du mien", we just want to remove the option from the list if the user being edited isn't the main admin.
                        // Or we can just disable the whole select if it's the main admin (so they can't accidentally demote themselves)
                        disabled={sub.username === 'AntoAbso'}
                    >
                        {/* Only show Admin option if this user IS the main admin */}
                        {sub.username === 'AntoAbso' ? (
                            <option value="admin" className="bg-black text-white">ADMINISTRATEUR</option>
                        ) : null}
                        
                        <option value="vip" className="bg-black text-white">VIP</option>
                        <option value="abonne" className="bg-black text-white">ABONNÉ</option>
                        <option value="invite" className="bg-black text-white">INVITÉ</option>
                    </select>
                  </td>
                  <td className="p-4 text-zinc-400">{sub.joinDate}</td>
                  <td className="p-4 text-right space-x-2">
                      <button 
                        onClick={() => handleEdit(sub.id)}
                        className="text-blue-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={sub.username === 'AntoAbso'}
                      >
                        Modifier
                      </button>
                      <button 
                        onClick={() => handleDelete(sub.id, sub.username)}
                        className="text-red-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={sub.username === 'AntoAbso'}
                      >
                        Supprimer
                      </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </CasinoLayout>
  );
}
