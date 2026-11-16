// The pure turn engine: newGame, applyAction and endTurn never mutate their inputs.
import {
  COMPONENTS,
  COMPONENT_IDS,
  CONTRACT_DISCOUNT,
  CRISES,
  DIFFICULTY,
  EXPAND_STEP,
  LINES,
  LINE_IDS,
  MAX_EXPANSIONS,
  NEW_TRANCHE_MATURITY,
  RUN_COST,
  RUN_FACTOR,
  SPOT_PREMIUM,
  WEAR_DELTA,
} from './data';
import { clamp, pick, rand, randInt, randRange } from './rng';
import type {
  Action,
  ComponentId,
  ComponentState,
  Difficulty,
  GameState,
  LineId,
  LineState,
  MonthReport,
  Priority,
  ReserveState,
} from './types';

const PRIORITY_ORDER: Priority[] = ['high', 'normal', 'low'];

export interface NewGameOptions {
  seed: number;
  difficulty?: Difficulty;
  months?: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Components the original floors need per month at a normal pace. */
export function baselineNeed(c: ComponentId): number {
  return LINE_IDS.reduce((sum, id) => sum + LINES[id].baseCapacity * (LINES[id].bom[c] ?? 0), 0);
}

export function newGame({ seed, difficulty = 'normal', months = 48 }: NewGameOptions): GameState {
  const rules = DIFFICULTY[difficulty];
  const lines = {} as Record<LineId, LineState>;
  const reserves = {} as Record<LineId, ReserveState>;
  for (const id of LINE_IDS) {
    const def = LINES[id];
    lines[id] = {
      id,
      tranches: [{ capacity: def.baseCapacity, maturity: 1 }],
      run: 'normal',
      priority: 'normal',
      wear: 10,
      partial: 0,
      lastOutput: 0,
      lastQuarantined: 0,
      lastLimit: null,
    };
    reserves[id] = { id, stock: Math.round(def.baseDraw * 3), made: 0, used: 0, unmet: 0 };
  }
  let nextContractId = 1;
  const components = {} as Record<ComponentId, ComponentState>;
  for (const c of COMPONENT_IDS) {
    const need = baselineNeed(c);
    components[c] = {
      id: c,
      stock: round2(need),
      capFactor: 1,
      shockMonths: 0,
      contracts: [
        { id: nextContractId++, qtyPerMonth: round2(need * 0.85), monthsLeft: 9, unitPrice: COMPONENTS[c].price * 0.88, backlog: 0 },
      ],
      spotOrder: 0,
      lastDelivered: 0,
      lastUsed: 0,
      lastShort: 0,
    };
  }
  return {
    version: 1,
    seed: seed >>> 0,
    rng: seed >>> 0,
    month: 0,
    months,
    difficulty,
    treasury: rules.startTreasury,
    appropriation: rules.appropriation,
    lines,
    components,
    reserves,
    crisis: null,
    pendingCapital: 0,
    nextContractId,
    history: [],
    over: false,
  };
}

// ---------- Selectors ----------

export const effectiveCapacity = (line: LineState) => line.tranches.reduce((s, t) => s + t.capacity * t.maturity, 0);
export const installedCapacity = (line: LineState) => line.tranches.reduce((s, t) => s + t.capacity, 0);
export const expansions = (line: LineState) => line.tranches.length - 1;
export const reserveTarget = (id: LineId) => LINES[id].baseDraw * LINES[id].targetMonths;
export const expandCost = (id: LineId) => LINES[id].expandCost;

/** Planned production this month, before component limits. */
export const plannedOutput = (line: LineState) => effectiveCapacity(line) * RUN_FACTOR[line.run];

/** Components the current plan would use this month. */
export function plannedNeed(state: GameState, c: ComponentId): number {
  return LINE_IDS.reduce((s, id) => s + plannedOutput(state.lines[id]) * (LINES[id].bom[c] ?? 0), 0);
}

/** What the supplier can deliver this month at most. */
export function supplierCap(state: GameState, c: ComponentId): number {
  return COMPONENTS[c].baseCap * DIFFICULTY[state.difficulty].capMult * state.components[c].capFactor;
}

export const contractedPerMonth = (cs: ComponentState) =>
  cs.contracts.reduce((s, k) => s + (k.monthsLeft > 0 ? k.qtyPerMonth : 0), 0);

export const contractCostPerMonth = (cs: ComponentState) =>
  cs.contracts.reduce((s, k) => s + (k.monthsLeft > 0 ? k.qtyPerMonth * k.unitPrice : 0), 0);

export function readiness(state: GameState): number {
  const parts = LINE_IDS.map((id) => Math.min(1, state.reserves[id].stock / reserveTarget(id)));
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

export function lineOpCost(state: GameState, id: LineId): number {
  const line = state.lines[id];
  return LINES[id].opCost * (installedCapacity(line) / LINES[id].baseCapacity) * RUN_COST[line.run];
}

// ---------- Actions ----------

export function validateAction(state: GameState, action: Action): string | null {
  if (state.over) return 'The campaign is over.';
  switch (action.type) {
    case 'setRun':
    case 'setPriority':
      return state.lines[action.line] ? null : 'Unknown line.';
    case 'expandLine': {
      const line = state.lines[action.line];
      if (!line) return 'Unknown line.';
      if (expansions(line) >= MAX_EXPANSIONS) return 'No floor space left for this line.';
      if (state.treasury < expandCost(action.line)) return 'Not enough funds.';
      return null;
    }
    case 'setSpotOrder':
      if (!state.components[action.component]) return 'Unknown component.';
      return Number.isFinite(action.qty) && action.qty >= 0 ? null : 'Order must be zero or more.';
    case 'signContract':
      if (!state.components[action.component]) return 'Unknown component.';
      if (!(action.months in CONTRACT_DISCOUNT)) return 'Contracts run 12, 24 or 36 months.';
      return Number.isFinite(action.qtyPerMonth) && action.qtyPerMonth > 0 ? null : 'Quantity must be above zero.';
  }
}

/** Applies a player action. Invalid actions return the state unchanged (check validateAction for why). */
export function applyAction(state: GameState, action: Action): GameState {
  if (validateAction(state, action)) return state;
  const s = structuredClone(state);
  switch (action.type) {
    case 'setRun':
      s.lines[action.line].run = action.run;
      break;
    case 'setPriority':
      s.lines[action.line].priority = action.priority;
      break;
    case 'expandLine': {
      const cost = expandCost(action.line);
      s.treasury -= cost;
      s.pendingCapital += cost;
      s.lines[action.line].tranches.push({
        capacity: LINES[action.line].baseCapacity * EXPAND_STEP,
        maturity: NEW_TRANCHE_MATURITY,
      });
      break;
    }
    case 'setSpotOrder':
      s.components[action.component].spotOrder = round2(action.qty);
      break;
    case 'signContract':
      s.components[action.component].contracts.push({
        id: s.nextContractId++,
        qtyPerMonth: round2(action.qtyPerMonth),
        monthsLeft: action.months,
        unitPrice: COMPONENTS[action.component].price * CONTRACT_DISCOUNT[action.months],
        backlog: 0,
      });
      break;
  }
  return s;
}

// ---------- Turn resolution ----------

const emptyByLine = (): Record<LineId, number> =>
  Object.fromEntries(LINE_IDS.map((id) => [id, 0])) as Record<LineId, number>;

export function endTurn(state: GameState): GameState {
  if (state.over) return state;
  const s = structuredClone(state);
  const rules = DIFFICULTY[s.difficulty];
  const messages: string[] = [];
  let componentSpend = 0;
  let opSpend = 0;

  // 1. World: crises brew, flare and fade.
  if (!s.crisis) {
    if (rand(s) < rules.crisisChance) {
      const c = pick(s, CRISES);
      s.crisis = { name: c.name, family: c.family, phase: 'warning', monthsLeft: 2, intensity: round2(randRange(s, 1.5, 2.2)) };
      messages.push(`Intel: tension rising (${c.name}). Expect heavier ${c.family === 'air' ? 'interceptor' : 'land fires'} draw in about 2 months.`);
    }
  } else if (s.crisis.phase === 'warning') {
    s.crisis.monthsLeft--;
    if (s.crisis.monthsLeft <= 0) {
      s.crisis.phase = 'active';
      s.crisis.monthsLeft = randInt(s, 5, 10);
      messages.push(`Crisis: ${s.crisis.name} has begun. Draw on ${s.crisis.family === 'air' ? 'interceptors' : 'land fires'} is up sharply.`);
    }
  }

  // 2. Supply: suppliers deliver contracts first, then standing spot orders.
  for (const c of COMPONENT_IDS) {
    const cs = s.components[c];
    const def = COMPONENTS[c];
    if (!rules.shortages) {
      cs.capFactor = 1;
      cs.shockMonths = 0;
    } else if (cs.shockMonths > 0) {
      cs.shockMonths--;
    } else if (rand(s) < rules.shockChance) {
      cs.capFactor = round2(randRange(s, 0.4, 0.7));
      cs.shockMonths = randInt(s, 2, 5) - 1;
      messages.push(`Shortage: ${def.supplier} (${def.supplierNation}) can only deliver ${Math.round(cs.capFactor * 100)}% of ${def.name.toLowerCase()} for a while.`);
    } else {
      if (cs.capFactor < 0.9) messages.push(`${def.supplier} is back to normal deliveries of ${def.name.toLowerCase()}.`);
      cs.capFactor = round2(randRange(s, 0.94, 1.04));
    }
    let capLeft = supplierCap(s, c);
    let delivered = 0;
    for (const k of cs.contracts) {
      if (k.monthsLeft > 0) {
        componentSpend += k.qtyPerMonth * k.unitPrice; // take-or-pay
        k.backlog += k.qtyPerMonth;
        k.monthsLeft--;
      }
      const d = Math.min(k.backlog, capLeft);
      k.backlog = round2(k.backlog - d);
      capLeft -= d;
      delivered += d;
    }
    cs.contracts = cs.contracts.filter((k) => k.monthsLeft > 0 || k.backlog > 0);
    const spot = Math.min(cs.spotOrder, capLeft);
    componentSpend += spot * def.price * SPOT_PREMIUM;
    delivered += spot;
    cs.stock += delivered;
    cs.lastDelivered = round2(delivered);
    cs.lastUsed = 0;
    cs.lastShort = 0;
  }

  // 3. Production: higher-priority lines draw on component stock first.
  const output = emptyByLine();
  for (const prio of PRIORITY_ORDER) {
    const ids = LINE_IDS.filter((id) => s.lines[id].priority === prio && s.lines[id].run !== 'idle');
    const desired = Object.fromEntries(ids.map((id) => [id, plannedOutput(s.lines[id])])) as Record<LineId, number>;
    const ratio = {} as Record<ComponentId, number>;
    for (const c of COMPONENT_IDS) {
      const need = ids.reduce((sum, id) => sum + desired[id] * (LINES[id].bom[c] ?? 0), 0);
      const cs = s.components[c];
      if (need > cs.stock && !rules.shortages) {
        // Easy: the supplier keeps up, at list price.
        componentSpend += (need - cs.stock) * COMPONENTS[c].price;
        cs.lastDelivered = round2(cs.lastDelivered + need - cs.stock);
        cs.stock = need;
      }
      ratio[c] = need > 0 ? Math.min(1, cs.stock / need) : 1;
    }
    for (const id of ids) {
      const line = s.lines[id];
      const bom = LINES[id].bom;
      let frac = 1;
      let limit: ComponentId | 'capacity' = 'capacity';
      for (const c of Object.keys(bom) as ComponentId[]) {
        if (ratio[c] < frac) {
          frac = ratio[c];
          limit = c;
        }
      }
      const built = desired[id] * frac;
      for (const c of Object.keys(bom) as ComponentId[]) {
        const use = built * (bom[c] ?? 0);
        const cs = s.components[c];
        cs.stock = Math.max(0, cs.stock - use);
        cs.lastUsed += use;
        cs.lastShort += desired[id] * (bom[c] ?? 0) - use;
      }
      const total = built + line.partial;
      let out = Math.floor(total + 1e-9);
      line.partial = total - out;
      line.lastLimit = frac < 0.999 ? limit : 'capacity';

      // Quality: worn lines throw faults; a quarantined batch never reaches the reserve.
      line.lastQuarantined = 0;
      if (line.wear > 25 && rand(s) < (line.wear - 25) / 150 && out > 0) {
        const q = Math.max(1, Math.round(out * randRange(s, 0.15, 0.35)));
        out -= q;
        line.lastQuarantined = q;
        messages.push(`Quality fault at ${LINES[id].plant}: ${q.toLocaleString('en-US')} ${LINES[id].name} quarantined.`);
        if (line.wear > 60 && rand(s) < 0.3) {
          const recalled = Math.round(s.reserves[id].stock * 0.05);
          if (recalled > 0) {
            s.reserves[id].stock -= recalled;
            messages.push(`Recall: ${recalled.toLocaleString('en-US')} ${LINES[id].name} pulled from the reserve after the same fault.`);
          }
        }
      }
      line.lastOutput = out;
      output[id] = out;
    }
  }
  for (const id of LINE_IDS) {
    const line = s.lines[id];
    if (line.run === 'idle') {
      line.lastOutput = 0;
      line.lastQuarantined = 0;
      line.lastLimit = 'idle';
    }
    opSpend += lineOpCost(s, id);
    line.wear = clamp(line.wear + WEAR_DELTA[line.run]);
    for (const t of line.tranches) t.maturity = Math.min(1, round2(t.maturity + rules.rampPerMonth));
  }
  for (const c of COMPONENT_IDS) {
    const cs = s.components[c];
    cs.stock = round2(cs.stock);
    cs.lastUsed = round2(cs.lastUsed);
    cs.lastShort = round2(cs.lastShort);
  }

  // 4. Demand: the reserve receives output, then pays out this month's draw.
  const draw = emptyByLine();
  for (const id of LINE_IDS) {
    const def = LINES[id];
    const r = s.reserves[id];
    const mult = s.crisis?.phase === 'active' && s.crisis.family === def.family ? s.crisis.intensity : 1;
    const want = Math.round(def.baseDraw * mult * randRange(s, 0.9, 1.1));
    r.stock += output[id];
    r.made += output[id];
    const used = Math.min(r.stock, want);
    r.stock -= used;
    r.used += used;
    if (want > used) {
      r.unmet += want - used;
      messages.push(`Shortfall: ${(want - used).toLocaleString('en-US')} ${def.name} requested but the reserve is empty.`);
    }
    draw[id] = want;
  }

  if (s.crisis?.phase === 'active') {
    s.crisis.monthsLeft--;
    if (s.crisis.monthsLeft <= 0) {
      messages.push(`${s.crisis.name} has wound down. Draw returns to normal.`);
      s.crisis = null;
    }
  }

  // 5. Money.
  s.treasury = round2(s.treasury + s.appropriation - componentSpend - opSpend);
  if (s.treasury < 0) messages.push('The board is over budget. Cut spending or expect hard questions.');

  const report: MonthReport = {
    month: s.month,
    output,
    draw,
    readiness: round2(readiness(s)),
    treasury: s.treasury,
    spend: { components: round2(componentSpend), operations: round2(opSpend), capital: round2(s.pendingCapital) },
    messages,
  };
  s.history.push(report);
  s.pendingCapital = 0;
  s.month++;
  if (s.month >= s.months) s.over = true;
  return s;
}

/** Plays a list of actions then ends the turn: handy for tests and replays. */
export function playTurn(state: GameState, actions: Action[] = []): GameState {
  return endTurn(actions.reduce(applyAction, state));
}
