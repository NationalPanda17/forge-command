// The fight, abstracted: fictional threats arrive in each region every day and the bases there fire at them.
import type { LineId, RegionId, SiteKind } from './world';
import type { ThreatId } from './types';

export interface ThreatDef {
  id: ThreatId;
  name: string;
  /** $M, a rough public estimate. */
  estCost: number;
  shots: number;
  /** Confidence lost per leaker. */
  severity: number;
  /** Calm-time arrivals per month, nationally. */
  calmMonthly: number;
  assign: { line: LineId; weight: number; pk: number }[];
}

export const THREATS: Record<ThreatId, ThreatDef> = {
  drone: {
    id: 'drone', name: 'One-way attack drone', estCost: 0.035, shots: 1.2, severity: 0.15, calmMonthly: 14,
    assign: [
      { line: 'apkws', weight: 0.5, pk: 0.8 },
      { line: 'coyote', weight: 0.2, pk: 0.9 },
      { line: 'stinger', weight: 0.55, pk: 0.75 },
      { line: 'tamir', weight: 0.35, pk: 0.85 },
      { line: 'irist', weight: 0.1, pk: 0.9 },
      { line: 'sm6', weight: 0, pk: 0.9 },
      { line: 'pac3', weight: 0, pk: 0.85 },
    ],
  },
  rocket: {
    id: 'rocket', name: 'Short-range rocket', estCost: 0.008, shots: 1, severity: 0.05, calmMonthly: 26,
    assign: [
      { line: 'tamir', weight: 1, pk: 0.9 },
      { line: 'irist', weight: 0, pk: 0.7 },
      { line: 'pac3', weight: 0, pk: 0.8 },
    ],
  },
  cruise: {
    id: 'cruise', name: 'Cruise missile', estCost: 1.5, shots: 1.5, severity: 1, calmMonthly: 5,
    assign: [
      { line: 'irist', weight: 0.5, pk: 0.85 },
      { line: 'coyote', weight: 0.15, pk: 0.7 },
      { line: 'sm6', weight: 0.25, pk: 0.9 },
      { line: 'pac3', weight: 0.25, pk: 0.85 },
      { line: 'tamir', weight: 0, pk: 0.6 },
    ],
  },
  ballistic: {
    id: 'ballistic', name: 'Short-range ballistic missile', estCost: 3, shots: 2, severity: 2, calmMonthly: 3,
    assign: [
      { line: 'pac3', weight: 0.85, pk: 0.9 },
      { line: 'sm6', weight: 0.15, pk: 0.8 },
    ],
  },
  aircraft: {
    id: 'aircraft', name: 'Combat aircraft', estCost: 30, shots: 1.5, severity: 1.5, calmMonthly: 1,
    assign: [
      { line: 'irist', weight: 0.4, pk: 0.75 },
      { line: 'sm6', weight: 0.3, pk: 0.9 },
      { line: 'pac3', weight: 0.3, pk: 0.85 },
      { line: 'stinger', weight: 0, pk: 0.4 },
    ],
  },
};
export const THREAT_IDS = Object.keys(THREATS) as ThreatId[];
export const PREMIUM: LineId[] = ['pac3', 'sm6'];
export const CHEAP: ThreatId[] = ['drone', 'rocket'];

/** Land fires: rounds per month in calm times. */
export const LAND_DRAW: Partial<Record<LineId, number>> = { gmlrs: 190, shell155: 16500, javelin: 40 };
export const LAND_LINES: LineId[] = ['gmlrs', 'shell155', 'javelin'];
export const AIR_LINES: LineId[] = ['pac3', 'sm6', 'tamir', 'irist', 'stinger', 'apkws', 'coyote'];

/** What each kind of base can fire. */
export const BASE_LINES: Partial<Record<SiteKind, LineId[]>> = {
  adBase: ['pac3', 'sm6', 'tamir', 'irist', 'stinger', 'apkws', 'coyote'],
  airBase: ['sm6', 'irist', 'stinger', 'apkws', 'coyote', 'tamir'],
  artillery: ['gmlrs', 'shell155', 'javelin'],
};

export interface CrisisDef {
  id: string;
  name: string;
  family: 'air' | 'land';
  region: RegionId;
  mix: Partial<Record<ThreatId, number>>;
}

export const CRISES: CrisisDef[] = [
  { id: 'halvard', name: 'Halvard Strait air campaign', family: 'air', region: 'coast', mix: { cruise: 3, ballistic: 2, aircraft: 3, drone: 1.5 } },
  { id: 'meric', name: 'Raids on the port of Meric', family: 'air', region: 'north', mix: { rocket: 3, drone: 2, ballistic: 1.5 } },
  { id: 'velm', name: 'Drone waves over the Velm Plateau', family: 'air', region: 'east', mix: { drone: 4, cruise: 1.5 } },
  { id: 'skerry', name: 'Missile salvos on the Skerry Isles', family: 'air', region: 'isles', mix: { ballistic: 3, cruise: 2 } },
  { id: 'marches', name: 'Eastern Marches offensive', family: 'land', region: 'east', mix: {} },
  { id: 'karrow', name: 'Artillery duel at Karrow Gap', family: 'land', region: 'east', mix: {} },
  { id: 'riverline', name: 'Riverline counteroffensive', family: 'land', region: 'north', mix: {} },
];
