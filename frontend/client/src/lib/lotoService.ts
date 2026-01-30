import { startOfDay, parseISO, isAfter, isBefore, addDays, getDay } from 'date-fns';

export interface Tirage {
  date: string;
  numeros: number[];
  etoiles: number[];
}

export interface StatsNumeros {
  freqNumeros: Record<number, number>;
  freqEtoiles: Record<number, number>;
  freqNumerosNorm: Record<number, number>;
  freqEtoilesNorm: Record<number, number>;
  absenceNumeros: Record<number, number>;
  absenceEtoiles: Record<number, number>;
  tendancesNumeros: Record<number, { direction: 'hausse' | 'baisse' | 'stable'; score: number }>;
  tendancesEtoiles: Record<number, { direction: 'hausse' | 'baisse' | 'stable'; score: number }>;
  categoriesNum: {
    elevee: { numero: number; frequence: number }[];
    moyenne: { numero: number; frequence: number }[];
    basse: { numero: number; frequence: number }[];
    depart: { numero: number; frequence: number }[];
  };
  categoriesEtoiles: {
    elevee: { numero: number; frequence: number }[];
    moyenne: { numero: number; frequence: number }[];
    basse: { numero: number; frequence: number }[];
    depart: { numero: number; frequence: number }[];
  };
}

let cachedTirages: Tirage[] | null = null;
let cachedStats: StatsNumeros | null = null;

const STORAGE_KEY = 'euromillions_history_cache';
const STORAGE_TIMESTAMP_KEY = 'euromillions_history_timestamp';

/**
 * Met à jour le cache global des tirages et sauvegarde dans localStorage
 * Force le recalcul des statistiques et des viviers
 */
export function mettreAJourCache(nouveauxTirages: Tirage[]) {
  // Trier par date décroissante (plus récent en premier)
  const tiragesTries = [...nouveauxTirages].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  // Mettre à jour le cache mémoire
  cachedTirages = tiragesTries;
  cachedStats = null; // Force le recalcul des statistiques au prochain appel
  
  // Sauvegarder dans localStorage pour persistance
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tiragesTries));
    localStorage.setItem(STORAGE_TIMESTAMP_KEY, new Date().toISOString());
    console.log(`[LotoService] Cache mis à jour avec ${tiragesTries.length} tirages. Dernier: ${tiragesTries[0]?.date}`);
  } catch (e) {
    console.error("[LotoService] Erreur sauvegarde localStorage:", e);
  }
}

/**
 * Vide le cache pour forcer un rechargement complet
 */
export function viderCache() {
  cachedTirages = null;
  cachedStats = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_TIMESTAMP_KEY);
  } catch (e) {
    console.error("[LotoService] Erreur suppression cache:", e);
  }
}

/**
 * Vérifie si une mise à jour est nécessaire
 * Compare la date du dernier tirage avec les dates de tirage EuroMillions (mardi/vendredi 21h)
 * Retourne le tirage manquant le plus RÉCENT (pas le premier)
 */
export function verifierMiseAJourNecessaire(dernierTirage: Tirage | null): { 
  necessaire: boolean; 
  dateTirageManquant: Date | null;
  message: string;
} {
  if (!dernierTirage) {
    return { necessaire: true, dateTirageManquant: null, message: "Aucun tirage en base" };
  }

  const now = new Date();
  const derniereDateTirage = new Date(dernierTirage.date);
  
  // Collecter TOUS les tirages manquants entre le dernier tirage et maintenant
  const tiragesManquants: Date[] = [];
  
  // Chercher les dates de tirage entre le dernier tirage et maintenant
  let dateCourante = new Date(derniereDateTirage);
  dateCourante.setDate(dateCourante.getDate() + 1); // Commencer le lendemain
  
  while (dateCourante <= now) {
    const jour = dateCourante.getDay();
    // Mardi (2) ou Vendredi (5)
    if (jour === 2 || jour === 5) {
      // Vérifier si c'est après 21h30 (pour laisser le temps au tirage)
      const heureActuelle = now.getHours();
      const memeJour = dateCourante.toDateString() === now.toDateString();
      
      if (!memeJour || heureActuelle >= 22) {
        tiragesManquants.push(new Date(dateCourante));
      }
    }
    dateCourante.setDate(dateCourante.getDate() + 1);
  }
  
  // Si des tirages manquent, retourner le PLUS RÉCENT
  if (tiragesManquants.length > 0) {
    const dernierManquant = tiragesManquants[tiragesManquants.length - 1];
    return { 
      necessaire: true, 
      dateTirageManquant: dernierManquant,
      message: `Tirage du ${dernierManquant.toLocaleDateString('fr-FR')} manquant`
    };
  }
  
  return { necessaire: false, dateTirageManquant: null, message: "Base à jour" };
}

