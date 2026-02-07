import 'dotenv/config';
import { db } from '../db';
import { users, invitationCodes } from '../db/schema';
import { eq } from 'drizzle-orm';

const email = process.argv[2];

if (!email) {
  console.error('❌ Usage: npx tsx script/delete-user-by-email.ts <email>');
  process.exit(1);
}

async function deleteUserByEmail(targetEmail: string) {
  console.log(`🔍 Recherche du compte avec l'email: ${targetEmail}`);
  
  try {
    // Chercher l'utilisateur
    const [user] = await db.select().from(users).where(eq(users.email, targetEmail));
    
    if (!user) {
      console.log('❌ Aucun compte trouvé avec cet email');
      process.exit(1);
    }
    
    console.log(`📋 Compte trouvé:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Créé le: ${user.createdAt}`);
    
    // D'abord, supprimer les références dans invitation_codes
    console.log(`\n🔗 Suppression des références dans invitation_codes...`);
    await db.update(invitationCodes)
      .set({ usedBy: null })
      .where(eq(invitationCodes.usedBy, user.id));
    
    // Supprimer l'utilisateur
    await db.delete(users).where(eq(users.id, user.id));
    
    console.log(`\n✅ Compte supprimé avec succès !`);
    console.log(`   L'email ${targetEmail} est maintenant libre.`);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

deleteUserByEmail(email);
