// Intelligence operations: go on the offensive against the rival. Delay its next weapon, steal its plans for early
// warning and a head start on the counter, or disrupt its supply to cut its attacks for a while. Each operation takes
// time, may fail, and may be exposed, which costs confidence and the allies' goodwill. A better agency improves the
// odds; every success puts the rival more on guard.
import { DEVELOPMENTS, RIVAL_NAME, announceNext } from './rival';
import { clamp, rand, randInt } from './rng';
import type { FeedItem, SimState } from './types';

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

export type OpKind = 'delay' | 'learn' | 'supply';

export const OPS: Record<OpKind, { name: string; blurb: string; cost: number; days: number; odds: number; exposure: number }> = {
  learn: { name: 'Steal their plans', blurb: 'Early warning of the rival’s next weapon, and a head start on the counter you are researching.', cost: 25, days: 45, odds: 0.7, exposure: 0.15 },
  delay: { name: 'Sabotage a weapons programme', blurb: 'The rival’s next weapon comes about two and a half months later.', cost: 40, days: 75, odds: 0.55, exposure: 0.25 },
  supply: { name: 'Disrupt their supply', blurb: 'Fewer attacks of every kind for four months.', cost: 50, days: 90, odds: 0.5, exposure: 0.3 },
};
export const OP_IDS = Object.keys(OPS) as OpKind[];
export const MAX_AGENCY = 3;
export const AGENCY = ['A small desk', 'A capable service', 'A seasoned service', 'A formidable service'] as const;

export interface IntelState {
  agency: number;
  /** How on guard the rival is: each success raises it; it fades. */
  alert: number;
  active: { kind: OpKind; days: number; total: number } | null;
  /** Until this day the rival's attacks are fewer. */
  supplyUntil: number;
  record: { day: number; kind: OpKind; result: 'success' | 'failure'; exposed: boolean }[];
}

export const newIntel = (): IntelState => ({ agency: 0, alert: 0, active: null, supplyUntil: 0, record: [] });

export const opCost = (s: SimState, k: OpKind) => Math.round(OPS[k].cost * s.priceIndex);
export const agencyCost = (s: SimState) => Math.round((30 + 25 * s.intel.agency) * s.priceIndex);
export const opOdds = (s: SimState, k: OpKind) => clamp(OPS[k].odds + 0.08 * s.intel.agency - 0.06 * s.intel.alert, 0.1, 0.9);
export const opExposure = (s: SimState, k: OpKind) => clamp(OPS[k].exposure - 0.05 * s.intel.agency + 0.03 * s.intel.alert, 0.03, 0.6);
/** Attacks while the rival's supply is disrupted. */
export const supplyFactor = (s: SimState) => (s.intel && s.intel.supplyUntil > s.day ? 0.85 : 1);

export function validateIntel(s: SimState, a: { type: string; kind?: OpKind }): string | null {
  if (a.type === 'intelOp') {
    if (!a.kind || !Object.prototype.hasOwnProperty.call(OPS, a.kind)) return 'No such operation.';
    if (s.intel.active) return 'An operation is already under way.';
    if (s.day < 60) return 'Your service needs a couple of months to find its feet.';
    if (a.kind === 'delay' && !s.rival.known.some((k) => k.fielded > s.day) && s.rival.known.length >= s.rival.order.length) return 'The rival has nothing left in development.';
    return s.treasury >= opCost(s, a.kind!) ? null : `Not enough money (needs $${opCost(s, a.kind!)}M).`;
  }
  if (a.type === 'intelAgency') {
    if (s.intel.agency >= MAX_AGENCY) return 'Your service is as good as it gets.';
    return s.treasury >= agencyCost(s) ? null : `Not enough money (needs $${agencyCost(s)}M).`;
  }
  return null;
}