/**
 * Charge l'historique des tirages
 * Priorité: 1) Cache mémoire, 2) API /api/history (DB), 3) localStorage, 4) Fichier CSV
 */
export async function chargerHistorique(): Promise<Tirage[]> {
  // 1. Cache mémoire
  if (cachedTirages && cachedTirages.length > 0) {
    return cachedTirages;
  }

  // 2. API /api/history (Base de données PostgreSQL)
  try {
    const response = await fetch('/api/history', { credentials: 'include' });
    if (response.ok) {
      const rawJson: unknown = await response.json();
      const isArray = Array.isArray(rawJson);
      const tirages = (isArray ? rawJson : []) as Tirage[];
      if (tirages && tirages.length > 0) {
        cachedTirages = tirages;
        // Aussi mettre à jour le localStorage pour cohérence
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tirages));
        console.log(`[LotoService] Chargé depuis DB: ${tirages.length} tirages. Dernier: ${tirages[0]?.date}`);
        return tirages;
      }
    }
  } catch (e) {
    console.log("[LotoService] API indisponible, fallback localStorage/CSV");
  }

  // 3. localStorage (données persistantes après mise à jour manuelle)
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const tirages = JSON.parse(stored) as Tirage[];
      if (tirages && tirages.length > 0) {
        cachedTirages = tirages;
        console.log(`[LotoService] Chargé depuis localStorage: ${tirages.length} tirages. Dernier: ${tirages[0]?.date}`);
        return tirages;
      }
    }
  } catch (e) {
    console.error("[LotoService] Erreur lecture localStorage:", e);
  }

  // 4. Fichier CSV statique (données initiales de secours)
  try {
    const response = await fetch('/data/euromillions_historique_complet_2004-2025.csv');
    const text = await response.text();
    const lines = text.trim().split('\n');
    
    // Ignorer l'en-tête (première ligne)
    const tirages: Tirage[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const cols = line.split(';');
      if (cols.length < 8) continue;

      tirages.push({
        date: cols[0],
        numeros: [
          parseInt(cols[1]),
          parseInt(cols[2]),
          parseInt(cols[3]),
          parseInt(cols[4]),
          parseInt(cols[5])
        ].sort((a, b) => a - b),
        etoiles: [
          parseInt(cols[6]),
          parseInt(cols[7])
        ].sort((a, b) => a - b)
      });
    }

    // Sort by date descending (newest first)
    tirages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    cachedTirages = tirages;
    console.log(`[LotoService] Chargé depuis CSV: ${tirages.length} tirages. Dernier: ${tirages[0]?.date}`);
    return tirages;
  } catch (error) {
    console.error("Erreur lors du chargement de l'historique:", error);
    return [];
  }
}

export type PeriodUnit = 'weeks' | 'months' | 'years' | 'draws';

export interface FrequencyConfig {
    type: 'all' | 'last_year' | 'last_20' | 'custom';
    customValue?: number;
    customUnit?: PeriodUnit;
}

/** Config Tendance : Fenêtre W (via customValue quand customUnit=draws) + Période récente R (tirages). */
export type TrendWindowConfig = FrequencyConfig & { trendPeriodR?: number };

export function filterTirages(tirages: Tirage[], config: FrequencyConfig): Tirage[] {
    if (!tirages || tirages.length === 0) return [];

    switch (config.type) {
        case 'all':
            return tirages;
        case 'last_20':
            return tirages.slice(0, 20);
        case 'last_year':
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            return tirages.filter(t => new Date(t.date) >= oneYearAgo);
        case 'custom':
            if (!config.customValue || !config.customUnit) return tirages;
            
            if (config.customUnit === 'draws') {
                return tirages.slice(0, config.customValue);
            }
            
            const cutoffDate = new Date();
            if (config.customUnit === 'weeks') {
                cutoffDate.setDate(cutoffDate.getDate() - (config.customValue * 7));
            } else if (config.customUnit === 'months') {
                cutoffDate.setMonth(cutoffDate.getMonth() - config.customValue);
            } else if (config.customUnit === 'years') {
                cutoffDate.setFullYear(cutoffDate.getFullYear() - config.customValue);
            }
            
            return tirages.filter(t => new Date(t.date) >= cutoffDate);
        default:
            return tirages;
    }
}

