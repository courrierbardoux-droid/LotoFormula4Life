import { pgTable, serial, varchar, integer, json, timestamp, date, text, uniqueIndex } from 'drizzle-orm/pg-core';

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
// TABLE USER_CONSOLE_SETTINGS - Préférences console par utilisateur
// ============================================
export const userConsoleSettings = pgTable(
  'user_console_settings',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    // Fenêtres de calcul (Tableau 1 Settings)
    poolWindows: json('pool_windows').notNull(),
    // Presets numériques (strict/standard/souple/dynamic + trend R)
    poolWindowPresetNumbers: json('pool_window_preset_numbers').notNull(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => ({
    userUniq: uniqueIndex('user_console_settings_user_uniq').on(t.userId),
  })
);

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
// TABLE ACTIVITY_EVENTS - Journal d'activité (Admin)
// ============================================
export const activityEvents = pgTable('activity_events', {
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 50 }).notNull(), // ex: GRID_CREATED, PROFILE_UPDATED, WINNER_DETECTED
  createdAt: timestamp('created_at').defaultNow(),
  userId: integer('user_id').references(() => users.id).notNull(),
  usernameSnapshot: varchar('username_snapshot', { length: 50 }).notNull(),
  payload: json('payload').notNull().$type<{
    gridId?: number | null;
    numbers?: number[];
    stars?: number[];
    targetDate?: string | null;
    channel?: 'email' | 'direct';
    [k: string]: unknown;
  }>(),
});

// ============================================
// TABLE DRAW_PAYOUTS - Répartition des gains (FDJ) par tirage
// ============================================
export const drawPayouts = pgTable('draw_payouts', {
  id: serial('id').primaryKey(),
  drawDate: date('draw_date').notNull().unique(), // Date du tirage (YYYY-MM-DD)
  // Map: "matchNum+matchStar" -> gain en centimes (number) ou null si non déterminable (ex: jackpot "/")
  payouts: json('payouts').notNull().$type<Record<string, number | null>>(),
  source: varchar('source', { length: 20 }).notNull().default('fdj'),
  fetchedAt: timestamp('fetched_at').defaultNow(),
  expiresAt: timestamp('expires_at'), // Nettoyage après ~65 jours
});

// ============================================
// TABLE WINNING_GRIDS - Résultats gagnants par grille (persistés)
// ============================================
export const winningGrids = pgTable(
  'winning_grids',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    usernameSnapshot: varchar('username_snapshot', { length: 50 }).notNull(),
    gridId: integer('grid_id').references(() => grids.id).notNull(),
    targetDate: date('target_date').notNull(),
    matchNum: integer('match_num').notNull(),
    matchStar: integer('match_star').notNull(),
    // gain en centimes (null si jackpot / montant non déterminé)
    gainCents: integer('gain_cents'),
    emailNotifiedAt: timestamp('email_notified_at'),
    seenAt: timestamp('seen_at'),
    // Vu par l'admin (séparé de seenAt qui est pour l'utilisateur)
    adminSeenAt: timestamp('admin_seen_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => ({
    gridTargetUniq: uniqueIndex('winning_grids_grid_target_uniq').on(t.gridId, t.targetDate),
  })
);

// ============================================
// TABLE AUTO_UPDATE_RUNS - Historique des tentatives AUTO (alertes)
// ============================================
export const autoUpdateRuns = pgTable('auto_update_runs', {
  id: serial('id').primaryKey(),
  source: varchar('source', { length: 20 }).notNull().default('fdj'),
  startedAt: timestamp('started_at').defaultNow(),
  finishedAt: timestamp('finished_at'),
  success: integer('success').notNull().default(0), // 0/1 (compat simple)
  drawDate: date('draw_date'),
  message: text('message'),
  url: text('url'),
  expiresAt: timestamp('expires_at'), // Nettoyage après ~65 jours
});

// ============================================
// TABLE EMAIL_POPUP_TEMPLATES - Templates pour emails et popups
// ============================================
export const emailPopupTemplates = pgTable('email_popup_templates', {
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 20 }).notNull().unique(), // 'email1', 'email2', 'popup1', 'popup2'
  content: text('content').notNull(),                       // HTML content du template
  variablesConfig: json('variables_config').$type<Record<string, string>>(), // Configuration des variables
  updatedAt: timestamp('updated_at').defaultNow(),
  updatedBy: integer('updated_by').references(() => users.id), // Admin qui a mis à jour
});

// ============================================
// TABLE CHAT_MESSAGES - Messages du chat (persistance)
// ============================================
export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  fromUserId: integer('from_user_id').references(() => users.id).notNull(),
  toUserId: integer('to_user_id').references(() => users.id).notNull(),
  text: text('text').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  attachment: json('attachment').$type<{ name: string; mime: string; dataBase64: string } | null>(),
});

// ============================================
// TABLE CHAT_READS - État de lecture des conversations
// ============================================
export const chatReads = pgTable(
  'chat_reads',
  {
    userId: integer('user_id').references(() => users.id).notNull(),   // Qui lit
    contactId: integer('contact_id').references(() => users.id).notNull(), // Conversation avec qui
    lastReadAt: timestamp('last_read_at').defaultNow().notNull(),      // Jusqu'à quand
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => ({
    pk: uniqueIndex('chat_reads_pk').on(t.userId, t.contactId),
  })
);

// ============================================
// TABLE TEMPLATE_VARIABLES - Variables globales pour les templates
// ============================================
export const templateVariables = pgTable('template_variables', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 50 }).notNull().unique(),   // Ex: 'contactdéveloppeur'
  value: text('value').notNull(),                            // Valeur par défaut
  description: varchar('description', { length: 255 }),      // Description de la variable
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
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

export type UserConsoleSettings = typeof userConsoleSettings.$inferSelect;
export type NewUserConsoleSettings = typeof userConsoleSettings.$inferInsert;

export type InvitationCode = typeof invitationCodes.$inferSelect;
export type NewInvitationCode = typeof invitationCodes.$inferInsert;

export type LoginHistoryEntry = typeof loginHistory.$inferSelect;
export type NewLoginHistoryEntry = typeof loginHistory.$inferInsert;

export type PendingDraw = typeof pendingDraws.$inferSelect;
export type NewPendingDraw = typeof pendingDraws.$inferInsert;

export type ActivityEvent = typeof activityEvents.$inferSelect;
export type NewActivityEvent = typeof activityEvents.$inferInsert;

export type DrawPayout = typeof drawPayouts.$inferSelect;
export type NewDrawPayout = typeof drawPayouts.$inferInsert;

export type WinningGrid = typeof winningGrids.$inferSelect;
export type NewWinningGrid = typeof winningGrids.$inferInsert;

export type AutoUpdateRun = typeof autoUpdateRuns.$inferSelect;
export type NewAutoUpdateRun = typeof autoUpdateRuns.$inferInsert;

export type EmailPopupTemplate = typeof emailPopupTemplates.$inferSelect;
export type NewEmailPopupTemplate = typeof emailPopupTemplates.$inferInsert;

export type TemplateVariable = typeof templateVariables.$inferSelect;
export type NewTemplateVariable = typeof templateVariables.$inferInsert;

export type ChatMessageRow = typeof chatMessages.$inferSelect;
export type NewChatMessageRow = typeof chatMessages.$inferInsert;

export type ChatRead = typeof chatReads.$inferSelect;
export type NewChatRead = typeof chatReads.$inferInsert;