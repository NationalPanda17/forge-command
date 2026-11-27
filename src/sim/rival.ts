// The rival: the Vardan Directorate fields new weapons over your term, and each one changes what you need to build.
import { RIVAL_PACE } from './custom';
import { doctrineArrivals } from './doctrine';
import { pick, rand, randInt } from './rng';
import type { FeedItem, SimState, ThreatId } from './types';
import { FINISHED, MATERIALS, type LineId } from './world';
import type { ResearchId } from './strategy';
import { THREATS } from './fight';
import { inGrace, nationalStock, reserveTarget } from './selectors';
import DEPTH from './tuning/depth.json';

const R = DEPTH.rival;

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

export type DevId = 'swarms' | 'fastCruise' | 'manoeuvring' | 'decoys' | 'barrages' | 'armour';

export interface DevDef {
  id: DevId;
  name: string;
  /** What intel says about it. */
  intel: string;
  /** What it does once fielded. */
  effect: string;
  counter: ResearchId;
  arrivals?: Partial<Record<ThreatId, number>>;
  shots?: Partial<Record<ThreatId, number>>;
  /** Kill odds for some lines against a threat. */
  pk?: { threat: ThreatId; lines: LineId[]; mult: number }[];
  land?: Partial<Record<LineId, number>>;
  /** The counter's effect, applied on top. */
  countered: { arrivals?: Partial<Record<ThreatId, number>>; shots?: Partial<Record<ThreatId, number>>; pk?: { threat: ThreatId; lines: LineId[]; mult: number }[]; land?: Partial<Record<LineId, number>> };
}

export const RIVAL_NAME = 'the Vardan Directorate';
/** Intel arrives this many days before a weapon is fielded. */
export const WARNING_DAYS = R.warningDays;

export const DEVELOPMENTS: Record<DevId, DevDef> = {
  swarms: {
    id: 'swarms',
    name: 'Drone swarms',
    intel: 'Satellite images show launch racks for dozens of drones at a time.',
    effect: 'Drone attacks come 80% more often.',
    counter: 'swarmControl',
    arrivals: { drone: 1.8 },
    countered: { pk: [{ threat: 'drone', lines: ['apkws', 'coyote', 'stinger', 'tamir'], mult: 1.12 }], arrivals: { drone: 0.85 } },
  },
  fastCruise: {
    id: 'fastCruise',
    name: 'Supersonic cruise missiles',
    intel: 'Test flights at more than twice the speed of the old cruise missiles.',
    effect: 'IRIS-T, Coyote and Tamir hit cruise missiles 25% less often; PAC-3 and SM-6 matter more.',
    counter: 'networkedFire',
    pk: [{ threat: 'cruise', lines: ['irist', 'coyote', 'tamir'], mult: 0.75 }],
    countered: { pk: [{ threat: 'cruise', lines: ['irist', 'coyote', 'tamir'], mult: 1.25 }] },
  },
  manoeuvring: {
    id: 'manoeuvring',
    name: 'Manoeuvring ballistic warheads',
    intel: 'Warheads that jink in the last seconds of flight.',
    effect: 'Each ballistic missile takes 35% more interceptors.',
    counter: 'seekerSoftware',
    shots: { ballistic: 1.35 },
    countered: { shots: { ballistic: 0.8 } },
  },
  decoys: {
    id: 'decoys',
    name: 'Decoys and jammers',
    intel: 'Cheap decoys and radar jammers are going into the missile regiments.',
    effect: 'Cruise and ballistic missiles take 20% more interceptors each.',
    counter: 'discrimination',
    shots: { cruise: 1.2, ballistic: 1.2 },
    countered: { shots: { cruise: 0.85, ballistic: 0.85 } },
  },
  barrages: {
    id: 'barrages',
    name: 'Heavier rocket barrages',
    intel: 'New multiple-launcher regiments are forming along the border.',
    effect: 'Rocket attacks come 70% more often. Tamir carries the load.',
    counter: 'tamirSecondLine',
    arrivals: { rocket: 1.7 },
    countered: {},
  },
  armour: {
    id: 'armour',
    name: 'New armoured divisions',
    intel: 'Three armoured divisions are training within reach of the Marches.',
    effect: 'Land fighting needs 30% more shells and GMLRS, and 60% more Javelin.',
    counter: 'precisionKits',
    land: { shell155: 1.3, gmlrs: 1.3, javelin: 1.6 },
    countered: { land: { shell155: 0.85, gmlrs: 0.85 } },
  },
};
export const DEV_IDS = Object.keys(DEVELOPMENTS) as DevId[];

export interface RivalState {
  /** The order the rival will field its weapons in, drawn at the start. */
  order: DevId[];
  /** Weapons announced by intel, the day each is (or was) fielded, and why the rival chose it (19.0). */
  known: { id: DevId; announced: number; fielded: number; why?: string }[];
  /** Day intel next reports. */
  next: number;
  /**
   * What the rival has learned of your stockpile (19.0): for each line, a smoothed reading of its stock against target,
   * updated each month, so a quick top-up just before intel reports does not fool it.
   */
  watch?: Partial<Record<LineId, number>>;
}

