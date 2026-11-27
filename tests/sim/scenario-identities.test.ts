// Release 19.0c: scenario identities (docs/depth.md).
import { describe, expect, it } from 'vitest';
import { apply } from '../../src/sim/actions';
import { mandateGoals } from '../../src/sim/mandate';
import { budgetDeal, brokerBuy, frontCover, pressure, rebuildCondition, scenarioMonth } from '../../src/sim/scenarios';
import { newSim } from '../../src/sim/setup';
import { advanceDays, feed, openCampaign } from '../../src/sim/tick';
import { SITES } from '../../src/sim/world';
import DEPTH from '../../src/sim/tuning/depth.json';

const T = DEPTH.scenarios;
const quiet = () => {};

describe('War footing', () => {
  it('moves the front each month by the step times the gap in artillery cover', () => {
    const s = openCampaign(newSim({ seed: 1, scenario: 'warFooting' }));
    const c = frontCover(s);
    scenarioMonth(s, quiet);
    expect(s.war!.front).toBeCloseTo(Math.max(-1, Math.min(1, T.war.frontStep * (c - 1))), 9);
  });

  it('sends an air surge at the thinnest region every surge gap, for two weeks', () => {
    let s = openCampaign(newSim({ seed: 1, scenario: 'warFooting' }));
    const first = s.war!.nextSurge;
    expect(first).toBe(s.day + T.war.surgeGap);
    s = advanceDays(s, first - s.day + 1);
    const w = s.war!;
    expect(w.surgeRegion).not.toBeNull();
    expect(w.surgeUntil - (first)).toBe(T.war.surgeDays);
    expect(pressure(s, w.surgeRegion!, 'air')).toBe(T.war.surgeMult);
    expect(w.nextSurge).toBe(first + T.war.surgeGap);
  });

  it('presses the Marches harder while the front falls back', () => {
    const s = openCampaign(newSim({ seed: 1, scenario: 'warFooting' }));
    s.war!.front = -0.8;
    expect(pressure(s, 'east', 'land')).toBe(T.war.frontLossDraw);
    s.war!.front = 0.8;
    expect(pressure(s, 'east', 'land')).toBe(T.war.frontGainDraw);
    expect(pressure(s, 'north', 'land')).toBe(1);
  });

  it('has no front outside War footing', () => {
    expect(newSim({ seed: 1 }).war).toBeUndefined();
  });
});

describe('Sanctions', () => {
  it('starts each nation at a seed-set relation, banned for the longest term', () => {
    const s = newSim({ seed: 3, scenario: 'sanctions' });
    expect(Object.values(s.diplomacy.nations).sort((a, b) => b - a).slice(0, 3)).toEqual(T.sanctions.startRelations);
    for (const d of SITES) if (d.owner === 'foreign') expect(s.sites[d.id].embargoDays).toBe(T.sanctions.maxBan);
    expect(newSim({ seed: 3, scenario: 'sanctions' }).diplomacy.nations).toEqual(s.diplomacy.nations);
  });

  it('lifts a nation’s ban the month its relations reach the mark', () => {
    const s = openCampaign(newSim({ seed: 3, scenario: 'sanctions' }));
    const nation = Object.keys(s.diplomacy.nations)[0];
    s.diplomacy.nations[nation] = T.sanctions.liftAt;
    scenarioMonth(s, quiet);
    for (const d of SITES) if (d.owner === 'foreign') expect(s.sites[d.id].embargoDays === 0, d.id).toBe(d.nation === nation);
  });

  it('offers a broker while a ban holds, and books the premium as grey waste', () => {
    const s = openCampaign(newSim({ seed: 3, scenario: 'sanctions' }));
    scenarioMonth(s, quiet);
    const d = s.strategy.decisions.find((x) => x.kind === 'broker')!;
    expect(d).toBeDefined();
    const before = s.treasury;
    brokerBuy(s, d, quiet, (v) => (s.treasury -= v), () => {});
    expect(s.treasury).toBeLessThan(before);
    expect(s.month.waste?.grey ?? 0).toBeGreaterThan(0);
  });
});

