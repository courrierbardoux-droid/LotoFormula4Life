import { Express, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import fs from 'node:fs/promises';
import path from 'node:path';

// ============================================
// MIDDLEWARES D'AUTHENTIFICATION
// ============================================

function requireAuth(req: Request, res: Response, next: NextFunction) {
  console.log('[requireAuth] Vérification authentification, isAuthenticated():', req.isAuthenticated());
  console.log('[requireAuth] req.user:', req.user ? { id: (req.user as any).id, username: (req.user as any).username, role: (req.user as any).role } : 'null');
  
  if (req.isAuthenticated()) {
    console.log('[requireAuth] ✅ Authentification OK, passage au handler suivant');
    return next();
  }
  
  console.log('[requireAuth] ❌ Authentification échouée, envoi 401');
  res.status(401).json({ error: 'Non authentifié' });
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && (req.user as any).role === 'admin') {
    return next();
  }
  res.status(403).json({ error: 'Accès admin requis' });
}

// ============================================
// DONNÉES MOCK POUR MODE SANS DB
// ============================================

const mockUsers = [
  { id: 1, username: 'ADMINISTRATEUR', email: 'courrier.bardoux@gmail.com', password: '123456', role: 'admin', createdAt: new Date('2026-01-02') },
  { id: 2, username: 'TestINVITE', email: 'alerteprix@laposte.net', password: '123456', role: 'invite', createdAt: new Date('2026-01-02') },
  { id: 10, username: 'TestVIP', email: 'contact.absolu@gmail.com', password: '123456', role: 'vip', createdAt: new Date('2026-01-03') },
  { id: 11, username: 'TestABONNE', email: 'wbusiness@laposte.net', password: '123456', role: 'abonne', createdAt: new Date('2026-01-04') },
  { id: 12, username: 'cls', email: 'courrier.login.s@gmail.com', password: '123456', role: 'vip', createdAt: new Date('2026-01-24') },
  { id: 13, username: 'clp', email: 'courrier.login.p@gmail.com', password: '123456', role: 'invite', createdAt: new Date('2026-01-24') },
];

// ============================================
// JOURNAL ADMIN (SSE) - Mémoire process
// ============================================

type ActivityPayload = {
  gridId?: number | null;
  numbers?: number[];
  stars?: number[];
  targetDate?: string | null;
  channel?: 'email' | 'direct';
  [k: string]: unknown;
};

type ActivityEventDTO = {
  id?: number;
  type: string;
  createdAt: string | number;
  userId: number;
  username: string;
  payload: ActivityPayload;
};

const activitySseClients = new Set<Response>();

