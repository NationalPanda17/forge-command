// The rival: the Vardan Directorate fields new weapons over your term, and each one changes what you need to build.
import { pick, rand, randInt } from './rng';
import type { FeedItem, SimState, ThreatId } from './types';
import type { LineId } from './world';
import type { ResearchId } from './strategy';

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
export const WARNING_DAYS = 90;

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
  /** Weapons announced by intel, and the day each is (or was) fielded. */
  known: { id: DevId; announced: number; fielded: number }[];
  /** Day intel next reports. */
  next: number;
}

export function newRival(s: { rng: number }): RivalState {
  const pool = [...DEV_IDS];
  const order: DevId[] = [];
  while (pool.length) {
    const d = pick(s as SimState, pool);
    order.push(d);
    pool.splice(pool.indexOf(d), 1);
  }
  return { order, known: [], next: randInt(s as SimState, 120, 180) };
}

/** How hard the rival's weapons bite: half strength on Easy. (On Hard it moves faster instead.) */
const STRENGTH = { easy: 0.5, normal: 1, hard: 1 } as const;
/** Scales a multiplier's distance from 1 by the difficulty. */
const tune = (s: SimState, m: number) => 1 + (m - 1) * STRENGTH[s.difficulty];

const fielded = (s: SimState) => (s.rival?.known ?? []).filter((k) => k.fielded <= s.day).map((k) => DEVELOPMENTS[k.id]);
const hasCounter = (s: SimState, d: DevDef) => s.strategy.research.done.includes(d.counter);

/** Multiplier on how many of a threat arrive. */
export function rivalArrivals(s: SimState, t: ThreatId): number {
  let m = 1;
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
  const id = r.order[r.known.length];
  const d = DEVELOPMENTS[id];
  r.known.push({ id, announced: s.day, fielded: s.day + WARNING_DAYS });
  // Developments come faster as the term goes on, and a little faster on harder settings.
  r.next = s.day + randInt(s, 180, 270) + (s.difficulty === 'hard' ? -30 : s.difficulty === 'easy' ? 120 : 0) + (rand(s) < 0.5 ? 0 : 15);
  feed(s, 'warn', `Intel: ${RIVAL_NAME} is preparing ${d.name.toLowerCase()}. ${d.intel} Expect them in the field in about three months. Counter: research “${COUNTER_NAMES[d.counter]}”.`, undefined, true);
}

export const COUNTER_NAMES: Partial<Record<ResearchId, string>> = {
  swarmControl: 'Counter-swarm fire control',
  networkedFire: 'Networked fire control',
  seekerSoftware: 'Seeker software upgrade',
  discrimination: 'Decoy discrimination',
  tamirSecondLine: 'Second Tamir line',
  precisionKits: 'Precision guidance kits',
};