export interface ComputeStatsOptions {
  /** Période récente R (tirages) pour le calcul des tendances. Utilisé uniquement quand on calcule les stats sur la fenêtre Tendance. */
  trendPeriodRecente?: number;
}

export function computeStatsFromTirages(tirages: Tirage[], options?: ComputeStatsOptions): StatsNumeros {
  const { freqNumeros, freqEtoiles } = calculerFrequencesAbsolues(tirages);
  const freqNumerosNorm = normaliserFrequences(freqNumeros);
  const freqEtoilesNorm = normaliserFrequences(freqEtoiles);
  
  // Note: Absences and Tendances always need context of "recent" vs "total" or just "latest".
  const { absenceNumeros, absenceEtoiles } = calculerAbsences(tirages);
  
  const periodRecente = options?.trendPeriodRecente ?? 65;
  const { tendancesNumeros, tendancesEtoiles } = calculerTendances(tirages, periodRecente);
  
  const categoriesNum = categoriserNumeros(freqNumeros);
  const categoriesEtoiles = categoriserEtoiles(freqEtoiles);

  return {
    freqNumeros,
    freqEtoiles,
    freqNumerosNorm,
    freqEtoilesNorm,
    absenceNumeros,
    absenceEtoiles,
    tendancesNumeros,
    tendancesEtoiles,
    categoriesNum,
    categoriesEtoiles
  };
}

export function calculerFrequencesAbsolues(tirages: Tirage[]) {
  const freqNumeros: Record<number, number> = {};
  const freqEtoiles: Record<number, number> = {};
  
  // Initialiser à 0
  for (let i = 1; i <= 50; i++) freqNumeros[i] = 0;
  for (let i = 1; i <= 12; i++) freqEtoiles[i] = 0;
  
  // Compter
  for (const tirage of tirages) {
    for (const num of tirage.numeros) {
      if (freqNumeros[num] !== undefined) freqNumeros[num]++;
    }
    for (const etoile of tirage.etoiles) {
      if (freqEtoiles[etoile] !== undefined) freqEtoiles[etoile]++;
    }
  }
  
  return { freqNumeros, freqEtoiles };
}

export function normaliserFrequences(frequences: Record<number, number>): Record<number, number> {
  const values = Object.values(frequences);
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  const normalisees: Record<number, number> = {};
  
  for (const [num, freq] of Object.entries(frequences)) {
    // Normalisation min-max sur 0-100
    normalisees[parseInt(num)] = Math.round(((freq - min) / (max - min)) * 100);
  }
  
  return normalisees;
}

export function calculerAbsences(tirages: Tirage[]) {
  // Tirages sont déjà triés par date décroissante
  const absenceNumeros: Record<number, number> = {};
  const absenceEtoiles: Record<number, number> = {};
  
  // Initialiser avec le nombre total de tirages (jamais sorti = max)
  for (let i = 1; i <= 50; i++) absenceNumeros[i] = tirages.length;
  for (let i = 1; i <= 12; i++) absenceEtoiles[i] = tirages.length;
  
  // Parcourir du plus récent au plus ancien
  for (let i = 0; i < tirages.length; i++) {
    const tirage = tirages[i];
    
    for (const num of tirage.numeros) {
      if (absenceNumeros[num] === tirages.length) {
        absenceNumeros[num] = i; // Position = nombre de tirages depuis dernière sortie
      }
    }
    
    for (const etoile of tirage.etoiles) {
      if (absenceEtoiles[etoile] === tirages.length) {
        absenceEtoiles[etoile] = i;
      }
    }
  }
  
  return { absenceNumeros, absenceEtoiles };
}

/**
 * Calcule les tendances (hausse / stable / baisse) par numéro et étoile.
 * @param tirages Fenêtre de tirages (déjà filtrée, ex. les W derniers).
 * @param periodRecente Nombre de tout derniers tirages (R) à comparer à la moyenne sur la fenêtre. Défaut 65.
 */
