import { pgTable, serial, varchar, integer, json, timestamp, date, text } from 'drizzle-orm/pg-core';

// ============================================
// TABLE USERS - Utilisateurs du système
// ============================================
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('invite'), // admin, vip, abonne, invite
  // Popup gratitude settings
  popupStatus: varchar('popup_status', { length: 20 }).notNull().default('active'), // active (vert), reduced (rouge), disabled (gris)
  consoleAccessCount: integer('console_access_count').notNull().default(0), // Compteur d'accès à la console
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// TABLE DRAWS - Historique des tirages EuroMillions
// ============================================
export const draws = pgTable('draws', {
  id: serial('id').primaryKey(),
  date: date('date').notNull().unique(),           // Date du tirage (YYYY-MM-DD)
  numbers: json('numbers').notNull().$type<number[]>(),  // [1, 5, 23, 34, 45]
  stars: json('stars').notNull().$type<number[]>(),      // [3, 9]
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// TABLE GRIDS - Grilles jouées par les utilisateurs
// ============================================
export const grids = pgTable('grids', {
  id: serial('id').primaryKey(),
  odlId: varchar('old_id', { length: 100 }),       // Ancien ID localStorage pour migration
  userId: integer('user_id').references(() => users.id).notNull(),
  numbers: json('numbers').notNull().$type<number[]>(),  // [1, 5, 23, 34, 45]
  stars: json('stars').notNull().$type<number[]>(),      // [3, 9]
  playedAt: timestamp('played_at').notNull(),      // Date de jeu
  targetDate: date('target_date'),                 // Date du tirage visé
  name: varchar('name', { length: 100 }),          // Nom optionnel
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// TABLE PRESETS - Configurations console (5 slots par user)
// ============================================
export const presets = pgTable('presets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  slot: integer('slot').notNull(),                 // 1 à 5
  name: varchar('name', { length: 50 }),
  config: json('config').notNull(),                // Configuration complète du preset
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// TABLE INVITATION_CODES - Codes d'invitation
// ============================================
export const invitationCodes = pgTable('invitation_codes', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 6 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull(),
  type: varchar('type', { length: 10 }).notNull(), // 'vip' ou 'invite'
  usedAt: timestamp('used_at'),                    // null si pas encore utilisé
  usedBy: integer('used_by').references(() => users.id), // ID de l'utilisateur qui a utilisé le code
  expiresAt: timestamp('expires_at').notNull(),    // Date d'expiration (31 jours)
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// TABLE LOGIN_HISTORY - Historique des connexions
// ============================================
export const loginHistory = pgTable('login_history', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  loginAt: timestamp('login_at').defaultNow(),
  logoutAt: timestamp('logout_at'),                    // Date/heure de déconnexion
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 500 }),
});

// ============================================
// TABLE PENDING_DRAWS - Tirages en attente d'envoi
// ============================================
export const pendingDraws = pgTable('pending_draws', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  token: varchar('token', { length: 64 }).notNull().unique(),
  numbers: json('numbers').notNull().$type<number[]>(),  // Les numéros générés
  stars: json('stars').notNull().$type<number[]>(),      // Les étoiles générées
  targetDate: date('target_date'),                        // Date du tirage visé
  acknowledged: timestamp('acknowledged'),                // Date où l'user a coché la case
  sentAt: timestamp('sent_at'),                          // Date d'envoi des numéros
  expiresAt: timestamp('expires_at').notNull(),          // Expiration du token (24h)
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// TYPES INFÉRÉS POUR TYPESCRIPT
// ============================================
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Draw = typeof draws.$inferSelect;
export type NewDraw = typeof draws.$inferInsert;

export type Grid = typeof grids.$inferSelect;
export type NewGrid = typeof grids.$inferInsert;

export type Preset = typeof presets.$inferSelect;
export type NewPreset = typeof presets.$inferInsert;

export type InvitationCode = typeof invitationCodes.$inferSelect;
export type NewInvitationCode = typeof invitationCodes.$inferInsert;

export type LoginHistoryEntry = typeof loginHistory.$inferSelect;
export type NewLoginHistoryEntry = typeof loginHistory.$inferInsert;

export type PendingDraw = typeof pendingDraws.$inferSelect;
export type NewPendingDraw = typeof pendingDraws.$inferInsert;

