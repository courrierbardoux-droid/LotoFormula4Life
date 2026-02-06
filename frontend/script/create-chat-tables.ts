import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function createChatTables() {
  console.log('🔧 Création de la table chat_messages...');
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        from_user_id INTEGER NOT NULL REFERENCES users(id),
        to_user_id INTEGER NOT NULL REFERENCES users(id),
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        attachment JSON
      )
    `);
    console.log('✅ Table chat_messages créée');
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
  process.exit(0);
}

createChatTables();
