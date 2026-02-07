
import React, { useState, useEffect } from 'react';
import { CasinoLayout } from '@/components/layout/CasinoLayout';
import { CasinoButton } from '@/components/casino/CasinoButton';
import { useUser, UserRole } from '@/lib/UserContext';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';

export default function SubscriberManagement() {
  // Use global state instead of local state
  const { allUsers, updateUserRole, deleteUser, sendInvitation, user, refreshUsers } = useUser();
  const [, setLocation] = useLocation();
  
  // Charger la liste des utilisateurs au montage de la page
  useEffect(() => {
    refreshUsers();
  }, []);
  const [inviteEmail, setInviteEmail] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [codeType, setCodeType] = useState<'invite' | 'vip'>('vip');
  const [isSending, setIsSending] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);
  
  // Popup status tracking
  const [popupStatuses, setPopupStatuses] = useState<Record<number, string>>({});
  
  // Charger les statuts popup au montage
  useEffect(() => {
    const loadPopupStatuses = async () => {
      try {
        // Pour chaque utilisateur VIP ou Abonné, récupérer leur statut popup
        const statuses: Record<number, string> = {};
        for (const u of allUsers) {
          if (u.role === 'vip' || u.role === 'abonne') {
            try {
              const res = await fetch(`/api/admin/user/${u.id}/details`, { credentials: 'include' });
              if (res.ok) {
                const data = await res.json();
                statuses[u.id] = data.user.popupStatus || 'active';
              }
            } catch (e) {
              // Ignorer les erreurs individuelles
            }
          }
        }
        setPopupStatuses(statuses);
      } catch (err) {
        console.error('Erreur chargement popup statuses:', err);
      }
    };
    
    if (allUsers.length > 0) {
      loadPopupStatuses();
    }
  }, [allUsers]);
  
  // Toggle popup status pour un utilisateur
  const handleTogglePopup = async (userId: number, currentStatus: string) => {
    // Cycle: active (vert) → reduced (rouge) → disabled (gris) → active ...
    const nextStatus = currentStatus === 'active' ? 'reduced' 
                     : currentStatus === 'reduced' ? 'disabled' 
                     : 'active';
    
    try {
      const res = await fetch(`/api/users/${userId}/popup`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ popupStatus: nextStatus }),
      });
      
      if (res.ok) {
        setPopupStatuses(prev => ({ ...prev, [userId]: nextStatus }));
        const statusLabel = nextStatus === 'active' ? 'Actif' : nextStatus === 'reduced' ? 'Réduit' : 'Désactivé';
        toast.success(`Popup ${statusLabel}`);
      }
    } catch (err) {
      toast.error('Erreur mise à jour popup');
    }
  };
  
  // Naviguer vers la page détails utilisateur
  const handleViewDetails = (userId: number) => {
    setLocation(`/user/${userId}`);
  };

  // Générer un code à 6 chiffres
  const generateCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(code);
    toast.success(`Code ${codeType.toUpperCase()} généré : ${code}`);
  };

  // Toggle le type de code
  const toggleCodeType = () => {
    setCodeType(prev => prev === 'vip' ? 'invite' : 'vip');
    setGeneratedCode(''); // Reset le code quand on change de type
  };

  const handleRoleChange = (id: number, newRole: string) => {
    updateUserRole(id, newRole as UserRole);
    toast.success('Rôle mis à jour');
  };

  const handleInvite = async () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
        toast.error('Email invalide');
        return;
    }
    if (!generatedCode) {
        toast.error('Veuillez générer un code d\'abord');
        return;
    }

    // Confirmation simple (pour éviter le "j'envoie sans le vouloir")
    const ok = window.confirm(
      `Confirmer l'envoi d'une invitation ${codeType.toUpperCase()} à :\n\n${inviteEmail}\n\nCode : ${generatedCode}\n\nConfirmer ?`
    );
    if (!ok) return;
    
    setIsSending(true);
    try {
      const success = await sendInvitation(inviteEmail, generatedCode, codeType);
      if (success) {
        toast.success(`Invitation ${codeType.toUpperCase()} envoyée à ${inviteEmail}`);
        setInviteEmail('');
        setGeneratedCode('');
      } else {
        toast.error('Erreur lors de l\'envoi de l\'invitation');
      }
    } catch (error) {
      toast.error('Erreur lors de l\'envoi');
    } finally {
      setIsSending(false);
    }
  };

  // Gérer le clic sur le bouton supprimer
  const handleDeleteClick = async (id: number, username: string) => {
      if (confirmingDeleteId === id) {
          // Confirmer la suppression
          await deleteUser(id);
          toast.success(`${username} supprimé`);
          setConfirmingDeleteId(null);
          refreshUsers();
      } else {
          // Demander confirmation
          setConfirmingDeleteId(id);
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
        <div className="flex flex-col justify-center items-center gap-4 mb-8">
            <h1 className="text-3xl font-orbitron text-casino-gold">INFORMATIONS UTILISATEURS</h1>
            
            {/* Ligne 1: Email + Bouton Inviter */}
            <div className="flex items-center gap-4">
                <input 
                    type="email" 
                    placeholder="Email pour invitation" 
                    className="bg-black border border-zinc-700 p-2.5 rounded text-xl text-white font-rajdhani w-80 placeholder:text-zinc-600 h-[42px]"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                />
                <CasinoButton 
                  variant="primary" 
                  size="sm" 
                  className="h-[42px] px-6" 
                  onClick={handleInvite}
                  disabled={isSending || !generatedCode}
                >
                  {isSending ? 'ENVOI...' : `INVITER ${codeType.toUpperCase()}`}
                </CasinoButton>
            </div>
            
            {/* Ligne 2: Générateur de code + Toggle type */}
            <div className="flex items-center gap-4">
                {/* Champ code généré */}
                <div className="flex items-center gap-2">
                    <div 
                        className={`bg-black border border-zinc-700 p-2.5 rounded text-xl font-mono font-bold w-40 h-[42px] flex items-center justify-center tracking-[0.3em] ${
                            generatedCode 
                                ? (codeType === 'vip' ? 'text-green-400 border-green-500/50' : 'text-white border-zinc-500') 
                                : 'text-zinc-600'
                        }`}
                    >
                        {generatedCode || '------'}
                    </div>
                    <button 
                        onClick={generateCode}
                        className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded h-[42px] px-4 flex items-center gap-2 text-white font-rajdhani transition-colors"
                    >
                        <RefreshCw size={16} />
                        GÉNÉRER
                    </button>
                </div>
                
                {/* Toggle Code INVITE / Code VIP */}
                <button 
                    onClick={toggleCodeType}
                    className={`h-[42px] px-6 rounded font-orbitron text-sm font-bold uppercase tracking-wider transition-all ${
                        codeType === 'vip' 
                            ? 'bg-green-900 hover:bg-green-800 text-green-200 border border-green-500/50' 
                            : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600'
                    }`}
                >
                    CODE {codeType.toUpperCase()}
                </button>
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
                <th className="p-4 text-center">Popup</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            {/* Increased font size from text-sm to text-xl (+2 levels approx: sm->base->lg->xl) */}
            <tbody className="font-rajdhani text-xl">
              {allUsers.map((sub) => (
                <tr key={sub.id} className="border-b border-zinc-800 hover:bg-white/5 transition-colors">
                  <td className="p-4 text-white font-bold">
                    <button 
                      onClick={() => handleViewDetails(sub.id)}
                      className="hover:text-casino-gold hover:underline transition-colors"
                      disabled={sub.username === 'AntoAbso'}
                    >
                      {sub.username}
                    </button>
                  </td>
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
                  <td className="p-4 text-center">
                    {(sub.role === 'vip' || sub.role === 'abonne') ? (
                      <button
                        onClick={() => handleTogglePopup(sub.id, popupStatuses[sub.id] || 'active')}
                        className={cn(
                          "w-6 h-6 rounded-full transition-all duration-200 shadow-inner border-2",
                          popupStatuses[sub.id] === 'active' && "bg-green-500 border-green-400 shadow-green-500/50",
                          popupStatuses[sub.id] === 'reduced' && "bg-red-500 border-red-400 shadow-red-500/50",
                          popupStatuses[sub.id] === 'disabled' && "bg-zinc-600 border-zinc-500 shadow-none",
                          !popupStatuses[sub.id] && "bg-green-500 border-green-400 shadow-green-500/50" // Default active
                        )}
                        title={
                          popupStatuses[sub.id] === 'disabled' ? 'Popup désactivé' :
                          popupStatuses[sub.id] === 'reduced' ? 'Popup réduit (1/10)' :
                          'Popup actif'
                        }
                      />
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="p-4 text-right space-x-2">
                      <button 
                        onClick={() => handleViewDetails(sub.id)}
                        className="text-blue-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={sub.username === 'AntoAbso'}
                      >
                        Modifier
                      </button>
                      <button 
                        onClick={() => setConfirmingDeleteId(sub.id)}
                        className="text-red-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={sub.username === 'AntoAbso' || confirmingDeleteId === sub.id}
                      >
                        Supprimer
                      </button>
                      {confirmingDeleteId === sub.id && (
                        <>
                          <button 
                            onMouseDown={async () => {
                              const success = await deleteUser(sub.id);
                              if (success) {
                                toast.success(`${sub.username} supprimé`);
                              } else {
                                toast.error(`Erreur lors de la suppression de ${sub.username}`);
                              }
                              setConfirmingDeleteId(null);
                            }}
                            className="text-white bg-red-600 px-2 py-0.5 rounded font-bold hover:bg-red-500"
                          >
                            OK
                          </button>
                          <button 
                            onClick={() => setConfirmingDeleteId(null)}
                            className="text-zinc-400 hover:text-white"
                          >
                            ✕
                          </button>
                        </>
                      )}
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