export function calculerTendances(tirages: Tirage[], periodRecente: number = 65) {
  const R = Math.min(periodRecente, tirages.length) || 1;
  const recent = tirages.slice(0, R);
  const total = tirages;
  
  const { freqNumeros: freqRecenteNum, freqEtoiles: freqRecenteEtoile } = calculerFrequencesAbsolues(recent);
  const { freqNumeros: freqTotaleNum, freqEtoiles: freqTotaleEtoile } = calculerFrequencesAbsolues(total);
  
  const tendancesNumeros: Record<number, { direction: 'hausse' | 'baisse' | 'stable'; score: number }> = {};
  const tendancesEtoiles: Record<number, { direction: 'hausse' | 'baisse' | 'stable'; score: number }> = {};
  
  for (let num = 1; num <= 50; num++) {
    const freqAttendue = total.length > 0 ? (freqTotaleNum[num] / total.length) * R : 0;
    const freqReelle = freqRecenteNum[num] ?? 0;
    const ratio = freqAttendue > 0 ? freqReelle / freqAttendue : 0;
    
    let direction: 'hausse' | 'baisse' | 'stable';
    let score: number;
    if (ratio > 1.2) {
      direction = 'hausse';
      score = Math.min(10, Math.round((ratio - 1) * 10));
    } else if (ratio < 0.8) {
      direction = 'baisse';
      score = Math.max(0, Math.round(ratio * 5));
    } else {
      direction = 'stable';
      score = 5;
    }
    tendancesNumeros[num] = { direction, score };
  }

  for (let num = 1; num <= 12; num++) {
    const freqAttendue = total.length > 0 ? (freqTotaleEtoile[num] / total.length) * R : 0;
    const freqReelle = freqRecenteEtoile[num] ?? 0;
    const ratio = freqAttendue > 0 ? freqReelle / freqAttendue : 0;
    
    let direction: 'hausse' | 'baisse' | 'stable';
    let score: number;
    if (ratio > 1.2) {
      direction = 'hausse';
      score = Math.min(10, Math.round((ratio - 1) * 10));
    } else if (ratio < 0.8) {
      direction = 'baisse';
      score = Math.max(0, Math.round(ratio * 5));
    } else {
      direction = 'stable';
      score = 5;
    }
    tendancesEtoiles[num] = { direction, score };
  }
  
  return { tendancesNumeros, tendancesEtoiles };
}

// CLASSEMENT OFFICIEL PAR FRÉQUENCE (Au 09/12/2025)
// Défini statiquement pour garantir la correspondance exacte avec la méthode de l'utilisateur
const OFFICIAL_RANKING_NUMBERS = [
  23, 42, 44, 19, 29, 21, 50, 17, 10, 25,  // Rangs 1-10
  45, 20, 35, 37, 15, 27, 13,              // Rangs 11-17 (ÉLEVÉE)
  38, 7, 26, 49, 14, 24, 4, 5, 30, 12,     // Rangs 18-27 (MOYENNE)
  34, 39, 11, 48, 3, 16, 6,                // Rangs 28-34 (MOYENNE)
  9, 8, 28, 1, 36, 31, 2, 32, 47, 43,      // Rangs 35-44 (BASSE)
  40, 41, 18, 46, 33, 22                   // Rangs 45-50 (BASSE)
];

export function categoriserNumeros(freqNumeros: Record<number, number>) {
  // DYNAMIC SORTING based on actual frequencies passed
  // This ensures that when we change the period, the categories (High/Mid/Low) 
  // update to reflect the new champions of that period.
  
  const sorted = Object.entries(freqNumeros)
    .map(([num, freq]) => ({ numero: parseInt(num), frequence: freq }))
    .sort((a, b) => {
        if (b.frequence !== a.frequence) return b.frequence - a.frequence;
        return a.numero - b.numero; // Stability fallback
    });

  // Top 17 -> High
  const elevee = sorted.slice(0, 17);
  // Next 17 -> Mid
  const moyenne = sorted.slice(17, 34);
  // Rest -> Low
  const basse = sorted.slice(34, 50);
  
  return {
    elevee,
    moyenne,
    basse,
    depart: [],
  };
}

