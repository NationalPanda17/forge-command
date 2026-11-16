// Catalog of production lines and shared components.
// Designations and manufacturers are real; plants, suppliers, nations and crises are fictional.
// Game rates are roughly a fifth of the public reference rates: you run one nation's share of the industrial base.
import type { ComponentDef, ComponentId, Difficulty, Family, LineDef, LineId } from './types';

export const HOME_NATION = 'Commonwealth of Aldmere';

export const COMPONENTS: Record<ComponentId, ComponentDef> = {
  srm: {
    id: 'srm',
    name: 'Solid rocket motors',
    unit: 'motor-eq',
    supplier: 'Kestrel Propulsion',
    supplierNation: 'Aldmere',
    baseCap: 500,
    price: 0.05,
    blurb: 'Few suppliers, and nearly every missile needs one. The classic bottleneck.',
  },
  rfSeeker: {
    id: 'rfSeeker',
    name: 'RF seekers',
    unit: 'seeker-eq',
    supplier: 'Halden Microwave',
    supplierNation: 'Aldmere',
    baseCap: 210,
    price: 0.1,
    blurb: 'Radar seekers for hit-to-kill and active-radar interceptors.',
  },
  irSeeker: {
    id: 'irSeeker',
    name: 'IR seekers',
    unit: 'seeker-eq',
    supplier: 'Brightwater Optics',
    supplierNation: 'Corvane Union',
    baseCap: 65,
    price: 0.05,
    blurb: 'Imaging infrared seekers for short-range air defense.',
  },
  energetics: {
    id: 'energetics',
    name: 'Energetics',
    unit: 't',
    supplier: 'Ironmoor Energetics',
    supplierNation: 'Aldmere',
    baseCap: 330,
    price: 0.02,
    blurb: 'Explosive fill and propellant chemicals. Shells eat most of it.',
  },
  microelectronics: {
    id: 'microelectronics',
    name: 'Microelectronics',
    unit: 'board-set',
    supplier: 'Sable Circuit Works',
    supplierNation: 'Ostrel Republic',
    baseCap: 1450,
    price: 0.02,
    blurb: 'Guidance, fuzing and navigation boards.',
  },
  criticalMaterials: {
    id: 'criticalMaterials',
    name: 'Gallium & germanium',
    unit: 'lot',
    supplier: 'Karsk State Metals',
    supplierNation: 'Karsk Federation',
    baseCap: 120,
    price: 0.01,
    blurb: 'Critical materials for RF chips and IR optics, mostly from one foreign source.',
  },
  shellBodies: {
    id: 'shellBodies',
    name: 'Forged shell bodies',
    unit: 'body',
    supplier: 'Greystone Forge',
    supplierNation: 'Aldmere',
    baseCap: 27000,
    price: 0.0012,
    blurb: 'Forged and machined steel bodies for 155mm rounds.',
  },
};

