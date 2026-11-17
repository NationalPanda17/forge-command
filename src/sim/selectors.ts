// Derived values over the simulation state.
import { BASE_LINES, CHEAP, LAND_DRAW, LAND_LINES, PREMIUM, THREATS, THREAT_IDS } from './fight';
import type { Lot, ProcessState, SimState, SiteState } from './types';
import { hasResearch, recipeInputs, recipeScrap } from './strategy';
import { FINISHED, MATERIALS, REGIONS, SITES, SITE_BY_ID, type LineId, type MaterialId, type RegionId } from './world';

export const RUN_FACTOR = { idle: 0, normal: 1, surge: 1.3 } as const;
export const DAYS_PER_MONTH = 30;
export const monthOf = (day: number) => Math.floor(day / DAYS_PER_MONTH);

export const lotQty = (lots: Lot[] | undefined) => (lots ?? []).reduce((a, l) => a + l.qty, 0);
export const isLine = (m: MaterialId): m is LineId => FINISHED.includes(m);
export const unlocked = (s: SimState, l: LineId) => s.lines[l].unlocked;

/** Units this process can make today before inputs. */
export function processRate(_s: SimState, site: SiteState, p: ProcessState): number {
  if (site.status !== 'active') return 0;
  const def = SITE_BY_ID[site.id];
  const staff = def.owner === 'state' && def.crew > 0 ? Math.min(1, site.workers / Math.max(1, crewNeed(site))) : 1;
  const disruption = site.disruptionDays > 0 ? site.disruptionFactor : 1;
  const cond = 0.6 + 0.4 * (site.condition / 100);
  return p.capacity * p.maturity * RUN_FACTOR[p.run] * staff * disruption * cond;
}

export function crewNeed(site: SiteState): number {
  const def = SITE_BY_ID[site.id];
  if (!site.processes.length) return def.crew;
  const share = site.processes.reduce((a, p) => a + (1 + 0.25 * p.expansions) * (p.run === 'idle' ? 0.15 : p.run === 'surge' ? 1.15 : 1), 0) / site.processes.length;
  return def.crew * share + site.extraCrew;
}

/** Daily use of each input at the current plan. */
export function inputRates(s: SimState, site: SiteState): Partial<Record<MaterialId, number>> {
  const out: Partial<Record<MaterialId, number>> = {};
  if (SITE_BY_ID[site.id].owner === 'foreign') return out;
  for (const p of site.processes) {
    const gross = processRate(s, site, p) / (1 - recipeScrap(s, p.recipe, SITE_BY_ID[site.id].owner));
    for (const [m, q] of Object.entries(recipeInputs(s, p.recipe)) as [MaterialId, number][]) out[m] = (out[m] ?? 0) + gross * q;
  }
  return out;
}

// ---------- The fight: expected draw ----------

export function regionBases(region: RegionId, kind: 'air' | 'land'): string[] {
  return SITES.filter((x) => x.region === region && (kind === 'land' ? x.kind === 'artillery' : x.kind === 'adBase' || x.kind === 'airBase')).map((x) => x.id);
}

/** Expected calm draw of a line per day in a region (crises excluded). */
export function regionDailyDraw(s: SimState, region: RegionId, line: LineId, crisisMult = 1): number {
  if (!unlocked(s, line)) return 0;
  const reg = REGIONS[region];
  if (LAND_LINES.includes(line)) return ((LAND_DRAW[line] ?? 0) / DAYS_PER_MONTH) * reg.landShare * crisisMult * (line === 'shell155' && hasResearch(s, 'smartFuzes') ? 0.85 : 1);
  let shots = 0;
  for (const t of THREAT_IDS) {
    const th = THREATS[t];
    const live = th.assign.filter((a) => a.weight > 0 && unlocked(s, a.line) && !(s.policy.conserve && CHEAP.includes(t) && PREMIUM.includes(a.line)));
    const w = live.reduce((a, x) => a + x.weight, 0);
    const passive = t === 'drone' && hasResearch(s, 'hpm') ? 0.8 : 1;
    for (const a of live) if (a.line === line) shots += (th.calmMonthly / DAYS_PER_MONTH) * reg.threatShare * passive * th.shots * (a.weight / w);
  }
  return shots * crisisMult;
}

export const nationalDailyDraw = (s: SimState, line: LineId) => (['north', 'coast', 'east', 'isles'] as RegionId[]).reduce((a, r) => a + regionDailyDraw(s, r, line), 0);

/** Daily draw expected at one base. */
export function baseDailyDraw(s: SimState, siteId: string, line: LineId): number {
  const def = SITE_BY_ID[siteId];
  if (!(BASE_LINES[def.kind] ?? []).includes(line)) return 0;
  const kind = LAND_LINES.includes(line) ? 'land' : 'air';
  const bases = regionBases(def.region, kind).filter((b) => (BASE_LINES[SITE_BY_ID[b].kind] ?? []).includes(line));
  if (!bases.length) return 0;
  return regionDailyDraw(s, def.region, line) / bases.length;
}

// ---------- Stock ----------

/** Every serviceable round of a line in the country, including rounds on the road. */
export function nationalStock(s: SimState, line: LineId): number {
  let n = 0;
  for (const site of Object.values(s.sites)) n += lotQty(site.lots[line]);
  for (const sh of s.shipments) if (sh.material === line) n += sh.qty;
  return n;
}

export const RESERVE_DAYS = 180;
export const reserveTarget = (s: SimState, line: LineId) => nationalDailyDraw(s, line) * RESERVE_DAYS;

export function readiness(s: SimState): number {
  const lines = FINISHED.filter((l) => unlocked(s, l as LineId) && nationalDailyDraw(s, l as LineId) > 0) as LineId[];
  if (!lines.length) return 0;
  return lines.reduce((a, l) => a + Math.min(1, nationalStock(s, l) / Math.max(1, reserveTarget(s, l))), 0) / lines.length;
}

export const inbound = (s: SimState, siteId: string, m: MaterialId) => s.shipments.reduce((a, sh) => a + (sh.to === siteId && sh.material === m ? sh.qty : 0), 0);

export const unserviceableTotal = (s: SimState) =>
  Object.values(s.sites).reduce((a, site) => a + Object.values(site.unserviceable).reduce((b, q) => b + (q ?? 0), 0), 0);

export const valueOf = (m: MaterialId, qty: number) => MATERIALS[m].price * qty;
