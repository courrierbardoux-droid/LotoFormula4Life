/**
 * Script pour initialiser les templates popup1 et popup2 dans la base de données
 * 
 * Usage: npx tsx script/init-popup-templates.ts
 */

import { db } from '../db';
import { emailPopupTemplates } from '../db/schema';
import { eq } from 'drizzle-orm';

// Contenu HTML pour popup1 (Validation Gratitude)
const POPUP1_CONTENT = `<!-- 
  POP-UP 1 : VALIDATION GRATITUDE
  Ce fichier HTML peut être copié directement dans le champ "Popup 1 - Validation gratitude"
  de la page "Gestion des pop-ups & emails"
  
  Vous pouvez modifier librement les styles, couleurs, textes et mise en page.
  Les variables comme #utilisateur, #date seront remplacées automatiquement lors de l'affichage.
-->

<div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 9999; display: flex; align-items: center; justify-content: center;">
  <!-- Overlay grisé -->
  <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px);"></div>
  
  <!-- Popup -->
  <div style="position: relative; background: linear-gradient(to bottom, #1a1a1a, #0a0a0a); border: 2px solid #fbbf24; border-radius: 12px; padding: 36px; max-width: 768px; width: 90%; margin: 0 16px; box-shadow: 0 25px 50px -12px rgba(251, 191, 36, 0.2); transform: scale(1.5); transform-origin: center;">
    <!-- Décoration coin -->
    <div style="position: absolute; top: 0; left: 0; width: 48px; height: 48px; border-top: 2px solid #fbbf24; border-left: 2px solid #fbbf24; border-top-left-radius: 12px;"></div>
    <div style="position: absolute; top: 0; right: 0; width: 48px; height: 48px; border-top: 2px solid #fbbf24; border-right: 2px solid #fbbf24; border-top-right-radius: 12px;"></div>
    <div style="position: absolute; bottom: 0; left: 0; width: 48px; height: 48px; border-bottom: 2px solid #fbbf24; border-left: 2px solid #fbbf24; border-bottom-left-radius: 12px;"></div>
    <div style="position: absolute; bottom: 0; right: 0; width: 48px; height: 48px; border-bottom: 2px solid #fbbf24; border-right: 2px solid #fbbf24; border-bottom-right-radius: 12px;"></div>

    <!-- Titre -->
    <h2 style="text-align: center; font-family: 'Orbitron', sans-serif; font-size: 30px; color: #fbbf24; margin-bottom: 24px; letter-spacing: 0.2em; font-weight: 700;">
      ✨ GRATITUDE ✨
    </h2>

    <!-- Message informatif -->
    <div style="background-color: rgba(0, 0, 0, 0.5); border: 1px solid #3f3f46; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
      <p style="color: #d4d4d8; font-size: 16px; line-height: 1.75; margin-bottom: 16px;">
        <span style="color: #fbbf24; font-weight: 600;">LotoFormula4Life</span> vous rappelle que ce site ne fait pas d'art divinatoire. Il vous permet de recevoir des numéros qui, selon vos réglages et notre philosophie statistique, ont des probabilités raisonnables de sortir au tirage.
      </p>
      
      <!-- Message de gratitude -->
      <div style="border-top: 1px solid #3f3f46; padding-top: 16px; margin-top: 16px;">
        <p style="color: #4ade80; font-size: 16px; line-height: 1.75;">
          💚 <strong>Un petit mot du développeur :</strong><br>
          En retour, je ne vous demande que votre gratitude et vos remerciements. Si la chance vous sourit et que votre gain vous inspire générosité... à votre bon cœur ! Tout geste de reconnaissance, qu'il soit symbolique ou fiduciaire, sera accueilli comme un don et une grâce. <em style="color: #a1a1aa;">Aucun engagement, aucune obligation.</em>
        </p>
      </div>
    </div>

    <!-- Case à cocher -->
    <label style="display: flex; align-items: center; gap: 16px; cursor: pointer; margin-bottom: 36px; padding: 12px; border-radius: 8px; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='rgba(39, 39, 42, 0.5)'" onmouseout="this.style.backgroundColor='transparent'">
      <input type="checkbox" id="gratitude-checkbox" style="width: 28px; height: 28px; accent-color: #fbbf24; cursor: pointer;">
      <span style="color: #d4d4d8; font-size: 16px;">
        J'ai lu et j'accepte
      </span>
    </label>

    <!-- Bouton VALIDER -->
    <button id="gratitude-validate-btn" style="width: 100%; padding: 16px 36px; border-radius: 8px; font-family: 'Orbitron', sans-serif; font-weight: 700; font-size: 20px; letter-spacing: 0.1em; background: linear-gradient(to right, #16a34a, #22c55e); color: white; border: 2px solid #4ade80; box-shadow: 0 10px 15px -3px rgba(34, 197, 94, 0.3); transition: all 0.2s; cursor: pointer;" 
            onmouseover="this.style.background='linear-gradient(to right, #22c55e, #4ade80)'; this.style.boxShadow='0 10px 15px -3px rgba(34, 197, 94, 0.5)'" 
            onmouseout="this.style.background='linear-gradient(to right, #16a34a, #22c55e)'; this.style.boxShadow='0 10px 15px -3px rgba(34, 197, 94, 0.3)'"
            onclick="this.style.transform='scale(0.95)'; setTimeout(() => this.style.transform='scale(1)', 200)">
      VALIDER
    </button>
  </div>
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
  
  /* Animation pulse pour le bouton */
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.8; }
  }
  
  #gratitude-validate-btn {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  #gratitude-validate-btn:hover {
    animation: none;
  }
</style>`;

