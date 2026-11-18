import { describe, expect, it } from 'vitest';
import { apply, validate } from '../../src/sim/actions';
import { lotQty } from '../../src/sim/selectors';
import { RESEARCH, resolveDecision } from '../../src/sim/strategy';
import { newSim } from '../../src/sim/setup';
import { activity, security } from '../../src/sim/security';
import { controllerOf } from '../../src/sim/hotseat';
import { hireRoom, townIndex, townOf } from '../../src/sim/towns';
import { advanceDays, feed, openCampaign } from '../../src/sim/tick';

const start = (seed = 1) => ({ ...openCampaign(newSim({ seed })), treasury: 20000 });

describe('espionage and security', () => {
  it('vetting raises a plant’s security, and the rival’s spies get busier as it grows', () => {
    let s = start();
    const before = security(s, 'corranWorks');
    s = apply(s, { type: 'vet', site: 'corranWorks' });
    s = apply(s, { type: 'vet', site: 'corranWorks' });
    expect(security(s, 'corranWorks')).toBeGreaterThan(before + 0.3);
    const quiet = activity(s);
    s.rival.known.push({ id: 'swarms', announced: 0, fielded: 90 }, { id: 'decoys', announced: 0, fielded: 90 });
    expect(activity(s)).toBeGreaterThan(quiet);
  });

  it('a turned spy ring buys time against the rival', () => {
    const s = start();
    s.rival.known.push({ id: 'decoys', announced: s.day, fielded: s.day + 60 });
    s.strategy.decisions.push({ id: 900, kind: 'spyRing', title: '', body: '', options: [{ id: 'turn', label: '', detail: '' }], fallback: 'quiet', site: 'corranWorks' });
    resolveDecision(s, 900, 'turn', feed);
    expect(s.rival.known[0].fielded).toBe(s.day + 120);
  });

  it('over years, unguarded plants suffer incidents', () => {
    let s = start(3);
    s.rival.known.push({ id: 'swarms', announced: 0, fielded: 9999 }, { id: 'decoys', announced: 0, fielded: 9999 }, { id: 'armour', announced: 0, fielded: 9999 });
    s = advanceDays(s, 3 * 360);
    const incidents = s.history.reduce((a, h) => a + (h.incidents ?? 0), 0);
    const caught = s.feed.filter((f) => f.text.includes('spy ring is uncovered')).length;
    expect(incidents + caught).toBeGreaterThan(0);
  });
});

describe('workforce towns', () => {
  it('a town can only supply so many people; housing makes room', () => {
    let s = start();
    const town = townOf('corranWorks');
    const room = hireRoom(s, town);
    expect(validate(s, { type: 'hire', site: 'corranWorks', count: room + 500 })).toMatch(/can supply only|no one left/);
    s = apply(s, { type: 'housing', town: townIndex(town) });
    const housing = s.towns[townIndex(town)].housing;
    s = advanceDays(s, 160);
    expect(s.towns[townIndex(town)].housing).toBeGreaterThan(housing);
  });

  it('mothballing a plant saves its crew’s wages but costs goodwill', () => {
    let s = start();
    const regions = s.strategy.factions.regions;
    s = apply(s, { type: 'mothball', site: 'ashfordComplex' });
    expect(s.sites.ashfordComplex.workers).toBe(0);
    expect(s.strategy.factions.regions).toBeLessThan(regions);
    expect(validate(s, { type: 'hire', site: 'ashfordComplex', count: 10 })).toMatch(/Reopen/);
    s = apply(s, { type: 'reopen', site: 'ashfordComplex' });
    expect(s.sites.ashfordComplex.mothballed).toBe(false);
  });
});

describe('testing and qualification', () => {
  it('a new round waits at its arsenal until it passes its firings', () => {
    let s = start();
    s = apply(s, { type: 'research', research: 'apkws' });
    s = advanceDays(s, RESEARCH.apkws.days + 2);
    expect(s.lines.apkws.accepted).toBe(false);
    const t = s.tests.find((x) => x.line === 'apkws' && !x.variant)!;
    expect(t).toBeDefined();
    s = apply(s, { type: 'hire', site: 'northgateCenter', count: 200 });
    s = advanceDays(s, 150);
    if (!s.lines.apkws.accepted) {
      // Nothing has gone to the depots yet.
      expect(lotQty(s.sites.depotCentral.lots.apkws)).toBe(0);
      s.tests.find((x) => x.line === 'apkws')!.odds = 1;
      s = advanceDays(s, 120);
    }
    expect(s.lines.apkws.accepted).toBe(true);
  });

  it('a failed firing asks for a fix or to press on', () => {
    let s = start();
    s = apply(s, { type: 'design', line: 'pac3', variant: 'lean' });
    s = advanceDays(s, 125);
    const t = s.tests.find((x) => x.variant === 'lean')!;
    t.odds = 0;
    s = advanceDays(s, 31);
    expect(s.strategy.decisions.some((d) => d.kind === 'testFailure') || s.tests.some((x) => x.failed > 0)).toBe(true);
  });
});

describe('hot-seat two-player', () => {
  it('splits the country, takes turns each month and scores both sides', () => {
    let s = openCampaign(newSim({ seed: 2, hotseat: ['Ana', 'Ben'] }));
    const h = s.hotseat!;
    expect(controllerOf(h, 'northgateCenter')).toBe(0);
    expect(controllerOf(h, 'corranWorks')).toBe(0);
    expect(controllerOf(h, 'ashfordComplex')).toBe(1);
    s = apply(s, { type: 'handover' });
    // Ana is up first: Ben's plants are off limits.
    expect(validate(s, { type: 'hire', site: 'ashfordComplex', count: 10 })).toMatch(/Ben/);
    expect(validate(s, { type: 'hire', site: 'northgateCenter', count: 10 })).toBeNull();
    s = apply(s, { type: 'hire', site: 'northgateCenter', count: 10 });
    expect(s.hotseat!.players[0].spent).toBeGreaterThan(0);
    s = advanceDays(s, 30);
    expect(s.hotseat!.active).toBe(1);
    expect(s.hotseat!.handover).toBe(true);
    expect(s.hotseat!.players[0].score).not.toBe(0);
  });
});
