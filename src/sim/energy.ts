// Energy and the grid: every region has its own grid, with a power price and a reserve margin. Plants pay for power by
// how hungry they are; private suppliers pass power prices on. Thin reserves, fuel shocks, winter and the rival's strikes
// on the grid during a crisis bring blackouts, which stop lines unless a plant has its own backup generators.
import { clamp, pick, rand, randInt, randRange } from './rng';
import { troubleScale } from './scale';
import { DAYS_PER_MONTH } from './selectors';
import type { FeedItem, SimState, SiteState } from './types';
import { REGIONS, SITES, SITE_BY_ID, type RegionId, type SiteKind } from './world';

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

export interface Grid {
  /** Power price against normal. */
  price: number;
  /** Spare generating capacity, 0..0.4: the thinner it is, the likelier a blackout. */
  reserve: number;
  /** Days of blackout left. */
  outage: number;
  /** Days until a grid upgrade is finished, or null. */
  upgrading: number | null;
}

export interface PowerContract {
  region: RegionId;
  /** The fixed price, against normal. */
  price: number;
  until: number;
}

export interface EnergyState {
  grids: Record<RegionId, Grid>;
  /** Plants with their own backup generators. */
  generators: string[];
  contracts: PowerContract[];
  /** A fuel shock under way: how much it adds to every grid's price, and for how long. */
  shock: { size: number; days: number } | null;
}

export const GRID_REGIONS = Object.keys(REGIONS) as RegionId[];
const START_RESERVE: Record<RegionId, number> = { north: 0.16, coast: 0.2, east: 0.14, isles: 0.12, central: 0.22 };

export const newEnergy = (): EnergyState => ({
  grids: Object.fromEntries(GRID_REGIONS.map((r) => [r, { price: 1, reserve: START_RESERVE[r], outage: 0, upgrading: null }])) as Record<RegionId, Grid>,
  generators: [],
  contracts: [],
  shock: null,
});

/** How hungry for power a kind of plant is: 1 for an arsenal. */
const INTENSITY: Partial<Record<SiteKind, number>> = {
  smelter: 3,
  steelworks: 2.6,
  fab: 2.2,
  refinery: 1.8,
  chemical: 1.8,
  explosives: 1.4,
  motors: 1.2,
  components: 1,
  arsenal: 1,
  mine: 0.8,
  quarry: 0.6,
  well: 0.5,
  forestry: 0.3,
};
export const intensityOf = (site: SiteState) => INTENSITY[(site.plantKind ?? SITE_BY_ID[site.id].kind) as SiteKind] ?? 0.5;

const regionOf = (siteId: string) => SITE_BY_ID[siteId].region;

/** What a plant pays for power against normal: the grid's price, unless a power contract fixes it. */
export function powerPrice(s: SimState, region: RegionId): number {
  const c = s.energy?.contracts.find((x) => x.region === region && x.until > s.day);
  return c ? c.price : (s.energy?.grids[region].price ?? 1);
}

/** A plant's output during a blackout: 70% on its own generators, a quarter on what the grid can spare without. */
export function powerFactor(s: SimState, site: SiteState): number {
  if (!s.energy) return 1;
  const def = SITE_BY_ID[site.id];
  if (def.owner === 'foreign' || !site.processes.length) return 1;
  if (s.energy.grids[def.region].outage <= 0) return 1;
  if (s.energy.generators.includes(site.id)) return 0.7;
  return def.owner === 'private' ? 0.3 : 0.25;
}

/** Private suppliers pass part of their power bill on in their prices. */
export const supplierEnergyFactor = (s: SimState, siteId: string) => {
  const def = SITE_BY_ID[siteId];
  if (!s.energy || def.owner === 'foreign') return 1;
  return 1 + 0.06 * intensityOf(s.sites[siteId]) * (s.energy.grids[def.region].price - 1);
};

/** The daily power share of a line's running cost, against its output value. */
export const POWER_SHARE = 0.03;

