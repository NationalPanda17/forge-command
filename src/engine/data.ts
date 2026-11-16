// Static catalog. Designations and manufacturers are real; campuses, suppliers, nations, partners and crises are
// fictional. Game rates are roughly a fifth of public reference rates: you run one nation's share of the industrial
// base. Threat costs are rough estimates from public reporting.
import type {
  CampusDef,
  CampusId,
  ComponentDef,
  ComponentId,
  Difficulty,
  LineDef,
  LineId,
  NationDef,
  NationId,
  PartnerDef,
  PartnerId,
  ScenarioId,
  SupplierDef,
  ThreatDef,
  ThreatId,
  Family,
} from './types';

export const HOME_NATION = 'Commonwealth of Aldmere';

export const NATIONS: Record<NationId, NationDef> = {
  aldmere: { id: 'aldmere', name: 'Aldmere', blurb: 'Home. Domestic suppliers never face export restrictions.' },
  corvane: { id: 'corvane', name: 'Corvane Union', blurb: 'A close trading partner across the Halvard Strait. Reliable, but its ports clog.' },
  ostrel: { id: 'ostrel', name: 'Ostrel Republic', blurb: 'An electronics hub that sells to everyone, and is caught between everyone.' },
  karsk: { id: 'karsk', name: 'Karsk Federation', blurb: 'Dominates refined gallium and germanium, and is not shy about export controls.' },
};

export const COMPONENTS: Record<ComponentId, ComponentDef> = {
  srm: {
    id: 'srm',
    name: 'Solid rocket motors',
    unit: 'motor-eq',
    price: 0.05,
    blurb: 'Few suppliers, and nearly every missile needs one. The classic bottleneck.',
    substitute: { name: 'Legacy motor stock', perf: 0.85, priceMult: 0.8, cap: 120, blurb: 'Older motor designs from depot stock: shorter reach.' },
  },
  rfSeeker: {
    id: 'rfSeeker',
    name: 'RF seekers',
    unit: 'seeker-eq',
    price: 0.1,
    blurb: 'Radar seekers for hit-to-kill and active-radar interceptors.',
    substitute: { name: 'Previous-generation seeker', perf: 0.8, priceMult: 0.75, cap: 60, blurb: 'Proven but less sensitive against small, fast targets.' },
  },
  irSeeker: {
    id: 'irSeeker',
    name: 'IR seekers',
    unit: 'seeker-eq',
    price: 0.05,
    blurb: 'Imaging infrared seekers for short-range air defense.',
    substitute: { name: 'Scanning IR seeker', perf: 0.8, priceMult: 0.7, cap: 18, blurb: 'Older non-imaging seekers, easier to decoy with flares.' },
  },
  energetics: {
    id: 'energetics',
    name: 'Energetics',
    unit: 't',
    price: 0.02,
    blurb: 'Explosive fill and propellant chemicals. Shells eat most of it.',
    substitute: { name: 'Alternate TNT-based fill', perf: 0.9, priceMult: 0.8, cap: 60, blurb: 'Plentiful, but less energetic than modern insensitive fills.' },
  },
  microelectronics: {
    id: 'microelectronics',
    name: 'Microelectronics',
    unit: 'board-set',
    price: 0.02,
    blurb: 'Guidance, fuzing and navigation boards.',
    substitute: { name: 'Commercial-grade parts', perf: 0.9, priceMult: 0.6, cap: 270, blurb: 'Off-the-shelf parts, not rated for the full temperature and shock range.' },
  },
  criticalMaterials: {
    id: 'criticalMaterials',
    name: 'Gallium & germanium',
    unit: 'lot',
    price: 0.01,
    blurb: 'Critical materials for RF chips and IR optics.',
    substitute: { name: 'Silicon-based workaround', perf: 0.85, priceMult: 0.9, cap: 45, blurb: 'Redesigned parts that avoid gallium, at a cost in power and range.' },
  },
  shellBodies: {
    id: 'shellBodies',
    name: 'Forged shell bodies',
    unit: 'body',
    price: 0.0012,
    blurb: 'Forged and machined steel bodies for 155mm rounds.',
    substitute: { name: 'Cast iron bodies', perf: 0.9, priceMult: 0.7, cap: 5000, blurb: 'Faster to make, weaker fragmentation.' },
  },
};

