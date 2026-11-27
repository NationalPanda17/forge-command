// Golden masters (18.0): fixed games, played for two years by a fixed policy, with their results recorded. They pin
// the simulation's behaviour: a refactor must leave them unchanged, and the Unreal port is checked against the same
// records (docs/port/golden-masters.md).
import { createHash } from 'node:crypto';
import { PRESETS } from '../../src/sim/automation';
import { newSim } from '../../src/sim/setup';
import { advanceDays, openCampaign } from '../../src/sim/tick';
import { readiness, nationalStock } from '../../src/sim/selectors';
import { FINISHED, type LineId } from '../../src/sim/world';
import type { SimState } from '../../src/sim/types';

export interface GoldenCase {
  name: string;
  /** What the case covers, for whoever reads a failure. */
  covers: string;
  make: () => SimState;
  months: number;
}

const auto = PRESETS.full;

export const CASES: GoldenCase[] = [
  { name: 'peacetime-normal', covers: 'the standard game, run by the chief of staff', make: () => newSim({ seed: 101, difficulty: 'normal', automation: auto }), months: 24 },
  { name: 'peacetime-hard', covers: 'Hard difficulty and its stricter mandate', make: () => newSim({ seed: 202, difficulty: 'hard', automation: auto }), months: 24 },
  { name: 'war-footing', covers: 'an active crisis from day one, the shield goal', make: () => newSim({ seed: 303, scenario: 'warFooting', automation: auto }), months: 24 },
  { name: 'sanctions', covers: 'foreign suppliers banned', make: () => newSim({ seed: 404, scenario: 'sanctions', automation: auto }), months: 24 },
  { name: 'generated-map', covers: 'a generated country (world generation, renamed sites, its own network)', make: () => newSim({ seed: 505, world: 505, automation: auto }), months: 24 },
  { name: 'story', covers: 'the story mode: chapters, briefings and goals', make: () => newSim({ seed: 606, story: true, automation: auto }), months: 24 },
  { name: 'sandbox-endless', covers: 'a sandbox with no end and no dismissal', make: () => newSim({ seed: 707, mode: 'sandbox', automation: auto }), months: 24 },
  { name: 'hands-off', covers: 'nobody at the desk: defaults, decay and dismissal', make: () => newSim({ seed: 808 }), months: 24 },
];

/** One month's digest: the figures the Unreal port must reproduce (within the tolerances in the port docs). */
export interface MonthDigest {
  month: number;
  day: number;
  treasury: number;
  confidence: number;
  readiness: number;
  /** National serviceable stock of every unlocked line, summed. */
  stock: number;
  feed: number;
  rng: number;
  over: boolean;
}

export interface GoldenRecord {
  name: string;
  covers: string;
  months: MonthDigest[];
  /** SHA-256 of the whole final state, keys sorted: any change at all in the TypeScript simulation shows here. */
  finalHash: string;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

function digest(s: SimState): MonthDigest {
  const lines = (FINISHED as LineId[]).filter((l) => s.lines[l].unlocked);
  return {
    month: s.history.length,
    day: s.day,
    treasury: r2(s.treasury),
    confidence: r2(s.confidence),
    readiness: r2(readiness(s)),
    stock: Math.round(lines.reduce((a, l) => a + nationalStock(s, l), 0)),
    feed: s.feed.length,
    rng: s.rng,
    over: s.over,
  };
}

/** JSON with every object's keys in sorted order, so the same state always gives the same text. */
export function canonical(v: unknown): string {
  return JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, (x as Record<string, unknown>)[k]])) : x));
}

export function runCase(c: GoldenCase): GoldenRecord {
  let s = openCampaign(c.make());
  const months: MonthDigest[] = [];
  for (let i = 0; i < c.months && !s.over; i++) {
    s = advanceDays(s, 30);
    months.push(digest(s));
  }
  return { name: c.name, covers: c.covers, months, finalHash: createHash('sha256').update(canonical(s)).digest('hex') };
}
