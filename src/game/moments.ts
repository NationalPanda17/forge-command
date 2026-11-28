// The big moments (20.5, design pass C5). Most good news is routine and stays a line in the log; a few things are the
// peaks a term is remembered by, and those get a moment of their own: a motif, a banner in the status bar and a larger
// ripple on the map. Worked out from what changed between two states, on the screen's side only: the simulation is
// untouched.
import type { SimState } from '../sim/types';
import { FINISHED, MATERIALS, SITES, type LineId } from '../sim/world';

export interface Moment {
  key: string;
  text: string;
  /** Where on the map, if anywhere. */
  site?: string;
}

/** The lines of good news that are peaks, not routine. */
const PEAKS = [
  /^Promise kept/,
  /^Objective complete/,
  /^The Committee’s ask is met/,
  /grants your request|grants a supplementary/,
  /has wound down/,
  /^Operation succeeds/,
  /opens and starts/,
];

export const isPeak = (text: string, tone: string) => tone === 'good' && PEAKS.some((re) => re.test(text));

/** Your arsenal that makes a round, for placing its moment on the map. */
const arsenalOf = (s: SimState, l: LineId) => SITES.find((d) => d.owner === 'state' && s.sites[d.id].processes.some((p) => p.recipe === l))?.id;

/**
 * The moments between two states of the same game: peak news filed since `prev`, and any round that has climbed back to
 * its goal at the close of a month (it was under at the month before).
 */
export function momentsBetween(prev: SimState, next: SimState): Moment[] {
  if (prev.seed !== next.seed || next.feed.length < prev.feed.length) return [];
  const out: Moment[] = [];
  next.feed.slice(prev.feed.length).forEach((f, i) => {
    if (isPeak(f.text, f.tone)) out.push({ key: `feed-${prev.feed.length + i}`, text: f.text, site: f.site });
  });
  if (next.history.length > prev.history.length && next.history.length >= 2) {
    const [before, now] = next.history.slice(-2);
    for (const l of FINISHED as LineId[]) {
      const t0 = before.target?.[l];
      const t1 = now.target?.[l];
      if (!t0 || !t1) continue;
      if ((before.stock?.[l] ?? 0) < t0 && (now.stock?.[l] ?? 0) >= t1) {
        out.push({ key: `goal-${next.history.length}-${l}`, text: `${MATERIALS[l].name} is back at the Committee’s goal.`, site: arsenalOf(next, l) });
      }
    }
  }
  return out;
}
