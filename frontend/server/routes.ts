import { Express, Request, Response, NextFunction } from 'express';
import passport from 'passport';

// ============================================
// MIDDLEWARES D'AUTHENTIFICATION
// ============================================

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
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
  { id: 1, username: 'AntoAbso', email: 'admin@loto.com', password: 'AntoAbso', role: 'admin', createdAt: new Date('2024-01-01') },
  { id: 2, username: 'JeanDupont', email: 'jean@test.com', password: 'abonne', role: 'abonne', createdAt: new Date('2025-01-15') },
  { id: 3, username: 'MarieCurie', email: 'marie@science.com', password: 'vip', role: 'vip', createdAt: new Date('2025-02-20') },
  { id: 4, username: 'Guest123', email: 'guest@temp.com', password: 'guest', role: 'invite', createdAt: new Date('2025-03-10') },
];

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
      const { tirages } = req.body;
      
      if (!Array.isArray(tirages)) {
        return res.status(400).json({ error: 'Format invalide: tirages doit être un tableau' });
      }
      
      let inserted = 0;
      let skipped = 0;
      
      for (const tirage of tirages) {
        try {
          await db.insert(draws).values({
            date: tirage.date,
            numbers: tirage.numeros,
            stars: tirage.etoiles,
          }).onConflictDoNothing();
          inserted++;
        } catch (e) {
          skipped++;
        }
      }
      
      res.json({ success: true, inserted, skipped });
    } catch (err) {
      console.error('[API] Erreur post history:', err);
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

  // Vérifier les grilles gagnantes de TOUS les utilisateurs après une mise à jour
  app.post('/api/history/check-winners', requireAdmin, async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.status(400).json({ error: 'Base de données requise' });
      }

      const { lastDrawDate, lastDrawNumbers, lastDrawStars } = req.body;
      
      if (!lastDrawDate || !lastDrawNumbers || !lastDrawStars) {
        return res.status(400).json({ error: 'Données du tirage manquantes' });
      }

      const { db } = await import('../db');
      const { grids, users } = await import('../db/schema');
      const { eq, sql } = await import('drizzle-orm');
      const { sendWinnerNotificationToAdmin } = await import('./email');

      // Récupérer toutes les grilles qui visaient cette date de tirage
      const allGrids = await db.select({
        grid: grids,
        user: users,
      })
        .from(grids)
        .innerJoin(users, eq(grids.userId, users.id))
        .where(eq(grids.targetDate, lastDrawDate));

      const winners: any[] = [];
      
      // Gains EuroMillions (approximatifs)
      const GAINS: { [key: string]: number } = {
        '5+2': 200000000, '5+1': 500000, '5+0': 100000,
        '4+2': 5000, '4+1': 200, '4+0': 100,
        '3+2': 100, '3+1': 20, '3+0': 15,
        '2+2': 20, '2+1': 10, '2+0': 5,
        '1+2': 10, '0+2': 5,
      };

      for (const { grid, user } of allGrids) {
        const gridNumbers = grid.numbers as number[];
        const gridStars = grid.stars as number[];
        
        // Compter les correspondances
        const matchNum = gridNumbers.filter(n => lastDrawNumbers.includes(n)).length;
        const matchStar = gridStars.filter(s => lastDrawStars.includes(s)).length;
        
        const key = `${matchNum}+${matchStar}`;
        const gain = GAINS[key] || 0;
        
        if (gain > 0) {
          winners.push({
            userId: user.id,
            username: user.username,
            email: user.email,
            gridId: grid.id,
            numbers: gridNumbers,
            stars: gridStars,
            matchNum,
            matchStar,
            gain,
          });
          
          // Envoyer email à l'admin pour chaque gagnant
          await sendWinnerNotificationToAdmin({
            winnerUsername: user.username,
            winnerEmail: user.email,
            numbers: gridNumbers,
            stars: gridStars,
            matchNum,
            matchStar,
            gain,
            drawDate: lastDrawDate,
          });
        }
      }

      // Stocker les notifications pour l'admin (à afficher au login)
      if (winners.length > 0) {
        // On peut stocker dans une table notifications ou simplement en session
        // Pour l'instant, on retourne juste les gagnants
        console.log(`[API] ${winners.length} gagnant(s) détecté(s) pour le tirage du ${lastDrawDate}`);
      }

      res.json({ 
        success: true, 
        winnersCount: winners.length,
        winners: winners.map(w => ({
          username: w.username,
          matchNum: w.matchNum,
          matchStar: w.matchStar,
          gain: w.gain,
        }))
      });
    } catch (err) {
      console.error('[API] Erreur check winners:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ==========================================
  // ROUTES GRIDS & PRESETS - Simplifiées pour mode sans DB
  // ==========================================
  
  // Récupérer les grilles de l'utilisateur connecté
  app.get('/api/grids', requireAuth, async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.json([]);
      }

      const user = req.user as any;
      const { db } = await import('../db');
      const { grids } = await import('../db/schema');
      const { eq, desc } = await import('drizzle-orm');

      const userGrids = await db.select()
        .from(grids)
        .where(eq(grids.userId, user.id))
        .orderBy(desc(grids.playedAt));

      res.json(userGrids.map(g => ({
        id: g.id,
        odlId: g.odlId,
        numbers: g.numbers,
        stars: g.stars,
        playedAt: g.playedAt,
        targetDate: g.targetDate,
        name: g.name,
        createdAt: g.createdAt,
      })));
    } catch (err) {
      console.error('[API] Erreur get grids:', err);
      res.json([]);
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
      const { grids } = await import('../db/schema');
      const { eq, and } = await import('drizzle-orm');

      // Ne supprimer que si la grille appartient à l'utilisateur
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
      const sent = await sendInvitationEmail({ to: email, code, type: type as 'vip' | 'invite' });

      if (sent) {
        res.json({ success: true, message: `Invitation ${type} envoyée à ${email}` });
      } else {
        res.status(500).json({ error: 'Erreur envoi email' });
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
      const { username, email } = req.body;
      const { db } = await import('../db');
      const { users } = await import('../db/schema');
      const { eq, and, ne } = await import('drizzle-orm');

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

      // Appliquer les modifications
      if (Object.keys(updates).length > 1) {
        await db.update(users).set(updates).where(eq(users.id, parseInt(userId)));
        res.json({ success: true, message: 'Utilisateur mis à jour' });
      } else {
        res.json({ success: true, message: 'Aucune modification' });
      }
    } catch (err) {
      console.error('[API] Erreur update user:', err);
      res.status(500).json({ error: 'Erreur serveur' });
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

  // Page de confirmation (quand l'utilisateur clique sur le lien dans l'email)
  app.get('/api/draws/confirm/:token', async (req, res) => {
    try {
      if (!hasDatabase) {
        return res.status(400).json({ error: 'Base de données requise' });
      }

      const { token } = req.params;
      const { db } = await import('../db');
      const { pendingDraws, users } = await import('../db/schema');
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
        return res.status(404).json({ valid: false, error: 'Lien invalide ou expiré' });
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

      res.json({ 
        valid: true, 
        gridCount: allPending.length,
        userId: pending.userId 
      });
    } catch (err) {
      console.error('[API] Erreur confirm draw:', err);
      res.status(500).json({ error: 'Erreur serveur' });
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
        await db.insert(grids).values({
          userId: draw.userId,
          numbers: draw.numbers,
          stars: draw.stars,
          playedAt: now,
          targetDate: draw.targetDate,
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

  console.log('[API] Routes enregistrées');
}