const sup = (s: SupplierDef) => s;
export const SUPPLIERS: Record<string, SupplierDef> = Object.fromEntries(
  [
    sup({ id: 'kestrel', component: 'srm', name: 'Kestrel Propulsion', nation: 'aldmere', baseCap: 410, priceMult: 1, startQualified: true, qualifyMonths: 0, qualifyCost: 0, blurb: 'The motor house nearly every program depends on.' }),
    sup({ id: 'vantor', component: 'srm', name: 'Vantor Motor Works', nation: 'aldmere', baseCap: 200, priceMult: 1.1, startQualified: false, qualifyMonths: 12, qualifyCost: 60, blurb: 'A new entrant with a modern casting line and no flight history.' }),
    sup({ id: 'northwind', component: 'srm', name: 'Northwind Aerojet', nation: 'corvane', baseCap: 150, priceMult: 0.95, startQualified: false, qualifyMonths: 9, qualifyCost: 40, blurb: 'Established motor maker across the strait.' }),
    sup({ id: 'halden', component: 'rfSeeker', name: 'Halden Microwave', nation: 'aldmere', baseCap: 172, priceMult: 1, startQualified: true, qualifyMonths: 0, qualifyCost: 0, blurb: 'Sole qualified source of radar seekers.' }),
    sup({ id: 'lyre', component: 'rfSeeker', name: 'Lyre Sensors', nation: 'ostrel', baseCap: 90, priceMult: 1.05, startQualified: false, qualifyMonths: 10, qualifyCost: 35, blurb: 'Capable seekers, from a country under pressure from all sides.' }),
    sup({ id: 'brightwater', component: 'irSeeker', name: 'Brightwater Optics', nation: 'corvane', baseCap: 53, priceMult: 1, startQualified: true, qualifyMonths: 0, qualifyCost: 0, blurb: 'Imaging IR seekers, shipped across the strait.' }),
    sup({ id: 'pellucid', component: 'irSeeker', name: 'Pellucid Imaging', nation: 'aldmere', baseCap: 35, priceMult: 1.2, startQualified: false, qualifyMonths: 10, qualifyCost: 25, blurb: 'A domestic optics start-up hungry for a production order.' }),
    sup({ id: 'ironmoor', component: 'energetics', name: 'Ironmoor Energetics', nation: 'aldmere', baseCap: 265, priceMult: 1, startQualified: true, qualifyMonths: 0, qualifyCost: 0, blurb: 'One sprawling chemical site makes most of the nation’s explosives.' }),
    sup({ id: 'saltash', component: 'energetics', name: 'Saltash Chemical', nation: 'aldmere', baseCap: 150, priceMult: 1.1, startQualified: false, qualifyMonths: 8, qualifyCost: 30, blurb: 'A mothballed nitration plant that could be restarted.' }),
    sup({ id: 'meridian', component: 'energetics', name: 'Meridian Chemie', nation: 'corvane', baseCap: 120, priceMult: 1, startQualified: false, qualifyMonths: 6, qualifyCost: 15, blurb: 'Large commercial chemical group with a defense arm.' }),
    sup({ id: 'sable', component: 'microelectronics', name: 'Sable Circuit Works', nation: 'ostrel', baseCap: 1185, priceMult: 1, startQualified: true, qualifyMonths: 0, qualifyCost: 0, blurb: 'High volume, low price, one ocean away.' }),
    sup({ id: 'trusted', component: 'microelectronics', name: 'Aldmere Trusted Foundry', nation: 'aldmere', baseCap: 600, priceMult: 1.25, startQualified: false, qualifyMonths: 12, qualifyCost: 50, blurb: 'Secure domestic fab. Expensive, but nobody can embargo it.' }),
    sup({ id: 'karskmetals', component: 'criticalMaterials', name: 'Karsk State Metals', nation: 'karsk', baseCap: 97, priceMult: 1, startQualified: true, qualifyMonths: 0, qualifyCost: 0, blurb: 'The cheapest refined gallium and germanium anywhere.' }),
    sup({ id: 'greenhollow', component: 'criticalMaterials', name: 'Greenhollow Recovery', nation: 'aldmere', baseCap: 30, priceMult: 1.4, startQualified: false, qualifyMonths: 8, qualifyCost: 20, blurb: 'Recycles gallium from scrap electronics. Small and pricey.' }),
    sup({ id: 'corvaneminerals', component: 'criticalMaterials', name: 'Corvane Minerals', nation: 'corvane', baseCap: 60, priceMult: 1.15, startQualified: false, qualifyMonths: 10, qualifyCost: 25, blurb: 'A new refinery fed by zinc smelter by-products.' }),
    sup({ id: 'greystone', component: 'shellBodies', name: 'Greystone Forge', nation: 'aldmere', baseCap: 22000, priceMult: 1, startQualified: true, qualifyMonths: 0, qualifyCost: 0, blurb: 'Forges and machines nearly every shell body in the country.' }),
    sup({ id: 'harlow', component: 'shellBodies', name: 'Harlow Steel', nation: 'aldmere', baseCap: 12000, priceMult: 1.1, startQualified: false, qualifyMonths: 6, qualifyCost: 20, blurb: 'A rail-wheel forge that could switch to shell bodies.' }),
  ].map((s) => [s.id, s]),
);
export const SUPPLIER_IDS = Object.keys(SUPPLIERS);
export const suppliersOf = (c: ComponentId) => SUPPLIER_IDS.filter((id) => SUPPLIERS[id].component === c);