// Contenu HTML pour popup2 (Voir les numéros ?)
const POPUP2_CONTENT = `<!-- 
  POP-UP 2 : VOIR LES NUMÉROS ?
  Ce fichier HTML peut être copié directement dans le champ "Popup 2 - Voir les numéros ?"
  de la page "Gestion des pop-ups & emails"
  
  Vous pouvez modifier librement les styles, couleurs, textes et mise en page.
  Les variables comme #utilisateur, #date seront remplacées automatiquement lors de l'affichage.
-->

<div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 9999; display: flex; align-items: center; justify-content: center;">
  <!-- Overlay grisé -->
  <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px);"></div>
  
  <!-- Popup -->
  <div style="position: relative; background: linear-gradient(to bottom, #1a1a1a, #0a0a0a); border: 2px solid #fbbf24; border-radius: 12px; padding: 36px; max-width: 512px; width: 90%; margin: 0 16px; box-shadow: 0 25px 50px -12px rgba(251, 191, 36, 0.2); transform: scale(1.5); transform-origin: center;">
    <!-- Décoration coin -->
    <div style="position: absolute; top: 0; left: 0; width: 48px; height: 48px; border-top: 2px solid #fbbf24; border-left: 2px solid #fbbf24; border-top-left-radius: 12px;"></div>
    <div style="position: absolute; top: 0; right: 0; width: 48px; height: 48px; border-top: 2px solid #fbbf24; border-right: 2px solid #fbbf24; border-top-right-radius: 12px;"></div>
    <div style="position: absolute; bottom: 0; left: 0; width: 48px; height: 48px; border-bottom: 2px solid #fbbf24; border-left: 2px solid #fbbf24; border-bottom-left-radius: 12px;"></div>
    <div style="position: absolute; bottom: 0; right: 0; width: 48px; height: 48px; border-bottom: 2px solid #fbbf24; border-right: 2px solid #fbbf24; border-bottom-right-radius: 12px;"></div>

    <!-- Titre -->
    <h2 style="text-align: center; font-family: 'Orbitron', sans-serif; font-size: 24px; color: #fbbf24; margin-bottom: 24px; letter-spacing: 0.2em; font-weight: 700;">
      💬 CONSULTATION
    </h2>

    <!-- Message -->
    <div style="background-color: rgba(0, 0, 0, 0.5); border: 1px solid #3f3f46; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
      <p style="color: #d4d4d8; font-size: 18px; line-height: 1.75; text-align: center;">
        Voulez-vous consulter vos numéros ?
      </p>
    </div>

    <!-- Boutons -->
    <div style="display: flex; gap: 16px;">
      <!-- Bouton Non -->
      <button id="consultation-no-btn" style="flex: 1; padding: 16px 24px; border-radius: 8px; font-family: 'Orbitron', sans-serif; font-weight: 700; font-size: 18px; letter-spacing: 0.1em; background: linear-gradient(to right, #3f3f46, #52525b); color: white; border: 2px solid #71717a; box-shadow: 0 10px 15px -3px rgba(113, 113, 122, 0.3); transition: all 0.2s; cursor: pointer;"
              onmouseover="this.style.background='linear-gradient(to right, #52525b, #71717a)'; this.style.boxShadow='0 10px 15px -3px rgba(113, 113, 122, 0.5)'"
              onmouseout="this.style.background='linear-gradient(to right, #3f3f46, #52525b)'; this.style.boxShadow='0 10px 15px -3px rgba(113, 113, 122, 0.3)'"
              onclick="this.style.transform='scale(0.95)'; setTimeout(() => this.style.transform='scale(1)', 200)">
        NON
      </button>

      <!-- Bouton Oui -->
      <button id="consultation-yes-btn" style="flex: 1; padding: 16px 24px; border-radius: 8px; font-family: 'Orbitron', sans-serif; font-weight: 700; font-size: 18px; letter-spacing: 0.1em; background: linear-gradient(to right, #16a34a, #22c55e); color: white; border: 2px solid #4ade80; box-shadow: 0 10px 15px -3px rgba(34, 197, 94, 0.3); transition: all 0.2s; cursor: pointer;"
              onmouseover="this.style.background='linear-gradient(to right, #22c55e, #4ade80)'; this.style.boxShadow='0 10px 15px -3px rgba(34, 197, 94, 0.5)'"
              onmouseout="this.style.background='linear-gradient(to right, #16a34a, #22c55e)'; this.style.boxShadow='0 10px 15px -3px rgba(34, 197, 94, 0.3)'"
              onclick="this.style.transform='scale(0.95)'; setTimeout(() => this.style.transform='scale(1)', 200)">
        OUI
      </button>
    </div>
  </div>
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
  
  /* Animation pulse pour le bouton OUI */
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.8; }
  }
  
  #consultation-yes-btn {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  #consultation-yes-btn:hover {
    animation: none;
  }
</style>`;

