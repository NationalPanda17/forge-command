// Derived values. Pure reads of GameState, shared by the engine, the advisor and the UI.
import { pressureOf, rulesOf } from './rules';
import {
  BASE_BAYS_PER_LINE,
  FACILITIES,
  FACILITY_IDS,
  FAI_MONTHS,
  INVEST_STEP,
  tier2For,
  NEW_TRANCHE_MATURITY,
  CAMPUSES,
  COMPONENTS,
  LINES,
  LINE_IDS,
  PREMIUM_WAGE,
  RUN_CREW,
  RUN_FACTOR,
  RUN_OVERHEAD,
  STORAGE_RATE,
  SUPPLIERS,
  THREATS,
  THREAT_IDS,
  WAGE,
  linesAt,
  suppliersOf,
} from './data';
import type { CampusId, ComponentId, ComponentState, GameState, LineId, LineState, ResearchId, ReserveState, ThreatId, Tranche } from './types';

/** New capacity: first-article inspection first, then ramp-up from about 30%. */
export const newTranche = (state: GameState, capacity: number): Tranche => ({
  capacity,
  maturity: NEW_TRANCHE_MATURITY,
  base: false,
  faiMonths: FAI_MONTHS[state.difficulty],
});

// ---------- Research and established lines ----------

export const hasResearch = (state: GameState, r: ResearchId) => state.research.done.includes(r);
/** A line exists once its floor has been set up (base lines exist from the start). */
export const isEstablished = (state: GameState, id: LineId) => state.lines[id].tranches.length > 0;
export const activeLines = (state: GameState) => LINE_IDS.filter((id) => isEstablished(state, id));

/** Parts per round after research. */
export function bomOf(state: GameState, id: LineId): Partial<Record<ComponentId, number>> {
  const out: Partial<Record<ComponentId, number>> = { ...LINES[id].bom };
  const scale = (c: ComponentId, m: number) => {
    if (out[c] !== undefined) out[c] = out[c]! * m;
  };
  if (hasResearch(state, 'galliumLight')) scale('criticalMaterials', 0.6);
  if (hasResearch(state, 'commonMotors')) scale('srm', 0.85);
  if (hasResearch(state, 'imFill')) scale('energetics', 0.9);
  if (hasResearch(state, 'seekerDTC')) {
    scale('rfSeeker', 0.8);
    scale('irSeeker', 0.8);
  }
  return out;
}
export const testHoursMult = (state: GameState) => (hasResearch(state, 'digitalTest') ? 0.7 : 1);
export const maxUpgrade = (state: GameState, kind: 'automation' | 'quality') => (kind === 'automation' && hasResearch(state, 'lightsOut') ? 3 : 2);
/** Share of a threat class that reaches the interceptors after passive defenses. */
export const passiveFilter = (state: GameState, t: ThreatId) => (t === 'drone' && hasResearch(state, 'hpm') ? 0.8 : 1);
/** Demand multiplier on a land line's fire missions. */
export const landEfficiency = (state: GameState, id: LineId) => (id === 'shell155' && hasResearch(state, 'smartFuzes') ? 0.85 : 1);

export const installedCapacity = (line: LineState) => line.tranches.reduce((s, t) => s + t.capacity, 0);
export const expansions = (line: LineState) => line.tranches.filter((t) => !t.base).length;

export function effectiveCapacity(line: LineState): number {
  const raw = line.tranches.reduce((s, t) => s + (t.faiMonths > 0 ? 0 : t.capacity * t.maturity), 0);
  return line.installing ? raw * 0.85 : raw;
}

/** Learning curve: cumulative output raises productivity, up to +30%. */
export function productivity(line: LineState): number {
  const base = LINES[line.id].baseCapacity * 12;
  return 1 + Math.min(0.3, 0.1 * Math.log2(1 + line.experience / base));
}

