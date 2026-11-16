export type Difficulty = 'easy' | 'normal' | 'hard';

export type ComponentId =
  | 'srm'
  | 'rfSeeker'
  | 'irSeeker'
  | 'energetics'
  | 'microelectronics'
  | 'criticalMaterials'
  | 'shellBodies';

export type LineId = 'pac3' | 'sm6' | 'tamir' | 'irist' | 'stinger' | 'gmlrs' | 'shell155';

/** Air defense interceptors or land fires: crises push demand on one family at a time. */
export type Family = 'air' | 'land';

export type RunMode = 'idle' | 'normal' | 'surge';
export type Priority = 'high' | 'normal' | 'low';

export interface ComponentDef {
  id: ComponentId;
  name: string;
  /** What one unit of this component is, e.g. "motor-eq" or "t". */
  unit: string;
  supplier: string;
  supplierNation: string;
  /** Units the supplier can deliver per month at full health. */
  baseCap: number;
  /** $M per unit at list price. Contracts are discounted, spot buys carry a premium. */
  price: number;
  blurb: string;
}

export interface LineDef {
  id: LineId;
  name: string;
  maker: string;
  plant: string;
  family: Family;
  /** Units per month at 100% maturity on the original floor. */
  baseCapacity: number;
  /** Public reference rate the game rate is scaled from, as shown to the player. */
  publicRate: string;
  /** $M per finished round (reference unit cost). */
  unitCost: number;
  /** $M per month to run the original floor at a normal pace. */
  opCost: number;
  /** $M per expansion step (+25% of base capacity). */
  expandCost: number;
  bom: Partial<Record<ComponentId, number>>;
  /** Units drawn from the reserve per month in calm times. */
  baseDraw: number;
  /** Reserve goal in months of calm draw. */
  targetMonths: number;
}

export interface Tranche {
  capacity: number;
  /** 0..1: new capacity starts near 0.3 and climbs each month. */
  maturity: number;
}

export interface LineState {
  id: LineId;
  tranches: Tranche[];
  run: RunMode;
  priority: Priority;
  /** 0..100: surge shifts wear the line; wear drives quality faults. */
  wear: number;
  /** Fractional rounds carried into next month. */
  partial: number;
  lastOutput: number;
  lastQuarantined: number;
  /** What held output back last month. */
  lastLimit: ComponentId | 'capacity' | 'idle' | null;
}

export interface Contract {
  id: number;
  qtyPerMonth: number;
  monthsLeft: number;
  /** $M per unit, already discounted. */
  unitPrice: number;
  /** Units paid for but not yet delivered. */
  backlog: number;
}

export interface ComponentState {
  id: ComponentId;
  stock: number;
  /** Multiplier on supplier capacity this month (shocks pull it down). */
  capFactor: number;
  shockMonths: number;
  contracts: Contract[];
  /** Standing spot purchase per month (premium price, filled after contracts). */
  spotOrder: number;
  lastDelivered: number;
  lastUsed: number;
  /** Units lines wanted but could not get last month. */
  lastShort: number;
}

export interface ReserveState {
  id: LineId;
  stock: number;
  made: number;
  used: number;
  unmet: number;
}

export interface Crisis {
  name: string;
  family: Family;
  /** 'warning' months come first, with no extra draw yet. */
  phase: 'warning' | 'active';
  monthsLeft: number;
  intensity: number;
}

export interface MonthReport {
  month: number;
  output: Record<LineId, number>;
  draw: Record<LineId, number>;
  readiness: number;
  treasury: number;
  spend: { components: number; operations: number; capital: number };
  messages: string[];
}

export interface GameState {
  version: 1;
  seed: number;
  rng: number;
  /** 0-based month index; month 0 is the first month to play. */
  month: number;
  months: number;
  difficulty: Difficulty;
  /** $M. */
  treasury: number;
  /** $M per month. */
  appropriation: number;
  lines: Record<LineId, LineState>;
  components: Record<ComponentId, ComponentState>;
  reserves: Record<LineId, ReserveState>;
  crisis: Crisis | null;
  /** Capital spent this month, before the turn resolves. */
  pendingCapital: number;
  nextContractId: number;
  history: MonthReport[];
  over: boolean;
}

export type Action =
  | { type: 'setRun'; line: LineId; run: RunMode }
  | { type: 'setPriority'; line: LineId; priority: Priority }
  | { type: 'expandLine'; line: LineId }
  | { type: 'setSpotOrder'; component: ComponentId; qty: number }
  | { type: 'signContract'; component: ComponentId; qtyPerMonth: number; months: 12 | 24 | 36 };
