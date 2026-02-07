import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function addFields() {
  const client = await pool.connect();
  try {
    // Ajouter les champs popup à la table users
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS popup_status VARCHAR(20) NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS console_access_count INTEGER NOT NULL DEFAULT 0
    `);
    console.log('✅ Champs popup ajoutés à la table users');

    // Ajouter le champ logout_at à login_history
    await client.query(`
      ALTER TABLE login_history 
      ADD COLUMN IF NOT EXISTS logout_at TIMESTAMP
    `);
    console.log('✅ Champ logout_at ajouté à la table login_history');

  } catch (err) {
    console.error('Erreur:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

addFields();






