import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function updateTables() {
  const client = await pool.connect();
  try {
    // Ajouter les colonnes popup à users
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS popup_status VARCHAR(20) NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS console_access_count INTEGER NOT NULL DEFAULT 0
    `);
    console.log('✅ Colonnes popup_status et console_access_count ajoutées à users');

    // Ajouter logout_at à login_history
    await client.query(`
      ALTER TABLE login_history 
      ADD COLUMN IF NOT EXISTS logout_at TIMESTAMP
    `);
    console.log('✅ Colonne logout_at ajoutée à login_history');

    console.log('\n🎉 Base de données mise à jour avec succès !');
  } catch (err) {
    console.error('❌ Erreur:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

updateTables();

