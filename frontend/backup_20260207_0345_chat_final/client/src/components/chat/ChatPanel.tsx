import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { ConnectedUser } from '@/lib/chatSocket';
import EmojiPicker, { type EmojiClickData, Theme } from 'emoji-picker-react';
import { cn } from '@/lib/utils';
import { ChevronDown, MoreVertical, X, Check, Eye, EyeOff, Trash2 } from 'lucide-react';

function DownloadAttachmentButton({ attachment }: { attachment: { name: string; mime: string; dataBase64: string } }) {
  const handleDownload = useCallback(() => {
    try {
      const binary = atob(attachment.dataBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: attachment.mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.name;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed', e);
    }
  }, [attachment]);
  return (
    <button
      type="button"
      onClick={handleDownload}
      className="text-left text-lg text-casino-gold hover:text-amber-400 underline"
    >
      Télécharger / Enregistrer
    </button>
  );
}

const TYPING_DEBOUNCE_MS = 400;
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 Mo

type ChatSocketProps = {
  connected: boolean;
  connectedUsers: ConnectedUser[];
  messagesByUser: Record<number, import('@/lib/chatSocket').ChatMessage[]>;
  typingFrom: Record<number, string>;
  sendMessage: (toUserId: number, text: string, attachment?: { name: string; mime: string; dataBase64: string }) => void;
  sendTypingOn: (toUserId: number) => void;
  sendTypingOff: (toUserId: number) => void;
  requestHistory: (withUserId: number) => void;
  markConversationAsRead: (userId: number) => void;
  unreadCountByUser: Record<number, number>;
};

type ChatPanelProps = {
  onClose: () => void;
  isOpen: boolean;
  currentUserId: number;
  currentUsername: string;
  currentUserRole: string;
  chatSocket: ChatSocketProps;
};

export function ChatPanel({ onClose, isOpen, currentUserId, currentUsername, currentUserRole, chatSocket }: ChatPanelProps) {
  const {
    connected,
    connectedUsers,
    messagesByUser,
    typingFrom,
    sendMessage,
    sendTypingOn,
    sendTypingOff,
    requestHistory,
    markConversationAsRead,
    unreadCountByUser,
  } = chatSocket;

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [pendingFiles, setPendingFiles] = useState<Array<{ name: string; mime: string; dataBase64: string }>>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [contacts, setContacts] = useState<Array<{ userId: number; username: string }>>([]);

  // [MODIF] États de gestion avancée des contacts
  const [manualContacts, setManualContacts] = useState<Array<{ userId: number; username: string }>>([]);
  const [hiddenContactIds, setHiddenContactIds] = useState<number[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; userId: number } | null>(null);

  // États pour Admin / User dropdown
  const [allUsers, setAllUsers] = useState<Array<{ id: number; username: string; role: string }>>([]);
  const [isUserListOpen, setIsUserListOpen] = useState(false);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasAutoSelectedUnreadRef = useRef(false);

  // Charger les contacts masqués au démarrage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`loto_chat_hidden_${currentUserId}`);
      if (stored) {
        setHiddenContactIds(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Erreur chargement masqués", e);
    }
  }, [currentUserId]);

  const toggleHideContact = useCallback((userId: number) => {
    setHiddenContactIds(prev => {
      let newHidden;
      if (prev.includes(userId)) {
        newHidden = prev.filter(id => id !== userId);
      } else {
        newHidden = [...prev, userId];
        // Si on masque, on le vire aussi des manuels pour être sûr
        setManualContacts(pm => pm.filter(c => c.userId !== userId));
        // Et on ferme la conv si ouverte
        if (selectedUserId === userId) setSelectedUserId(null);
      }
      localStorage.setItem(`loto_chat_hidden_${currentUserId}`, JSON.stringify(newHidden));
      return newHidden;
    });
  }, [currentUserId, selectedUserId]);

  // Récupérer les contacts habituels
  const refetchContacts = useCallback(() => {
    fetch('/api/chat/contacts', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { contacts: [] }))
      .then((data) => setContacts(data.contacts ?? []))
      .catch(() => setContacts([]));
  }, []);

  useEffect(() => {
    refetchContacts();
  }, [refetchContacts]);

  // Si Admin, récupérer TOUS les utilisateurs pour le dropdown
  useEffect(() => {
    if (currentUserRole === 'admin') {
      fetch('/api/users', { credentials: 'include' })
        .then(r => r.ok ? r.json() : [])
        .then(data => setAllUsers(data)) // api/users renvoie tableau d'objets users
        .catch(err => console.error("Erreur fetch all users", err));
    }
  }, [currentUserRole]);

  // Fonction pour contacter l'admin (côté User)
  const handleContactAdmin = useCallback(() => {
    fetch('/api/chat/admin-info', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(admin => {
        if (admin && admin.id) {
          // Ajouter aux manuels
          setManualContacts(prev => {
            if (prev.find(c => c.userId === admin.id)) return prev;
            return [...prev, { userId: admin.id, username: admin.username }];
          });
          setSelectedUserId(admin.id);
        }
      })
      .catch(err => console.error("Erreur contact admin", err));
  }, []);

  // Fonction pour sélectionner un user via dropdown (côté Admin)
  const handleAdminSelectUser = useCallback((user: { id: number; username: string }) => {
    // 1. Ajouter aux contacts MANUELS (pour persistance locale immédiate)
    setManualContacts(prev => {
      if (prev.find(c => c.userId === user.id)) return prev;
      return [...prev, { userId: user.id, username: user.username }];
    });
    // 2. S'assurer qu'il n'est plus masqué (si on le ré-ouvre volontairement)
    setHiddenContactIds(prev => {
      if (prev.includes(user.id)) {
        const newHidden = prev.filter(id => id !== user.id);
        localStorage.setItem(`loto_chat_hidden_${currentUserId}`, JSON.stringify(newHidden));
        return newHidden;
      }
      return prev;
    });

    setSelectedUserId(user.id);
    setIsUserListOpen(false);
  }, [currentUserId]);

  const conversationCount = Object.keys(messagesByUser).length;
  useEffect(() => {
    if (conversationCount > 0) refetchContacts();
  }, [conversationCount, refetchContacts]);

  const connectedIds = new Set(connectedUsers.map((u) => u.userId));

  // FUSION INTELLIGENTE DES CONTACTS
  // 1. On part des contacts API (ceux avec historique)
  const contactsMap = new Map(contacts.map((c) => [c.userId, c]));

  // 2. On ajoute les manuels (ceux ajoutés via dropdown, pas encore d'historique API)
  manualContacts.forEach(c => {
    if (!contactsMap.has(c.userId)) {
      contactsMap.set(c.userId, c);
    }
  });

  // 3. On filtre ce qui est masqué
  // Sauf si c'est l'utilisateur en cours de sélection (on le laisse visible tant qu'il est actif)
  const visibleContacts = Array.from(contactsMap.values()).filter(c => {
    // Si c'est l'utilisateur sélectionné, on le garde visible (sauf s'il vient d'être caché par l'action courante, mais l'effet de toggle gère ça)
    if (c.userId === selectedUserId) return true;
    return !hiddenContactIds.includes(c.userId);
  });

  // 4. On prépare l'affichage
  let others = visibleContacts
    .filter((c) => c.userId !== currentUserId)
    .map((c) => ({ userId: c.userId, username: c.username, isOnline: connectedIds.has(c.userId) }));

  // Si non admin, ne montrer que les admins dans la liste (sécurité visuelle supplémentaire)
  if (currentUserRole !== 'admin') {
    // Idéalement on filtrerait sur le rôle, mais connectedUsers ne donne pas le rôle.
    // On fait confiance au backend /api/chat/contacts qui filtre déjà.
  }

  const messages = selectedUserId ? (messagesByUser[selectedUserId] ?? []) : [];

  useEffect(() => {
    if (selectedUserId) requestHistory(selectedUserId);
  }, [selectedUserId, requestHistory]);

  // Réinitialiser le ref à la fermeture
  useEffect(() => {
    if (!isOpen) hasAutoSelectedUnreadRef.current = false;
  }, [isOpen]);

  // Clé de stockage (Persistance)
  const storageKey = `loto_last_chat_user_${currentUserId}`;

  useEffect(() => {
    if (selectedUserId) {
      localStorage.setItem(storageKey, String(selectedUserId));
    }
  }, [selectedUserId, storageKey]);

  // Auto-sélection
  useEffect(() => {
    if (selectedUserId !== null || hasAutoSelectedUnreadRef.current) return;
    hasAutoSelectedUnreadRef.current = true;

    // 1. Non lus
    const unreadIds = Object.keys(unreadCountByUser).map(Number);
    if (unreadIds.length > 0) {
      const firstUnread = unreadIds.reduce((a, b) => (unreadCountByUser[a] ?? 0) >= (unreadCountByUser[b] ?? 0) ? a : b);
      setSelectedUserId(firstUnread);
      return;
    }

    // 2. Storage
    const storedLastId = localStorage.getItem(storageKey);
    if (storedLastId) {
      const id = Number(storedLastId);
      // Vérifier si présent dans others (même masqué, on pourrait vouloir le restaurer, mais ici on check others qui filtre)
      // On accepte si l'ID est valide, ça rechargera l'historique
      if (!isNaN(id)) { setSelectedUserId(id); return; }
    }

    // 3. Historique
    const talkedToIds = Object.keys(messagesByUser).map(Number);
    if (talkedToIds.length > 0) {
      setSelectedUserId(talkedToIds[0]);
      return;
    }

    // 4. Premier contact
    if (others.length > 0) {
      setSelectedUserId(others[0].userId);
    }
  }, [selectedUserId, unreadCountByUser, messagesByUser, others, storageKey]);

  useEffect(() => {
    if (selectedUserId) markConversationAsRead(selectedUserId);
  }, [selectedUserId, markConversationAsRead, messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleDraftChange = useCallback((value: string) => {
    setDraft(value);
    if (!selectedUserId) return;
    sendTypingOn(selectedUserId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingOff(selectedUserId);
    }, TYPING_DEBOUNCE_MS);
  },
    [selectedUserId, sendTypingOn, sendTypingOff]
  );

  const handleSend = useCallback(() => {
    if (!selectedUserId) return;
    const text = draft.trim();
    if (text || pendingFiles.length > 0) {
      const attachment = pendingFiles[0];
      sendMessage(selectedUserId, text || '(fichier)', attachment);
      setDraft('');
      setPendingFiles([]);
      sendTypingOff(selectedUserId);
      refetchContacts();
    }
  }, [selectedUserId, draft, pendingFiles, sendMessage, sendTypingOff, refetchContacts]);

  const handleClear = useCallback(() => {
    setDraft('');
    setPendingFiles([]);
    if (selectedUserId) sendTypingOff(selectedUserId);
  }, [selectedUserId, sendTypingOff]);

  const handleEmojiClick = useCallback((data: EmojiClickData) => {
    setDraft((prev) => prev + (data.emoji ?? ''));
  }, []);

  const addFile = useCallback((file: File) => {
    if (file.size > MAX_FILE_SIZE) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataBase64 = (reader.result as string).split(',')[1];
      if (dataBase64)
        setPendingFiles((prev) => [...prev.slice(0, 0), { name: file.name, mime: file.type || 'application/octet-stream', dataBase64 }]);
    };
    reader.readAsDataURL(file);
  }, []);

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) addFile(f);
    e.target.value = '';
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) addFile(f);
  }, [addFile]);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();

  const selectedUsername = others.find((u) => u.userId === selectedUserId)?.username ?? null;
  const typingUsername = selectedUserId && typingFrom[selectedUserId] ? typingFrom[selectedUserId] : null;

  // Gestion du menu contextuel
  const handleContextMenu = (e: React.MouseEvent, userId: number) => {
    if (currentUserRole !== 'admin') return; // Admin only
    e.preventDefault();
    e.stopPropagation();

    // Calculer la position pour que le menu reste dans l'écran
    const x = Math.min(e.clientX, window.innerWidth - 180);
    const y = Math.min(e.clientY, window.innerHeight - 150);

    setContextMenu({ x, y, userId });
  };

  const closeContextMenu = () => setContextMenu(null);

  // Actions menu contextuel
  const executeContextAction = (action: 'open' | 'close' | 'remove') => {
    if (!contextMenu) return;
    const { userId } = contextMenu;

    if (action === 'open') {
      setSelectedUserId(userId);
    } else if (action === 'close') {
      if (selectedUserId === userId) setSelectedUserId(null);
    } else if (action === 'remove') {
      // Retire de la liste manuelle ET ajoute aux masqués
      toggleHideContact(userId);
    }
    closeContextMenu();
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 min-h-0" onClick={closeContextMenu}>

      {/* HEADER INTEGRE */}
      <div className="flex items-center p-4 border-b border-zinc-800 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full border-2 border-red-600 bg-red-950/50 text-red-500 hover:bg-red-900/50 hover:text-red-400 flex items-center justify-center flex-shrink-0"
          title="Fermer"
        >
          <span className="text-2xl font-bold leading-none">×</span>
        </button>

        {/* Titre CHAT */}
        <h2 className="flex-1 text-center font-orbitron text-lg text-casino-gold tracking-widest pl-2">CHAT</h2>

        {/* Zone Droite (Dropdown Admin ou Bouton User) */}
        <div className="flex-shrink-0 ml-4 relative">
          {currentUserRole === 'admin' ? (
            // MODE ADMIN : Menu déroulant style "Tarifs"
            <div className="relative">
              <div
                className="flex flex-col items-center group cursor-pointer"
                onClick={(e) => { e.stopPropagation(); setIsUserListOpen(!isUserListOpen); }}
                title="Démarrer une discussion"
              >
                <div className="flex items-center gap-2 text-casino-gold font-orbitron font-bold text-sm md:text-base leading-none shadow-gold-glow whitespace-nowrap">
                  <span>DISCUTER AVEC...</span>
                  <ChevronDown size={16} className={cn("transition-transform", isUserListOpen && "rotate-180")} />
                </div>
              </div>
              {isUserListOpen && (
                <div
                  className="absolute top-full right-0 mt-2 w-64 bg-zinc-950 border border-zinc-600 rounded-lg shadow-[0_20px_60px_rgba(0,0,0,0.9)] z-[9999] max-h-[60vh] overflow-y-auto custom-scrollbar ring-1 ring-white/10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-2 border-b border-zinc-800 bg-zinc-900/95 sticky top-0 backdrop-blur-md z-10">
                    <div className="text-xs font-bold text-center text-zinc-300 font-rajdhani tracking-widest">UTILISATEURS ({allUsers.length})</div>
                  </div>
                  <div className="flex flex-col">
                    {allUsers.map(u => (
                      <button
                        key={u.id}
                        onClick={() => handleAdminSelectUser(u)}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 hover:bg-zinc-800/80 active:bg-zinc-700 transition-all border-b border-zinc-800/50 last:border-0 text-left text-sm",
                          u.id === currentUserId ? "opacity-50 cursor-default" : "cursor-pointer"
                        )}
                        disabled={u.id === currentUserId}
                      >
                        <span className={cn(
                          "font-rajdhani font-medium truncate",
                          u.role === 'admin' ? "text-red-400" : "text-zinc-300"
                        )}>
                          {u.username}
                        </span>
                        {u.role === 'admin' && <span className="text-[10px] text-red-500 border border-red-900 px-1 rounded bg-red-950/30">ADMIN</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // MODE USER : Bouton "Contacter Admin"
            <button
              onClick={handleContactAdmin}
              className="flex items-center px-3 py-1.5 rounded border border-casino-gold/40 text-casino-gold bg-black/40 hover:bg-casino-gold/10 hover:border-casino-gold transition-all font-orbitron text-xs font-bold tracking-wider shadow-gold-glow whitespace-nowrap"
              title="Parler à l'administrateur"
            >
              CONTACTER L'ADMIN
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Liste des connectés */}
        <div className="w-52 min-w-[11rem] border-r border-zinc-800 flex flex-col overflow-hidden relative">
          <div className="p-2 text-zinc-500 text-base uppercase tracking-wider font-bold">
            {currentUserRole === 'admin' ? 'Contacts' : 'Support'}
          </div>
          <div className="flex-1 overflow-y-auto">
            {!connected && <div className="p-2 text-zinc-500 text-lg">Connexion…</div>}

            {connected && others.length === 0 && (
              <div className="p-2 text-zinc-500 font-rajdhani italic text-sm text-center mt-4 opacity-60">
                {currentUserRole === 'admin' ? 'Aucune discussion récente.' : 'Cliquez sur "CONTACTER L\'ADMIN" pour commencer.'}
              </div>
            )}

            {others.map((u) => (
              <button
                key={u.userId}
                type="button"
                onClick={() => setSelectedUserId(u.userId)}
                onContextMenu={(e) => handleContextMenu(e, u.userId)}
                className={cn(
                  'w-full text-left px-3 py-2 text-lg rounded-r transition-colors flex items-center justify-between gap-1 group relative',
                  selectedUserId === u.userId
                    ? 'bg-casino-gold/20 text-casino-gold border-l-2 border-casino-gold'
                    : 'text-zinc-300 hover:bg-zinc-800'
                )}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={cn(
                      'w-2.5 h-2.5 rounded-full flex-shrink-0',
                      u.isOnline ? 'bg-green-500' : 'bg-red-500'
                    )}
                    title={u.isOnline ? 'En ligne' : 'Hors ligne'}
                  />
                  <span className="truncate">{u.username}</span>
                </span>
                {(unreadCountByUser[u.userId] ?? 0) > 0 && (
                  <span className="text-red-500 font-mono tabular-nums text-base flex-shrink-0">
                    {unreadCountByUser[u.userId]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedUserId ? (
            <div className="flex-1 flex items-center justify-center text-zinc-500 text-lg p-4 font-rajdhani">
              Sélectionnez un contact à gauche.
            </div>
          ) : (
            <>
              <div className="p-2 border-b border-zinc-800 text-zinc-400 text-lg font-bold flex justify-between items-center">
                <span>Conversation avec {selectedUsername}</span>
              </div>

              {/* Messages */}
              <div
                className="flex-1 overflow-y-auto p-3 space-y-2"
                onDrop={onDrop}
                onDragOver={onDragOver}
              >
                {messages.map((msg) => {
                  const isMe = msg.from === currentUserId;
                  return (
                    <div
                      key={`${msg.at}-${msg.from}-${msg.text.slice(0, 20)}`}
                      className={cn(
                        'flex',
                        isMe ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[85%] rounded-lg px-3 py-2 text-base shadow-sm',
                          isMe
                            ? 'bg-blue-900/60 text-blue-100 border border-blue-700/50'
                            : 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                        )}
                      >
                        {!isMe && (
                          <div className="text-xs uppercase font-bold text-zinc-500 mb-0.5">
                            {msg.from === selectedUserId ? selectedUsername : 'Autre'}
                          </div>
                        )}
                        <div className="whitespace-pre-wrap break-words text-lg font-sans">{msg.text}</div>
                        {msg.attachment && (
                          <div className="mt-2 flex flex-col gap-1 border-t border-white/10 pt-1">
                            <span className="text-sm text-zinc-400 flex items-center gap-1">📎 {msg.attachment.name}</span>
                            <DownloadAttachmentButton attachment={msg.attachment} />
                          </div>
                        )}
                        <div className={cn(
                          "text-[10px] mt-1 opacity-70 select-none font-rajdhani",
                          isMe ? "text-blue-200 text-right" : "text-zinc-500 text-left"
                        )}>
                          {(() => {
                            const d = new Date(msg.at);
                            const now = new Date();
                            const isToday = d.toDateString() === now.toDateString();
                            return isToday
                              ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : d.toLocaleDateString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Typing indicator */}
                {typingUsername && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-800 rounded-lg px-3 py-2 border border-zinc-700 flex items-center gap-1">
                      <span className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                      <span className="text-sm text-zinc-500 ml-1 italic">{typingUsername} écrit…</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Pièces jointes en attente */}
              {pendingFiles.length > 0 && (
                <div className="px-3 py-2 flex items-center gap-2 text-sm text-zinc-400 bg-zinc-900/50 border-t border-zinc-800">
                  📎 {pendingFiles.map((f) => f.name).join(', ')}
                  <button
                    type="button"
                    onClick={() => setPendingFiles([])}
                    className="text-red-400 hover:text-red-300 ml-2"
                  >
                    (Retirer)
                  </button>
                </div>
              )}

              {/* Zone saisie */}
              <div className="relative p-2 border-t border-zinc-800 space-y-2 bg-zinc-950">
                <div className="flex gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => handleDraftChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Votre message..."
                    rows={1}
                    className="flex-1 min-w-0 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-base text-white placeholder-zinc-600 resize-none focus:outline-none focus:border-casino-gold/50 focus:ring-1 focus:ring-casino-gold/20 transition-all custom-scrollbar"
                    style={{ minHeight: '44px', maxHeight: '120px' }}
                  />
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-10 h-10 rounded-lg border border-zinc-700 text-zinc-400 hover:border-casino-gold hover:text-casino-gold hover:bg-zinc-900 flex items-center justify-center transition-colors"
                      title="Ajouter un fichier"
                    >
                      📎
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={onFileInputChange}
                    />
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowEmoji((s) => !s)}
                      className="w-10 h-10 rounded-lg border border-zinc-700 text-zinc-400 hover:border-casino-gold hover:text-casino-gold hover:bg-zinc-900 flex items-center justify-center transition-colors text-xl"
                      title="Emojis"
                    >
                      😀
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleSend}
                    className="w-12 h-auto rounded-lg bg-casino-gold/90 text-black font-bold hover:bg-casino-gold transition-colors flex items-center justify-center shadow-gold-glow"
                    title="Envoyer"
                  >
                    ➤
                  </button>
                </div>

                {showEmoji && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowEmoji(false)} />
                    <div className="absolute bottom-full right-2 mb-2 z-40 shadow-2xl relative group">
                      <button
                        className="absolute -top-3 -left-3 z-50 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md hover:bg-red-500 transition-colors border border-white/20"
                        onClick={() => setShowEmoji(false)}
                        title="Fermer"
                      >
                        <X size={14} strokeWidth={3} />
                      </button>
                      <EmojiPicker onEmojiClick={handleEmojiClick} theme={Theme.DARK} width={300} height={350} />
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* MENU CONTEXTUEL (PORTAL OU ABSOLUTE) */}
      {contextMenu && (
        <div
          className="fixed z-[10000] min-w-[160px] bg-zinc-900 border border-zinc-600 rounded-lg shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-4 py-2 hover:bg-zinc-800 text-zinc-200 flex items-center gap-2"
            onClick={() => executeContextAction('open')}
          >
            <Eye size={16} /> <span>Ouvrir</span>
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-zinc-800 text-zinc-200 flex items-center gap-2"
            onClick={() => executeContextAction('close')}
          >
            <EyeOff size={16} /> <span>Fermer</span>
          </button>
          <div className="h-px bg-zinc-700 my-1" />
          <button
            className="w-full text-left px-4 py-2 hover:bg-red-900/30 text-red-400 flex items-center gap-2"
            onClick={() => executeContextAction('remove')}
          >
            <Trash2 size={16} /> <span>Enlever</span>
          </button>
        </div>
      )}

    </div>
  );
}
