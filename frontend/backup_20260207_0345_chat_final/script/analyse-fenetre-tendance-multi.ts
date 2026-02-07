/**
 * Analyse fenêtre Tendance (sens d’évolution : hausse / stable / baisse) — version multi-options.
 *
 * Objectif:
 * - Proposer plusieurs couples (W, R) cohérents (plus ou moins “stables”) au lieu d’une seule valeur.
 * - Couvrir Boules (1..50) ET Étoiles (1..12).
 * - Aider à décider “fixe” vs “dynamique” en regardant si (W*,R*) varie fortement selon l’époque.
 *
 * Source de vérité: CDC_Fenetre_Tendance.md
 * Définition:
 * - Fenêtre totale W tirages (référence)
 * - Période récente R tirages (comparée)
 * - Pour chaque numéro: freq attendue sur R = (freq_sur_W / W) * R
 * - ratio = freq réelle / freq attendue
 * - ratio > 1.2 => hausse ; ratio < 0.8 => baisse ; sinon stable
 *
 * Usage:
 *   depuis frontend/ :
 *     npx tsx script/analyse-fenetre-tendance-multi.ts
 *
 * Génère:
 *   frontend/client/public/data/fenetre-tendance-analytics-multi.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type Direction = "hausse" | "stable" | "baisse";

interface Tirage {
  date: string;
  numeros: number[];
  etoiles: number[];
}

function loadCSV(csvPath: string): Tirage[] {
  const raw = fs.readFileSync(csvPath, "utf-8");
  const lines = raw.trim().split("\n").slice(1);
  const tirages: Tirage[] = lines.map((line) => {
    const cols = line.split(";");
    const date = cols[0];
    const numeros = [1, 2, 3, 4, 5].map((i) => parseInt(cols[i] ?? "", 10));
    const etoiles = [6, 7].map((i) => parseInt(cols[i] ?? "", 10));
    return { date, numeros, etoiles };
  });
  // Tri décroissant (le plus récent en premier)
  return tirages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function freqs(tirages: Tirage[], kind: "balls" | "stars"): Record<number, number> {
  const freq: Record<number, number> = {};
  const max = kind === "balls" ? 50 : 12;
  for (let i = 1; i <= max; i++) freq[i] = 0;
  for (const t of tirages) {
    const arr = kind === "balls" ? t.numeros : t.etoiles;
    for (const n of arr) if (freq[n] !== undefined) freq[n]++;
  }
  return freq;
}

function labelFromRatio(ratio: number): Direction {
  if (ratio > 1.2) return "hausse";
  if (ratio < 0.8) return "baisse";
  return "stable";
}

function tendanceLabels(fenetre: Tirage[], W: number, R: number, kind: "balls" | "stars"): Record<number, Direction> {
  const total = fenetre.slice(0, W);
  const recent = fenetre.slice(0, R);
  const freqTot = freqs(total, kind);
  const freqRec = freqs(recent, kind);
  const out: Record<number, Direction> = {};
  const max = kind === "balls" ? 50 : 12;

  for (let num = 1; num <= max; num++) {
    const freqAtt = W > 0 ? ((freqTot[num] ?? 0) / W) * R : 0;
    const freqReelle = freqRec[num] ?? 0;
    const ratio = freqAtt > 0 ? freqReelle / freqAtt : 0;
    out[num] = labelFromRatio(ratio);
  }
  return out;
}

function concordance(l1: Record<number, Direction>, l2: Record<number, Direction>, max: number): number {
  let same = 0;
  for (let num = 1; num <= max; num++) {
    if ((l1[num] ?? "stable") === (l2[num] ?? "stable")) same++;
  }
  return same / max;
}

type Candidate = {
  W: number;
  R: number; // on retient le “milieu” stable comme dans le script original
  concBalls_R_R5: number;
  concBalls_R5_R10: number;
  concStars_R_R5: number;
  concStars_R5_R10: number;
  concMin: number;
  valid: boolean;
};

function round3(x: number) {
  return Math.round(x * 1000) / 1000;
}

function computeCandidates(tirages: Tirage[], opts: { seuil: number }) {
  const STEP_W = 10;
  const W_MIN = 50;
  const W_MAX = 200;
  const R_MIN = 15;
  const R_MAX_PCT = 0.5; // R <= W/2
  const DELTA_R = 5;

  const total = tirages.length;
  const results: Candidate[] = [];

  for (let W = W_MIN; W <= W_MAX && W <= total - 20; W += STEP_W) {
    const Rmax = Math.min(80, Math.floor(W * R_MAX_PCT));
    for (let R = R_MIN; R + 10 <= Rmax && R + 10 <= W; R += DELTA_R) {
      const bR = tendanceLabels(tirages, W, R, "balls");
      const bR5 = tendanceLabels(tirages, W, R + 5, "balls");
      const bR10 = tendanceLabels(tirages, W, R + 10, "balls");

      const sR = tendanceLabels(tirages, W, R, "stars");
      const sR5 = tendanceLabels(tirages, W, R + 5, "stars");
      const sR10 = tendanceLabels(tirages, W, R + 10, "stars");

      const concB1 = concordance(bR, bR5, 50);
      const concB2 = concordance(bR5, bR10, 50);
      const concS1 = concordance(sR, sR5, 12);
      const concS2 = concordance(sR5, sR10, 12);

      const concMin = Math.min(concB1, concB2, concS1, concS2);
      const valid = concMin >= opts.seuil;

      results.push({
        W,
        R: R + 5,
        concBalls_R_R5: round3(concB1),
        concBalls_R5_R10: round3(concB2),
        concStars_R_R5: round3(concS1),
        concStars_R5_R10: round3(concS2),
        concMin: round3(concMin),
        valid,
      });
    }
  }

  // “Proposition” = plus petit W puis plus petit R valide
  let WStar = 0;
  let RStar = 0;
  for (let W = W_MIN; W <= W_MAX; W += STEP_W) {
    const first = results.find((r) => r.W === W && r.valid);
    if (first) {
      WStar = first.W;
      RStar = first.R;
      break;
    }
  }

  return {
    meta: { total, W_MIN, W_MAX, R_MIN, DELTA_R, seuil: opts.seuil },
    results,
    proposition: WStar ? { WStar, RStar } : null,
  };
}

function computeDynamicSeries(tirages: Tirage[], seuil: number) {
  // On simule “l’époque” en coupant la fin (on se met à une date passée),
  // et on recalcule W* / R* sur ce sous-ensemble.
  // Pas trop fin, pour rester lisible.
  const SERIES_STEP = 150; // tirages (≈ ~1 an)
  const MIN_TAIL = 400; // éviter les époques trop courtes

  const series: Array<{ endIndex: number; endDate: string; WStar: number | null; RStar: number | null }> = [];
  for (let end = 0; end + MIN_TAIL <= tirages.length; end += SERIES_STEP) {
    const subset = tirages.slice(end); // on “recule” dans le temps: on retire les plus récents
    const res = computeCandidates(subset, { seuil });
    series.push({
      endIndex: end,
      endDate: subset[0]?.date ?? "?",
      WStar: res.proposition?.WStar ?? null,
      RStar: res.proposition?.RStar ?? null,
    });
  }
  return { SERIES_STEP, MIN_TAIL, series };
}

function main() {
  const csvPath = path.join(__dirname, "../client/public/data/euromillions_historique_complet_2004-2025.csv");
  if (!fs.existsSync(csvPath)) {
    console.error("Fichier CSV introuvable:", csvPath);
    process.exit(1);
  }

  const tirages = loadCSV(csvPath);
  const total = tirages.length;
  console.log(`Tirages chargés: ${total} (du ${tirages[total - 1]?.date} au ${tirages[0]?.date})`);

  const seuils = [0.8, 0.82, 0.85] as const;
  const analyses = seuils.map((seuil) => {
    const base = computeCandidates(tirages, { seuil });
    const dyn = computeDynamicSeries(tirages, seuil);
    return { seuil, ...base, dynamic: dyn };
  });

  const out = {
    generatedAt: new Date().toISOString(),
    definition: {
      ratioRule: "freqReelle / ((freqSurW/W)*R), seuils: >1.2 hausse, <0.8 baisse, sinon stable",
      note: "validité = stabilité quand on décale R (+5 puis +10), sur Boules ET Étoiles (min des concordances).",
    },
    analyses,
  };

  const outJsonPath = path.join(__dirname, "../client/public/data/fenetre-tendance-analytics-multi.json");
  fs.writeFileSync(outJsonPath, JSON.stringify(out, null, 2));
  console.log("Écrit:", outJsonPath);

  for (const a of analyses) {
    if (a.proposition) {
      console.log(`Seuil ${(a.seuil * 100).toFixed(0)}% -> W=${a.proposition.WStar}, R=${a.proposition.RStar}`);
    } else {
      console.log(`Seuil ${(a.seuil * 100).toFixed(0)}% -> aucune proposition trouvée`);
    }
  }
}

main();

