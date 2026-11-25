// Doctrine: five forks in how you run the industry. Each fork has two answers, and choosing one closes the other for
// good, so every game builds a different industry. A doctrine takes money and months to bed in, one at a time, and the
// later forks open only once earlier ones are settled.
import { clamp } from './rng';
import type { FeedItem, SimState } from './types';
import { RECIPES, type LineId } from './world';

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

export type ForkId = 'production' | 'supply' | 'workforce' | 'reserves' | 'rival';
export type Side = 'a' | 'b';
export type DoctrineId = `${ForkId}:${Side}`;

export interface DoctrineDef {
  name: string;
  pro: string;
  con: string;
}

export interface ForkDef {
  id: ForkId;
  title: string;
  question: string;
  tier: 1 | 2 | 3;
  a: DoctrineDef;
  b: DoctrineDef;
}

export const FORKS: ForkDef[] = [
  {
    id: 'production',
    title: 'Production',
    question: 'Make more, or make better?',
    tier: 1,
    a: { name: 'Mass production', pro: 'Shells, GMLRS, APKWS, Tamir and Coyote lines make 15% more.', con: 'PAC-3, SM-6, IRIS-T, Stinger and Javelin lines make 5% less.' },
    b: { name: 'Precision first', pro: 'PAC-3, SM-6, IRIS-T, Stinger and Javelin lines make 8% more and scrap 40% less.', con: 'Shells, GMLRS, APKWS, Tamir and Coyote lines make 5% less.' },
  },
  {
    id: 'supply',
    title: 'Supply',
    question: 'Buy at home, or lean on your allies?',
    tier: 1,
    a: { name: 'Home-grown supply', pro: 'Parts from your own country’s firms cost 8% less, and industry backs you every month.', con: 'Parts from abroad cost 10% more.' },
    b: { name: 'Allied supply chains', pro: 'Parts from abroad cost 12% less, export bans are 40% rarer, and the allies warm to you.', con: 'The industry caucus cools a little every month.' },
  },
  {
    id: 'workforce',
    title: 'Workforce',
    question: 'Machines, or masters of the trade?',
    tier: 2,
    a: { name: 'Lights-out factories', pro: 'Automating a line costs 40% less, automated lines scrap less, and unions slowly weaken.', con: 'Morale settles 3 points lower in every plant.' },
    b: { name: 'Master craftsmen', pro: 'Morale settles 5 points higher, accidents are 40% rarer, and crews can grow more skilled.', con: 'Automating a line costs 25% more.' },
  },
  {
    id: 'reserves',
    title: 'Reserves',
    question: 'Stockpile deep, or run lean?',
    tier: 2,
    a: { name: 'Deep reserves', pro: 'New rounds last 25% longer on the shelf, and the hawks approve every month.', con: 'Running costs rise 3% for the extra storage.' },
    b: { name: 'Lean logistics', pro: 'Freight costs 25% less, and the treasury bench approves every month.', con: 'New rounds last 10% less long on the shelf.' },
  },
  {
    id: 'rival',
    title: 'The rival',
    question: 'Deter it openly, or fight it in the shadows?',
    tier: 3,
    a: { name: 'Visible deterrence', pro: 'The rival attacks 7% less, and the hawks back you every month.', con: 'Intelligence operations’ odds of success fall 10 points.' },
    b: { name: 'Shadow war', pro: 'Operations’ odds of success rise 12 points, exposure falls 8 points, and growing your service costs 30% less.', con: 'The allies grow wary of what you do in the dark.' },
  },
];
export const FORK_BY_ID = Object.fromEntries(FORKS.map((f) => [f.id, f])) as Record<ForkId, ForkDef>;
export const doctrineDef = (f: ForkId, side: Side) => FORK_BY_ID[f][side];

export interface DoctrineState {
  chosen: Partial<Record<ForkId, Side>>;
  active: { fork: ForkId; side: Side; days: number; total: number } | null;
}
export const newDoctrine = (): DoctrineState => ({ chosen: {}, active: null });

