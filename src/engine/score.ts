// Campaign debrief: grades and a single score.
import { LINES, LINE_IDS } from './data';
import { averageGoodwill } from './partners';
import type { GameState, LineId } from './types';

export interface Grade {
  label: string;
  value: string;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  note: string;
}

const letter = (v: number, cuts: [number, number, number, number]): Grade['grade'] =>
  v >= cuts[0] ? 'A' : v >= cuts[1] ? 'B' : v >= cuts[2] ? 'C' : v >= cuts[3] ? 'D' : 'F';

export interface CostExchangeRow {
  line: LineId;
  made: number;
  used: number;
  spend: number;
  stopped: number;
  ratio: number;
}

export function costExchange(state: GameState): CostExchangeRow[] {
  return LINE_IDS.filter((id) => LINES[id].family === 'air').map((id) => {
    const r = state.reserves[id];
    const spend = r.used * LINES[id].unitCost;
    return { line: id, made: r.made, used: r.used, spend, stopped: r.valueStopped, ratio: spend > 0 ? r.valueStopped / spend : 0 };
  });
}

export interface Debrief {
  score: number;
  grades: Grade[];
  totals: { arrived: number; stopped: number; leaked: number; spend: number; stopped$: number };
}

export function debrief(state: GameState): Debrief {
  const h = state.history;
  const n = Math.max(1, h.length);
  const avgReady = h.reduce((a, x) => a + x.readiness, 0) / n;
  let arrived = 0;
  let stopped = 0;
  let leaked = 0;
  for (const m of h) for (const t of Object.values(m.threats)) {
    arrived += t.arrived;
    stopped += t.stopped;
    leaked += t.leaked;
  }
  const spend = h.reduce((a, x) => a + x.interceptorSpend, 0);
  const stoppedValue = h.reduce((a, x) => a + x.threatValueStopped, 0);
  const stopRate = arrived > 0 ? stopped / arrived : 1;
  const exchange = spend > 0 ? stoppedValue / spend : 0;
  const goodwill = averageGoodwill(state);
  const grades: Grade[] = [
    { label: 'Reserve readiness', value: `${Math.round(avgReady * 100)}%`, grade: letter(avgReady, [0.9, 0.75, 0.6, 0.45]), note: 'Average reserve against the 6-month goal.' },
    { label: 'Threats stopped', value: `${Math.round(stopRate * 100)}%`, grade: letter(stopRate, [0.9, 0.82, 0.74, 0.65]), note: `${Math.round(leaked).toLocaleString('en-US')} got through.` },
    { label: 'Cost exchange', value: `${exchange.toFixed(2)}×`, grade: letter(exchange, [1.0, 0.85, 0.7, 0.55]), note: 'Threat value stopped per interceptor dollar fired.' },
    { label: 'Committee confidence', value: `${Math.round(state.confidence)}`, grade: letter(state.confidence, [80, 65, 50, 30]), note: state.outcome === 'dismissed' ? 'You were dismissed.' : 'Where you finished.' },
    { label: 'Finances', value: `${state.treasury < 0 ? '−' : ''}$${Math.abs(Math.round(state.treasury))}M`, grade: letter(state.treasury, [500, 150, 0, -300]), note: 'Treasury at the end.' },
    { label: 'Partner goodwill', value: `${Math.round(goodwill)}`, grade: letter(goodwill, [75, 62, 50, 38]), note: 'Average across partner nations.' },
  ];
  const pts = { A: 4, B: 3, C: 2, D: 1, F: 0 } as const;
  const weights = [3, 3, 2, 2, 1, 1];
  const raw = grades.reduce((a, g, i) => a + pts[g.grade] * weights[i], 0) / (4 * weights.reduce((a, b) => a + b, 0));
  const score = Math.round(raw * 1000 * (state.outcome === 'dismissed' ? 0.5 : 1));
  return { score, grades, totals: { arrived, stopped, leaked, spend, stopped$: stoppedValue } };
}
