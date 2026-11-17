// Demand: fictional threats arrive in each region, interceptors are fired from the local depot first (with
// a limited airlift from the central reserve), and land fires are drawn by fire missions.
import {
  AIRLIFT_COST,
  AIRLIFT_SHARE,
  CHEAP_THREATS,
  DIFFICULTY,
  LAND_LINES,
  LINES,
  LINE_IDS,
  PREMIUM_LINES,
  SCENARIOS,
  THEATERS,
  THEATER_IDS,
  THREATS,
  THREAT_IDS,
  threatPlural,
} from './data';
import { pick, rand, randRange } from './rng';
import { calmDraw, isEstablished, landEfficiency, nationalStock, passiveFilter } from './selectors';
import type { Forecast, GameState, LineId, MonthReport, TheaterId, ThreatId, ThreatTally } from './types';

/** Engagement order: the most dangerous threats get first call on interceptors. */
const ENGAGE_ORDER: ThreatId[] = ['ballistic', 'aircraft', 'cruise', 'drone', 'rocket'];
const DEGRADED_PK = 0.85;
/** A crisis concentrates in its region; neighbouring regions feel a little of it. */
const FOCUS_GAIN = 2.5;
const SPILL_GAIN = 0.3;

const emptyByLine = (): Record<LineId, number> => Object.fromEntries(LINE_IDS.map((id) => [id, 0])) as Record<LineId, number>;

/** Multiplier on a threat class in one region (or nationally when no region is given). */
export function threatMultiplier(state: GameState, t: ThreatId, crisisActive: boolean, focus: ThreatId | null, theater?: TheaterId): number {
  let m = 1;
  const c = state.crisis;
  if (c && crisisActive && c.family === 'air') {
    const e = ((c.mix[t] ?? 1) - 1) * c.intensity;
    m *= theater === undefined ? 1 + e : 1 + e * (theater === c.theater ? FOCUS_GAIN : SPILL_GAIN);
  }
  if (focus === t) m *= crisisActive && c?.family === 'air' ? 1.5 : 1.15;
  return m;
}

export function landMultiplier(state: GameState, crisisActive: boolean, theater?: TheaterId): number {
  const c = state.crisis;
  if (!(c && crisisActive && c.family === 'land')) return 1;
  const e = 0.8 * c.intensity;
  return theater === undefined ? 1 + e : 1 + e * (theater === c.theater ? 1.6 : SPILL_GAIN);
}

/** Whether the current crisis is active k months from now (k = 1 is the coming month). */
function activeIn(state: GameState, k: number): boolean {
  const c = state.crisis;
  if (!c) return false;
  if (c.phase === 'warning') return k >= c.monthsLeft;
  return k <= c.monthsLeft;
}

/** Expected draw per line in one region, k months ahead. */
export function expectedTheaterDraw(state: GameState, k: number, theater: TheaterId, focus: ThreatId | null = state.opponentFocus): Record<LineId, number> {
  const pressure = SCENARIOS[state.scenario].pressure;
  const active = activeIn(state, k);
  const out = emptyByLine();
  const share = THEATERS[theater].threatShare;
  for (const t of THREAT_IDS) {
    const th = THREATS[t];
    const n = th.calm * share * pressure * threatMultiplier(state, t, active, focus, theater) * passiveFilter(state, t);
    const live = th.assign.filter((a) => a.weight > 0 && isEstablished(state, a.line));
    const wsum = live.reduce((s, a) => s + a.weight, 0);
    for (const a of live) out[a.line] += n * th.shots * (a.weight / wsum);
  }
  for (const id of LAND_LINES) out[id] = calmDraw(state, id) * THEATERS[theater].landShare * landMultiplier(state, active, theater);
  return out;
}

