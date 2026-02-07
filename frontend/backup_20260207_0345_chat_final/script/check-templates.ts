import 'dotenv/config';
import { db } from '../db';
import { emailPopupTemplates } from '../db/schema';

async function checkTemplates() {
  console.log('🔍 Vérification des templates dans la base de données...\n');

  try {
    const templates = await db.select().from(emailPopupTemplates);
    
    console.log(`✅ ${templates.length} template(s) trouvé(s) dans la DB:\n`);
    
    templates.forEach(template => {
      console.log(`Type: ${template.type}`);
      console.log(`ID: ${template.id}`);
      console.log(`Contenu: ${template.content.length} caractères`);
      console.log(`Aperçu (premiers 200 caractères): ${template.content.substring(0, 200)}...`);
      console.log(`Mis à jour: ${template.updatedAt}`);
      console.log('---\n');
    });
    
    // Vérifier spécifiquement email1 et email2
    const email1 = templates.find(t => t.type === 'email1');
    const email2 = templates.find(t => t.type === 'email2');
    
    console.log('\n📧 Vérification spécifique:');
    console.log(`email1: ${email1 ? '✅ TROUVÉ' : '❌ NON TROUVÉ'}`);
    console.log(`email2: ${email2 ? '✅ TROUVÉ' : '❌ NON TROUVÉ'}`);
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
  }

  process.exit(0);
}

checkTemplates();
