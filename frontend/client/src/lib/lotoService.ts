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

export interface AppointmentStat {
  appointmentId: number; // WW-D (ex: 101, 522)
  week: number;
  day: 1 | 2; // 1: Mardi, 2: Vendredi
  count: number;
  frequency: number; // normalized or percentage
}

export interface NumberAppointmentProfile {
  numero: number;
  appointments: Record<number, AppointmentStat>;
  top3: AppointmentStat[];
  fidelityScore: number;
}

export interface StarAppointmentProfile {
  etoile: number;
  appointments: Record<number, AppointmentStat>;
  top3: AppointmentStat[];
  fidelityScore: number;
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
  if (!config || !config.type) return tirages; // Protection contre object manquant (ex: au boot localStorage)

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
      // Ajustement : Hausse doit être > Stable (5). Donc min 6, max 10.
      // On décale le score : (ratio-1)*10 commence vers 2 (pour 1.2). On ajoute 4 => 6.
      score = Math.min(10, Math.max(6, Math.round((ratio - 1) * 10) + 4));
    } else if (ratio < 0.8) {
      direction = 'baisse';
      // Baisse : de 0 à 4 (Strictement < 5)
      score = Math.min(4, Math.max(0, Math.round(ratio * 5)));
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
      // Ajustement : Hausse doit être > Stable (5). Donc min 6, max 10.
      score = Math.min(10, Math.max(6, Math.round((ratio - 1) * 10) + 4));
    } else if (ratio < 0.8) {
      direction = 'baisse';
      score = Math.min(4, Math.max(0, Math.round(ratio * 5)));
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
  blockchain?: string;
}