export function applyIntel(s: SimState, a: { type: string; kind?: OpKind }, feed: Feed): void {
  if (a.type === 'intelOp') {
    const k = a.kind!;
    s.treasury -= opCost(s, k);
    s.month.spend.projects += opCost(s, k);
    s.intel.active = { kind: k, days: OPS[k].days, total: OPS[k].days };
    feed(s, 'info', `Operation launched: ${OPS[k].name.toLowerCase()}. Results in about ${Math.round(OPS[k].days / 30)} months.`);
  } else if (a.type === 'intelAgency') {
    s.treasury -= agencyCost(s);
    s.month.spend.projects += agencyCost(s);
    s.intel.agency++;
    feed(s, 'info', `Your intelligence service grows: ${AGENCY[s.intel.agency].toLowerCase()}.`);
  }
}

export function intelDay(s: SimState, feed: Feed): void {
  const op = s.intel.active;
  if (!op || --op.days > 0) return;
  s.intel.active = null;
  const success = rand(s) < opOdds(s, op.kind);
  const exposed = rand(s) < opExposure(s, op.kind);
  s.intel.record.push({ day: s.day, kind: op.kind, result: success ? 'success' : 'failure', exposed });
  if (s.intel.record.length > 20) s.intel.record.shift();
  const name = OPS[op.kind].name.toLowerCase();
  const left = s.rival.known.length < s.rival.order.length;
  if (success) {
    s.intel.alert += 1;
    if (op.kind === 'delay') {
      const k = s.rival.known.find((x) => x.fielded > s.day);
      if (!k && !left) {
        feed(s, 'info', 'Operation succeeds, but the rival has nothing left in development to set back.', undefined, true);
      } else if (k) {
        k.fielded += 75;
        feed(s, 'good', `Operation succeeds: ${DEVELOPMENTS[k.id].name.toLowerCase()} will reach the field about two and a half months late.`, undefined, true);
      } else {
        s.rival.next += 75;
        feed(s, 'good', `Operation succeeds: ${RIVAL_NAME}'s next weapons programme is set back about two and a half months.`, undefined, true);
      }
    } else if (op.kind === 'learn') {
      const r = s.strategy.research.active;
      const counters = s.rival.known.map((k) => DEVELOPMENTS[k.id].counter);
      const ahead = !!r && counters.includes(r.id);
      if (r && ahead) r.days = Math.max(1, Math.round(r.days * 0.7));
      // Is the next weapon still unannounced? Then the plans reveal it now, on its usual timetable.
      const early = left && !s.rival.known.some((k) => k.fielded > s.day);
      feed(s, 'good', `Operation succeeds: you have the rival's plans.${ahead ? ' Your counter research jumps ahead.' : ''}${!early && !ahead ? ' They confirm what you already knew.' : ''}`, undefined, true);
      if (early) announceNext(s, feed);
    } else {
      s.intel.supplyUntil = s.day + 120;
      feed(s, 'good', `Operation succeeds: ${RIVAL_NAME}'s supply lines are disrupted. Fewer attacks for about four months.`, undefined, true);
    }
  } else {
    s.intel.alert += 0.5;
    feed(s, 'warn', `Operation fails: ${name}. Nothing was gained.`, undefined, true);
  }
  if (exposed) {
    s.confidence = clamp(s.confidence - 4);
    for (const a of ['merrow', 'calder'] as const) s.allies[a] = clamp(s.allies[a] - 8);
    s.strategy.factions.hawks = clamp(s.strategy.factions.hawks + 2);
    // The rival retaliates by hurrying its own work.
    if (s.rival.known.length < s.rival.order.length) s.rival.next = Math.max(s.day + 10, s.rival.next - randInt(s, 20, 40));
    feed(s, 'bad', `The operation is exposed. ${RIVAL_NAME[0].toUpperCase() + RIVAL_NAME.slice(1)} protests loudly, the allies are embarrassed, and the rival hurries its own work.`, undefined, true);
  }
}

export function intelMonth(s: SimState): void {
  s.intel.alert = Math.max(0, s.intel.alert - 0.1);
}
