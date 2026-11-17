import { describe, expect, it } from 'vitest';
import { apply, validate } from '../../src/sim/actions';
import { advise } from '../../src/sim/advisor';
import { MAX_MISSES, programmeTerms } from '../../src/sim/commitments';
import { DEVELOPMENTS, rivalArrivals, rivalPk, rivalShots } from '../../src/sim/rival';
import { nationalDailyDraw, reserveTarget } from '../../src/sim/selectors';
import { newSim } from '../../src/sim/setup';
import { advanceDays, openCampaign } from '../../src/sim/tick';
import type { SimState } from '../../src/sim/types';

const start = (seed = 1) => ({ ...openCampaign(newSim({ seed })), treasury: 20000 });

/** Makes the rival's next weapon known now and fielded in a day. */
function field(s: SimState, id: keyof typeof DEVELOPMENTS): SimState {
  s.rival.known.push({ id, announced: s.day, fielded: s.day + 1 });
  return advanceDays(s, 2);
}

describe('the rival', () => {
  it('plans every weapon once, in a seed-dependent order', () => {
    const a = newSim({ seed: 1 }).rival.order;
    const b = newSim({ seed: 2 }).rival.order;
    expect(new Set(a).size).toBe(a.length);
    expect(a.length).toBe(Object.keys(DEVELOPMENTS).length);
    expect(a.join()).not.toBe(b.join());
  });

  it('warns, then fields its weapons over the term', () => {
    const s = advanceDays(start(), 720);
    expect(s.rival.known.length).toBeGreaterThan(1);
    expect(s.feed.some((f) => f.text.startsWith('Intel:'))).toBe(true);
  });

  it('a fielded weapon changes what you need, and its counter takes some of it back', () => {
    let s = start();
    const before = nationalDailyDraw(s, 'pac3');
    s = field(s, 'manoeuvring');
    expect(rivalShots(s, 'ballistic')).toBeGreaterThan(1.3);
    expect(nationalDailyDraw(s, 'pac3')).toBeGreaterThan(before);
    s.strategy.research.done.push('seekerSoftware');
    expect(rivalShots(s, 'ballistic')).toBeLessThan(1.15);
  });

  it('supersonic cruise missiles blunt the short-range interceptors', () => {
    const s = field(start(), 'fastCruise');
    expect(rivalPk(s, 'cruise', 'irist')).toBeLessThan(1);
    expect(rivalPk(s, 'cruise', 'pac3')).toBe(1);
  });

  it('swarms bring more drones', () => {
    const s = field(start(), 'swarms');
    expect(rivalArrivals(s, 'drone')).toBeGreaterThan(1.5);
  });
});

describe('lasting choices', () => {
  it('a programme pays while you deliver and is cancelled after three misses', () => {
    let s = start();
    s = apply(s, { type: 'programme', line: 'pac3', years: 3 });
    expect(s.programmes).toHaveLength(1);
    expect(validate(s, { type: 'programme', line: 'pac3', years: 3 })).toMatch(/already/);
    // Stop the line: every month is a miss.
    s.sites.corranWorks.processes.forEach((p) => (p.run = 'idle'));
    s = advanceDays(s, 30 * (MAX_MISSES + 1));
    expect(s.programmes.some((p) => p.line === 'pac3')).toBe(false);
    expect(programmeTerms(s, 'pac3', 5).perMonth).toBeGreaterThan(programmeTerms(s, 'pac3', 3).perMonth);
  });

  it('policies change the rules, three at most, and revoking costs confidence', () => {
    let s = start();
    const target = reserveTarget(s, 'pac3');
    const budget = s.appropriation;
    s = apply(s, { type: 'adoptPolicy', policy: 'stockpileLaw' });
    expect(reserveTarget(s, 'pac3')).toBeGreaterThan(target);
    expect(s.appropriation).toBeGreaterThan(budget);
    s = apply(s, { type: 'adoptPolicy', policy: 'greenDemil' });
    expect(validate(s, { type: 'setPolicy', policy: { demilMethod: 'burn' } })).toMatch(/burning/);
    s = apply(s, { type: 'adoptPolicy', policy: 'openBooks' });
    expect(validate(s, { type: 'adoptPolicy', policy: 'exportDrive' })).toMatch(/At most/);
    const c = s.confidence;
    s = apply(s, { type: 'revokePolicy', policy: 'openBooks' });
    expect(s.confidence).toBeLessThan(c);
  });

  it('a completed term can go on to a second term, keeping everything', () => {
    let s = openCampaign(newSim({ seed: 4, months: 2 }));
    s.confidence = 90;
    s = advanceDays(s, 70);
    expect(s.over).toBe(true);
    expect(s.outcome).toBe('complete');
    const day = s.day;
    s = apply(s, { type: 'secondTerm' });
    expect(s.over).toBe(false);
    expect(s.term).toBe(2);
    expect(s.days).toBeGreaterThan(day + 360);
    expect(validate(newSim({ seed: 1 }), { type: 'secondTerm' })).toMatch(/end of a completed term/);
  });
});

describe('the advisor', () => {
  it('suggests countering a known weapon, with the research to do it', () => {
    const s = start();
    s.rival.known.push({ id: 'decoys', announced: s.day, fielded: s.day + 60 });
    const a = advise(s);
    const counter = a.find((x) => x.id === 'counter-decoys');
    expect(counter?.action).toEqual({ type: 'research', research: 'discrimination' });
  });

  it('every suggested action is one the game will accept', () => {
    let s = start();
    s = advanceDays(s, 300);
    for (const a of advise(s, 20)) if (a.action) expect(validate(s, a.action)).toBeNull();
  });
});
