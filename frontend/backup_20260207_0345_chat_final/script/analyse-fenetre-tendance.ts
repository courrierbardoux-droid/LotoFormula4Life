/**
 * Analyse fenêtre Tendance (sens d’évolution : haussière / stabilisée / baissière).
 * On cherche (W*, R*) : fenêtre totale W et période récente R telles que les étiquettes
 * de tendance soient stables quand on décale légèrement R (concordance entre (W,R) et (W,R+δ)).
 *
 * Raisonnement : CDC_Fenetre_Tendance.md
 * Usage: depuis frontend/ : npx tsx script/analyse-fenetre-tendance.ts
 * Génère: frontend/client/public/data/fenetre-tendance-analytics.json
 *         frontend/client/public/data/fenetre-tendance-courbes.html
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type Direction = 'haussière' | 'stabilisée' | 'baissière';

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

/**
 * Étiquettes de tendance pour chaque numéro 1..50 sur une fenêtre de W tirages,
 * en comparant les R derniers à la référence sur W.
 * Logique alignée sur calculerTendances (ratio > 1.2 → haussière, < 0.8 → baissière).
 */
function tendanceLabels(fenêtre: Tirage[], W: number, R: number): Record<number, Direction> {
  const total = fenêtre.slice(0, W);
  const récent = fenêtre.slice(0, R);
  const freqTot = frequencesNumeros(total);
  const freqRec = frequencesNumeros(récent);
  const out: Record<number, Direction> = {} as Record<number, Direction>;
  for (let num = 1; num <= 50; num++) {
    const freqAtt = W > 0 ? (freqTot[num] / W) * R : 0;
    const freqReelle = freqRec[num] ?? 0;
    const ratio = freqAtt > 0 ? freqReelle / freqAtt : 0;
    if (ratio > 1.2) out[num] = 'haussière';
    else if (ratio < 0.8) out[num] = 'baissière';
    else out[num] = 'stabilisée';
  }
  return out;
}

function concordance(l1: Record<number, Direction>, l2: Record<number, Direction>): number {
  let same = 0;
  for (let num = 1; num <= 50; num++) {
    if ((l1[num] ?? 'stabilisée') === (l2[num] ?? 'stabilisée')) same++;
  }
  return same / 50;
}

const STEP_W = 10;
const W_MIN = 50;
const W_MAX = 200;
const R_MIN = 15;
const R_MAX_PCT = 0.5; // R au plus W/2
const DELTA_R = 5;
const SEUIL_CONCORDANCE = 0.85;
const PAS_CONSECUTIFS = 2;
const SLIDING_STEP = 30;

