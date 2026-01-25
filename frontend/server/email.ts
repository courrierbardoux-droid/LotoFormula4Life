import nodemailer from 'nodemailer';
import { getTemplateVariable, getProcessedTemplate } from './templateService';

// Configuration Gmail SMTP
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // TLS
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD, // Mot de passe d'application (pas le mot de passe Gmail normal)
  },
  tls: {
    rejectUnauthorized: false, // Ignorer les erreurs de certificat (proxy/réseau)
  },
});

// Valeur par défaut (fallback si variable n'existe pas en DB)
const DEFAULT_SITE_URL = process.env.SITE_URL || 'https://lotoformula4life.onrender.com';
const DEFAULT_CONTACT_EMAIL = 'support@lotoformula4life.com';

/**
 * Récupère l'URL du site depuis la DB (ou valeur par défaut)
 */
async function getSiteUrl(): Promise<string> {
  return await getTemplateVariable('url_site', DEFAULT_SITE_URL);
}

/**
 * Récupère l'email de contact depuis la DB (ou valeur par défaut)
 */
async function getContactEmail(): Promise<string> {
  return await getTemplateVariable('contactdéveloppeur', DEFAULT_CONTACT_EMAIL);
}

// ============================================
// INTERFACES
// ============================================

interface InvitationEmailParams {
  to: string;
  code: string;
  type: 'vip' | 'invite';
}

