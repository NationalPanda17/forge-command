import { describe, expect, it } from 'vitest';
import {
  COMPONENTS,
  COMPONENT_IDS,
  LINES,
  LINE_IDS,
  NEW_TRANCHE_MATURITY,
  applyAction,
  baselineNeed,
  deserialize,
  effectiveCapacity,
  endTurn,
  newGame,
  playTurn,
  plannedNeed,
  serialize,
  validateAction,
  type Action,
  type GameState,
} from '../src/engine';

function runCampaign(seed: number, months: number, actionsFor: (s: GameState) => Action[] = () => []): GameState {
  let s = newGame({ seed, months });
  while (!s.over) s = playTurn(s, actionsFor(s));
  return s;
}

describe('determinism', () => {
  it('replays identically from the same seed and actions', () => {
    const plan = (s: GameState): Action[] => (s.month === 2 ? [{ type: 'setRun', line: 'gmlrs', run: 'surge' }] : []);
    const a = runCampaign(42, 24, plan);
    const b = runCampaign(42, 24, plan);
    expect(serialize(a)).toBe(serialize(b));
  });

  it('diverges with a different seed', () => {
    expect(serialize(runCampaign(1, 24))).not.toBe(serialize(runCampaign(2, 24)));
  });

  it('never mutates its input', () => {
    const s = newGame({ seed: 7 });
    const before = serialize(s);
    endTurn(s);
    applyAction(s, { type: 'expandLine', line: 'pac3' });
    expect(serialize(s)).toBe(before);
  });

  it('round-trips through save and load', () => {
    const s = runCampaign(9, 6);
    expect(deserialize(serialize(s))).toEqual(s);
    expect(deserialize('not json')).toBeNull();
    expect(deserialize(JSON.stringify({ version: 99 }))).toBeNull();
  });
});

describe('production lines', () => {
  it('new capacity starts near 30% and ramps to full', () => {
    let s = newGame({ seed: 3, difficulty: 'normal' });
    const base = effectiveCapacity(s.lines.pac3);
    s = applyAction(s, { type: 'expandLine', line: 'pac3' });
    const step = LINES.pac3.baseCapacity * 0.25;
    expect(effectiveCapacity(s.lines.pac3)).toBeCloseTo(base + step * NEW_TRANCHE_MATURITY);
    for (let i = 0; i < 12; i++) s = endTurn(s);
    expect(effectiveCapacity(s.lines.pac3)).toBeCloseTo(base + step);
  });

  it('ramps faster on easy than on hard', () => {
    const ramp = (difficulty: 'easy' | 'hard') => {
      let s = applyAction(newGame({ seed: 3, difficulty }), { type: 'expandLine', line: 'gmlrs' });
      for (let i = 0; i < 3; i++) s = endTurn(s);
      return s.lines.gmlrs.tranches[1].maturity;
    };
    expect(ramp('easy')).toBeGreaterThan(ramp('hard'));
  });

  it('charges for expansion and refuses it without funds or floor space', () => {
    let s = newGame({ seed: 3 });
    const t = s.treasury;
    s = applyAction(s, { type: 'expandLine', line: 'tamir' });
    expect(s.treasury).toBe(t - LINES.tamir.expandCost);
    for (let i = 0; i < 3; i++) s = applyAction(s, { type: 'expandLine', line: 'tamir' });
    expect(validateAction(s, { type: 'expandLine', line: 'tamir' })).toMatch(/floor space/);
    const broke = { ...s, treasury: 1 };
    expect(validateAction(broke, { type: 'expandLine', line: 'pac3' })).toMatch(/funds/);
  });

  it('surge shifts build more and wear the line; idle builds nothing', () => {
    const base = newGame({ seed: 11, difficulty: 'easy' });
    const normal = endTurn(base);
    const surge = playTurn(base, [{ type: 'setRun', line: 'shell155', run: 'surge' }]);
    const idle = playTurn(base, [{ type: 'setRun', line: 'shell155', run: 'idle' }]);
    expect(surge.history[0].output.shell155 + surge.lines.shell155.lastQuarantined).toBeGreaterThan(normal.history[0].output.shell155);
    expect(surge.lines.shell155.wear).toBeGreaterThan(normal.lines.shell155.wear);
    expect(idle.history[0].output.shell155).toBe(0);
    expect(idle.lines.shell155.lastLimit).toBe('idle');
  });

  it('sustained surging eventually throws quality faults', () => {
    const s = runCampaign(5, 30, () => LINE_IDS.map((line) => ({ type: 'setRun', line, run: 'surge' }) as Action));
    expect(s.history.some((h) => h.messages.some((m) => m.startsWith('Quality fault')))).toBe(true);
  });
});

