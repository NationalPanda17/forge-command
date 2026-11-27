// The fight, abstracted: fictional threats arrive in each region every day and the bases there fire at them.
import threatsData from './data/threats.json';
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

export const THREATS: Record<ThreatId, ThreatDef> = threatsData as unknown as Record<ThreatId, ThreatDef>;
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
