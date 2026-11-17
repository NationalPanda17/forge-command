// Routing: fastest paths over the transport network, precomputed once for every pair of sites.
import { MODES, ROUTES, ROUTE_KEY, SITES, routeKm, type Mode } from './world';

export interface Leg {
  to: string;
  mode: Mode;
  key: string;
  km: number;
  days: number;
  cap: number;
}

const ADJ = new Map<string, Leg[]>();
for (const rt of ROUTES) {
  const km = routeKm(rt);
  const days = km / MODES[rt.mode].speed;
  const key = ROUTE_KEY(rt.a, rt.b);
  const push = (from: string, to: string) => {
    if (!ADJ.has(from)) ADJ.set(from, []);
    ADJ.get(from)!.push({ to, mode: rt.mode, key, km, days, cap: rt.cap });
  };
  push(rt.a, rt.b);
  push(rt.b, rt.a);
}
export const neighbours = (id: string) => ADJ.get(id) ?? [];

export interface Path {
  legs: Leg[];
  /** Whole days in transit (at least 1). Each leg adds half a day of handling. */
  days: number;
  km: number;
  /** $M per tonne. */
  costPerT: number;
}

/** Dijkstra on travel time. Air legs are only used when nothing else reaches the destination. */
function shortest(from: string, allowAir: boolean): Map<string, { time: number; prev: string | null; leg: Leg | null }> {
  const best = new Map<string, { time: number; prev: string | null; leg: Leg | null }>();
  best.set(from, { time: 0, prev: null, leg: null });
  const open = new Set([from]);
  while (open.size) {
    let cur = '';
    let t = Infinity;
    for (const o of open) {
      const v = best.get(o)!.time;
      if (v < t) {
        t = v;
        cur = o;
      }
    }
    open.delete(cur);
    for (const leg of neighbours(cur)) {
      if (leg.mode === 'air' && !allowAir) continue;
      const nt = t + leg.days + 0.5;
      const old = best.get(leg.to);
      if (!old || nt < old.time) {
        best.set(leg.to, { time: nt, prev: cur, leg });
        open.add(leg.to);
      }
    }
  }
  return best;
}

const CACHE = new Map<string, Path | null>();

/** Fastest surface path (sea, rail, road); air only if the destination cannot be reached otherwise. */
export function pathBetween(from: string, to: string, allowAir = false): Path | null {
  const k = `${from}>${to}>${allowAir ? 1 : 0}`;
  if (CACHE.has(k)) return CACHE.get(k)!;
  let res = buildPath(shortest(from, allowAir), from, to);
  if (!res && !allowAir) res = buildPath(shortest(from, true), from, to);
  CACHE.set(k, res);
  return res;
}

function buildPath(best: ReturnType<typeof shortest>, from: string, to: string): Path | null {
  if (!best.has(to)) return null;
  const legs: Leg[] = [];
  let cur = to;
  while (cur !== from) {
    const b = best.get(cur)!;
    legs.unshift(b.leg!);
    cur = b.prev!;
  }
  const km = legs.reduce((a, l) => a + l.km, 0);
  const time = best.get(to)!.time;
  return {
    legs,
    days: Math.max(1, Math.ceil(time)),
    km,
    costPerT: legs.reduce((a, l) => a + l.km * MODES[l.mode].cost, 0),
  };
}

export const ALL_SITE_IDS = SITES.map((x) => x.id);