function main() {
  const csvPath = path.join(__dirname, '../client/public/data/euromillions_historique_complet_2004-2025.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('Fichier CSV introuvable:', csvPath);
    process.exit(1);
  }

  const tirages = loadCSV(csvPath);
  const total = tirages.length;
  console.log(`Tirages chargés: ${total} (du ${tirages[total - 1]?.date} au ${tirages[0]?.date})`);

  const results: { W: number; R: number; concordanceR_R5: number; concordanceR5_R10: number; valide: boolean }[] = [];

  for (let W = W_MIN; W <= W_MAX && W <= total - 20; W += STEP_W) {
    const Rmax = Math.min(80, Math.floor(W * R_MAX_PCT));
    for (let R = R_MIN; R + 10 <= Rmax && R + 10 <= W; R += DELTA_R) {
      const lR = tendanceLabels(tirages, W, R);
      const lR5 = tendanceLabels(tirages, W, R + 5);
      const lR10 = tendanceLabels(tirages, W, R + 10);
      const conc1 = concordance(lR, lR5);
      const conc2 = concordance(lR5, lR10);
      const valide = conc1 >= SEUIL_CONCORDANCE && conc2 >= SEUIL_CONCORDANCE;
      results.push({
        W,
        R: R + 5, // on retient le “milieu” de la zone stable
        concordanceR_R5: Math.round(conc1 * 1000) / 1000,
        concordanceR5_R10: Math.round(conc2 * 1000) / 1000,
        valide,
      });
    }
  }

  // Proposition (W*, R*) : plus petit W puis plus petit R valide
  let WStar = 0;
  let RStar = 0;
  const parW = new Map<number, typeof results>();
  for (const r of results) {
    if (!parW.has(r.W)) parW.set(r.W, []);
    parW.get(r.W)!.push(r);
  }
  for (let W = W_MIN; W <= W_MAX; W += STEP_W) {
    const ligne = parW.get(W) ?? [];
    const premierValide = ligne.find((x) => x.valide);
    if (premierValide) {
      WStar = W;
      RStar = premierValide.R;
      break;
    }
  }
  if (WStar === 0 && results.length) {
    WStar = W_MIN;
    RStar = R_MIN + 5;
  }

  const proposition = {
    WStar,
    RStar,
    libelle: `Fenêtre Tendance suggérée: W=${WStar} tirages, période récente R=${RStar} tirages`,
    criteres: { SEUIL_CONCORDANCE, DELTA_R, PAS_CONSECUTIFS, W_MIN, W_MAX, R_MIN },
  };

  // Validation par glissement : fenêtre W* glissée, à chaque pas on compare tendance (W*,R*) à la fenêtre décalée de SLIDING_STEP
  const slidingResults: { debut: number; fin: number; concordance: number; valide: boolean }[] = [];
  for (let i = 0; i + WStar + SLIDING_STEP <= total; i += SLIDING_STEP) {
    const win1 = tirages.slice(i, i + WStar);
    const win2 = tirages.slice(i + SLIDING_STEP, i + SLIDING_STEP + WStar);
    const l1 = tendanceLabels(win1, WStar, RStar);
    const l2 = tendanceLabels(win2, WStar, RStar);
    const conc = concordance(l1, l2);
    slidingResults.push({
      debut: i,
      fin: i + WStar - 1,
      concordance: Math.round(conc * 1000) / 1000,
      valide: conc >= SEUIL_CONCORDANCE,
    });
  }
  const nbValides = slidingResults.filter((r) => r.valide).length;
  const validationGlissement = {
    W: WStar,
    R: RStar,
    nbGlissements: slidingResults.length,
    nbValides,
    pctValides: slidingResults.length ? Math.round((nbValides / slidingResults.length) * 100) : 0,
    detail: slidingResults,
  };

  // Résumé par W pour les courbes (moyenne de concordance et % valides par W)
  const parWResume = new Map<
    number,
    { W: number; concordanceMoy: number; pctValides: number; meilleurR: number }
  >();
  for (let W = W_MIN; W <= W_MAX; W += STEP_W) {
    const ligne = parW.get(W) ?? [];
    if (ligne.length === 0) continue;
    const moy = ligne.reduce((s, x) => s + (x.concordanceR_R5 + x.concordanceR5_R10) / 2, 0) / ligne.length;
    const valides = ligne.filter((x) => x.valide).length;
    const meilleurR = ligne.find((x) => x.valide)?.R ?? ligne[0]?.R ?? 0;
    parWResume.set(W, {
      W,
      concordanceMoy: Math.round(moy * 1000) / 1000,
      pctValides: ligne.length ? Math.round((valides / ligne.length) * 100) : 0,
      meilleurR,
    });
  }

  const resumeParW = Array.from(parWResume.values()).sort((a, b) => a.W - b.W);

  const fullOutput = {
    meta: { total, W_MIN, W_MAX, R_MIN, DELTA_R, SEUIL_CONCORDANCE, PAS_CONSECUTIFS },
    results,
    resumeParW,
    proposition,
    validationGlissement,
  };

  const outJsonPath = path.join(__dirname, '../client/public/data/fenetre-tendance-analytics.json');
  fs.writeFileSync(outJsonPath, JSON.stringify(fullOutput, null, 2));
  console.log('Écrit:', outJsonPath);

  const htmlPath = path.join(__dirname, '../client/public/data/fenetre-tendance-courbes.html');
  const html = buildHtml(fullOutput);
  fs.writeFileSync(htmlPath, html);
  console.log('Écrit:', htmlPath);
  console.log('\nProposition:', proposition.libelle);
  console.log(
    'Validation par glissement:',
    nbValides + '/' + slidingResults.length,
    `(${validationGlissement.pctValides}% valides)`
  );
}