export function usedBays(state: GameState, campus: CampusId): number {
  const lines = linesAt(campus).reduce((s, id) => s + (state.lines[id].tranches.length > 0 ? BASE_BAYS_PER_LINE : 0) + expansions(state.lines[id]), 0);
  return lines + state.campuses[campus].retooling.length;
}
export const freeBays = (state: GameState, campus: CampusId) => state.campuses[campus].bays - usedBays(state, campus);

export function crewNeed(state: GameState, id: LineId): number {
  const line = state.lines[id];
  const def = LINES[id];
  const auto = 1 - 0.15 * line.upgrades.automation;
  return (def.baseCrew * (installedCapacity(line) / def.baseCapacity) * RUN_CREW[line.run] * auto) / productivity(line);
}

/** Crew for in-house plants on this campus. */
export function facilityCrewAt(state: GameState, campus: CampusId): number {
  let n = 0;
  for (const f of FACILITY_IDS) {
    const st = state.facilities[f];
    if (FACILITIES[f].campus !== campus || st.status !== 'running') continue;
    const installed = st.tranches.reduce((a, t) => a + t.capacity, 0);
    n += FACILITIES[f].crew * (installed / FACILITIES[f].baseCap) * (st.run === 'idle' ? 0.15 : 1);
  }
  return n;
}

export const campusCrewNeed = (state: GameState, campus: CampusId) =>
  linesAt(campus).reduce((s, id) => s + crewNeed(state, id), 0) + facilityCrewAt(state, campus);

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
  return LINE_IDS.reduce((s, id) => s + plannedOutput(state, id) * (bomOf(state, id)[c] ?? 0), 0);
}

/** What one supplier can ship this month. */
export function supplierCap(state: GameState, sid: string): number {
  const def = SUPPLIERS[sid];
  const st = state.suppliers[sid];
  if (!st.qualified || st.bankrupt || st.embargoMonths > 0) return 0;
  const t = tier2For(def.component);
  const feed = t && rulesOf(state).shortages ? state.tier2[t].availability : 1;
  return def.baseCap * (1 + INVEST_STEP * st.capBonus) * rulesOf(state).capMult * st.capFactor * feed;
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
  const pressure = pressureOf(state);
  const def = LINES[id];
  if (!isEstablished(state, id)) return 0;
  if (def.family === 'land') return (def.landDraw ?? 0) * pressure * landEfficiency(state, id);
  let shots = 0;
  for (const t of THREAT_IDS) {
    const th = THREATS[t];
    const live = th.assign.filter((a) => a.weight > 0 && isEstablished(state, a.line));
    const wsum = live.reduce((s, a) => s + a.weight, 0);
    for (const a of live) if (a.line === id) shots += th.calm * passiveFilter(state, t) * th.shots * (a.weight / wsum);
  }
  return shots * pressure;
}

export const RESERVE_TARGET_MONTHS = 6;
export const reserveTarget = (state: GameState, id: LineId) => calmDraw(state, id) * RESERVE_TARGET_MONTHS;
export const reserveTotal = (r: ReserveState) => r.stock + r.degraded;

/** Every round of a type in the country: central reserve, regional depots and convoys on the road. */
export function nationalStock(state: GameState, id: LineId): number {
  let n = reserveTotal(state.reserves[id]);
  for (const t of Object.values(state.theaters)) n += t.depot[id].full + t.depot[id].degraded;
  for (const c of state.convoys) if (c.line === id) n += c.full + c.degraded;
  return n;
}

export function readiness(state: GameState): number {
  const parts = activeLines(state).map((id) => Math.min(1, nationalStock(state, id) / Math.max(1, reserveTarget(state, id))));
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

/** Months of forecast draw the reserve covers. */
export function coverMonths(state: GameState, id: LineId): number {
  const f = state.forecast.draw[id];
  const avg = f.reduce((a, b) => a + b, 0) / Math.max(1, f.length) || calmDraw(state, id);
  return nationalStock(state, id) / Math.max(0.01, avg);
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
