import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function createTemplateTables() {
  console.log('🔧 Création des tables de templates...');
  
  try {
    // Créer la table email_popup_templates
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS email_popup_templates (
        id SERIAL PRIMARY KEY,
        type VARCHAR(20) NOT NULL UNIQUE,
        content TEXT NOT NULL,
        variables_config JSONB DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT NOW(),
        updated_by INTEGER REFERENCES users(id)
      )
    `);
    console.log('✅ Table email_popup_templates créée');

    // Créer la table template_variables
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS template_variables (
        id SERIAL PRIMARY KEY,
        key VARCHAR(50) NOT NULL UNIQUE,
        value TEXT NOT NULL,
        description VARCHAR(255),
        updated_at TIMESTAMP DEFAULT NOW(),
        updated_by INTEGER REFERENCES users(id)
      )
    `);
    console.log('✅ Table template_variables créée');

    console.log('🎉 Toutes les tables de templates ont été créées !');
  } catch (error: any) {
    console.error('❌ Erreur:', error);
    if (error.message) {
      console.error('Message:', error.message);
    }
  }

  process.exit(0);
}

createTemplateTables();
