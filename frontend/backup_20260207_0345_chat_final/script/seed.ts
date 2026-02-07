import bcrypt from 'bcrypt';
import { db } from '../db';
import { users, draws } from '../db/schema';
import fs from 'fs';
import path from 'path';

async function seed() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           🌱 LOTOFORMULA4LIFE SEED 🌱                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  // ============================================
  // ÉTAPE 1: Créer les utilisateurs par défaut
  // Alignés sur les mock users du backend (routes.ts) pour que
  // ADMINISTRATEUR / 123456 etc. fonctionnent aussi en mode DB.
  // ============================================
  
  console.log('👤 [1/2] Creating default users...');
  
  try {
    const password123456 = await bcrypt.hash('123456', 10);
    const adminPassword = await bcrypt.hash('AntoAbso', 10);
    const guestPassword = await bcrypt.hash('guest', 10);
    const abonnePassword = await bcrypt.hash('abonne', 10);
    const vipPassword = await bcrypt.hash('vip', 10);

    const defaultUsers = [
      { username: 'ADMINISTRATEUR', email: 'courrier.bardoux@gmail.com', password: password123456, role: 'admin' },
      { username: 'TestINVITE', email: 'alerteprix@laposte.net', password: password123456, role: 'invite' },
      { username: 'TestVIP', email: 'contact.absolu@gmail.com', password: password123456, role: 'vip' },
      { username: 'TestABONNE', email: 'wbusiness@laposte.net', password: password123456, role: 'abonne' },
      { username: 'cls', email: 'courrier.login.s@gmail.com', password: password123456, role: 'vip' },
      { username: 'clp', email: 'courrier.login.p@gmail.com', password: password123456, role: 'invite' },
      { username: 'AntoAbso', email: 'admin@lotoformula.com', password: adminPassword, role: 'admin' },
      { username: 'Guest123', email: 'guest@lotoformula.com', password: guestPassword, role: 'invite' },
      { username: 'JeanDupont', email: 'jean@test.com', password: abonnePassword, role: 'abonne' },
      { username: 'MarieCurie', email: 'marie@science.com', password: vipPassword, role: 'vip' },
    ];

    for (const userData of defaultUsers) {
      try {
        await db.insert(users).values(userData).onConflictDoNothing({ target: users.username });
        console.log(`   ✅ User: ${userData.username} (${userData.role})`);
      } catch (e) {
        console.log(`   ⏭️ User: ${userData.username} (already exists)`);
      }
    }
  } catch (error) {
    console.error('❌ Error creating users:', error);
  }

  // ============================================
  // ÉTAPE 2: Importer l'historique EuroMillions depuis le CSV
  // ============================================
  
  console.log('\n📊 [2/2] Importing EuroMillions history from CSV...');
  
  try {
    const csvPath = path.resolve('client/public/data/euromillions_historique_complet_2004-2025.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.log('   ⚠️ CSV file not found at:', csvPath);
      console.log('   ⏭️ Skipping history import');
    } else {
      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      const lines = csvContent.trim().split('\n');
      
      // Ignorer l'en-tête
      const dataLines = lines.slice(1);
      
      console.log(`   📄 Found ${dataLines.length} draws in CSV`);
      
      let imported = 0;
      let skipped = 0;
      
      for (const line of dataLines) {
        const cols = line.trim().split(';');
        if (cols.length < 8) continue;
        
        const date = cols[0]; // YYYY-MM-DD
        const numbers = [
          parseInt(cols[1]),
          parseInt(cols[2]),
          parseInt(cols[3]),
          parseInt(cols[4]),
          parseInt(cols[5])
        ].sort((a, b) => a - b);
        const stars = [
          parseInt(cols[6]),
          parseInt(cols[7])
        ].sort((a, b) => a - b);
        
        try {
          await db.insert(draws).values({
            date,
            numbers,
            stars,
          }).onConflictDoNothing();
          imported++;
        } catch (e) {
          skipped++;
        }
      }
      
      console.log(`   ✅ Imported: ${imported} draws`);
      if (skipped > 0) {
        console.log(`   ⏭️ Skipped: ${skipped} (already exist)`);
      }
    }
  } catch (error) {
    console.error('❌ Error importing history:', error);
  }

  // ============================================
  // RÉSUMÉ
  // ============================================
  
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           ✅ SEED COMPLETE ✅                               ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  Users:    ADMINISTRATEUR / 123456 (admin), cls, clp, etc. ║');
  console.log('║            AntoAbso, Guest123, JeanDupont, MarieCurie      ║');
  console.log('║  History:  Imported from CSV                               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});







