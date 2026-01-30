/**
 * Analyse fenêtre courte (Surreprésentation / fréquence récente)
 * Même méthode que fenêtre longue : σ(N), ρ(N), overlap Top-K.
 * On cherche le plus petit N "usable" (récent mais encore stable).
 *
 * Usage: depuis frontend/ : npx tsx script/analyse-fenetre-courte.ts
 * Génère: frontend/client/public/data/fenetre-courte-analytics.json
 *         frontend/client/public/data/fenetre-courte-courbes.html
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
const N_MAX_COURT = 450; // plafond "courte" pour rester récent
const SEUIL_RHO_COURT = 0.90;
const SEUIL_OVERLAP_PCT_COURT = 0.70;
const PAS_CONSECUTIFS = 2;

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

  const nMax = Math.min(N_MAX_COURT, total - DELTA);
  for (let N = 50; N <= nMax; N += STEP_N) {
    const sliceN = tirages.slice(0, N);
    const sliceNDelta = tirages.slice(0, N + DELTA);
    const freqN = frequencesNumeros(sliceN);
    const freqNDelta = frequencesNumeros(sliceNDelta);
    const r1 = rangsParFrequence(freqN);
    const r2 = rangsParFrequence(freqNDelta);
    const topKN = topK(freqN, K);
    const topKNDelta = topK(freqNDelta, K);
    let overlap = 0;
    topKN.forEach((n) => { if (topKNDelta.has(n)) overlap++; });

    results.push({
      N,
      sigma: Math.round(sigma(freqN) * 1000) / 1000,
      rho: Math.round(spearman(r1, r2, nums) * 1000) / 1000,
      overlapTopK: overlap,
      overlapPct: Math.round((overlap / K) * 1000) / 1000,
    });
  }

  const outJsonPath = path.join(__dirname, '../client/public/data/fenetre-courte-analytics.json');

  // Proposition N* : plus petit N tel que rho >= 0.90 et overlap >= 70 % sur 2 pas consécutifs
  let NStar = 0;
  for (let i = 0; i <= results.length - PAS_CONSECUTIFS; i++) {
    const bloc = results.slice(i, i + PAS_CONSECUTIFS);
    const okRho = bloc.every((r) => r.rho >= SEUIL_RHO_COURT);
    const okOverlap = bloc.every((r) => r.overlapPct >= SEUIL_OVERLAP_PCT_COURT);
    if (okRho && okOverlap) {
      NStar = results[i].N;
      break;
    }
  }
  if (NStar === 0 && results.length) {
    NStar = results[0].N;
  }

  const proposition = {
    NStar,
    libelle: `Fenêtre courte (Surrepr. / fréquence récente) suggérée: ${NStar} tirages`,
    criteres: { SEUIL_RHO_COURT, SEUIL_OVERLAP_PCT_COURT, K, DELTA, N_MAX_COURT },
  };

  const slidingStep = 50;
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
    const valide = rho >= SEUIL_RHO_COURT && overlapPct >= SEUIL_OVERLAP_PCT_COURT;
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
    pctValides: slidingResults.length ? Math.round((nbValides / slidingResults.length) * 100) : 0,
    detail: slidingResults,
  };

  const fullOutput = {
    meta: { total, DELTA, K, STEP_N, N_MAX_COURT },
    results,
    proposition,
    validationGlissement,
  };
  fs.writeFileSync(outJsonPath, JSON.stringify(fullOutput, null, 2));
  console.log('Écrit:', outJsonPath);

  const htmlPath = path.join(__dirname, '../client/public/data/fenetre-courte-courbes.html');
  const html = buildHtml(fullOutput);
  fs.writeFileSync(htmlPath, html);
  console.log('Écrit:', htmlPath);
  console.log('\nProposition:', proposition.libelle);
  console.log('Validation par glissement:', nbValides + '/' + slidingResults.length, `(${validationGlissement.pctValides}% valides)`);
}

function buildHtml(data: {
  meta: { total: number; K?: number };
  results: { N: number; sigma: number; rho: number; overlapTopK: number; overlapPct: number }[];
  proposition: { NStar: number; libelle: string };
  validationGlissement: { fenetreTirages: number; nbValides: number; nbGlissements: number; pctValides: number };
}): string {
  const { results, proposition, validationGlissement } = data;
  const labels = results.map((r) => r.N);
  const sigmaData = results.map((r) => r.sigma);
  const rhoData = results.map((r) => r.rho);
  const overlapPctData = results.map((r) => r.overlapPct * 100);
  const k = data.meta?.K ?? 12;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>Fenêtre courte – Analyse EuroMillions</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
    h1 { font-size: 1.3rem; }
    h2 { font-size: 1.1rem; margin-top: 1.5rem; }
    .proposition { background: #e3f2fd; padding: 0.75rem 1rem; border-radius: 8px; margin: 1rem 0; }
    .vulgarisation { background: #fff3e0; padding: 0.75rem 1rem; border-radius: 8px; margin: 1rem 0; font-size: 0.95rem; }
    .chart-container { position: relative; height: 280px; margin: 1rem 0; }
  </style>
</head>
<body>
  <h1>Fenêtre courte (Surreprésentation / fréquence récente)</h1>
  <p>σ(N), ρ(N), overlap Top-${k} – du plus récent vers le passé (N plafonné pour rester « court »).</p>

  <div class="proposition">
    <strong>Proposition concrète</strong><br>${proposition.libelle}
  </div>

  <div class="vulgarisation">
    <strong>En bref (Loto)</strong><br>
    On teste des fenêtres courtes (50, 60, … jusqu’à ~450 tirages). Pour chaque N, on regarde σ(N), ρ(N) et l’overlap Top-${k}.
    La « bonne taille courte » est le <b>plus petit</b> N à partir duquel le classement reste encore raisonnablement stable (ρ ≥ 0,90, overlap ≥ 70 % sur 2 pas).
    Fenêtre courte = récent, pour combiner avec la fenêtre longue (fréquence structurelle) et la tendance.
  </div>

  <h2>σ(N) – Dispersion des fréquences</h2>
  <div class="chart-container"><canvas id="chartSigma"></canvas></div>

  <h2>ρ(N) – Stabilité du classement (Spearman)</h2>
  <div class="chart-container"><canvas id="chartRho"></canvas></div>

  <h2>Overlap Top-${k} (%)</h2>
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
      options: { responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: 'N (nb tirages)' } }, y: { min: 0.7, max: 1 } } }
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
