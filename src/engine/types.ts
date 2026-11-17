export type Difficulty = 'easy' | 'normal' | 'hard';
export type ScenarioId = 'standard' | 'longWar' | 'brokenChain' | 'rebuild';

export type ComponentId =
  | 'srm'
  | 'rfSeeker'
  | 'irSeeker'
  | 'energetics'
  | 'microelectronics'
  | 'criticalMaterials'
  | 'shellBodies';

export type LineId = 'pac3' | 'sm6' | 'tamir' | 'irist' | 'stinger' | 'gmlrs' | 'shell155';
export type CampusId = 'corran' | 'northgate' | 'ashford';
export type ThreatId = 'drone' | 'rocket' | 'cruise' | 'ballistic' | 'aircraft';
export type PartnerId = 'varenna' | 'osterholm' | 'sundar' | 'calder';
export type NationId = 'aldmere' | 'corvane' | 'ostrel' | 'karsk';

/** Air defense interceptors or land fires. */
export type Family = 'air' | 'land';
export type RunMode = 'idle' | 'normal' | 'surge';
export type Priority = 'high' | 'normal' | 'low';
export type UpgradeKind = 'automation' | 'quality';
export type WagePolicy = 'standard' | 'premium';
export type Tier2Id = 'perchlorate' | 'nitro' | 'steel' | 'wafers' | 'ore' | 'optics';
export type FacilityId = 'motorWorks' | 'arsenalForge' | 'opticsLab';

// ---------- Static catalog ----------

export interface NationDef {
  id: NationId;
  name: string;
  blurb: string;
}

export interface ComponentDef {
  id: ComponentId;
  name: string;
  unit: string;
  /** $M per unit at list price. */
  price: number;
  blurb: string;
  substitute: { name: string; perf: number; priceMult: number; /** Units per month available. */ cap: number; blurb: string };
}

export interface SupplierDef {
  id: string;
  component: ComponentId;
  name: string;
  nation: NationId;
  /** Units per month at full health. */
  baseCap: number;
  priceMult: number;
  startQualified: boolean;
  qualifyMonths: number;
  qualifyCost: number;
  blurb: string;
}

export interface CampusDef {
  id: CampusId;
  name: string;
  region: string;
  /** Bays beyond what the original lines use. */
  spareBays: number;
  /** $M and bays per new building. */
  buildCost: number;
  buildBays: number;
  /** Local workers available to hire, refilling each month. */
  laborPool: number;
  blurb: string;
}

export interface LineDef {
  id: LineId;
  name: string;
  maker: string;
  campus: CampusId;
  family: Family;
  role: string;
  /** Units per month at 100% maturity on the original floor. */
  baseCapacity: number;
  publicRate: string;
  /** $M per finished round (reference unit cost). */
  unitCost: number;
  /** $M per month of non-labour overhead for the original floor at a normal pace. */
  overhead: number;
  /** Skilled workers to run the original floor at a normal pace. */
  baseCrew: number;
  /** $M per expansion step (+25% of base capacity, one bay). */
  expandCost: number;
  bom: Partial<Record<ComponentId, number>>;
  /** Land fires only: units drawn per month in calm times. */
  landDraw?: number;
  blurb: string;
}

export interface ThreatDef {
  id: ThreatId;
  name: string;
  /** $M, estimated from public reporting. */
  estCost: number;
  /** Interceptor shots per threat engaged. */
  shots: number;
  /** Confidence lost per leaker. */
  severity: number;
  /** Calm-time arrivals per month. */
  calm: number;
  /** Interceptor assignment by doctrine; order is the fallback order. */
  assign: { line: LineId; weight: number; pk: number }[];
  blurb: string;
}

export interface PartnerDef {
  id: PartnerId;
  name: string;
  blurb: string;
  /** Lines this partner tends to buy. */
  wants: LineId[];
}

// ---------- Mutable state ----------

export interface Tranche {
  capacity: number;
  /** 0..1: new capacity starts near 0.3 and climbs each month. */
  maturity: number;
  /** True for the original floor (4 bays, never retooled). */
  base: boolean;
  /** Months of first-article inspection left before this capacity counts. */
  faiMonths: number;
}

export interface StageDef {
  id: string;
  name: string;
  /** Stage capacity relative to the line's capacity. */
  mult: number;
  /** Share of units that pass this stage (before learning). */
  yield: number;
  /** Components consumed at this stage. */
  comps: ComponentId[];
  /** Acceptance stage: test-cell hours per unit. */
  testHours?: number;
}

export interface StageLast {
  cap: number;
  throughput: number;
  scrap: number;
  /** What held this stage back. */
  limit: 'capacity' | 'starved' | 'blocked' | 'parts' | 'tests' | null;
}

export interface FacilityDef {
  id: FacilityId;
  name: string;
  campus: CampusId;
  component: ComponentId;
  buildCost: number;
  baseCap: number;
  expandCap: number;
  expandCost: number;
  maxExpansions: number;
  crew: number;
  /** Other components consumed per unit made. */
  inputs: Partial<Record<ComponentId, number>>;
  /** $M per unit of raw materials and consumables. */
  unitCost: number;
  /** $M per month to keep it running. */
  overhead: number;
  blurb: string;
}

