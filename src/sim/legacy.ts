// The end of a term: the moments that defined it, the title history gives you, and what you carry into the next term,
// good and bad: a boon you choose for what you did well, and the grudges you made.
import { termReport } from './analytics';
import { bestManager, TRAITS } from './cast';
import { FORKS, doctrineDef, industryName } from './doctrine';
import { clamp } from './rng';
import type { FeedItem, SimState } from './types';
import { SITE_BY_ID } from './world';

export interface Moment {
  day: number;
  tone: FeedItem['tone'];
  text: string;
}

/** How much a moment mattered, for picking the ones a term is remembered by. */
export function weight(m: Moment): number {
  const t = m.text;
  // A card waiting for an answer is the start of a story, not a moment in it.
  if (/A decision is waiting/.test(t)) return 1;
  if (/^Crisis|has begun/.test(t)) return 6;
  if (/^Doctrine adopted/.test(t)) return 5;
  if (/ fields /.test(t)) return 5;
  if (/^Promise (kept|broken)|programme (ends|is cancelled)/.test(t)) return 4;
  if (/^Objective complete|The Committee (grants|votes)/.test(t)) return 4;
  if (/^Operation succeeds|operation is exposed/.test(t)) return 4;
  if (/^Research complete|^Accepted:|opens and starts|opens to traffic/.test(t)) return 3;
  if (/^Strike at|spreads|^Accident|black out|^A blackout|Ransomware|^Sabotage|stolen|has closed/.test(t)) return 3;
  return m.tone === 'info' ? 1 : 2;
}

/** The moments of this term, at most n, the weightiest first chosen and then shown in order. */
/** Moments of the current term: after the day it began. */
export const termMoments = (s: SimState) => (s.moments ?? []).filter((m) => m.day > (s.termStartDay ?? -1));

export function keyMoments(s: SimState, n = 12): Moment[] {
  const all = termMoments(s);
  // Two of the same kind of line count once.
  const seen = new Set<string>();
  const ranked = all
    .map((m, i) => ({ m, i, w: weight(m) }))
    .sort((a, b) => b.w - a.w || b.i - a.i)
    .filter(({ m }) => {
      const key = m.text.split(/[:.]/)[0].slice(0, 28);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, n);
  return ranked.sort((a, b) => a.m.day - b.m.day || a.i - b.i).map((x) => x.m);
}

// ---------- The title ----------

export interface Legacy {
  title: string;
  why: string;
  industry: string;
  doctrines: string[];
  people: string | null;
  carry: { tone: 'good' | 'bad' | 'info'; text: string }[];
}

/** The counts the title and the boons are drawn from. */
export function termStats(s: SimState) {
  const h = s.history.slice(s.termMonth ?? 0);
  const start = s.termStartDay ?? -1;
  const inTerm = termMoments(s);
  const count = (re: RegExp) => inTerm.filter((m) => re.test(m.text)).length;
  // This term's work only: plants opened, research finished and academies founded since it began.
  const plants = count(/opens and starts to ramp up/);
  const ops = (s.intel?.record ?? []).filter((r) => r.day > start);
  const avgMorale = (() => {
    const own = Object.values(s.sites).filter((x) => SITE_BY_ID[x.id]?.owner === 'state' && x.processes.length && x.status !== 'closed');
    return own.length ? own.reduce((a, x) => a + x.morale, 0) / own.length : 60;
  })();
  const allies = Object.values(s.allies ?? {}) as number[];
  return {
    avgReadiness: h.length ? h.reduce((a, x) => a + x.readiness, 0) / h.length : 0,
    strikes: h.reduce((a, x) => a + (x.strikes ?? 0), 0),
    brokenPromises: count(/^Promise broken/),
    keptPromises: count(/^Promise kept/),
    plants,
    research: count(/^Research complete/),
    opsWon: ops.filter((r) => r.result === 'success').length,
    opsExposed: ops.filter((r) => r.exposed).length,
    exported: h.reduce((a, x) => a + (x.exported ?? 0), 0),
    avgMorale,
    allies: allies.length ? allies.reduce((a, b) => a + b, 0) / allies.length : 50,
    academies: count(/engineering academy is founded/),
    treasury: s.treasury,
  };
}

export function legacyOf(s: SimState): Legacy {
  const t = termStats(s);
  const r = termReport(s);
  const pickTitle = (): [string, string] => {
    if (s.outcome === 'dismissed') return ['The Director Who Fell', 'The Committee lost patience before the term was out.'];
    if (t.opsWon >= 3 && t.opsWon > t.opsExposed) return ['The Spymaster', `${t.opsWon} operations against the rival succeeded.`];
    if (t.plants >= 2) return ['The Builder', `You founded ${t.plants} new plants.`];
    if (t.avgReadiness >= 0.85) return ['The Quartermaster', `Readiness averaged ${Math.round(t.avgReadiness * 100)}% across the term.`];
    if (t.exported >= 500) return ['The Merchant of Arms', 'Your plants sold widely abroad.'];
    if (t.avgMorale >= 70 && t.strikes === 0) return ['The Workers’ Director', 'Not one strike, and crews in good heart.'];
    if (t.research >= 8) return ['The Engineer', `${t.research} research projects completed.`];
    if (t.treasury >= 2000) return ['The Treasurer', 'You left the books in rude health.'];
    if (t.allies >= 70) return ['The Diplomat', 'The allies count you a friend.'];
    if (r.grade === 'A' || r.grade === 'B') return ['A Steady Hand', 'A sound term, with few alarms.'];
    return ['The Survivor', 'You saw the term out.'];
  };
  const [title, why] = pickTitle();
  const best = bestManager(s);
  const carry: Legacy['carry'] = [
    { tone: 'info', text: 'Your plants, rail links, stock, doctrines, people and engineers all stay as they are.' },
    ...(s.treasury < 0 ? [{ tone: 'bad' as const, text: `A debt of $${Math.round(-s.treasury)}M comes with you.` }] : []),
    ...(t.brokenPromises ? [{ tone: 'bad' as const, text: `${t.brokenPromises} broken promise${t.brokenPromises > 1 ? 's are' : ' is'} remembered: the Committee starts the term cooler toward you.` }] : []),
    ...(t.opsExposed ? [{ tone: 'bad' as const, text: `The rival remembers ${t.opsExposed} exposed operation${t.opsExposed > 1 ? 's' : ''}: its next weapon comes sooner.` }] : []),
    ...(t.keptPromises ? [{ tone: 'good' as const, text: `${t.keptPromises} kept promise${t.keptPromises > 1 ? 's' : ''} earn goodwill on the Committee.` }] : []),
  ];
  return {
    title,
    why,
    industry: industryName(s),
    doctrines: FORKS.filter((f) => s.doctrine?.chosen[f.id]).map((f) => doctrineDef(f.id, s.doctrine.chosen[f.id]!).name),
    people: best ? `${best.m.name}, ${TRAITS[best.m.trait].name.toLowerCase()} manager at ${SITE_BY_ID[best.site].name} (level ${best.m.level})` : null,
    carry,
  };
}

// ---------- Boons for the next term ----------

export type BoonId = 'committee' | 'workforce' | 'allies' | 'arsenal' | 'engineers' | 'shadow' | 'fresh';
export const BOONS: Record<BoonId, { name: string; blurb: string }> = {
  committee: { name: 'The Committee’s trust', blurb: 'Your budget rises 5%.' },
  workforce: { name: 'A loyal workforce', blurb: 'Morale +10 in every plant, and every manager’s loyalty +15.' },
  allies: { name: 'Friends abroad', blurb: 'Every ally +15.' },
  arsenal: { name: 'A full arsenal', blurb: 'Confidence +5, and the hawks +8.' },
  engineers: { name: 'A school of engineers', blurb: '40 more engineers looking for work, and academies open six months sooner.' },
  shadow: { name: 'Deep cover', blurb: 'Your intelligence service grows a level.' },
  fresh: { name: 'A fresh start', blurb: 'A one-off grant of $100M (at today’s prices).' },
};

/** The boons this term earned: up to three, by what you did well, with a fresh start if fewer. */
export function boonsFor(s: SimState): BoonId[] {
  const t = termStats(s);
  // Each earned boon, by how far you beat its bar: the three you did best at are offered.
  const earned: [BoonId, number][] = [];
  if (s.confidence >= 60) earned.push(['committee', (s.confidence - 60) / 20]);
  if (t.avgMorale >= 60 && t.strikes <= 2) earned.push(['workforce', (t.avgMorale - 60) / 15]);
  if (t.avgReadiness >= 0.75) earned.push(['arsenal', (t.avgReadiness - 0.75) / 0.1]);
  if (t.allies >= 55) earned.push(['allies', (t.allies - 55) / 15]);
  if (t.academies > 0) earned.push(['engineers', 0.5 + 0.5 * t.academies]);
  if (t.opsWon >= 2 && (s.intel?.agency ?? 0) < 3) earned.push(['shadow', t.opsWon / 2]);
  const top = earned.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([b]) => b);
  if (top.length < 3) top.push('fresh');
  return top;
}

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

