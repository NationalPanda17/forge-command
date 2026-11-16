// Demand: fictional threats arrive, interceptors are drawn from the reserve by doctrine, land fires by fire missions.
import { threatPlural, CHEAP_THREATS, DIFFICULTY, LAND_LINES, LINES, LINE_IDS, PREMIUM_LINES, SCENARIOS, THREATS, THREAT_IDS } from './data';
import { pick, rand, randRange } from './rng';
import { calmDraw, reserveTotal } from './selectors';
import type { Forecast, GameState, LineId, MonthReport, ThreatId, ThreatTally } from './types';

/** Engagement order: the most dangerous threats get first call on interceptors. */
const ENGAGE_ORDER: ThreatId[] = ['ballistic', 'aircraft', 'cruise', 'drone', 'rocket'];
const DEGRADED_PK = 0.85;

const emptyByLine = (): Record<LineId, number> => Object.fromEntries(LINE_IDS.map((id) => [id, 0])) as Record<LineId, number>;

export function threatMultiplier(state: GameState, t: ThreatId, crisisActive: boolean, focus: ThreatId | null): number {
  let m = 1;
  const c = state.crisis;
  if (c && crisisActive && c.family === 'air') m *= 1 + ((c.mix[t] ?? 1) - 1) * c.intensity;
  if (focus === t) m *= crisisActive && c?.family === 'air' ? 1.5 : 1.15;
  return m;
}

export function landMultiplier(state: GameState, crisisActive: boolean): number {
  const c = state.crisis;
  return c && crisisActive && c.family === 'land' ? 1 + 0.8 * c.intensity : 1;
}

/** Whether the current crisis is active k months from now (k = 1 is the coming month). */
function activeIn(state: GameState, k: number): boolean {
  const c = state.crisis;
  if (!c) return false;
  if (c.phase === 'warning') return k >= c.monthsLeft;
  return k <= c.monthsLeft;
}

export function expectedDraw(state: GameState, k: number, focus: ThreatId | null): Record<LineId, number> {
  const pressure = SCENARIOS[state.scenario].pressure;
  const active = activeIn(state, k);
  const out = emptyByLine();
  for (const t of THREAT_IDS) {
    const th = THREATS[t];
    const n = th.calm * pressure * threatMultiplier(state, t, active, focus);
    for (const a of th.assign) {
      if (a.weight <= 0) continue;
      out[a.line] += n * th.shots * a.weight;
    }
  }
  for (const id of LAND_LINES) out[id] = calmDraw(state, id) * landMultiplier(state, active);
  return out;
}

/** Intel's 3-month outlook. On harder levels, intel sometimes misreads the opponent's focus. */
export function computeForecast(state: GameState): Forecast {
  const rules = DIFFICULTY[state.difficulty];
  let focus = state.opponentFocus;
  if (rules.intelError > 0 && rand(state) < rules.intelError) {
    const others = THREAT_IDS.filter((t) => t !== focus);
    focus = rand(state) < 0.4 ? null : pick(state, others);
  }
  const months = [1, 2, 3].map((k) => expectedDraw(state, k, focus));
  const draw = Object.fromEntries(LINE_IDS.map((id) => [id, months.map((m) => m[id])])) as Record<LineId, number[]>;
  return { draw, focus, confidence: 1 - rules.intelError };
}

/** Hard: the opponent leans on the threat your scarcest interceptor covers. */
export function adaptOpponent(state: GameState): void {
  if (!DIFFICULTY[state.difficulty].adaptive) {
    state.opponentFocus = null;
    return;
  }
  let worst: LineId | null = null;
  let worstCover = Infinity;
  for (const id of LINE_IDS) {
    if (LINES[id].family !== 'air') continue;
    const cover = reserveTotal(state.reserves[id]) / Math.max(0.1, calmDraw(state, id));
    if (cover < worstCover) {
      worstCover = cover;
      worst = id;
    }
  }
  if (!worst) return;
  let best: ThreatId | null = null;
  let bestW = 0;
  for (const t of THREAT_IDS) {
    const a = THREATS[t].assign.find((x) => x.line === worst);
    const w = (a?.weight ?? 0) * THREATS[t].severity;
    if (w > bestW) {
      bestW = w;
      best = t;
    }
  }
  state.opponentFocus = best;
}

/** Stochastic rounding keeps small expected draws honest. */
const sround = (state: GameState, v: number) => {
  const f = Math.floor(v);
  return f + (rand(state) < v - f ? 1 : 0);
};

function take(state: GameState, id: LineId, want: number): { full: number; degraded: number } {
  const r = state.reserves[id];
  const n = Math.min(reserveTotal(r), Math.max(0, want));
  const full = Math.min(r.stock, n);
  const degraded = Math.min(r.degraded, n - full);
  r.stock -= full;
  r.degraded -= degraded;
  return { full, degraded };
}