export function newRival(s: { rng: number }): RivalState {
  const pool = [...DEV_IDS];
  const order: DevId[] = [];
  while (pool.length) {
    const d = pick(s as SimState, pool);
    order.push(d);
    pool.splice(pool.indexOf(d), 1);
  }
  // In a rebuild the rival gives you a little longer before its first new weapon.
  const delay = (R.firstDelayByScenario as Record<string, number>)[(s as SimState).scenario] ?? 0;
  return { order, known: [], next: randInt(s as SimState, R.firstDay[0], R.firstDay[1]) + delay };
}

/** How hard the rival's weapons bite: half strength on Easy. (On Hard it moves faster instead.) */
const STRENGTH: Record<'easy' | 'normal' | 'hard', number> = R.strength;
/** Scales a multiplier's distance from 1 by the difficulty. */
const tune = (s: SimState, m: number) => 1 + (m - 1) * STRENGTH[s.difficulty];

const fielded = (s: SimState) => (s.rival?.known ?? []).filter((k) => k.fielded <= s.day).map((k) => DEVELOPMENTS[k.id]);
const hasCounter = (s: SimState, d: DevDef) => s.strategy.research.done.includes(d.counter);

/** Multiplier on how many of a threat arrive. */
export function rivalArrivals(s: SimState, t: ThreatId): number {
  // Your service disrupted the rival's supply: fewer attacks of every kind for a while.
  let m = (s.intel && s.intel.supplyUntil > s.day ? 0.85 : 1) * doctrineArrivals(s);
  for (const d of fielded(s)) {
    m *= tune(s, d.arrivals?.[t] ?? 1);
    if (hasCounter(s, d)) m *= tune(s, d.countered.arrivals?.[t] ?? 1);
  }
  return m;
}

/** Multiplier on interceptors needed per threat. */
export function rivalShots(s: SimState, t: ThreatId): number {
  let m = 1;
  for (const d of fielded(s)) {
    m *= tune(s, d.shots?.[t] ?? 1);
    if (hasCounter(s, d)) m *= tune(s, d.countered.shots?.[t] ?? 1);
  }
  return m;
}

/** Multiplier on a line's kill odds against a threat. */
export function rivalPk(s: SimState, t: ThreatId, line: LineId): number {
  let m = 1;
  for (const d of fielded(s)) {
    for (const p of d.pk ?? []) if (p.threat === t && p.lines.includes(line)) m *= tune(s, p.mult);
    if (hasCounter(s, d)) for (const p of d.countered.pk ?? []) if (p.threat === t && p.lines.includes(line)) m *= tune(s, p.mult);
  }
  return m;
}

/** Multiplier on land fires of a line. */
export function rivalLand(s: SimState, line: LineId): number {
  let m = 1;
  for (const d of fielded(s)) {
    m *= tune(s, d.land?.[line] ?? 1);
    if (hasCounter(s, d)) m *= tune(s, d.countered.land?.[line] ?? 1);
  }
  return m;
}

export function rivalDay(s: SimState, feed: Feed): void {
  const r = s.rival;
  if (!r) return;
  for (const k of r.known) {
    if (k.fielded === s.day) {
      const d = DEVELOPMENTS[k.id];
      feed(s, 'bad', `${RIVAL_NAME[0].toUpperCase()}${RIVAL_NAME.slice(1)} fields ${d.name.toLowerCase()}. ${d.effect}${hasCounter(s, d) ? ' Your counter is ready.' : ''}`, undefined, true);
    }
  }
  if (s.day < r.next || r.known.length >= r.order.length) return;
  announceNext(s, feed);
}

/**
 * Intel reports the rival's next development. Normally on the day it is due, fielded three months later; stolen plans
 * report it early, but the rival keeps its own timetable: the same fielding day, and the same wait for the one after.
 */
export function announceNext(s: SimState, feed: Feed): void {
  const r = s.rival;
  // The rival studies you (19.0): of what it has not yet fielded, it develops what your stockpile is least ready for.
  // The tutorial keeps the old fixed order. The choice draws no random numbers, so the game's stream is unchanged.
  const choice = adaptive(s) ? chooseNext(s) : null;
  if (choice) {
    const at = r.order.indexOf(choice.id);
    r.order.splice(at, 1);
    r.order.splice(r.known.length, 0, choice.id);
  }
  const id = r.order[r.known.length];
  const d = DEVELOPMENTS[id];
  const due = Math.max(s.day, r.next);
  r.known.push({ id, announced: s.day, fielded: due + WARNING_DAYS, why: choice?.why });
  // Developments come faster as the term goes on, and a little faster on harder settings.
  const gap = randInt(s, R.gap[0], R.gap[1]) + (R.gapByDifficulty as Record<string, number>)[s.difficulty] + (rand(s) < 0.5 ? 0 : R.gapJitter);
  r.next = due + Math.round(gap * (s.custom ? RIVAL_PACE[s.custom.rivalPace] : 1) * (1 - R.termSpeedup * Math.min(R.termSpeedupCap, (s.term ?? 1) - 1)));
  const months = Math.max(1, Math.round((due + WARNING_DAYS - s.day) / 30));
  const why = choice?.why ? ` ${choice.why}` : '';
  feed(s, 'warn', `Intel: ${RIVAL_NAME} is preparing ${d.name.toLowerCase()}. ${d.intel}${why} Expect them in the field in about ${months === 3 ? 'three' : months} months. Counter: research “${COUNTER_NAMES[d.counter]}”.`, undefined, true);
}