export function categoriserEtoiles(freqEtoiles: Record<number, number>) {
  // Trier par fréquence décroissante (RAW FREQUENCY)
  const sorted = Object.entries(freqEtoiles)
    .map(([num, freq]) => ({ numero: parseInt(num), frequence: freq }))
    .sort((a, b) => {
        if (b.frequence !== a.frequence) {
            return b.frequence - a.frequence;
        }
        return a.numero - b.numero;
    });
  
  // LOGIQUE DE TRI ÉTOILES (Top 1-4, 5-8, 9-12)
  return {
    elevee: sorted.slice(0, 4),      // Top 4
    moyenne: sorted.slice(4, 8),     // Next 4
    basse: sorted.slice(8, 12),      // Next 4
    depart: [] // Pas de catégorie départ pour les étoiles
  };
}

export async function getStats(): Promise<StatsNumeros> {
  if (cachedStats) return cachedStats;
  
  const tirages = await chargerHistorique();
  cachedStats = computeStatsFromTirages(tirages);
  
  return cachedStats;
}

export function getDernierTirage(tirages: Tirage[]): Tirage | null {
  if (!tirages || tirages.length === 0) return null;
  return tirages[0];
}

export function getProchainTirage(): { date: Date, jour: string } {
  const now = new Date();
  const jourSemaine = getDay(now); // 0=dimanche, 1=lundi, ..., 5=vendredi, 6=samedi
  
  let joursJusquAuProchain: number;
  let jour: string;
  
  // Mardi = 2, Vendredi = 5
  if (jourSemaine < 2) {
    // Dimanche ou Lundi → prochain = Mardi
    joursJusquAuProchain = 2 - jourSemaine;
    jour = 'MARDI';
  } else if (jourSemaine === 2) {
    // Mardi - si c'est le soir après le tirage ? On simplifie : si c'est mardi, c'est aujourd'hui ou mardi prochain
    // On assume ici que c'est le prochain (donc aujourd'hui si avant tirage, mais simplifions)
    // Disons qu'on affiche toujours le futur proche.
    // Si on est mardi, on affiche vendredi (pour l'exemple) ou mardi si on considère le jour même.
    // Prenons la logique simple : 
    joursJusquAuProchain = 0; // C'est aujourd'hui !
    jour = 'MARDI';
  } else if (jourSemaine < 5) {
    // Mercredi, Jeudi → prochain = Vendredi
    joursJusquAuProchain = 5 - jourSemaine;
    jour = 'VENDREDI';
  } else if (jourSemaine === 5) {
    joursJusquAuProchain = 0;
    jour = 'VENDREDI';
  } else {
    // Samedi → prochain = Mardi suivant
    joursJusquAuProchain = (7 - jourSemaine) + 2;
    jour = 'MARDI';
  }
  
  const prochainTirage = addDays(now, joursJusquAuProchain);
  
  // Si c'est aujourd'hui, on vérifie l'heure ? Non, restons simple.
  // Si on veut être strict sur "prochain", si on est mardi soir, le prochain est vendredi.
  // Mais pour l'UI "PROCHAIN TIRAGE", afficher la date d'aujourd'hui est correct le jour du tirage.
  
  return { date: prochainTirage, jour };
}

