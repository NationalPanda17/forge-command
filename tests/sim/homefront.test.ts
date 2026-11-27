// Release 19.1: the home front (docs/homefront.md). Discontent joins workforce, towns and security.
import { describe, expect, it } from 'vitest';
import { apply, validate } from '../../src/sim/actions';
import { attackOdds, cyberLevel, hasPlan } from '../../src/sim/cyber';
import { discontent, hireFactor, HF } from '../../src/sim/homefront';
import { security } from '../../src/sim/security';
import { migrate, newSim } from '../../src/sim/setup';
import { openCampaign } from '../../src/sim/tick';
import { hireRoom, townIndex, townOf } from '../../src/sim/towns';
import type { SimState } from '../../src/sim/types';
import { unionsMonth } from '../../src/sim/unions';
import { CITIES } from '../../src/sim/world';

const start = (): SimState => ({ ...openCampaign(newSim({ seed: 1 })), treasury: 50000 });
const W = HF.workforce;
const town = (id: string) => townIndex(townOf(id));

describe('discontent', () => {
  it('sits at the baseline for a new town, and within 0..1 at the extremes', () => {
    const s = start();
    const t = town('corranWorks');
    expect(discontent(s, t)).toBeCloseTo(HF.discontent.baseline, 3);
    s.unions.towns[t].strength = 95;
    s.communities.mood[t] = 0;
    expect(discontent(s, t)).toBeLessThanOrEqual(1);
    s.unions.towns[t].strength = 5;
    s.communities.mood[t] = 100;
    expect(discontent(s, t)).toBeGreaterThanOrEqual(0);
  });

  it('lowers a plant’s security in an angry town, and leaves it alone at the baseline', () => {
    const s = start();
    const t = town('corranWorks');
    s.unions.towns[t].strength = 40;
    s.communities.mood[t] = 55;
    const base = security(s, 'corranWorks');
    s.unions.towns[t].strength = 80;
    s.communities.mood[t] = 30;
    expect(security(s, 'corranWorks')).toBeLessThan(base);
  });

  it('makes ransomware on the plants likelier when the towns are angry', () => {
    const s = start();
    s.day = 400;
    const calm = attackOdds(s, 'plants');
    for (let i = 0; i < CITIES.length; i++) {
      s.unions.towns[i].strength = 90;
      s.communities.mood[i] = 10;
    }
    expect(attackOdds(s, 'plants')).toBeGreaterThan(calm);
    expect(attackOdds(s, 'rail')).toBeCloseTo(attackOdds(start(), 'rail'), 9);
  });
});

describe('workforce and towns', () => {
  it('lets a resentful town send fewer people to the lines', () => {
    expect(hireFactor(W.hireFull)).toBe(1);
    expect(hireFactor(30)).toBeCloseTo(0.5, 9);
    expect(hireFactor(0)).toBe(W.hireMin);
    const s = start();
    const name = townOf('corranWorks');
    s.towns[town('corranWorks')].pool += 1000;
    const happy = hireRoom(s, name);
    s.communities.mood[town('corranWorks')] = 30;
    expect(hireRoom(s, name)).toBeLessThan(happy);
  });

  it('hardens a union in a resentful town', () => {
    const a = start();
    const b = start();
    const t = town('corranWorks');
    b.communities.mood[t] = 25;
    unionsMonth(a);
    unionsMonth(b);
    expect(b.unions.towns[t].strength - a.unions.towns[t].strength).toBeCloseTo(W.kMoodToUnion * 30, 6);
  });

  it('hardens the union when you mothball a plant', () => {
    let s = start();
    const t = town('ashfordComplex');
    const before = s.unions.towns[t].strength;
    s = apply(s, { type: 'mothball', site: 'ashfordComplex' });
    expect(s.unions.towns[t].strength).toBeCloseTo(before + W.mothballUnion, 6);
  });

  it('no longer offers an open day', () => {
    expect(validate(start(), { type: 'openDay', town: town('corranWorks') })).toMatch(/community fund/);
  });
});

describe('security', () => {
  it('has one national cyber level that covers every system', () => {
    let s = start();
    s = apply(s, { type: 'cyberDefence', area: 'rail' });
    expect(cyberLevel(s)).toBe(1);
    expect(Object.values(s.cyber.levels)).toEqual([1, 1, 1]);
  });

  it('folds backups and drills into one recovery plan', () => {
    let s = start();
    s = apply(s, { type: 'cyberBackups' });
    expect(hasPlan(s)).toBe(true);
    expect(validate(s, { type: 'cyberDrills' })).toMatch(/recovery plan/);
  });

  it('makes deep vetting cost a little union goodwill', () => {
    let s = start();
    const t = town('corranWorks');
    s = apply(s, { type: 'vet', site: 'corranWorks' });
    const after1 = s.unions.towns[t].strength;
    s = apply(s, { type: 'vet', site: 'corranWorks' });
    expect(s.unions.towns[t].strength).toBeCloseTo(after1 + HF.security.vetUnion, 6);
  });
});

describe('older saves', () => {
  it('load with one cyber level, the rounded mean of the old three, and one recovery plan', () => {
    const s = start();
    s.cyber.levels = { plants: 2, rail: 1, suppliers: 0 };
    s.cyber.backups = true;
    s.cyber.drills = false;
    const loaded = migrate(JSON.parse(JSON.stringify(s)));
    expect(Object.values(loaded.cyber.levels)).toEqual([1, 1, 1]);
    expect(hasPlan(loaded)).toBe(true);
    expect(migrate(JSON.parse(JSON.stringify(loaded))).cyber).toEqual(loaded.cyber);
  });
});
