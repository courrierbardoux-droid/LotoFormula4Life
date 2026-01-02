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

