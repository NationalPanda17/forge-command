// Custom scenarios: your own starting situation, shareable as a short code.
import { CRISES } from './fight';
import { supplierNations } from './diplomacy';

export type RivalPace = 'slow' | 'normal' | 'fast';

export interface CustomScenario {
  name: string;
  /** Starting money, $M. */
  treasury: number;
  /** Monthly budget, $M. */
  appropriation: number;
  /** The war reserve against the usual size. */
  reserve: number;
  confidence: number;
  /** Prices against normal at the start. */
  prices: number;
  /** A crisis under way on day one, by id, or null. */
  crisis: string | null;
  rivalPace: RivalPace;
  /** Months of export ban on each supplier nation at the start. */
  bans: Record<string, number>;
  /** How often disruptions and world events happen: 0, 0.5, 1 or 2. */
  events: number;
  /** Starting relations with your allies. */
  allies: number;
}

export const DEFAULT_CUSTOM: CustomScenario = {
  name: 'My scenario',
  treasury: 700,
  appropriation: 215,
  reserve: 1,
  confidence: 60,
  prices: 1,
  crisis: null,
  rivalPace: 'normal',
  bans: {},
  events: 1,
  allies: 55,
};

/** Every field's limits, so a code from anywhere can be trusted once read. */
export const LIMITS = {
  treasury: [0, 3000, 50],
  appropriation: [100, 500, 5],
  reserve: [0.25, 1.5, 0.05],
  confidence: [20, 90, 5],
  prices: [1, 1.4, 0.02],
  allies: [10, 90, 5],
  ban: [0, 24, 1],
} as const;

const fit = (v: unknown, [lo, hi, step]: readonly [number, number, number], fallback: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.round(Math.min(hi, Math.max(lo, n)) / step) * step;
};
const round = (v: number) => Math.round(v * 100) / 100;

/** Cleans a scenario: everything within limits, names tidy, unknown crises and nations dropped. */
export function tidy(c: Partial<CustomScenario>): CustomScenario {
  const d = DEFAULT_CUSTOM;
  const nations = supplierNations();
  const bans: Record<string, number> = {};
  for (const n of nations) {
    const m = fit(c.bans?.[n], LIMITS.ban, 0);
    if (m > 0) bans[n] = m;
  }
  return {
    name: String(c.name ?? d.name).replace(/[^\p{L}\p{N} '’,.!?&()-]/gu, '').trim().slice(0, 30) || d.name,
    treasury: fit(c.treasury, LIMITS.treasury, d.treasury),
    appropriation: fit(c.appropriation, LIMITS.appropriation, d.appropriation),
    reserve: round(fit(c.reserve, LIMITS.reserve, d.reserve)),
    confidence: fit(c.confidence, LIMITS.confidence, d.confidence),
    prices: round(fit(c.prices, LIMITS.prices, d.prices)),
    crisis: c.crisis && CRISES.some((x) => x.id === c.crisis) ? c.crisis : null,
    rivalPace: c.rivalPace === 'slow' || c.rivalPace === 'fast' ? c.rivalPace : 'normal',
    bans,
    events: [0, 0.5, 1, 2].includes(c.events as number) ? (c.events as number) : 1,
    allies: fit(c.allies, LIMITS.allies, d.allies),
  };
}

const PREFIX = 'FC1-';
const toB64 = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))));

/** A short code anyone can paste in to play the same scenario. */
export function encodeCustom(c: CustomScenario): string {
  const t = tidy(c);
  const nations = supplierNations();
  const packed = [t.name, t.treasury, t.appropriation, t.reserve, t.confidence, t.prices, t.crisis ?? '', t.rivalPace[0], nations.map((n) => t.bans[n] ?? 0), t.events, t.allies];
  return PREFIX + toB64(JSON.stringify(packed));
}

/** Reads a code; null if it is not one. */
export function decodeCustom(code: string): CustomScenario | null {
  const raw = code.trim();
  if (!raw.startsWith(PREFIX)) return null;
  try {
    const p = JSON.parse(fromB64(raw.slice(PREFIX.length)));
    if (!Array.isArray(p) || p.length < 11) return null;
    const nations = supplierNations();
    const bans: Record<string, number> = {};
    if (Array.isArray(p[8])) nations.forEach((n, i) => (bans[n] = Number(p[8][i]) || 0));
    return tidy({
      name: p[0],
      treasury: p[1],
      appropriation: p[2],
      reserve: p[3],
      confidence: p[4],
      prices: p[5],
      crisis: p[6] || null,
      rivalPace: ({ s: 'slow', n: 'normal', f: 'fast' } as Record<string, RivalPace>)[p[7]] ?? 'normal',
      bans,
      events: p[9],
      allies: p[10],
    });
  } catch {
    return null;
  }
}

/** Days until the rival's first intel report, and between later ones, by pace. */
export const RIVAL_PACE: Record<RivalPace, number> = { slow: 1.5, normal: 1, fast: 0.6 };
