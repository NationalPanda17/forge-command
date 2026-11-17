import {
  BASE_BAYS_PER_LINE,
  FACILITY_IDS,
  STAGES,
  START_WIP_MONTHS,
  TEST_CELLS,
  START_STOCK_MONTHS,
  CAMPUSES,
  CAMPUS_IDS,
  COMPONENTS,
  COMPONENT_IDS,
  CRISES,
  DIFFICULTY,
  LINES,
  LINE_IDS,
  PARTNER_IDS,
  SCENARIOS,
  SUPPLIERS,
  SUPPLIER_IDS,
  linesAt,
  suppliersOf,
} from './data';
import { computeForecast } from './demand';
import { spawnTender } from './partners';
import { randRange } from './rng';
import { calmDraw, crewNeed } from './selectors';
import type {
  CampusId,
  CampusState,
  ComponentId,
  ComponentState,
  Difficulty,
  FacilityId,
  FacilityState,
  GameState,
  Ledger,
  LineId,
  LineState,
  PartnerId,
  PartnerState,
  ReserveState,
  ScenarioId,
  SupplierState,
} from './types';

export interface NewGameOptions {
  seed: number;
  difficulty?: Difficulty;
  scenario?: ScenarioId;
  months?: number;
}

export const emptyLedger = (): Ledger => ({
  wages: 0,
  overhead: 0,
  components: 0,
  storage: 0,
  projects: 0,
  revenue: 0,
  appropriation: 0,
  penalties: 0,
});