export const CAMPUSES: Record<CampusId, CampusDef> = {
  corran: { id: 'corran', name: 'Corran Valley Works', region: 'Corran Valley', spareBays: 2, buildCost: 260, buildBays: 4, laborPool: 120, blurb: 'Clean rooms and integration halls for the big hit-to-kill interceptors.' },
  northgate: { id: 'northgate', name: 'Northgate Integration Center', region: 'Northgate', spareBays: 2, buildCost: 140, buildBays: 4, laborPool: 90, blurb: 'Short-range air defense: three lines under one long roof.' },
  ashford: { id: 'ashford', name: 'Ashford Munitions Complex', region: 'Ashford', spareBays: 2, buildCost: 200, buildBays: 4, laborPool: 160, blurb: 'Rocket motors meet load-assemble-pack: rockets and shells by the thousand.' },
};

export const LINES: Record<LineId, LineDef> = {
  pac3: {
    id: 'pac3', name: 'PAC-3 MSE', maker: 'Lockheed Martin', campus: 'corran', family: 'air', role: 'Hit-to-kill against ballistic and cruise missiles',
    baseCapacity: 10, publicRate: '650 per year (stated 2027 goal)', unitCost: 4.1, overhead: 6, baseCrew: 600, expandCost: 120,
    bom: { srm: 6, rfSeeker: 10, energetics: 0.07, microelectronics: 20, criticalMaterials: 5 },
    blurb: 'The workhorse against ballistic missiles. Every round is precious.',
  },
  sm6: {
    id: 'sm6', name: 'SM-6', maker: 'RTX', campus: 'corran', family: 'air', role: 'Long-range, against aircraft, cruise and ballistic missiles',
    baseCapacity: 4, publicRate: 'about 200 per year', unitCost: 4.3, overhead: 3.5, baseCrew: 400, expandCost: 90,
    bom: { srm: 12, rfSeeker: 12, energetics: 0.12, microelectronics: 25, criticalMaterials: 5 },
    blurb: 'Reaches far and does almost everything. Built slowly.',
  },
  tamir: {
    id: 'tamir', name: 'Tamir', maker: 'Rafael', campus: 'northgate', family: 'air', role: 'Short-range, against rockets and drones',
    baseCapacity: 40, publicRate: 'about 2,400 per year', unitCost: 0.06, overhead: 0.2, baseCrew: 250, expandCost: 15,
    bom: { srm: 0.3, rfSeeker: 0.2, energetics: 0.011, microelectronics: 0.5, criticalMaterials: 0.1 },
    blurb: 'Cheap and plentiful: the answer to rockets, if you build enough.',
  },
  irist: {
    id: 'irist', name: 'IRIS-T', maker: 'Diehl Defence', campus: 'northgate', family: 'air', role: 'Medium-range, against cruise missiles, drones and aircraft',
    baseCapacity: 8, publicRate: 'about 500 per year', unitCost: 0.45, overhead: 0.5, baseCrew: 300, expandCost: 25,
    bom: { srm: 2, irSeeker: 3, energetics: 0.011, microelectronics: 4, criticalMaterials: 1 },
    blurb: 'The best value against cruise missiles. Needs IR seekers from abroad.',
  },
  stinger: {
    id: 'stinger', name: 'Stinger', maker: 'RTX', campus: 'northgate', family: 'air', role: 'Very short range, against drones and helicopters',
    baseCapacity: 12, publicRate: '60 per month (stated goal)', unitCost: 0.48, overhead: 0.6, baseCrew: 300, expandCost: 30,
    bom: { srm: 0.6, irSeeker: 2, energetics: 0.003, microelectronics: 3, criticalMaterials: 0.5 },
    blurb: 'Shoulder-fired. First line against drones.',
  },
  gmlrs: {
    id: 'gmlrs', name: 'GMLRS', maker: 'Lockheed Martin', campus: 'ashford', family: 'land', role: 'Guided rocket artillery',
    baseCapacity: 230, publicRate: '14,000 per year (stated goal)', unitCost: 0.16, overhead: 4, baseCrew: 500, expandCost: 60,
    bom: { srm: 1, energetics: 0.09, microelectronics: 3 }, landDraw: 190,
    blurb: 'Precise long-range fires. Eats rocket motors by the hundred.',
  },
  shell155: {
    id: 'shell155', name: '155mm shells', maker: 'General Dynamics OTS', campus: 'ashford', family: 'land', role: 'Tube artillery',
    baseCapacity: 20000, publicRate: '100,000 per month (stated goal)', unitCost: 0.0035, overhead: 15, baseCrew: 900, expandCost: 80,
    bom: { shellBodies: 1, energetics: 0.011 }, landDraw: 16500,
    blurb: 'The ammunition of attrition. Volume is everything.',
  },
};

