/**
 * Analyse fenêtre longue Fréquence (pool "High") — version multi-options (Boules + Étoiles).
 *
 * Objectif:
 * - Refaire le calcul de la "fenêtre stable" de Fréquence (N* tirages),
 *   mais en respectant le projet: EuroMillions = Boules (50) + Étoiles (12).
 * - Donner plusieurs options cohérentes (critères plus ou moins stricts).
 * - Tester si une fenêtre dynamique est pertinente (N* varie-t-il selon l'époque ?).
 *
 * Méthode (même philosophie que analyse-fenetre-longue.ts):
 * - On prend N tirages puis N+DELTA.
 * - On compare:
 *   - ρ (Spearman) sur le classement par fréquence
 *   - overlap Top-K (stabilité de la "tête")
 * - On cherche le plus petit N tel que ces critères soient vrais sur plusieurs pas consécutifs.
 *
 * Usage:
 *   depuis frontend/ :
 *     npx tsx script/analyse-fenetre-frequence-longue-multi.ts
 *
 * Génère:
 *   frontend/client/public/data/fenetre-frequence-longue-analytics-multi.json
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

function ranksByFreq(freq: Record<number, number>): Map<number, number> {
  const entries = Object.entries(freq).map(([n, f]) => ({ num: parseInt(n, 10), f }));
  entries.sort((a, b) => (b.f - a.f) || (a.num - b.num));
  const rank = new Map<number, number>();
  entries.forEach((e, i) => rank.set(e.num, i + 1));
  return rank;
}

function topK(freq: Record<number, number>, K: number): Set<number> {
  const entries = Object.entries(freq).map(([n, f]) => ({ num: parseInt(n, 10), f }));
  entries.sort((a, b) => (b.f - a.f) || (a.num - b.num));
  return new Set(entries.slice(0, K).map((e) => e.num));
}

function spearman(r1: Map<number, number>, r2: Map<number, number>, nums: number[]): number {
  const n = nums.length;
  const d2 = nums.reduce((s, i) => {
    const a = r1.get(i) ?? 0;
    const b = r2.get(i) ?? 0;
    return s + (a - b) ** 2;
  }, 0);
  return 1 - (6 * d2) / (n * (n * n - 1));
}

type Row = {
  N: number;
  rhoBalls: number;
  overlapBallsPct: number;
  rhoStars: number;
  overlapStarsPct: number;
  okBalls: boolean;
  okStars: boolean;
  okBoth: boolean;
};

function round3(x: number) {
  return Math.round(x * 1000) / 1000;
}

function computeNStar(rows: Row[], pasConsecutifs: number): { NStarBalls: number | null; NStarStars: number | null; NStarBoth: number | null } {
  let nBalls: number | null = null;
  let nStars: number | null = null;
  let nBoth: number | null = null;

  for (let i = 0; i <= rows.length - pasConsecutifs; i++) {
    const bloc = rows.slice(i, i + pasConsecutifs);
    if (nBalls === null && bloc.every((r) => r.okBalls)) nBalls = rows[i].N;
    if (nStars === null && bloc.every((r) => r.okStars)) nStars = rows[i].N;
    if (nBoth === null && bloc.every((r) => r.okBoth)) nBoth = rows[i].N;
    if (nBalls !== null && nStars !== null && nBoth !== null) break;
  }
  return { NStarBalls: nBalls, NStarStars: nStars, NStarBoth: nBoth };
}

function runAnalysis(tirages: Tirage[], params: {
  name: string;
  DELTA: number;
  STEP_N: number;
  K_BALL: number;
  K_STAR: number;
  SEUIL_RHO: number;
  SEUIL_OVERLAP_PCT: number;
  PAS_CONSECUTIFS: number;
}) {
  const total = tirages.length;
  const numsBalls = Array.from({ length: 50 }, (_, i) => i + 1);
  const numsStars = Array.from({ length: 12 }, (_, i) => i + 1);

  const rows: Row[] = [];
  for (let N = 50; N + params.DELTA <= total; N += params.STEP_N) {
    const sliceN = tirages.slice(0, N);
    const sliceNDelta = tirages.slice(0, N + params.DELTA);

    const fBN = freqs(sliceN, "balls");
    const fBNd = freqs(sliceNDelta, "balls");
    const rB1 = ranksByFreq(fBN);
    const rB2 = ranksByFreq(fBNd);
    const rhoBalls = spearman(rB1, rB2, numsBalls);
    const topBN = topK(fBN, params.K_BALL);
    const topBNd = topK(fBNd, params.K_BALL);
    let ovB = 0;
    topBN.forEach((x) => { if (topBNd.has(x)) ovB++; });
    const overlapBallsPct = ovB / params.K_BALL;

    const fSN = freqs(sliceN, "stars");
    const fSNd = freqs(sliceNDelta, "stars");
    const rS1 = ranksByFreq(fSN);
    const rS2 = ranksByFreq(fSNd);
    const rhoStars = spearman(rS1, rS2, numsStars);
    const topSN = topK(fSN, params.K_STAR);
    const topSNd = topK(fSNd, params.K_STAR);
    let ovS = 0;
    topSN.forEach((x) => { if (topSNd.has(x)) ovS++; });
    const overlapStarsPct = ovS / params.K_STAR;

    const okBalls = rhoBalls >= params.SEUIL_RHO && overlapBallsPct >= params.SEUIL_OVERLAP_PCT;
    const okStars = rhoStars >= params.SEUIL_RHO && overlapStarsPct >= params.SEUIL_OVERLAP_PCT;

    rows.push({
      N,
      rhoBalls: round3(rhoBalls),
      overlapBallsPct: round3(overlapBallsPct),
      rhoStars: round3(rhoStars),
      overlapStarsPct: round3(overlapStarsPct),
      okBalls,
      okStars,
      okBoth: okBalls && okStars,
    });
  }

  const stars = computeNStar(rows, params.PAS_CONSECUTIFS);

  return {
    name: params.name,
    params,
    total,
    proposition: {
      NStarBalls: stars.NStarBalls,
      NStarStars: stars.NStarStars,
      NStarBoth: stars.NStarBoth,
    },
    rows,
  };
}

function dynamicSeries(tirages: Tirage[], analysisParams: Parameters<typeof runAnalysis>[1]) {
  // On “recule” dans le temps par blocs pour voir si N* change.
  const SERIES_STEP = 150; // ≈ ~1 an
  const MIN_TAIL = 600; // éviter des sous-historiques trop courts
  const series: Array<{ endIndex: number; endDate: string; NStarBalls: number | null; NStarStars: number | null; NStarBoth: number | null }> = [];

  for (let end = 0; end + MIN_TAIL <= tirages.length; end += SERIES_STEP) {
    const subset = tirages.slice(end);
    const res = runAnalysis(subset, analysisParams);
    series.push({
      endIndex: end,
      endDate: subset[0]?.date ?? "?",
      NStarBalls: res.proposition.NStarBalls,
      NStarStars: res.proposition.NStarStars,
      NStarBoth: res.proposition.NStarBoth,
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

  const DELTA = 50;
  const STEP_N = 10;
  const K_BALL = 12;
  const K_STAR = 4;
  const PAS_CONSECUTIFS = 3;

  const variants = [
    { name: "strict", SEUIL_RHO: 0.97, SEUIL_OVERLAP_PCT: 0.8 },
    { name: "standard", SEUIL_RHO: 0.95, SEUIL_OVERLAP_PCT: 0.75 },
    { name: "souple", SEUIL_RHO: 0.93, SEUIL_OVERLAP_PCT: 0.7 },
  ] as const;

  const analyses = variants.map((v) => {
    const params = {
      name: v.name,
      DELTA,
      STEP_N,
      K_BALL,
      K_STAR,
      SEUIL_RHO: v.SEUIL_RHO,
      SEUIL_OVERLAP_PCT: v.SEUIL_OVERLAP_PCT,
      PAS_CONSECUTIFS,
    };
    const base = runAnalysis(tirages, params);
    return { ...base, dynamic: dynamicSeries(tirages, params) };
  });

  const out = {
    generatedAt: new Date().toISOString(),
    note: "N* = plus petit N tel que critères vrais sur PAS_CONSECUTIFS pas. okBoth = boules ET étoiles.",
    analyses,
  };

  const outJsonPath = path.join(__dirname, "../client/public/data/fenetre-frequence-longue-analytics-multi.json");
  fs.writeFileSync(outJsonPath, JSON.stringify(out, null, 2));
  console.log("Écrit:", outJsonPath);

  for (const a of analyses) {
    const p = a.proposition;
    console.log(
      `${a.name} (rho>=${a.params.SEUIL_RHO}, ov>=${a.params.SEUIL_OVERLAP_PCT}) -> N*(boules)=${p.NStarBalls}, N*(étoiles)=${p.NStarStars}, N*(les deux)=${p.NStarBoth}`
    );
  }
}

main();