describe('shared components', () => {
  it('a shortage slows every line that uses the part, and only those', () => {
    let s = newGame({ seed: 21 });
    // Run solid rocket motors dry: no stock, no contracts.
    s = structuredClone(s);
    s.components.srm.stock = 0;
    s.components.srm.contracts = [];
    const after = endTurn(s);
    for (const id of LINE_IDS) {
      if (LINES[id].bom.srm) {
        expect(after.history[0].output[id]).toBe(0);
        expect(after.lines[id].lastLimit).toBe('srm');
      }
    }
    expect(after.history[0].output.shell155).toBeGreaterThan(0); // shells need no motors
  });

  it('high-priority lines take scarce parts first', () => {
    let s = structuredClone(newGame({ seed: 21 }));
    s.components.irSeeker.contracts = [];
    s.components.irSeeker.stock = 30; // IRIS-T needs 24, Stinger 24
    s = applyAction(s, { type: 'setPriority', line: 'stinger', priority: 'high' });
    const after = endTurn(s);
    expect(after.history[0].output.stinger).toBe(LINES.stinger.baseCapacity);
    expect(after.history[0].output.irist).toBeLessThan(LINES.irist.baseCapacity);
    expect(after.lines.irist.lastLimit).toBe('irSeeker');
  });

  it('easy mode never runs short of components', () => {
    let s = structuredClone(newGame({ seed: 21, difficulty: 'easy' }));
    s.components.srm.stock = 0;
    s.components.srm.contracts = [];
    s = endTurn(s);
    expect(s.history[0].output.pac3).toBe(LINES.pac3.baseCapacity);
  });

  it('supply shocks happen on normal but never on easy', () => {
    const shocks = (difficulty: 'easy' | 'normal') => {
      let s = newGame({ seed: 77, difficulty, months: 48 });
      while (!s.over) s = endTurn(s);
      return s.history.flatMap((h) => h.messages).filter((m) => m.startsWith('Shortage:')).length;
    };
    expect(shocks('easy')).toBe(0);
    expect(shocks('normal')).toBeGreaterThan(0);
  });
});

describe('contracts', () => {
  it('multi-year contracts are cheaper per unit the longer they run', () => {
    let s = newGame({ seed: 1 });
    s = applyAction(s, { type: 'signContract', component: 'srm', qtyPerMonth: 10, months: 12 });
    s = applyAction(s, { type: 'signContract', component: 'srm', qtyPerMonth: 10, months: 36 });
    const [, k12, k36] = s.components.srm.contracts;
    expect(k12.unitPrice).toBeLessThan(COMPONENTS.srm.price);
    expect(k36.unitPrice).toBeLessThan(k12.unitPrice);
  });

  it('spot buys cost more than contracted units and are filled after contracts', () => {
    const base = structuredClone(newGame({ seed: 1, difficulty: 'easy' }));
    for (const c of Object.values(base.components)) c.contracts = [];
    const spot = endTurn(applyAction(base, { type: 'setSpotOrder', component: 'srm', qty: 100 }));
    const contract = endTurn(applyAction(base, { type: 'signContract', component: 'srm', qtyPerMonth: 100, months: 12 }));
    // Same 100 motors delivered, different bill.
    expect(spot.components.srm.lastDelivered).toBeGreaterThanOrEqual(100);
    expect(spot.history[0].spend.components).toBeGreaterThan(contract.history[0].spend.components);
  });

  it('contracts are take-or-pay and backlog when the supplier is short', () => {
    let s = structuredClone(newGame({ seed: 1 }));
    s.components.rfSeeker.contracts = [];
    s = applyAction(s, { type: 'signContract', component: 'rfSeeker', qtyPerMonth: 1000, months: 12 });
    s = endTurn(s);
    const k = s.components.rfSeeker.contracts[0];
    expect(k.monthsLeft).toBe(11);
    expect(k.backlog).toBeGreaterThan(0);
    expect(s.history[0].spend.components).toBeGreaterThan(1000 * k.unitPrice);
  });
});

describe('demand and campaign', () => {
  it('draws on the reserve and records unmet demand when it runs dry', () => {
    let s = structuredClone(newGame({ seed: 4 }));
    s.reserves.sm6.stock = 0;
    s = playTurn(s, [{ type: 'setRun', line: 'sm6', run: 'idle' }]);
    expect(s.reserves.sm6.unmet).toBeGreaterThan(0);
  });

  it('crises give warning before they raise draw', () => {
    for (let seed = 1; seed < 50; seed++) {
      let s = newGame({ seed, months: 48 });
      while (!s.over && !s.crisis) s = endTurn(s);
      if (!s.crisis) continue;
      expect(s.crisis.phase).toBe('warning');
      return;
    }
    throw new Error('no crisis in 49 campaigns');
  });

  it('renewing supply contracts beats doing nothing', () => {
    const renew = (s: GameState): Action[] =>
      COMPONENT_IDS.flatMap((c) => {
        const live = s.components[c].contracts.reduce((t, k) => t + (k.monthsLeft > 1 ? k.qtyPerMonth : 0), 0);
        const need = plannedNeed(s, c);
        return live < need * 0.8 ? [{ type: 'signContract', component: c, qtyPerMonth: Math.ceil(need - live), months: 24 } as Action] : [];
      });
    const avg = (s: GameState) => s.history.reduce((a, h) => a + h.readiness, 0) / s.history.length;
    const idle = runCampaign(123, 48);
    const managed = runCampaign(123, 48, renew);
    expect(idle.history).toHaveLength(48);
    expect(avg(managed)).toBeGreaterThan(avg(idle) + 0.15);
    expect(managed.treasury).toBeGreaterThan(0);
  });

  it('starting stocks cover about a month of baseline need', () => {
    const s = newGame({ seed: 1 });
    expect(s.components.srm.stock).toBeCloseTo(baselineNeed('srm'), 1);
  });
});
