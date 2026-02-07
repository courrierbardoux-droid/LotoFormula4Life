/**
 * WebSocket chat : présence, messages 1-à-1, typing, fichiers (base64).
 * Authentification par token one-time (obtenu via POST /api/chat-ws-token).
 * Messages persistés en base de données.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import { randomBytes } from 'crypto';
import { db } from '../db';
import { chatMessages, chatReads } from '../db/schema';
import { or, and, eq, asc, sql } from 'drizzle-orm';

const TOKEN_TTL_MS = 60_000;
const TYPING_EXPIRE_MS = 12_000;
const MAX_FILE_SIZE_B64 = 5 * 1024 * 1024; // 5 Mo en base64 (approx)

type UserInfo = { userId: number; username: string };
const pendingTokens = new Map<string, { user: UserInfo; expires: number }>();

export function registerChatToken(token: string, user: UserInfo): void {
  pendingTokens.set(token, { user, expires: Date.now() + TOKEN_TTL_MS });
}

function consumeToken(token: string): UserInfo | null {
  const entry = pendingTokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    pendingTokens.delete(token);
    return null;
  }
  pendingTokens.delete(token);
  return entry.user;
}

type ConnInfo = UserInfo & { ws: WebSocket; lastTypingAt: number };
const connections = new Map<WebSocket, ConnInfo>();

function connKey(a: number, b: number): string {
  return [Math.min(a, b), Math.max(a, b)].join(':');
}

type ChatMessage = {
  from: number;
  to: number;
  text: string;
  at: number;
  attachment?: { name: string; mime: string; dataBase64: string };
};

async function loadConversationFromDb(userId1: number, userId2: number): Promise<ChatMessage[]> {
  try {
    const rows = await db
      .select()
      .from(chatMessages)
      .where(
        or(
          and(eq(chatMessages.fromUserId, userId1), eq(chatMessages.toUserId, userId2)),
          and(eq(chatMessages.fromUserId, userId2), eq(chatMessages.toUserId, userId1))
        )
      )
      .orderBy(asc(chatMessages.createdAt));
    return rows.map((r) => ({
      from: r.fromUserId,
      to: r.toUserId,
      text: r.text,
      at: r.createdAt.getTime(),
      attachment: r.attachment ?? undefined,
    }));
  } catch {
    return [];
  }
}

async function persistMessage(msg: ChatMessage): Promise<void> {
  try {
    await db.insert(chatMessages).values({
      fromUserId: msg.from,
      toUserId: msg.to,
      text: msg.text,
      attachment: msg.attachment ?? null,
    });
  } catch (_) {
    // ignore DB errors (e.g. table not created)
  }
}

const typingByUser = new Map<number, { targetUserId: number; expires: number }>();

function broadcastConnectedList(): void {
  const raw = Array.from(connections.values()).map((c) => ({
    userId: c.userId,
    username: c.username,
  }));
  const seen = new Set<number>();
  const list = raw.filter((c) => {
    if (seen.has(c.userId)) return false;
    seen.add(c.userId);
    return true;
  });
  const payload = JSON.stringify({ type: 'connected_list', list });
  Array.from(connections.keys()).forEach((conn) => {
    if (conn.readyState === WebSocket.OPEN) conn.send(payload);
  });
}

function sendToUser(userId: number, payload: string): void {
  const conn = Array.from(connections.values()).find((c) => c.userId === userId && c.ws.readyState === WebSocket.OPEN);
  if (conn) conn.ws.send(payload);
}

async function sendUnreadCounts(ws: WebSocket, userId: number) {
  try {
    // Compter les messages reçus dont le timestamp > lastReadAt (ou epoch si null)
    const rows = await db
      .select({
        fromUserId: chatMessages.fromUserId,
        count: sql<number>`count(*)::int`,
      })
      .from(chatMessages)
      .leftJoin(chatReads, and(eq(chatReads.userId, userId), eq(chatReads.contactId, chatMessages.fromUserId)))
      .where(
        and(
          eq(chatMessages.toUserId, userId),
          sql`${chatMessages.createdAt} > COALESCE(${chatReads.lastReadAt}, '1970-01-01')`
        )
      )
      .groupBy(chatMessages.fromUserId);

    const counts: Record<number, number> = {};
    rows.forEach((r) => {
      counts[r.fromUserId] = r.count;
    });

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'unread_counts', counts }));
    }
  } catch (e) {
    console.error('Error sending unread counts:', e);
  }
}

export function attachChatWs(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '', `http://${req.headers.host}`);
    if (url.pathname !== '/ws-chat') {
      socket.destroy();
      return;
    }
    const token = url.searchParams.get('token');
    if (!token) {
      socket.destroy();
      return;
    }
    const user = consumeToken(token);
    if (!user) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, user);
    });
  });

  wss.on('connection', (ws: WebSocket, _req: unknown, user: UserInfo) => {
    const conn: ConnInfo = { ...user, ws, lastTypingAt: 0 };
    connections.set(ws, conn);
    broadcastConnectedList();
    sendUnreadCounts(ws, conn.userId);

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.type === 'message') {
          const { to, text, attachment } = data;
          if (typeof to !== 'number' || typeof text !== 'string') return;
          const from = conn.userId;
          const msg: ChatMessage = {
            from,
            to,
            text: text.slice(0, 10000),
            at: Date.now(),
          };
          if (attachment && typeof attachment === 'object' && attachment.name && attachment.mime && attachment.dataBase64) {
            if (attachment.dataBase64.length > MAX_FILE_SIZE_B64) return;
            msg.attachment = {
              name: String(attachment.name).slice(0, 255),
              mime: String(attachment.mime).slice(0, 128),
              dataBase64: attachment.dataBase64,
            };
          }
          persistMessage(msg);
          sendToUser(to, JSON.stringify({ type: 'new_message', message: msg }));
          ws.send(JSON.stringify({ type: 'message_sent', message: msg }));
          typingByUser.delete(conn.userId);
        } else if (data.type === 'typing_on') {
          const { to } = data;
          if (typeof to !== 'number') return;
          conn.lastTypingAt = Date.now();
          typingByUser.set(conn.userId, { targetUserId: to, expires: Date.now() + TYPING_EXPIRE_MS });
          sendToUser(to, JSON.stringify({ type: 'typing', userId: conn.userId, username: conn.username }));
        } else if (data.type === 'typing_off') {
          const { to } = data;
          if (typeof to !== 'number') return;
          typingByUser.delete(conn.userId);
          sendToUser(to, JSON.stringify({ type: 'typing_off', userId: conn.userId }));
        } else if (data.type === 'get_history') {
          const { withUserId } = data;
          if (typeof withUserId !== 'number') return;
          loadConversationFromDb(conn.userId, withUserId).then((conv) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'history', withUserId, messages: conv }));
            }
          });
        } else if (data.type === 'mark_read') {
          const { withUserId } = data;
          if (typeof withUserId === 'number') {
            db.insert(chatReads)
              .values({
                userId: conn.userId,
                contactId: withUserId,
                lastReadAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [chatReads.userId, chatReads.contactId],
                set: { lastReadAt: new Date(), updatedAt: new Date() },
              })
              .then(() => sendUnreadCounts(ws, conn.userId)) // Renvoyer les comptes à jour
              .catch((e) => console.error('Error marking read:', e));
          }
        }
      } catch {
        // ignore invalid JSON
      }
    });

    ws.on('close', () => {
      connections.delete(ws);
      typingByUser.delete(conn.userId);
      broadcastConnectedList();
    });

    ws.on('error', () => {
      connections.delete(ws);
      typingByUser.delete(conn.userId);
      broadcastConnectedList();
    });
  });

  setInterval(() => {
    const now = Date.now();
    for (const [userId, entry] of Array.from(typingByUser.entries())) {
      if (now > entry.expires) {
        typingByUser.delete(userId);
        sendToUser(entry.targetUserId, JSON.stringify({ type: 'typing_off', userId }));
      }
    }
  }, 3000);
}
