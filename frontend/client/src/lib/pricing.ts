
// Combinaisons C(n,5) pour les numéros
export const COMBINAISONS_NUMEROS: Record<number, number> = {
  5: 1,
  6: 6,
  7: 21,
  8: 56,
  9: 126,
  10: 252
};

// Combinaisons C(e,2) pour les étoiles
export const COMBINAISONS_ETOILES: Record<number, number> = {
  2: 1,
  3: 3,
  4: 6,
  5: 10,
  6: 15,
  7: 21,
  8: 28,
  9: 36,
  10: 45,
  11: 55,
  12: 66
};

// Grille tarifaire complète (en euros)
// [nbNumeros][nbEtoiles] = prix
export const GRILLE_TARIFAIRE: Record<number, Record<number, number>> = {
  5: { 2: 2.50, 3: 7.50, 4: 15, 5: 25, 6: 37.50, 7: 52.50, 8: 70, 9: 90, 10: 112.50, 11: 137.50, 12: 165 },
  6: { 2: 15, 3: 45, 4: 90, 5: 150, 6: 225, 7: 315, 8: 420, 9: 540, 10: 675, 11: 825, 12: 990 },
  7: { 2: 52.50, 3: 157.50, 4: 315, 5: 525, 6: 787.50 },
  8: { 2: 140, 3: 420, 4: 840 },
  9: { 2: 315, 3: 945 },
  10: { 2: 630 }
};

export const COMBINAISONS_AUTORISEES: Record<number, { min: number, max: number }> = {
  // nbNumeros: { min_etoiles, max_etoiles }
  5: { min: 2, max: 12 },
  6: { min: 2, max: 12 },
  7: { min: 2, max: 6 },
  8: { min: 2, max: 4 },
  9: { min: 2, max: 3 },
  10: { min: 2, max: 2 }
};

export function isCombinaisonValide(nbNumeros: number, nbEtoiles: number): boolean {
  if (nbNumeros < 5 || nbNumeros > 10) return false;
  if (nbEtoiles < 2 || nbEtoiles > 12) return false;
  
  const limites = COMBINAISONS_AUTORISEES[nbNumeros];
  if (!limites) return false;
  
  return nbEtoiles >= limites.min && nbEtoiles <= limites.max;
}

export function getMaxEtoilesAutorisees(nbNumeros: number): number {
  if (nbNumeros < 5 || nbNumeros > 10) return 2; // Default fallback
  return COMBINAISONS_AUTORISEES[nbNumeros]?.max || 2;
}

export function getPrixGrille(nbNumeros: number, nbEtoiles: number): number {
    if (!isCombinaisonValide(nbNumeros, nbEtoiles)) return 0;
    return GRILLE_TARIFAIRE[nbNumeros]?.[nbEtoiles] || 0;
}

export function factorielle(n: number): number {
  if (n <= 1) return 1;
  return n * factorielle(n - 1);
}
