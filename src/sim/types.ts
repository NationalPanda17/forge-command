import type { LineId, MaterialId, RegionId, SiteKind } from './world';
import type { VariantId } from './industry';
import type { StoryState } from './story';
import type { TownState } from './towns';
import type { TestProgramme } from './testing';
import type { HotseatState } from './hotseat';
import type { Decision, FactionId, Person, ResearchId, StaffRole } from './strategy';
import type { RivalState } from './rival';
import type { PolicyId, Programme } from './commitments';
import type { DiplomacyState } from './diplomacy';
import type { CommitteePromise, HearingState } from './hearings';
import type { CyberState } from './cyber';
import type { UnionState } from './unions';
import type { CustomScenario } from './custom';
import type { EnergyState } from './energy';
import type { OversightState, WasteKind } from './audit';
import type { CommunityState } from './communities';
import type { AutomationState } from './automation';
import type { EngineerState } from './engineers';
import type { IntelState } from './intelops';
import type { DoctrineState } from './doctrine';
import type { CastState } from './cast';
import type { Moment } from './legacy';

export type Difficulty = 'easy' | 'normal' | 'hard';
export type ScenarioId = 'standard' | 'warFooting' | 'sanctions' | 'rebuild' | 'tutorial' | 'custom';
export type AllyId = 'merrow' | 'calder';
/** idle, one shift, two shifts (normal), or round the clock (surge). */
export type RunLevel = 'idle' | 'single' | 'normal' | 'surge';
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
  /** Automated: less crew, less scrap. */
  automated?: boolean;
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
  trainees: { count: number; days: number; apprentice?: boolean }[];
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
  /** Your sites: crew experience, 0..100. */
  skill: number;
  /** Your sites: 0..100. Low morale slows work and invites disputes. */
  morale: number;
  /** Your sites: builds up on round-the-clock shifts, 0..100. */
  fatigue: number;
  /** Your sites: safety programme level, 0..3. */
  safety: number;
  /** Your sites: apprentices taken on each month. */
  apprentices: number;
  /** Founded plants: what kind of plant now stands on the plot, and its name. */
  plantKind?: SiteKind;
  plantName?: string;
  /** Security vetting level, 0..3. */
  clearance?: number;
  /** Laid off and idle until reopened. */
  mothballed?: boolean;
}

/** Something the player is building. */
export interface Project {
  id: number;
  kind: 'link' | 'upgrade' | 'icebreaker' | 'harden' | 'automate';
  /** Candidate link id, route key, site id, or 'meric' for the icebreaker. */
  target: string;
  process?: number;
  days: number;
  total: number;
  cost: number;
}

/** Sandbox rules. The standard game has them all on, at normal strength. */
export interface Settings {
  inflation: boolean;
  seasons: boolean;
  crises: boolean;
  /** Multiplies how often disruptions and world events happen: 0, 0.5, 1 or 2. */
  events: number;
  /** No end date. */
  endless: boolean;
  /** The Committee can dismiss you. */
  dismissal: boolean;
}

export interface Headline {
  title: string;
  body: string;
  tone: 'good' | 'bad' | 'warn' | 'info';
}
export interface NewsEdition {
  month: number;
  headlines: Headline[];
  /** A special edition's title. */
  special?: string;
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
  /** The supplier is quietly overbilling. */
  fraud?: boolean;
  /** Overbilled so far, $M. */
  overbilled?: number;
  /** Already found and waiting on your decision. */
  flagged?: boolean;
  /** Found, and you let it go. */
  ignored?: boolean;
}

export interface FeedItem {
  day: number;
  tone: 'good' | 'bad' | 'warn' | 'info';
  text: string;
  site?: string;
  /** Important enough to stop the clock. */
  alert?: boolean;
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
  spend: { purchases: number; operations: number; transport: number; projects: number; demil: number; energy?: number };
  income: { appropriation: number; sales: number };
  interceptorSpend: number;
  threatValueStopped: number;
  readiness: number;
  confidence: number;
  treasury: number;
  retired: number;
  demilled: number;
  /** National serviceable stock of each line at month end. */
  stock?: Partial<Record<LineId, number>>;
  /** The Committee's reserve target for each line at month end. */
  target?: Partial<Record<LineId, number>>;
  priceIndex?: number;
  exported?: number;
  /** Where this month's change in confidence came from. */
  why?: { readiness: number; leaks: number; land: number; debt: number; other: number; mandate?: number };
  /** Espionage incidents that got through. */
  incidents?: number;
  /** Cyber attacks that got through. */
  cyber?: number;
  /** Strikes at your plants, sympathy strikes included. */
  strikes?: number;
  /** Protests at your plants' gates. */
  protests?: number;
  /** A budget request granted at this month's hearing. */
  won?: boolean;
  /** Money the Auditor-General would call waste, by kind. */
  waste?: Partial<Record<WasteKind, number>>;
  /** Region-days of blackout. */
  blackoutDays?: number;
  /** Value of what each of your plants made, $M. */
  plantOutput?: Record<string, number>;
  /** Running totals of the month's fighting: how badly threats got through, and land shortfall (day fractions). */
  fightLeak?: number;
  fightLand?: number;
  /** Decisions taken this month and what they did to confidence and the treasury. */
  decisions?: { title: string; option: string; confidence: number; treasury: number }[];
  /** Purchases from foreign suppliers, $M (already counted in spend.purchases). For the mandate's independence goal. */
  foreign?: number;
  /** How evenly work is spread across the regions at month end, 0–1 (the mandate's jobs goal). */
  jobsBalance?: number;
  /** Mean mood of the towns with your plants at month end. */
  townMood?: number;
  /** Months of appropriation the treasury held at month end. */
  cover?: number;
}