export const TIER = { 1: { cost: 40, days: 90 }, 2: { cost: 60, days: 120 }, 3: { cost: 80, days: 150 } } as const;
export const doctrineCost = (s: SimState, f: ForkId) => Math.round(TIER[FORK_BY_ID[f].tier].cost * s.priceIndex);
/** Doctrines settled so far. */
export const chosenCount = (s: SimState) => Object.keys(s.doctrine?.chosen ?? {}).length;
/** How many doctrines must be settled before a tier opens. */
export const TIER_NEEDS = { 1: 0, 2: 1, 3: 2 } as const;
export const forkOpen = (s: SimState, f: ForkId) => chosenCount(s) >= TIER_NEEDS[FORK_BY_ID[f].tier];

/** Is this doctrine in force? */
export const has = (s: SimState, f: ForkId, side: Side) => s.doctrine?.chosen[f] === side;

// ---------- Effects ----------

const MASS: LineId[] = ['shell155', 'gmlrs', 'apkws', 'tamir', 'coyote'];
const PRECISION: LineId[] = ['pac3', 'sm6', 'irist', 'stinger', 'javelin'];

/** Output of one of your lines under your production doctrine. */
export function doctrineRate(s: SimState, recipe: string): number {
  const out = RECIPES[recipe]?.output as LineId | undefined;
  if (!out || !s.doctrine) return 1;
  if (has(s, 'production', 'a')) return MASS.includes(out) ? 1.15 : PRECISION.includes(out) ? 0.95 : 1;
  if (has(s, 'production', 'b')) return PRECISION.includes(out) ? 1.08 : MASS.includes(out) ? 0.95 : 1;
  return 1;
}

/** Scrap at your lines under your doctrines. */
export function doctrineScrap(s: SimState, recipe: string, automated: boolean): number {
  const out = RECIPES[recipe]?.output as LineId | undefined;
  let f = 1;
  if (out && has(s, 'production', 'b') && PRECISION.includes(out)) f *= 0.6;
  if (automated && has(s, 'workforce', 'a')) f *= 0.8;
  return f;
}

/** Purchase price factor by where the supplier is. */
export function doctrinePrice(s: SimState, foreign: boolean): number {
  if (has(s, 'supply', 'a')) return foreign ? 1.1 : 0.92;
  if (has(s, 'supply', 'b')) return foreign ? 0.88 : 1;
  return 1;
}

export const doctrineBan = (s: SimState) => (has(s, 'supply', 'b') ? 0.6 : 1);
export const doctrineAutomate = (s: SimState) => (has(s, 'workforce', 'a') ? 0.6 : has(s, 'workforce', 'b') ? 1.25 : 1);
export const doctrineMorale = (s: SimState) => (has(s, 'workforce', 'a') ? -3 : has(s, 'workforce', 'b') ? 5 : 0);
export const doctrineAccidents = (s: SimState) => (has(s, 'workforce', 'b') ? 0.6 : 1);
export const doctrineSkillCap = (s: SimState) => (has(s, 'workforce', 'b') ? 6 : 0);
export const doctrineShelf = (s: SimState) => (has(s, 'reserves', 'a') ? 1.25 : has(s, 'reserves', 'b') ? 0.9 : 1);
export const doctrineRunning = (s: SimState) => (has(s, 'reserves', 'a') ? 1.03 : 1);
export const doctrineFreight = (s: SimState) => (has(s, 'reserves', 'b') ? 0.75 : 1);
export const doctrineArrivals = (s: SimState) => (has(s, 'rival', 'a') ? 0.93 : 1);
export const doctrineOps = (s: SimState) => (has(s, 'rival', 'a') ? -0.1 : has(s, 'rival', 'b') ? 0.12 : 0);
export const doctrineExposure = (s: SimState) => (has(s, 'rival', 'b') ? -0.08 : 0);
export const doctrineAgency = (s: SimState) => (has(s, 'rival', 'b') ? 0.7 : 1);