export const LINE_IDS = Object.keys(LINES) as LineId[];
export const COMPONENT_IDS = Object.keys(COMPONENTS) as ComponentId[];
export const CAMPUS_IDS = Object.keys(CAMPUSES) as CampusId[];
export const AIR_LINES = LINE_IDS.filter((id) => LINES[id].family === 'air');
export const LAND_LINES = LINE_IDS.filter((id) => LINES[id].family === 'land');
export const linesAt = (c: CampusId) => LINE_IDS.filter((id) => LINES[id].campus === c);

export const THREATS: Record<ThreatId, ThreatDef> = {
  drone: {
    id: 'drone', name: 'One-way attack drone', estCost: 0.035, shots: 1.2, severity: 0.15, calm: 14,
    assign: [
      { line: 'stinger', weight: 0.55, pk: 0.75 },
      { line: 'tamir', weight: 0.35, pk: 0.85 },
      { line: 'irist', weight: 0.1, pk: 0.9 },
      { line: 'sm6', weight: 0, pk: 0.9 },
      { line: 'pac3', weight: 0, pk: 0.85 },
    ],
    blurb: 'Slow and cheap: costs tens of thousands. Shooting it with a $4M missile is a losing trade.',
  },
  rocket: {
    id: 'rocket', name: 'Short-range rocket', estCost: 0.008, shots: 1, severity: 0.05, calm: 26,
    assign: [
      { line: 'tamir', weight: 1, pk: 0.9 },
      { line: 'irist', weight: 0, pk: 0.7 },
      { line: 'pac3', weight: 0, pk: 0.8 },
    ],
    blurb: 'Unguided and very cheap. Only threats to defended areas are engaged.',
  },
  cruise: {
    id: 'cruise', name: 'Cruise missile', estCost: 1.5, shots: 1.5, severity: 1, calm: 5,
    assign: [
      { line: 'irist', weight: 0.5, pk: 0.85 },
      { line: 'sm6', weight: 0.25, pk: 0.9 },
      { line: 'pac3', weight: 0.25, pk: 0.85 },
      { line: 'tamir', weight: 0, pk: 0.6 },
    ],
    blurb: 'Low and terrain-hugging. Worth about $1.5M.',
  },
  ballistic: {
    id: 'ballistic', name: 'Short-range ballistic missile', estCost: 3, shots: 2, severity: 2, calm: 3,
    assign: [
      { line: 'pac3', weight: 0.85, pk: 0.9 },
      { line: 'sm6', weight: 0.15, pk: 0.8 },
    ],
    blurb: 'Fast and falling steeply. Only hit-to-kill interceptors reliably stop it.',
  },
  aircraft: {
    id: 'aircraft', name: 'Combat aircraft', estCost: 30, shots: 1.5, severity: 1.5, calm: 1,
    assign: [
      { line: 'irist', weight: 0.4, pk: 0.75 },
      { line: 'sm6', weight: 0.3, pk: 0.9 },
      { line: 'pac3', weight: 0.3, pk: 0.85 },
      { line: 'stinger', weight: 0, pk: 0.4 },
    ],
    blurb: 'Rare, expensive and dangerous. Stopping one pays for a lot of missiles.',
  },
};
export const THREAT_IDS = Object.keys(THREATS) as ThreatId[];
/** Expensive interceptors that conserve doctrine keeps off cheap threats. */
export const PREMIUM_LINES: LineId[] = ['pac3', 'sm6'];
export const CHEAP_THREATS: ThreatId[] = ['drone', 'rocket'];

