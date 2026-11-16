import { describe, expect, it } from 'vitest';
import {
  AIR_LINES,
  COMPONENTS,
  LINES,
  LINE_IDS,
  NEW_TRANCHE_MATURITY,
  SCENARIOS,
  SUPPLIERS,
  advise,
  applyAction,
  baselineNeed,
  calmDraw,
  campusCrewNeed,
  componentCap,
  costExchange,
  debrief,
  deserialize,
  effectiveCapacity,
  endTurn,
  expansions,
  freeBays,
  newGame,
  playTurn,
  productivity,
  reserveTotal,
  serialize,
  staffing,
  supplierCap,
  validateAction,
  type Action,
  type GameState,
} from '../src/engine';

const resolveAll = (s: GameState): Action[] => s.decisions.map((d) => ({ type: 'resolveDecision', decision: d.id, option: d.fallback }) as Action);

function run(seed: number, months: number, policy: (s: GameState) => Action[] = resolveAll, opts: Partial<Parameters<typeof newGame>[0]> = {}): GameState {
  let s = newGame({ seed, months, ...opts });
  while (!s.over) s = playTurn(s, policy(s));
  return s;
}

describe('determinism and saves', () => {
  it('replays identically from the same seed and actions', () => {
    const plan = (s: GameState): Action[] => [...resolveAll(s), ...(s.month === 2 ? [{ type: 'setRun', line: 'gmlrs', run: 'surge' } as Action] : [])];
    expect(serialize(run(42, 24, plan))).toBe(serialize(run(42, 24, plan)));
  });

  it('diverges with a different seed', () => {
    expect(serialize(run(1, 24))).not.toBe(serialize(run(2, 24)));
  });

  it('never mutates its input', () => {
    const s = newGame({ seed: 7 });
    const before = serialize(s);
    endTurn(s);
    applyAction(s, { type: 'expandLine', line: 'pac3' });
    applyAction(s, { type: 'hire', campus: 'corran', count: 10 });
    expect(serialize(s)).toBe(before);
  });

  it('round-trips through save and load, and rejects old or broken saves', () => {
    const s = run(9, 6);
    expect(deserialize(serialize(s))).toEqual(s);
    expect(deserialize('not json')).toBeNull();
    expect(deserialize(JSON.stringify({ version: 1 }))).toBeNull();
  });

  it('every scenario and difficulty plays a full campaign', () => {
    for (const scenario of Object.keys(SCENARIOS) as (keyof typeof SCENARIOS)[]) {
      for (const difficulty of ['easy', 'normal', 'hard'] as const) {
        const s = run(5, 24, resolveAll, { scenario, difficulty });
        expect(s.over).toBe(true);
        expect(Number.isFinite(s.treasury)).toBe(true);
        for (const id of LINE_IDS) expect(reserveTotal(s.reserves[id])).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('plants, bays and lines', () => {
  it('new capacity starts near 30% and ramps to full', () => {
    let s = newGame({ seed: 3 });
    const base = effectiveCapacity(s.lines.pac3);
    s = applyAction(s, { type: 'expandLine', line: 'pac3' });
    const step = LINES.pac3.baseCapacity * 0.25;
    expect(effectiveCapacity(s.lines.pac3)).toBeCloseTo(base + step * NEW_TRANCHE_MATURITY);
    for (let i = 0; i < 12; i++) s = endTurn(s);
    expect(effectiveCapacity(s.lines.pac3)).toBeCloseTo(base + step);
  });

  it('expansion needs a free bay; buildings add bays after construction', () => {
    let s = newGame({ seed: 3, difficulty: 'easy' });
    s = { ...s, treasury: 5000 };
    expect(freeBays(s, 'corran')).toBe(2);
    s = applyAction(s, { type: 'expandLine', line: 'pac3' });
    s = applyAction(s, { type: 'expandLine', line: 'sm6' });
    expect(validateAction(s, { type: 'expandLine', line: 'pac3' })).toMatch(/No free bay/);
    s = applyAction(s, { type: 'buildBays', campus: 'corran' });
    expect(validateAction(s, { type: 'buildBays', campus: 'corran' })).toMatch(/already under construction/);
    for (let i = 0; i < 6; i++) s = playTurn(s, resolveAll(s));
    expect(freeBays(s, 'corran')).toBe(4);
  });

  it('retooling moves a bay between lines on the same campus, after a delay', () => {
    let s = { ...newGame({ seed: 3 }), treasury: 5000 };
    s = applyAction(s, { type: 'expandLine', line: 'tamir' });
    expect(validateAction(s, { type: 'retoolBay', from: 'tamir', to: 'pac3' })).toMatch(/same campus/);
    s = applyAction(s, { type: 'retoolBay', from: 'tamir', to: 'irist' });
    expect(expansions(s.lines.tamir)).toBe(0);
    expect(expansions(s.lines.irist)).toBe(0);
    s = playTurn(s, resolveAll(s));
    s = playTurn(s, resolveAll(s));
    expect(expansions(s.lines.irist)).toBe(1);
  });

  it('upgrades install over a few months: automation cuts crew needs', () => {
    let s = { ...newGame({ seed: 3 }), treasury: 5000 };
    const before = campusCrewNeed(s, 'ashford');
    s = applyAction(s, { type: 'upgradeLine', line: 'shell155', kind: 'automation' });
    expect(validateAction(s, { type: 'upgradeLine', line: 'shell155', kind: 'quality' })).toMatch(/already being installed/);
    for (let i = 0; i < 3; i++) s = playTurn(s, resolveAll(s));
    expect(s.lines.shell155.upgrades.automation).toBe(1);
    expect(campusCrewNeed(s, 'ashford')).toBeLessThan(before);
  });

  it('the learning curve raises productivity with cumulative output', () => {
    const s = newGame({ seed: 3 });
    const p0 = productivity(s.lines.gmlrs);
    const later = run(3, 24);
    expect(productivity(later.lines.gmlrs)).toBeGreaterThan(p0);
    expect(productivity(later.lines.gmlrs)).toBeLessThanOrEqual(1.3);
  });

  it('surge builds more and wears the line; idle builds nothing', () => {
    const base = newGame({ seed: 11, difficulty: 'easy' });
    const normal = endTurn(base);
    const surge = playTurn(base, [{ type: 'setRun', line: 'shell155', run: 'surge' }]);
    const idle = playTurn(base, [{ type: 'setRun', line: 'shell155', run: 'idle' }]);
    expect(surge.lines.shell155.last.output + surge.lines.shell155.last.quarantined).toBeGreaterThan(normal.lines.shell155.last.output);
    expect(surge.lines.shell155.wear).toBeGreaterThan(normal.lines.shell155.wear);
    expect(idle.lines.shell155.last.output).toBe(0);
  });

  it('worn lines quarantine batches; rework recovers most of them', () => {
    let s = structuredClone(newGame({ seed: 5, difficulty: 'easy' }));
    s.lines.gmlrs.wear = 100;
    let found = false;
    for (let i = 0; i < 12 && !found; i++) {
      s = playTurn(s, [{ type: 'setRun', line: 'gmlrs', run: 'surge' }]);
      found = s.lines.gmlrs.quarantine.length > 0;
    }
    expect(found).toBe(true);
    const held = s.lines.gmlrs.quarantine.reduce((a, q) => a + q.qty, 0);
    const before = s.reserves.gmlrs.stock;
    s = applyAction({ ...s, treasury: 5000 }, { type: 'reworkQuarantine', line: 'gmlrs' });
    expect(s.reserves.gmlrs.stock - before).toBe(Math.round(held * 0.8));
    expect(s.lines.gmlrs.quarantine).toHaveLength(0);
  });
});

describe('workforce', () => {
  it('hires are trainees until training ends', () => {
    let s = { ...newGame({ seed: 4, difficulty: 'normal' }), treasury: 5000 };
    const w0 = s.campuses.ashford.workers;
    s = applyAction(s, { type: 'hire', campus: 'ashford', count: 100 });
    expect(s.campuses.ashford.trainees[0].count).toBe(100);
    s = playTurn(s, resolveAll(s));
    expect(s.campuses.ashford.workers).toBeLessThan(w0 + 100);
    for (let i = 0; i < 3; i++) s = playTurn(s, resolveAll(s));
    expect(s.campuses.ashford.trainees).toHaveLength(0);
    expect(s.campuses.ashford.workers).toBeGreaterThan(w0 + 50);
  });

  it('cannot hire more than the local pool', () => {
    const s = newGame({ seed: 4 });
    expect(validateAction(s, { type: 'hire', campus: 'northgate', count: 10_000 })).toMatch(/hiring pool/);
  });

  it('understaffed campuses produce less', () => {
    const s = structuredClone(newGame({ seed: 4, difficulty: 'easy' }));
    s.campuses.ashford.workers = Math.round(s.campuses.ashford.workers / 2);
    expect(staffing(s, 'ashford')).toBeLessThan(0.6);
    const after = endTurn(s);
    expect(after.lines.shell155.last.output).toBeLessThan(LINES.shell155.baseCapacity * 0.6);
    expect(after.lines.shell155.last.limit).toBe('crew');
  });

  it('a strike cuts output at its campus', () => {
    const s = structuredClone(newGame({ seed: 4, difficulty: 'easy' }));
    s.campuses.northgate.strikeMonths = 2;
    const after = endTurn(s);
    expect(after.lines.tamir.last.output).toBeLessThan(LINES.tamir.baseCapacity * 0.4);
    expect(after.lines.tamir.last.limit).toBe('strike');
  });
});

describe('supply chain', () => {
  it('a shortage slows every line that uses the part, and only those', () => {
    const s = structuredClone(newGame({ seed: 21 }));
    s.components.srm.stock = 0;
    s.components.srm.contracts = [];
    const after = endTurn(s);
    for (const id of LINE_IDS) {
      if (LINES[id].bom.srm) {
        expect(after.lines[id].last.output).toBe(0);
        expect(after.lines[id].last.limit).toBe('srm');
      }
    }
    expect(after.lines.shell155.last.output).toBeGreaterThan(0);
  });

  it('substitutes keep a starved line running, but the rounds are degraded', () => {
    let s = structuredClone(newGame({ seed: 21 }));
    s.components.irSeeker.stock = 0;
    s.components.irSeeker.contracts = [];
    s = applyAction(s, { type: 'setSubstituteAll', component: 'irSeeker', on: true });
    const after = endTurn(s);
    expect(after.lines.stinger.last.output + after.lines.irist.last.output).toBeGreaterThan(0);
    expect([...after.lines.stinger.last.usedSubstitutes, ...after.lines.irist.last.usedSubstitutes]).toContain('irSeeker');
    expect(after.reserves.stinger.degraded + after.reserves.irist.degraded).toBeGreaterThan(0);
  });

  it('high-priority lines take scarce parts first', () => {
    let s = structuredClone(newGame({ seed: 21 }));
    s.components.irSeeker.contracts = [];
    s.components.irSeeker.stock = 30;
    s = applyAction(s, { type: 'setPriority', line: 'stinger', priority: 'high' });
    const after = endTurn(s);
    expect(after.lines.stinger.last.output).toBe(LINES.stinger.baseCapacity);
    expect(after.lines.irist.last.output).toBeLessThan(LINES.irist.baseCapacity);
  });

  it('second sources must be qualified before they ship or take contracts', () => {
    let s = { ...newGame({ seed: 8 }), treasury: 5000 };
    expect(supplierCap(s, 'vantor')).toBe(0);
    expect(validateAction(s, { type: 'signContract', component: 'srm', supplier: 'vantor', qtyPerMonth: 10, months: 12 })).toMatch(/not qualified/);
    const capBefore = componentCap(s, 'srm');
    s = applyAction(s, { type: 'qualifySupplier', supplier: 'vantor' });
    for (let i = 0; i < SUPPLIERS.vantor.qualifyMonths; i++) s = playTurn(s, resolveAll(s));
    expect(s.suppliers.vantor.qualified).toBe(true);
    expect(componentCap(s, 'srm')).toBeGreaterThan(capBefore);
    expect(validateAction(s, { type: 'signContract', component: 'srm', supplier: 'vantor', qtyPerMonth: 10, months: 12 })).toBeNull();
  });

  it('embargoes stop a foreign supplier entirely', () => {
    const s = structuredClone(newGame({ seed: 8 }));
    s.suppliers.karskmetals.embargoMonths = 3;
    expect(supplierCap(s, 'karskmetals')).toBe(0);
    const after = endTurn(s);
    expect(after.suppliers.karskmetals.lastDelivered).toBe(0);
  });

  it('easy mode never runs short of components', () => {
    let s = structuredClone(newGame({ seed: 21, difficulty: 'easy' }));
    s.components.srm.stock = 0;
    s.components.srm.contracts = [];
    s = endTurn(s);
    expect(s.lines.pac3.last.output).toBe(LINES.pac3.baseCapacity);
  });

  it('contracts: longer is cheaper, take-or-pay, cancellation costs a penalty', () => {
    let s = { ...newGame({ seed: 1 }), treasury: 5000 };
    s = applyAction(s, { type: 'signContract', component: 'srm', supplier: 'kestrel', qtyPerMonth: 10, months: 12 });
    s = applyAction(s, { type: 'signContract', component: 'srm', supplier: 'kestrel', qtyPerMonth: 10, months: 36 });
    const [, k12, k36] = s.components.srm.contracts;
    expect(k12.unitPrice).toBeLessThan(COMPONENTS.srm.price);
    expect(k36.unitPrice).toBeLessThan(k12.unitPrice);
    const t = s.treasury;
    s = applyAction(s, { type: 'cancelContract', component: 'srm', contract: k36.id });
    expect(s.treasury).toBeLessThan(t);
    expect(s.components.srm.contracts.some((k) => k.id === k36.id)).toBe(false);
  });

  it('spot buys cost more than contracted units', () => {
    const base = structuredClone(newGame({ seed: 1, difficulty: 'easy' }));
    for (const c of Object.values(base.components)) c.contracts = [];
    const spot = endTurn(applyAction(base, { type: 'setSpotOrder', component: 'srm', qty: 100 }));
    const contract = endTurn(applyAction(base, { type: 'signContract', component: 'srm', supplier: 'kestrel', qtyPerMonth: 100, months: 12 }));
    expect(spot.history[0].ledger.components).toBeGreaterThan(contract.history[0].ledger.components);
  });

  it('starting stock holds a strategic stockpile of critical materials', () => {
    const s = newGame({ seed: 1 });
    expect(s.components.criticalMaterials.stock).toBeCloseTo(baselineNeed('criticalMaterials') * 4, 0);
  });
});

describe('demand, doctrine and the cost exchange', () => {
  it('threats draw interceptors and count leakers', () => {
    const s = run(4, 6);
    const arrived = s.history.reduce((a, h) => a + Object.values(h.threats).reduce((b, t) => b + t.arrived, 0), 0);
    expect(arrived).toBeGreaterThan(100);
    for (const id of AIR_LINES) expect(s.reserves[id].used).toBeGreaterThan(0);
  });

  it('an empty reserve means more leakers', () => {
    const empty = structuredClone(newGame({ seed: 4, difficulty: 'easy' }));
    for (const id of AIR_LINES) {
      empty.reserves[id].stock = 0;
      empty.lines[id].run = 'idle';
    }
    const full = newGame({ seed: 4, difficulty: 'easy' });
    const leaks = (s: GameState) => Object.values(endTurn(s).history[0].threats).reduce((a, t) => a + t.leaked, 0);
    expect(leaks(empty)).toBeGreaterThan(leaks(full) * 3);
  });

  it('conserve doctrine keeps PAC-3 and SM-6 off drones and rockets', () => {
    const s = structuredClone(newGame({ seed: 6, difficulty: 'easy' }));
    for (const id of ['stinger', 'tamir', 'irist'] as const) {
      s.reserves[id].stock = 0;
      s.lines[id].run = 'idle';
    }
    const loose = endTurn(s);
    const strict = endTurn(applyAction(s, { type: 'setDoctrine', conserve: true }));
    expect(loose.reserves.pac3.engaged.drone ?? 0).toBeGreaterThan(0);
    expect(strict.reserves.pac3.engaged.drone ?? 0).toBe(0);
    expect(strict.reserves.sm6.engaged.rocket ?? 0).toBe(0);
  });

  it('records a cost exchange per interceptor', () => {
    const s = run(4, 12);
    const rows = costExchange(s);
    expect(rows.length).toBe(AIR_LINES.length);
    for (const r of rows) {
      expect(r.spend).toBeCloseTo(r.used * LINES[r.line].unitCost);
      expect(r.stopped).toBeGreaterThanOrEqual(0);
    }
    // Tamir against rockets is cheap; PAC-3 is expensive per shot.
    const tamir = rows.find((r) => r.line === 'tamir')!;
    const pac3 = rows.find((r) => r.line === 'pac3')!;
    expect(tamir.spend / tamir.used).toBeLessThan(pac3.spend / pac3.used);
  });

  it('crises give two months of warning, and intel forecasts the rise', () => {
    for (let seed = 1; seed < 60; seed++) {
      let s = newGame({ seed });
      while (!s.over && !s.crisis) s = playTurn(s, resolveAll(s));
      if (!s.crisis) continue;
      expect(s.crisis.phase).toBe('warning');
      const id = s.crisis.family === 'air' ? 'irist' : 'shell155';
      const f = s.forecast.draw[id];
      expect(f[2]).toBeGreaterThanOrEqual(f[0]);
      return;
    }
    throw new Error('no crisis in 59 campaigns');
  });

  it('calm draw sits below base capacity on every line', () => {
    const s = newGame({ seed: 1 });
    for (const id of LINE_IDS) expect(calmDraw(s, id)).toBeLessThan(LINES[id].baseCapacity);
  });

  it('the adaptive opponent only appears on hard', () => {
    const normal = run(12, 18, resolveAll, { difficulty: 'normal' });
    const hard = run(12, 18, resolveAll, { difficulty: 'hard', scenario: 'longWar' });
    expect(normal.opponentFocus).toBeNull();
    expect(hard.history.length).toBeGreaterThan(0);
    expect(hard.opponentFocus === null || typeof hard.opponentFocus === 'string').toBe(true);
  });
});

describe('partners, decisions and money', () => {
  it('accepting a tender creates a delivery contract that earns revenue', () => {
    let s = newGame({ seed: 2, difficulty: 'easy' });
    const t = s.tenders[0];
    s = applyAction(s, { type: 'acceptTender', tender: t.id });
    expect(s.tenders.some((x) => x.id === t.id)).toBe(false);
    expect(s.partnerContracts).toHaveLength(1);
    s = endTurn(s);
    expect(s.lines[t.line].last.toPartners).toBeGreaterThan(0);
    expect(s.history[0].ledger.revenue).toBeGreaterThan(0);
  });

  it('decisions fall back to their default when ignored', () => {
    for (let seed = 1; seed < 200; seed++) {
      let s = newGame({ seed, difficulty: 'hard' });
      while (!s.over && s.decisions.length === 0) s = endTurn(s);
      if (!s.decisions.length) continue;
      const d = s.decisions[0];
      s = endTurn(s);
      expect(s.decisions.some((x) => x.id === d.id)).toBe(false);
      return;
    }
    throw new Error('no decision appeared');
  });

  it('a fiscal-year review resets the appropriation every 12 months', () => {
    const s = run(3, 25, resolveAll, { difficulty: 'easy' });
    expect(s.reviews).toHaveLength(2);
    expect(s.reviews[0].year).toBe(1);
    expect(s.appropriation).toBe(s.reviews[1].newAppropriation);
  });

  it('confidence collapse ends the campaign early', () => {
    const s = structuredClone(newGame({ seed: 3 }));
    s.confidence = 0.5;
    for (const id of LINE_IDS) {
      s.reserves[id].stock = 0;
      s.lines[id].run = 'idle';
    }
    const after = endTurn(s);
    expect(after.over).toBe(true);
    expect(after.outcome).toBe('dismissed');
  });

  it('supplemental requests are answered the next month and then cool down', () => {
    let s = newGame({ seed: 3 });
    s = applyAction(s, { type: 'requestSupplemental' });
    expect(validateAction(s, { type: 'requestSupplemental' })).toMatch(/already/);
    s = endTurn(s);
    expect(s.mods.supplementalPending).toBe(false);
    expect(s.mods.supplementalCooldown).toBeGreaterThan(0);
  });
});

describe('advisor and debrief', () => {
  it('suggests contracts when coverage runs out, and its one-click actions are valid', () => {
    const s = structuredClone(newGame({ seed: 3 }));
    s.components.rfSeeker.contracts = [];
    const tips = advise(s);
    const tip = tips.find((t) => t.id === 'contract-rfSeeker');
    expect(tip?.action).toBeDefined();
    for (const t of tips) if (t.action) expect(validateAction(s, t.action)).toBeNull();
  });

  it('following the advisor beats doing nothing on normal', () => {
    const follow = (s: GameState): Action[] => [...resolveAll(s), ...advise(s).filter((t) => t.action && t.tone !== 'info').map((t) => t.action!)];
    const avg = (s: GameState) => s.history.reduce((a, h) => a + h.readiness, 0) / s.history.length;
    const idle = run(123, 36);
    const advised = run(123, 36, follow);
    expect(avg(advised)).toBeGreaterThan(avg(idle));
    expect(debrief(advised).score).toBeGreaterThanOrEqual(debrief(idle).score);
  });

  it('the debrief grades six areas into a score out of 1000', () => {
    const d = debrief(run(3, 12));
    expect(d.grades).toHaveLength(6);
    expect(d.score).toBeGreaterThanOrEqual(0);
    expect(d.score).toBeLessThanOrEqual(1000);
  });
});