export const LINES: Record<LineId, LineDef> = {
  pac3: {
    id: 'pac3',
    name: 'PAC-3 MSE',
    maker: 'Lockheed Martin',
    plant: 'Corran Valley Works',
    family: 'air',
    baseCapacity: 10,
    publicRate: '650 per year (stated 2027 goal)',
    unitCost: 4.1,
    opCost: 12,
    expandCost: 120,
    bom: { srm: 6, rfSeeker: 10, energetics: 0.07, microelectronics: 20, criticalMaterials: 5 },
    baseDraw: 8.5,
    targetMonths: 6,
  },
  sm6: {
    id: 'sm6',
    name: 'SM-6',
    maker: 'RTX',
    plant: 'Saltmarsh Missile Plant',
    family: 'air',
    baseCapacity: 4,
    publicRate: 'about 200 per year',
    unitCost: 4.3,
    opCost: 7,
    expandCost: 90,
    bom: { srm: 12, rfSeeker: 12, energetics: 0.12, microelectronics: 25, criticalMaterials: 5 },
    baseDraw: 3.3,
    targetMonths: 6,
  },
  tamir: {
    id: 'tamir',
    name: 'Tamir',
    maker: 'Rafael',
    plant: 'Easthaven Assembly',
    family: 'air',
    baseCapacity: 40,
    publicRate: 'about 2,400 per year',
    unitCost: 0.06,
    opCost: 0.4,
    expandCost: 15,
    bom: { srm: 0.3, rfSeeker: 0.2, energetics: 0.011, microelectronics: 0.5, criticalMaterials: 0.1 },
    baseDraw: 34,
    targetMonths: 6,
  },
  irist: {
    id: 'irist',
    name: 'IRIS-T',
    maker: 'Diehl Defence',
    plant: 'Northgate Integration Center',
    family: 'air',
    baseCapacity: 8,
    publicRate: 'about 500 per year',
    unitCost: 0.45,
    opCost: 1,
    expandCost: 25,
    bom: { srm: 2, irSeeker: 3, energetics: 0.011, microelectronics: 4, criticalMaterials: 1 },
    baseDraw: 6.5,
    targetMonths: 6,
  },
  stinger: {
    id: 'stinger',
    name: 'Stinger',
    maker: 'RTX',
    plant: 'Pellham Ridge',
    family: 'air',
    baseCapacity: 12,
    publicRate: '60 per month (stated goal)',
    unitCost: 0.48,
    opCost: 1.2,
    expandCost: 30,
    bom: { srm: 0.6, irSeeker: 2, energetics: 0.003, microelectronics: 3, criticalMaterials: 0.5 },
    baseDraw: 10,
    targetMonths: 6,
  },
  gmlrs: {
    id: 'gmlrs',
    name: 'GMLRS',
    maker: 'Lockheed Martin',
    plant: 'Redcliff Rocket Works',
    family: 'land',
    baseCapacity: 230,
    publicRate: '14,000 per year (stated goal)',
    unitCost: 0.16,
    opCost: 8,
    expandCost: 60,
    bom: { srm: 1, energetics: 0.09, microelectronics: 3 },
    baseDraw: 195,
    targetMonths: 6,
  },
  shell155: {
    id: 'shell155',
    name: '155mm shells',
    maker: 'General Dynamics OTS',
    plant: 'Ashford Load-Assemble-Pack Plant',
    family: 'land',
    baseCapacity: 20000,
    publicRate: '100,000 per month (stated goal)',
    unitCost: 0.0035,
    opCost: 30,
    expandCost: 80,
    bom: { shellBodies: 1, energetics: 0.011 },
    baseDraw: 17000,
    targetMonths: 6,
  },
};

export const LINE_IDS = Object.keys(LINES) as LineId[];
export const COMPONENT_IDS = Object.keys(COMPONENTS) as ComponentId[];

export const CRISES: { name: string; family: Family }[] = [
  { name: 'Halvard Strait air campaign', family: 'air' },
  { name: 'Raids on the port of Meric', family: 'air' },
  { name: 'Drone waves over the Velm Plateau', family: 'air' },
  { name: 'Eastern Marches offensive', family: 'land' },
  { name: 'Artillery duel at Karrow Gap', family: 'land' },
  { name: 'Riverline counteroffensive', family: 'land' },
];

export interface DifficultyRules {
  label: string;
  shortages: boolean;
  /** Maturity gained per month by new capacity. */
  rampPerMonth: number;
  /** Supplier capacity multiplier. */
  capMult: number;
  /** Chance per component per month of a supply shock. */
  shockChance: number;
  /** Chance per calm month that a crisis starts brewing. */
  crisisChance: number;
  appropriation: number;
  startTreasury: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyRules> = {
  easy: {
    label: 'Easy',
    shortages: false,
    rampPerMonth: 0.15,
    capMult: 1.1,
    shockChance: 0,
    crisisChance: 0.05,
    appropriation: 170,
    startTreasury: 800,
  },
  normal: {
    label: 'Normal',
    shortages: true,
    rampPerMonth: 0.08,
    capMult: 1,
    shockChance: 0.02,
    crisisChance: 0.08,
    appropriation: 150,
    startTreasury: 600,
  },
  hard: {
    label: 'Hard',
    shortages: true,
    rampPerMonth: 0.05,
    capMult: 0.92,
    shockChance: 0.035,
    crisisChance: 0.11,
    appropriation: 138,
    startTreasury: 450,
  },
};

export const NEW_TRANCHE_MATURITY = 0.3;
export const EXPAND_STEP = 0.25; // of base capacity
export const MAX_EXPANSIONS = 4;
export const SPOT_PREMIUM = 1.3;
export const CONTRACT_DISCOUNT: Record<12 | 24 | 36, number> = { 12: 0.9, 24: 0.85, 36: 0.8 };
export const RUN_FACTOR = { idle: 0, normal: 1, surge: 1.3 } as const;
export const RUN_COST = { idle: 0.25, normal: 1, surge: 1.4 } as const;
export const WEAR_DELTA = { idle: -6, normal: -3, surge: 6 } as const;