export async function genererCombinaison(config: {
  nbElevee: number,
  nbMoyenne: number,
  nbBasse: number,
  nbDormeur: number,
  nbEtoilesElevee: number,
  nbEtoilesMoyenne: number,
  nbEtoilesBasse: number,
  nbEtoilesDormeur: number,
  equilibrerPairImpair: boolean,
  equilibrerHautBas: boolean
}) {
  const stats = await getStats();
  
  let numerosSelectionnes: number[] = [];
  let etoilesSelectionnees: number[] = [];
  
  // Mélanger un tableau - SUPPRIMÉ POUR ASSURER L'ORDRE DÉCROISSANT STRICT
  // const shuffle = <T>(array: T[]) => { ... }

  // Sélection SANS MÉLANGE (Ordre décroissant strict)
  
  const poolElevee = stats.categoriesNum.elevee;
  const poolMoyenne = stats.categoriesNum.moyenne;
  const poolBasse = stats.categoriesNum.basse;
  
  numerosSelectionnes.push(...poolElevee.slice(0, config.nbElevee).map(n => n.numero));
  numerosSelectionnes.push(...poolMoyenne.slice(0, config.nbMoyenne).map(n => n.numero));
  numerosSelectionnes.push(...poolBasse.slice(0, config.nbBasse).map(n => n.numero));
  
  // DORMEUR LOGIC (Numbers)
  if (config.nbDormeur > 0) {
    const sortedByAbsence = Object.entries(stats.absenceNumeros)
       .map(([num, abs]) => ({ numero: parseInt(num), absence: abs }))
       .sort((a, b) => b.absence - a.absence); // Descending absence
    
    let added = 0;
    for (const item of sortedByAbsence) {
        if (added >= config.nbDormeur) break;
        if (!numerosSelectionnes.includes(item.numero)) {
            numerosSelectionnes.push(item.numero);
            added++;
        }
    }
  }
  
  const poolEtoilesElevee = stats.categoriesEtoiles.elevee;
  const poolEtoilesMoyenne = stats.categoriesEtoiles.moyenne;
  const poolEtoilesBasse = stats.categoriesEtoiles.basse;

  etoilesSelectionnees.push(...poolEtoilesElevee.slice(0, config.nbEtoilesElevee).map(e => e.numero));
  etoilesSelectionnees.push(...poolEtoilesMoyenne.slice(0, config.nbEtoilesMoyenne).map(e => e.numero));
  etoilesSelectionnees.push(...poolEtoilesBasse.slice(0, config.nbEtoilesBasse).map(e => e.numero));

  // DORMEUR LOGIC (Stars)
  if (config.nbEtoilesDormeur > 0) {
    const sortedByAbsence = Object.entries(stats.absenceEtoiles)
       .map(([num, abs]) => ({ numero: parseInt(num), absence: abs }))
       .sort((a, b) => b.absence - a.absence); // Descending absence
    
    let added = 0;
    for (const item of sortedByAbsence) {
        if (added >= config.nbEtoilesDormeur) break;
        if (!etoilesSelectionnees.includes(item.numero)) {
            etoilesSelectionnees.push(item.numero);
            added++;
        }
    }
  }
  
  // TODO: Implémenter équilibrage si nécessaire (pour l'instant simple sélection)

  return {
    numeros: numerosSelectionnes.sort((a, b) => a - b),
    etoiles: etoilesSelectionnees.sort((a, b) => a - b)
  };
}

// --- GESTION DES GRILLES JOUÉES (Base de données uniquement) ---

export interface PlayedGrid {
  id: string | number; // ID de la DB (number) ou string pour compatibilité
  date: string; // Date de jeu (playedAt)
  numeros: number[];
  etoiles: number[];
  drawDate?: string; // Date du tirage visé (targetDate)
}

export interface PlayedGridWithResult extends PlayedGrid {
  status: 'En attente' | 'Perdu' | 'Gagné';
  gainCents: number | null;
  matchNum?: number;
  matchStar?: number;
  winningGridId?: number;
  drawNumbers?: number[];
  drawStars?: number[];
}

// Sauvegarder une grille directement dans la base de données
export async function saveGridToDB(numeros: number[], etoiles: number[]): Promise<PlayedGrid | null> {
  try {
    const nextDraw = getProchainTirage();
    const targetDate = nextDraw.date.toISOString().split('T')[0]; // Format YYYY-MM-DD

    const response = await fetch('/api/grids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        numbers: numeros,
        stars: etoiles,
        targetDate: targetDate,
      }),
    });

    if (!response.ok) {
      throw new Error('Erreur sauvegarde grille');
    }

    const data = await response.json();

    // Convertir le format DB au format PlayedGrid
    if (!data.grid) {
      return null;
    }
    return {
      id: data.grid.id,
      date: data.grid.playedAt,
      numeros: data.grid.numbers,
      etoiles: data.grid.stars,
      drawDate: data.grid.targetDate ? `${data.grid.targetDate}T00:00:00.000Z` : undefined,
    };
  } catch (e) {
    console.error("Erreur sauvegarde grille DB:", e);
    return null;
  }
}

