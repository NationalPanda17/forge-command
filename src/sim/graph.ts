// Routing: fastest paths over the transport network, precomputed once for every pair of sites.
import { CANDIDATE_ROUTES, MODES, ROUTES, ROUTE_KEY, SITES, routeKm, type Mode, type RouteDef } from './world';
import { onWorldChange } from './worldgen';

export interface Leg {
  to: string;
  mode: Mode;
  key: string;
  km: number;
  days: number;
  cap: number;
}

const ADJ = new Map<string, Leg[]>();
const CACHE = new Map<string, Path | null>();
let signature = '\u0000';

/** Extra daily tonnage per upgrade level. */
export const UPGRADE_STEP = 0.5;

/** The network as built so far: the original routes, any links the player finished, and route upgrades. */
let lastBuilt: readonly string[] = [];
let lastUpgrades: Readonly<Record<string, number>> = {};

export function setNetwork(built: readonly string[] = [], upgrades: Readonly<Record<string, number>> = {}): void {
  lastBuilt = built;
  lastUpgrades = upgrades;
  const sig = `${[...built].sort().join(',')}|${Object.entries(upgrades).filter(([, v]) => v > 0).sort().map(([k, v]) => `${k}=${v}`).join(',')}`;
  if (sig === signature) return;
  signature = sig;
  ADJ.clear();
  CACHE.clear();
  const routes: RouteDef[] = [...ROUTES, ...CANDIDATE_ROUTES.filter((c) => built.includes(c.id))];
  for (const rt of routes) {
    const km = routeKm(rt);
    const days = km / MODES[rt.mode].speed;
    const key = ROUTE_KEY(rt.a, rt.b);
    const cap = rt.cap * (1 + UPGRADE_STEP * (upgrades[key] ?? 0));
    const push = (from: string, to: string) => {
      if (!ADJ.has(from)) ADJ.set(from, []);
      ADJ.get(from)!.push({ to, mode: rt.mode, key, km, days, cap });
    };
    push(rt.a, rt.b);
    push(rt.b, rt.a);
  }
}
setNetwork();
// A new world moves every site: distances change, so the network is rebuilt.
onWorldChange(() => {
  signature = '\u0000';
  setNetwork(lastBuilt, lastUpgrades);
});

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
