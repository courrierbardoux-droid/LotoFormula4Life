import { addDays, format, isTuesday, isFriday, subDays } from 'date-fns';
import { fetchFdjDraw } from './fdjScraper';

type RunResult =
  | { ok: true; drawDate: string; numbers: number[]; stars: number[]; payoutsCount: number; url: string }
  | { ok: false; message: string; url?: string; drawDate?: string };

function normalizeDate(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

function getLatestDrawDateCandidate(now: Date) {
  // Draw days: Tuesday & Friday at 21:00 Paris time.
  // We want the latest draw date where results are AVAILABLE (i.e., tirage already happened).
  // If today is Tue/Fri but before ~21:30, skip today and go to the previous draw day.
  const currentHour = now.getUTCHours() + 1; // Approximate Paris time (UTC+1)
  const drawHour = 21; // Tirage at 21h Paris time
  
  for (let i = 0; i < 7; i++) {
    const d = subDays(now, i);
    if (isTuesday(d) || isFriday(d)) {
      // If it's today and before draw time, skip to previous draw day
      if (i === 0 && currentHour < drawHour + 1) {
        continue; // Skip today, tirage not yet happened
      }
      return d;
    }
  }
  return now;
}

export async function runHistoryAutoUpdateOnce(opts: { hasDatabase: boolean }): Promise<RunResult> {
  if (!opts.hasDatabase) {
    return { ok: false, message: "AUTO indisponible sans base de données" };
  }

  // Ensure required tables exist (self-heal)
  try {
    const { ensureAutoUpdateTables } = await import('./ensureAutoUpdateTables');
    await ensureAutoUpdateTables();
  } catch {
    // ignore
  }

  const { db } = await import('../db');
  const { draws, drawPayouts, autoUpdateRuns } = await import('../db/schema');
  const { eq, desc, lt } = await import('drizzle-orm');

  const startedAt = new Date();
  const expiresAt = addDays(startedAt, 65);

  // Determine which draw date to try: newest Tue/Fri
  const now = new Date();
  const candidate = getLatestDrawDateCandidate(now);
  const drawDate = normalizeDate(candidate);

  // If already present in DB, still refresh payouts (in case they appear later)
  let urlForLog: string | undefined = undefined;

  try {
    const fdj = await fetchFdjDraw(candidate);
    urlForLog = fdj.url;

    // Upsert draw
    await db
      .insert(draws)
      .values({ date: fdj.drawDate, numbers: fdj.numbers, stars: fdj.stars })
      .onConflictDoUpdate({
        target: draws.date,
        set: { numbers: fdj.numbers, stars: fdj.stars },
      });

    // Upsert payout (FDJ) — keep 65 days
    await db
      .insert(drawPayouts)
      .values({
        drawDate: fdj.drawDate,
        payouts: fdj.payoutsEuroMillionsCents,
        source: 'fdj',
        fetchedAt: new Date(),
        expiresAt,
      })
      .onConflictDoUpdate({
        target: drawPayouts.drawDate,
        set: {
          payouts: fdj.payoutsEuroMillionsCents,
          source: 'fdj',
          fetchedAt: new Date(),
          expiresAt,
        },
      });

    // Log run (success)
    await db.insert(autoUpdateRuns).values({
      source: 'fdj',
      startedAt,
      finishedAt: new Date(),
      success: 1,
      drawDate: fdj.drawDate,
      message: 'OK',
      url: fdj.url,
      expiresAt,
    });

    // Détection gagnants + emails immédiats
    try {
      const { computeAndPersistWinnersForDraw } = await import('./winnerService');
      await computeAndPersistWinnersForDraw({ drawDate: fdj.drawDate, hasDatabase: opts.hasDatabase, sendEmails: true });
    } catch {
      // ne pas bloquer l'auto-update si la phase gagnants échoue
    }

    // Cleanup expired (best-effort)
    try {
      await db.delete(drawPayouts).where(lt(drawPayouts.expiresAt, new Date()) as any);
      await db.delete(autoUpdateRuns).where(lt(autoUpdateRuns.expiresAt, new Date()) as any);
    } catch {}

    return {
      ok: true,
      drawDate: fdj.drawDate,
      numbers: fdj.numbers,
      stars: fdj.stars,
      payoutsCount: Object.keys(fdj.payoutsEuroMillionsCents || {}).length,
      url: fdj.url,
    };
  } catch (e: any) {
    const msg = String(e?.message || e);

    // Log run (failure)
    try {
      await db.insert(autoUpdateRuns).values({
        source: 'fdj',
        startedAt,
        finishedAt: new Date(),
        success: 0,
        drawDate,
        message: msg.slice(0, 2000),
        url: urlForLog,
        expiresAt,
      });
    } catch {}

    return { ok: false, message: msg, url: urlForLog, drawDate };
  }
}

export function startHistoryAutoUpdater(opts: { hasDatabase: boolean; getMode: () => Promise<'auto' | 'manual'> }) {
  if (!opts.hasDatabase) return;

  const parseHHMM = (s: string) => {
    const m = String(s || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    if (hh < 0 || hh > 23) return null;
    if (mm < 0 || mm > 59) return null;
    return { hh, mm, minutes: hh * 60 + mm };
  };

  const tick = async () => {
    try {
      const mode = await opts.getMode();
      if (mode !== 'auto') return;

      const now = new Date();
      const isDrawDay = isTuesday(now) || isFriday(now);
      const hhmm = now.getHours() * 60 + now.getMinutes();

      // Window: configurable HH:MM -> HH:MM + 90 minutes (retry)
      if (!isDrawDay) return;
      let startMin = 22 * 60;
      try {
        const g: any = globalThis as any;
        // opts may not provide schedule getter (compat); use global cached value if present
        const scheduleTime = typeof (opts as any).getScheduleTime === 'function' ? await (opts as any).getScheduleTime() : (g.__l4lScheduleTime ?? null);
        if (typeof scheduleTime === 'string') g.__l4lScheduleTime = scheduleTime;
        const parsed = parseHHMM(typeof scheduleTime === 'string' ? scheduleTime : '22:00');
        if (parsed) startMin = parsed.minutes;
      } catch {
        // ignore, keep default
      }
      const endMin = Math.min(23 * 60 + 59, startMin + 90);
      if (hhmm < startMin || hhmm > endMin) return;

      // Avoid spamming: only run once per 10 minutes
      const key = `l4l_auto_fdj_last_run`;
      const g: any = globalThis as any;
      const last = Number(g[key] || 0);
      if (Date.now() - last < 10 * 60 * 1000) return;
      g[key] = Date.now();

      await runHistoryAutoUpdateOnce({ hasDatabase: opts.hasDatabase });
    } catch {
      // ignore
    }
  };

  // Start loop: every 60 seconds
  setInterval(tick, 60 * 1000);
  // fire once quickly
  tick().catch(() => {});
}

