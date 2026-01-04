import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function createTables() {
  console.log('🔧 Création des nouvelles tables...');
  
  try {
    // Créer la table invitation_codes
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS invitation_codes (
        id SERIAL PRIMARY KEY,
        code VARCHAR(6) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL,
        type VARCHAR(10) NOT NULL,
        used_at TIMESTAMP,
        used_by INTEGER REFERENCES users(id),
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Table invitation_codes créée');

    // Créer la table login_history
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS login_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        login_at TIMESTAMP DEFAULT NOW(),
        ip_address VARCHAR(45),
        user_agent VARCHAR(500)
      )
    `);
    console.log('✅ Table login_history créée');

    console.log('🎉 Toutes les tables ont été créées !');
  } catch (error) {
    console.error('❌ Erreur:', error);
  }

  process.exit(0);
}

createTables();



