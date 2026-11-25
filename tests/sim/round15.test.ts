import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { apply, validate } from '../../src/sim/actions';
import { advise } from '../../src/sim/advisor';
import { PRESETS, recommend } from '../../src/sim/automation';
import { chosenCount, doctrineRate, doctrinePrice, forkOpen, industryName } from '../../src/sim/doctrine';
import { MAX_LEVEL, TRAITS, castMonth, leaderTalk, managedPlants, managerAccidents, managerOutput } from '../../src/sim/cast';
import { BOONS, boonsFor, keyMoments, legacyOf, weight } from '../../src/sim/legacy';
import { automateCost } from '../../src/sim/build';
import { opOdds } from '../../src/sim/intelops';
import { migrate, newSim } from '../../src/sim/setup';
import { advanceDays, feed, openCampaign } from '../../src/sim/tick';
import type { SimState } from '../../src/sim/types';
import DoctrinePanel from '../../src/game/DoctrinePanel';
import StaffPanel from '../../src/game/StaffPanel';
import TownsPanel from '../../src/game/TownsPanel';
import TermReport from '../../src/game/TermReport';

const start = (seed = 1) => openCampaign(newSim({ seed }));
const rich = (seed = 1): SimState => ({ ...start(seed), treasury: 5000 });
const noop = () => {};
const clean = (html: string) => {
  expect(html).not.toMatch(/NaN|undefined|Infinity/);
  return html.replace(/<!-- -->/g, '');
};

describe('doctrine', () => {
  it('opens tier by tier, takes time, and closes the other answer for good', () => {
    const s = rich();
    expect(forkOpen(s, 'production')).toBe(true);
    expect(forkOpen(s, 'workforce')).toBe(false);
    expect(validate(s, { type: 'adoptDoctrine', fork: 'workforce', side: 'a' })).toMatch(/Settle 1 doctrine first/);
    const going = apply(s, { type: 'adoptDoctrine', fork: 'production', side: 'a' });
    expect(going.treasury).toBeLessThan(s.treasury);
    expect(going.doctrine.chosen.production).toBeUndefined();
    expect(validate(going, { type: 'adoptDoctrine', fork: 'supply', side: 'a' })).toMatch(/still bedding in/);
    const done = advanceDays({ ...going, treasury: 5000 }, 95);
    expect(done.doctrine.chosen.production).toBe('a');
    expect(done.doctrine.active).toBeNull();
    expect(done.feed.some((f) => /^Doctrine adopted: Mass production/.test(f.text))).toBe(true);
    expect(validate(done, { type: 'adoptDoctrine', fork: 'production', side: 'b' })).toMatch(/Already settled/);
    expect(forkOpen(done, 'workforce')).toBe(true);
    expect(forkOpen(done, 'rival')).toBe(false);
    expect(validate({ ...s, treasury: 0 }, { type: 'adoptDoctrine', fork: 'supply', side: 'b' })).toMatch(/Not enough money/);
  });

  it('changes how the industry works', () => {
    const s = rich();
    const mass = { ...s, doctrine: { chosen: { production: 'a' as const }, active: null } };
    const prec = { ...s, doctrine: { chosen: { production: 'b' as const }, active: null } };
    expect(doctrineRate(mass, 'shell155')).toBeCloseTo(1.15);
    expect(doctrineRate(mass, 'pac3')).toBeCloseTo(0.95);
    expect(doctrineRate(prec, 'pac3')).toBeCloseTo(1.08);
    expect(doctrineRate(s, 'pac3')).toBe(1);
    const home = { ...s, doctrine: { chosen: { supply: 'a' as const }, active: null } };
    expect(doctrinePrice(home, true)).toBeGreaterThan(1);
    expect(doctrinePrice(home, false)).toBeLessThan(1);
    const auto = { ...s, doctrine: { chosen: { workforce: 'a' as const }, active: null } };
    const p = s.sites.corranWorks.processes.findIndex(() => true);
    expect(automateCost(auto, 'corranWorks', p)).toBeLessThan(automateCost(s, 'corranWorks', p));
    const shadow = { ...s, doctrine: { chosen: { rival: 'b' as const }, active: null } };
    expect(opOdds(shadow, 'delay')).toBeGreaterThan(opOdds(s, 'delay'));
  });

  it('mass production makes more shells in practice', () => {
    const base = advanceDays(rich(4), 30);
    const mass = { ...structuredClone(base), doctrine: { chosen: { production: 'a' as const }, active: null } };
    const a = advanceDays(base, 60);
    const b = advanceDays(mass, 60);
    const made = (x: SimState) => x.history.slice(-2).reduce((t, h) => t + (h.made.shell155 ?? 0), 0);
    expect(made(b)).toBeGreaterThan(made(a));
  });

  it('names the industry you built, and the chief of staff settles forks by stance', () => {
    const s = rich();
    expect(industryName(s)).toBe('the industry you inherited');
    expect(industryName({ ...s, doctrine: { chosen: { production: 'a', reserves: 'a' }, active: null } })).toBe('an arsenal of plenty');
    const auto = openCampaign(newSim({ seed: 6, automation: PRESETS.full }));
    const later = advanceDays({ ...auto, treasury: 4000 }, 400);
    expect(chosenCount(later) + (later.doctrine.active ? 1 : 0)).toBeGreaterThanOrEqual(2);
    expect(advise(rich(), 40).some((a) => a.id === 'doctrine-production')).toBe(false); // too early: day 0
    expect(advise(advanceDays(rich(), 70), 40).some((a) => a.id.startsWith('doctrine-'))).toBe(true);
  });
});