export interface Tier2Def {
  id: Tier2Id;
  name: string;
  feeds: ComponentId[];
  source: string;
  blurb: string;
}

export interface Tier2State {
  id: Tier2Id;
  /** Share of normal feedstock reaching suppliers, 0.3..1.05. */
  availability: number;
  /** Market price relative to normal. */
  priceIndex: number;
  disruptionMonths: number;
}

export interface Shipment {
  id: number;
  component: ComponentId;
  supplier: string;
  qty: number;
  /** Month it reaches your stock. */
  arrive: number;
}

export interface FacilityState {
  id: FacilityId;
  status: 'none' | 'building' | 'running';
  monthsLeft: number;
  tranches: Tranche[];
  run: 'idle' | 'normal';
  lastOutput: number;
  lastLimit: ComponentId | 'capacity' | 'crew' | 'idle' | null;
}

export interface LineLast {
  output: number;
  degraded: number;
  quarantined: number;
  tested: number;
  toPartners: number;
  toReserve: number;
  staffing: number;
  limit: ComponentId | 'capacity' | 'idle' | 'crew' | 'strike' | 'tests' | 'stage' | null;
  usedSubstitutes: ComponentId[];
}

export interface LineState {
  id: LineId;
  tranches: Tranche[];
  run: RunMode;
  priority: Priority;
  wear: number;
  partial: number;
  /** Cumulative good output: drives the learning curve. */
  experience: number;
  upgrades: Record<UpgradeKind, number>;
  /** An upgrade being installed (the line runs at 85% meanwhile). */
  installing: { kind: UpgradeKind; monthsLeft: number } | null;
  /** Units held for inspection: rework or scrap. */
  quarantine: { qty: number; monthsLeft: number }[];
  substitutes: Partial<Record<ComponentId, boolean>>;
  /** Units waiting between stages (one buffer after every stage but the last). */
  wip: number[];
  /** Debottleneck level per stage (each +20% to that stage). */
  debottleneck: number[];
  debottlenecking: { stage: number; monthsLeft: number } | null;
  stages: StageLast[];
  /** Fraction of output to test & evaluation. */
  testShare: number;
  /** Latent defect risk from thin testing, 0..1. */
  latentRisk: number;
  last: LineLast;
}

export interface Trainees {
  count: number;
  monthsLeft: number;
}

export interface CampusState {
  id: CampusId;
  bays: number;
  construction: { bays: number; monthsLeft: number; total: number }[];
  /** Bays being retooled toward a line. */
  retooling: { to: LineId; monthsLeft: number }[];
  workers: number;
  trainees: Trainees[];
  pool: number;
  morale: number;
  wage: WagePolicy;
  strikeMonths: number;
  /** Security sweeps lower sabotage risk for a while. */
  securityMonths: number;
  lastCrewNeed: number;
  testCells: number;
  /** Months left on each test cell under construction. */
  testCellBuilds: number[];
  lastTestHours: { need: number; avail: number };
}

export interface SupplierState {
  id: string;
  qualified: boolean;
  qualifyingMonths: number | null;
  /** 0..100 financial health. */
  health: number;
  capFactor: number;
  shockMonths: number;
  embargoMonths: number;
  congestionMonths: number;
  bankrupt: boolean;
  lastDelivered: number;
  /** Expansion levels you paid for (+30% each). */
  capBonus: number;
  investingMonths: number | null;
}

export interface Contract {
  id: number;
  supplier: string;
  qtyPerMonth: number;
  monthsLeft: number;
  months: number;
  unitPrice: number;
  backlog: number;
}

export interface ComponentState {
  id: ComponentId;
  stock: number;
  contracts: Contract[];
  spotOrder: number;
  lastDelivered: number;
  lastUsed: number;
  lastShort: number;
  lastSubstituted: number;
  /** Market price relative to normal: spot buys and new contracts pay it. */
  priceIndex: number;
  /** Stock lost to age last month. */
  lastAged: number;
  /** Stock lost in transit last month. */
  lastLost: number;
}

export interface ReserveState {
  id: LineId;
  /** Full-performance units. */
  stock: number;
  /** Units built with substitutes. */
  degraded: number;
  made: number;
  used: number;
  unmet: number;
  /** $M of threats stopped by this type. */
  valueStopped: number;
  /** Threats engaged, by class. */
  engaged: Partial<Record<ThreatId, number>>;
}

export interface PartnerContract {
  id: number;
  partner: PartnerId;
  line: LineId;
  qtyPerMonth: number;
  monthsLeft: number;
  unitPrice: number;
  owed: number;
  delivered: number;
}

export interface Tender {
  id: number;
  partner: PartnerId;
  line: LineId;
  qtyPerMonth: number;
  months: number;
  unitPrice: number;
  expires: number;
}

export interface PartnerState {
  id: PartnerId;
  goodwill: number;
}