/** The rival adapts to you, except in the tutorial (and when the tuning turns it off). */
const adaptive = (s: SimState) => R.adaptive && s.scenario !== 'tutorial';

/** Each month, the rival's smoothed reading of each line's stock against target. */
export function rivalMonth(s: SimState): void {
  const r = s.rival;
  if (!r || !adaptive(s)) return;
  const w = (r.watch ??= {});
  for (const l of FINISHED as LineId[]) {
    if (!s.lines[l]?.unlocked || inGrace(s, l)) continue;
    const t = reserveTarget(s, l);
    if (t <= 0) continue;
    const level = Math.min(1, nationalStock(s, l) / t);
    w[l] = (1 - R.watchAlpha) * (w[l] ?? 1) + R.watchAlpha * level;
  }
}

/** How exposed each line is to a development: its share of the fire against the threats it changes. */
export function exposure(d: DevDef): Partial<Record<LineId, number>> {
  const out: Partial<Record<LineId, number>> = {};
  const add = (l: LineId, v: number) => (out[l] = (out[l] ?? 0) + v);
  for (const t of new Set([...Object.keys(d.arrivals ?? {}), ...Object.keys(d.shots ?? {})]) as Set<ThreatId>) {
    const assign = THREATS[t].assign.filter((a) => a.weight > 0);
    const total = assign.reduce((a, x) => a + x.weight, 0) || 1;
    for (const a of assign) add(a.line, a.weight / total);
  }
  for (const p of d.pk ?? []) for (const l of p.lines) add(l, 1);
  for (const l of Object.keys(d.land ?? {}) as LineId[]) add(l, 1);
  return out;
}

/** The development the rival picks next, and the reason intel gives; null if it has nothing left. */
export function chooseNext(s: SimState): { id: DevId; why: string } | null {
  const r = s.rival;
  const left = r.order.slice(r.known.length);
  if (!left.length) return null;
  const watch = r.watch ?? {};
  const chosenForks = Object.entries(s.doctrine?.chosen ?? {}).map(([f, side]) => `${f}:${side}`);
  let best: { id: DevId; score: number; lines: [LineId, number][]; doctrine: boolean } | null = null;
  left.forEach((id, i) => {
    const d = DEVELOPMENTS[id];
    const ex = exposure(d);
    const lines = (Object.entries(ex) as [LineId, number][]).filter(([l]) => s.lines[l]?.unlocked);
    const sum = lines.reduce((a, [, v]) => a + v, 0) || 1;
    const stock = lines.reduce((a, [l, v]) => a + v * (1 - (watch[l] ?? 1)), 0) / sum;
    const doctrine = chosenForks.some((f) => ((R.doctrineTargets as Record<string, string[]>)[f] ?? []).includes(id));
    const lean = R.seedLean * ((left.length - i) / left.length);
    // How sharply it aims at your stockpile depends on the scenario: at war its eye is on the front.
    const aim = (R.aimByScenario as Record<string, number>)[s.scenario] ?? 1;
    const score = (aim * stock + (doctrine ? R.doctrineBias : 0) + lean) * (hasCounter(s, d) ? R.counterPenalty : 1);
    if (!best || score > best.score + 1e-9) best = { id, score, lines, doctrine };
  });
  const b = best as unknown as { id: DevId; score: number; lines: [LineId, number][]; doctrine: boolean };
  // Why, in the player's terms: the two most exposed lines it read as thin, and a doctrine it read as a gap.
  const thin = b.lines
    .filter(([l]) => (watch[l] ?? 1) < 0.95)
    .sort((x, y) => (watch[x[0]] ?? 1) - (watch[y[0]] ?? 1))
    .slice(0, 2)
    .map(([l]) => `${MATERIALS[l].name} at ${Math.round((watch[l] ?? 1) * 100)}%`);
  const parts: string[] = [];
  if (thin.length) parts.push(`your ${thin.join(' and ')} of target`);
  if (b.doctrine) parts.push('a gap they read in your doctrine');
  const why = parts.length ? `Why this: they are aiming at ${parts.join(', and at ')}.${hasCounter(s, DEVELOPMENTS[b.id]) ? ' They chose it despite your counter.' : ''}` : '';
  return { id: b.id, why };
}

export const COUNTER_NAMES: Partial<Record<ResearchId, string>> = {
  swarmControl: 'Counter-swarm fire control',
  networkedFire: 'Networked fire control',
  seekerSoftware: 'Seeker software upgrade',
  discrimination: 'Decoy discrimination',
  tamirSecondLine: 'Second Tamir line',
  precisionKits: 'Precision guidance kits',
};
