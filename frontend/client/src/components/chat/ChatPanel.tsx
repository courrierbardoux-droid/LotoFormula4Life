import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { ConnectedUser } from '@/lib/chatSocket';
import EmojiPicker, { type EmojiClickData, Theme } from 'emoji-picker-react';
import { cn } from '@/lib/utils';

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
  chatSocket: ChatSocketProps;
};

export function ChatPanel({ onClose, isOpen, currentUserId, currentUsername, chatSocket }: ChatPanelProps) {
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
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasAutoSelectedUnreadRef = useRef(false);

  const refetchContacts = useCallback(() => {
    fetch('/api/chat/contacts', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { contacts: [] }))
      .then((data) => setContacts(data.contacts ?? []))
      .catch(() => setContacts([]));
  }, []);

  useEffect(() => {
    refetchContacts();
  }, [refetchContacts]);

  const conversationCount = Object.keys(messagesByUser).length;
  useEffect(() => {
    if (conversationCount > 0) refetchContacts();
  }, [conversationCount, refetchContacts]);

  const connectedIds = new Set(connectedUsers.map((u) => u.userId));
  const contactsMap = new Map(contacts.map((c) => [c.userId, c]));
  connectedUsers.forEach((u) => {
    if (u.userId !== currentUserId && !contactsMap.has(u.userId)) contactsMap.set(u.userId, u);
  });
  const others = Array.from(contactsMap.entries())
    .filter(([id]) => id !== currentUserId)
    .map(([userId, c]) => ({ userId, username: c.username, isOnline: connectedIds.has(userId) }));
  const messages = selectedUserId ? (messagesByUser[selectedUserId] ?? []) : [];

  useEffect(() => {
    if (selectedUserId) requestHistory(selectedUserId);
  }, [selectedUserId, requestHistory]);

  // Réinitialiser le ref à la fermeture du volet pour que l'auto-sélection refasse à la prochaine ouverture
  useEffect(() => {
    if (!isOpen) hasAutoSelectedUnreadRef.current = false;
  }, [isOpen]);

  // À l'ouverture du volet : si des messages sont en attente et aucune conversation n'est sélectionnée, ouvrir la première avec des non lus
  useEffect(() => {
    if (selectedUserId !== null || hasAutoSelectedUnreadRef.current) return;
    const ids = Object.keys(unreadCountByUser).map(Number);
    if (ids.length === 0) return;
    hasAutoSelectedUnreadRef.current = true;
    const firstUnread = ids.reduce((a, b) =>
      (unreadCountByUser[a] ?? 0) >= (unreadCountByUser[b] ?? 0) ? a : b
    );
    setSelectedUserId(firstUnread);
  }, [selectedUserId, unreadCountByUser]);

  useEffect(() => {
    if (selectedUserId) markConversationAsRead(selectedUserId);
  }, [selectedUserId, markConversationAsRead, messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleDraftChange = useCallback(
    (value: string) => {
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
      const attachment = pendingFiles[0]; // un seul fichier pour simplifier
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

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files?.[0];
      if (f) addFile(f);
    },
    [addFile]
  );
  const onDragOver = (e: React.DragEvent) => e.preventDefault();

  const selectedUsername = others.find((u) => u.userId === selectedUserId)?.username ?? null;
  const typingUsername = selectedUserId && typingFrom[selectedUserId] ? typingFrom[selectedUserId] : null;

  return (
    <div className="flex flex-col h-full bg-zinc-950 min-h-0">
      <div className="flex flex-1 min-h-0">
        {/* Liste des connectés */}
        <div className="w-52 min-w-[11rem] border-r border-zinc-800 flex flex-col overflow-hidden">
          <div className="p-2 text-zinc-500 text-base uppercase tracking-wider font-bold">Connectés</div>
          <div className="flex-1 overflow-y-auto">
            {!connected && (
              <div className="p-2 text-zinc-500 text-lg">Connexion…</div>
            )}
            {connected && others.length === 0 && (
              <div className="p-2 text-zinc-500 text-lg">Aucun contact.</div>
            )}
            {others.map((u) => (
              <button
                key={u.userId}
                type="button"
                onClick={() => setSelectedUserId(u.userId)}
                className={cn(
                  'w-full text-left px-3 py-2 text-lg rounded-r transition-colors flex items-center justify-between gap-1',
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
            <div className="flex-1 flex items-center justify-center text-zinc-500 text-lg p-4">
              Sélectionnez un utilisateur pour discuter.
            </div>
          ) : (
            <>
              <div className="p-2 border-b border-zinc-800 text-zinc-400 text-lg font-bold">
                Conversation avec {selectedUsername}
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
                          'max-w-[85%] rounded-lg px-3 py-2 text-base',
                          isMe
                            ? 'bg-blue-900/60 text-blue-100 border border-blue-700/50'
                            : 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                        )}
                      >
                        {!isMe && (
                          <div className="text-xl text-zinc-500 mb-0.5">
                            {msg.from === selectedUserId ? selectedUsername : 'Autre'}
                          </div>
                        )}
                        <div className="whitespace-pre-wrap break-words text-xl">{msg.text}</div>
                        {msg.attachment && (
                          <div className="mt-2 flex flex-col gap-1">
                            <span className="text-xl text-zinc-400">📎 {msg.attachment.name}</span>
                            <DownloadAttachmentButton attachment={msg.attachment} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Typing indicator (trois points) */}
                {typingUsername && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-800 rounded-lg px-3 py-2 border border-zinc-700 flex items-center gap-1">
                      <span className="flex gap-1">
                        <span className="w-3 h-3 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-3 h-3 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-3 h-3 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                      <span className="text-xl text-zinc-500 ml-1">{typingUsername} écrit…</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Pièces jointes en attente */}
              {pendingFiles.length > 0 && (
                <div className="px-3 py-1 flex items-center gap-2 text-base text-zinc-400">
                  📎 {pendingFiles.map((f) => f.name).join(', ')}
                  <button
                    type="button"
                    onClick={() => setPendingFiles([])}
                    className="text-red-400 hover:underline"
                  >
                    Retirer
                  </button>
                </div>
              )}

              {/* Zone saisie + boutons */}
              <div className="relative p-2 border-t border-zinc-800 space-y-2">
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
                    placeholder="Message…"
                    rows={2}
                    className="flex-1 min-w-0 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-lg text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-casino-gold/50"
                  />
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-10 h-10 rounded-lg border-2 border-zinc-600 text-zinc-400 hover:border-casino-gold hover:text-casino-gold flex items-center justify-center text-2xl"
                      title="Ajouter un fichier"
                    >
                      +
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={onFileInputChange}
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmoji((s) => !s)}
                      className="w-10 h-10 rounded-lg border-2 border-zinc-600 text-zinc-400 hover:border-casino-gold hover:text-casino-gold flex items-center justify-center text-2xl"
                      title="Emojis"
                    >
                      😀
                    </button>
                  </div>
                </div>

                {showEmoji && (
                  <div className="absolute bottom-full right-2 mb-1 z-10">
                    <EmojiPicker onEmojiClick={handleEmojiClick} theme={Theme.DARK} width={320} height={360} />
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSend}
                    className="px-4 py-2 rounded-lg bg-green-700 text-white font-bold text-lg hover:bg-green-600 transition-colors"
                  >
                    Envoyer
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-4 py-2 rounded-lg bg-zinc-700 text-zinc-200 text-lg hover:bg-zinc-600 transition-colors"
                  >
                    Effacer
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
