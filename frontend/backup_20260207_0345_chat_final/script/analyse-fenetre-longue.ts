/**
 * Analyse fenêtre longue Fréquence (CDC Tâche 1)
 * Calcule σ(N), ρ(N), overlap Top-K pour proposer une fenêtre "utile"
 * et effectue la validation par glissement.
 *
 * Usage: depuis frontend/ : npx tsx script/analyse-fenetre-longue.ts
 * Génère: frontend/client/public/data/fenetre-longue-analytics.json
 *         frontend/client/public/data/fenetre-longue-courbes.html
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Tirage {
  date: string;
  numeros: number[];
  etoiles: number[];
}

function loadCSV(csvPath: string): Tirage[] {
  const raw = fs.readFileSync(csvPath, 'utf-8');
  const lines = raw.trim().split('\n').slice(1);
  const tirages: Tirage[] = lines.map((line) => {
    const cols = line.split(';');
    const date = cols[0];
    const numeros = [1, 2, 3, 4, 5].map((i) => parseInt(cols[i], 10));
    const etoiles = [6, 7].map((i) => parseInt(cols[i], 10));
    return { date, numeros, etoiles };
  });
  // Tri du plus récent au plus ancien (comme dans l'app)
  return tirages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function frequencesNumeros(tirages: Tirage[]): Record<number, number> {
  const freq: Record<number, number> = {};
  for (let i = 1; i <= 50; i++) freq[i] = 0;
  for (const t of tirages) {
    for (const n of t.numeros) if (freq[n] !== undefined) freq[n]++;
  }
  return freq;
}

function rangsParFrequence(freq: Record<number, number>): Map<number, number> {
  const entries = Object.entries(freq).map(([n, f]) => ({ num: parseInt(n, 10), f }));
  entries.sort((a, b) => b.f - a.f);
  const rang = new Map<number, number>();
  entries.forEach((e, i) => rang.set(e.num, i + 1));
  return rang;
}

function topK(freq: Record<number, number>, K: number): Set<number> {
  const entries = Object.entries(freq).map(([n, f]) => ({ num: parseInt(n, 10), f }));
  entries.sort((a, b) => b.f - a.f);
  return new Set(entries.slice(0, K).map((e) => e.num));
}

function sigma(freq: Record<number, number>): number {
  const vals = Object.values(freq);
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  const v = vals.reduce((s, x) => s + (x - m) ** 2, 0) / vals.length;
  return Math.sqrt(v);
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

const DELTA = 50;
const K = 12;
const STEP_N = 10;
const SEUIL_RHO = 0.95;
const SEUIL_OVERLAP_PCT = 0.75;
const SEUIL_SIGMA_VAR_PCT = 0.02;

function main() {
  const csvPath = path.join(__dirname, '../client/public/data/euromillions_historique_complet_2004-2025.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('Fichier CSV introuvable:', csvPath);
    process.exit(1);
  }

  const tirages = loadCSV(csvPath);
  const total = tirages.length;
  console.log(`Tirages chargés: ${total} (du ${tirages[total - 1]?.date} au ${tirages[0]?.date})`);

  const nums = Array.from({ length: 50 }, (_, i) => i + 1);
  const results: { N: number; sigma: number; rho: number; overlapTopK: number; overlapPct: number }[] = [];

  for (let N = 50; N + DELTA <= total; N += STEP_N) {
    const sliceN = tirages.slice(0, N);
    const sliceNDelta = tirages.slice(0, N + DELTA);
    const freqN = frequencesNumeros(sliceN);
    const freqNDelta = frequencesNumeros(sliceNDelta);
    const r1 = rangsParFrequence(freqN);
    const r2 = rangsParFrequence(freqNDelta);
    const topKN = topK(freqN, K);
    const topKNDelta = topK(freqNDelta, K);
    let overlap = 0;
    topKN.forEach((n) => {
      if (topKNDelta.has(n)) overlap++;
    });

    results.push({
      N,
      sigma: Math.round(sigma(freqN) * 1000) / 1000,
      rho: Math.round(spearman(r1, r2, nums) * 1000) / 1000,
      overlapTopK: overlap,
      overlapPct: Math.round((overlap / K) * 1000) / 1000,
    });
  }

  const outJsonPath = path.join(__dirname, '../client/public/data/fenetre-longue-analytics.json');

  // Proposition N* : plus petit N tel que rho >= 0.95 et overlapPct >= 0.75 sur quelques pas
  let NStar = 0;
  const pasConsecutifs = 3;
  for (let i = 0; i <= results.length - pasConsecutifs; i++) {
    const bloc = results.slice(i, i + pasConsecutifs);
    const okRho = bloc.every((r) => r.rho >= SEUIL_RHO);
    const okOverlap = bloc.every((r) => r.overlapPct >= SEUIL_OVERLAP_PCT);
    const okSigma = i >= 1 && Math.abs(results[i].sigma - results[i - 1].sigma) / (results[i - 1].sigma || 1) <= SEUIL_SIGMA_VAR_PCT;
    if (okRho && okOverlap) {
      NStar = results[i].N;
      break;
    }
  }
  if (NStar === 0 && results.length) {
    const last = results[results.length - 1];
    NStar = last.N;
  }

  const proposition = {
    NStar,
    libelle: `Fenêtre longue Fréquence suggérée: ${NStar} tirages`,
    criteres: { SEUIL_RHO, SEUIL_OVERLAP_PCT, SEUIL_SIGMA_VAR_PCT, K, DELTA },
  };

  const slidingStep = 100;
  const W = NStar;
  const slidingResults: { debut: number; fin: number; sigma: number; rho: number; overlapPct: number; valide: boolean }[] = [];
  for (let i = 0; i + W + DELTA <= total; i += slidingStep) {
    const win = tirages.slice(i, i + W);
    const winDelta = tirages.slice(i, i + W + DELTA);
    const fW = frequencesNumeros(win);
    const fWDelta = frequencesNumeros(winDelta);
    const r1 = rangsParFrequence(fW);
    const r2 = rangsParFrequence(fWDelta);
    const topKW = topK(fW, K);
    const topKWDelta = topK(fWDelta, K);
    let ov = 0;
    topKW.forEach((n) => { if (topKWDelta.has(n)) ov++; });
    const overlapPct = ov / K;
    const rho = spearman(r1, r2, nums);
    const valide = rho >= SEUIL_RHO && overlapPct >= SEUIL_OVERLAP_PCT;
    slidingResults.push({
      debut: i,
      fin: i + W - 1,
      sigma: Math.round(sigma(fW) * 1000) / 1000,
      rho: Math.round(rho * 1000) / 1000,
      overlapPct: Math.round(overlapPct * 1000) / 1000,
      valide,
    });
  }
  const nbValides = slidingResults.filter((r) => r.valide).length;
  const validationGlissement = {
    fenetreTirages: W,
    nbGlissements: slidingResults.length,
    nbValides,
    pctValides: Math.round((nbValides / slidingResults.length) * 100),
    detail: slidingResults,
  };

  const fullOutput = {
    meta: { total, DELTA, K, STEP_N },
    results,
    proposition,
    validationGlissement,
  };
  fs.writeFileSync(outJsonPath, JSON.stringify(fullOutput, null, 2));
  console.log('Écrit:', outJsonPath);

  const htmlPath = path.join(__dirname, '../client/public/data/fenetre-longue-courbes.html');
  const html = buildHtml(fullOutput);
  fs.writeFileSync(htmlPath, html);
  console.log('Écrit:', htmlPath);
  console.log('\nProposition:', proposition.libelle);
  console.log('Validation par glissement:', nbValides + '/' + slidingResults.length, `(${validationGlissement.pctValides}% valides)`);
}

function buildHtml(data: {
  meta: { total: number };
  results: { N: number; sigma: number; rho: number; overlapTopK: number; overlapPct: number }[];
  proposition: { NStar: number; libelle: string };
  validationGlissement: { fenetreTirages: number; nbValides: number; nbGlissements: number; pctValides: number };
}): string {
  const { results, proposition, validationGlissement } = data;
  const labels = results.map((r) => r.N);
  const sigmaData = results.map((r) => r.sigma);
  const rhoData = results.map((r) => r.rho);
  const overlapPctData = results.map((r) => r.overlapPct * 100);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>Fenêtre longue Fréquence – Analyse EuroMillions</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
    h1 { font-size: 1.3rem; }
    h2 { font-size: 1.1rem; margin-top: 1.5rem; }
    .proposition { background: #e8f5e9; padding: 0.75rem 1rem; border-radius: 8px; margin: 1rem 0; }
    .vulgarisation { background: #fff3e0; padding: 0.75rem 1rem; border-radius: 8px; margin: 1rem 0; font-size: 0.95rem; }
    .chart-container { position: relative; height: 280px; margin: 1rem 0; }
  </style>
</head>
<body>
  <h1>Fenêtre longue Fréquence (EuroMillions)</h1>
  <p>Analyse CDC Tâche 1 : σ(N), ρ(N), overlap Top-${data.meta?.K ?? 12} – du plus récent vers le passé.</p>

  <div class="proposition">
    <strong>Proposition concrète</strong><br>${proposition.libelle}
  </div>

  <div class="vulgarisation">
    <strong>En bref (Loto)</strong><br>
    On a testé des fenêtres de 50, 60, 70… jusqu’à plusieurs centaines de tirages. Pour chaque taille N, on regarde :
    <ul>
      <li><b>σ(N)</b> : à quel point les 50 numéros ont des fréquences écartées (plus c’est stable en augmentant N, mieux c’est).</li>
      <li><b>ρ(N)</b> : si on ajoute 50 tirages en plus, est-ce que le classement des numéros change beaucoup ? (ρ proche de 1 = très stable.)</li>
      <li><b>Overlap Top-${data.meta?.K ?? 12}</b> : les ${data.meta?.K ?? 12} numéros les plus sortis sur N tirages sont-ils à peu près les mêmes que sur N+50 ? (en %).</li>
    </ul>
    La « bonne taille » proposée est le plus petit N à partir duquel le classement devient stable (ρ ≥ 0,95, overlap ≥ 75 %) sur plusieurs pas. Fenêtre plus courte = instable, plus longue = inutile.
  </div>

  <h2>σ(N) – Dispersion des fréquences</h2>
  <div class="chart-container"><canvas id="chartSigma"></canvas></div>

  <h2>ρ(N) – Stabilité du classement (Spearman)</h2>
  <div class="chart-container"><canvas id="chartRho"></canvas></div>

  <h2>Overlap Top-${data.meta?.K ?? 12} (%)</h2>
  <div class="chart-container"><canvas id="chartOverlap"></canvas></div>

  <h2>Validation par glissement</h2>
  <p>Fenêtre de ${validationGlissement.fenetreTirages} tirages glissée sur l’historique : ${validationGlissement.nbValides}/${validationGlissement.nbGlissements} fenêtres valides (${validationGlissement.pctValides} %).</p>

  <script>
    const labels = ${JSON.stringify(labels)};
    new Chart(document.getElementById('chartSigma'), {
      type: 'line',
      data: { labels, datasets: [{ label: 'σ(N)', data: ${JSON.stringify(sigmaData)}, borderColor: '#1976d2', fill: false }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: 'N (nb tirages)' } } } }
    });
    new Chart(document.getElementById('chartRho'), {
      type: 'line',
      data: { labels, datasets: [{ label: 'ρ(N)', data: ${JSON.stringify(rhoData)}, borderColor: '#2e7d32', fill: false }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: 'N (nb tirages)' } }, y: { min: 0.8, max: 1 } } }
    });
    new Chart(document.getElementById('chartOverlap'), {
      type: 'line',
      data: { labels, datasets: [{ label: 'Overlap Top-K (%)', data: ${JSON.stringify(overlapPctData)}, borderColor: '#7b1fa2', fill: false }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: 'N (nb tirages)' } }, y: { min: 0, max: 100 } } }
    });
  </script>
</body>
</html>`;
}

main();