export const PARTNERS: Record<PartnerId, PartnerDef> = {
  varenna: { id: 'varenna', name: 'Republic of Varenna', blurb: 'A coastal republic with a long, exposed shoreline.', wants: ['pac3', 'sm6', 'irist'] },
  osterholm: { id: 'osterholm', name: 'Kingdom of Osterholm', blurb: 'A northern kingdom rebuilding its air defenses.', wants: ['irist', 'stinger', 'gmlrs'] },
  sundar: { id: 'sundar', name: 'Sundaric League', blurb: 'An island federation under constant rocket harassment.', wants: ['tamir', 'stinger', 'shell155'] },
  calder: { id: 'calder', name: 'Free State of Calder', blurb: 'A landlocked ally with a long land border to hold.', wants: ['gmlrs', 'shell155', 'tamir'] },
};
export const PARTNER_IDS = Object.keys(PARTNERS) as PartnerId[];

export interface CrisisDef {
  id: string;
  name: string;
  family: Family;
  mix: Partial<Record<ThreatId, number>>;
  blurb: string;
}

export const CRISES: CrisisDef[] = [
  { id: 'halvard', name: 'Halvard Strait air campaign', family: 'air', mix: { cruise: 3, ballistic: 2, aircraft: 3, drone: 1.5 }, blurb: 'Waves of aircraft and cruise missiles across the strait.' },
  { id: 'meric', name: 'Raids on the port of Meric', family: 'air', mix: { rocket: 3, drone: 2, ballistic: 1.5 }, blurb: 'Rockets and drones against the busiest port in the north.' },
  { id: 'velm', name: 'Drone waves over the Velm Plateau', family: 'air', mix: { drone: 4, cruise: 1.5 }, blurb: 'Night after night of cheap drones, with the odd cruise missile hidden among them.' },
  { id: 'skerry', name: 'Missile salvos on the Skerry Isles', family: 'air', mix: { ballistic: 3, cruise: 2 }, blurb: 'Ballistic salvos against island air bases.' },
  { id: 'marches', name: 'Eastern Marches offensive', family: 'land', mix: {}, blurb: 'A grinding offensive along the eastern border.' },
  { id: 'karrow', name: 'Artillery duel at Karrow Gap', family: 'land', mix: {}, blurb: 'Both sides dig in and trade shells.' },
  { id: 'riverline', name: 'Riverline counteroffensive', family: 'land', mix: {}, blurb: 'A river crossing that needs every rocket and shell.' },
];

export type AdvisorLevel = 'full' | 'hints' | 'none';

export interface DifficultyRules {
  label: string;
  blurb: string;
  shortages: boolean;
  rampPerMonth: number;
  capMult: number;
  shockChance: number;
  /** Multiplier on random event chances. */
  eventRate: number;
  crisisChance: number;
  appropriation: number;
  startTreasury: number;
  trainingMonths: number;
  buildMonths: number;
  qualifyMult: number;
  advisor: AdvisorLevel;
  adaptive: boolean;
  /** Chance per month that intel misreads the opponent's focus. */
  intelError: number;
  sabotage: boolean;
}

export const DIFFICULTY: Record<Difficulty, DifficultyRules> = {
  easy: {
    label: 'Easy', blurb: 'No component shortages, fast ramp-up, rare events, and an advisor that suggests orders.',
    shortages: false, rampPerMonth: 0.15, capMult: 1.15, shockChance: 0, eventRate: 0.5, crisisChance: 0.05,
    appropriation: 165, startTreasury: 800, trainingMonths: 2, buildMonths: 6, qualifyMult: 0.6,
    advisor: 'full', adaptive: false, intelError: 0, sabotage: false,
  },
  normal: {
    label: 'Normal', blurb: 'Shortages on, normal ramp-up and events, hints only.',
    shortages: true, rampPerMonth: 0.08, capMult: 1, shockChance: 0.02, eventRate: 1, crisisChance: 0.08,
    appropriation: 150, startTreasury: 600, trainingMonths: 4, buildMonths: 9, qualifyMult: 1,
    advisor: 'hints', adaptive: false, intelError: 0.1, sabotage: false,
  },
  hard: {
    label: 'Hard', blurb: 'Tighter supply, slow ramp-up, frequent events and sabotage, no advisor, and an adaptive opponent with unreliable intel.',
    shortages: true, rampPerMonth: 0.05, capMult: 0.92, shockChance: 0.035, eventRate: 1.5, crisisChance: 0.11,
    appropriation: 140, startTreasury: 450, trainingMonths: 6, buildMonths: 12, qualifyMult: 1.25,
    advisor: 'none', adaptive: true, intelError: 0.3, sabotage: true,
  },
};