function buildHtml(data: {
  meta: { total: number; W_MIN: number; W_MAX: number; SEUIL_CONCORDANCE: number };
  resumeParW: { W: number; concordanceMoy: number; pctValides: number; meilleurR: number }[];
  proposition: { WStar: number; RStar: number; libelle: string };
  validationGlissement: { W: number; R: number; nbValides: number; nbGlissements: number; pctValides: number };
}): string {
  const { resumeParW, proposition, validationGlissement, meta } = data;
  const labels = resumeParW.map((r) => r.W);
  const concordanceMoy = resumeParW.map((r) => r.concordanceMoy * 100);
  const pctValides = resumeParW.map((r) => r.pctValides);
  const meilleurR = resumeParW.map((r) => r.meilleurR);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>Fenêtre Tendance – Analyse EuroMillions</title>
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
  <h1>Fenêtre Tendance (sens d’évolution)</h1>
  <p>Stabilité des étiquettes haussière / stabilisée / baissière quand on varie W et R. Seuil concordance ≥ ${meta.SEUIL_CONCORDANCE * 100} %.</p>

  <div class="proposition">
    <strong>Proposition</strong><br>${proposition.libelle}
  </div>

  <div class="vulgarisation">
    <strong>En bref (Loto)</strong><br>
    La Tendance dit si un numéro est « en montée », « stable » ou « en baisse » sur la période récente par rapport à la fenêtre. 
    On cherche la plus petite fenêtre W et la plus petite période récente R pour lesquelles ce sens d’évolution ne change pas trop 
    quand on décale un peu la fenêtre (concordance ≥ ${meta.SEUIL_CONCORDANCE * 100} %). 
    Ces valeurs (W*, R*) servent dans le tableau des scénarios de probabilité pour filtrer ou pondérer les candidats.
  </div>

  <h2>Concordance moyenne (étiquettes) par W (%)</h2>
  <div class="chart-container"><canvas id="chartConcordance"></canvas></div>

  <h2>% de (W,R) valides par W</h2>
  <div class="chart-container"><canvas id="chartValides"></canvas></div>

  <h2>Meilleur R par W</h2>
  <div class="chart-container"><canvas id="chartR"></canvas></div>

  <h2>Validation par glissement</h2>
  <p>Fenêtre W=${validationGlissement.W}, R=${validationGlissement.R} glissée sur l’historique : ${validationGlissement.nbValides}/${validationGlissement.nbGlissements} fenêtres valides (${validationGlissement.pctValides} %).</p>

  <script>
    const labels = ${JSON.stringify(labels)};
    new Chart(document.getElementById('chartConcordance'), {
      type: 'line',
      data: { labels, datasets: [{ label: 'Concordance moy. (%)', data: ${JSON.stringify(concordanceMoy)}, borderColor: '#1976d2', fill: false }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: 'W (nb tirages)' } }, y: { min: 70, max: 100 } } }
    });
    new Chart(document.getElementById('chartValides'), {
      type: 'line',
      data: { labels, datasets: [{ label: '% (W,R) valides', data: ${JSON.stringify(pctValides)}, borderColor: '#2e7d32', fill: false }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: 'W (nb tirages)' } }, y: { min: 0, max: 100 } } }
    });
    new Chart(document.getElementById('chartR'), {
      type: 'line',
      data: { labels, datasets: [{ label: 'Meilleur R', data: ${JSON.stringify(meilleurR)}, borderColor: '#7b1fa2', fill: false }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: 'W (nb tirages)' } } } }
    });
  </script>
</body>
</html>`;
}

main();
