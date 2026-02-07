/**
 * Analyse fenêtre Dormeur (retard / absence) — version multi-options.
 *
 * Objectif:
 * - Trouver une fenêtre N (tirages) “utile” pour classer les dormeurs (Top-K stable).
 * - Couvrir Boules (1..50) ET Étoiles (1..12).
 * - Proposer plusieurs presets (Strict/Standard/Souple) + observer la variabilité dans le temps (utile pour Dynamique).
 *
 * Définition Dormeur (implémentation projet):
 * - absence = nombre de tirages depuis la dernière sortie (0 si sorti au dernier tirage)
 * - si un numéro n’apparaît pas dans la fenêtre N, on cappe à N
 *
 * Critère de stabilité (Top-K stable):
 * - On calcule le Top-K des plus fortes absences à N et à N+Δ
 * - overlap = |TopK(N) ∩ TopK(N+Δ)| / K
 * - rho = corrélation de Spearman sur le classement complet (tie-break num asc)
 * - validité = rho >= seuilRho ET overlap >= seuilOverlap (Boules ET Étoiles)
 *
 * Usage (depuis frontend/):
 *   npx tsx script/analyse-fenetre-dormeur-multi.ts
 *
 * Génère:
 *   frontend/client/public/data/fenetre-dormeur-analytics-multi.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

function absences(tirages: Tirage[], N: number, kind: "balls" | "stars"): number[] {
  const max = kind === "balls" ? 50 : 12;
  const out = new Array(max + 1).fill(N);
  const window = tirages.slice(0, N);
  for (let i = 0; i < window.length; i++) {
    const t = window[i];
    const arr = kind === "balls" ? t.numeros : t.etoiles;
    for (const n of arr) {
      if (n >= 1 && n <= max && out[n] === N) out[n] = i;
    }
  }
  return out;
}

function ranksByAbsence(abs: number[], max: number): number[] {
  const entries = Array.from({ length: max }, (_, idx) => ({ num: idx + 1, a: abs[idx + 1] ?? 0 }));
  entries.sort((x, y) => (y.a - x.a) || (x.num - y.num)); // absence desc, tie-break num asc
  const rank = new Array(max + 1).fill(0);
  entries.forEach((e, i) => (rank[e.num] = i + 1));
  return rank;
}

function topKSet(abs: number[], max: number, K: number): Set<number> {
  const entries = Array.from({ length: max }, (_, idx) => ({ num: idx + 1, a: abs[idx + 1] ?? 0 }));
  entries.sort((x, y) => (y.a - x.a) || (x.num - y.num));
  return new Set(entries.slice(0, K).map((e) => e.num));
}

function spearmanFromRanks(r1: number[], r2: number[], max: number): number {
  const n = max;
  let d2 = 0;
  for (let i = 1; i <= max; i++) {
    const a = r1[i] ?? 0;
    const b = r2[i] ?? 0;
    const d = a - b;
    d2 += d * d;
  }
  return 1 - (6 * d2) / (n * (n * n - 1));
}

function overlapPct(a: Set<number>, b: Set<number>, K: number): number {
  let ov = 0;
  a.forEach((x) => {
    if (b.has(x)) ov++;
  });
  return ov / K;
}

function round3(x: number) {
  return Math.round(x * 1000) / 1000;
}

type Candidate = {
  N: number;
  rhoBalls: number;
  ovBalls: number;
  rhoStars: number;
  ovStars: number;
  okBalls: boolean;
  okStars: boolean;
  valid: boolean;
};

function computeCandidates(
  tirages: Tirage[],
  opts: { delta: number; stepN: number; pas: number; kBalls: number; kStars: number; seuilRho: number; seuilOv: number; nMin: number; nMax: number },
) {
  const total = tirages.length;
  const results: Candidate[] = [];
  const nMax = Math.min(opts.nMax, total - opts.delta);
  for (let N = opts.nMin; N <= nMax; N += opts.stepN) {
    const N2 = N + opts.delta;
    const absB1 = absences(tirages, N, "balls");
    const absB2 = absences(tirages, N2, "balls");
    const rB1 = ranksByAbsence(absB1, 50);
    const rB2 = ranksByAbsence(absB2, 50);
    const rhoB = spearmanFromRanks(rB1, rB2, 50);
    const tB1 = topKSet(absB1, 50, opts.kBalls);
    const tB2 = topKSet(absB2, 50, opts.kBalls);
    const ovB = overlapPct(tB1, tB2, opts.kBalls);

    const absS1 = absences(tirages, N, "stars");
    const absS2 = absences(tirages, N2, "stars");
    const rS1 = ranksByAbsence(absS1, 12);
    const rS2 = ranksByAbsence(absS2, 12);
    const rhoS = spearmanFromRanks(rS1, rS2, 12);
    const tS1 = topKSet(absS1, 12, opts.kStars);
    const tS2 = topKSet(absS2, 12, opts.kStars);
    const ovS = overlapPct(tS1, tS2, opts.kStars);

    const okB = rhoB >= opts.seuilRho && ovB >= opts.seuilOv;
    const okS = rhoS >= opts.seuilRho && ovS >= opts.seuilOv;
    results.push({
      N,
      rhoBalls: round3(rhoB),
      ovBalls: round3(ovB),
      rhoStars: round3(rhoS),
      ovStars: round3(ovS),
      okBalls: okB,
      okStars: okS,
      valid: okB && okS,
    });
  }

  // Proposition = plus petit N tel que validité tenue sur "pas" incréments consécutifs.
  let NStar: number | null = null;
  for (let i = 0; i < results.length; i++) {
    let ok = true;
    for (let j = 0; j < opts.pas; j++) {
      const r = results[i + j];
      if (!r || r.valid !== true) {
        ok = false;
        break;
      }
    }
    if (ok) {
      NStar = results[i]!.N;
      break;
    }
  }

  return {
    meta: { total, ...opts },
    results,
    proposition: NStar ? { NStar } : null,
  };
}

function computeDynamicSeries(tirages: Tirage[], opts: Parameters<typeof computeCandidates>[1]) {
  const SERIES_STEP = 150; // ~1 an
  const MIN_TAIL = 400;
  const series: Array<{ endIndex: number; endDate: string; NStar: number | null }> = [];
  for (let end = 0; end + MIN_TAIL <= tirages.length; end += SERIES_STEP) {
    const subset = tirages.slice(end);
    const res = computeCandidates(subset, opts);
    series.push({ endIndex: end, endDate: subset[0]?.date ?? "?", NStar: res.proposition?.NStar ?? null });
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

  const base = {
    delta: 20,
    stepN: 10,
    kBalls: 25,
    kStars: 8,
    nMin: 60,
    nMax: 1200,
  };

  const presets = [
    { preset: "souple", pas: 1, seuilRho: 0.88, seuilOv: 0.65 },
    { preset: "standard", pas: 2, seuilRho: 0.92, seuilOv: 0.75 },
    { preset: "strict", pas: 3, seuilRho: 0.95, seuilOv: 0.85 },
  ] as const;

  const analyses = presets.map((p) => {
    const opts = { ...base, ...p };
    const res = computeCandidates(tirages, opts);
    const dyn = computeDynamicSeries(tirages, opts);
    return { preset: p.preset, ...res, dynamic: dyn };
  });

  const out = {
    generatedAt: new Date().toISOString(),
    definition: {
      dormeur: "absence = tirages depuis dernière sortie (cap N si non-vu dans la fenêtre)",
      stability: "Top-K stable + Spearman entre N et N+Δ (Boules & Étoiles)",
    },
    analyses,
  };

  const outJsonPath = path.join(__dirname, "../client/public/data/fenetre-dormeur-analytics-multi.json");
  fs.writeFileSync(outJsonPath, JSON.stringify(out, null, 2));
  console.log("Écrit:", outJsonPath);

  for (const a of analyses) {
    const prop = a.proposition?.NStar ?? null;
    console.log(`${a.preset} -> N*=${prop}`);
  }
}

main();

