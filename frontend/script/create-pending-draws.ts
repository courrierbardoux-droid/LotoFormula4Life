import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function createTable() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS pending_draws (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        token VARCHAR(64) NOT NULL UNIQUE,
        numbers JSON NOT NULL,
        stars JSON NOT NULL,
        target_date DATE,
        acknowledged TIMESTAMP,
        sent_at TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Table pending_draws créée avec succès !');
  } catch (err) {
    console.error('Erreur:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

createTable();