/** Components the original floors need per month at a normal pace. */
export function baselineNeed(c: ComponentId): number {
  return LINE_IDS.reduce((sum, id) => sum + LINES[id].baseCapacity * (LINES[id].bom[c] ?? 0), 0);
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export const emptyFacility = (id: FacilityId): FacilityState => ({ id, status: 'none', monthsLeft: 0, tranches: [], run: 'normal', lastOutput: 0, lastLimit: null });

export function newGame({ seed, difficulty = 'normal', scenario = 'standard', months = 48 }: NewGameOptions): GameState {
  const rules = DIFFICULTY[difficulty];
  const sc = SCENARIOS[scenario];

  const lines = {} as Record<LineId, LineState>;
  for (const id of LINE_IDS) {
    const def = LINES[id];
    lines[id] = {
      id,
      tranches: [{ capacity: def.baseCapacity, maturity: 1, base: true, faiMonths: 0 }],
      run: 'normal',
      priority: 'normal',
      wear: 10,
      partial: 0,
      experience: def.baseCapacity * 12,
      upgrades: { automation: 0, quality: 0 },
      installing: null,
      quarantine: [],
      substitutes: {},
      wip: STAGES[id].slice(1).map(() => Math.round(def.baseCapacity * START_WIP_MONTHS * 100) / 100),
      debottleneck: STAGES[id].map(() => 0),
      debottlenecking: null,
      stages: STAGES[id].map(() => ({ cap: 0, throughput: 0, scrap: 0, limit: null })),
      testShare: 0.05,
      latentRisk: 0,
      last: { output: 0, degraded: 0, quarantined: 0, tested: 0, toPartners: 0, toReserve: 0, staffing: 1, limit: null, usedSubstitutes: [] },
    };
  }

  const suppliers = {} as Record<string, SupplierState>;
  const campuses = {} as Record<CampusId, CampusState>;
  const components = {} as Record<ComponentId, ComponentState>;
  const reserves = {} as Record<LineId, ReserveState>;
  const partners = {} as Record<PartnerId, PartnerState>;

  const state: GameState = {
    version: 3,
    seed: seed >>> 0,
    rng: seed >>> 0,
    scenario,
    month: 0,
    months,
    difficulty,
    treasury: Math.round(rules.startTreasury * sc.treasuryMult),
    appropriation: Math.round(rules.appropriation * sc.budgetMult),
    confidence: 60,
    lines,
    campuses,
    suppliers,
    components,
    reserves,
    facilities: Object.fromEntries(FACILITY_IDS.map((f) => [f, emptyFacility(f)])) as Record<FacilityId, FacilityState>,
    partners,
    partnerContracts: [],
    tenders: [],
    crisis: null,
    opponentFocus: null,
    forecast: { draw: {} as Record<LineId, number[]>, focus: null, confidence: 1 },
    doctrine: { conserve: false },
    decisions: [],
    inbox: [],
    pending: emptyLedger(),
    mods: { energyMonths: 0, supplementalCooldown: 0, supplementalPending: false },
    nextId: 1,
    history: [],
    reviews: [],
    over: false,
    outcome: 'running',
  };

  for (const sid of SUPPLIER_IDS) {
    const def = SUPPLIERS[sid];
    suppliers[sid] = {
      id: sid,
      qualified: def.startQualified,
      qualifyingMonths: null,
      health: def.startQualified ? Math.round(randRange(state, 62, 78)) : Math.round(randRange(state, 50, 75)),
      capFactor: 1,
      shockMonths: 0,
      embargoMonths: 0,
      congestionMonths: 0,
      bankrupt: false,
      lastDelivered: 0,
    };
  }

  for (const c of CAMPUS_IDS) {
    const def = CAMPUSES[c];
    campuses[c] = {
      id: c,
      bays: linesAt(c).length * BASE_BAYS_PER_LINE + def.spareBays,
      construction: [],
      retooling: [],
      workers: 0,
      trainees: [],
      pool: def.laborPool,
      morale: 65,
      wage: 'standard',
      strikeMonths: 0,
      securityMonths: 0,
      lastCrewNeed: 0,
      testCells: TEST_CELLS[c].start,
      testCellBuilds: [],
      lastTestHours: { need: 0, avail: 0 },
    };
  }
  for (const c of CAMPUS_IDS) {
    const need = linesAt(c).reduce((s, id) => s + crewNeed(state, id), 0);
    campuses[c].workers = Math.ceil(need * 1.03);
    campuses[c].lastCrewNeed = need;
  }

  for (const c of COMPONENT_IDS) {
    const need = baselineNeed(c);
    const primary = suppliersOf(c).find((sid) => SUPPLIERS[sid].startQualified)!;
    components[c] = {
      id: c,
      stock: round2(need * (START_STOCK_MONTHS[c] ?? 1.5)),
      contracts: [
        {
          id: state.nextId++,
          supplier: primary,
          qtyPerMonth: round2(need * 0.85),
          monthsLeft: 9,
          months: 9,
          unitPrice: COMPONENTS[c].price * SUPPLIERS[primary].priceMult * 0.88,
          backlog: 0,
        },
      ],
      spotOrder: 0,
      lastDelivered: 0,
      lastUsed: 0,
      lastShort: 0,
      lastSubstituted: 0,
    };
  }

  for (const id of LINE_IDS) {
    reserves[id] = { id, stock: Math.round(calmDraw(state, id) * sc.reserveMonths), degraded: 0, made: 0, used: 0, unmet: 0, valueStopped: 0, engaged: {} };
  }
  for (const p of PARTNER_IDS) partners[p] = { id: p, goodwill: 50 };

  if (sc.openingCrisis) {
    const def = CRISES.find((c) => c.id === sc.openingCrisis)!;
    state.crisis = { id: def.id, name: def.name, family: def.family, phase: 'active', monthsLeft: 8, intensity: 1, mix: def.mix, blurb: def.blurb };
  }
  if (sc.embargo) suppliers[sc.embargo.supplier].embargoMonths = sc.embargo.months;
  if (sc.shock) {
    suppliers[sc.shock.supplier].capFactor = sc.shock.factor;
    suppliers[sc.shock.supplier].shockMonths = sc.shock.months;
  }

  spawnTender(state);
  state.forecast = computeForecast(state);
  return state;
}