// Sauvegarder une grille directement dans la base de données
export async function saveGridToDB(numeros: number[], etoiles: number[], blockchain?: string): Promise<PlayedGrid | null> {
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
        blockchain: blockchain,
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
      blockchain: g.blockchain,
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

/**
 * Retourne l'ID de rendez-vous (AppointmentID) pour une date donnée.
 * Format: WW-D (ex: 101 pour semaine 1 mardi, 522 pour semaine 52 vendredi).
 */
import { getISOWeek } from 'date-fns';

export function getAppointmentId(date: Date | string): number {
  const d = typeof date === 'string' ? parseISO(date.includes('T') ? date : `${date}T00:00:00Z`) : date;
  if (isNaN(d.getTime())) return 0;

  const week = getISOWeek(d);
  const dayOfWeek = getDay(d); // 0: Dimanche, 2: Mardi, 5: Vendredi
  const dayId = (dayOfWeek === 2) ? 1 : (dayOfWeek === 5) ? 2 : 0;

  return (week * 10) + dayId;
}

/**
 * Calcule le profil des rendez-vous pour tous les numéros et étoiles basés sur l'historique complet.
 */
export async function computeAllAppointments(): Promise<{
  numbers: Record<number, NumberAppointmentProfile>;
  stars: Record<number, StarAppointmentProfile>;
}> {
  const tirages = await chargerHistorique();
  const numberProfiles: Record<number, NumberAppointmentProfile> = {};
  const starProfiles: Record<number, StarAppointmentProfile> = {};

  // Initialiser les profils pour les 50 numéros
  for (let n = 1; n <= 50; n++) {
    numberProfiles[n] = {
      numero: n,
      appointments: {},
      top3: [],
      fidelityScore: 0
    };
    for (let w = 1; w <= 52; w++) {
      for (let d of [1, 2] as const) {
        const id = w * 10 + d;
        numberProfiles[n].appointments[id] = { appointmentId: id, week: w, day: d, count: 0, frequency: 0 };
      }
    }
  }

  // Initialiser les profils pour les 12 étoiles
  for (let s = 1; s <= 12; s++) {
    starProfiles[s] = {
      etoile: s,
      appointments: {},
      top3: [],
      fidelityScore: 0
    };
    for (let w = 1; w <= 52; w++) {
      for (let d of [1, 2] as const) {
        const id = w * 10 + d;
        starProfiles[s].appointments[id] = { appointmentId: id, week: w, day: d, count: 0, frequency: 0 };
      }
    }
  }

  const slotTotals: Record<number, number> = {};
  for (let w = 1; w <= 52; w++) {
    for (let d of [1, 2]) {
      slotTotals[w * 10 + d] = 0;
    }
  }

  for (const t of tirages) {
    const aid = getAppointmentId(t.date);
    if (aid <= 0 || aid % 10 === 0) continue;

    if (slotTotals[aid] !== undefined) {
      slotTotals[aid]++;
    }

    for (const num of t.numeros) {
      if (numberProfiles[num] && numberProfiles[num].appointments[aid]) {
        numberProfiles[num].appointments[aid].count++;
      }
    }
    for (const star of t.etoiles) {
      if (starProfiles[star] && starProfiles[star].appointments[aid]) {
        starProfiles[star].appointments[aid].count++;
      }
    }
  }

  // Calculer fréquences et Top 3 pour numéros
  for (let n = 1; n <= 50; n++) {
    const p = numberProfiles[n];
    const allSlots = Object.values(p.appointments);
    for (const slot of allSlots) {
      const total = slotTotals[slot.appointmentId] || 1;
      slot.frequency = (slot.count / total) * 100;
    }
    p.top3 = [...allSlots].sort((a, b) => b.frequency - a.frequency).slice(0, 3);
    const avg = allSlots.reduce((acc, s) => acc + s.frequency, 0) / 104;
    p.fidelityScore = Math.round((p.top3[0]?.frequency || 0) / (avg || 1) * 10);
  }

  // Calculer fréquences et Top 3 pour étoiles
  for (let s = 1; s <= 12; s++) {
    const p = starProfiles[s];
    const allSlots = Object.values(p.appointments);
    for (const slot of allSlots) {
      const total = slotTotals[slot.appointmentId] || 1;
      slot.frequency = (slot.count / total) * 100;
    }
    p.top3 = [...allSlots].sort((a, b) => b.frequency - a.frequency).slice(0, 3);
    const avg = allSlots.reduce((acc, s) => acc + s.frequency, 0) / 104;
    p.fidelityScore = Math.round((p.top3[0]?.frequency || 0) / (avg || 1) * 10);
  }

  return { numbers: numberProfiles, stars: starProfiles };
}

/**
 * Retourne les numéros et étoiles les plus fidèles pour un ID de rendez-vous précis.
 */
export function getFaithfulForRDV(
  aid: number,
  profiles: { numbers: Record<number, NumberAppointmentProfile>, stars: Record<number, StarAppointmentProfile> }
) {
  const topNumbers = Object.values(profiles.numbers)
    .map(p => ({
      numero: p.numero,
      frequency: p.appointments[aid]?.frequency || 0,
      count: p.appointments[aid]?.count || 0
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);

  const topStars = Object.values(profiles.stars)
    .map(p => ({
      etoile: p.etoile,
      frequency: p.appointments[aid]?.frequency || 0,
      count: p.appointments[aid]?.count || 0
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 8);

  return { topNumbers, topStars };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ███  MOTEUR NEXUS — Formule Absolue (7 critères + filtres structurels)  ███
// ═══════════════════════════════════════════════════════════════════════════════

// --- Tables issues de l'analyse sur 1911 tirages EuroMillions (2004-2026) ---
const NEXUS_QUARTET: Record<number, number> = {
  44: 52, 48: 48, 42: 44, 7: 44, 16: 42, 4: 42, 45: 40, 27: 40, 38: 40, 24: 38
};

const NEXUS_SYMBIOSE: Record<number, number> = {
  32: 23, 23: 32, 24: 26, 26: 24, 10: 3, 40: 2
};

const NEXUS_TANDEM_ETOILE: Record<number, number> = {
  24: 5, 8: 9, 31: 2, 47: 9, 40: 2, 10: 3, 16: 2, 38: 2
};

const NEXUS_SEASON_FAVORITES: Record<string, number[]> = {
  'Hiver': [44, 25, 30],
  'Printemps': [26, 24, 23],
  'Été': [42, 7, 15],
  'Automne': [42, 29, 21]
};

// --- Types NEXUS ---

export interface NexusCritere {
  type: 'compensation' | 'saison' | 'composite' | 'symbiose' | 'tandem' | 'quartet' | 'anguleux' | 'rdv';
  label: string;
  detail: string;
  score: number;
}

export interface NexusNumberScore {
  numero: number;
  scoreTotal: number;
  criteres: NexusCritere[];
  sCompensation: number;
  sSaison: number;
  sComposite: number;
  sSymbiose: number;
  sTandem: number;
  sQuartet: number;
  sAnguleux: number;
}

export interface NexusGeneseLine {
  position: string;
  numero: number;
  isEtoile: boolean;
  isAncre: boolean;
  raison: string;
  scorePartiel: number;
  criteres: NexusCritere[];
}

export interface NexusCombo {
  numeros: number[];
  etoiles: number[];
  scoreTotal: number;
  scoreRaw: number;
  somme: number;
  parite: { pairs: number; impairs: number };
  hautBas: { hauts: number; bas: number };
  hasSymbiose: boolean;
  hasConsecutive: boolean;
  ancresIncluses: number[];
  signature: string;
  genese: NexusGeneseLine[];
  mode: 'nexus' | 'roue-complete' | 'roue-abregee' | 'manuel';
  modeDetail: string;
  saison: string;
  dateGeneration: string;
}

export interface NexusState {
  combos: NexusCombo[];
  currentIndex: number;
  ancresNumeros: number[];
  ancresEtoiles: number[];
  saison: string;
  generatedAt: string;
}

// --- Fonctions utilitaires NEXUS ---

function nexusGetSaison(date: Date): string {
  const m = date.getMonth() + 1;
  if (m === 12 || m === 1 || m === 2) return 'Hiver';
  if (m >= 3 && m <= 5) return 'Printemps';
  if (m >= 6 && m <= 8) return 'Été';
  return 'Automne';
}

function nexusIsAnguleux(n: number): boolean {
  return String(n).split('').some(d => ['1', '4', '7'].includes(d));
}

function nexusCombinations(arr: number[], k: number): number[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  return [
    ...nexusCombinations(rest, k - 1).map(c => [first, ...c]),
    ...nexusCombinations(rest, k)
  ];
}

export function verifierFiltresStructurels(nums: number[]): {
  ok: boolean;
  somme: number;
  pairs: number;
  impairs: number;
  hauts: number;
  bas: number;
  hasConsecutive: boolean;
} {
  const sorted = [...nums].sort((a, b) => a - b);
  const somme = sorted.reduce((a, b) => a + b, 0);
  const pairs = sorted.filter(n => n % 2 === 0).length;
  const impairs = 5 - pairs;
  const hauts = sorted.filter(n => n > 25).length;
  const bas = 5 - hauts;
  const hasConsecutive = sorted.some((n, i) => i > 0 && n === sorted[i - 1] + 1);

  const okSomme = somme >= 98 && somme <= 157;
  const okParite = !(pairs === 5 || impairs === 5);
  const okHautBas = !(hauts === 5 || bas === 5);

  return { ok: okSomme && okParite && okHautBas, somme, pairs, impairs, hauts, bas, hasConsecutive };
}

interface NexusPrecomputed {
  recentFreq: Record<number, number>;
  maxRecentFreq: number;
  saisonFreq: Record<number, number>;
  maxSaisonFreq: number;
  absence: Record<number, number>;
  saisonCount: number;
}

function nexusPrecompute(tirages: Tirage[], saison: string): NexusPrecomputed {
  const recent50 = tirages.slice(0, 50);
  const recentFreq: Record<number, number> = {};
  for (let n = 1; n <= 50; n++) recentFreq[n] = 0;
  for (const t of recent50) for (const n of t.numeros) recentFreq[n]++;
  const maxRecentFreq = Math.max(1, ...Object.values(recentFreq));

  const saisonTirages = tirages.filter(t => nexusGetSaison(new Date(t.date)) === saison);
  const saisonFreq: Record<number, number> = {};
  for (let n = 1; n <= 50; n++) saisonFreq[n] = 0;
  for (const t of saisonTirages) for (const n of t.numeros) saisonFreq[n]++;
  const maxSaisonFreq = Math.max(1, ...Object.values(saisonFreq));

  const absence: Record<number, number> = {};
  for (let n = 1; n <= 50; n++) absence[n] = tirages.length;
  for (let i = 0; i < tirages.length; i++) {
    for (const n of tirages[i].numeros) {
      if (absence[n] === tirages.length) absence[n] = i;
    }
  }

  return { recentFreq, maxRecentFreq, saisonFreq, maxSaisonFreq, absence, saisonCount: saisonTirages.length };
}

function nexusScoreNumber(
  n: number,
  pre: NexusPrecomputed,
  saison: string,
  rdvFreqRatio: number
): NexusNumberScore {
  const criteres: NexusCritere[] = [];
  const cycleMoyen = 37;

  // 1. Pression de Compensation — poids 20
  const absDraws = pre.absence[n] ?? 0;
  const pressure = Math.min(absDraws / cycleMoyen, 3) / 3;
  const sCompensation = pressure * 20;
  if (absDraws > cycleMoyen * 1.5) {
    const niveau = absDraws > cycleMoyen * 2.5 ? 'MAXIMALE' : absDraws > cycleMoyen * 2 ? 'HAUTE' : 'ÉLEVÉE';
    criteres.push({
      type: 'compensation',
      label: `💤 Dormeur ${absDraws}t`,
      detail: `Absent depuis ${absDraws} tirages. Cycle moyen ${cycleMoyen}t. Pression : ${niveau}.`,
      score: Math.round(sCompensation)
    });
  }

  // 2. Performance Saisonnière — poids 25
  const sSaison = (pre.saisonFreq[n] / pre.maxSaisonFreq) * 25;
  if ((NEXUS_SEASON_FAVORITES[saison] || []).includes(n)) {
    const pct = pre.saisonCount > 0 ? Math.round((pre.saisonFreq[n] / pre.saisonCount) * 100) : 0;
    criteres.push({
      type: 'saison',
      label: `🌿 Star ${saison}`,
      detail: `Sort dans ${pct}% des tirages d'${saison}. Signal confirmé sur ${pre.saisonCount} tirages de saison.`,
      score: Math.round(sSaison)
    });
  }

  // 3. Score Composite (fréquence récente + RDV) — poids 20
  const recentRatio = pre.recentFreq[n] / pre.maxRecentFreq;
  const sComposite = (recentRatio * 0.6 + rdvFreqRatio * 0.4) * 20;
  if (rdvFreqRatio > 0.15) {
    criteres.push({
      type: 'rdv',
      label: `📅 RDV fort ${Math.round(rdvFreqRatio * 100)}%`,
      detail: `Sort dans ${Math.round(rdvFreqRatio * 100)}% des tirages de ce créneau (semaine/jour).`,
      score: Math.round(rdvFreqRatio * 20)
    });
  }

  // 4. Symbiose — poids 10
  let sSymbiose = 0;
  if (NEXUS_SYMBIOSE[n] !== undefined) {
    sSymbiose = 10;
    criteres.push({
      type: 'symbiose',
      label: `🤝 Symbiose→${NEXUS_SYMBIOSE[n]}`,
      detail: `Le n°${n} sort avec le n°${NEXUS_SYMBIOSE[n]} dans 15%+ des cas. Écart +86% au-dessus du hasard.`,
      score: 10
    });
  }

  // 5. Tandem Étoile — poids 5
  let sTandem = 0;
  if (NEXUS_TANDEM_ETOILE[n] !== undefined) {
    sTandem = 5;
    criteres.push({
      type: 'tandem',
      label: `⭐ Tandem→⭐${NEXUS_TANDEM_ETOILE[n]}`,
      detail: `Quand le n°${n} sort, l'étoile ${NEXUS_TANDEM_ETOILE[n]} est présente dans ~25% des cas vs 16.7% attendu.`,
      score: 5
    });
  }

  // 6. Quartet Sociable — poids 5
  let sQuartet = 0;
  if (NEXUS_QUARTET[n] !== undefined) {
    const q = NEXUS_QUARTET[n];
    sQuartet = (q / 52) * 5;
    criteres.push({
      type: 'quartet',
      label: `👥 Quartet(${q}pts)`,
      detail: `Apparaît dans ${q} groupes de 4 numéros récurrents — clustering non-aléatoire confirmé.`,
      score: Math.round(sQuartet)
    });
  }

  // 7. Morphologie Anguleux — poids 3
  let sAnguleux = 0;
  if (nexusIsAnguleux(n)) {
    sAnguleux = 3;
    criteres.push({
      type: 'anguleux',
      label: `📐 Anguleux`,
      detail: `Les numéros à géométrie angulaire (1,4,7) dominent : 42.8% des tirés vs 33.3% attendu.`,
      score: 3
    });
  }

  const scoreTotal = Math.min(100, sCompensation + sSaison + sComposite + sSymbiose + sTandem + sQuartet + sAnguleux);

  return { numero: n, scoreTotal, criteres, sCompensation, sSaison, sComposite, sSymbiose, sTandem, sQuartet, sAnguleux };
}

function nexusBuildGenese(
  numeros: number[],
  etoiles: number[],
  scores: Record<number, NexusNumberScore>,
  ancresNum: number[],
  ancresEtoiles: number[],
  saison: string,
  symbolique: string
): NexusGeneseLine[] {
  const lines: NexusGeneseLine[] = [];
  const sortedNums = [...numeros].sort((a, b) => a - b);

  sortedNums.forEach((n, idx) => {
    const isAncre = ancresNum.includes(n);
    const scoreData = scores[n];
    const raisons: string[] = [];

    if (isAncre) raisons.push(`🔴 Ancre ${symbolique}`);
    if (scoreData) scoreData.criteres.forEach(c => raisons.push(c.label));

    const posInSorted = sortedNums.indexOf(n);
    if (posInSorted > 0 && sortedNums[posInSorted] === sortedNums[posInSorted - 1] + 1) {
      raisons.push(`✨ paire consécutive ${sortedNums[posInSorted - 1]}-${n}`);
    }

    lines.push({
      position: `Numéro ${idx + 1}`,
      numero: n,
      isEtoile: false,
      isAncre,
      raison: raisons.join(' · ') || 'Score composite élevé',
      scorePartiel: scoreData?.scoreTotal ?? 0,
      criteres: scoreData?.criteres ?? []
    });
  });

  etoiles.forEach((e, idx) => {
    const isAncre = ancresEtoiles.includes(e);
    const raisons: string[] = [];
    if (isAncre) raisons.push(`🔴 Ancre étoile ${symbolique}`);

    const activeTandems = Object.entries(NEXUS_TANDEM_ETOILE)
      .filter(([, star]) => star === e)
      .map(([n]) => parseInt(n))
      .filter(n => numeros.includes(n));
    if (activeTandems.length > 0) {
      raisons.push(`⭐ Tandem avec ${activeTandems.map(n => `n°${n}`).join(', ')} confirmé ✅`);
    }
    if (e === 2) raisons.push('Étoile dominante 19.9% toutes saisons');
    if (e === 5) raisons.push('Étoile dominante 18.7% toutes saisons');

    lines.push({
      position: `Étoile ${idx + 1}`,
      numero: e,
      isEtoile: true,
      isAncre,
      raison: raisons.join(' · ') || `Étoile saisonnière ${saison}`,
      scorePartiel: 0,
      criteres: []
    });
  });

  return lines;
}

/**
 * MOTEUR PRINCIPAL NEXUS
 * Génère jusqu'à maxCombos combinaisons optimales avec ancres (0 à 3 numéros ou étoiles).
 * Optimise : minimum de tirages, maximum de score par tirage.
 */
export async function genererCombosNexus(
  ancresNumeros: number[] = [],
  ancresEtoiles: number[] = [],
  targetDate: Date = new Date(),
  maxCombos: number = 20
): Promise<NexusCombo[]> {
  const tirages = await chargerHistorique();
  if (!tirages || tirages.length === 0) return [];

  const saison = nexusGetSaison(targetDate);
  const rdvAid = getAppointmentId(targetDate);
  const dayOfWeek = targetDate.getDay();
  const symbolique = dayOfWeek === 2 ? 'Mardi' : dayOfWeek === 5 ? 'Vendredi' : 'Tirage';

  const pre = nexusPrecompute(tirages, saison);

  // Load RDV appointments for scoring
  let appointments: { numbers: Record<number, NumberAppointmentProfile>; stars: Record<number, StarAppointmentProfile> } | null = null;
  try {
    appointments = await computeAllAppointments();
  } catch {
    console.warn('[NEXUS] Appointments unavailable');
  }

  // Score all 50 numbers
  const scores: Record<number, NexusNumberScore> = {};
  for (let n = 1; n <= 50; n++) {
    const rdvFreqRatio = appointments?.numbers[n]?.appointments[rdvAid]
      ? appointments.numbers[n].appointments[rdvAid].frequency / 100
      : 0;
    scores[n] = nexusScoreNumber(n, pre, saison, rdvFreqRatio);
  }

  // Rank and select top candidates (always include anchors first)
  const ranked = Object.values(scores).sort((a, b) => b.scoreTotal - a.scoreTotal);
  const candidateSet = new Set<number>(ancresNumeros);
  for (const s of ranked) {
    if (candidateSet.size >= 20) break;
    candidateSet.add(s.numero);
  }
  const candidates = Array.from(candidateSet);

  // Star votes
  const starVotes: Record<number, number> = {};
  for (let s = 1; s <= 12; s++) starVotes[s] = 0;
  starVotes[2] += 2; starVotes[5] += 2;
  if (saison === 'Hiver') starVotes[9] += 1;
  for (const n of candidates.slice(0, 10)) {
    if (NEXUS_TANDEM_ETOILE[n]) starVotes[NEXUS_TANDEM_ETOILE[n]] += 2;
  }
  for (const e of ancresEtoiles) starVotes[e] += 100;

  const sortedStarPool = Object.entries(starVotes)
    .sort(([, a], [, b]) => b - a)
    .map(([s]) => parseInt(s));

  const etoilesFinal: number[] = [...ancresEtoiles];
  for (const s of sortedStarPool) {
    if (etoilesFinal.length >= 2) break;
    if (!etoilesFinal.includes(s)) etoilesFinal.push(s);
  }

  // Generate combinations
  const freePool = candidates.filter(n => !ancresNumeros.includes(n)).slice(0, 15);
  const freeSlots = 5 - ancresNumeros.length;
  const freeCombos = nexusCombinations(freePool, freeSlots);

  const results: NexusCombo[] = [];

  for (const freeNums of freeCombos) {
    const nums = [...ancresNumeros, ...freeNums].sort((a, b) => a - b);
    const check = verifierFiltresStructurels(nums);
    if (!check.ok) continue;

    const comboScore = nums.reduce((sum, n) => sum + scores[n].scoreTotal, 0);
    const hasSymbiose = nums.some(n => NEXUS_SYMBIOSE[n] !== undefined && nums.includes(NEXUS_SYMBIOSE[n]));

    const critTypes = new Set<string>();
    nums.forEach(n => scores[n].criteres.forEach(c => critTypes.add(c.type)));
    const scoreFinal = comboScore + critTypes.size * 5 + (hasSymbiose ? 10 : 0) + (check.hasConsecutive ? 3 : 0);

    const scoreNorm = Math.min(100, Math.round((scoreFinal / (5 * 100 + 50)) * 100));
    const ancresIncluses = [
      ...ancresNumeros.filter(a => nums.includes(a)),
      ...ancresEtoiles.filter(a => etoilesFinal.includes(a))
    ];

    const signatureParts = ['NEXUS', saison];
    if (hasSymbiose) signatureParts.push('Symbiose');
    if (ancresIncluses.length > 0) signatureParts.push(`${ancresIncluses.length} ancre(s)`);
    signatureParts.push(`${scoreNorm}/100`);
    const signature = signatureParts.join(' | ');

    const genese = nexusBuildGenese(nums, etoilesFinal, scores, ancresNumeros, ancresEtoiles, saison, symbolique);

    results.push({
      numeros: nums,
      etoiles: [...etoilesFinal].sort((a, b) => a - b),
      scoreTotal: scoreNorm,
      scoreRaw: scoreFinal,
      somme: check.somme,
      parite: { pairs: check.pairs, impairs: check.impairs },
      hautBas: { hauts: check.hauts, bas: check.bas },
      hasSymbiose,
      hasConsecutive: check.hasConsecutive,
      ancresIncluses,
      signature,
      genese,
      mode: 'nexus',
      modeDetail: `NEXUS — ${saison}${ancresIncluses.length > 0 ? ' · ' + ancresIncluses.length + ' ancre(s)' : ''}`,
      saison,
      dateGeneration: targetDate.toISOString()
    });

    if (results.length >= maxCombos * 3) break;
  }

  results.sort((a, b) => b.scoreRaw - a.scoreRaw);
  return results.slice(0, maxCombos);
}

/**
 * Génère des combos en Roue (Complète ou Abrégée) à partir d'un vivier de N numéros.
 */
export function genererCombosRoue(
  vivier: number[],
  etoiles: number[],
  mode: 'complete' | 'abregee',
  targetDate: Date = new Date()
): NexusCombo[] {
  const saison = nexusGetSaison(targetDate);
  const allCombos = nexusCombinations(vivier, 5);

  let combosNums: number[][];
  if (mode === 'complete') {
    combosNums = allCombos;
  } else {
    // Abrégée : garder ~60% des combos en sautant régulièrement
    const step = Math.max(1, Math.ceil(allCombos.length / Math.ceil(allCombos.length * 0.6)));
    combosNums = allCombos.filter((_, i) => i % step !== 0);
    if (combosNums.length === 0) combosNums = allCombos;
  }

  const etoilesSorted = [...etoiles].sort((a, b) => a - b);

  return combosNums.map((nums, idx) => {
    const sorted = [...nums].sort((a, b) => a - b);
    const somme = sorted.reduce((a, b) => a + b, 0);
    const pairs = sorted.filter(n => n % 2 === 0).length;
    const hauts = sorted.filter(n => n > 25).length;
    const hasConsecutive = sorted.some((n, i) => i > 0 && n === sorted[i - 1] + 1);
    const modeLabel = mode === 'complete' ? 'Complète' : 'Abrégée';

    const genese: NexusGeneseLine[] = [
      ...sorted.map((n, i) => ({
        position: `Numéro ${i + 1}`,
        numero: n,
        isEtoile: false,
        isAncre: false,
        raison: `Roue ${modeLabel} — Vivier ${vivier.length} numéros`,
        scorePartiel: 0,
        criteres: [] as NexusCritere[]
      })),
      ...etoilesSorted.map((e, i) => ({
        position: `Étoile ${i + 1}`,
        numero: e,
        isEtoile: true,
        isAncre: false,
        raison: 'Étoile sélectionnée manuellement',
        scorePartiel: 0,
        criteres: [] as NexusCritere[]
      }))
    ];

    return {
      numeros: sorted,
      etoiles: etoilesSorted,
      scoreTotal: 0,
      scoreRaw: idx,
      somme,
      parite: { pairs, impairs: 5 - pairs },
      hautBas: { hauts, bas: 5 - hauts },
      hasSymbiose: false,
      hasConsecutive,
      ancresIncluses: [],
      signature: `Roue ${modeLabel} | Vivier=${vivier.length} | ${combosNums.length} tickets | ${(combosNums.length * 2.5).toFixed(2)}€`,
      genese,
      mode: mode === 'complete' ? 'roue-complete' : 'roue-abregee',
      modeDetail: `Roue ${modeLabel} — ${vivier.length} numéros — ${combosNums.length} combinaisons`,
      saison,
      dateGeneration: targetDate.toISOString()
    } as NexusCombo;
  });
}

// --- Cache NEXUS ---
const NEXUS_CACHE_KEY = 'nexus_combos_cache';
const NEXUS_CACHE_TS_KEY = 'nexus_cache_timestamp';

export function saveNexusCache(state: NexusState): void {
  try {
    localStorage.setItem(NEXUS_CACHE_KEY, JSON.stringify(state));
    localStorage.setItem(NEXUS_CACHE_TS_KEY, new Date().toISOString());
    console.log('[NEXUS] Cache sauvegardé :', state.combos.length, 'combos');
  } catch (e) {
    console.warn('[NEXUS] Cache save failed:', e);
  }
}

export function loadNexusCache(): NexusState | null {
  try {
    const raw = localStorage.getItem(NEXUS_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as NexusState;
  } catch {
    return null;
  }
}

export function clearNexusCache(): void {
  try {
    localStorage.removeItem(NEXUS_CACHE_KEY);
    localStorage.removeItem(NEXUS_CACHE_TS_KEY);
  } catch {/* ignore */ }
}

/**
 * Retourne le top N numéros par critère spécifique — utilisé pour les ancres "smart" (Forbo/RDV/Trend)
 */
export async function getTopNexusAnchors(
  type: 'highfreq' | 'rdv' | 'trend',
  targetDate: Date = new Date(),
  n: number = 1
): Promise<number[]> {
  const tirages = await chargerHistorique();
  if (!tirages || tirages.length === 0) return [];

  const saison = nexusGetSaison(targetDate);
  const rdvAid = getAppointmentId(targetDate);

  if (type === 'highfreq') {
    const pre = nexusPrecompute(tirages, saison);
    return Object.entries(pre.recentFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, n)
      .map(([num]) => parseInt(num));
  }

  if (type === 'rdv') {
    let appointments: { numbers: Record<number, NumberAppointmentProfile>; stars: Record<number, StarAppointmentProfile> } | null = null;
    try { appointments = await computeAllAppointments(); } catch { return []; }
    if (!appointments) return [];
    return Object.entries(appointments.numbers)
      .map(([num, p]) => ({ num: parseInt(num), freq: p.appointments[rdvAid]?.frequency ?? 0 }))
      .sort((a, b) => b.freq - a.freq)
      .slice(0, n)
      .map(e => e.num);
  }

  if (type === 'trend') {
    const { tendancesNumeros } = calculerTendances(tirages, 65);
    return Object.entries(tendancesNumeros)
      .filter(([, t]) => t.direction === 'hausse')
      .sort(([, a], [, b]) => b.score - a.score)
      .slice(0, n)
      .map(([num]) => parseInt(num));
  }

  return [];
}

