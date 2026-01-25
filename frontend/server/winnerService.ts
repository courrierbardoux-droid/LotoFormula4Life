import { addDays } from 'date-fns';

export type WinnerRow = {
  id: number;
  gridId: number;
  targetDate: string;
  matchNum: number;
  matchStar: number;
  gainCents: number | null;
  emailNotifiedAt: string | null;
  seenAt: string | null;
};

function normalizeDate(raw: any): string {
  return String(raw || '').split('T')[0].split(' ')[0];
}

function key(matchNum: number, matchStar: number) {
  return `${matchNum}+${matchStar}`;
}

export async function computeAndPersistWinnersForDraw(opts: {
  drawDate: string; // YYYY-MM-DD
  hasDatabase: boolean;
  sendEmails?: boolean;
}) {
  if (!opts.hasDatabase) return { success: true, winners: 0, emailed: 0 };

  // Ensure required tables exist (self-heal)
  try {
    const { ensureAutoUpdateTables } = await import('./ensureAutoUpdateTables');
    await ensureAutoUpdateTables();
  } catch {
    // ignore
  }

  const { db } = await import('../db');
  const { draws, grids, users, drawPayouts, winningGrids } = await import('../db/schema');
  const { eq, and, isNull } = await import('drizzle-orm');

  const drawDate = normalizeDate(opts.drawDate);

  const [draw] = await db.select().from(draws).where(eq(draws.date, drawDate)).limit(1);
  if (!draw) return { success: false, error: `Tirage introuvable en DB (${drawDate})` };

  const numbers = Array.isArray(draw.numbers) ? (draw.numbers as number[]) : [];
  const stars = Array.isArray(draw.stars) ? (draw.stars as number[]) : [];

  const [payout] = await db.select().from(drawPayouts).where(eq(drawPayouts.drawDate, drawDate)).limit(1);
  const payoutMap: Record<string, number | null> = (payout?.payouts as any) || {};

  // Grilles qui visaient ce tirage
  const rows = await db
    .select({
      grid: grids,
      user: users,
    })
    .from(grids)
    .innerJoin(users, eq(grids.userId, users.id))
    .where(eq(grids.targetDate, drawDate));

  let winnersCount = 0;
  const now = new Date();

  for (const { grid, user } of rows as any[]) {
    const gNums: number[] = Array.isArray(grid.numbers) ? grid.numbers : [];
    const gStars: number[] = Array.isArray(grid.stars) ? grid.stars : [];

    const matchNum = gNums.filter((n) => numbers.includes(n)).length;
    const matchStar = gStars.filter((s) => stars.includes(s)).length;

    const k = key(matchNum, matchStar);
    const gainCents = payoutMap[k] ?? 0;

    const isJackpot = matchNum === 5 && matchStar === 2 && payoutMap[k] == null;
    const isWin = (typeof gainCents === 'number' && gainCents > 0) || isJackpot;
    if (!isWin) continue;

    winnersCount += 1;

    await db
      .insert(winningGrids)
      .values({
        userId: user.id,
        usernameSnapshot: user.username,
        gridId: grid.id,
        targetDate: drawDate,
        matchNum,
        matchStar,
        gainCents: isJackpot ? null : (gainCents as number),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [winningGrids.gridId, winningGrids.targetDate],
        set: {
          usernameSnapshot: user.username,
          matchNum,
          matchStar,
          gainCents: isJackpot ? null : (gainCents as number),
          updatedAt: now,
        },
      });
  }

  // Envoyer emails immédiatement (une seule fois par grille/targetDate)
  let emailed = 0;
  if (opts.sendEmails) {
    const { sendWinnerEmailToUser } = await import('./email');
    const exp = addDays(new Date(), 65);
    const toEmail = await db
      .select({
        win: winningGrids,
        user: users,
        grid: grids,
      })
      .from(winningGrids)
      .innerJoin(users, eq(winningGrids.userId, users.id))
      .innerJoin(grids, eq(winningGrids.gridId, grids.id))
      .where(and(eq(winningGrids.targetDate, drawDate), isNull(winningGrids.emailNotifiedAt)));

    for (const { win, user, grid } of toEmail as any[]) {
      const ok = await sendWinnerEmailToUser({
        to: user.email,
        username: user.username,
        drawDate,
        matchNum: win.matchNum,
        matchStar: win.matchStar,
        gainCents: win.gainCents == null ? null : Number(win.gainCents),
        gridNumbers: Array.isArray(grid.numbers) ? grid.numbers : [],
        gridStars: Array.isArray(grid.stars) ? grid.stars : [],
        drawNumbers: numbers,
        drawStars: stars,
      });
      if (ok) {
        emailed += 1;
        await db
          .update(winningGrids)
          .set({ emailNotifiedAt: new Date(), updatedAt: new Date() })
          .where(eq(winningGrids.id, win.id));
      }
    }

    // best-effort cleanup of expired payouts/runs is elsewhere; no-op here.
    void exp;
  }

  return { success: true, winners: winnersCount, emailed };
}

