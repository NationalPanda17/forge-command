import { describe, expect, it } from 'vitest';
import {
  COMPONENTS,
  INVEST_STEP,
  LEAD_TIME,
  SUPPLIERS,
  applyAction,
  baselineNeed,
  contractPrice,
  endTurn,
  inTransit,
  newGame,
  playTurn,
  supplierCap,
  validateAction,
  type Action,
  type GameState,
} from '../src/engine';

const resolveAll = (s: GameState): Action[] => s.decisions.map((d) => ({ type: 'resolveDecision', decision: d.id, option: d.fallback }) as Action);

describe('shipping and lead times', () => {
  it('foreign deliveries go to sea and arrive later; domestic ones arrive at once', () => {
    const s = endTurn(newGame({ seed: 1 }));
    // Sable (Ostrel) ships microelectronics with a 2-month lead time.
    expect(LEAD_TIME[SUPPLIERS.sable.nation]).toBe(2);
    const sea = s.shipments.filter((sh) => sh.supplier === 'sable');
    expect(sea.length).toBeGreaterThan(0);
    expect(Math.min(...sea.map((sh) => sh.arrive))).toBeGreaterThan(s.month - 1);
    expect(inTransit(s, 'microelectronics')).toBeGreaterThan(0);
    expect(s.shipments.some((sh) => sh.supplier === 'kestrel')).toBe(false);
  });

  it('a new game starts with foreign shipments already on the water', () => {
    const s = newGame({ seed: 1 });
    expect(inTransit(s, 'criticalMaterials')).toBeGreaterThan(0);
    expect(inTransit(s, 'srm')).toBe(0);
  });
});

describe('feedstock markets', () => {
  it('a feedstock disruption cuts what suppliers can ship', () => {
    const s = structuredClone(newGame({ seed: 2 }));
    const before = supplierCap(s, 'kestrel');
    s.tier2.perchlorate.availability = 0.5;
    expect(supplierCap(s, 'kestrel')).toBeCloseTo(before * 0.5);
    expect(supplierCap(s, 'halden')).toBeGreaterThan(0);
  });

  it('easy mode keeps markets steady', () => {
    let s = structuredClone(newGame({ seed: 2, difficulty: 'easy' }));
    s.tier2.wafers.availability = 0.4;
    s.tier2.wafers.priceIndex = 1.8;
    s = endTurn(s);
    expect(s.tier2.wafers.availability).toBe(1);
    expect(s.components.microelectronics.priceIndex).toBe(1);
  });

  it('contracts lock the market price at signing; spot buys pay today’s price', () => {
    const cheap = newGame({ seed: 3 });
    const dear = structuredClone(cheap);
    dear.components.srm.priceIndex = 1.5;
    expect(contractPrice(dear, 'kestrel', 24)).toBeCloseTo(contractPrice(cheap, 'kestrel', 24) * 1.5);
    let s = applyAction(cheap, { type: 'signContract', component: 'srm', supplier: 'kestrel', qtyPerMonth: 50, months: 24 });
    const locked = s.components.srm.contracts.at(-1)!.unitPrice;
    s = structuredClone(s);
    s.tier2.perchlorate.priceIndex = 1.9;
    s = endTurn(s);
    expect(s.components.srm.contracts.find((k) => k.qtyPerMonth === 50)!.unitPrice).toBe(locked);
    expect(locked).toBeLessThan(COMPONENTS.srm.price);
  });
});

describe('shelf life', () => {
  it('motors and energetics far beyond need age out; critical materials keep', () => {
    const s = structuredClone(newGame({ seed: 4, difficulty: 'easy' }));
    s.components.srm.stock = baselineNeed('srm') * 20;
    s.components.criticalMaterials.stock = baselineNeed('criticalMaterials') * 20;
    const after = endTurn(s);
    expect(after.components.srm.lastAged).toBeGreaterThan(0);
    expect(after.components.criticalMaterials.lastAged).toBe(0);
  });
});

describe('supplier investment', () => {
  it('paying for a supplier expansion raises its capacity after it is built', () => {
    let s = { ...newGame({ seed: 5 }), treasury: 5000 };
    expect(validateAction(s, { type: 'investSupplier', supplier: 'vantor' })).toMatch(/Qualify/);
    const before = supplierCap(s, 'halden') / s.suppliers.halden.capFactor;
    s = applyAction(s, { type: 'investSupplier', supplier: 'halden' });
    expect(validateAction(s, { type: 'investSupplier', supplier: 'halden' })).toMatch(/already being built/);
    for (let i = 0; i < 8; i++) s = playTurn(s, resolveAll(s));
    expect(s.suppliers.halden.capBonus).toBe(1);
    const after = supplierCap(s, 'halden') / s.suppliers.halden.capFactor / s.tier2.wafers.availability;
    expect(after).toBeCloseTo(before * (1 + INVEST_STEP), 0);
  });
});
