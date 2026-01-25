import * as cheerio from 'cheerio';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export type FdjDrawResult = {
  drawDate: string; // YYYY-MM-DD
  numbers: number[];
  stars: number[];
  payoutsEuroMillionsCents: Record<string, number | null>; // key: "5+2"
  url: string;
};

function slugifyFr(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    // Remove diacritics (compat TS target)
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildFdjResultUrl(date: Date) {
  // Ex: vendredi-23-janvier-2026
  const weekday = format(date, 'EEEE', { locale: fr });
  const day = format(date, 'd', { locale: fr });
  const month = format(date, 'MMMM', { locale: fr });
  const year = format(date, 'yyyy', { locale: fr });
  const slug = slugifyFr(`${weekday}-${day}-${month}-${year}`);
  return `https://www.fdj.fr/jeux-de-tirage/euromillions-my-million/resultats/${slug}`;
}

function parseEuroAmountToCents(raw: string): number | null {
  const s = String(raw || '').trim();
  if (!s || s === '/' || s === '—') return null;
  // Normalize French formatting: 398 883,80 €  (narrow no-break + comma)
  const cleaned = s
    .replace(/\u202f/g, '') // narrow no-break
    .replace(/\u00a0/g, '') // no-break space
    .replace(/€/g, '')
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function extractNumbersStarsFromSection($: cheerio.CheerioAPI): { numbers: number[]; stars: number[] } | null {
  // FDJ structure: ul#result-grid-1 contains 7 "ball-XX" spans (5 nums + 2 stars)
  const grid = $('ul#result-grid-1');
  if (grid.length) {
    const vals = grid
      .find('span[id^="ball-"]')
      .map((_, el) => Number.parseInt($(el).text().trim(), 10))
      .get()
      .filter((n) => Number.isFinite(n));
    if (vals.length >= 7) {
      return { numbers: vals.slice(0, 5), stars: vals.slice(5, 7) };
    }
  }

  // Fallback: find the first 7 standalone numbers after the heading text in body
  const text = $('body').text();
  const idx = text.toLowerCase().indexOf('résultats euromillions');
  if (idx >= 0) {
    const slice = text.slice(idx, idx + 2000);
    const matches = Array.from(slice.matchAll(/\b([0-9]{1,2})\b/g)).map((m) => Number(m[1]));
    const filtered = matches.filter((n) => n >= 0 && n <= 50);
    if (filtered.length >= 7) {
      return { numbers: filtered.slice(0, 5), stars: filtered.slice(5, 7) };
    }
  }

  return null;
}

function extractPayoutsEuroMillionsCents($: cheerio.CheerioAPI): Record<string, number | null> {
  const payouts: Record<string, number | null> = {};

  // FDJ structure: table#distribution-table exists in HTML (may be in collapsible)
  const table = $('#distribution-table');
  if (!table.length) return payouts;

  table.find('tbody tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (!tds.length) return;

    const c0 = $(tds.get(0)).text().trim();
    const token = c0.replace(/[^\d]/g, ''); // keep leading zeros (01/02)
    if (!token) return;

    let matchNum: number;
    let matchStar: number;
    if (token.length === 1) {
      matchNum = Number(token);
      matchStar = 0;
    } else {
      // FDJ encodes 52, 51, 42, 41, 32, 22, 12, 21, 02, 01...
      matchNum = Number(token[0]);
      matchStar = Number(token[1]);
    }

    if (!Number.isFinite(matchNum) || !Number.isFinite(matchStar)) return;
    if (matchNum < 0 || matchNum > 5 || matchStar < 0 || matchStar > 2) return;

    // Gain: use the LAST euro amount in the row (cumulative column, includes Etoile+ when present)
    let gainCell = '';
    for (const td of Array.from(tds)) {
      const txt = $(td).text().trim();
      if (txt.includes('€')) {
        gainCell = txt;
      }
    }
    const key = `${matchNum}+${matchStar}`;
    payouts[key] = parseEuroAmountToCents(gainCell);
  });

  return payouts;
}

export async function fetchFdjDraw(date: Date): Promise<FdjDrawResult> {
  const drawDate = format(date, 'yyyy-MM-dd');
  const url = buildFdjResultUrl(date);

  const res = await fetch(url, {
    headers: {
      // Helps avoid some anti-bot blocks while staying simple
      'User-Agent': 'Mozilla/5.0 (compatible; LotoFormula4Life/1.0; +https://lotoformula4life.local)',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    },
  });

  if (!res.ok) {
    throw new Error(`FDJ HTTP ${res.status} sur ${url}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const ns = extractNumbersStarsFromSection($);
  if (!ns) {
    throw new Error(`FDJ: impossible d'extraire numéros/étoiles sur ${url}`);
  }

  const payoutsEuroMillionsCents = extractPayoutsEuroMillionsCents($);

  return {
    drawDate,
    numbers: ns.numbers,
    stars: ns.stars,
    payoutsEuroMillionsCents,
    url,
  };
}

