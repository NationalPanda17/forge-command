import type { LineId, MaterialId, RegionId } from './world';
import type { Decision, FactionId, Person, ResearchId, StaffRole } from './strategy';

export type Difficulty = 'easy' | 'normal' | 'hard';
export type ScenarioId = 'standard' | 'longWar' | 'brokenChain' | 'rebuild';
export type RunLevel = 'idle' | 'normal' | 'surge';
export type ThreatId = 'drone' | 'rocket' | 'cruise' | 'ballistic' | 'aircraft';

/** A batch of finished rounds made on one day. Ages, gets certified, eventually retires. */
export interface Lot {
  qty: number;
  /** Day it was made (negative = before the campaign began). */
  made: number;
  /** Serviceable until this day; surveillance testing can extend it. */
  until: number;
  /** Times surveillance has extended this lot (at most twice). */
  ext?: number;
}

export interface ProcessState {
  recipe: string;
  /** Units a day at full maturity. */
  capacity: number;
  /** 0..1 ramp-up of the newest capacity, blended. */
  maturity: number;
  run: RunLevel;
  partial: number;
  lastOutput: number;
  lastLimit: MaterialId | 'capacity' | 'idle' | 'crew' | 'damaged' | 'demand' | null;
  /** Expansion steps added (each +25% of the original). */
  expansions: number;
  /** New capacity still ramping up: it never drags down what is already running. */
  ramp?: { cap: number; maturity: number }[];
}

export interface SiteState {
  id: string;
  status: 'active' | 'damaged' | 'building' | 'closed';
  /** 0..100: wear and damage. */
  condition: number;
  /** Days until repairs or construction finish. */
  repairDays: number;
  processes: ProcessState[];
  stock: Partial<Record<MaterialId, number>>;
  lots: Partial<Record<LineId, Lot[]>>;
  /** Rounds past their service life, waiting for refurbishment or demilitarization. */
  unserviceable: Partial<Record<LineId, number>>;
  workers: number;
  /** New hires still in training. */
  trainees: { count: number; days: number }[];
  /** Extra crew needed for lines added later (new products). */
  extraCrew: number;
  /** Private and foreign companies: 0..100 financial health. */
  health: number;
  qualified: boolean;
  qualifyingDays: number | null;
  /** Foreign: export ban days left. Any site: disruption days left (output cut). */
  embargoDays: number;
  disruptionDays: number;
  disruptionFactor: number;
}

export interface Shipment {
  id: number;
  from: string;
  to: string;
  material: MaterialId;
  qty: number;
  lots?: Lot[];
  depart: number;
  arrive: number;
  /** Site ids along the way, for drawing. */
  path: string[];
  modes: string[];
}

export interface Contract {
  id: number;
  site: string;
  material: MaterialId;
  /** Units per day reserved for your arsenals. */
  perDay: number;
  /** $M per unit. */
  price: number;
  endDay: number;
}

export interface FeedItem {
  day: number;
  tone: 'good' | 'bad' | 'warn' | 'info';
  text: string;
  site?: string;
}

export interface Crisis {
  id: string;
  name: string;
  region: RegionId;
  family: 'air' | 'land';
  phase: 'warning' | 'active';
  /** Days left in this phase. */
  days: number;
  intensity: number;
  mix: Partial<Record<ThreatId, number>>;
}

export interface MonthReport {
  month: number;
  made: Partial<Record<MaterialId, number>>;
  fired: Partial<Record<LineId, number>>;
  arrived: Record<ThreatId, number>;
  stopped: Record<ThreatId, number>;
  leaked: Record<ThreatId, number>;
  spend: { purchases: number; operations: number; transport: number; projects: number; demil: number };
  income: { appropriation: number; sales: number };
  interceptorSpend: number;
  threatValueStopped: number;
  readiness: number;
  confidence: number;
  treasury: number;
  retired: number;
  demilled: number;
}

export interface Policy {
  /** Days of regional draw each regional depot tries to hold. */
  depotDays: Record<RegionId, number>;
  /** Days of draw each base keeps on hand. */
  baseDays: number;
  /** Test lots nearing the end of their service life to extend them. */
  surveillance: boolean;
  demilMethod: 'burn' | 'recycle';
  /** Keep PAC-3 and SM-6 off drones and rockets. */
  conserve: boolean;
}

export interface SimState {
  version: 1;
  seed: number;
  rng: number;
  day: number;
  /** Campaign length in days. */
  days: number;
  difficulty: Difficulty;
  scenario: ScenarioId;
  treasury: number;
  /** $M a month. */
  appropriation: number;
  confidence: number;
  sites: Record<string, SiteState>;
  shipments: Shipment[];
  contracts: Contract[];
  /** Tonnes already booked on each route today. */
  routeLoad: Record<string, number>;
  crisis: Crisis | null;
  policy: Policy;
  /** since: the day a line was unlocked (new lines get a year's grace before they count). */
  lines: Record<LineId, { unlocked: boolean; since?: number }>;
  feed: FeedItem[];
  /** Running totals for the month in progress. */
  month: MonthReport;
  history: MonthReport[];
  nextId: number;
  over: boolean;
  outcome: 'running' | 'complete' | 'dismissed';
  /** Set when something important happens; the clock pauses if the player wants it to. */
  alert: FeedItem | null;
  strategy: {
    research: { done: ResearchId[]; active: { id: ResearchId; days: number } | null };
    staff: Record<StaffRole, Person | null>;
    candidates: Person[];
    factions: Record<FactionId, number>;
    decisions: Decision[];
    objectives: { id: string; status: 'open' | 'done' | 'failed' }[];
    baseBudget: number;
    startWorkers: number;
    investedThisMonth: number;
  };
}