// Charger toutes les grilles de l'utilisateur depuis la base de données
export async function loadGridsFromDB(): Promise<PlayedGrid[]> {
  console.log('[loadGridsFromDB] ÉTAPE 1: Début de loadGridsFromDB, appel /api/grids...');
  try {
    const response = await fetch('/api/grids', {
      method: 'GET',
      credentials: 'include',
    });
    
    console.log('[loadGridsFromDB] ÉTAPE 2: Réponse reçue, status:', response.status, 'ok:', response.ok);
    
    if (!response.ok) {
      console.error('[loadGridsFromDB] ERREUR: Réponse non OK, status:', response.status);
      throw new Error('Erreur chargement grilles');
    }
    
    const grids = await response.json();
    console.log('[loadGridsFromDB] ÉTAPE 3: Grilles récupérées depuis l\'API, nombre:', grids.length);
    // Convertir le format DB au format PlayedGrid
    const convertedGrids = grids.map((g: any) => ({
      id: g.id,
      date: g.playedAt,
      numeros: g.numbers,
      etoiles: g.stars,
      drawDate: g.targetDate ? `${g.targetDate}T00:00:00.000Z` : undefined,
    }));
    
    console.log('[loadGridsFromDB] ÉTAPE 4: Grilles converties, retour:', convertedGrids.length, 'grilles');
    return convertedGrids;
  } catch (e) {
    console.error("[loadGridsFromDB] ERREUR: Erreur chargement grilles DB:", e);
    console.log("[loadGridsFromDB] ÉTAPE ERREUR: Retour tableau vide");
    return [];
  }
}

// Charger les grilles avec résultats (status, rang, gain, numéros tirés)
export async function loadGridsWithResults(): Promise<PlayedGridWithResult[]> {
  try {
    const response = await fetch('/api/grids/with-results', { method: 'GET', credentials: 'include' });
    if (!response.ok) throw new Error('Erreur chargement grilles');
    const grids = await response.json();
    return grids.map((g: any) => ({
      id: g.id,
      date: g.playedAt,
      numeros: g.numbers ?? [],
      etoiles: g.stars ?? [],
      drawDate: g.targetDate ? `${g.targetDate}T00:00:00.000Z` : undefined,
      status: g.status ?? 'En attente',
      gainCents: g.gainCents ?? null,
      matchNum: g.matchNum,
      matchStar: g.matchStar,
      winningGridId: g.winningGridId,
      drawNumbers: g.drawNumbers,
      drawStars: g.drawStars,
    }));
  } catch (e) {
    console.error('[loadGridsWithResults] Erreur:', e);
    return [];
  }
}

/** Vérifie si l'utilisateur a des gains non vus (badges non cliqués). Utilisé pour la redirection à la connexion. */
export async function hasUnseenWins(): Promise<boolean> {
  try {
    const response = await fetch('/api/wins/me?unseenOnly=true&limit=1', {
      credentials: 'include',
    });
    if (!response.ok) return false;
    const data = await response.json();
    return Array.isArray(data?.rows) && data.rows.length > 0;
  } catch (e) {
    console.error('[hasUnseenWins] Erreur:', e);
    return false;
  }
}