export const generatorCost = (s: SimState, siteId: string) => Math.round((6 + 4 * intensityOf(s.sites[siteId])) * s.priceIndex);
export const contractPrice = (s: SimState, region: RegionId) => Math.round(s.energy.grids[region].price * 1.05 * 100) / 100;
export const CONTRACT_MONTHS = 24;
export const gridUpgradeCost = (s: SimState) => Math.round(60 * s.priceIndex);
export const GRID_UPGRADE_DAYS = 180;

/** The tutorial's first year is calm: no blackouts or fuel shocks. */
const calm = (s: SimState) => s.scenario === 'tutorial' && s.day < 360;

/** Chance of a blackout starting on a given day in a region. */
export function blackoutOdds(s: SimState, region: RegionId): number {
  if (calm(s)) return 0;
  const g = s.energy.grids[region];
  const thin = clamp((0.2 - g.reserve) / 0.2, 0, 1);
  const winter = [11, 0, 1].includes(Math.floor(Math.max(0, s.day - 1) / DAYS_PER_MONTH) % 12) && region !== 'central' ? 1.5 : 1;
  const war = s.crisis && s.crisis.phase === 'active' && s.crisis.region === region ? 3 : 1;
  return ((0.004 + 0.03 * thin) * winter * war * troubleScale(s)) / DAYS_PER_MONTH;
}

export function validateEnergy(s: SimState, a: { type: string; site?: string; region?: RegionId }): string | null {
  // Two players: each runs only the grids in their own half of the country.
  const h = s.hotseat;
  if (h && a.region && !h.players[h.active].regions.includes(a.region)) {
    const other = h.players[1 - h.active];
    return `${other.name} (${other.command}) runs that grid.`;
  }
  const funds = (c: number) => (s.treasury >= c ? null : `Not enough money (needs $${c}M).`);
  switch (a.type) {
    case 'generator': {
      const def = SITE_BY_ID[a.site!];
      if (!def || def.owner !== 'state' || !s.sites[a.site!].processes.length) return 'Only your own plants.';
      if (s.energy.generators.includes(a.site!)) return 'It already has generators.';
      return funds(generatorCost(s, a.site!));
    }
    case 'powerContract':
      if (!(a.region! in s.energy.grids)) return 'No such grid.';
      if (s.energy.contracts.some((c) => c.region === a.region && c.until > s.day)) return 'A power contract is already in force there.';
      if (!regionPlants(s, a.region!).some((d) => !s.sites[d.id].mothballed)) return 'You have no working plants on that grid.';
      return null;
    case 'gridUpgrade':
      if (!(a.region! in s.energy.grids)) return 'No such grid.';
      if (s.energy.grids[a.region!].upgrading !== null) return 'An upgrade is already under way.';
      if (s.energy.grids[a.region!].reserve >= 0.32) return 'The grid already has plenty in reserve.';
      return funds(gridUpgradeCost(s));
  }
  return null;
}

export function applyEnergy(s: SimState, a: { type: string; site?: string; region?: RegionId }, feed: Feed): void {
  const pay = (v: number) => {
    s.treasury -= v;
    s.month.spend.projects += v;
  };
  switch (a.type) {
    case 'generator':
      pay(generatorCost(s, a.site!));
      s.energy.generators.push(a.site!);
      feed(s, 'info', `Backup generators installed at ${SITE_BY_ID[a.site!].name}: it keeps 70% of its output through a blackout.`, a.site);
      break;
    case 'powerContract': {
      const price = contractPrice(s, a.region!);
      s.energy.contracts = s.energy.contracts.filter((c) => c.until > s.day);
      s.energy.contracts.push({ region: a.region!, price, until: s.day + CONTRACT_MONTHS * DAYS_PER_MONTH });
      feed(s, 'info', `Power contract signed for ${REGIONS[a.region!].name}: your plants there pay ${Math.round(price * 100)}% of the normal price for two years, whatever the market does.`);
      break;
    }
    case 'gridUpgrade':
      pay(gridUpgradeCost(s));
      s.energy.grids[a.region!].upgrading = GRID_UPGRADE_DAYS;
      s.strategy.factions.regions = clamp(s.strategy.factions.regions + 2);
      feed(s, 'info', `You fund new generating capacity for ${REGIONS[a.region!].name}: about six months.`);
      break;
  }
}

