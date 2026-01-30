import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import dotenv from 'dotenv';

// Charger .env depuis le dossier frontend (où se trouve .env), quel que soit le répertoire de lancement
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPathFrontend = path.join(__dirname, '..', '.env');
const envPathFrontendTxt = path.join(__dirname, '..', '.env.txt');
const envPathCwd = path.join(process.cwd(), '.env');
if (existsSync(envPathFrontend)) {
  dotenv.config({ path: envPathFrontend });
} else if (existsSync(envPathFrontendTxt)) {
  dotenv.config({ path: envPathFrontendTxt });
} else if (existsSync(envPathCwd)) {
  dotenv.config({ path: envPathCwd });
} else {
  dotenv.config();
}

import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { registerRoutes } from './routes';
import fs from 'node:fs/promises';
import { startHistoryAutoUpdater } from './historyAutoUpdater';

const app = express();

// Vérifier si la base de données est configurée
const hasDatabase = !!process.env.DATABASE_URL;

// ============================================
// MIDDLEWARE DE BASE
// ============================================

// Trust proxy pour Render.com (nécessaire pour les cookies sécurisés)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Parser JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================
// SESSIONS (PostgreSQL ou Mémoire)
// ============================================

async function setupSession() {
  if (hasDatabase) {
    // Mode production avec PostgreSQL
    const ConnectPgSimple = (await import('connect-pg-simple')).default;
    const { pool } = await import('../db');
    const PgSession = ConnectPgSimple(session);
    
    app.use(session({
      store: new PgSession({
        pool,
        tableName: 'session',
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || 'dev-secret-change-in-prod-minimum-32-chars',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
        sameSite: 'lax',
      },
    }));
    
    // Setup Passport avec authentification DB
    app.use(passport.initialize());
    app.use(passport.session());
    const { setupAuth } = await import('./auth');
    setupAuth();
    
    console.log('[Server] Sessions PostgreSQL activées');
  } else {
    // Mode développement sans base de données - sessions en mémoire
    const MemoryStore = (await import('memorystore')).default(session);
    
    app.use(session({
      store: new MemoryStore({
        checkPeriod: 86400000 // Nettoyer toutes les 24h
      }),
      secret: 'dev-secret-for-local-testing',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }));
    
    // Passport sans authentification DB (mode mock)
    app.use(passport.initialize());
    app.use(passport.session());
    
    // Sérialisation simple pour mode mock
    passport.serializeUser((user: any, done) => done(null, user));
    passport.deserializeUser((user: any, done) => done(null, user));
    
    console.log('[Server] Sessions mémoire activées (mode dev sans DB)');
  }
}

// ============================================
// DÉMARRAGE ASYNCHRONE
// ============================================

async function startServer() {
  await setupSession();
  
  // Routes API
  registerRoutes(app, hasDatabase);

  // AUTO updater (FDJ) — tourne en tâche de fond si mode AUTO
  const HISTORY_MODE_FILE = path.join(process.cwd(), 'server', 'data', 'history-update-mode.json');
  const HISTORY_SCHEDULE_FILE = path.join(process.cwd(), 'server', 'data', 'history-auto-update-schedule.json');
  const getMode = async () => {
    try {
      const raw = await fs.readFile(HISTORY_MODE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return parsed?.mode === 'manual' ? 'manual' : 'auto';
    } catch {
      return 'auto';
    }
  };
  const getScheduleTime = async () => {
    try {
      const raw = await fs.readFile(HISTORY_SCHEDULE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      const s = String(parsed?.time ?? '').trim();
      return s || '22:00';
    } catch {
      return '22:00';
    }
  };
  startHistoryAutoUpdater({ hasDatabase, getMode, getScheduleTime } as any);
  
  // Servir le frontend en production
  if (process.env.NODE_ENV === 'production') {
    const staticPath = path.resolve('dist', 'public');
    
    app.use(express.static(staticPath));
    
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(staticPath, 'index.html'));
      }
    });
  }
  
  const PORT = process.env.PORT || 3000;
  
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║           🎰 LOTOFORMULA4LIFE SERVER 🎰                    ║
╠════════════════════════════════════════════════════════════╣
║  Mode:     ${process.env.NODE_ENV || 'development'}
║  Port:     ${PORT}
║  Database: ${hasDatabase ? '✅ PostgreSQL' : '⚠️ Mock (mémoire)'}
╚════════════════════════════════════════════════════════════╝
    `);
  });
}

startServer().catch((err) => {
  console.error('Erreur démarrage serveur:', err);
  process.exit(1);
});

export default app;