// ---------- Actions ----------

export function validateDoctrine(s: SimState, a: { fork?: ForkId; side?: Side }): string | null {
  const f = a.fork && FORK_BY_ID[a.fork];
  if (!f || (a.side !== 'a' && a.side !== 'b')) return 'No such doctrine.';
  if (s.doctrine.chosen[f.id]) return `Already settled: ${doctrineDef(f.id, s.doctrine.chosen[f.id]!).name}.`;
  if (s.doctrine.active) return `${doctrineDef(s.doctrine.active.fork, s.doctrine.active.side).name} is still bedding in.`;
  if (!forkOpen(s, f.id)) return `Settle ${TIER_NEEDS[f.tier]} doctrine${TIER_NEEDS[f.tier] > 1 ? 's' : ''} first.`;
  return s.treasury >= doctrineCost(s, f.id) ? null : `Not enough money (needs $${doctrineCost(s, f.id)}M).`;
}

export function applyDoctrine(s: SimState, a: { fork?: ForkId; side?: Side }, feed: Feed): void {
  const f = FORK_BY_ID[a.fork!];
  const cost = doctrineCost(s, f.id);
  s.treasury -= cost;
  s.month.spend.projects += cost;
  const days = TIER[f.tier].days;
  s.doctrine.active = { fork: f.id, side: a.side!, days, total: days };
  feed(s, 'info', `You commit to ${f[a.side!].name.toLowerCase()}. It takes about ${Math.round(days / 30)} months to bed in, and there is no going back.`);
}

export function doctrineDay(s: SimState, feed: Feed): void {
  const a = s.doctrine?.active;
  if (!a || --a.days > 0) return;
  s.doctrine.active = null;
  s.doctrine.chosen[a.fork] = a.side;
  const d = doctrineDef(a.fork, a.side);
  feed(s, 'good', `Doctrine adopted: ${d.name}. ${d.pro}`, undefined, true);
}

/** The Committee's factions and the allies react to your doctrines, a little each month. */
export function doctrineMonth(s: SimState): void {
  if (!s.doctrine) return;
  const f = s.strategy.factions;
  if (has(s, 'supply', 'a')) f.industry = clamp(f.industry + 0.6);
  if (has(s, 'supply', 'b')) {
    f.industry = clamp(f.industry - 0.3);
    for (const k of Object.keys(s.allies) as (keyof typeof s.allies)[]) s.allies[k] = clamp(s.allies[k] + 0.4);
  }
  // Machines need fewer hands: the unions slowly lose their grip.
  if (has(s, 'workforce', 'a') && s.unions) for (const u of s.unions.towns) u.strength = clamp(u.strength - 0.4, 5, 95);
  if (has(s, 'reserves', 'a')) f.hawks = clamp(f.hawks + 0.4);
  if (has(s, 'reserves', 'b')) f.treasury = clamp(f.treasury + 0.4);
  if (has(s, 'rival', 'a')) f.hawks = clamp(f.hawks + 0.5);
  if (has(s, 'rival', 'b')) for (const k of Object.keys(s.allies) as (keyof typeof s.allies)[]) s.allies[k] = clamp(s.allies[k] - 0.3);
}

/** A short name for the industry your doctrines have built, for the term report. */
export function industryName(s: SimState): string {
  const c = s.doctrine?.chosen ?? {};
  if (c.production === 'a' && c.reserves === 'a') return 'an arsenal of plenty';
  if (c.production === 'b' && c.workforce === 'b') return 'a precision craft industry';
  if (c.workforce === 'a' && c.reserves === 'b') return 'a lean, automated machine';
  if (c.supply === 'a') return 'a self-reliant national industry';
  if (c.supply === 'b') return 'an allied industrial web';
  return Object.keys(c).length ? 'an industry still finding its shape' : 'the industry you inherited';
}