describe('plant managers and union leaders', () => {
  it('every running plant has a named manager with a trait; every union town a leader', () => {
    const s = start(2);
    for (const d of managedPlants(s)) {
      const m = s.cast.managers[d.id];
      expect(m.name).toMatch(/\w+ \w+/);
      expect(Object.keys(TRAITS)).toContain(m.trait);
      expect(m.level).toBeGreaterThanOrEqual(1);
    }
    expect(Object.keys(s.cast.leaders).length).toBeGreaterThan(0);
    expect(s.cast.pool).toHaveLength(4);
  });

  it('traits change how a plant runs, more so at a higher level', () => {
    const s = start();
    const id = managedPlants(s)[0].id;
    const set = (trait: keyof typeof TRAITS, level: number) => {
      const t = structuredClone(s);
      t.cast.managers[id] = { ...t.cast.managers[id], trait, level };
      return t;
    };
    expect(managerOutput(set('driver', 1), id)).toBeCloseTo(1.04);
    expect(managerOutput(set('driver', 3), id)).toBeCloseTo(1.08);
    expect(managerAccidents(set('safety', 2), id)).toBeLessThan(1);
    expect(managerAccidents(set('cornerCutter', 1), id)).toBeGreaterThan(1);
    expect(managerOutput(set('meticulous', 3), id)).toBe(1);
  });

  it('promote and replace', () => {
    const s = rich(3);
    const id = managedPlants(s)[0].id;
    s.cast.managers[id].level = 1;
    const up = apply(s, { type: 'promoteManager', site: id });
    expect(up.cast.managers[id].level).toBe(2);
    const top = structuredClone(up);
    top.cast.managers[id].level = MAX_LEVEL;
    expect(validate(top, { type: 'promoteManager', site: id })).toMatch(/as senior/);
    const cand = s.cast.pool[0];
    const swapped = apply(s, { type: 'appointManager', site: id, candidate: cand.id });
    expect(swapped.cast.managers[id].name).toBe(cand.name);
    expect(swapped.cast.pool).toHaveLength(3);
    expect(swapped.sites[id].morale).toBeLessThan(s.sites[id].morale);
    expect(validate(swapped, { type: 'appointManager', site: id, candidate: cand.id })).toMatch(/no longer available/);
  });

  it('a restless senior manager gets an offer; the answers work', () => {
    const s = rich(5);
    const id = managedPlants(s)[0].id;
    s.cast.managers[id] = { ...s.cast.managers[id], level: 2, loyalty: 10 };
    s.sites[id].morale = 20;
    let found = false;
    for (let i = 0; i < 60 && !found; i++) {
      castMonth(s, feed);
      found = s.strategy.decisions.some((d) => d.kind === 'poach');
      s.cast.managers[id].loyalty = 10;
    }
    expect(found).toBe(true);
    const d = s.strategy.decisions.find((x) => x.kind === 'poach')!;
    expect(recommend(s, d).option).toBe('promote');
    const kept = apply(s, { type: 'decide', decision: d.id, option: 'promote' });
    expect(kept.cast.managers[id].level).toBe(3);
    const gone = apply(s, { type: 'decide', decision: d.id, option: 'release' });
    expect(gone.cast.managers[id].name).not.toBe(s.cast.managers[id].name);
    // Without the money, matching cannot be chosen; it never fires them by mistake.
    expect(validate({ ...s, treasury: 0 }, { type: 'decide', decision: d.id, option: 'match' })).toMatch(/Not enough money/);
    // Replacing the manager first makes the offer lapse.
    const swapped = apply(s, { type: 'appointManager', site: id, candidate: s.cast.pool[0].id });
    expect(swapped.strategy.decisions.some((x) => x.kind === 'poach')).toBe(false);
    // An offer settled for someone who has since been replaced does nothing to the new manager.
    const moved = structuredClone(s);
    moved.cast.managers[id] = { ...moved.cast.pool[0], since: moved.day };
    const after = apply(moved, { type: 'decide', decision: d.id, option: 'release' });
    expect(after.cast.managers[id].name).toBe(moved.cast.managers[id].name);
  });

  it('a pragmatic union leader makes talks likelier to succeed', () => {
    const s = start();
    const town = Number(Object.keys(s.cast.leaders)[0]);
    const t = structuredClone(s);
    t.cast.leaders[town].temper = 'pragmatist';
    expect(leaderTalk(t, town)).toBeGreaterThan(0);
    t.cast.leaders[town].temper = 'firebrand';
    expect(leaderTalk(t, town)).toBeLessThan(0);
  });

  it('old saves gain doctrine, managers and moments', () => {
    const s = structuredClone(start()) as Partial<SimState>;
    delete s.doctrine;
    delete s.cast;
    delete s.moments;
    const m = migrate(s as SimState);
    expect(m.doctrine.chosen).toEqual({});
    expect(Object.keys(m.cast.managers).length).toBeGreaterThan(0);
    expect(m.moments).toEqual([]);
  });
});