/** (Admin) Vérifie s'il y a des gains d'utilisateurs non vus par l'admin. */
export async function hasAdminUnseenWins(): Promise<boolean> {
  try {
    const response = await fetch('/api/admin/wins/unseen', {
      credentials: 'include',
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data?.hasUnseen === true;
  } catch (e) {
    console.error('[hasAdminUnseenWins] Erreur:', e);
    return false;
  }
}

// Marquer une grille gagnante comme vue (clic sur badge)
export async function ackWinningGrid(winningGridId: number): Promise<boolean> {
  try {
    const response = await fetch('/api/wins/me/ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ids: [winningGridId] }),
    });
    return response.ok;
  } catch (e) {
    console.error('[ackWinningGrid] Erreur:', e);
    return false;
  }
}

// Supprimer une grille de la base de données
export async function deleteGridFromDB(gridId: string | number): Promise<boolean> {
  try {
    const response = await fetch(`/api/grids/${gridId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return response.ok;
  } catch (e) {
    console.error("Erreur suppression grille DB:", e);
    return false;
  }
}

/** Retourne le libellé du rang selon matchNum + matchStar (EuroMillions) */
export function getRankLabel(matchNum: number, matchStar: number): string {
  if (matchNum === 5 && matchStar === 2) return 'Jackpot';
  if (matchNum === 5 && matchStar === 1) return 'Rang 2';
  if (matchNum === 5 && matchStar === 0) return 'Rang 3';
  if (matchNum === 4 && matchStar === 2) return 'Rang 4';
  if (matchNum === 4 && matchStar === 1) return 'Rang 5';
  if (matchNum === 3 && matchStar === 2) return 'Rang 6';
  if (matchNum === 4 && matchStar === 0) return 'Rang 7';
  if (matchNum === 2 && matchStar === 2) return 'Rang 8';
  if (matchNum === 3 && matchStar === 1) return 'Rang 9';
  if (matchNum === 3 && matchStar === 0) return 'Rang 10';
  if (matchNum === 1 && matchStar === 2) return 'Rang 11';
  if (matchNum === 2 && matchStar === 1) return 'Rang 12';
  if (matchNum === 2 && matchStar === 0) return 'Rang 13';
  return '';
}

export function checkGridResult(grid: PlayedGrid, lastDraw: Tirage | null): { status: string, gain: number, matchNum: number, matchStar: number } {
  if (!lastDraw) return { status: 'En attente', gain: 0, matchNum: 0, matchStar: 0 };
  
  // Check if the grid was for a future draw relative to the last known draw
  // But since we are mocking, let's just compare with the LAST draw if the dates are close,
  // or if the user wants "Realism", we should only check if the draw date matches the last draw date.
  
  // For this prototype: 
  // If grid.drawDate matches lastDraw.date -> Compare
  // If grid.drawDate is after lastDraw.date -> En attente
  // If grid.drawDate is before lastDraw.date -> Find that specific draw in history? (Too complex for now, just compare with lastDraw for demo purposes if dates match roughly)
  
  // Vérifier si grid.drawDate existe et est valide
  if (!grid.drawDate) {
    // Si pas de date de tirage, considérer comme en attente
    return { status: 'En attente', gain: 0, matchNum: 0, matchStar: 0 };
  }
  
  const gridDrawDate = new Date(grid.drawDate);
  const lastDrawDate = new Date(lastDraw.date);
  
  // Vérifier si les dates sont valides
  if (isNaN(gridDrawDate.getTime())) {
    console.warn('[checkGridResult] Date invalide pour la grille:', grid.drawDate, grid.id);
    return { status: 'En attente', gain: 0, matchNum: 0, matchStar: 0 };
  }
  
  if (isNaN(lastDrawDate.getTime())) {
    console.warn('[checkGridResult] Date invalide pour le dernier tirage:', lastDraw.date);
    return { status: 'En attente', gain: 0, matchNum: 0, matchStar: 0 };
  }
  
  // Normalize dates to YYYY-MM-DD for comparison
  const gridDateStr = gridDrawDate.toISOString().split('T')[0];
  const lastDrawDateStr = lastDrawDate.toISOString().split('T')[0];
  
  // If the grid is for a future draw compared to our data
  if (gridDrawDate > lastDrawDate && gridDateStr !== lastDrawDateStr) {
     return { status: 'En attente', gain: 0, matchNum: 0, matchStar: 0 };
  }

  // Calculate matches
  const matchNum = grid.numeros.filter(n => lastDraw.numeros.includes(n)).length;
  const matchStar = grid.etoiles.filter(n => lastDraw.etoiles.includes(n)).length;
  
  let status = 'Perdu';
  let gain = 0;
  
  // Simple Euromillions rules (simplified)
  if (matchNum === 5 && matchStar === 2) { status = 'JACKPOT !'; gain = 17000000; }
  else if (matchNum === 5 && matchStar === 1) { status = 'Gagné (Rang 2)'; gain = 200000; }
  else if (matchNum === 5 && matchStar === 0) { status = 'Gagné (Rang 3)'; gain = 30000; }
  else if (matchNum === 4 && matchStar === 2) { status = 'Gagné (Rang 4)'; gain = 2000; }
  else if (matchNum === 4 && matchStar === 1) { status = 'Gagné (Rang 5)'; gain = 120; }
  else if (matchNum === 3 && matchStar === 2) { status = 'Gagné (Rang 6)'; gain = 80; }
  else if (matchNum === 4 && matchStar === 0) { status = 'Gagné (Rang 7)'; gain = 50; }
  else if (matchNum === 2 && matchStar === 2) { status = 'Gagné (Rang 8)'; gain = 15; }
  else if (matchNum === 3 && matchStar === 1) { status = 'Gagné (Rang 9)'; gain = 12; }
  else if (matchNum === 3 && matchStar === 0) { status = 'Gagné (Rang 10)'; gain = 10; }
  else if (matchNum === 1 && matchStar === 2) { status = 'Gagné (Rang 11)'; gain = 8; }
  else if (matchNum === 2 && matchStar === 1) { status = 'Gagné (Rang 12)'; gain = 6; }
  else if (matchNum === 2 && matchStar === 0) { status = 'Gagné (Rang 13)'; gain = 4; }
  
  return { status, gain, matchNum, matchStar };
}
