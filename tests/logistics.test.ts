import { describe, expect, it } from 'vitest';
import {
  CRISES,
  THEATERS,
  THEATER_IDS,
  applyAction,
  depotTotal,
  endTurn,
  expectedTheaterDraw,
  loanQty,
  nationalStock,
  newGame,
  reserveTotal,
  validateAction,
  type GameState,
} from '../src/engine';

describe('regions and depots', () => {
  it('a new campaign spreads stock across the regional depots', () => {
    const s = newGame({ seed: 1 });
    for (const th of THEATER_IDS) expect(depotTotal(s, th, 'tamir')).toBeGreaterThan(0);
    // Land fires only sit where the land war is.
    expect(depotTotal(s, 'isles', 'shell155')).toBe(0);
    expect(depotTotal(s, 'east', 'shell155')).toBeGreaterThan(0);
    // National stock counts every depot.
    expect(nationalStock(s, 'tamir')).toBeGreaterThan(reserveTotal(s.reserves.tamir));
  });

  it('a crisis concentrates its draw on its own region', () => {
    const s = structuredClone(newGame({ seed: 2 }));
    const def = CRISES.find((c) => c.id === 'skerry')!;
    s.crisis = { id: def.id, name: def.name, family: def.family, theater: def.theater, phase: 'active', monthsLeft: 5, intensity: 1, mix: def.mix, blurb: def.blurb };
    const isles = expectedTheaterDraw(s, 1, 'isles').pac3 / THEATERS.isles.threatShare;
    const coast = expectedTheaterDraw(s, 1, 'coast').pac3 / THEATERS.coast.threatShare;
    expect(isles).toBeGreaterThan(coast * 2);
  });

  it('convoys carry stock to depots and arrive next month', () => {
    let s = structuredClone(newGame({ seed: 3, difficulty: 'easy' }));
    s.theaters.north.depot.tamir = { full: 0, degraded: 0 };
    s = endTurn(s);
    const sent = s.convoys.filter((c) => c.theater === 'north' && c.line === 'tamir');
    expect(sent.length).toBeGreaterThan(0);
    expect(sent[0].arrive).toBe(s.month);
    const before = depotTotal(s, 'north', 'tamir');
    s = endTurn(s);
    expect(depotTotal(s, 'north', 'tamir')).toBeGreaterThanOrEqual(before);
  });

  it('a zero target stops convoys to that region', () => {
    let s = applyAction(newGame({ seed: 3 }), { type: 'setDepotTarget', theater: 'isles', months: 0 });
    s = endTurn(s);
    expect(s.convoys.some((c) => c.theater === 'isles')).toBe(false);
  });

  it('empty depots fall back on a limited, costly airlift from the central reserve', () => {
    const s = structuredClone(newGame({ seed: 4, difficulty: 'easy' }));
    for (const th of THEATER_IDS) s.theaters[th].depot.tamir = { full: 0, degraded: 0 };
    s.reserves.tamir.stock = 1000;
    const after = endTurn(s);
    expect(THEATER_IDS.reduce((a, th) => a + after.theaters[th].lastAirlift, 0)).toBeGreaterThan(0);
    expect(after.history[0].ledger.logistics).toBeGreaterThan(s.transport * 0.004);
  });

  it('more transport costs money and has a ceiling', () => {
    let s = { ...newGame({ seed: 5 }), treasury: 5000 };
    const t0 = s.transport;
    s = applyAction(s, { type: 'buyTransport' });
    expect(s.transport).toBeGreaterThan(t0);
    for (let i = 0; i < 10; i++) s = applyAction(s, { type: 'buyTransport' });
    expect(validateAction(s, { type: 'buyTransport' })).toMatch(/cannot take more/);
  });
});

describe('allies and the rival', () => {
  it('a friendly partner lends rounds now, to be repaid later', () => {
    const s: GameState = structuredClone(newGame({ seed: 6 }));
    expect(validateAction(s, { type: 'requestLoan', partner: 'varenna', line: 'pac3' })).toMatch(/goodwill/);
    s.partners.varenna.goodwill = 70;
    const before = reserveTotal(s.reserves.pac3);
    const after = applyAction(s, { type: 'requestLoan', partner: 'varenna', line: 'pac3' });
    expect(reserveTotal(after.reserves.pac3)).toBe(before + loanQty('pac3'));
    expect(after.partnerContracts.some((c) => c.partner === 'varenna' && c.unitPrice === 0)).toBe(true);
    expect(validateAction(after, { type: 'requestLoan', partner: 'varenna', line: 'pac3' })).toMatch(/will not lend again/);
    expect(validateAction(after, { type: 'requestLoan', partner: 'varenna', line: 'shell155' })).toMatch(/does not stock/);
  });

  it('the rival power grows over time', () => {
    let s = newGame({ seed: 7 });
    for (let i = 0; i < 12; i++) s = endTurn(s);
    expect(s.rival).toBeGreaterThan(100);
  });
});