describe('the endgame', () => {
  const ended = () => {
    return structuredClone(advanceDays(openCampaign(newSim({ seed: 8, months: 12 })), 12 * 30 + 1));
  };

  it('remembers the moments that mattered, weightiest first chosen, shown in order', () => {
    const s = start();
    feed(s, 'bad', 'Crisis: the Artillery duel has begun.', undefined, true);
    feed(s, 'good', 'Research complete: x.', undefined, true);
    feed(s, 'info', 'Something small.', undefined, true);
    expect(s.moments!.length).toBe(3);
    expect(weight(s.moments![0])).toBeGreaterThan(weight(s.moments![2]));
    const m = keyMoments(s, 2);
    expect(m.map((x) => x.text)).toEqual(['Crisis: the Artillery duel has begun.', 'Research complete: x.']);
  });

  it('a finished term earns a title, a legacy and boons to choose from', () => {
    const s = ended();
    expect(s.over).toBe(true);
    const l = legacyOf(s);
    expect(l.title.length).toBeGreaterThan(3);
    expect(l.carry.length).toBeGreaterThan(0);
    const b = boonsFor(s);
    expect(b.length).toBe(3);
    for (const id of b) expect(BOONS[id]).toBeTruthy();
  });

  it('the chosen boon carries into the next term, and only an earned one', () => {
    const s = ended();
    expect(s.outcome).toBe('complete');
    const b = boonsFor(s);
    const bad = (['committee', 'workforce', 'allies', 'arsenal', 'engineers', 'shadow', 'fresh'] as const).find((x) => !b.includes(x));
    if (bad) expect(validate(s, { type: 'secondTerm', boon: bad })).toMatch(/not earned/);
    const plain = apply(s, { type: 'secondTerm' });
    expect(plain.term).toBe(2);
    // Every boon on offer changes what it says, measured against no boon at all, after the new term's reset.
    const effect: Record<string, (x: SimState) => number> = {
      committee: (x) => x.appropriation,
      workforce: (x) => Object.values(x.cast.managers).reduce((a, m) => a + m.loyalty, 0),
      allies: (x) => Object.values(x.allies).reduce((a, v) => a + v, 0),
      arsenal: (x) => x.confidence,
      engineers: (x) => x.engineers.market,
      shadow: (x) => x.intel.agency,
      fresh: (x) => x.treasury,
    };
    for (const boon of b) {
      const next = apply(s, { type: 'secondTerm', boon });
      expect(effect[boon](next)).toBeGreaterThan(effect[boon](plain));
      expect(next.feed.some((f) => /Your legacy carries over/.test(f.text))).toBe(true);
    }
  });

  it('broken promises are remembered next term: 3 off every faction for each', () => {
    const s = ended();
    expect(s.outcome).toBe('complete');
    const plain = apply(s, { type: 'secondTerm' });
    const t = structuredClone(s);
    feed(t, 'bad', 'Promise broken: more PAC-3. The hawks are angry.', undefined, true);
    const next = apply(t, { type: 'secondTerm' });
    expect(next.strategy.factions.treasury).toBeCloseTo(Math.max(0, plain.strategy.factions.treasury - 3));
    expect(legacyOf(t).carry.some((c) => /broken promise/.test(c.text))).toBe(true);
  });

  it('a new term counts only its own moments', () => {
    const s = ended();
    const next = apply(s, { type: 'secondTerm' });
    expect(next.termStartDay).toBe(s.day);
    expect(keyMoments(next).every((m) => m.day > s.day)).toBe(true);
  });

  it('nothing can be spent on doctrine or managers once the term is over, or on the other player’s plants', () => {
    const s = ended();
    const id = managedPlants(s)[0].id;
    expect(validate({ ...s, treasury: 9999 }, { type: 'adoptDoctrine', fork: 'supply', side: 'a' })).toMatch(/over/);
    expect(validate({ ...s, treasury: 9999 }, { type: 'promoteManager', site: id })).toMatch(/over/);
    const hs = { ...openCampaign(newSim({ seed: 3, hotseat: ['A', 'B'] })), treasury: 9999 };
    const theirs = managedPlants(hs).find((d) => validate(hs, { type: 'safety', site: d.id }) !== null && /runs/.test(validate(hs, { type: 'safety', site: d.id })!));
    if (theirs) {
      expect(validate(hs, { type: 'promoteManager', site: theirs.id })).toMatch(/runs/);
      expect(validate(hs, { type: 'appointManager', site: theirs.id, candidate: hs.cast.pool[0].id })).toMatch(/runs/);
    }
  });
});

describe('panels', () => {
  it('the doctrine tab, managers, union leaders and the legacy screen render', () => {
    const s = advanceDays(rich(7), 100);
    const going = apply({ ...s, treasury: 5000 }, { type: 'adoptDoctrine', fork: 'supply', side: 'b' });
    const doc = clean(renderToString(createElement(DoctrinePanel, { state: going, act: noop })));
    expect(doc).toMatch(/Bedding in: Allied supply chains/);
    expect(doc).toMatch(/Opens once 1 doctrine is settled/);
    const staff = clean(renderToString(createElement(StaffPanel, { state: s, act: noop })));
    expect(staff).toMatch(/Plant managers/);
    expect(staff).toMatch(/loyalty \d+/);
    expect(clean(renderToString(createElement(TownsPanel, { state: s, act: noop, onSite: noop })))).toMatch(/Led by/);
    const done = advanceDays(openCampaign(newSim({ seed: 8, months: 12 })), 12 * 30 + 1);
    const report = clean(renderToString(createElement(TermReport, { state: done, onClose: noop, onMenu: noop, onSecondTerm: noop })));
    expect(report).toMatch(/Your legacy/);
    if (done.outcome === 'complete') expect(report).toMatch(/Choose one legacy to build on/);
  });
});

