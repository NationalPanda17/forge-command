import { CAMPUS_IDS, COMPONENT_IDS, FACILITY_IDS, LINE_IDS, STAGES, SUPPLIER_IDS, TEST_CELLS, TIER2_IDS } from './data';
import { emptyFacility, seedPipeline } from './setup';
import type { GameState } from './types';

export const SAVE_VERSION = 4;

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

/** Brings an older save up to the current version. Returns null if it cannot be upgraded. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrate(raw: any): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.version === 2) {
    for (const id of LINE_IDS) {
      const line = raw.lines?.[id];
      if (!line) return null;
      for (const t of line.tranches ?? []) t.faiMonths ??= 0;
      line.wip ??= STAGES[id].slice(1).map(() => 0);
      line.debottleneck ??= STAGES[id].map(() => 0);
      line.debottlenecking ??= null;
      line.stages ??= STAGES[id].map(() => ({ cap: 0, throughput: 0, scrap: 0, limit: null }));
    }
    for (const c of CAMPUS_IDS) {
      const cs = raw.campuses?.[c];
      if (!cs) return null;
      cs.testCells ??= TEST_CELLS[c].start;
      cs.testCellBuilds ??= [];
      cs.lastTestHours ??= { need: 0, avail: 0 };
    }
    raw.facilities ??= Object.fromEntries(FACILITY_IDS.map((f) => [f, emptyFacility(f)]));
    raw.version = 3;
  }
  if (raw.version === 3) {
    for (const c of COMPONENT_IDS) {
      const cs = raw.components?.[c];
      if (!cs) return null;
      cs.priceIndex ??= 1;
      cs.lastAged ??= 0;
      cs.lastLost ??= 0;
    }
    for (const sid of SUPPLIER_IDS) {
      const st = raw.suppliers?.[sid];
      if (!st) return null;
      st.capBonus ??= 0;
      st.investingMonths ??= null;
    }
    raw.tier2 ??= Object.fromEntries(TIER2_IDS.map((t) => [t, { id: t, availability: 1, priceIndex: 1, disruptionMonths: 0 }]));
    if (!raw.shipments) {
      raw.shipments = [];
      const month = raw.month;
      seedPipeline(raw);
      for (const sh of raw.shipments) sh.arrive += month;
    }
    raw.version = 4;
  }
  return raw.version === SAVE_VERSION ? (raw as GameState) : null;
}

/** Parses a saved game, upgrading older versions. Returns null if it is missing, corrupt or unknown. */
export function deserialize(text: string | null | undefined): GameState | null {
  if (!text) return null;
  try {
    const s = migrate(JSON.parse(text));
    if (!s) return null;
    if (!LINE_IDS.every((id) => s.lines?.[id] && s.reserves?.[id])) return null;
    if (!COMPONENT_IDS.every((id) => s.components?.[id])) return null;
    if (!CAMPUS_IDS.every((id) => s.campuses?.[id])) return null;
    if (!SUPPLIER_IDS.every((id) => s.suppliers?.[id])) return null;
    if (!FACILITY_IDS.every((id) => s.facilities?.[id])) return null;
    return s;
  } catch {
    return null;
  }
}