export interface ScenarioDef {
  id: ScenarioId;
  name: string;
  blurb: string;
  /** Multiplier on calm threat arrivals and land draw. */
  pressure: number;
  /** Months of calm draw in the reserve at the start. */
  reserveMonths: number;
  budgetMult: number;
  treasuryMult: number;
  /** Crisis active from the start. */
  openingCrisis?: string;
  /** Supplier troubles at the start. */
  embargo?: { supplier: string; months: number };
  shock?: { supplier: string; factor: number; months: number };
  /** No crises before this month. */
  quietMonths: number;
}

export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  standard: { id: 'standard', name: 'Standing Watch', blurb: 'A calm start. Build up before the storms come.', pressure: 1, reserveMonths: 3, budgetMult: 1, treasuryMult: 1, quietMonths: 3 },
  longWar: { id: 'longWar', name: 'The Long War', blurb: 'An air campaign is already under way, and the pressure never really lets up.', pressure: 1.15, reserveMonths: 4, budgetMult: 1.25, treasuryMult: 1, openingCrisis: 'halvard', quietMonths: 0 },
  brokenChain: { id: 'brokenChain', name: 'Broken Chain', blurb: 'The Karsk Federation halts gallium and germanium exports, and Sable Circuit Works is struggling. Find new sources fast.', pressure: 1, reserveMonths: 3, budgetMult: 1.05, treasuryMult: 1.2, embargo: { supplier: 'karskmetals', months: 10 }, shock: { supplier: 'sable', factor: 0.55, months: 6 }, quietMonths: 4 },
  rebuild: { id: 'rebuild', name: 'Empty Racks', blurb: 'Years of neglect left the reserve nearly empty. The money is finally there: spend it well.', pressure: 1, reserveMonths: 1, budgetMult: 1.2, treasuryMult: 1.6, quietMonths: 8 },
};

export const BASE_BAYS_PER_LINE = 4;
export const NEW_TRANCHE_MATURITY = 0.3;
export const EXPAND_STEP = 0.25;
export const RETOOL_MONTHS = 2;
export const RETOOL_COST_SHARE = 0.4;
export const SPOT_PREMIUM = 1.3;
export const CONTRACT_DISCOUNT: Record<12 | 24 | 36, number> = { 12: 0.9, 24: 0.85, 36: 0.8 };
export const CANCEL_PENALTY = 0.3;
export const RUN_FACTOR = { idle: 0, normal: 1, surge: 1.3 } as const;
export const RUN_CREW = { idle: 0.15, normal: 1, surge: 1.15 } as const;
export const RUN_OVERHEAD = { idle: 0.3, normal: 1, surge: 1.35 } as const;
export const WEAR_DELTA = { idle: -6, normal: -2, surge: 6 } as const;
/** $M per worker-month, loaded. */
export const WAGE = 0.0095;
export const PREMIUM_WAGE = 1.15;
export const HIRE_COST = 0.015;
export const STORAGE_RATE = 0.005;
export const UPGRADE: Record<'automation' | 'quality', { name: string; costShare: number; months: number; blurb: string }> = {
  automation: { name: 'Automation', costShare: 0.8, months: 3, blurb: 'Robotic cells and automated test: each level cuts crew needs by 15%.' },
  quality: { name: 'Quality systems', costShare: 0.5, months: 2, blurb: 'In-line inspection and statistical process control: fewer faults, slower wear.' },
};
export const MAX_UPGRADE = 2;
export const REWORK_COST_SHARE = 0.15;
export const MIN_SAFE_TEST_SHARE = 0.03;
/** Months at the start with no supply shocks or random events. */
export const GRACE_MONTHS = 3;
/** Months of baseline need held in stock at the start (critical materials are a strategic stockpile). */
export const START_STOCK_MONTHS: Partial<Record<ComponentId, number>> = { criticalMaterials: 4 };
