import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Pool de connexion PostgreSQL
// SSL requis pour Neon.tech
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false,
});

// Instance Drizzle ORM
export const db = drizzle(pool, { schema });

// Export du schéma pour utilisation directe
export * from './schema';