export function expectedDraw(state: GameState, k: number, focus: ThreatId | null): Record<LineId, number> {
  const out = emptyByLine();
  for (const th of THEATER_IDS) {
    const d = expectedTheaterDraw(state, k, th, focus);
    for (const id of LINE_IDS) out[id] += d[id];
  }
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
    if (LINES[id].family !== 'air' || !isEstablished(state, id)) continue;
    const cover = nationalStock(state, id) / Math.max(0.1, calmDraw(state, id));
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

interface Got {
  full: number;
  degraded: number;
}

/** Fires from the regional depot, then airlifts part of the shortfall from the central reserve. */
function take(state: GameState, theater: TheaterId, id: LineId, want: number, tally: { airlift: number; cost: number }): Got {
  want = Math.max(0, want);
  const dep = state.theaters[theater].depot[id];
  const dFull = Math.min(dep.full, want);
  const dDeg = Math.min(dep.degraded, want - dFull);
  dep.full -= dFull;
  dep.degraded -= dDeg;
  const rest = want - dFull - dDeg;
  let cFull = 0;
  let cDeg = 0;
  if (rest > 0) {
    const r = state.reserves[id];
    const can = Math.floor(rest * AIRLIFT_SHARE[LINES[id].family] + 1e-9);
    cFull = Math.min(r.stock, can);
    cDeg = Math.min(r.degraded, can - cFull);
    r.stock -= cFull;
    r.degraded -= cDeg;
    tally.airlift += cFull + cDeg;
    tally.cost += (cFull + cDeg) * LINES[id].unitCost * AIRLIFT_COST;
    state.theaters[theater].lastAirlift += cFull + cDeg;
  }
  return { full: dFull + cFull, degraded: dDeg + cDeg };
}

export interface DemandResult {
  draw: Record<LineId, number>;
  threats: Record<ThreatId, ThreatTally>;
  interceptorSpend: number;
  threatValueStopped: number;
  leakSeverity: number;
  landShortfall: number;
  airliftCost: number;
  messages: MonthReport['messages'];
}

export function resolveDemand(state: GameState): DemandResult {
  const pressure = SCENARIOS[state.scenario].pressure;
  const active = state.crisis?.phase === 'active';
  const draw = emptyByLine();
  const threats = Object.fromEntries(THREAT_IDS.map((t) => [t, { arrived: 0, stopped: 0, leaked: 0 }])) as Record<ThreatId, ThreatTally>;
  const messages: MonthReport['messages'] = [];
  const tally = { airlift: 0, cost: 0 };
  let interceptorSpend = 0;
  let threatValueStopped = 0;
  let leakSeverity = 0;
  for (const th of THEATER_IDS) {
    state.theaters[th].lastAirlift = 0;
    state.theaters[th].lastLeaked = 0;
  }

  for (const t of ENGAGE_ORDER) {
    const th = THREATS[t];
    let unfired = 0;
    const chain = th.assign.filter((a) => isEstablished(state, a.line) && !(state.doctrine.conserve && CHEAP_THREATS.includes(t) && PREMIUM_LINES.includes(a.line)));
    const weighted = chain.filter((a) => a.weight > 0);
    const wsum = weighted.reduce((s, a) => s + a.weight, 0);
    for (const theater of THEATER_IDS) {
      const n = sround(state, th.calm * THEATERS[theater].threatShare * pressure * threatMultiplier(state, t, active, state.opponentFocus, theater) * randRange(state, 0.8, 1.2));
      if (n <= 0) continue;
      // Passive defenses (research) stop some threats before any interceptor fires.
      const passive = Math.round(n * (1 - passiveFilter(state, t)));
      const shotsNeeded = (n - passive) * th.shots;
      const fired = new Map<LineId, Got>();
      const add = (id: LineId, got: Got) => {
        const prev = fired.get(id) ?? { full: 0, degraded: 0 };
        fired.set(id, { full: prev.full + got.full, degraded: prev.degraded + got.degraded });
      };
      let remaining = shotsNeeded;
      for (const a of weighted) {
        const got = take(state, theater, a.line, sround(state, (shotsNeeded * a.weight) / wsum), tally);
        add(a.line, got);
        remaining -= got.full + got.degraded;
      }
      // Anything still unfired falls down the chain.
      for (const a of chain) {
        if (remaining <= 0.5) break;
        const got = take(state, theater, a.line, Math.ceil(remaining - 0.5), tally);
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
      stopped = Math.min(n, stopped + passive);
      threatValueStopped += passive * th.estCost;
      const leaked = Math.max(0, n - stopped);
      const tt = threats[t];
      tt.arrived += n;
      tt.stopped += stopped;
      tt.leaked += leaked;
      state.theaters[theater].lastLeaked += leaked;
      leakSeverity += leaked * th.severity;
      if (remaining > 0.5) unfired += remaining;
    }
    const leaked = threats[t].leaked;
    if (leaked >= 0.5 && th.severity >= 1) {
      messages.push({ tone: 'bad', text: `${Math.round(leaked)} ${threatPlural(t, Math.round(leaked))} got through the defenses.` });
    }
    if (unfired > 0.5 && weighted.length) {
      state.reserves[weighted[0].line].unmet += Math.round(unfired);
      messages.push({ tone: 'bad', text: `${Math.round(unfired)} shots against ${threatPlural(t)} could not be fired: the depots were empty and airlift could not cover the gap.` });
    }
  }

  // Land fires: fire missions draw on regional depots.
  let landShortfall = 0;
  for (const id of LAND_LINES) {
    if (!isEstablished(state, id)) continue;
    let want = 0;
    let got = 0;
    for (const theater of THEATER_IDS) {
      const share = THEATERS[theater].landShare;
      if (share <= 0) continue;
      const w = sround(state, (LINES[id].landDraw ?? 0) * share * pressure * landEfficiency(state, id) * landMultiplier(state, active, theater) * randRange(state, 0.9, 1.1));
      const g = take(state, theater, id, w, tally);
      want += w;
      got += g.full + g.degraded;
    }
    const r = state.reserves[id];
    r.used += got;
    draw[id] += got;
    if (want > got) {
      r.unmet += want - got;
      landShortfall += (want - got) / Math.max(1, want);
      messages.push({ tone: 'bad', text: `Fire missions short of ${LINES[id].name}: ${(want - got).toLocaleString('en-US')} requested rounds did not reach the guns.` });
    }
  }
  if (tally.airlift > 0) messages.push({ tone: 'warn', text: `Emergency airlifts flew ${Math.round(tally.airlift).toLocaleString('en-US')} rounds from the central reserve to empty depots.` });
  return { draw, threats, interceptorSpend, threatValueStopped, leakSeverity, landShortfall, airliftCost: tally.cost, messages };
}
