// A new campaign: every site, its stock, legacy rounds of mixed ages in the depots and bases, and the starting contracts.
import { BASE_LINES } from './fight';
import { MIN_BASE_ROUNDS } from './tick';
import { rand, randInt } from './rng';
import { DAYS_PER_MONTH, baseDailyDraw, inputRates, nationalDailyDraw, regionDailyDraw } from './selectors';
import type { Difficulty, Lot, MonthReport, ScenarioId, SimState, SiteState } from './types';
import { FIGHTING_REGIONS, FINISHED, MATERIALS, RECIPES, REGIONS, SITES, SITE_BY_ID, START_LINES, processCapacity, type LineId, type RegionId } from './world';

export interface SimOptions {
  seed: number;
  difficulty?: Difficulty;
  scenario?: ScenarioId;
  months?: number;
}

export const DIFFICULTY_MONEY: Record<Difficulty, { treasury: number; appropriation: number }> = {
  easy: { treasury: 900, appropriation: 240 },
  normal: { treasury: 700, appropriation: 215 },
  hard: { treasury: 550, appropriation: 195 },
};

export const emptyMonth = (month: number): MonthReport => ({
  month,
  made: {},
  fired: {},
  arrived: { drone: 0, rocket: 0, cruise: 0, ballistic: 0, aircraft: 0 },
  stopped: { drone: 0, rocket: 0, cruise: 0, ballistic: 0, aircraft: 0 },
  leaked: { drone: 0, rocket: 0, cruise: 0, ballistic: 0, aircraft: 0 },
  spend: { purchases: 0, operations: 0, transport: 0, projects: 0, demil: 0 },
  income: { appropriation: 0, sales: 0 },
  interceptorSpend: 0,
  threatValueStopped: 0,
  readiness: 0,
  confidence: 0,
  treasury: 0,
  retired: 0,
  demilled: 0,
});

/** Legacy stock: lots made between 1 and 9 years ago. */
function legacyLots(s: { rng: number }, line: LineId, qty: number): Lot[] {
  if (qty <= 0) return [];
  const shelf = MATERIALS[line].shelfDays;
  const lots: Lot[] = [];
  const n = 4;
  let left = Math.round(qty);
  for (let i = 0; i < n; i++) {
    const q = i === n - 1 ? left : Math.round(qty / n);
    if (q <= 0) continue;
    left -= q;
    const made = -randInt(s, 360, Math.min(shelf - 60, 3300));
    lots.push({ qty: q, made, until: made + shelf });
  }
  return lots.sort((a, b) => a.made - b.made);
}

export function newSim({ seed, difficulty = 'normal', scenario = 'standard', months = 48 }: SimOptions): SimState {
  const money = DIFFICULTY_MONEY[difficulty];
  const state: SimState = {
    version: 1,
    seed: seed >>> 0,
    rng: seed >>> 0,
    day: 0,
    days: months * DAYS_PER_MONTH,
    difficulty,
    scenario,
    treasury: money.treasury,
    appropriation: money.appropriation,
    confidence: 60,
    sites: {},
    shipments: [],
    contracts: [],
    routeLoad: {},
    crisis: null,
    policy: {
      depotDays: { north: 30, coast: 30, east: 30, isles: 45, central: 0 },
      baseDays: 10,
      surveillance: true,
      demilMethod: 'burn',
      conserve: false,
    },
    lines: Object.fromEntries(FINISHED.map((l) => [l, { unlocked: START_LINES.includes(l as LineId) }])) as SimState['lines'],
    feed: [],
    month: emptyMonth(0),
    history: [],
    nextId: 1,
    over: false,
    outcome: 'running',
    alert: null,
  };

  for (const def of SITES) {
    const site: SiteState = {
      id: def.id,
      status: 'active',
      condition: def.owner === 'state' ? 85 : Math.round(70 + rand(state) * 25),
      repairDays: 0,
      processes: def.processes.map((p) => ({
        recipe: p.recipe,
        capacity: processCapacity(p),
        maturity: 1,
        run: START_LINES.includes(RECIPES[p.recipe].output as LineId) || def.owner !== 'state' || !FINISHED.includes(RECIPES[p.recipe].output) ? 'normal' : 'idle',
        partial: 0,
        lastOutput: 0,
        lastLimit: null,
        expansions: 0,
      })),
      stock: {},
      lots: {},
      unserviceable: {},
      workers: def.crew,
      health: def.owner === 'state' ? 100 : Math.round(55 + rand(state) * 30),
      qualified: def.qualified,
      qualifyingDays: null,
      embargoDays: 0,
      disruptionDays: 0,
      disruptionFactor: 1,
    };
    state.sites[def.id] = site;
  }

  // Input buffers and a few days of output at every producing site.
  for (const site of Object.values(state.sites)) {
    const rates = inputRates(state, site);
    for (const [mat, rate] of Object.entries(rates)) site.stock[mat as keyof typeof rates] = Math.round(rate! * 12 * 100) / 100;
    for (const p of site.processes) {
      const out = RECIPES[p.recipe].output;
      if (!FINISHED.includes(out)) site.stock[out] = (site.stock[out] ?? 0) + p.capacity * 4;
    }
  }

  // Legacy rounds: the central depot, regional depots and bases.
  for (const line of START_LINES) {
    const daily = nationalDailyDraw(state, line);
    state.sites.depotCentral.lots[line] = legacyLots(state, line, daily * 45);
    for (const region of FIGHTING_REGIONS) {
      const depot = REGIONS[region].depot;
      const rd = regionDailyDraw(state, region as RegionId, line);
      if (rd > 0) state.sites[depot].lots[line] = legacyLots(state, line, rd * 20);
    }
    for (const def of SITES) {
      if (!(BASE_LINES[def.kind] ?? []).includes(line)) continue;
      const bd = baseDailyDraw(state, def.id, line);
      if (bd > 0) state.sites[def.id].lots[line] = legacyLots(state, line, Math.max(bd * state.policy.baseDays, MIN_BASE_ROUNDS[line] ?? 4));
    }
  }

  // Starting contracts: the arsenals' main suppliers, 85% of need, nine months.
  const arsenals = SITES.filter((x) => x.owner === 'state' && x.kind === 'arsenal');
  const needs: Record<string, number> = {};
  for (const a of arsenals) for (const [mat, rate] of Object.entries(inputRates(state, state.sites[a.id]))) needs[mat] = (needs[mat] ?? 0) + rate!;
  for (const [mat, need] of Object.entries(needs)) {
    const src = SITES.find((x) => x.owner === 'private' && x.qualified && x.processes.some((p) => RECIPES[p.recipe].output === mat));
    if (!src) continue;
    state.contracts.push({ id: state.nextId++, site: src.id, material: mat as LineId, perDay: Math.round(need * 0.85 * 1000) / 1000, price: MATERIALS[mat as LineId].price * 0.88, endDay: 9 * DAYS_PER_MONTH });
  }
  void SITE_BY_ID;
  return state;
}
