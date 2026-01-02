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
      const { username, email, password } = req.body;
      
      if (!username || !email || !password) {
        return res.status(400).json({ error: 'Tous les champs sont requis' });
      }
      
      if (hasDatabase) {
        const { db } = await import('../db');
        const { users } = await import('../db/schema');
        const { hashPassword } = await import('./auth');
        
        const hashedPassword = await hashPassword(password);
        
        const [newUser] = await db.insert(users).values({
          username,
          email,
          password: hashedPassword,
          role: 'abonne',
        }).returning();
        
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
      } else {
        // Mode mock
        const newUser = {
          id: mockUsers.length + 1,
          username,
          email,
          password,
          role: 'abonne' as const,
          createdAt: new Date()
        };
        mockUsers.push(newUser);
        res.json({ 
          success: true, 
          user: { id: newUser.id, username, email, role: 'abonne', joinDate: new Date().toISOString().split('T')[0] }
        });
      }
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
      passport.authenticate('local', (err: any, user: any, info: any) => {
        if (err) return next(err);
        if (!user) return res.status(401).json({ error: info?.message || 'Échec connexion' });
        
        req.logIn(user, (err) => {
          if (err) return next(err);
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
  app.post('/api/auth/logout', (req, res) => {
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
      
      if (hasDatabase) {
        const { db } = await import('../db');
        const { users } = await import('../db/schema');
        const { eq } = await import('drizzle-orm');
        
        await db.delete(users).where(eq(users.id, parseInt(id)));
      } else {
        const idx = mockUsers.findIndex(u => u.id === parseInt(id));
        if (idx > -1) mockUsers.splice(idx, 1);
      }
      
      res.json({ success: true });
    } catch (err) {
      console.error('[API] Erreur delete user:', err);
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

  // ==========================================
  // ROUTES GRIDS & PRESETS - Simplifiées pour mode sans DB
  // ==========================================
  
  app.get('/api/grids', requireAuth, (req, res) => {
    // Les grilles sont gérées côté client en localStorage pour l'instant
    res.json([]);
  });

  app.post('/api/grids', requireAuth, (req, res) => {
    res.json({ success: true, message: 'Grille sauvegardée localement' });
  });

  app.delete('/api/grids/:id', requireAuth, (req, res) => {
    res.json({ success: true });
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

  console.log('[API] Routes enregistrées');
}