/** The grudges and goodwill a term leaves. Call with the stats of the term just ended. */
export function grudges(s: SimState, t: ReturnType<typeof termStats>): void {
  const f = s.strategy.factions;
  if (t.brokenPromises) for (const k of Object.keys(f) as (keyof typeof f)[]) f[k] = clamp(f[k] - 3 * t.brokenPromises);
  if (t.keptPromises) for (const k of Object.keys(f) as (keyof typeof f)[]) f[k] = clamp(f[k] + 1.5 * t.keptPromises);
  if (t.opsExposed && s.rival.known.length < s.rival.order.length) s.rival.next = Math.max(s.day + 30, s.rival.next - 30 * t.opsExposed);
}

/** The legacy you chose. Call once the new term's numbers are set, so nothing overwrites it. */
export function applyBoon(s: SimState, boon: BoonId | undefined, feed: Feed): void {
  const f = s.strategy.factions;
  switch (boon) {
    case 'committee':
      s.appropriation = Math.round(s.appropriation * 1.05);
      s.strategy.baseBudget = Math.round(s.strategy.baseBudget * 1.05);
      break;
    case 'workforce':
      for (const x of Object.values(s.sites)) if (SITE_BY_ID[x.id]?.owner === 'state') x.morale = clamp(x.morale + 10);
      for (const m of Object.values(s.cast?.managers ?? {})) m.loyalty = clamp(m.loyalty + 15);
      break;
    case 'allies':
      for (const k of Object.keys(s.allies) as (keyof typeof s.allies)[]) s.allies[k] = clamp(s.allies[k] + 15);
      break;
    case 'arsenal':
      s.confidence = clamp(s.confidence + 5);
      f.hawks = clamp(f.hawks + 8);
      break;
    case 'engineers':
      if (s.engineers) {
        s.engineers.market += 40;
        for (const a of s.engineers.academies) a.days = Math.max(0, a.days - 180);
      }
      break;
    case 'shadow':
      if (s.intel) s.intel.agency = Math.min(3, s.intel.agency + 1);
      break;
    case 'fresh':
      s.treasury += Math.round(100 * s.priceIndex);
      break;
  }
  if (boon) feed(s, 'good', `Your legacy carries over: ${BOONS[boon].name.toLowerCase()}. ${BOONS[boon].blurb}`);
}

