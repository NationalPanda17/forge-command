// Workforce towns: every plant draws its people from the nearest town. Housing limits how fast you can hire, towns
// grow with jobs and shrink after layoffs, and mothballing a plant has a local political price.
import { HF, hireFactor, unionShift } from './homefront';
import { clamp } from './rng';
import { onMothball } from './communities';
import type { FeedItem, SimState } from './types';
import { CITIES, SITES, SITE_BY_ID } from './world';

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

export interface TownState {
  /** Homes for munitions workers and their families: the most this town can supply. */
  housing: number;
  /** Workers available: grows towards housing while there is work. */
  pool: number;
  /** Homes being built, and when they are ready. */
  building: { homes: number; days: number }[];
  /** Consecutive months with many out of work. */
  slump: number;
}

/** The town a site draws its workers from: the nearest one. */
export function townOf(siteId: string): string {
  const s = SITE_BY_ID[siteId];
  let best = CITIES[0].name;
  let d = Infinity;
  for (const c of CITIES) {
    const dd = Math.hypot(c.x - s.x, c.y - s.y);
    if (dd < d) {
      d = dd;
      best = c.name;
    }
  }
  return best;
}

/** Index of a town in the city list (names change between worlds; positions in the list do not). */
export const townIndex = (name: string) => CITIES.findIndex((c) => c.name === name);

/** People employed by the munitions industry in a town: your crews and trainees, and private companies' staff. */
export function employed(s: SimState, town: string): number {
  let n = 0;
  for (const def of SITES) {
    if (def.owner === 'foreign' || townOf(def.id) !== town) continue;
    const site = s.sites[def.id];
    if (site.status === 'closed' && def.kind !== 'plot') continue;
    n += def.owner === 'state' ? site.workers + site.trainees.reduce((a, t) => a + t.count, 0) : def.crew;
  }
  return n;
}

/** Room to hire in a town today. */
export function hireRoom(s: SimState, town: string): number {
  const t = s.towns?.[townIndex(town)];
  if (!t) return Infinity;
  // A resentful town (19.1) sends fewer people to your lines.
  return Math.max(0, Math.floor((t.pool - employed(s, town)) * hireFactor(s.communities?.mood[townIndex(town)] ?? 55)));
}

export const HOMES_PER_PROJECT = 400;
export const HOUSING_DAYS = 150;
export const housingCost = (s: SimState) => Math.round(24 * s.priceIndex);

export function newTowns(s: SimState): TownState[] {
  return CITIES.map((c) => {
    const work = employed(s, c.name);
    // Every town starts with a little room above today's jobs, more in big towns.
    const pool = Math.round(Math.max(work * 1.12, c.pop * 4) + 60);
    return { housing: Math.round(pool * 1.05), pool, building: [], slump: 0 };
  });
}

export function townsDay(s: SimState, feed: Feed): void {
  s.towns.forEach((t, i) => {
    if (!t.building.length) return;
    for (const b of t.building) b.days--;
    const done = t.building.filter((b) => b.days <= 0);
    t.building = t.building.filter((b) => b.days > 0);
    for (const b of done) {
      t.housing += b.homes;
      feed(s, 'good', `${b.homes} new homes open in ${CITIES[i].name}.`);
    }
  });
}

export function townsMonth(s: SimState, feed: Feed): void {
  s.towns.forEach((t, i) => {
    const town = CITIES[i].name;
    const work = employed(s, town);
    if (work > t.pool * 0.95) {
      // Jobs draw people in, as far as there are homes for them.
      t.pool = Math.min(t.housing, t.pool + Math.max(10, t.pool * 0.03));
      t.slump = 0;
    } else if (work < t.pool * 0.85) {
      t.slump++;
      // People drift away after a few lean months, and the region notices.
      if (t.slump >= 3) {
        t.pool = Math.max(work * 1.05, t.pool * 0.98);
        s.strategy.factions.regions = clamp(s.strategy.factions.regions - 0.4);
        if (t.slump === 3) feed(s, 'warn', `${town} is losing people: too few jobs for the families who came for them.`);
      }
    } else t.slump = 0;
    // Housing creeps up on its own, slowly.
    t.housing = Math.round(t.housing * 1.002);
  });
}

/** Lay off a plant's crew and idle its lines: it saves wages, but the town and the region feel it. */
export function mothball(s: SimState, siteId: string, feed: Feed): void {
  const site = s.sites[siteId];
  const laid = Math.round(site.workers + site.trainees.reduce((a, t) => a + t.count, 0));
  for (const p of site.processes) p.run = 'idle';
  site.workers = 0;
  site.trainees = [];
  site.mothballed = true;
  s.strategy.factions.regions = clamp(s.strategy.factions.regions - Math.min(12, laid / 120));
  onMothball(s, siteId);
  unionShift(s, townIndex(townOf(siteId)), HF.workforce.mothballUnion);
  s.confidence = clamp(s.confidence - Math.min(6, laid / 300));
  feed(s, 'warn', `${SITE_BY_ID[siteId].name} is mothballed: ${laid} people laid off in ${townOf(siteId)}. The region will not forget it.`, siteId, true);
}

export function reopen(s: SimState, siteId: string, feed: Feed): void {
  const site = s.sites[siteId];
  site.mothballed = false;
  for (const p of site.processes) p.run = 'normal';
  s.strategy.factions.regions = clamp(s.strategy.factions.regions + 3);
  feed(s, 'good', `${SITE_BY_ID[siteId].name} reopens. Hire its crew back to bring it up to speed.`, siteId);
}