export interface Crisis {
  id: string;
  name: string;
  family: Family;
  phase: 'warning' | 'active';
  monthsLeft: number;
  intensity: number;
  /** Air crises: multipliers on threat arrivals. */
  mix: Partial<Record<ThreatId, number>>;
  blurb: string;
}

export interface Forecast {
  /** Expected draw per line for each of the next 3 months. */
  draw: Record<LineId, number[]>;
  /** Threat class the opponent is expected to lean on. */
  focus: ThreatId | null;
  /** 0..1: how much to trust this forecast. */
  confidence: number;
}

export interface DecisionOption {
  id: string;
  label: string;
  detail: string;
}

export interface Decision {
  id: number;
  kind: string;
  title: string;
  body: string;
  options: DecisionOption[];
  /** Option applied if the month ends unanswered. */
  fallback: string;
  /** Data the resolver needs (supplier id, campus, etc). */
  data: Record<string, string | number>;
}

export interface Doctrine {
  /** Keep PAC-3 and SM-6 off drones and rockets. */
  conserve: boolean;
}

export interface Ledger {
  wages: number;
  overhead: number;
  components: number;
  storage: number;
  projects: number;
  revenue: number;
  appropriation: number;
  penalties: number;
}

export interface ThreatTally {
  arrived: number;
  stopped: number;
  leaked: number;
}

export interface MonthReport {
  month: number;
  output: Record<LineId, number>;
  draw: Record<LineId, number>;
  readiness: number;
  confidence: number;
  treasury: number;
  ledger: Ledger;
  threats: Record<ThreatId, ThreatTally>;
  interceptorSpend: number;
  threatValueStopped: number;
  messages: { tone: 'good' | 'bad' | 'warn' | 'info'; text: string }[];
}

export interface YearReview {
  year: number;
  readiness: number;
  leakers: number;
  confidence: number;
  oldAppropriation: number;
  newAppropriation: number;
  notes: string[];
}

export interface GameState {
  version: 4;
  seed: number;
  rng: number;
  scenario: ScenarioId;
  month: number;
  months: number;
  difficulty: Difficulty;
  treasury: number;
  appropriation: number;
  confidence: number;
  lines: Record<LineId, LineState>;
  campuses: Record<CampusId, CampusState>;
  suppliers: Record<string, SupplierState>;
  components: Record<ComponentId, ComponentState>;
  reserves: Record<LineId, ReserveState>;
  facilities: Record<FacilityId, FacilityState>;
  tier2: Record<Tier2Id, Tier2State>;
  shipments: Shipment[];
  partners: Record<PartnerId, PartnerState>;
  partnerContracts: PartnerContract[];
  tenders: Tender[];
  crisis: Crisis | null;
  /** Hard: the threat class the opponent is pushing. */
  opponentFocus: ThreatId | null;
  forecast: Forecast;
  doctrine: Doctrine;
  decisions: Decision[];
  /** Messages from actions taken during the month, shown in the next report. */
  inbox: MonthReport['messages'];
  /** Costs booked by actions this month (expansions, hires, projects). */
  pending: Ledger;
  /** Temporary modifiers. */
  mods: { energyMonths: number; supplementalCooldown: number; supplementalPending: boolean };
  nextId: number;
  history: MonthReport[];
  reviews: YearReview[];
  over: boolean;
  outcome: 'running' | 'complete' | 'dismissed';
}

export type Action =
  | { type: 'setRun'; line: LineId; run: RunMode }
  | { type: 'setPriority'; line: LineId; priority: Priority }
  | { type: 'expandLine'; line: LineId }
  | { type: 'retoolBay'; from: LineId; to: LineId }
  | { type: 'buildBays'; campus: CampusId }
  | { type: 'upgradeLine'; line: LineId; kind: UpgradeKind }
  | { type: 'debottleneck'; line: LineId; stage: number }
  | { type: 'buildTestCell'; campus: CampusId }
  | { type: 'buildFacility'; facility: FacilityId }
  | { type: 'expandFacility'; facility: FacilityId }
  | { type: 'setFacilityRun'; facility: FacilityId; run: 'idle' | 'normal' }
  | { type: 'reworkQuarantine'; line: LineId }
  | { type: 'setSubstitute'; line: LineId; component: ComponentId; on: boolean }
  | { type: 'setSubstituteAll'; component: ComponentId; on: boolean }
  | { type: 'setTestShare'; line: LineId; share: number }
  | { type: 'hire'; campus: CampusId; count: number }
  | { type: 'setWage'; campus: CampusId; wage: WagePolicy }
  | { type: 'setSpotOrder'; component: ComponentId; qty: number }
  | { type: 'signContract'; component: ComponentId; supplier: string; qtyPerMonth: number; months: 12 | 24 | 36 }
  | { type: 'cancelContract'; component: ComponentId; contract: number }
  | { type: 'qualifySupplier'; supplier: string }
  | { type: 'investSupplier'; supplier: string }
  | { type: 'acceptTender'; tender: number }
  | { type: 'declineTender'; tender: number }
  | { type: 'resolveDecision'; decision: number; option: string }
  | { type: 'requestSupplemental' }
  | { type: 'setDoctrine'; conserve: boolean };
