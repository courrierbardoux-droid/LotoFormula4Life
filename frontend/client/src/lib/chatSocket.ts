/**
 * Connexion WebSocket chat : token, présence, messages, typing.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export type ConnectedUser = { userId: number; username: string };

export type ChatMessage = {
  from: number;
  to: number;
  text: string;
  at: number;
  attachment?: { name: string; mime: string; dataBase64: string };
};

type ChatSocketState = {
  connected: boolean;
  connectedUsers: ConnectedUser[];
  messagesByUser: Record<number, ChatMessage[]>;
  typingFrom: Record<number, string>;
  /** Pour chaque userId (contact), timestamp max des messages considérés comme lus (conversation ouverte). */
  readUpToByUser: Record<number, number>;
};

const getWsUrl = (token: string): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws-chat?token=${encodeURIComponent(token)}`;
};

export function useChatSocket(currentUserId: number | null) {
  const [state, setState] = useState<ChatSocketState>({
    connected: false,
    connectedUsers: [],
    messagesByUser: {},
    typingFrom: {},
    readUpToByUser: {},
  });
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!currentUserId) return;
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (_) {}
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    fetch('/api/chat-ws-token', { method: 'POST', credentials: 'include' })
      .then((r) => {
        if (!r.ok) {
          const err = new Error('Token failed') as Error & { status?: number };
          err.status = r.status;
          throw err;
        }
        return r.json();
      })
      .then(({ token }: { token: string }) => {
        const url = getWsUrl(token);
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          setState((s) => ({ ...s, connected: true }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data as string);
            if (data.type === 'connected_list') {
              const list = data.list ?? [];
              setState((s) => ({ ...s, connectedUsers: list }));
            } else if (data.type === 'new_message' || data.type === 'message_sent') {
              const msg = data.message as ChatMessage;
              const other = msg.from === currentUserId ? msg.to : msg.from;
              setState((s) => {
                const list = [...(s.messagesByUser[other] ?? []), msg];
                return { ...s, messagesByUser: { ...s.messagesByUser, [other]: list } };
              });
            } else if (data.type === 'typing') {
              setState((s) => ({
                ...s,
                typingFrom: { ...s.typingFrom, [data.userId]: data.username ?? '' },
              }));
            } else if (data.type === 'typing_off') {
              setState((s) => {
                const next = { ...s.typingFrom };
                delete next[data.userId];
                return { ...s, typingFrom: next };
              });
            } else if (data.type === 'history') {
              setState((s) => ({
                ...s,
                messagesByUser: { ...s.messagesByUser, [data.withUserId]: data.messages ?? [] },
              }));
            }
          } catch {
            // ignore
          }
        };

        ws.onclose = () => {
          setState((s) => ({ ...s, connected: false, connectedUsers: [], typingFrom: {}, readUpToByUser: s.readUpToByUser }));
          wsRef.current = null;
          if (mountedRef.current) {
            reconnectTimeoutRef.current = setTimeout(connect, 3000);
          }
        };

        ws.onerror = () => {};
      })
      .catch((err: Error & { status?: number }) => {
        if (err?.status === 401 || err?.status === 403) return;
        if (mountedRef.current) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      });
  }, [currentUserId]);

  useEffect(() => {
    mountedRef.current = true;
    if (currentUserId) connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [currentUserId, connect]);

  const sendMessage = useCallback(
    (toUserId: number, text: string, attachment?: { name: string; mime: string; dataBase64: string }) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(
        JSON.stringify({
          type: 'message',
          to: toUserId,
          text,
          ...(attachment && { attachment }),
        })
      );
    },
    []
  );

  const sendTypingOn = useCallback((toUserId: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'typing_on', to: toUserId }));
  }, []);

  const sendTypingOff = useCallback((toUserId: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'typing_off', to: toUserId }));
  }, []);

  const requestHistory = useCallback((withUserId: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'get_history', withUserId }));
  }, []);

  /** Marquer la conversation avec cet utilisateur comme lue (à appeler quand le volet est ouvert et cette conversation sélectionnée). */
  const markConversationAsRead = useCallback((otherUserId: number) => {
    setState((s) => {
      const list = s.messagesByUser[otherUserId] ?? [];
      const received = list.filter((m) => m.to === currentUserId);
      const maxAt = received.length ? Math.max(...received.map((m) => m.at)) : 0;
      const prev = s.readUpToByUser[otherUserId] ?? 0;
      if (maxAt <= prev) return s;
      return { ...s, readUpToByUser: { ...s.readUpToByUser, [otherUserId]: Math.max(prev, maxAt) } };
    });
  }, [currentUserId]);

  /** Nombre de messages non lus par contact (reçus par moi, pas encore lus). */
  const unreadCountByUser = (() => {
    const out: Record<number, number> = {};
    if (!currentUserId) return out;
    for (const [userId, list] of Object.entries(state.messagesByUser)) {
      const uid = Number(userId);
      if (uid === currentUserId) continue;
      const readUpTo = state.readUpToByUser[uid] ?? 0;
      const unread = list.filter((m) => m.to === currentUserId && m.from === uid && m.at > readUpTo).length;
      if (unread > 0) out[uid] = unread;
    }
    return out;
  })();

  const totalUnread = Object.values(unreadCountByUser).reduce((a, b) => a + b, 0);

  /** Nombre d'utilisateurs connectés *autres que moi* (pour le badge à côté de l'icône chat). */
  const othersConnectedCount = currentUserId
    ? state.connectedUsers.filter((u) => u.userId !== currentUserId).length
    : 0;

  return {
    ...state,
    sendMessage,
    sendTypingOn,
    sendTypingOff,
    requestHistory,
    markConversationAsRead,
    unreadCountByUser,
    totalUnread,
    othersConnectedCount,
  };
}
