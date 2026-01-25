import { sql } from 'drizzle-orm';

// Best-effort: create required tables if missing.
// Keeps the system usable without forcing manual DB migrations.
export async function ensureAutoUpdateTables() {
  const { db } = await import('../db');

  // draw_payouts: payouts FDJ per draw date (keep 65 days)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS draw_payouts (
      id SERIAL PRIMARY KEY,
      draw_date DATE NOT NULL UNIQUE,
      payouts JSON NOT NULL,
      source VARCHAR(20) NOT NULL DEFAULT 'fdj',
      fetched_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP
    )
  `);

  // winning_grids: computed results per grid per draw date
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS winning_grids (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      username_snapshot VARCHAR(50) NOT NULL,
      grid_id INTEGER NOT NULL REFERENCES grids(id),
      target_date DATE NOT NULL,
      match_num INTEGER NOT NULL,
      match_star INTEGER NOT NULL,
      gain_cents INTEGER,
      email_notified_at TIMESTAMP,
      seen_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS winning_grids_grid_target_uniq
    ON winning_grids (grid_id, target_date)
  `);

  // auto_update_runs: last run status for alerting
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS auto_update_runs (
      id SERIAL PRIMARY KEY,
      source VARCHAR(20) NOT NULL DEFAULT 'fdj',
      started_at TIMESTAMP DEFAULT NOW(),
      finished_at TIMESTAMP,
      success INTEGER NOT NULL DEFAULT 0,
      draw_date DATE,
      message TEXT,
      url TEXT,
      expires_at TIMESTAMP
    )
  `);
}

