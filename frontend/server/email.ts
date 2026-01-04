import nodemailer from 'nodemailer';

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

const SITE_URL = process.env.SITE_URL || 'https://lotoformula4life.onrender.com';

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
  
  try {
    await transporter.sendMail({
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
              <a href="${SITE_URL}" class="button">CRÉER MON COMPTE</a>
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

    console.log(`[Email] Invitation ${type} envoyée à ${to}`);
    return true;
  } catch (error) {
    console.error('[Email] Erreur envoi:', error);
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
  const confirmUrl = `${SITE_URL}/confirm-draw/${token}`;
  
  try {
    await transporter.sendMail({
      from: `"LotoFormula4Life" <${process.env.GMAIL_USER}>`,
      to: to,
      subject: `🎰 Vos ${gridCount} numéros sont prêts ! - LotoFormula4Life`,
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
                Notre site ne prétend pas prédire l'avenir. Nous vous proposons des numéros sélectionnés selon vos réglages et notre approche statistique, offrant des probabilités raisonnables de sortir au tirage choisi.
              </p>
              <p>
                <strong style="color: #22c55e;">💚 Un petit mot du développeur :</strong><br>
                En retour, je ne vous demande que votre gratitude et vos remerciements. Si la chance vous sourit et que votre gain vous inspire générosité... à votre bon cœur ! Tout geste de reconnaissance, qu'il soit symbolique ou fiduciaire, sera accueilli comme un don et une grâce. Aucun engagement, aucune obligation.
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
      `,
    });

    console.log(`[Email] Confirmation tirage envoyée à ${to} (${gridCount} grilles)`);
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

export async function sendDrawNumbersEmail({ to, username, numbers, stars, targetDate }: DrawNumbersEmailParams): Promise<boolean> {
  const numbersDisplay = numbers.join(' - ');
  const starsDisplay = stars.join(' - ');
  const dateDisplay = targetDate ? new Date(targetDate).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Prochain tirage';
  
  try {
    await transporter.sendMail({
      from: `"LotoFormula4Life" <${process.env.GMAIL_USER}>`,
      to: to,
      subject: `🍀 Vos numéros EuroMillions - ${dateDisplay}`,
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
              <a href="${SITE_URL}/my-grids" class="button">📋 VOIR MES GRILLES</a>
            </div>
            
            <div class="footer">
              <p>LotoFormula4Life - Statistiques & Prédictibilités EuroMillions</p>
              <p>Bonne chance ! Que la fortune vous sourie ! 🍀✨</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log(`[Email] Numéros envoyés à ${to}: ${numbersDisplay} | ${starsDisplay}`);
    return true;
  } catch (error) {
    console.error('[Email] Erreur envoi numéros:', error);
    return false;
  }
}

// ============================================
// EMAIL ADMIN : Notification de gagnant
// ============================================

interface WinnerNotificationParams {
  winnerUsername: string;
  winnerEmail: string;
  numbers: number[];
  stars: number[];
  matchNum: number;
  matchStar: number;
  gain: number;
  drawDate: string;
}

export async function sendWinnerNotificationToAdmin(params: WinnerNotificationParams): Promise<boolean> {
  const ADMIN_EMAIL = 'courrier.bardoux@gmail.com';
  const { winnerUsername, winnerEmail, numbers, stars, matchNum, matchStar, gain, drawDate } = params;
  
  const numbersDisplay = numbers.join(' - ');
  const starsDisplay = stars.join(' - ');
  const dateDisplay = drawDate ? new Date(drawDate).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Date inconnue';
  
  try {
    await transporter.sendMail({
      from: `"LotoFormula4Life" <${process.env.GMAIL_USER}>`,
      to: ADMIN_EMAIL,
      subject: `🏆 GAGNANT DÉTECTÉ - ${winnerUsername} a gagné ${gain.toLocaleString()}€ !`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0a0a0a; color: #ffffff; padding: 40px; }
            .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); border: 3px solid #fbbf24; border-radius: 16px; padding: 40px; box-shadow: 0 0 50px rgba(251, 191, 36, 0.3); }
            .header { text-align: center; margin-bottom: 30px; }
            .title { font-size: 28px; font-weight: bold; color: #fbbf24; letter-spacing: 3px; }
            .trophy { font-size: 80px; text-align: center; margin: 20px 0; }
            .winner-box { background: linear-gradient(135deg, #14532d 0%, #0a0a0a 100%); border: 2px solid #22c55e; border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center; }
            .winner-name { font-size: 32px; font-weight: bold; color: #22c55e; }
            .winner-email { color: #a1a1aa; font-size: 14px; margin-top: 5px; }
            .gain { font-size: 48px; font-weight: bold; color: #fbbf24; text-shadow: 0 0 20px rgba(251, 191, 36, 0.5); margin: 20px 0; }
            .numbers-box { background: #000; border: 2px solid #fbbf24; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
            .numbers { font-size: 24px; font-weight: bold; color: #ffffff; font-family: monospace; }
            .stars { font-size: 24px; font-weight: bold; color: #fbbf24; font-family: monospace; margin-top: 10px; }
            .match-info { background: #18181b; border-radius: 8px; padding: 15px; margin: 15px 0; text-align: center; }
            .match { color: #22c55e; font-size: 18px; font-weight: bold; }
            .date { color: #71717a; font-size: 14px; margin-top: 10px; }
            .footer { text-align: center; color: #52525b; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="title">🎰 LOTOFORMULA4LIFE</div>
            </div>
            
            <div class="trophy">🏆</div>
            
            <h1 style="text-align: center; color: #fbbf24; font-size: 36px; margin: 0;">GAGNANT DÉTECTÉ !</h1>
            
            <div class="winner-box">
              <div class="winner-name">${winnerUsername}</div>
              <div class="winner-email">${winnerEmail}</div>
              <div class="gain">${gain.toLocaleString()} €</div>
            </div>
            
            <div class="numbers-box">
              <div class="numbers">${numbersDisplay}</div>
              <div class="stars">⭐ ${starsDisplay} ⭐</div>
            </div>
            
            <div class="match-info">
              <div class="match">${matchNum} numéros + ${matchStar} étoile${matchStar > 1 ? 's' : ''} trouvés !</div>
              <div class="date">Tirage du ${dateDisplay}</div>
            </div>
            
            <div class="footer">
              <p>Email généré automatiquement par LotoFormula4Life</p>
              <p>Félicitations ! 🎉</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log(`[Email] Notification gagnant envoyée à admin: ${winnerUsername} a gagné ${gain}€`);
    return true;
  } catch (error) {
    console.error('[Email] Erreur envoi notification gagnant:', error);
    return false;
  }
}