async function initPopupTemplates() {
  try {
    console.log('🚀 Initialisation des templates popup1 et popup2...\n');

    // Vérifier si popup1 existe
    const [existingPopup1] = await db.select()
      .from(emailPopupTemplates)
      .where(eq(emailPopupTemplates.type, 'popup1'));

    if (existingPopup1) {
      console.log('✅ Template popup1 existe déjà, mise à jour...');
      await db.update(emailPopupTemplates)
        .set({
          content: POPUP1_CONTENT,
          updatedAt: new Date(),
        })
        .where(eq(emailPopupTemplates.type, 'popup1'));
      console.log('✅ Template popup1 mis à jour avec succès\n');
    } else {
      console.log('📝 Création du template popup1...');
      await db.insert(emailPopupTemplates).values({
        type: 'popup1',
        content: POPUP1_CONTENT,
        variablesConfig: {},
      });
      console.log('✅ Template popup1 créé avec succès\n');
    }

    // Vérifier si popup2 existe
    const [existingPopup2] = await db.select()
      .from(emailPopupTemplates)
      .where(eq(emailPopupTemplates.type, 'popup2'));

    if (existingPopup2) {
      console.log('✅ Template popup2 existe déjà, mise à jour...');
      await db.update(emailPopupTemplates)
        .set({
          content: POPUP2_CONTENT,
          updatedAt: new Date(),
        })
        .where(eq(emailPopupTemplates.type, 'popup2'));
      console.log('✅ Template popup2 mis à jour avec succès\n');
    } else {
      console.log('📝 Création du template popup2...');
      await db.insert(emailPopupTemplates).values({
        type: 'popup2',
        content: POPUP2_CONTENT,
        variablesConfig: {},
      });
      console.log('✅ Template popup2 créé avec succès\n');
    }

    console.log('✨ Initialisation terminée avec succès !');
    console.log('\n📋 Les templates sont maintenant disponibles dans la page "Gestion des pop-ups & emails"');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error);
    process.exit(1);
  }
}

initPopupTemplates();
