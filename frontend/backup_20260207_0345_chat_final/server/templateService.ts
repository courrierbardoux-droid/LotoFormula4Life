
import { db } from '../db';
import { emailPopupTemplates, templateVariables } from '../db/schema';
import { eq } from 'drizzle-orm';

export type TemplateType = 'email1' | 'email2' | 'popup1' | 'popup2';

interface TemplateVariables {
  utilisateur?: string;
  email?: string;
  contactdéveloppeur?: string;
  date?: string;
  numéros?: string;
  étoiles?: string;
  'mise à jour Historique Euromillions'?: string;
  url_site?: string;
  [key: string]: string | undefined;
}

/**
 * Charge un template depuis la base de données
 */
export async function loadTemplate(type: TemplateType): Promise<string | null> {
  try {
    console.log(`[TemplateService] Tentative de chargement du template ${type} depuis la DB...`);
    const [template] = await db.select()
      .from(emailPopupTemplates)
      .where(eq(emailPopupTemplates.type, type));

    if (template) {
      console.log(`[TemplateService] Template ${type} trouvé en DB (${template.content.length} caractères)`);
      return template.content;
    } else {
      console.warn(`[TemplateService] Aucun template ${type} trouvé dans la table email_popup_templates`);
      return null;
    }
  } catch (error) {
    console.error(`[TemplateService] Erreur lors du chargement du template ${type}:`, error);
    return null;
  }
}

// Cache simple pour les variables (option B : chargement à la demande avec cache)
let variablesCache: Record<string, string> | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 60000; // Cache de 1 minute pour éviter trop de requêtes DB

/**
 * Charge toutes les variables de template depuis la DB (avec cache)
 */
export async function loadTemplateVariables(useCache: boolean = true): Promise<Record<string, string>> {
  const now = Date.now();
  
  // Utiliser le cache si disponible et récent
  if (useCache && variablesCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return variablesCache;
  }

  try {
    const vars = await db.select({
      key: templateVariables.key,
      value: templateVariables.value
    }).from(templateVariables);
    const result: Record<string, string> = {};

    vars.forEach(v => {
      result[v.key] = v.value;
    });

    // Mettre à jour le cache
    variablesCache = result;
    cacheTimestamp = now;

    return result;
  } catch (error) {
    console.error('[TemplateService] Erreur chargement variables:', error);
    // Retourner le cache si disponible, sinon vide
    return variablesCache || {};
  }
}

/**
 * Récupère une variable spécifique depuis la DB (avec valeurs par défaut)
 */
export async function getTemplateVariable(key: string, defaultValue: string): Promise<string> {
  const vars = await loadTemplateVariables();
  return vars[key] || defaultValue;
}

/**
 * Vide le cache (utile après modification d'une variable)
 */
export function clearVariablesCache(): void {
  variablesCache = null;
  cacheTimestamp = 0;
}

/**
 * Remplace les variables dans un template par leurs valeurs réelles
 */
export async function replaceVariables(
  template: string,
  variables: TemplateVariables,
  customVars?: Record<string, string>
): Promise<string> {
  let result = template;

  // Charger les variables depuis la DB
  const dbVars = await loadTemplateVariables();

  // Variables par défaut avec valeurs de la DB si disponibles
  const defaultVars: Record<string, string> = {
    '#utilisateur': variables.utilisateur || 'Utilisateur',
    '#Utilisateur': variables.utilisateur || 'Utilisateur', // Support majuscule/minuscule
    '#email': variables.email || '',
    '#contactdéveloppeur': dbVars['contactdéveloppeur'] || variables.contactdéveloppeur || 'support@lotoformula4life.com',
    '#date': variables.date || new Date().toLocaleDateString('fr-FR'),
    '#Date': variables.date || new Date().toLocaleDateString('fr-FR'), // Support majuscule/minuscule
    '#numéros': variables.numéros || '',
    '#étoiles': variables.étoiles || '',
    '#liste_grilles': variables['liste_grilles'] || '', // Variable pour toutes les grilles formatées
    '#mise à jour Historique Euromillions': dbVars['mise à jour Historique Euromillions'] || variables['mise à jour Historique Euromillions'] || 'https://www.euro-millions.com/results',
    '#url_site': dbVars['url_site'] || variables.url_site || process.env.SITE_URL || 'https://lotoformula4life.onrender.com',
    ...customVars
  };

  // Remplacer toutes les variables dans le template
  Object.keys(defaultVars).forEach(key => {
    // Échapper les caractères spéciaux pour la regex, y compris les espaces
    const escapedKey = key.replace(/[#.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedKey, 'g');
    result = result.replace(regex, defaultVars[key]);
  });

  return result;
}

/**
 * Charge un template et remplace les variables
 */
export async function getProcessedTemplate(
  type: TemplateType,
  variables: TemplateVariables,
  customVars?: Record<string, string>
): Promise<string | null> {
  console.log(`[TemplateService] getProcessedTemplate appelé pour type: ${type}`);
  const template = await loadTemplate(type);
  console.log(`[TemplateService] Template ${type} chargé:`, template ? `OUI (${template.length} caractères)` : 'NON');
  
  if (!template) {
    console.warn(`[TemplateService] Aucun template ${type} trouvé en DB`);
    return null;
  }

  if (type === 'email2') {
  }

  // Fusionner les variables personnalisées
  const allCustomVars: Record<string, string> = {};
  if (customVars) {
    Object.assign(allCustomVars, customVars);
  }

  const result = await replaceVariables(template, variables, allCustomVars);
  console.log(`[TemplateService] Template ${type} traité avec variables, résultat: ${result ? result.length + ' caractères' : 'null'}`);
  return result;
}