function sseWrite(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcastActivityEvent(event: ActivityEventDTO) {
  for (const client of Array.from(activitySseClients)) {
    try {
      sseWrite(client, 'activity', event);
    } catch (e) {
      activitySseClients.delete(client);
    }
  }
}

// ============================================
// ENREGISTREMENT DES ROUTES
// ============================================

export function registerRoutes(app: Express, hasDatabase: boolean = true) {
  
  // ==========================================
  // ROUTES AUTH
  // ==========================================
  
  // Inscription
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, email, password, inviteCode } = req.body;
      
      if (!username || !email || !password) {
        return res.status(400).json({ error: 'Tous les champs sont requis' });
      }
      
      // CODE OBLIGATOIRE - Pas d'inscription sans code valide
      if (!inviteCode || inviteCode.trim() === '') {
        return res.status(400).json({ 
          error: 'Code d\'invitation requis', 
          field: 'inviteCode',
          message: 'Un code d\'invitation valide est obligatoire pour créer un compte'
        });
      }
      
      if (!hasDatabase) {
        return res.status(400).json({ 
          error: 'Service indisponible', 
          message: 'Impossible de valider le code sans base de données'
        });
      }
      
      const { db } = await import('../db');
      const { invitationCodes } = await import('../db/schema');
      const { eq, isNull, gt, and } = await import('drizzle-orm');
      
      // Vérifier le code
      const [invitation] = await db.select()
        .from(invitationCodes)
        .where(
          and(
            eq(invitationCodes.code, inviteCode),
            isNull(invitationCodes.usedAt),
            gt(invitationCodes.expiresAt, new Date())
          )
        );
      
      if (!invitation) {
        // CODE INVALIDE → BLOQUER L'INSCRIPTION
        return res.status(400).json({ 
          error: 'Code invalide ou expiré', 
          field: 'inviteCode',
          message: 'Le code d\'invitation est incorrect, déjà utilisé ou expiré'
        });
      }
      
      const role = invitation.type; // 'vip' ou 'invite'
      const validatedCode = inviteCode;
      
      // Créer le compte avec le code validé
      const { users } = await import('../db/schema');
      const { hashPassword } = await import('./auth');
      
      const hashedPassword = await hashPassword(password);
      
      const [newUser] = await db.insert(users).values({
        username,
        email,
        password: hashedPassword,
        role,
      }).returning();
      
      // Marquer le code comme utilisé
      await db.update(invitationCodes)
        .set({ usedAt: new Date(), usedBy: newUser.id })
        .where(eq(invitationCodes.code, validatedCode));
      
      res.json({ 
        success: true, 
        user: { 
          id: newUser.id, 
          username: newUser.username, 
          email: newUser.email, 
          role: newUser.role,
          joinDate: newUser.createdAt?.toISOString().split('T')[0]
        } 
      });
    } catch (err: any) {
      console.error('[API] Erreur register:', err);
      if (err.code === '23505') {
        res.status(400).json({ error: 'Utilisateur ou email déjà existant' });
      } else {
        res.status(500).json({ error: 'Erreur serveur' });
      }
    }
  });

  // Connexion
  app.post('/api/auth/login', async (req, res, next) => {
    if (hasDatabase) {
      // Mode DB - utiliser Passport
      passport.authenticate('local', async (err: any, user: any, info: any) => {
        if (err) return next(err);
        if (!user) return res.status(401).json({ error: info?.message || 'Échec connexion' });
        
        req.logIn(user, async (err) => {
          if (err) return next(err);
          
          // Enregistrer la connexion dans l'historique
          try {
            const { db } = await import('../db');
            const { loginHistory } = await import('../db/schema');
            const ipAddress = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
            const userAgent = req.headers['user-agent'] || 'unknown';
            
            await db.insert(loginHistory).values({
              userId: user.id,
              ipAddress: typeof ipAddress === 'string' ? ipAddress.substring(0, 45) : 'unknown',
              userAgent: userAgent.substring(0, 500),
            });
          } catch (historyErr) {
            console.error('[API] Erreur enregistrement connexion:', historyErr);
            // Ne pas bloquer le login si l'historique échoue
          }
          
          res.json({ 
            success: true, 
            user: { 
              id: user.id, 
              username: user.username, 
              email: user.email, 
              role: user.role,
              joinDate: user.createdAt?.toISOString().split('T')[0]
            } 
          });
        });
      })(req, res, next);
    } else {
      // Mode mock - vérification simple
      const { username, password } = req.body;
      const user = mockUsers.find(u => u.username === username && u.password === password);
      
      if (user) {
        const sessionUser = { id: user.id, username: user.username, email: user.email, role: user.role, createdAt: user.createdAt };
        req.logIn(sessionUser, (err) => {
          if (err) return res.status(500).json({ error: 'Erreur session' });
          res.json({ 
            success: true, 
            user: { 
              id: user.id, 
              username: user.username, 
              email: user.email, 
              role: user.role,
              joinDate: user.createdAt?.toISOString().split('T')[0]
            }
          });
        });
      } else {
        res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
      }
    }
  });

  // Déconnexion
  app.post('/api/auth/logout', async (req, res) => {
    const user = req.user as any;
    
    // Enregistrer l'heure de déconnexion dans l'historique
    if (hasDatabase && user?.id) {
      try {
        const { db } = await import('../db');
        const { loginHistory } = await import('../db/schema');
        const { eq, isNull, desc } = await import('drizzle-orm');
        
        // Trouver la dernière connexion sans déconnexion pour cet utilisateur
        const [lastLogin] = await db.select()
          .from(loginHistory)
          .where(eq(loginHistory.userId, user.id))
          .orderBy(desc(loginHistory.loginAt))
          .limit(1);
        
        if (lastLogin && !lastLogin.logoutAt) {
          await db.update(loginHistory)
            .set({ logoutAt: new Date() })
            .where(eq(loginHistory.id, lastLogin.id));
        }
      } catch (err) {
        console.error('[API] Erreur enregistrement déconnexion:', err);
        // Ne pas bloquer le logout
      }
    }
    
    req.logout((err) => {
      if (err) return res.status(500).json({ error: 'Erreur déconnexion' });
      res.json({ success: true });
    });
  });

  // Utilisateur courant
  app.get('/api/auth/me', (req, res) => {
    if (req.isAuthenticated()) {
      const user = req.user as any;
      res.json({ 
        user: { 
          id: user.id, 
          username: user.username, 
          email: user.email, 
          role: user.role,
          joinDate: user.createdAt?.toISOString().split('T')[0]
        } 
      });
    } else {
      res.json({ user: null });
    }
  });

  // Modifier son propre profil
  app.patch('/api/profile/update', requireAuth, async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.status(400).json({ error: 'Base de données requise' });
      }

      const user = req.user as any;
      const { username, email, currentPassword, newPassword } = req.body;
      const { db } = await import('../db');
      const { users } = await import('../db/schema');
      const { eq, and, ne } = await import('drizzle-orm');
      const bcrypt = await import('bcrypt');

      // Récupérer l'utilisateur actuel
      const [currentUser] = await db.select().from(users).where(eq(users.id, user.id));
      if (!currentUser) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      const updates: any = { updatedAt: new Date() };

      // Modification du username
      if (username && username !== currentUser.username) {
        const [existing] = await db.select().from(users)
          .where(and(eq(users.username, username), ne(users.id, user.id)));
        if (existing) {
          return res.status(400).json({ error: 'Cet identifiant est déjà utilisé' });
        }
        updates.username = username;
      }

      // Modification de l'email
      if (email && email !== currentUser.email) {
        const [existing] = await db.select().from(users)
          .where(and(eq(users.email, email), ne(users.id, user.id)));
        if (existing) {
          return res.status(400).json({ error: 'Cet email est déjà utilisé' });
        }
        updates.email = email;
      }

      // Modification du mot de passe
      if (currentPassword && newPassword) {
        const isValid = await bcrypt.compare(currentPassword, currentUser.password);
        if (!isValid) {
          return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
        }
        updates.password = await bcrypt.hash(newPassword, 10);
      }

      // Appliquer les modifications
      if (Object.keys(updates).length > 1) {
        await db.update(users).set(updates).where(eq(users.id, user.id));
        
        // Récupérer l'utilisateur mis à jour
        const [updatedUser] = await db.select().from(users).where(eq(users.id, user.id));
        
        // Mettre à jour la session Passport avec les nouvelles données
        req.login(updatedUser, (err) => {
          if (err) {
            console.error('[API] Erreur mise à jour session:', err);
            return res.status(500).json({ error: 'Erreur mise à jour session' });
          }
          
          // Retourner les nouvelles données
          res.json({ 
            success: true, 
            user: {
              id: updatedUser.id,
              username: updatedUser.username,
              email: updatedUser.email,
              role: updatedUser.role,
              joinDate: updatedUser.createdAt?.toISOString().split('T')[0]
            }
          });
        });
      } else {
        res.json({ success: true, message: 'Aucune modification' });
      }
    } catch (err) {
      console.error('[API] Erreur update profil:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ==========================================
  // ROUTES USERS (Admin)
  // ==========================================
  
  app.get('/api/users', requireAdmin, async (req, res) => {
    try {
      if (hasDatabase) {
        const { db } = await import('../db');
        const { users } = await import('../db/schema');
        
        const allUsers = await db.select({
          id: users.id,
          username: users.username,
          email: users.email,
          role: users.role,
          createdAt: users.createdAt,
        }).from(users);
        
        res.json(allUsers.map(u => ({
          ...u,
          joinDate: u.createdAt?.toISOString().split('T')[0]
        })));
      } else {
        res.json(mockUsers.map(u => ({
          id: u.id,
          username: u.username,
          email: u.email,
          role: u.role,
          joinDate: u.createdAt?.toISOString().split('T')[0]
        })));
      }
    } catch (err) {
      console.error('[API] Erreur get users:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  app.patch('/api/users/:id', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      
      if (hasDatabase) {
        const { db } = await import('../db');
        const { users } = await import('../db/schema');
        const { eq } = await import('drizzle-orm');
        
        await db.update(users)
          .set({ role, updatedAt: new Date() })
          .where(eq(users.id, parseInt(id)));
      } else {
        const user = mockUsers.find(u => u.id === parseInt(id));
        if (user) user.role = role;
      }
      
      res.json({ success: true });
    } catch (err) {
      console.error('[API] Erreur update user:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  app.delete('/api/users/:id', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = parseInt(id);
      
      if (hasDatabase) {
        const { db } = await import('../db');
        const { users, invitationCodes } = await import('../db/schema');
        const { eq } = await import('drizzle-orm');
        
        // D'abord, supprimer les références dans invitation_codes
        await db.update(invitationCodes)
          .set({ usedBy: null })
          .where(eq(invitationCodes.usedBy, userId));
        
        // Ensuite, supprimer l'utilisateur
        const result = await db.delete(users).where(eq(users.id, userId)).returning();
        
        if (result.length === 0) {
          return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
        }
        
        console.log(`[API] Utilisateur ${userId} supprimé`);
      } else {
        const idx = mockUsers.findIndex(u => u.id === userId);
        if (idx > -1) mockUsers.splice(idx, 1);
      }
      
      res.json({ success: true });
    } catch (err) {
      console.error('[API] Erreur delete user:', err);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ==========================================
  // ROUTES ADMIN ACTIVITY (Journal)
  // ==========================================

  const logActivity = async (event: Omit<ActivityEventDTO, 'id'>) => {
    if (!hasDatabase) return;
    try {
      const { db } = await import('../db');
      const { activityEvents } = await import('../db/schema');

      const createdAt = new Date(event.createdAt);
      const [row] = await db
        .insert(activityEvents)
        .values({
          type: event.type,
          createdAt,
          userId: event.userId,
          usernameSnapshot: event.username,
          payload: event.payload,
        })
        .returning();

      const dto: ActivityEventDTO = {
        ...event,
        id: (row as any)?.id,
        createdAt: ((row as any)?.createdAt ?? createdAt).toISOString(),
      };

      broadcastActivityEvent(dto);
    } catch (e) {
      console.error('[API] Erreur log activity:', e);
      // Ne pas bloquer la feature principale (tirage/grille) si le journal échoue
    }
  };

  app.get('/api/admin/activity', requireAdmin, async (req, res) => {
    try {
      if (!hasDatabase) return res.json([]);

      const limitRaw = Number(req.query.limit ?? 200);
      const limit = Math.min(200, Math.max(1, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 200));

      const { db } = await import('../db');
      const { activityEvents } = await import('../db/schema');
      const { desc } = await import('drizzle-orm');

      const rows = await db.select().from(activityEvents).orderBy(desc(activityEvents.createdAt), desc(activityEvents.id)).limit(limit);

      res.json(
        rows.map((r: any) => ({
          id: r.id,
          type: r.type,
          createdAt: r.createdAt,
          userId: r.userId,
          username: r.usernameSnapshot,
          payload: r.payload,
        }))
      );
    } catch (e: any) {
      // Si la table n'existe pas encore (migration non faite), on renvoie juste un tableau vide
      const msg = String(e?.message || e);
      if (e?.code === '42P01' || msg.includes('activity_events') && msg.includes('does not exist')) {
        return res.json([]);
      }
      console.error('[API] Erreur get admin activity:', e);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  app.get('/api/admin/activity/stream', requireAdmin, (req, res) => {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Ligne de commentaire pour “ouvrir” le flux côté navigateur
    res.write(':ok\n\n');

    activitySseClients.add(res);

    const ping = setInterval(() => {
      try {
        sseWrite(res, 'ping', {});
      } catch (e) {
        clearInterval(ping);
        activitySseClients.delete(res);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(ping);
      activitySseClients.delete(res);
    });
  });

  // ==========================================
  // ADMIN - Grilles de tous les utilisateurs avec résultats (sauf admin)
  // ==========================================
  app.get('/api/admin/grids/with-results', requireAdmin, async (req, res) => {
    try {
      if (!hasDatabase) return res.json([]);
      const admin = req.user as any;
      const { db } = await import('../db');
      const { grids, winningGrids, draws, users } = await import('../db/schema');
      const { ne, desc } = await import('drizzle-orm');

      // Récupérer toutes les grilles SAUF celles de l'admin
      const allGrids = await db
        .select({ grid: grids, user: users })
        .from(grids)
        .innerJoin(users, (await import('drizzle-orm')).eq(grids.userId, users.id))
        .where(ne(grids.userId, admin.id))
        .orderBy(desc(grids.playedAt));

      const [lastDrawRow] = await db.select().from(draws).orderBy(desc(draws.date)).limit(1);
      const lastDrawDateStr = lastDrawRow ? String(lastDrawRow.date).split('T')[0] : null;

      // Récupérer tous les gains (sauf admin)
      const allWins = await db.select().from(winningGrids).where(ne(winningGrids.userId, admin.id));
      const targetDatesMap: Record<string, true> = {};
      for (const w of allWins as any[]) {
        const d = String(w.targetDate).split('T')[0];
        targetDatesMap[d] = true;
      }
      const targetDates = Object.keys(targetDatesMap);
      const drawsMap = new Map<string, any>();
      if (targetDates.length > 0) {
        const { inArray } = await import('drizzle-orm');
        const drawsList = await db.select().from(draws).where(inArray(draws.date, targetDates));
        for (const d of drawsList) drawsMap.set(String(d.date).split('T')[0], d);
      }
      const winsByGrid = new Map<number, { w: any; draw: any }>();
      for (const w of allWins) {
        const dateStr = String(w.targetDate).split('T')[0];
        winsByGrid.set(w.gridId, { w, draw: drawsMap.get(dateStr) || null });
      }

      const result = allGrids.map(({ grid: g, user }: any) => {
        const targetStr = g.targetDate ? String(g.targetDate).split('T')[0] : null;
        const win = targetStr ? winsByGrid.get(g.id) : undefined;
        const baseData = {
          id: g.id,
          odlId: g.odlId,
          numbers: g.numbers,
          stars: g.stars,
          playedAt: g.playedAt,
          targetDate: g.targetDate,
          name: g.name,
          createdAt: g.createdAt,
          userId: user.id,
          username: user.username,
        };
        if (!targetStr) {
          return { ...baseData, status: 'En attente' as const, gainCents: null, matchNum: undefined, matchStar: undefined, winningGridId: undefined, drawNumbers: undefined, drawStars: undefined, adminSeenAt: undefined };
        }
        if (lastDrawDateStr && targetStr > lastDrawDateStr) {
          return { ...baseData, status: 'En attente' as const, gainCents: null, matchNum: undefined, matchStar: undefined, winningGridId: undefined, drawNumbers: undefined, drawStars: undefined, adminSeenAt: undefined };
        }
        if (win) {
          const nums = Array.isArray(win.draw?.numbers) ? win.draw.numbers : [];
          const stars = Array.isArray(win.draw?.stars) ? win.draw.stars : [];
          return { ...baseData, status: 'Gagné' as const, gainCents: win.w.gainCents, matchNum: win.w.matchNum, matchStar: win.w.matchStar, winningGridId: win.w.id, drawNumbers: nums, drawStars: stars, adminSeenAt: win.w.adminSeenAt };
        }
        return { ...baseData, status: 'Perdu' as const, gainCents: null, matchNum: undefined, matchStar: undefined, winningGridId: undefined, drawNumbers: undefined, drawStars: undefined, adminSeenAt: undefined };
      });
      res.json(result);
    } catch (err) {
      console.error('[API] Erreur admin/grids/with-results:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // Marquer des gains comme vus par l'admin
  app.post('/api/admin/wins/ack', requireAdmin, async (req, res) => {
    try {
      if (!hasDatabase) return res.json({ success: true });
      const ids = Array.isArray(req.body?.ids)
        ? req.body.ids.map((x: any) => parseInt(x)).filter((n: any) => Number.isFinite(n))
        : [];

      const { db } = await import('../db');
      const { winningGrids } = await import('../db/schema');
      const { inArray, isNull, and } = await import('drizzle-orm');

      if (ids.length > 0) {
        await db
          .update(winningGrids)
          .set({ adminSeenAt: new Date(), updatedAt: new Date() })
          .where(and(inArray(winningGrids.id, ids), isNull(winningGrids.adminSeenAt)) as any);
      }
      res.json({ success: true });
    } catch (err) {
      console.error('[API] Erreur admin/wins/ack:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // Vérifier s'il y a des gains non vus par l'admin (utilisateurs seulement, pas l'admin)
  app.get('/api/admin/wins/unseen', requireAdmin, async (req, res) => {
    try {
      if (!hasDatabase) return res.json({ hasUnseen: false, count: 0 });
      const admin = req.user as any;
      const { db } = await import('../db');
      const { winningGrids } = await import('../db/schema');
      const { ne, isNull, and } = await import('drizzle-orm');

      const rows = await db
        .select()
        .from(winningGrids)
        .where(and(ne(winningGrids.userId, admin.id), isNull(winningGrids.adminSeenAt)))
        .limit(1);

      res.json({ hasUnseen: rows.length > 0, count: rows.length });
    } catch (err) {
      console.error('[API] Erreur admin/wins/unseen:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // Grilles d'un utilisateur spécifique avec résultats (admin)
  app.get('/api/admin/user/:userId/grids/with-results', requireAdmin, async (req, res) => {
    try {
      if (!hasDatabase) return res.json([]);
      const targetUserId = parseInt(req.params.userId);
      if (!Number.isFinite(targetUserId)) return res.status(400).json({ error: 'userId invalide' });

      const { db } = await import('../db');
      const { grids, winningGrids, draws } = await import('../db/schema');
      const { eq, desc } = await import('drizzle-orm');

      const userGridsList = await db.select().from(grids).where(eq(grids.userId, targetUserId)).orderBy(desc(grids.playedAt));
      const [lastDrawRow] = await db.select().from(draws).orderBy(desc(draws.date)).limit(1);
      const lastDrawDateStr = lastDrawRow ? String(lastDrawRow.date).split('T')[0] : null;
      const userWins = await db.select().from(winningGrids).where(eq(winningGrids.userId, targetUserId));
      const targetDatesMap: Record<string, true> = {};
      for (const w of userWins as any[]) {
        const d = String(w.targetDate).split('T')[0];
        targetDatesMap[d] = true;
      }
      const targetDates = Object.keys(targetDatesMap);
      const drawsMap = new Map<string, any>();
      if (targetDates.length > 0) {
        const { inArray } = await import('drizzle-orm');
        const drawsList = await db.select().from(draws).where(inArray(draws.date, targetDates));
        for (const d of drawsList) drawsMap.set(String(d.date).split('T')[0], d);
      }
      const winsByGrid = new Map<number, { w: any; draw: any }>();
      for (const w of userWins) {
        const dateStr = String(w.targetDate).split('T')[0];
        winsByGrid.set(w.gridId, { w, draw: drawsMap.get(dateStr) || null });
      }

      const result = userGridsList.map((g: any) => {
        const targetStr = g.targetDate ? String(g.targetDate).split('T')[0] : null;
        const win = targetStr ? winsByGrid.get(g.id) : undefined;
        if (!targetStr || (lastDrawDateStr && targetStr > lastDrawDateStr)) {
          return { id: g.id, numbers: g.numbers, stars: g.stars, playedAt: g.playedAt, targetDate: g.targetDate, name: g.name, status: 'En attente', gainCents: null, matchNum: undefined, matchStar: undefined, winningGridId: undefined, drawNumbers: undefined, drawStars: undefined };
        }
        if (win) {
          const nums = Array.isArray(win.draw?.numbers) ? win.draw.numbers : [];
          const stars = Array.isArray(win.draw?.stars) ? win.draw.stars : [];
          return { id: g.id, numbers: g.numbers, stars: g.stars, playedAt: g.playedAt, targetDate: g.targetDate, name: g.name, status: 'Gagné', gainCents: win.w.gainCents, matchNum: win.w.matchNum, matchStar: win.w.matchStar, winningGridId: win.w.id, drawNumbers: nums, drawStars: stars };
        }
        return { id: g.id, numbers: g.numbers, stars: g.stars, playedAt: g.playedAt, targetDate: g.targetDate, name: g.name, status: 'Perdu', gainCents: null, matchNum: undefined, matchStar: undefined, winningGridId: undefined, drawNumbers: undefined, drawStars: undefined };
      });
      res.json(result);
    } catch (err) {
      console.error('[API] Erreur admin/user/:userId/grids/with-results:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // Rechercher un utilisateur par email (admin) - pour trouver les comptes "fantômes"
  app.get('/api/users/search', requireAdmin, async (req, res) => {
    try {
      const { email } = req.query;
      
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email requis' });
      }
      
      if (hasDatabase) {
        const { db } = await import('../db');
        const { users } = await import('../db/schema');
        const { eq } = await import('drizzle-orm');
        
        const [user] = await db.select({
          id: users.id,
          username: users.username,
          email: users.email,
          role: users.role,
          createdAt: users.createdAt,
        }).from(users).where(eq(users.email, email));
        
        if (user) {
          res.json({ found: true, user: { ...user, joinDate: user.createdAt?.toISOString().split('T')[0] } });
        } else {
          res.json({ found: false });
        }
      } else {
        const user = mockUsers.find(u => u.email === email);
        res.json({ found: !!user, user: user || null });
      }
    } catch (err) {
      console.error('[API] Erreur search user:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // Supprimer un utilisateur par email (admin) - pour nettoyer les comptes "fantômes"
  app.delete('/api/users/by-email/:email', requireAdmin, async (req, res) => {
    try {
      const { email } = req.params;
      
      if (hasDatabase) {
        const { db } = await import('../db');
        const { users } = await import('../db/schema');
        const { eq } = await import('drizzle-orm');
        
        const result = await db.delete(users).where(eq(users.email, decodeURIComponent(email))).returning();
        
        if (result.length > 0) {
          res.json({ success: true, message: `Compte ${email} supprimé` });
        } else {
          res.json({ success: false, message: 'Aucun compte trouvé avec cet email' });
        }
      } else {
        const idx = mockUsers.findIndex(u => u.email === email);
        if (idx > -1) {
          mockUsers.splice(idx, 1);
          res.json({ success: true, message: `Compte ${email} supprimé` });
        } else {
          res.json({ success: false, message: 'Aucun compte trouvé' });
        }
      }
    } catch (err) {
      console.error('[API] Erreur delete user by email:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ==========================================
  // ROUTES HISTORY (Tirages EuroMillions)
  // ==========================================
  
  app.get('/api/history', async (req, res) => {
    try {
      if (hasDatabase) {
        const { db } = await import('../db');
        const { draws } = await import('../db/schema');
        const { desc } = await import('drizzle-orm');
        
        const allDraws = await db.select().from(draws).orderBy(desc(draws.date));
        
        const tirages = allDraws.map(d => ({
          date: d.date,
          numeros: d.numbers as number[],
          etoiles: d.stars as number[]
        }));
        
        res.json(tirages);
      } else {
        // Mode mock - retourner tableau vide (le frontend utilisera le CSV)
        res.json([]);
      }
    } catch (err) {
      console.error('[API] Erreur get history:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // Supprimer un tirage (admin) — utile pour effacer des tirages de test
  app.delete('/api/history/:date', requireAdmin, async (req, res) => {
    try {
      if (!hasDatabase) return res.status(400).json({ success: false, error: 'Base de données requise' });
      const date = String(req.params.date || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ success: false, error: 'Date invalide (attendu YYYY-MM-DD)' });
      }

      const { db } = await import('../db');
      const { draws, drawPayouts, winningGrids, autoUpdateRuns } = await import('../db/schema');
      const { eq } = await import('drizzle-orm');

      const deletedDraw = await db.delete(draws).where(eq(draws.date, date)).returning();
      // Nettoyage soft des tables associées (si présentes)
      try { await db.delete(drawPayouts).where(eq(drawPayouts.drawDate, date)); } catch {}
      try { await db.delete(winningGrids).where(eq(winningGrids.targetDate, date)); } catch {}
      try { await db.delete(autoUpdateRuns).where(eq(autoUpdateRuns.drawDate, date)); } catch {}

      res.json({ success: true, deleted: deletedDraw.length });
    } catch (e: any) {
      res.status(500).json({ success: false, error: String(e?.message || e) });
    }
  });

  app.get('/api/history/latest', async (req, res) => {
    try {
      if (hasDatabase) {
        const { db } = await import('../db');
        const { draws } = await import('../db/schema');
        const { desc } = await import('drizzle-orm');
        
        const [lastDraw] = await db.select().from(draws).orderBy(desc(draws.date)).limit(1);
        
        if (lastDraw) {
          res.json({
            date: lastDraw.date,
            numeros: lastDraw.numbers as number[],
            etoiles: lastDraw.stars as number[]
          });
        } else {
          res.json(null);
        }
      } else {
        res.json(null);
      }
    } catch (err) {
      console.error('[API] Erreur get latest draw:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  app.post('/api/history', requireAdmin, async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.status(400).json({ error: 'Base de données requise pour cette opération' });
      }
      
      const { db } = await import('../db');
      const { draws } = await import('../db/schema');
      const { eq } = await import('drizzle-orm');
      const { tirages } = req.body;
      
      if (!Array.isArray(tirages)) {
        return res.status(400).json({ error: 'Format invalide: tirages doit être un tableau' });
      }
      
      let processed = 0;
      let failed = 0;
      
      for (const tirage of tirages) {
        try {
          await db.insert(draws).values({
            date: tirage.date,
            numbers: tirage.numeros,
            stars: tirage.etoiles,
          }).onConflictDoUpdate({
            target: draws.date,
            set: {
              numbers: tirage.numeros,
              stars: tirage.etoiles,
            },
          });
          processed++;
        } catch (e) {
          failed++;
        }
      }

      // Détection gagnants + emails immédiats sur la date la plus récente envoyée
      try {
        const dates = tirages.map((t: any) => String(t?.date ?? '').split('T')[0].split(' ')[0]).filter(Boolean);
        const latest = dates.sort().slice(-1)[0];
        if (latest) {
          const { computeAndPersistWinnersForDraw } = await import('./winnerService');
          await computeAndPersistWinnersForDraw({ drawDate: latest, hasDatabase, sendEmails: true });
        }
      } catch {
        // ignore
      }

      let probeAfter: any = null;
      try {
        const [row] = await db.select().from(draws).where(eq(draws.date, '2026-01-27')).limit(1);
        if (row) {
          probeAfter = { date: row.date, etoiles: (row.stars as any[] | null)?.slice?.(0, 10) ?? null, numeros: (row.numbers as any[] | null)?.slice?.(0, 10) ?? null };
        } else {
          probeAfter = null;
        }
      } catch {
        probeAfter = { error: 'probe query failed' };
      }
      
      res.json({ success: true, processed, failed });
    } catch (err) {
      console.error('[API] Erreur post history:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ==========================================
  // WINNERS (User) — message à la connexion/console
  // ==========================================
  app.get('/api/wins/me', requireAuth, async (req, res) => {
    try {
      if (!hasDatabase) return res.json({ success: true, rows: [] });
      const user = req.user as any;
      const unseenOnly = String(req.query.unseenOnly ?? 'true') === 'true';
      const limitRaw = Number(req.query.limit ?? 50);
      const limit = Math.min(200, Math.max(1, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 50));

      const { db } = await import('../db');
      const { winningGrids } = await import('../db/schema');
      const { eq, desc, isNull, and } = await import('drizzle-orm');

      let where: any = eq(winningGrids.userId, user.id);
      if (unseenOnly) where = and(where, isNull(winningGrids.seenAt));

      const rows: any[] = await db
        .select()
        .from(winningGrids)
        .where(where)
        .orderBy(desc(winningGrids.targetDate), desc(winningGrids.id))
        .limit(limit);

      res.json({
        success: true,
        rows: rows.map((r: any) => ({
          id: r.id,
          gridId: r.gridId,
          targetDate: r.targetDate,
          matchNum: r.matchNum,
          matchStar: r.matchStar,
          gainCents: r.gainCents,
          emailNotifiedAt: r.emailNotifiedAt,
          seenAt: r.seenAt,
        })),
      });
    } catch (e) {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  app.post('/api/wins/me/ack', requireAuth, async (req, res) => {
    try {
      if (!hasDatabase) return res.json({ success: true });
      const user = req.user as any;
      const ids = Array.isArray(req.body?.ids)
        ? req.body.ids.map((x: any) => parseInt(x)).filter((n: any) => Number.isFinite(n))
        : [];

      const { db } = await import('../db');
      const { winningGrids } = await import('../db/schema');
      const { eq, and, inArray, isNull } = await import('drizzle-orm');

      const baseWhere: any = and(eq(winningGrids.userId, user.id), isNull(winningGrids.seenAt));
      if (ids.length > 0) {
        await db
          .update(winningGrids)
          .set({ seenAt: new Date(), updatedAt: new Date() })
          .where(and(baseWhere, inArray(winningGrids.id, ids)) as any);
      } else {
        await db.update(winningGrids).set({ seenAt: new Date(), updatedAt: new Date() }).where(baseWhere);
      }

      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // Télécharger l'historique CSV depuis la DB avec filtre de dates
  app.get('/api/history/download', async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.status(400).json({ error: 'Base de données requise' });
      }

      const { from, to } = req.query;
      const { db } = await import('../db');
      const { draws } = await import('../db/schema');
      const { desc, gte, lte, and } = await import('drizzle-orm');

      let query = db.select().from(draws);
      
      // Filtrer par dates si spécifiées
      const conditions = [];
      if (from) {
        conditions.push(gte(draws.date, from as string));
      }
      if (to) {
        conditions.push(lte(draws.date, to as string));
      }
      
      let allDraws;
      if (conditions.length > 0) {
        allDraws = await query.where(and(...conditions)).orderBy(desc(draws.date));
      } else {
        allDraws = await query.orderBy(desc(draws.date));
      }

      // Générer le CSV
      const header = "Date;N1;N2;N3;N4;N5;E1;E2";
      const rows = allDraws.map(d => {
        const nums = d.numbers as number[];
        const stars = d.stars as number[];
        return `${d.date};${nums.join(';')};${stars.join(';')}`;
      });
      
      const csvContent = [header, ...rows].join('\n');
      
      // Nom du fichier
      let filename = 'historique_euromillions';
      if (from || to) {
        filename += `_${from || 'debut'}_${to || 'fin'}`;
      }
      filename += '.csv';
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send('\uFEFF' + csvContent); // BOM pour Excel
    } catch (err) {
      console.error('[API] Erreur download history:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ==========================================
  // HISTORIQUE - MODE MAJ (AUTO / MANUEL)
  // ==========================================
  // Stockage simple côté serveur (fichier), persistant au redémarrage.
  const HISTORY_MODE_FILE = path.join(process.cwd(), 'server', 'data', 'history-update-mode.json');
  type HistoryUpdateMode = 'auto' | 'manual';
  const HISTORY_SCHEDULE_FILE = path.join(process.cwd(), 'server', 'data', 'history-auto-update-schedule.json');
  type HistoryAutoUpdateSchedule = { time: string; updatedAt: number };

  async function readHistoryUpdateMode(): Promise<HistoryUpdateMode> {
    try {
      const raw = await fs.readFile(HISTORY_MODE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      const mode = parsed?.mode;
      return mode === 'manual' ? 'manual' : 'auto';
    } catch {
      return 'auto';
    }
  }

  async function writeHistoryUpdateMode(mode: HistoryUpdateMode) {
    const dir = path.dirname(HISTORY_MODE_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      HISTORY_MODE_FILE,
      JSON.stringify({ mode, updatedAt: Date.now() }, null, 2),
      'utf-8'
    );
  }

  async function getHistoryUpdateMode(): Promise<HistoryUpdateMode> {
    return await readHistoryUpdateMode();
  }

  function sanitizeTimeHHMM(raw: unknown): string | null {
    const s = String(raw ?? '').trim();
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    if (hh < 0 || hh > 23) return null;
    if (mm < 0 || mm > 59) return null;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  async function readHistoryAutoUpdateSchedule(): Promise<HistoryAutoUpdateSchedule> {
    try {
      const raw = await fs.readFile(HISTORY_SCHEDULE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      const t = sanitizeTimeHHMM(parsed?.time);
      return { time: t ?? '22:00', updatedAt: Number(parsed?.updatedAt ?? Date.now()) };
    } catch {
      return { time: '22:00', updatedAt: Date.now() };
    }
  }

  async function writeHistoryAutoUpdateSchedule(time: string) {
    const dir = path.dirname(HISTORY_SCHEDULE_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      HISTORY_SCHEDULE_FILE,
      JSON.stringify({ time, updatedAt: Date.now() }, null, 2),
      'utf-8'
    );
  }

  app.get('/api/history/update-mode', requireAdmin, async (req, res) => {
    const mode = await readHistoryUpdateMode();
    res.json({ success: true, mode });
  });

  app.post('/api/history/update-mode', requireAdmin, async (req, res) => {
    const modeRaw = String(req.body?.mode ?? '');
    const mode: HistoryUpdateMode = modeRaw === 'manual' ? 'manual' : 'auto';
    await writeHistoryUpdateMode(mode);
    res.json({ success: true, mode });
  });

  // Horaire AUTO (mardi & vendredi) — persisté côté serveur
  app.get('/api/history/auto-update/schedule', requireAdmin, async (req, res) => {
    const schedule = await readHistoryAutoUpdateSchedule();
    res.json({ success: true, time: schedule.time, updatedAt: schedule.updatedAt, retryMinutes: 90 });
  });

  app.post('/api/history/auto-update/schedule', requireAdmin, async (req, res) => {
    const t = sanitizeTimeHHMM(req.body?.time);
    if (!t) return res.status(400).json({ success: false, error: 'Heure invalide (attendu HH:MM)' });
    await writeHistoryAutoUpdateSchedule(t);
    res.json({ success: true, time: t });
  });

  // Déclencher un run AUTO (admin) — utilisé par le bouton "ACTUALISER" quand toggle = AUTO
  app.post('/api/history/auto-update/run', requireAdmin, async (req, res) => {
    try {
      if (!hasDatabase) return res.status(400).json({ error: 'Base de données requise' });
      const mode = await getHistoryUpdateMode();
      if (mode !== 'auto') return res.status(400).json({ error: 'Mode AUTO non actif' });

      const { runHistoryAutoUpdateOnce } = await import('./historyAutoUpdater');
      const result = await runHistoryAutoUpdateOnce({ hasDatabase });
      if (!result.ok) return res.status(500).json({ success: false, error: result.message, meta: result });
      res.json({ success: true, result });
    } catch (e: any) {
      res.status(500).json({ success: false, error: String(e?.message || e) });
    }
  });

  // Statut AUTO (dernier run) — affichage console/connexion
  app.get('/api/history/auto-update/status', requireAuth, async (req, res) => {
    try {
      if (!hasDatabase) return res.json({ success: true, status: null });
      const { db } = await import('../db');
      const { autoUpdateRuns } = await import('../db/schema');
      const { desc } = await import('drizzle-orm');
      const [last] = await db.select().from(autoUpdateRuns).orderBy(desc(autoUpdateRuns.id)).limit(1);
      res.json({
        success: true,
        status: last
          ? {
              id: last.id,
              success: Number(last.success) === 1,
              drawDate: last.drawDate,
              message: last.message,
              finishedAt: last.finishedAt,
              url: last.url,
            }
          : null,
      });
    } catch (e: any) {
      res.json({ success: true, status: null });
    }
  });

  // (Gagnants) : suppression totale (routes et logique retirées)

  // ==========================================
  // ROUTES GRIDS & PRESETS - Simplifiées pour mode sans DB
  // ==========================================
  
  // Récupérer les grilles de l'utilisateur connecté
  app.get('/api/grids', requireAuth, async (req, res) => {
    console.log('[API /api/grids] ÉTAPE 1: Handler appelé, user:', (req.user as any)?.username || 'null', 'role:', (req.user as any)?.role || 'null');
    try {
      if (!hasDatabase) {
        console.log('[API /api/grids] ÉTAPE 2: Pas de base de données, retour tableau vide');
        return res.json([]);
      }

      const user = req.user as any;
      console.log('[API /api/grids] ÉTAPE 3: Base de données disponible, récupération des grilles pour user.id:', user.id);
      
      const { db } = await import('../db');
      const { grids } = await import('../db/schema');
      const { eq, desc } = await import('drizzle-orm');

      const userGrids = await db.select()
        .from(grids)
        .where(eq(grids.userId, user.id))
        .orderBy(desc(grids.playedAt));

      console.log('[API /api/grids] ÉTAPE 4: Grilles récupérées depuis la DB, nombre:', userGrids.length);
      const formattedGrids = userGrids.map(g => ({
        id: g.id,
        odlId: g.odlId,
        numbers: g.numbers,
        stars: g.stars,
        playedAt: g.playedAt,
        targetDate: g.targetDate,
        name: g.name,
        createdAt: g.createdAt,
      }));

      console.log('[API /api/grids] ÉTAPE 5: Grilles formatées, envoi réponse avec', formattedGrids.length, 'grilles');
      res.json(formattedGrids);
    } catch (err) {
      console.error('[API /api/grids] ERREUR: Erreur get grids:', err);
      res.json([]);
    }
  });

  // Grilles avec résultats (status, rang, gainCents, drawNumbers/drawStars pour Gagné)
  app.get('/api/grids/with-results', requireAuth, async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.json([]);
      }
      const user = req.user as any;
      const { db } = await import('../db');
      const { grids, winningGrids, draws } = await import('../db/schema');
      const { eq, desc } = await import('drizzle-orm');

      const userGridsList = await db.select().from(grids).where(eq(grids.userId, user.id)).orderBy(desc(grids.playedAt));
      const [lastDrawRow] = await db.select().from(draws).orderBy(desc(draws.date)).limit(1);
      const lastDrawDateStr = lastDrawRow ? String(lastDrawRow.date).split('T')[0] : null;
      const userWins = await db.select().from(winningGrids).where(eq(winningGrids.userId, user.id));
      const targetDatesMap: Record<string, true> = {};
      for (const w of userWins as any[]) {
        const d = String(w.targetDate).split('T')[0];
        targetDatesMap[d] = true;
      }
      const targetDates = Object.keys(targetDatesMap);
      const drawsMap = new Map<string, any>();
      if (targetDates.length > 0) {
        const { inArray } = await import('drizzle-orm');
        const drawsList = await db.select().from(draws).where(inArray(draws.date, targetDates));
        for (const d of drawsList) drawsMap.set(String(d.date).split('T')[0], d);
      }
      const winsByGrid = new Map<number, { w: any; draw: any }>();
      for (const w of userWins) {
        const dateStr = String(w.targetDate).split('T')[0];
        winsByGrid.set(w.gridId, { w, draw: drawsMap.get(dateStr) || null });
      }

      const result = userGridsList.map((g: any) => {
        const targetStr = g.targetDate ? String(g.targetDate).split('T')[0] : null;
        const win = targetStr ? winsByGrid.get(g.id) : undefined;
        if (!targetStr) {
          return { id: g.id, odlId: g.odlId, numbers: g.numbers, stars: g.stars, playedAt: g.playedAt, targetDate: g.targetDate, name: g.name, createdAt: g.createdAt, status: 'En attente' as const, gainCents: null, matchNum: undefined, matchStar: undefined, winningGridId: undefined, drawNumbers: undefined, drawStars: undefined };
        }
        if (lastDrawDateStr && targetStr > lastDrawDateStr) {
          return { id: g.id, odlId: g.odlId, numbers: g.numbers, stars: g.stars, playedAt: g.playedAt, targetDate: g.targetDate, name: g.name, createdAt: g.createdAt, status: 'En attente' as const, gainCents: null, matchNum: undefined, matchStar: undefined, winningGridId: undefined, drawNumbers: undefined, drawStars: undefined };
        }
        if (win) {
          const nums = Array.isArray(win.draw?.numbers) ? win.draw.numbers : [];
          const stars = Array.isArray(win.draw?.stars) ? win.draw.stars : [];
          return { id: g.id, odlId: g.odlId, numbers: g.numbers, stars: g.stars, playedAt: g.playedAt, targetDate: g.targetDate, name: g.name, createdAt: g.createdAt, status: 'Gagné' as const, gainCents: win.w.gainCents, matchNum: win.w.matchNum, matchStar: win.w.matchStar, winningGridId: win.w.id, drawNumbers: nums, drawStars: stars };
        }
        return { id: g.id, odlId: g.odlId, numbers: g.numbers, stars: g.stars, playedAt: g.playedAt, targetDate: g.targetDate, name: g.name, createdAt: g.createdAt, status: 'Perdu' as const, gainCents: null, matchNum: undefined, matchStar: undefined, winningGridId: undefined, drawNumbers: undefined, drawStars: undefined };
      });
      res.json(result);
    } catch (err) {
      console.error('[API] Erreur grids/with-results:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // Sauvegarder une grille
  app.post('/api/grids', requireAuth, async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.json({ success: true, message: 'Mode sans DB' });
      }

      const user = req.user as any;
      const { numbers, stars, targetDate, name, odlId } = req.body;
      const { db } = await import('../db');
      const { grids } = await import('../db/schema');

      const [newGrid] = await db.insert(grids).values({
        userId: user.id,
        numbers,
        stars,
        playedAt: new Date(),
        targetDate: targetDate || null,
        name: name || null,
        odlId: odlId || null,
      }).returning();

      // Journal admin: grille créée (sans email)
      await logActivity({
        type: 'GRID_CREATED',
        createdAt: (newGrid as any)?.playedAt ?? new Date(),
        userId: user.id,
        username: user.username,
        payload: {
          gridId: (newGrid as any)?.id ?? null,
          numbers,
          stars,
          targetDate: targetDate || null,
          channel: 'direct',
        },
      });

      res.json({ success: true, grid: newGrid });
    } catch (err) {
      console.error('[API] Erreur save grid:', err);
      res.status(500).json({ error: 'Erreur sauvegarde grille' });
    }
  });

  // Supprimer une grille
  app.delete('/api/grids/:id', requireAuth, async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.json({ success: true });
      }

      const user = req.user as any;
      const gridId = parseInt(req.params.id);
      const { db } = await import('../db');
      const { grids, winningGrids } = await import('../db/schema');
      const { eq, and } = await import('drizzle-orm');

      // D'abord supprimer les entrées winning_grids liées (contrainte FK)
      await db.delete(winningGrids).where(eq(winningGrids.gridId, gridId));

      // Ensuite supprimer la grille (si elle appartient à l'utilisateur)
      await db.delete(grids)
        .where(and(eq(grids.id, gridId), eq(grids.userId, user.id)));

      res.json({ success: true });
    } catch (err) {
      console.error('[API] Erreur delete grid:', err);
      res.status(500).json({ error: 'Erreur suppression grille' });
    }
  });

  app.get('/api/presets', requireAuth, (req, res) => {
    // Les presets sont gérés côté client en localStorage pour l'instant
    res.json({});
  });

  app.put('/api/presets/:slot', requireAuth, (req, res) => {
    res.json({ success: true });
  });

  app.delete('/api/presets/:slot', requireAuth, (req, res) => {
    res.json({ success: true });
  });

  // ==========================================
  // ROUTES INVITATIONS
  // ==========================================

  // Générer et envoyer un code d'invitation
  app.post('/api/invitations/send', requireAdmin, async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.status(400).json({ error: 'Base de données requise' });
      }

      const { email, code, type } = req.body;
      
      if (!email || !code || !type) {
        return res.status(400).json({ error: 'Email, code et type requis' });
      }

      if (!['vip', 'invite'].includes(type)) {
        return res.status(400).json({ error: 'Type doit être "vip" ou "invite"' });
      }

      const { db } = await import('../db');
      const { invitationCodes } = await import('../db/schema');
      const { eq, and, isNull } = await import('drizzle-orm');
      
      // Supprimer l'ancien code non utilisé pour cet email (si renvoi avant 31 jours)
      await db.delete(invitationCodes)
        .where(
          and(
            eq(invitationCodes.email, email),
            isNull(invitationCodes.usedAt)
          )
        );
      
      // Calculer la date d'expiration (31 jours)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 31);

      // Enregistrer le nouveau code en base
      await db.insert(invitationCodes).values({
        code,
        email,
        type,
        expiresAt,
      });

      // Envoyer l'email
      const { sendInvitationEmail } = await import('./email');
      console.log(`[API] Tentative envoi invitation ${type} à ${email} avec code ${code}`);
      const sent = await sendInvitationEmail({ to: email, code, type: type as 'vip' | 'invite' });

      if (sent) {
        console.log(`[API] Invitation ${type} envoyée avec succès à ${email}`);
        res.json({ success: true, message: `Invitation ${type} envoyée à ${email}` });
      } else {
        console.error(`[API] Échec envoi invitation ${type} à ${email}`);
        res.status(500).json({ error: 'Erreur envoi email. Vérifiez les logs serveur et les variables d\'environnement GMAIL_USER et GMAIL_APP_PASSWORD.' });
      }
    } catch (err) {
      console.error('[API] Erreur envoi invitation:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // Valider un code d'invitation (utilisé lors de l'inscription)
  app.post('/api/invitations/validate', async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.json({ valid: false, role: 'invite' });
      }

      const { code } = req.body;
      
      if (!code) {
        return res.json({ valid: false, role: 'invite' });
      }

      const { db } = await import('../db');
      const { invitationCodes } = await import('../db/schema');
      const { eq, isNull, gt, and } = await import('drizzle-orm');

      // Chercher un code valide (non utilisé et non expiré)
      const [invitation] = await db.select()
        .from(invitationCodes)
        .where(
          and(
            eq(invitationCodes.code, code),
            isNull(invitationCodes.usedAt),
            gt(invitationCodes.expiresAt, new Date())
          )
        );

      if (invitation) {
        res.json({ valid: true, role: invitation.type, email: invitation.email });
      } else {
        res.json({ valid: false, role: 'invite' });
      }
    } catch (err) {
      console.error('[API] Erreur validation code:', err);
      res.json({ valid: false, role: 'invite' });
    }
  });

  // Marquer un code comme utilisé
  app.post('/api/invitations/use', async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.json({ success: true });
      }

      const { code, userId } = req.body;
      
      if (!code || !userId) {
        return res.status(400).json({ error: 'Code et userId requis' });
      }

      const { db } = await import('../db');
      const { invitationCodes } = await import('../db/schema');
      const { eq } = await import('drizzle-orm');

      await db.update(invitationCodes)
        .set({ usedAt: new Date(), usedBy: userId })
        .where(eq(invitationCodes.code, code));

      res.json({ success: true });
    } catch (err) {
      console.error('[API] Erreur use code:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ==========================================
  // ROUTES LOGIN HISTORY
  // ==========================================

  // Enregistrer une connexion
  app.post('/api/login-history', async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.json({ success: true });
      }

      const { userId } = req.body;
      const ipAddress = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      const { db } = await import('../db');
      const { loginHistory } = await import('../db/schema');

      await db.insert(loginHistory).values({
        userId,
        ipAddress: ipAddress.substring(0, 45),
        userAgent: userAgent.substring(0, 500),
      });

      res.json({ success: true });
    } catch (err) {
      console.error('[API] Erreur login history:', err);
      res.json({ success: true }); // Ne pas bloquer le login
    }
  });

  // Obtenir l'historique des connexions d'un utilisateur (admin)
  app.get('/api/login-history/:userId', requireAdmin, async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.json([]);
      }

      const userId = parseInt(req.params.userId);
      const { db } = await import('../db');
      const { loginHistory } = await import('../db/schema');
      const { eq, desc } = await import('drizzle-orm');

      const history = await db.select()
        .from(loginHistory)
        .where(eq(loginHistory.userId, userId))
        .orderBy(desc(loginHistory.loginAt))
        .limit(50);

      res.json(history);
    } catch (err) {
      console.error('[API] Erreur get login history:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ==========================================
  // ROUTES POPUP GRATITUDE
  // ==========================================

  // Incrémenter le compteur d'accès console et vérifier si popup doit s'afficher
  app.post('/api/popup/check', requireAuth, async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.json({ showPopup: false });
      }

      const user = req.user as any;
      
      // Admin n'a jamais de popup
      if (user.role === 'admin') {
        return res.json({ showPopup: false });
      }

      // Invite n'a pas de popup (tout est par email)
      if (user.role === 'invite') {
        return res.json({ showPopup: false });
      }

      const { db } = await import('../db');
      const { users } = await import('../db/schema');
      const { eq } = await import('drizzle-orm');

      // Récupérer les infos utilisateur
      const [userData] = await db.select().from(users).where(eq(users.id, user.id));
      if (!userData) {
        return res.json({ showPopup: false });
      }

      const popupStatus = userData.popupStatus || 'active';
      const accessCount = (userData.consoleAccessCount || 0) + 1;

      // Incrémenter le compteur
      await db.update(users)
        .set({ consoleAccessCount: accessCount })
        .where(eq(users.id, user.id));

      // Déterminer si on affiche le popup
      let showPopup = false;
      
      if (popupStatus === 'disabled') {
        // Gris = désactivé par admin → jamais
        showPopup = false;
      } else if (popupStatus === 'active') {
        // Vert = actif → toujours
        showPopup = true;
      } else if (popupStatus === 'reduced') {
        // Rouge = réduit → 1x / 10 accès (10, 20, 30...)
        showPopup = accessCount % 10 === 0;
      }

      res.json({ 
        showPopup, 
        popupStatus,
        accessCount 
      });
    } catch (err) {
      console.error('[API] Erreur popup check:', err);
      res.json({ showPopup: false });
    }
  });

  // Utilisateur coche "Ne plus afficher" → passer en mode réduit
  app.post('/api/popup/reduce', requireAuth, async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.json({ success: true });
      }

      const user = req.user as any;
      const { db } = await import('../db');
      const { users } = await import('../db/schema');
      const { eq } = await import('drizzle-orm');

      // Passer le statut à 'reduced' seulement si actuellement 'active'
      const [userData] = await db.select().from(users).where(eq(users.id, user.id));
      if (userData && userData.popupStatus === 'active') {
        await db.update(users)
          .set({ popupStatus: 'reduced' })
          .where(eq(users.id, user.id));
      }

      res.json({ success: true });
    } catch (err) {
      console.error('[API] Erreur popup reduce:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // Admin modifie le statut popup d'un utilisateur
  app.patch('/api/users/:id/popup', requireAdmin, async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.json({ success: true });
      }

      const { id } = req.params;
      const { popupStatus } = req.body; // 'active', 'reduced', 'disabled'

      if (!['active', 'reduced', 'disabled'].includes(popupStatus)) {
        return res.status(400).json({ error: 'Statut invalide' });
      }

      const { db } = await import('../db');
      const { users } = await import('../db/schema');
      const { eq } = await import('drizzle-orm');

      await db.update(users)
        .set({ popupStatus })
        .where(eq(users.id, parseInt(id)));

      res.json({ success: true });
    } catch (err) {
      console.error('[API] Erreur update popup status:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // Admin modifie l'email ou le login d'un utilisateur
  app.patch('/api/admin/user/:userId/update', requireAdmin, async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.status(400).json({ error: 'Base de données requise' });
      }

      const { userId } = req.params;
      const { username, email, password } = req.body;
      
      console.log('[API] Update user request:', { userId, hasUsername: !!username, hasEmail: !!email, hasPassword: !!password });
      
      const { db } = await import('../db');
      const { users } = await import('../db/schema');
      const { eq, and, ne } = await import('drizzle-orm');
      const bcrypt = await import('bcrypt');

      const updates: any = { updatedAt: new Date() };

      // Vérifier que l'utilisateur existe
      const [currentUser] = await db.select().from(users).where(eq(users.id, parseInt(userId)));
      if (!currentUser) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      // Modification du username
      if (username && username !== currentUser.username) {
        // Vérifier si le username est déjà pris
        const [existing] = await db.select().from(users)
          .where(and(eq(users.username, username), ne(users.id, parseInt(userId))));
        if (existing) {
          return res.status(400).json({ error: 'Cet identifiant est déjà utilisé', field: 'username' });
        }
        updates.username = username;
      }

      // Modification de l'email
      if (email && email !== currentUser.email) {
        // Vérifier si l'email est déjà pris
        const [existing] = await db.select().from(users)
          .where(and(eq(users.email, email), ne(users.id, parseInt(userId))));
        if (existing) {
          return res.status(400).json({ error: 'Cet email est déjà utilisé', field: 'email' });
        }
        updates.email = email;
      }

      // Modification du mot de passe (admin peut changer sans ancien mot de passe)
      if (password !== undefined && password !== null) {
        const passwordStr = String(password).trim();
        if (passwordStr.length === 0) {
          return res.status(400).json({ error: 'Le mot de passe ne peut pas être vide', field: 'password' });
        }
        if (passwordStr.length < 6) {
          return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères', field: 'password' });
        }
        updates.password = await bcrypt.hash(passwordStr, 10);
        console.log('[API] Password hash generated, updates keys:', Object.keys(updates));
      }

      // Appliquer les modifications
      const updateKeys = Object.keys(updates);
      console.log('[API] Updates to apply:', updateKeys, 'Count:', updateKeys.length);
      
      if (updateKeys.length > 1) {
        await db.update(users).set(updates).where(eq(users.id, parseInt(userId)));
        console.log('[API] User updated successfully');
        res.json({ success: true, message: 'Utilisateur mis à jour' });
      } else {
        console.log('[API] No updates to apply (only updatedAt)');
        res.status(400).json({ error: 'Aucune modification à appliquer', success: false });
      }
    } catch (err) {
      console.error('[API] Erreur update user:', err);
      res.status(500).json({ error: 'Erreur serveur', success: false });
    }
  });

  // ==========================================
  // ROUTES TIRAGES PAR EMAIL (INVITE/ABONNÉ)
  // ==========================================

  // Demander l'envoi des numéros (crée le token, envoie email 1 avec message légal)
  app.post('/api/draws/request', requireAuth, async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.status(400).json({ error: 'Base de données requise' });
      }

      const user = req.user as any;
      
      // Vérifier que l'utilisateur est invite ou abonné
      if (user.role === 'admin' || user.role === 'vip') {
        return res.status(400).json({ error: 'Cette fonctionnalité est réservée aux abonnés et invités' });
      }

      const { draws } = req.body; // Array de { nums: number[], stars: number[], targetDate?: string }
      
      if (!draws || !Array.isArray(draws) || draws.length === 0) {
        return res.status(400).json({ error: 'Aucune grille à envoyer' });
      }

      const { db } = await import('../db');
      const { pendingDraws, users } = await import('../db/schema');
      const { eq } = await import('drizzle-orm');
      const crypto = await import('crypto');

      // Récupérer l'email de l'utilisateur
      const [userData] = await db.select().from(users).where(eq(users.id, user.id));
      if (!userData) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      // Générer un token unique pour chaque grille
      const tokens: string[] = [];
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Expire dans 24h

      for (const draw of draws) {
        const token = crypto.randomBytes(32).toString('hex');
        
        await db.insert(pendingDraws).values({
          userId: user.id,
          token,
          numbers: draw.nums,
          stars: draw.stars,
          targetDate: draw.targetDate || null,
          expiresAt,
        });
        
        tokens.push(token);
      }

      // Envoyer l'email avec le message légal
      const { sendDrawConfirmationEmail } = await import('./email');
      const sent = await sendDrawConfirmationEmail({
        to: userData.email,
        username: userData.username,
        token: tokens[0], // Le premier token pour le lien
        gridCount: draws.length,
      });

      if (sent) {
        res.json({ success: true, message: 'Email envoyé', tokenCount: tokens.length });
      } else {
        res.status(500).json({ error: 'Erreur envoi email' });
      }
    } catch (err) {
      console.error('[API] Erreur request draw:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // Page de confirmation (quand l'utilisateur clique sur le lien dans l'email) - ENVOIE DIRECTEMENT L'EMAIL 2
  app.get('/api/draws/confirm/:token', async (req, res) => {
    console.log('[API] ========== GET /api/draws/confirm/:token APPELÉ ==========');
    console.log('[API] Token reçu:', req.params.token);
    console.log('[API] URL complète:', req.url);
    console.log('[API] Headers:', JSON.stringify(req.headers, null, 2));
    
    try {
      if (!hasDatabase) {
        console.log('[API] ERREUR: Base de données non disponible');
        return res.status(400).send('Base de données requise');
      }

      const { token } = req.params;
      const { db } = await import('../db');
      const { pendingDraws, users, grids } = await import('../db/schema');
      const { eq, isNull, gt, and } = await import('drizzle-orm');

      console.log('[API] Recherche du token dans pendingDraws...');
      // Vérifier le token
      const [pending] = await db.select()
        .from(pendingDraws)
        .where(
          and(
            eq(pendingDraws.token, token),
            isNull(pendingDraws.sentAt),
            gt(pendingDraws.expiresAt, new Date())
          )
        );

      console.log('[API] Résultat recherche token:', pending ? `TROUVÉ (userId: ${pending.userId})` : 'NON TROUVÉ');

      if (!pending) {
        console.log('[API] Token invalide ou expiré, retour 404');
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"><title>Lien invalide</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>Lien invalide ou expiré</h1>
            <p>Ce lien n'est plus valide. Veuillez demander un nouvel envoi.</p>
          </body>
          </html>
        `);
      }

      console.log('[API] Récupération de toutes les grilles en attente pour userId:', pending.userId);
      // Récupérer toutes les grilles en attente pour cet utilisateur
      const allPending = await db.select()
        .from(pendingDraws)
        .where(
          and(
            eq(pendingDraws.userId, pending.userId),
            isNull(pendingDraws.sentAt),
            gt(pendingDraws.expiresAt, new Date())
          )
        );

      console.log('[API] Nombre de grilles en attente trouvées:', allPending.length);
      
      // LOGS POUR ANALYSER targetDate
      console.log('[API] ===== ANALYSE targetDate =====');
      for (let i = 0; i < allPending.length; i++) {
        const draw = allPending[i];
        console.log(`[API] Grille ${i + 1} - targetDate brute:`, draw.targetDate);
        console.log(`[API] Grille ${i + 1} - targetDate type:`, typeof draw.targetDate);
        console.log(`[API] Grille ${i + 1} - targetDate null?:`, draw.targetDate === null);
        console.log(`[API] Grille ${i + 1} - targetDate undefined?:`, draw.targetDate === undefined);
        if (draw.targetDate) {
          try {
            const dateObj = new Date(draw.targetDate);
            console.log(`[API] Grille ${i + 1} - Date formatée:`, dateObj.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
          } catch (e) {
            console.log(`[API] Grille ${i + 1} - ERREUR formatage date:`, e);
          }
        }
      }
      console.log('[API] ===== FIN ANALYSE targetDate =====');

      // Récupérer l'utilisateur
      console.log('[API] Récupération de l\'utilisateur userId:', pending.userId);
      const [userData] = await db.select().from(users).where(eq(users.id, pending.userId));
      if (!userData) {
        console.log('[API] ERREUR: Utilisateur non trouvé');
        return res.status(404).send('Utilisateur non trouvé');
      }
      console.log('[API] Utilisateur trouvé:', userData.email, userData.username);

      // Sauvegarder les grilles dans l'historique
      console.log('[API] Sauvegarde des grilles dans l\'historique...');
      const now = new Date();
      for (const draw of allPending) {
        const [createdGrid] = await db.insert(grids).values({
          userId: draw.userId,
          numbers: draw.numbers,
          stars: draw.stars,
          playedAt: now,
          targetDate: draw.targetDate,
        }).returning();

        // Journal admin: grille créée (avec email)
        await logActivity({
          type: 'GRID_CREATED',
          createdAt: now.getTime(),
          userId: draw.userId,
          username: userData.username,
          payload: {
            gridId: (createdGrid as any)?.id ?? null,
            numbers: (draw.numbers as number[]) ?? [],
            stars: (draw.stars as number[]) ?? [],
            targetDate: draw.targetDate ?? null,
            channel: 'email',
          },
        });
        
        // Marquer comme envoyé
        await db.update(pendingDraws)
          .set({ sentAt: now })
          .where(eq(pendingDraws.id, draw.id));
      }
      console.log('[API] Grilles sauvegardées avec succès');

      // Envoyer l'email 2 (un seul email avec toutes les grilles)
      console.log('[API] Début de l\'envoi de l\'email (email2) avec toutes les grilles...');
      const { sendDrawNumbersEmailMulti } = await import('./email');
      
      const emailGrids = allPending.map(draw => ({
        numbers: draw.numbers as number[],
        stars: draw.stars as number[],
        targetDate: draw.targetDate || undefined,
      }));
      
      console.log('[API] Grilles préparées pour email:', emailGrids.map(g => ({ 
        numbers: g.numbers, 
        stars: g.stars, 
        targetDate: g.targetDate,
        targetDateType: typeof g.targetDate 
      })));
      
      console.log('[API] Envoi email2 avec', emailGrids.length, 'grille(s)');
      const emailSent = await sendDrawNumbersEmailMulti({
        to: userData.email,
        username: userData.username,
        grids: emailGrids,
      });
      console.log('[API] Résultat envoi email2:', emailSent ? 'SUCCÈS' : 'ÉCHEC');

      console.log('[API] Tous les emails envoyés, retour 204');
      // Retourner une réponse HTTP 204 (No Content) - pas de page de succès
      res.status(204).send();
    } catch (err) {
      console.error('[API] Erreur confirm draw:', err);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Erreur</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>Erreur serveur</h1>
          <p>Une erreur est survenue. Veuillez réessayer plus tard.</p>
        </body>
        </html>
      `);
    }
  });

  // Confirmer et envoyer les numéros (quand l'utilisateur clique sur "Recevoir mes numéros")
  app.post('/api/draws/confirm/:token', async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.status(400).json({ error: 'Base de données requise' });
      }

      const { token } = req.params;
      const { db } = await import('../db');
      const { pendingDraws, users, grids } = await import('../db/schema');
      const { eq, isNull, gt, and } = await import('drizzle-orm');

      // Vérifier le token
      const [pending] = await db.select()
        .from(pendingDraws)
        .where(
          and(
            eq(pendingDraws.token, token),
            isNull(pendingDraws.sentAt),
            gt(pendingDraws.expiresAt, new Date())
          )
        );

      if (!pending) {
        return res.status(404).json({ success: false, error: 'Lien invalide ou expiré' });
      }

      // Récupérer toutes les grilles en attente pour cet utilisateur
      const allPending = await db.select()
        .from(pendingDraws)
        .where(
          and(
            eq(pendingDraws.userId, pending.userId),
            isNull(pendingDraws.sentAt),
            gt(pendingDraws.expiresAt, new Date())
          )
        );

      // Récupérer l'utilisateur
      const [userData] = await db.select().from(users).where(eq(users.id, pending.userId));
      if (!userData) {
        return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
      }

      // Sauvegarder les grilles dans l'historique
      const now = new Date();
      for (const draw of allPending) {
        const [createdGrid] = await db.insert(grids).values({
          userId: draw.userId,
          numbers: draw.numbers,
          stars: draw.stars,
          playedAt: now,
          targetDate: draw.targetDate,
        }).returning();

        // Journal admin: grille créée (avec email)
        await logActivity({
          type: 'GRID_CREATED',
          createdAt: now.getTime(),
          userId: draw.userId,
          username: userData.username,
          payload: {
            gridId: (createdGrid as any)?.id ?? null,
            numbers: (draw.numbers as number[]) ?? [],
            stars: (draw.stars as number[]) ?? [],
            targetDate: draw.targetDate ?? null,
            channel: 'email',
          },
        });
        
        // Marquer comme envoyé
        await db.update(pendingDraws)
          .set({ sentAt: now })
          .where(eq(pendingDraws.id, draw.id));
      }

      // Envoyer un email pour chaque grille
      const { sendDrawNumbersEmail } = await import('./email');
      
      for (const draw of allPending) {
        await sendDrawNumbersEmail({
          to: userData.email,
          username: userData.username,
          numbers: draw.numbers as number[],
          stars: draw.stars as number[],
          targetDate: draw.targetDate || undefined,
        });
      }

      res.json({ 
        success: true, 
        message: `${allPending.length} grille(s) envoyée(s)`,
        gridCount: allPending.length 
      });
    } catch (err) {
      console.error('[API] Erreur send draw:', err);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // Envoyer l'email 2 directement après validation du popup gratitude (pour invités)
  app.post('/api/draws/send-direct', requireAuth, async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.status(400).json({ error: 'Base de données requise' });
      }

      const user = req.user as any;
      
      // Vérifier que l'utilisateur est invite
      if (user.role !== 'invite') {
        return res.status(400).json({ error: 'Cette fonctionnalité est réservée aux invités' });
      }

      const { draws } = req.body; // Array de { nums: number[], stars: number[], targetDate?: string }
      
      if (!draws || !Array.isArray(draws) || draws.length === 0) {
        return res.status(400).json({ error: 'Aucune grille à envoyer' });
      }

      const { db } = await import('../db');
      const { users, grids } = await import('../db/schema');
      const { eq } = await import('drizzle-orm');

      // Récupérer l'email de l'utilisateur
      const [userData] = await db.select().from(users).where(eq(users.id, user.id));
      if (!userData) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      // Sauvegarder les grilles dans l'historique
      const now = new Date();
      for (const draw of draws) {
        const [createdGrid] = await db.insert(grids).values({
          userId: user.id,
          numbers: draw.nums,
          stars: draw.stars,
          playedAt: now,
          targetDate: draw.targetDate || null,
        }).returning();

        // Journal admin: grille créée (avec email)
        await logActivity({
          type: 'GRID_CREATED',
          createdAt: now.getTime(),
          userId: user.id,
          username: userData.username,
          payload: {
            gridId: (createdGrid as any)?.id ?? null,
            numbers: (draw.nums as number[]) ?? [],
            stars: (draw.stars as number[]) ?? [],
            targetDate: (draw.targetDate as any) ?? null,
            channel: 'email',
          },
        });
      }

      // Envoyer l'email 2 (email avec les numéros) pour chaque grille
      const { sendDrawNumbersEmail } = await import('./email');
      
      for (const draw of draws) {
        await sendDrawNumbersEmail({
          to: userData.email,
          username: userData.username,
          numbers: draw.nums,
          stars: draw.stars,
          targetDate: draw.targetDate || undefined,
        });
      }

      res.json({ 
        success: true, 
        message: `${draws.length} grille(s) envoyée(s)`,
        gridCount: draws.length 
      });
    } catch (err) {
      console.error('[API] Erreur send direct:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ==========================================
  // ROUTES POPUP GRATITUDE
  // ==========================================

  // Incrémenter le compteur d'accès console
  app.post('/api/popup/increment-access', requireAuth, async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.json({ success: true });
      }

      const user = req.user as any;
      const { db } = await import('../db');
      const { users } = await import('../db/schema');
      const { eq, sql } = await import('drizzle-orm');

      await db.update(users)
        .set({ 
          consoleAccessCount: sql`COALESCE(console_access_count, 0) + 1`
        })
        .where(eq(users.id, user.id));

      res.json({ success: true });
    } catch (err) {
      console.error('[API] Erreur increment access:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ==========================================
  // ROUTES DETAILS UTILISATEUR (ADMIN)
  // ==========================================

  // Obtenir les détails complets d'un utilisateur
  app.get('/api/admin/user/:userId/details', requireAdmin, async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.status(400).json({ error: 'Base de données requise' });
      }

      const { userId } = req.params;
      const { db } = await import('../db');
      const { users, loginHistory, grids, draws } = await import('../db/schema');
      const { eq, desc } = await import('drizzle-orm');

      // Info utilisateur
      const [userData] = await db.select().from(users).where(eq(users.id, parseInt(userId)));
      if (!userData) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      // Historique des connexions
      const connections = await db.select()
        .from(loginHistory)
        .where(eq(loginHistory.userId, parseInt(userId)))
        .orderBy(desc(loginHistory.loginAt))
        .limit(50);

      // Grilles jouées
      const playedGrids = await db.select()
        .from(grids)
        .where(eq(grids.userId, parseInt(userId)))
        .orderBy(desc(grids.playedAt));

      // TODO: Calculer les grilles gagnées (à implémenter si nécessaire)
      const wonGrids: any[] = [];

      res.json({
        user: {
          id: userData.id,
          username: userData.username,
          email: userData.email,
          role: userData.role,
          createdAt: userData.createdAt,
          popupStatus: (userData as any).popupStatus || 'active',
          consoleAccessCount: (userData as any).consoleAccessCount || 0,
        },
        connections: connections.map(c => ({
          id: c.id,
          loginAt: c.loginAt,
          logoutAt: (c as any).logoutAt,
          ipAddress: c.ipAddress,
          userAgent: c.userAgent,
        })),
        playedGrids: playedGrids.map(g => ({
          id: g.id,
          numbers: g.numbers,
          stars: g.stars,
          playedAt: g.playedAt,
          targetDate: g.targetDate,
          name: g.name,
        })),
        wonGrids,
      });
    } catch (err) {
      console.error('[API] Erreur user details:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ==========================================
  // ROUTES GESTION TEMPLATES EMAIL/POPUP (ADMIN)
  // ==========================================

  // Récupérer tous les templates
  app.get('/api/admin/templates', requireAdmin, async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.json({ templates: [] });
      }

      const { db } = await import('../db');
      const { emailPopupTemplates } = await import('../db/schema');

      const allTemplates = await db.select().from(emailPopupTemplates);

      res.json({ templates: allTemplates });
    } catch (err) {
      console.error('[API] Erreur get templates:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // Sauvegarder un template (create or update)
  app.post('/api/admin/templates', requireAdmin, async (req, res) => {
    try {
      console.log('[API] Save template request:', { bodyKeys: Object.keys(req.body) });
      
      if (!hasDatabase) {
        console.log('[API] Save template: Pas de base de données');
        return res.status(400).json({ error: 'Base de données requise' });
      }

      const { type, content, variablesConfig } = req.body;
      const user = req.user as any;

      console.log('[API] Save template: Données reçues', { type, contentLength: content?.length || 0, userId: user?.id });

      if (!type || !content) {
        console.log('[API] Save template: Paramètres manquants');
        return res.status(400).json({ error: 'Type et contenu requis' });
      }

      const validTypes = ['email1', 'email2', 'popup1', 'popup2'];
      if (!validTypes.includes(type)) {
        console.log('[API] Save template: Type invalide', { type });
        return res.status(400).json({ error: 'Type invalide' });
      }

      console.log('[API] Save template: Import DB...');
      const { db } = await import('../db');
      const { emailPopupTemplates } = await import('../db/schema');
      const { eq } = await import('drizzle-orm');

      console.log('[API] Save template: Vérification template existant...');
      // Vérifier si le template existe déjà
      const [existing] = await db.select()
        .from(emailPopupTemplates)
        .where(eq(emailPopupTemplates.type, type));

      console.log('[API] Save template: Template existant?', { exists: !!existing, existingId: existing?.id });

      if (existing) {
        // Mise à jour
        console.log('[API] Save template: Mise à jour template...');
        await db.update(emailPopupTemplates)
          .set({
            content,
            variablesConfig: variablesConfig || {},
            updatedAt: new Date(),
            updatedBy: user.id
          })
          .where(eq(emailPopupTemplates.type, type));

        console.log('[API] Save template: Template mis à jour avec succès');
        res.json({ success: true, message: 'Template mis à jour' });
      } else {
        // Création
        console.log('[API] Save template: Création nouveau template...');
        await db.insert(emailPopupTemplates).values({
          type,
          content,
          variablesConfig: variablesConfig || {},
          updatedBy: user.id
        });

        console.log('[API] Save template: Template créé avec succès');
        res.json({ success: true, message: 'Template créé' });
      }
    } catch (err: any) {
      console.error('[API] Erreur save template:', err);
      console.error('[API] Erreur save template - Stack:', err?.stack);
      console.error('[API] Erreur save template - Message:', err?.message);
      res.status(500).json({ 
        error: 'Erreur serveur',
        details: err?.message || String(err)
      });
    }
  });

  // Récupérer les variables de template
  app.get('/api/admin/template-variables', requireAdmin, async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.json({ variables: [] });
      }

      const { db } = await import('../db');
      const { templateVariables } = await import('../db/schema');

      const allVariables = await db.select().from(templateVariables);

      res.json({ variables: allVariables });
    } catch (err) {
      console.error('[API] Erreur get variables:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // Sauvegarder une variable de template (create or update)
  app.post('/api/admin/template-variables', requireAdmin, async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.status(400).json({ error: 'Base de données requise' });
      }

      const { key, value, description } = req.body;

      if (!key || value === undefined) {
        return res.status(400).json({ error: 'Clé et valeur requises' });
      }

      const { db } = await import('../db');
      const { templateVariables } = await import('../db/schema');
      const { eq } = await import('drizzle-orm');

      // Vérifier si la variable existe déjà
      const [existing] = await db.select()
        .from(templateVariables)
        .where(eq(templateVariables.key, key));

      if (existing) {
        // Mise à jour
        await db.update(templateVariables)
          .set({
            value,
            description: description || existing.description,
            updatedAt: new Date()
          })
          .where(eq(templateVariables.key, key));

        res.json({ success: true, message: 'Variable mise à jour' });
      } else {
        // Création
        await db.insert(templateVariables).values({
          key,
          value,
          description: description || `Variable ${key}`
        });

        res.json({ success: true, message: 'Variable créée' });
      }
    } catch (err) {
      console.error('[API] Erreur save variable:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // Envoyer un email de test
  app.post('/api/admin/templates/test', requireAdmin, async (req, res) => {
    try {
      const { type, email, content } = req.body;

      console.log('[API] Test email request:', { type, email, contentLength: content?.length || 0 });

      if (!type || !email || !content) {
        console.log('[API] Test email: Paramètres manquants');
        return res.status(400).json({ error: 'Type, email et contenu requis' });
      }

      // Vérifier les variables d'environnement avant d'essayer d'envoyer
      if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        console.error('[API] Test email: Variables d\'environnement manquantes (GMAIL_USER ou GMAIL_APP_PASSWORD)');
        return res.status(500).json({ 
          error: 'Configuration email manquante. Vérifiez les variables d\'environnement GMAIL_USER et GMAIL_APP_PASSWORD.' 
        });
      }

      // Utiliser la fonction d'envoi d'email existante
      console.log('[API] Test email: Tentative d\'envoi à', email);
      const { sendTestEmail } = await import('./email');
      const success = await sendTestEmail({
        to: email,
        subject: `[TEST] Template ${type} - LotoFormula4Life`,
        html: content
      });

      console.log('[API] Test email: Résultat sendTestEmail =', success);

      if (success) {
        console.log('[API] Test email: Succès - email envoyé à', email);
        res.json({ success: true, message: 'Email de test envoyé' });
      } else {
        console.error('[API] Test email: Échec - sendTestEmail a retourné false');
        res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email. Vérifiez les logs du serveur.' });
      }
    } catch (err) {
      console.error('[API] Erreur test email (exception):', err);
      res.status(500).json({ error: 'Erreur serveur: ' + (err instanceof Error ? err.message : String(err)) });
    }
  });

  // Récupérer un template popup traité avec variables (pour affichage dans la console)
  app.get('/api/popup/template/:type', async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.status(500).json({ error: 'Base de données non disponible' });
      }

      const { type } = req.params;
      const user = req.user as any;

      if (type !== 'popup1' && type !== 'popup2') {
        return res.status(400).json({ error: 'Type invalide. Utilisez popup1 ou popup2' });
      }

      const { getProcessedTemplate } = await import('./templateService');
      
      // Préparer les variables pour le template
      const variables = {
        utilisateur: user?.username || 'Utilisateur',
        email: user?.email || '',
        date: new Date().toLocaleDateString('fr-FR'),
      };

      console.log(`[API] Récupération template ${type} pour utilisateur ${user?.username}`);
      const template = await getProcessedTemplate(type as 'popup1' | 'popup2', variables);

      if (!template) {
        console.warn(`[API] Template ${type} non trouvé en DB`);
        return res.status(404).json({ error: 'Template non trouvé' });
      }

      res.json({ template });
    } catch (err) {
      console.error(`[API] Erreur récupération template popup ${req.params.type}:`, err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  console.log('[API] Routes enregistrées');
}
