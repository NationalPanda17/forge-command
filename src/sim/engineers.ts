// Engineers and academies: skilled engineers are a scarce national resource. Your plant lines, automation, research,
// design work and new lines all need them; a shortage trims plant output and slows research and design. You hire from
// a national market that private firms also drain, engineers quit when overworked or underpaid, and academies train
// new ones after about eighteen months.
import { clamp } from './rng';
import { townIndex, townOf } from './towns';
import type { FeedItem, SimState } from './types';
import { CITIES, SITES, SITE_BY_ID } from './world';

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

export type PayLevel = 'standard' | 'premium';

export interface EngineerState {
  /** Engineers on your payroll. */
  staff: number;
  /** Engineers looking for work, nationally. */
  market: number;
  /** Academies by town; days left to build, or 0 once open. */
  academies: { town: number; days: number }[];
  pay: PayLevel;
  /** Engineers already paid for in the Board's budget (the establishment you inherited). */
  funded: number;
  /** Months in a row with too few engineers (for warnings). */
  short: number;
}

export const ACADEMY_DAYS = 540;
export const academyCost = (s: SimState) => Math.round(40 * s.priceIndex);
/** Signing-on cost per engineer, $M. */
export const signCost = (s: SimState) => 0.03 * s.priceIndex;
/** Monthly salary per engineer, $M. */
export const salary = (s: SimState) => 0.012 * s.priceIndex;
/** What your engineers cost a month beyond the Board's budget: those hired beyond the establishment, and any premium. */
export function engineerPay(s: SimState): number {
  const e = s.engineers;
  return (Math.max(0, e.staff - (e.funded ?? 0)) + (e.pay === 'premium' ? 0.3 * e.staff : 0)) * salary(s);
}

/** Engineers each part of the work needs. */
export function engineerNeed(s: SimState): { plants: number; research: number; design: number; building: number; total: number } {
  let plants = 0;
  let building = 0;
  for (const d of SITES) {
    if (d.owner !== 'state') continue;
    const site = s.sites[d.id];
    if (!site.processes.length || site.status === 'closed' || site.mothballed) continue;
    if (site.status === 'building') {
      building += 10;
      continue;
    }
    for (const p of site.processes) if (p.run !== 'idle') plants += 3 + p.expansions + (p.automated ? 2 : 0);
  }
  building += (s.inhouse?.length ?? 0) * 8 + (s.network?.projects.filter((p) => p.kind === 'automate').length ?? 0) * 4;
  const research = s.strategy.research.active ? 25 : 0;
  const design = s.design ? 15 : 0;
  return { plants, research, design, building, total: plants + research + design + building };
}

/** Engineers you have against those you need, 0..1. */
export function coverage(s: SimState): number {
  if (!s.engineers) return 1;
  const need = engineerNeed(s).total;
  return need <= 0 ? 1 : clamp(s.engineers.staff / need, 0, 1);
}

/** Output of your plants with the engineers they have: a shortage costs up to 15%. */
export const engineerFactor = (s: SimState) => 0.85 + 0.15 * coverage(s);
/** How fast research and design move, a day at a time: at least a third of normal. */
export const workPace = (s: SimState) => Math.max(0.3, coverage(s));

export function newEngineers(s: SimState): EngineerState {
  const need = engineerNeed(s).total;
  // Enough for today's plants, a research project, and a little to spare.
  const staff = Math.ceil(need * 1.1) + 30;
  return { staff, market: 60, academies: [], pay: 'standard', funded: staff, short: 0 };
}

export function validateEngineers(s: SimState, a: { type: string; count?: number; town?: number; level?: PayLevel }): string | null {
  const e = s.engineers;
  switch (a.type) {
    case 'hireEngineers':
      if (!Number.isInteger(a.count) || a.count! < 1) return 'Hire at least one.';
      if (a.count! > Math.floor(e.market)) return `Only ${Math.floor(e.market)} engineers are looking for work.`;
      return s.treasury >= a.count! * signCost(s) ? null : `Not enough money (needs $${Math.ceil(a.count! * signCost(s))}M).`;
    case 'academy':
      if (!CITIES[a.town!]) return 'No such town.';
      if (e.academies.some((x) => x.town === a.town)) return 'That town already has an academy.';
      return s.treasury >= academyCost(s) ? null : `Not enough money (needs $${academyCost(s)}M).`;
    case 'engineerPay':
      return a.level === 'standard' || a.level === 'premium' ? (a.level === e.pay ? 'Already so.' : null) : 'No such pay level.';
  }
  return null;
}

export function applyEngineers(s: SimState, a: { type: string; count?: number; town?: number; level?: PayLevel }, feed: Feed): void {
  const e = s.engineers;
  if (a.type === 'hireEngineers') {
    const cost = a.count! * signCost(s);
    s.treasury -= cost;
    s.month.spend.operations += cost;
    e.market -= a.count!;
    e.staff += a.count!;
    feed(s, 'info', `${a.count} engineers join your staff.`);
  } else if (a.type === 'academy') {
    s.treasury -= academyCost(s);
    s.month.spend.projects += academyCost(s);
    e.academies.push({ town: a.town!, days: ACADEMY_DAYS });
    s.strategy.factions.regions = clamp(s.strategy.factions.regions + 2);
    if (s.communities?.mood[a.town!] !== undefined) s.communities.mood[a.town!] = clamp(s.communities.mood[a.town!] + 5);
    feed(s, 'good', `An engineering academy is founded in ${CITIES[a.town!].name}: its first graduates in about eighteen months.`);
  } else if (a.type === 'engineerPay') {
    e.pay = a.level!;
    feed(s, 'info', a.level === 'premium' ? 'Engineers are paid a 30% premium: fewer will leave for private firms.' : 'Engineers are back on standard pay.');
  }
}

export function engineersMonth(s: SimState, feed: Feed): void {
  const e = s.engineers;
  // Pay.
  const pay = engineerPay(s);
  s.treasury -= pay;
  s.month.spend.operations += pay;
  // Academies open, and graduate.
  for (const a of e.academies) {
    if (a.days > 0) {
      a.days = Math.max(0, a.days - 30);
      if (a.days === 0) feed(s, 'good', `The engineering academy in ${CITIES[a.town].name} opens its doors: graduates join the market every month.`);
    }
  }
  const open = e.academies.filter((a) => a.days === 0).length;
  // The market: universities and academies add, private firms take.
  e.market = Math.max(0, e.market * 0.9 + 6 + 4 * open);
  // Leavers: some always go; underpaid or overworked engineers go faster.
  const cov = coverage(s);
  const rate = 0.008 + (e.pay === 'standard' ? 0.006 : 0) + (cov < 0.75 ? 0.02 : 0);
  const quit = Math.round(e.staff * rate);
  e.staff = Math.max(0, e.staff - quit);
  e.market += quit * 0.5;
  // Warnings.
  e.short = cov < 0.9 ? e.short + 1 : 0;
  if (e.short === 1 || e.short === 4) feed(s, 'warn', `Too few engineers: you have ${e.staff} for work that needs ${engineerNeed(s).total}. Research and design slow down, and plants lose output (Staff tab).`, undefined, e.short === 1);
}

/** The town an academy would serve, by its nearest plant. */
export const academyTowns = (s: SimState) => [...new Set(SITES.filter((d) => d.owner === 'state' && s.sites[d.id].processes.length).map((d) => townIndex(townOf(d.id))))];
export { SITE_BY_ID };