export function energyDay(s: SimState, feed: Feed): void {
  for (const r of GRID_REGIONS) {
    const g = s.energy.grids[r];
    if (g.upgrading !== null && --g.upgrading <= 0) {
      g.upgrading = null;
      g.reserve = clamp(g.reserve + 0.08, 0, 0.4);
      feed(s, 'good', `New generating capacity comes on line in ${REGIONS[r].name}: blackouts there are rarer.`);
    }
    if (g.outage > 0) {
      if (--g.outage === 0) feed(s, 'good', `Power is back across ${REGIONS[r].name}.`);
      s.month.blackoutDays = (s.month.blackoutDays ?? 0) + 1;
      continue;
    }
    if (s.day > 60 && rand(s) < blackoutOdds(s, r)) {
      g.outage = randInt(s, 1, 4);
      const war = s.crisis?.phase === 'active' && s.crisis.region === r;
      const mine = SITES.filter((d) => d.owner === 'state' && d.region === r && s.sites[d.id].processes.length && !s.sites[d.id].mothballed);
      const dark = mine.filter((d) => !s.energy.generators.includes(d.id)).length;
      feed(
        s,
        'bad',
        `${war ? 'Strikes on the grid black out' : 'A blackout hits'} ${REGIONS[r].name} for about ${g.outage} day${g.outage > 1 ? 's' : ''}.${mine.length ? ` ${dark ? `${dark} of your plants there stop` : 'Your plants there run on their generators'}.` : ''}`,
        undefined,
        dark > 0,
      );
    }
  }
}

export function energyMonth(s: SimState, feed: Feed): void {
  const e = s.energy;
  // Fuel shocks: rare, sudden, and slow to fade.
  if (e.shock) {
    e.shock.days -= DAYS_PER_MONTH;
    if (e.shock.days <= 0) {
      e.shock = null;
      feed(s, 'good', 'The fuel shock is over: power prices are easing.');
    }
  } else if (s.day > 120 && !calm(s) && rand(s) < 0.018 * troubleScale(s)) {
    e.shock = { size: Math.round(randRange(s, 0.25, 0.6) * 100) / 100, days: randInt(s, 90, 210) };
    feed(s, 'bad', `${pick(s, ['A cold snap abroad', 'A pipeline outage', 'Unrest in the gas fields'])} sends fuel prices soaring: power costs up by about ${Math.round(e.shock.size * 100)}% for months.`, undefined, true);
  }
  const winter = [11, 0, 1].includes(Math.floor(Math.max(0, s.day - 1) / DAYS_PER_MONTH) % 12);
  for (const r of GRID_REGIONS) {
    const g = e.grids[r];
    const target = 1 + (e.shock?.size ?? 0) + (winter && r !== 'central' ? 0.08 : 0) + (0.18 - g.reserve) * 0.3;
    g.price = Math.round(clamp(g.price + (target - g.price) * 0.35 + (rand(s) - 0.5) * 0.04, 0.7, 2.2) * 100) / 100;
    // Demand grows faster than supply: reserves slowly thin unless someone builds.
    g.reserve = clamp(g.reserve - 0.001, 0, 0.4);
  }
  e.contracts = e.contracts.filter((c) => {
    if (c.until > s.day) return true;
    feed(s, 'info', `The power contract for ${REGIONS[c.region].name} has ended: your plants there pay the market price again.`);
    return false;
  });
}

/** A region's grid for display. */
export const gridName = (r: RegionId) => `${REGIONS[r].name} grid`;
export const regionPlants = (s: SimState, r: RegionId) => SITES.filter((d) => d.owner === 'state' && d.region === r && s.sites[d.id].processes.length > 0 && s.sites[d.id].status !== 'closed');
export { regionOf };
