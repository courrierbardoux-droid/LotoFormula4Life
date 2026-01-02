import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export function setupAuth() {
  // Stratégie de connexion locale (username + password)
  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      // Chercher l'utilisateur par username
      const [user] = await db.select().from(users).where(eq(users.username, username));
      
      if (!user) {
        return done(null, false, { message: 'Utilisateur non trouvé' });
      }
      
      // Vérifier le mot de passe
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return done(null, false, { message: 'Mot de passe incorrect' });
      }
      
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));

  // Sérialisation : stocker l'ID utilisateur dans la session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Désérialisation : récupérer l'utilisateur depuis l'ID en session
  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      done(null, user || null);
    } catch (err) {
      done(err);
    }
  });
}

// Helper pour hasher un mot de passe
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Helper pour vérifier un mot de passe
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

