// Finished rounds held as dated lots: adding them, and taking the oldest first.
import type { Lot, SiteState } from './types';
import type { LineId } from './world';

export function addLots(site: SiteState, line: LineId, lots: Lot[]): void {
  const cur = site.lots[line] ?? (site.lots[line] = []);
  for (const l of lots) {
    if (l.qty <= 0) continue;
    const same = cur.find((x) => x.made === l.made && x.until === l.until);
    if (same) same.qty += l.qty;
    else cur.push({ ...l });
  }
  cur.sort((a, b) => a.until - b.until);
}

/** Takes up to qty rounds, oldest first. */
export function takeLots(site: SiteState, line: LineId, qty: number): Lot[] {
  const cur = site.lots[line] ?? [];
  const out: Lot[] = [];
  let left = qty;
  while (left > 1e-9 && cur.length) {
    const l = cur[0];
    const t = Math.min(l.qty, left);
    out.push({ qty: t, made: l.made, until: l.until });
    l.qty -= t;
    left -= t;
    if (l.qty <= 1e-9) cur.shift();
  }
  return out;
}
