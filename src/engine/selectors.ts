// Derived values. Pure reads of GameState, shared by the engine, the advisor and the UI.
import {
  BASE_BAYS_PER_LINE,
  CAMPUSES,
  COMPONENTS,
  DIFFICULTY,
  LINES,
  LINE_IDS,
  PREMIUM_WAGE,
  RUN_CREW,
  RUN_FACTOR,
  RUN_OVERHEAD,
  SCENARIOS,
  STORAGE_RATE,
  SUPPLIERS,
  THREATS,
  THREAT_IDS,
  WAGE,
  linesAt,
  suppliersOf,
} from './data';
import type { CampusId, ComponentId, ComponentState, GameState, LineId, LineState, ReserveState } from './types';

export const installedCapacity = (line: LineState) => line.tranches.reduce((s, t) => s + t.capacity, 0);
export const expansions = (line: LineState) => line.tranches.filter((t) => !t.base).length;

export function effectiveCapacity(line: LineState): number {
  const raw = line.tranches.reduce((s, t) => s + t.capacity * t.maturity, 0);
  return line.installing ? raw * 0.85 : raw;
}

/** Learning curve: cumulative output raises productivity, up to +30%. */
export function productivity(line: LineState): number {
  const base = LINES[line.id].baseCapacity * 12;
  return 1 + Math.min(0.3, 0.1 * Math.log2(1 + line.experience / base));
}

export function usedBays(state: GameState, campus: CampusId): number {
  const lines = linesAt(campus).reduce((s, id) => s + BASE_BAYS_PER_LINE + expansions(state.lines[id]), 0);
  return lines + state.campuses[campus].retooling.length;
}
export const freeBays = (state: GameState, campus: CampusId) => state.campuses[campus].bays - usedBays(state, campus);

export function crewNeed(state: GameState, id: LineId): number {
  const line = state.lines[id];
  const def = LINES[id];
  const auto = 1 - 0.15 * line.upgrades.automation;
  return (def.baseCrew * (installedCapacity(line) / def.baseCapacity) * RUN_CREW[line.run] * auto) / productivity(line);
}

export const campusCrewNeed = (state: GameState, campus: CampusId) =>
  linesAt(campus).reduce((s, id) => s + crewNeed(state, id), 0);

/** 0..1: share of crew needs the campus can cover this month. */
export function staffing(state: GameState, campus: CampusId): number {
  const need = campusCrewNeed(state, campus);
  if (need <= 0) return 1;
  return Math.min(1, state.campuses[campus].workers / need);
}

export function strikeFactor(state: GameState, campus: CampusId): number {
  return state.campuses[campus].strikeMonths > 0 ? 0.3 : 1;
}

/** Planned production this month before component limits. */
export function plannedOutput(state: GameState, id: LineId): number {
  const line = state.lines[id];
  const campus = LINES[id].campus;
  return effectiveCapacity(line) * RUN_FACTOR[line.run] * staffing(state, campus) * strikeFactor(state, campus);
}

export function plannedNeed(state: GameState, c: ComponentId): number {
  return LINE_IDS.reduce((s, id) => s + plannedOutput(state, id) * (LINES[id].bom[c] ?? 0), 0);
}

/** What one supplier can ship this month. */
export function supplierCap(state: GameState, sid: string): number {
  const def = SUPPLIERS[sid];
  const st = state.suppliers[sid];
  if (!st.qualified || st.bankrupt || st.embargoMonths > 0) return 0;
  const congestion = st.congestionMonths > 0 ? 0.5 : 1;
  return def.baseCap * DIFFICULTY[state.difficulty].capMult * st.capFactor * congestion;
}

export const componentCap = (state: GameState, c: ComponentId) =>
  suppliersOf(c).reduce((s, sid) => s + supplierCap(state, sid), 0);

export const contractedPerMonth = (cs: ComponentState, supplier?: string) =>
  cs.contracts.reduce((s, k) => s + (k.monthsLeft > 0 && (!supplier || k.supplier === supplier) ? k.qtyPerMonth : 0), 0);

export const contractCostPerMonth = (cs: ComponentState) =>
  cs.contracts.reduce((s, k) => s + (k.monthsLeft > 0 ? k.qtyPerMonth * k.unitPrice : 0), 0);

export const backlogOf = (cs: ComponentState) => cs.contracts.reduce((s, k) => s + k.backlog, 0);

/** Expected calm-time draw per month (doctrine weights, no crisis). */
export function calmDraw(state: GameState, id: LineId): number {
  const pressure = SCENARIOS[state.scenario].pressure;
  const def = LINES[id];
  if (def.family === 'land') return (def.landDraw ?? 0) * pressure;
  let shots = 0;
  for (const t of THREAT_IDS) {
    const th = THREATS[t];
    for (const a of th.assign) if (a.line === id) shots += th.calm * th.shots * a.weight;
  }
  return shots * pressure;
}

export const RESERVE_TARGET_MONTHS = 6;
export const reserveTarget = (state: GameState, id: LineId) => calmDraw(state, id) * RESERVE_TARGET_MONTHS;
export const reserveTotal = (r: ReserveState) => r.stock + r.degraded;

export function readiness(state: GameState): number {
  const parts = LINE_IDS.map((id) => Math.min(1, reserveTotal(state.reserves[id]) / reserveTarget(state, id)));
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

/** Months of forecast draw the reserve covers. */
export function coverMonths(state: GameState, id: LineId): number {
  const f = state.forecast.draw[id];
  const avg = f.reduce((a, b) => a + b, 0) / Math.max(1, f.length) || calmDraw(state, id);
  return reserveTotal(state.reserves[id]) / Math.max(0.01, avg);
}

export function wageBill(state: GameState, campus: CampusId): number {
  const c = state.campuses[campus];
  const heads = c.workers + c.trainees.reduce((s, t) => s + t.count, 0);
  return heads * WAGE * (c.wage === 'premium' ? PREMIUM_WAGE : 1);
}

export function lineOverhead(state: GameState, id: LineId): number {
  const line = state.lines[id];
  const def = LINES[id];
  const energy = state.mods.energyMonths > 0 ? 1.25 : 1;
  return (def.overhead * (installedCapacity(line) / def.baseCapacity) * RUN_OVERHEAD[line.run] * energy) / Math.sqrt(productivity(line));
}

export const storageCost = (state: GameState) =>
  (Object.keys(state.components) as ComponentId[]).reduce((s, c) => s + state.components[c].stock * COMPONENTS[c].price * STORAGE_RATE, 0);

/** Rough fixed monthly burn: wages, overhead and contracts. */
export function monthlyBurn(state: GameState): number {
  const wages = (Object.keys(CAMPUSES) as CampusId[]).reduce((s, c) => s + wageBill(state, c), 0);
  const overhead = LINE_IDS.reduce((s, id) => s + lineOverhead(state, id), 0);
  const contracts = (Object.keys(state.components) as ComponentId[]).reduce((s, c) => s + contractCostPerMonth(state.components[c]), 0);
  return wages + overhead + contracts + storageCost(state);
}

export const pendingDecisions = (state: GameState) => state.decisions.length;

export const isForeign = (sid: string) => SUPPLIERS[sid].nation !== 'aldmere';
