// Running costs against the budget (20.1, design pass C0). Hiring, expansions, housing and contracts each look
// affordable on the day they are paid for, but each adds to every month after. When the recurring bill outgrows the
// budget, the treasury drains month by month however careful each single purchase was. These helpers measure that gap,
// so the safe advice and the chief of staff can keep enough in hand to carry it, and the advisor can say so.
import DEPTH from './tuning/depth.json';
import type { SimState } from './types';

const T = DEPTH.spending;

/**
 * How much more the game spends each month than its regular income, averaged over the last few months ($M a month;
 * 0 or less when the budget covers the running costs). Recurring costs only: purchases, wages and running costs,
 * power, freight and disposal. One-off projects (building, research, expansions) are left out, and so are one-off
 * receipts such as supplements and objective rewards: the regular income is the appropriation and export sales.
 */
export function runningGap(s: SimState): number {
  const recent = s.history.slice(-T.gapMonths);
  if (!recent.length) return 0;
  let gap = 0;
  for (const h of recent) {
    const out = h.spend.purchases + h.spend.operations + h.spend.transport + h.spend.demil + (h.spend.energy ?? 0);
    gap += out - (s.appropriation + h.income.sales);
  }
  return gap / recent.length;
}

/**
 * The cash to keep in hand before any new spending: the base reserve, plus enough to carry the running gap for
 * `reserveMonths` (the gap is 0 when the budget covers the running costs, so this is then the base reserve).
 */
export function prudentReserve(s: SimState, base: number): number {
  return base + T.reserveMonths * Math.max(0, runningGap(s));
}

/** Months until the treasury runs out at the current running gap; null when the budget covers the running costs. */
export function runway(s: SimState): number | null {
  const gap = runningGap(s);
  if (gap <= 0) return null;
  return Math.max(0, s.treasury) / gap;
}