/** One finished term as Director. */
export interface CareerTerm {
  term: number;
  score: number;
  grade: string;
  outcome: 'complete' | 'dismissed' | 'running';
  months: number;
  avgReadiness: number;
}

/** One supplier's offer in a tender. */
export interface Bid {
  site: string;
  perDay: number;
  /** $M per unit. */
  price: number;
  /** 0..1: how likely they are to deliver in full. */
  reliability: number;
  note: string;
}

export interface Tender {
  id: number;
  material: MaterialId;
  perDay: number;
  months: 12 | 24 | 36;
  opened: number;
  /** Bids lapse on this day. */
  expires: number;
  bids: Bid[];
}

/** An order from a foreign customer, delivered from the central depot. */
export interface ExportOrder {
  id: number;
  customer: string;
  line: LineId;
  qty: number;
  delivered: number;
  /** $M per round. */
  price: number;
  start: number;
  endDay: number;
}

/** A multi-stage event waiting for its next stage. */
export interface Chain {
  id: number;
  kind: 'labour' | 'quality' | 'safety';
  site: string;
  stage: number;
  /** Day the next stage happens. */
  due: number;
  material?: MaterialId;
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
  /**
   * The save's schema number (18.0). A save older than SAVE_SCHEMA is brought up to date one numbered step at a time
   * by migrate() in setup.ts; saves from before 18.0 have none and count as schema 1.
   */
  schema?: number;
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
  /** accepted: false until a new round passes its test firings. */
  lines: Record<LineId, { unlocked: boolean; since?: number; accepted?: boolean }>;
  feed: FeedItem[];
  /** Running totals for the month in progress. */
  month: MonthReport;
  history: MonthReport[];
  nextId: number;
  over: boolean;
  outcome: 'running' | 'complete' | 'dismissed';
  /** Set when something important happens; the clock pauses if the player wants it to. */
  alert: FeedItem | null;
  /** Every important event in the last update, for the pause rules. */
  alerts?: FeedItem[];
  /** 1.0 at the start; prices, wages and running costs rise with it. */
  priceIndex: number;
  tenders: Tender[];
  exports: ExportOrder[];
  /** Relations with allied governments, 0..100. */
  allies: Record<AllyId, number>;
  chains: Chain[];
  /** Tutorial progress, when playing the tutorial. */
  tutorial: { step: number } | null;
  /** Crises that already asked for supplementary money. */
  supplemented: string[];
  network: { built: string[]; upgrades: Record<string, number>; projects: Project[]; icebreaker: boolean; hardened: string[] };
  settings: Settings;
  /** The Courier: one edition a month, newest last. */
  news: NewsEdition[];
  /** A scored campaign, or a sandbox where you set the rules as you go. */
  mode: 'campaign' | 'sandbox';
  /** The rival and the weapons it fields over time. */
  rival: RivalState;
  /** Multi-year procurement programmes in force. */
  programmes: Programme[];
  /** Standing policies adopted. */
  policies: PolicyId[];
  /** Which term as Director this is. */
  term: number;
  /** In-house lines being fitted out at your arsenals. */
  inhouse: { site: string; recipe: string; days: number }[];
  /** The design chosen for each round. */
  variants: Partial<Record<LineId, VariantId>>;
  /** A variant being designed. */
  design: { line: LineId; variant: VariantId; days: number } | null;
  /** The story campaign, when playing it. */
  story: StoryState | null;
  /** The generated world's seed, or null for the classic Commonwealth of Aldmere. */
  world: number | null;
  /** Workforce towns, in the same order as the city list. */
  towns: TownState[];
  /** Test programmes at the ranges: running first, then queued. */
  tests: TestProgramme[];
  /** Two players sharing the country, when playing hot-seat. */
  hotseat: HotseatState | null;
  /** Relations with supplier nations, guarantees and co-production deals. */
  diplomacy: DiplomacyState;
  /** The fiscal year's budget hearing, while it sits. */
  hearing: HearingState | null;
  /** Promises made to the Committee and not yet judged. */
  promises: CommitteePromise[];
  promisesKept?: number;
  cyber: CyberState;
  unions: UnionState;
  /** Recycling chosen by you rather than forced by a court (false while a court ban forces it). */
  recycleChosen?: boolean;
  /** The term length chosen at the start, for a sandbox that stops being endless. */
  plannedDays?: number;
  /** The month (history index) this term began. */
  termMonth?: number;
  /** Earlier terms as Director in this game. */
  career: CareerTerm[];
  /** A custom scenario's settings, when playing one. */
  custom: CustomScenario | null;
  /** Regional grids, power contracts and generators. */
  energy: EnergyState;
  /** The Auditor-General and your internal audit team. */
  oversight: OversightState;
  /** Towns' moods toward you, permits on hold and the burning ban. */
  communities: CommunityState;
  /** The areas handed to your chief of staff, the reserve, the stance and what was done. */
  automation: AutomationState;
  /** Your engineers, the national market and the academies. */
  engineers: EngineerState;
  /** Your intelligence service and its operations against the rival. */
  intel: IntelState;
  /** First-time tips already shown in this game. */
  tipsSeen?: string[];
  /** The doctrines you have chosen, and the one bedding in. */
  doctrine: DoctrineState;
  /** Your plant managers, the union leaders, and the candidates you could appoint. */
  cast: CastState;
  /** The important things that happened, for the term report. */
  moments?: Moment[];
  /** The day the current term began (after a second term starts), so each term counts only its own moments. */
  termStartDay?: number;
  fraudsCaught?: number;
  strategy: {
    research: { done: ResearchId[]; active: { id: ResearchId; days: number; total?: number } | null };
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
