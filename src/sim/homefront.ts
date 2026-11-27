// Release 19.1: the home front (docs/homefront.md). One reading, discontent, joins the workforce and towns to security:
// a town whose union is strong and whose people resent you is where spies find recruits and insiders open the door to
// ransomware. Discontent is worked out from the union's strength and the town's mood; it is never stored.
import H from './tuning/homefront.json';
import { clamp } from './rng';
import type { SimState } from './types';
import { CITIES } from './world';
import { townIndex, townOf } from './towns';

export const HF = H;
const D = H.discontent;

/** 0..1 discontent of a town (by city index): a strong union and a resentful town. Baseline about 0.425. */
export function discontent(s: SimState, town: number): number {
  const strength = s.unions?.towns[town]?.strength ?? 40;
  const mood = s.communities?.mood[town] ?? 55;
  return clamp(D.wStrength * (strength / 100) + D.wMood * ((100 - mood) / 100), 0, 1);
}

/** Discontent of the town a site stands in. */
export const discontentAt = (s: SimState, siteId: string) => {
  const t = townIndex(townOf(siteId));
  return t >= 0 ? discontent(s, t) : D.baseline;
};

/** Mean discontent over the given towns (the baseline when there are none). */
export function meanDiscontent(s: SimState, towns: number[]): number {
  return towns.length ? towns.reduce((a, t) => a + discontent(s, t), 0) / towns.length : D.baseline;
}

/** How much a town's discontent lowers a plant's security: none at the baseline, a bonus below it. */
export const securityPenalty = (s: SimState, siteId: string) => H.security.kSecD * (discontentAt(s, siteId) - D.baseline);

/** Ransomware on your plants is likelier where insiders are unhappy. */
export const insiderFactor = (meanD: number) => 1 + H.security.kInsider * Math.max(0, meanD - D.baseline);

/** A resentful town sends fewer people to your lines: the share of the room to hire it fills. */
export function hireFactor(mood: number): number {
  const w = H.workforce;
  return clamp((mood - w.hireZero) / (w.hireFull - w.hireZero), w.hireMin, 1);
}

/** The word for a discontent reading. */
export const DISCONTENT_WORD = (d: number) => (d < 0.4 ? 'calm' : d < 0.55 ? 'restless' : 'angry');

/** Moves a town's union strength (by city index), within its bounds. */
export function unionShift(s: SimState, town: number, v: number): void {
  const u = s.unions?.towns[town];
  if (u) u.strength = clamp(u.strength + v, 5, 95);
}

/** Moves a town's mood (by city index). */
export function moodShift(s: SimState, town: number, v: number): void {
  if (s.communities && CITIES[town]) s.communities.mood[town] = clamp(s.communities.mood[town] + v);
}