export interface DemandResult {
  draw: Record<LineId, number>;
  threats: Record<ThreatId, ThreatTally>;
  interceptorSpend: number;
  threatValueStopped: number;
  leakSeverity: number;
  landShortfall: number;
  messages: MonthReport['messages'];
}

export function resolveDemand(state: GameState): DemandResult {
  const pressure = SCENARIOS[state.scenario].pressure;
  const active = state.crisis?.phase === 'active';
  const draw = emptyByLine();
  const threats = Object.fromEntries(THREAT_IDS.map((t) => [t, { arrived: 0, stopped: 0, leaked: 0 }])) as Record<ThreatId, ThreatTally>;
  const messages: MonthReport['messages'] = [];
  let interceptorSpend = 0;
  let threatValueStopped = 0;
  let leakSeverity = 0;

  for (const t of ENGAGE_ORDER) {
    const th = THREATS[t];
    const n = sround(state, th.calm * pressure * threatMultiplier(state, t, active, state.opponentFocus) * randRange(state, 0.8, 1.2));
    if (n <= 0) continue;
    const chain = th.assign.filter((a) => !(state.doctrine.conserve && CHEAP_THREATS.includes(t) && PREMIUM_LINES.includes(a.line)));
    const shotsNeeded = n * th.shots;
    const fired = new Map<LineId, { full: number; degraded: number }>();
    const add = (id: LineId, got: { full: number; degraded: number }) => {
      const prev = fired.get(id) ?? { full: 0, degraded: 0 };
      fired.set(id, { full: prev.full + got.full, degraded: prev.degraded + got.degraded });
    };
    // First pass: doctrine weights.
    const weighted = chain.filter((a) => a.weight > 0);
    const wsum = weighted.reduce((s, a) => s + a.weight, 0);
    let remaining = shotsNeeded;
    for (const a of weighted) {
      const got = take(state, a.line, sround(state, (shotsNeeded * a.weight) / wsum));
      add(a.line, got);
      remaining -= got.full + got.degraded;
    }
    // Second pass: anything still unfired falls down the chain.
    for (const a of chain) {
      if (remaining <= 0.5) break;
      const got = take(state, a.line, Math.ceil(remaining - 0.5));
      add(a.line, got);
      remaining -= got.full + got.degraded;
    }
    let stopped = 0;
    for (const [id, got] of fired) {
      const shots = got.full + got.degraded;
      if (shots <= 0) continue;
      const pk = th.assign.find((a) => a.line === id)?.pk ?? 0.5;
      const engaged = shots / th.shots;
      const effPk = (pk * (got.full + got.degraded * DEGRADED_PK)) / shots;
      const s = Math.min(engaged, engaged * effPk * randRange(state, 0.92, 1.06));
      stopped += s;
      const r = state.reserves[id];
      r.used += shots;
      r.engaged[t] = (r.engaged[t] ?? 0) + engaged;
      r.valueStopped += s * th.estCost;
      draw[id] += shots;
      interceptorSpend += shots * LINES[id].unitCost;
      threatValueStopped += s * th.estCost;
    }
    stopped = Math.min(n, stopped);
    const leaked = Math.max(0, n - stopped);
    threats[t] = { arrived: n, stopped, leaked };
    leakSeverity += leaked * th.severity;
    if (leaked >= 0.5 && th.severity >= 1) {
      messages.push({ tone: 'bad', text: `${Math.round(leaked)} ${threatPlural(t, Math.round(leaked))} got through the defenses.` });
    }
    const dry = chain.filter((a) => a.weight > 0 && reserveTotal(state.reserves[a.line]) < 0.5).map((a) => LINES[a.line].name);
    if (remaining > 0.5 && weighted.length) state.reserves[weighted[0].line].unmet += Math.round(remaining);
    if (dry.length && remaining > 0.5) {
      messages.push({ tone: 'bad', text: `Out of ${dry.join(' and ')}: ${Math.round(remaining)} shots against ${threatPlural(t)} could not be fired.` });
    }
  }

  // Land fires: fire missions draw on the reserve.
  let landShortfall = 0;
  for (const id of LAND_LINES) {
    const want = sround(state, (LINES[id].landDraw ?? 0) * pressure * landMultiplier(state, active) * randRange(state, 0.9, 1.1));
    const got = take(state, id, want);
    const shots = got.full + got.degraded;
    const r = state.reserves[id];
    r.used += shots;
    draw[id] += shots;
    if (want > shots) {
      r.unmet += want - shots;
      landShortfall += (want - shots) / Math.max(1, want);
      messages.push({ tone: 'bad', text: `Fire missions short of ${LINES[id].name}: ${(want - shots).toLocaleString('en-US')} requested rounds not available.` });
    }
  }
  return { draw, threats, interceptorSpend, threatValueStopped, leakSeverity, landShortfall, messages };
}