describe('Rebuild', () => {
  it('starts state plants worn, from the seed, within the range', () => {
    const s = newSim({ seed: 2, scenario: 'rebuild' });
    for (const d of SITES) {
      if (d.owner !== 'state' || !s.sites[d.id].processes.length || d.kind === 'plot') continue;
      const c = s.sites[d.id].condition;
      expect(c).toBe(rebuildCondition(2, d.id));
      expect(c).toBeGreaterThanOrEqual(T.rebuild.startCondition[0]);
      expect(c).toBeLessThanOrEqual(T.rebuild.startCondition[1]);
    }
  });

  it('brings a replaced plant back new, with more capacity, and wearing no faster than normal', () => {
    let s = { ...openCampaign(newSim({ seed: 2, scenario: 'rebuild' })), treasury: 50000 };
    const id = SITES.find((d) => d.owner === 'state' && d.kind === 'arsenal')!.id;
    const cap = s.sites[id].processes.map((p) => p.capacity);
    s = apply(s, { type: 'replacePlant', site: id });
    expect(s.sites[id].status).toBe('building');
    s = advanceDays(s, T.rebuild.replaceDays + 1);
    expect(s.sites[id].status).toBe('active');
    s.sites[id].processes.forEach((p, i) => expect(p.capacity).toBeCloseTo(cap[i] * (1 + T.rebuild.replaceCapacity), 6));
    expect(s.rebuild!.replaced).toContain(id);
    s.sites[id].condition = 40;
    s = advanceDays(s, 10);
    // Only the ordinary running wear applies (normal running gains a little each day).
    expect(s.sites[id].condition).toBeGreaterThanOrEqual(40 - 10 * 0.12);
  });

  it('wears a plant below the mark faster than one above it', () => {
    let s = openCampaign(newSim({ seed: 2, scenario: 'rebuild' }));
    const id = SITES.find((d) => d.owner === 'state' && d.kind === 'arsenal')!.id;
    s.sites[id].condition = 40;
    s = advanceDays(s, 20);
    expect(s.sites[id].condition).toBeLessThan(40 + 20 * 0.02);
  });
});

describe('Peacetime budget round', () => {
  it('moves only that year’s goal weights, which still sum to 1', () => {
    const s = openCampaign(newSim({ seed: 1 }));
    const year0 = mandateGoals(s, 0);
    budgetDeal(s, 1, 'treasury', feed);
    const y1 = mandateGoals(s, 1);
    expect(y1.reduce((a, g) => a + g.weight, 0)).toBeCloseTo(1, 9);
    expect(y1.find((g) => g.id === 'readiness')!.weight).toBeLessThan(year0.find((g) => g.id === 'readiness')!.weight);
    expect(mandateGoals(s, 0)).toEqual(year0);
  });

  it('gives the hawks’ money and keeps the weights', () => {
    const s = openCampaign(newSim({ seed: 1 }));
    const before = s.appropriation;
    budgetDeal(s, 1, 'hawks', feed);
    expect(s.appropriation).toBe(Math.round(before * (1 + T.peacetime.hawksMoney)));
    expect(mandateGoals(s, 1)).toEqual(mandateGoals(s, 0));
  });

  it('offers the round once a fiscal year, in Peacetime only', () => {
    let s = openCampaign(newSim({ seed: 1 }));
    s = advanceDays(s, 13 * 30);
    const rounds = s.strategy.decisions.filter((d) => d.kind === 'budgetRound').length + Object.keys(s.budgetDeals ?? {}).length;
    expect(rounds).toBe(1);
    const w = advanceDays(openCampaign(newSim({ seed: 1, scenario: 'warFooting' })), 13 * 30);
    expect(w.strategy.decisions.some((d) => d.kind === 'budgetRound')).toBe(false);
  });
});
