/**
 * Analyse fenêtre "courte" Surreprésentation (z-score) — version multi-options (Boules + Étoiles).
 *
 * Objectif:
 * - Trouver des fenêtres "courtes utiles" (N tirages) où le classement par surreprésentation
 *   (z-score) est suffisamment stable quand on ajoute DELTA tirages.
 * - Proposer 3 profils : Strict / Standard / Souple + base pour un Dynamique (recalcul).
 *
 * Définition z-score (EuroMillions):
 * - Boules: p0 = 5/50 = 0.1
 * - Étoiles: p0 = 2/12 = 1/6
 * - z = (k - N*p0) / sqrt(N*p0*(1-p0))
 *
 * Métriques (même philosophie que fenêtre fréquence):
 * - ρ Spearman sur le classement par z
 * - overlap Top-K (les plus surreprésentés)
 *
 * Usage:
 *   depuis frontend/ :
 *     npx tsx script/analyse-fenetre-surrepr-multi.ts
 *
 * Génère:
 *   frontend/client/public/data/fenetre-surrepr-analytics-multi.json
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

function buildCums(history: Tirage[], kind: "balls" | "stars") {
  const total = history.length;
  const max = kind === "balls" ? 50 : 12;
  const cum: number[][] = Array.from({ length: total + 1 }, () => Array(max + 1).fill(0));
  for (let i = 0; i < total; i++) {
    const prev = cum[i];
    const next = cum[i + 1];
    for (let n = 1; n <= max; n++) next[n] = prev[n];
    const arr = kind === "balls" ? history[i]?.numeros : history[i]?.etoiles;
    for (const v of arr ?? []) if (v >= 1 && v <= max) next[v] += 1;
  }
  return { cum, max };
}

function zFromCounts(k: number, N: number, p0: number) {
  const expected = N * p0;
  const denom = Math.sqrt(N * p0 * (1 - p0));
  if (!Number.isFinite(denom) || denom <= 0) return 0;
  return (k - expected) / denom;
}

function ranksByScore(score: number[], max: number) {
  const entries = Array.from({ length: max }, (_, idx) => ({ num: idx + 1, s: score[idx + 1] ?? 0 }));
  entries.sort((a, b) => (b.s - a.s) || (a.num - b.num));
  const rank = new Array(max + 1).fill(0);
  entries.forEach((e, i) => { rank[e.num] = i + 1; });
  return rank;
}

function topKSet(score: number[], max: number, K: number) {
  const entries = Array.from({ length: max }, (_, idx) => ({ num: idx + 1, s: score[idx + 1] ?? 0 }));
  entries.sort((a, b) => (b.s - a.s) || (a.num - b.num));
  return new Set(entries.slice(0, K).map((e) => e.num));
}

function spearmanFromRanks(r1: number[], r2: number[], max: number) {
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

function round3(x: number) {
  return Math.round(x * 1000) / 1000;
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

function computeNStar(rows: Row[], pas: number) {
  let nBalls: number | null = null;
  let nStars: number | null = null;
  let nBoth: number | null = null;
  for (let i = 0; i <= rows.length - pas; i++) {
    const bloc = rows.slice(i, i + pas);
    if (nBalls === null && bloc.every((r) => r.okBalls)) nBalls = rows[i].N;
    if (nStars === null && bloc.every((r) => r.okStars)) nStars = rows[i].N;
    if (nBoth === null && bloc.every((r) => r.okBoth)) nBoth = rows[i].N;
    if (nBalls !== null && nStars !== null && nBoth !== null) break;
  }
  return { NStarBalls: nBalls, NStarStars: nStars, NStarBoth: nBoth };
}

function runAnalysis(history: Tirage[], params: {
  name: string;
  DELTA: number;
  STEP_N: number;
  N_MAX: number;
  PAS_CONSECUTIFS: number;
  K_BALL: number;
  K_STAR: number;
  SEUIL_RHO: number;
  SEUIL_OV: number;
}) {
  const total = history.length;
  const { cum: cumB, max: maxB } = buildCums(history, "balls");
  const { cum: cumS, max: maxS } = buildCums(history, "stars");

  const pBall = 0.1;
  const pStar = 1 / 6;

  const rows: Row[] = [];
  const nMax = Math.min(params.N_MAX, total - params.DELTA);
  for (let N = 50; N + params.DELTA <= total && N <= nMax; N += params.STEP_N) {
    const N2 = N + params.DELTA;

    const zB1 = new Array(maxB + 1).fill(0);
    const zB2 = new Array(maxB + 1).fill(0);
    for (let i = 1; i <= maxB; i++) {
      zB1[i] = zFromCounts(cumB[N][i] ?? 0, N, pBall);
      zB2[i] = zFromCounts(cumB[N2][i] ?? 0, N2, pBall);
    }
    const rB1 = ranksByScore(zB1, maxB);
    const rB2 = ranksByScore(zB2, maxB);
    const rhoBalls = spearmanFromRanks(rB1, rB2, maxB);
    const tB1 = topKSet(zB1, maxB, params.K_BALL);
    const tB2 = topKSet(zB2, maxB, params.K_BALL);
    let ovB = 0;
    tB1.forEach((x) => { if (tB2.has(x)) ovB++; });
    const ovBPct = ovB / params.K_BALL;

    const zS1 = new Array(maxS + 1).fill(0);
    const zS2 = new Array(maxS + 1).fill(0);
    for (let i = 1; i <= maxS; i++) {
      zS1[i] = zFromCounts(cumS[N][i] ?? 0, N, pStar);
      zS2[i] = zFromCounts(cumS[N2][i] ?? 0, N2, pStar);
    }
    const rS1 = ranksByScore(zS1, maxS);
    const rS2 = ranksByScore(zS2, maxS);
    const rhoStars = spearmanFromRanks(rS1, rS2, maxS);
    const tS1 = topKSet(zS1, maxS, params.K_STAR);
    const tS2 = topKSet(zS2, maxS, params.K_STAR);
    let ovS = 0;
    tS1.forEach((x) => { if (tS2.has(x)) ovS++; });
    const ovSPct = ovS / params.K_STAR;

    const okBalls = rhoBalls >= params.SEUIL_RHO && ovBPct >= params.SEUIL_OV;
    const okStars = rhoStars >= params.SEUIL_RHO && ovSPct >= params.SEUIL_OV;

    rows.push({
      N,
      rhoBalls: round3(rhoBalls),
      overlapBallsPct: round3(ovBPct),
      rhoStars: round3(rhoStars),
      overlapStarsPct: round3(ovSPct),
      okBalls,
      okStars,
      okBoth: okBalls && okStars,
    });
  }

  return {
    name: params.name,
    params,
    total,
    proposition: computeNStar(rows, params.PAS_CONSECUTIFS),
    rows,
  };
}

function dynamicSeries(history: Tirage[], analysisParams: Parameters<typeof runAnalysis>[1]) {
  const SERIES_STEP = 150;
  const MIN_TAIL = 400;
  const series: Array<{ endIndex: number; endDate: string; NStarBoth: number | null }> = [];
  for (let end = 0; end + MIN_TAIL <= history.length; end += SERIES_STEP) {
    const subset = history.slice(end);
    const res = runAnalysis(subset, analysisParams);
    series.push({
      endIndex: end,
      endDate: subset[0]?.date ?? "?",
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

  const history = loadCSV(csvPath);
  const total = history.length;
  console.log(`Tirages chargés: ${total} (du ${history[total - 1]?.date} au ${history[0]?.date})`);

  const base = {
    DELTA: 50,
    STEP_N: 10,
    N_MAX: 450,
    PAS_CONSECUTIFS: 2,
    K_BALL: 12,
    K_STAR: 4,
  };

  const variants = [
    { name: "strict", SEUIL_RHO: 0.92, SEUIL_OV: 0.75 },
    { name: "standard", SEUIL_RHO: 0.90, SEUIL_OV: 0.70 },
    { name: "souple", SEUIL_RHO: 0.85, SEUIL_OV: 0.60 },
  ] as const;

  const analyses = variants.map((v) => {
    const params = { ...base, name: v.name, SEUIL_RHO: v.SEUIL_RHO, SEUIL_OV: v.SEUIL_OV };
    const a = runAnalysis(history, params);
    return { ...a, dynamic: dynamicSeries(history, params) };
  });

  const out = { generatedAt: new Date().toISOString(), analyses };
  const outPath = path.join(__dirname, "../client/public/data/fenetre-surrepr-analytics-multi.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("Écrit:", outPath);

  for (const a of analyses) {
    console.log(
      `${a.name} (rho>=${a.params.SEUIL_RHO}, ov>=${a.params.SEUIL_OV}) -> N*(les deux)=${a.proposition.NStarBoth}`
    );
  }
}

main();

