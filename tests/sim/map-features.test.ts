// Release 19.0b: map variety from the seed (docs/depth.md).
import { describe, expect, it } from 'vitest';
import { featureLines, makeFeatures, threatShare } from '../../src/sim/features';
import { mandateGoals } from '../../src/sim/mandate';
import { migrate, newSim } from '../../src/sim/setup';
import type { SimState } from '../../src/sim/types';
import { FIGHTING_REGIONS, RECIPES, REGIONS, SITE_BY_ID, type MaterialId } from '../../src/sim/world';
import DEPTH from '../../src/sim/tuning/depth.json';

const capOf = (s: SimState, site: string, m: MaterialId) => s.sites[site].processes.filter((p) => RECIPES[p.recipe].output === m).reduce((a, p) => a + p.capacity, 0);

describe('map features', () => {
  it('gives the same features for the same seed, and none on the classic map', () => {
    expect(makeFeatures(77)).toEqual(makeFeatures(77));
    expect(newSim({ seed: 1, world: 77 }).features).toEqual(makeFeatures(77));
    expect(newSim({ seed: 1 }).features).toBeUndefined();
  });

  it('gives every generated country two or three features', () => {
    for (let w = 1; w <= 200; w++) {
      const n = Object.keys(makeFeatures(w)).length;
      expect(n, `world ${w}`).toBeGreaterThanOrEqual(2);
      expect(n, `world ${w}`).toBeLessThanOrEqual(3);
    }
  });

  it('closes the chokepoint rivals and moves their output to the survivor, which starts qualified', () => {
    const w = [...Array(50).keys()].map((i) => i + 1).find((i) => makeFeatures(i).chokepoint)!;
    const s = newSim({ seed: 1, world: w });
    const c = s.features!.chokepoint!;
    const classic = newSim({ seed: 1 });
    const total = [c.site, ...c.closed].reduce((a, id) => a + capOf(classic, id, c.material), 0);
    for (const id of c.closed) expect(capOf(s, id, c.material)).toBe(0);
    expect(capOf(s, c.site, c.material)).toBeCloseTo(total, 6);
    expect(s.sites[c.site].qualified).toBe(true);
  });

  it('cuts home output of a relied-on part, raises foreign makers, and qualifies them', () => {
    const w = [...Array(200).keys()].map((i) => i + 1).find((i) => makeFeatures(i).foreign)!;
    const s = newSim({ seed: 1, world: w });
    const classic = newSim({ seed: 1 });
    const m = s.features!.foreign!.material;
    let home = 0;
    let abroad = 0;
    for (const id of Object.keys(s.sites)) {
      const cap = capOf(s, id, m);
      if (!cap && !capOf(classic, id, m)) continue;
      if (SITE_BY_ID[id].owner === 'foreign') {
        abroad += cap;
        expect(s.sites[id].qualified).toBe(true);
      } else {
        home += cap;
        expect(cap).toBeCloseTo(capOf(classic, id, m) * DEPTH.map.domesticCut, 6);
      }
    }
    expect(abroad).toBeGreaterThan(0);
    expect(home + abroad).toBeGreaterThan(0);
  });

  it('adds supply independence to the mandate on a foreign-reliance map, with weights that still sum to 1', () => {
    const w = [...Array(200).keys()].map((i) => i + 1).find((i) => makeFeatures(i).foreign)!;
    const goals = mandateGoals(newSim({ seed: 1, world: w }));
    expect(goals.some((g) => g.id === 'independence')).toBe(true);
    expect(goals.reduce((a, g) => a + g.weight, 0)).toBeCloseTo(1, 9);
    expect(mandateGoals(newSim({ seed: 1 })).some((g) => g.id === 'independence')).toBe(false);
  });

  it('leaves foreign reliance out under sanctions', () => {
    for (let w = 1; w <= 100; w++) expect(makeFeatures(w, 'sanctions').foreign).toBeUndefined();
  });

  it('keeps the air threat shared out in full on every coast', () => {
    for (const coast of ['long', 'short', undefined] as const) {
      const s = { features: coast ? { coast } : {} } as unknown as SimState;
      const sum = FIGHTING_REGIONS.reduce((a, r) => a + threatShare(s, r, REGIONS[r].threatShare), 0);
      expect(sum, String(coast)).toBeCloseTo(1, 9);
    }
  });

  it('describes each feature in one short and one long line', () => {
    const f = makeFeatures(5);
    const lines = featureLines(f);
    expect(lines).toHaveLength(Object.keys(f).length);
    for (const l of lines) expect(l.short.length).toBeLessThan(60);
  });

  it('keeps an older save of a generated country without features', () => {
    const s = newSim({ seed: 1, world: 9 });
    const old = JSON.parse(JSON.stringify(s));
    delete old.features;
    const loaded = migrate(old);
    expect(loaded.features).toBeUndefined();
    expect(mandateGoals(loaded).some((g) => g.id === 'independence')).toBe(false);
  });
});