export async function sendInvitationEmail({ to, code, type }: InvitationEmailParams): Promise<boolean> {
  const roleLabel = type === 'vip' ? 'VIP' : 'Invité';
  const roleColor = type === 'vip' ? '#22c55e' : '#ffffff';
  
  // Vérifier que les variables d'environnement sont définies
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error('[Email] Variables d\'environnement manquantes: GMAIL_USER ou GMAIL_APP_PASSWORD');
    return false;
  }
  
  try {
    // Charger l'URL du site depuis la DB
    const siteUrl = await getSiteUrl();
    
    const result = await transporter.sendMail({
      from: `"LotoFormula4Life" <${process.env.GMAIL_USER}>`,
      to: to,
      subject: `🎰 Invitation ${roleLabel} - LotoFormula4Life`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0a0a0a; color: #ffffff; padding: 40px; }
            .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); border: 1px solid #333; border-radius: 16px; padding: 40px; }
            .header { text-align: center; margin-bottom: 30px; }
            .title { font-size: 28px; font-weight: bold; color: #fbbf24; letter-spacing: 3px; }
            .subtitle { color: #71717a; font-size: 14px; margin-top: 8px; }
            .code-box { background: #000; border: 2px solid ${roleColor}; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
            .code { font-size: 42px; font-weight: bold; letter-spacing: 10px; color: ${roleColor}; font-family: monospace; }
            .code-label { color: #71717a; font-size: 12px; margin-bottom: 10px; text-transform: uppercase; }
            .role-badge { display: inline-block; background: ${type === 'vip' ? '#14532d' : '#27272a'}; color: ${roleColor}; padding: 8px 20px; border-radius: 20px; font-weight: bold; font-size: 14px; margin-bottom: 20px; }
            .instructions { background: #18181b; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .instructions h3 { color: #fbbf24; margin: 0 0 15px 0; font-size: 16px; }
            .instructions ol { margin: 0; padding-left: 20px; color: #a1a1aa; }
            .instructions li { margin: 8px 0; }
            .button { display: inline-block; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #000; padding: 15px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; margin: 20px 0; }
            .footer { text-align: center; color: #52525b; font-size: 12px; margin-top: 30px; border-top: 1px solid #27272a; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="title">🎰 LOTOFORMULA4LIFE</div>
              <div class="subtitle">Statistiques & Prédictibilités EuroMillions</div>
            </div>
            
            <div style="text-align: center;">
              <div class="role-badge">INVITATION ${roleLabel.toUpperCase()}</div>
            </div>
            
            <p style="color: #d4d4d8; line-height: 1.6;">
              Bonjour,<br><br>
              Vous avez été invité(e) à rejoindre <strong>LotoFormula4Life</strong> avec un accès <strong style="color: ${roleColor}">${roleLabel}</strong>.
            </p>
            
            <div class="code-box">
              <div class="code-label">Votre code d'invitation</div>
              <div class="code">${code}</div>
            </div>
            
            <div class="instructions">
              <h3>📋 Comment utiliser ce code :</h3>
              <ol>
                <li>Rendez-vous sur le site</li>
                <li>Cliquez sur "Créer un compte"</li>
                <li>Remplissez vos informations <strong style="color: #fbbf24;">en utilisant cette adresse email : ${to}</strong></li>
                <li>Entrez le code <strong>${code}</strong> dans le champ "Code d'invitation"</li>
                <li>Validez et profitez de votre accès ${roleLabel} !</li>
              </ol>
            </div>
            
            <div style="text-align: center;">
              <a href="${siteUrl}" class="button">CRÉER MON COMPTE</a>
            </div>
            
            <p style="color: #71717a; font-size: 13px; text-align: center;">
              ⚠️ Ce code est valable 31 jours et ne peut être utilisé qu'une seule fois.
            </p>
            
            <div class="footer">
              <p>LotoFormula4Life - Statistiques & Prédictibilités EuroMillions</p>
              <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log(`[Email] Invitation ${type} envoyée à ${to}`, result.messageId);
    return true;
  } catch (error: any) {
    console.error('[Email] Erreur envoi invitation:', error);
    console.error('[Email] Détails erreur:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    });
    return false;
  }
}

// ============================================
// EMAIL 1 : Message légal + lien confirmation
// ============================================

interface DrawConfirmationEmailParams {
  to: string;
  username: string;
  token: string;
  gridCount: number;
}

export async function sendDrawConfirmationEmail({ to, username, token, gridCount }: DrawConfirmationEmailParams): Promise<boolean> {
  console.log('[Email] ========== sendDrawConfirmationEmail DÉBUT ==========');
  console.log('[Email] Paramètres:', { to, username, token: token.substring(0, 10) + '...', gridCount });
  
  // Charger l'URL du site depuis la DB
  let siteUrl = await getSiteUrl();
  console.log('[Email] Site URL depuis DB:', siteUrl);
  
  // En développement local, utiliser localhost:5000 (frontend)
  if (process.env.NODE_ENV !== 'production' && (!siteUrl || siteUrl.includes('onrender.com'))) {
    siteUrl = 'http://localhost:5000';
    console.log('[Email] Mode développement détecté, utilisation de:', siteUrl);
  }
  
  // Modifier le lien pour pointer vers la page frontend qui envoie l'email2
  const confirmUrl = `${siteUrl}/confirm-draw/${token}`;
  console.log('[Email] URL de confirmation générée:', confirmUrl);
  
  try {
    console.log('[Email] Chargement du template email1 depuis la DB...');
    // Préparer le texte avec pluriel automatique (utilisé pour template DB et fallback)
    const nombreGrillesTexte = `${gridCount} grille${gridCount > 1 ? 's' : ''}`;
    
    // Charger le template email1 depuis la DB
    const template = await getProcessedTemplate('email1', {
      utilisateur: username,
      email: to,
      date: new Date().toLocaleDateString('fr-FR'),
      numéros: '', // Pas encore de numéros dans l'email 1
      étoiles: '', // Pas encore d'étoiles dans l'email 1
    }, {
      '#url_confirmation': confirmUrl, // Variable spéciale pour le lien de confirmation
      '#nombre_grilles': gridCount.toString(),
    });

    console.log('[Email] Template email1 chargé depuis DB:', template ? `OUI (${template.length} caractères)` : 'NON');
    
    // Si le template n'existe pas en DB, utiliser le template par défaut (fallback)
    let htmlContent = template;
    if (!htmlContent) {
      console.warn('[Email] Template email1 non trouvé en DB, utilisation du template par défaut');
      // Template par défaut (fallback)
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0a0a0a; color: #ffffff; padding: 40px; }
            .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); border: 1px solid #333; border-radius: 16px; padding: 40px; }
            .header { text-align: center; margin-bottom: 30px; }
            .title { font-size: 28px; font-weight: bold; color: #fbbf24; letter-spacing: 3px; }
            .subtitle { color: #71717a; font-size: 14px; margin-top: 8px; }
            .message-box { background: #18181b; border-radius: 12px; padding: 25px; margin: 25px 0; border-left: 4px solid #fbbf24; }
            .message-box p { color: #d4d4d8; line-height: 1.8; margin: 0 0 15px 0; }
            .highlight { color: #fbbf24; font-weight: bold; }
            .legal-note { background: #0c0c0c; border: 1px solid #27272a; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .legal-note p { color: #a1a1aa; font-size: 13px; line-height: 1.7; margin: 0 0 12px 0; }
            .checkbox-section { background: #000; border: 2px solid #fbbf24; border-radius: 12px; padding: 25px; text-align: center; margin: 30px 0; }
            .checkbox-label { color: #fbbf24; font-size: 14px; margin-bottom: 20px; display: block; }
            .button { display: inline-block; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #000; padding: 18px 50px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 18px; margin: 10px 0; box-shadow: 0 4px 20px rgba(251, 191, 36, 0.3); }
            .button:hover { transform: scale(1.02); }
            .footer { text-align: center; color: #52525b; font-size: 12px; margin-top: 30px; border-top: 1px solid #27272a; padding-top: 20px; }
            .emoji { font-size: 24px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="title">🎰 LOTOFORMULA4LIFE</div>
              <div class="subtitle">Statistiques & Prédictibilités EuroMillions</div>
            </div>
            
            <p style="color: #d4d4d8; font-size: 18px; text-align: center;">
              Bonjour <strong class="highlight">${username}</strong> ! 👋
            </p>
            
            <div class="message-box">
              <p>
                <span class="emoji">🎯</span> LotoFormula4Life s'apprête à vous transmettre <strong class="highlight">${gridCount} grille${gridCount > 1 ? 's' : ''}</strong> de numéros personnalisés.
              </p>
            </div>
            
            <div class="legal-note">
              <p>
                <strong style="color: #fbbf24;">📌 Rappel important :</strong><br>
                <strong>LotoFormula4Life</strong> vous rappelle que ce site ne fait pas d'art divinatoire. Il vous permet de recevoir des numéros qui, selon vos réglages et notre philosophie statistique, ont des probabilités raisonnables de sortir au tirage.
              </p>
              <p>
                <strong style="color: #22c55e;">💚 Un petit mot du développeur :</strong><br>
                En retour, je ne vous demande que votre gratitude et vos remerciements. Si la chance vous sourit et que votre gain vous inspire générosité... à votre bon cœur ! Tout geste de reconnaissance, qu'il soit symbolique ou fiduciaire, sera accueilli comme un don et une grâce. <em style="color: #71717a;">Aucun engagement, aucune obligation.</em>
              </p>
            </div>
            
            <div class="checkbox-section">
              <span class="checkbox-label">✅ En cliquant sur "Recevoir mes numéros", je confirme avoir pris connaissance des informations ci-dessus.</span>
              <a href="${confirmUrl}" class="button">📩 RECEVOIR MES NUMÉROS</a>
            </div>
            
            <p style="color: #71717a; font-size: 12px; text-align: center;">
              ⚠️ Ce lien est valable 24 heures et ne peut être utilisé qu'une seule fois.
            </p>
            
            <div class="footer">
              <p>LotoFormula4Life - Statistiques & Prédictibilités EuroMillions</p>
              <p>Bonne chance ! 🍀</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      // Préparer le texte avec pluriel automatique pour le remplacement dans le template DB
      const nombreGrillesTexte = `${gridCount} grille${gridCount > 1 ? 's' : ''}`;
      
      // Remplacer #nombre_grilles_texte AVANT #nombre_grilles (pour éviter le problème de remplacement partiel)
      // Utiliser un nom de variable qui ne contient pas #nombre_grilles pour éviter les conflits
      htmlContent = htmlContent.replace(/#nb_grilles_complet/g, nombreGrillesTexte);
      
      // Remplacer le lien de confirmation dans le template si nécessaire
      htmlContent = htmlContent.replace(/#url_confirmation/g, confirmUrl);
      
      // Si le template n'a pas de variable #url_confirmation, remplacer le texte "RECEVOIR MES NUMÉROS" par un lien
      console.log('[Email] Vérification si le lien doit être ajouté...');
      console.log('[Email] htmlContent.includes(confirmUrl):', htmlContent.includes(confirmUrl));
      console.log('[Email] htmlContent.includes(RECEVOIR MES NUMÉROS):', htmlContent.includes('RECEVOIR MES NUMÉROS'));
      
      if (!htmlContent.includes(confirmUrl) && htmlContent.includes('RECEVOIR MES NUMÉROS')) {
        console.log('[Email] Ajout du lien dans le template...');
        // Remplacer le texte par un lien cliquable
        const beforeReplace = htmlContent;
        htmlContent = htmlContent.replace(
          /📩\s*RECEVOIR MES NUMÉROS[^<]*/gi,
          `<a href="${confirmUrl}" style="display: inline-block; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #000; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; margin: 10px 0;">📩 RECEVOIR MES NUMÉROS</a>`
        );
        console.log('[Email] Lien ajouté. Changement effectué:', beforeReplace !== htmlContent);
        console.log('[Email] htmlContent contient maintenant confirmUrl:', htmlContent.includes(confirmUrl));
      } else {
        console.log('[Email] Lien non ajouté - condition non remplie');
      }
    }

    console.log('[Email] Contenu final avant envoi (premiers 500 caractères):', htmlContent.substring(0, 500));
    console.log('[Email] Contenu final contient confirmUrl:', htmlContent.includes(confirmUrl));
    console.log('[Email] Contenu final contient <a href:', htmlContent.includes('<a href'));

    await transporter.sendMail({
      from: `"LotoFormula4Life" <${process.env.GMAIL_USER}>`,
      to: to,
      subject: `🎰 Vos ${gridCount} numéros sont prêts ! - LotoFormula4Life`,
      html: htmlContent,
    });

    console.log(`[Email] Confirmation tirage envoyée à ${to} (${gridCount} grilles) - Template email1 utilisé`);
    return true;
  } catch (error) {
    console.error('[Email] Erreur envoi confirmation:', error);
    return false;
  }
}

// ============================================
// EMAIL 2 : Envoi des numéros
// ============================================

interface DrawNumbersEmailParams {
  to: string;
  username: string;
  numbers: number[];
  stars: number[];
  targetDate?: string;
}

interface DrawGrid {
  numbers: number[];
  stars: number[];
  targetDate?: string;
}

interface DrawNumbersEmailMultiParams {
  to: string;
  username: string;
  grids: DrawGrid[];
}

export async function sendDrawNumbersEmail({ to, username, numbers, stars, targetDate }: DrawNumbersEmailParams): Promise<boolean> {
  console.log('[Email] ========== sendDrawNumbersEmail DÉBUT ==========');
  console.log('[Email] Paramètres:', { to, username, numbers, stars, targetDate });
  console.log('[Email] targetDate type:', typeof targetDate);
  console.log('[Email] targetDate null?:', targetDate === null);
  console.log('[Email] targetDate undefined?:', targetDate === undefined);
  
  const numbersDisplay = numbers.join(' - ');
  const starsDisplay = stars.join(' - ');
  
  let dateDisplay = 'Prochain tirage';
  if (targetDate) {
    try {
      const dateObj = new Date(targetDate);
      dateDisplay = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      console.log('[Email] Date formatée avec succès:', dateDisplay);
    } catch (e) {
      console.error('[Email] ERREUR formatage date:', e);
      dateDisplay = 'Prochain tirage';
    }
  } else {
    console.log('[Email] targetDate est null/undefined, utilisation de "Prochain tirage"');
  }
  
  console.log('[Email] Données formatées:', { numbersDisplay, starsDisplay, dateDisplay });
  
  try {
    // Charger l'URL du site depuis la DB
    const siteUrl = await getSiteUrl();
    console.log('[Email] Site URL:', siteUrl);
    
    console.log('[Email] Chargement du template email2 depuis la DB...');
    // Charger le template email2 depuis la DB
    const template = await getProcessedTemplate('email2', {
      utilisateur: username,
      email: to,
      date: dateDisplay,
      numéros: numbersDisplay,
      étoiles: starsDisplay,
    }, {
      '#url_mes_grilles': `${siteUrl}/my-grids`, // Variable spéciale pour le lien vers mes grilles
    });

    console.log('[Email] Template email2 chargé depuis DB:', template ? `OUI (${template.length} caractères)` : 'NON');
    
    // Si le template n'existe pas en DB, utiliser le template par défaut (fallback)
    let htmlContent = template;
    if (!htmlContent) {
      console.warn('[Email] Template email2 non trouvé en DB, utilisation du template par défaut');
      // Template par défaut (fallback) - garder l'ancien code comme backup
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0a0a0a; color: #ffffff; padding: 40px; }
            .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); border: 1px solid #333; border-radius: 16px; padding: 40px; }
            .header { text-align: center; margin-bottom: 30px; }
            .title { font-size: 28px; font-weight: bold; color: #fbbf24; letter-spacing: 3px; }
            .subtitle { color: #71717a; font-size: 14px; margin-top: 8px; }
            .date-badge { display: inline-block; background: #14532d; color: #22c55e; padding: 8px 20px; border-radius: 20px; font-weight: bold; font-size: 14px; margin: 20px 0; }
            .numbers-box { background: #000; border: 3px solid #fbbf24; border-radius: 16px; padding: 30px; text-align: center; margin: 30px 0; box-shadow: 0 0 30px rgba(251, 191, 36, 0.2); }
            .numbers-label { color: #71717a; font-size: 12px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 2px; }
            .numbers { font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #ffffff; font-family: 'Courier New', monospace; margin: 15px 0; }
            .stars { font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #fbbf24; font-family: 'Courier New', monospace; margin: 15px 0; }
            .separator { color: #52525b; font-size: 24px; margin: 10px 0; }
            .reminder { background: #18181b; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
            .reminder p { color: #a1a1aa; font-size: 14px; margin: 0; }
            .button { display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #fff; padding: 15px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; margin: 20px 0; }
            .footer { text-align: center; color: #52525b; font-size: 12px; margin-top: 30px; border-top: 1px solid #27272a; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="title">🎰 LOTOFORMULA4LIFE</div>
              <div class="subtitle">Statistiques & Prédictibilités EuroMillions</div>
            </div>
            
            <p style="color: #d4d4d8; font-size: 18px; text-align: center;">
              Bonjour <strong style="color: #fbbf24;">${username}</strong> ! 🍀
            </p>
            
            <div style="text-align: center;">
              <div class="date-badge">📅 ${dateDisplay}</div>
            </div>
            
            <div class="numbers-box">
              <div class="numbers-label">Vos numéros</div>
              <div class="numbers">${numbersDisplay}</div>
              <div class="separator">✦ ✦ ✦</div>
              <div class="numbers-label">Vos étoiles</div>
              <div class="stars">⭐ ${starsDisplay} ⭐</div>
            </div>
            
            <div class="reminder">
              <p>💡 Vos numéros ont été sauvegardés dans <strong>"Mes Grilles Jouées"</strong></p>
            </div>
            
            <div style="text-align: center;">
              <a href="${siteUrl}/my-grids" class="button">📋 VOIR MES GRILLES</a>
            </div>
            
            <div class="footer">
              <p>LotoFormula4Life - Statistiques & Prédictibilités EuroMillions</p>
              <p>Bonne chance ! Que la fortune vous sourie ! 🍀✨</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      // Remplacer le lien vers mes grilles dans le template si nécessaire
      htmlContent = htmlContent.replace(/#url_mes_grilles/g, `${siteUrl}/my-grids`);
    }
    
    await transporter.sendMail({
      from: `"LotoFormula4Life" <${process.env.GMAIL_USER}>`,
      to: to,
      subject: `🍀 Vos numéros EuroMillions - ${dateDisplay}`,
      html: htmlContent,
    });

    console.log(`[Email] Numéros envoyés à ${to}: ${numbersDisplay} | ${starsDisplay} - Template email2 utilisé`);
    return true;
  } catch (error) {
    console.error('[Email] Erreur envoi numéros:', error);
    return false;
  }
}

// ============================================
// EMAIL 2 MULTI : Envoi des numéros pour plusieurs grilles (un seul email)
// ============================================

export async function sendDrawNumbersEmailMulti({ to, username, grids }: DrawNumbersEmailMultiParams): Promise<boolean> {
  console.log('[Email] ========== sendDrawNumbersEmailMulti DÉBUT ==========');
  console.log('[Email] Paramètres:', { to, username, gridCount: grids.length });
  
  // LOGS POUR ANALYSER targetDate
  console.log('[Email] ===== ANALYSE targetDate DANS sendDrawNumbersEmailMulti =====');
  for (let i = 0; i < grids.length; i++) {
    const grid = grids[i];
    console.log(`[Email] Grille ${i + 1} - targetDate:`, grid.targetDate);
    console.log(`[Email] Grille ${i + 1} - targetDate type:`, typeof grid.targetDate);
  }
  console.log('[Email] ===== FIN ANALYSE targetDate =====');
  
  if (grids.length === 0) {
    console.warn('[Email] Aucune grille à envoyer');
    return false;
  }

  // Si une seule grille, utiliser la fonction existante
  if (grids.length === 1) {
    const grid = grids[0];
    console.log('[Email] Une seule grille, utilisation de sendDrawNumbersEmail');
    return await sendDrawNumbersEmail({
      to,
      username,
      numbers: grid.numbers,
      stars: grid.stars,
      targetDate: grid.targetDate,
    });
  }

  try {
    // Charger l'URL du site depuis la DB
    const siteUrl = await getSiteUrl();
    console.log('[Email] Site URL:', siteUrl);
    
    // Toutes les grilles ont la même date (première grille)
    const firstGrid = grids[0];
    let dateDisplay = 'Prochain tirage';
    if (firstGrid.targetDate) {
      try {
        const dateObj = new Date(firstGrid.targetDate);
        dateDisplay = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        console.log('[Email] Date formatée pour toutes les grilles:', dateDisplay);
      } catch (e) {
        console.error('[Email] ERREUR formatage date:', e);
        dateDisplay = 'Prochain tirage';
      }
    } else {
      console.log('[Email] targetDate est null/undefined, utilisation de "Prochain tirage"');
    }
    
    // Générer #liste_grilles : "#numéros ⭐ #étoiles<br>" pour chaque grille
    const listeGrilles = grids.map(grid => {
      const numbersDisplay = grid.numbers.join(' - ');
      const starsDisplay = grid.stars.join(' - ');
      return `${numbersDisplay} ⭐ ${starsDisplay}<br>`;
    }).join('');
    
    console.log('[Email] Liste des grilles générée:', listeGrilles.substring(0, 200) + '...');
    
    // Charger le template email2 depuis la DB
    console.log('[Email] Chargement du template email2 depuis la DB...');
    
    const template = await getProcessedTemplate('email2', {
      utilisateur: username,
      email: to,
      date: dateDisplay,
      numéros: '', // Non utilisé pour multi-grilles
      étoiles: '', // Non utilisé pour multi-grilles
      liste_grilles: listeGrilles, // Variable pour toutes les grilles
    }, {
      '#url_mes_grilles': `${siteUrl}/my-grids`,
    });

    console.log('[Email] Template email2 chargé depuis DB:', template ? `OUI (${template.length} caractères)` : 'NON');
    
    if (!template) {
      console.error('[Email] ERREUR: Template email2 non trouvé en DB');
      return false;
    }
    
    // Le template est déjà traité avec les variables remplacées
    let htmlContent = template;
    
    // Remplacer #url_mes_grilles si nécessaire
    htmlContent = htmlContent.replace(/#url_mes_grilles/g, `${siteUrl}/my-grids`);
    
    console.log('[Email] Contenu final préparé (premiers 500 caractères):', htmlContent.substring(0, 500));
    
    const subjectDate = dateDisplay;
    
    await transporter.sendMail({
      from: `"LotoFormula4Life" <${process.env.GMAIL_USER}>`,
      to: to,
      subject: `🍀 Vos ${grids.length} grille${grids.length > 1 ? 's' : ''} EuroMillions - ${subjectDate}`,
      html: htmlContent,
    });

    console.log(`[Email] ${grids.length} grilles envoyées à ${to} dans un seul email avec le template de la DB`);
    return true;
  } catch (error) {
    console.error('[Email] Erreur envoi numéros multi:', error);
    return false;
  }
}

// (Gagnants) : suppression totale des notifications email "gagnant"

// ============================================
// FONCTION D'ENVOI D'EMAIL DE TEST (ADMIN)
// ============================================

interface TestEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendTestEmail({ to, subject, html }: TestEmailParams): Promise<boolean> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error('[Email] Variables d\'environnement manquantes: GMAIL_USER ou GMAIL_APP_PASSWORD');
    return false;
  }

  try {
    const result = await transporter.sendMail({
      from: `"LotoFormula4Life [TEST]" <${process.env.GMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html,
    });

    console.log(`[Email] Email de test envoyé à ${to}`, result.messageId);
    return true;
  } catch (error: any) {
    console.error('[Email] Erreur envoi email test:', error);
    return false;
  }
}

// ============================================
// EMAIL : Notification gagnant (utilisateur)
// ============================================
interface WinnerUserEmailParams {
  to: string;
  username: string;
  drawDate: string; // YYYY-MM-DD
  matchNum: number;
  matchStar: number;
  gainCents: number | null; // null => jackpot / non déterminé
  gridNumbers: number[];
  gridStars: number[];
  drawNumbers: number[];
  drawStars: number[];
}

export async function sendWinnerEmailToUser(params: WinnerUserEmailParams): Promise<boolean> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error('[Email] Variables d\'environnement manquantes: GMAIL_USER ou GMAIL_APP_PASSWORD');
    return false;
  }

  const { to, username, drawDate, matchNum, matchStar, gainCents, gridNumbers, gridStars, drawNumbers, drawStars } = params;
  const siteUrl = await getSiteUrl();
  const contactEmail = await getContactEmail();

  const euros = gainCents == null ? null : gainCents / 100;
  const gainLabel = gainCents == null ? 'JACKPOT (montant à confirmer)' : `${euros?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`;

  const numsGrid = gridNumbers.join(' - ');
  const starsGrid = gridStars.join(' - ');
  const numsDraw = drawNumbers.join(' - ');
  const starsDraw = drawStars.join(' - ');

  try {
    await transporter.sendMail({
      from: `"LotoFormula4Life" <${process.env.GMAIL_USER}>`,
      to,
      subject: `🏆 Gagné ! Tirage du ${drawDate} — ${gainCents == null ? 'JACKPOT' : gainLabel}`,
      html: `
        <div style="font-family:Segoe UI,Arial,sans-serif;background:#0a0a0a;color:#fff;padding:24px">
          <div style="max-width:720px;margin:0 auto;border:1px solid #333;border-radius:14px;padding:24px;background:linear-gradient(135deg,#1a1a1a,#0a0a0a)">
            <h1 style="margin:0 0 10px 0;color:#fbbf24;letter-spacing:2px">GAGNÉ !</h1>
            <p style="margin:0 0 14px 0;color:#d4d4d8">Bonjour <b>${username}</b>,</p>
            <p style="margin:0 0 18px 0;color:#d4d4d8">
              Une de vos grilles a généré un gain pour le tirage du <b>${drawDate}</b>.
            </p>
            <div style="display:flex;gap:12px;flex-wrap:wrap;margin:16px 0">
              <div style="flex:1;min-width:260px;background:#000;border:1px solid #444;border-radius:10px;padding:12px">
                <div style="color:#a1a1aa;font-size:12px;text-transform:uppercase;letter-spacing:1px">Votre grille</div>
                <div style="font-size:16px;margin-top:6px"><b>${numsGrid}</b> ⭐ <b>${starsGrid}</b></div>
              </div>
              <div style="flex:1;min-width:260px;background:#000;border:1px solid #444;border-radius:10px;padding:12px">
                <div style="color:#a1a1aa;font-size:12px;text-transform:uppercase;letter-spacing:1px">Tirage</div>
                <div style="font-size:16px;margin-top:6px"><b>${numsDraw}</b> ⭐ <b>${starsDraw}</b></div>
              </div>
            </div>
            <div style="background:#14532d;border:1px solid #22c55e;border-radius:12px;padding:14px;text-align:center;margin:18px 0">
              <div style="font-size:13px;color:#dcfce7;letter-spacing:1px">Correspondances</div>
              <div style="font-size:20px;font-weight:800;color:#fff;margin-top:6px">${matchNum} numéros + ${matchStar} étoile${matchStar>1?'s':''}</div>
              <div style="font-size:28px;font-weight:900;color:#fbbf24;margin-top:8px">${gainLabel}</div>
            </div>
            <div style="text-align:center;margin-top:18px">
              <a href="${siteUrl}/my-grids" style="display:inline-block;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#000;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:800">
                Voir mes grilles
              </a>
            </div>
            <p style="margin:18px 0 0 0;color:#71717a;font-size:12px;text-align:center">
              Besoin d'aide ? Contact : ${contactEmail}
            </p>
          </div>
        </div>
      `,
    });
    return true;
  } catch (e) {
    console.error('[Email] Erreur envoi notification gagnant user:', e);
    return false;
  }
}
