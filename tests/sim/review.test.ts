// Regression tests for the bugs found in the in-depth review.
import { describe, expect, it } from 'vitest';
import { apply, validate } from '../../src/sim/actions';
import { openHearing } from '../../src/sim/hearings';
import { industrialAction } from '../../src/sim/unions';
import { nationalStock } from '../../src/sim/selectors';
import { newSim } from '../../src/sim/setup';
import { advanceDays, feed, onHold, openCampaign } from '../../src/sim/tick';
import { promisesMonth } from '../../src/sim/hearings';

const start = (seed = 1) => ({ ...openCampaign(newSim({ seed })), treasury: 20000 });

describe('core simulation', () => {
  it("a month's fighting still counts after an action mid-month, and stepping twice from one state agrees", () => {
    const base = openCampaign(newSim({ seed: 7, scenario: 'warFooting' }));
    const a = advanceDays(advanceDays(base, 25), 5);
    const mid = apply(advanceDays(base, 25), { type: 'setPolicy', policy: { baseDays: 10 } });
    const b = advanceDays(mid, 5);
    expect(b.history.at(-1)!.why!.leaks).toBe(a.history.at(-1)!.why!.leaks);
    const p = advanceDays(base, 25);
    advanceDays(p, 5);
    expect(advanceDays(p, 5).history.at(-1)!.why!.leaks).toBe(a.history.at(-1)!.why!.leaks);
  });

  it('retired rounds on their way to be destroyed are not counted as stock', () => {
    const s = start();
    const before = nationalStock(s, 'gmlrs');
    s.shipments.push({ id: 1, from: 'depotCentral', to: 'karrowDemil', material: 'gmlrs', qty: 500, lots: [], depart: s.day, arrive: s.day + 5, path: ['depotCentral', 'karrowDemil'], modes: ['rail'] });
    expect(nationalStock(s, 'gmlrs')).toBe(before);
  });

  it('refurbishing happens at depots and bases, not at the demilitarization site', () => {
    const s = start();
    s.sites.karrowDemil.unserviceable.pac3 = 50;
    expect(validate(s, { type: 'refurbish', site: 'karrowDemil', line: 'pac3' })).toMatch(/depot/);
  });

  it('a mothballed plant cannot be set running, and hires are whole people', () => {
    let s = start();
    s = apply(s, { type: 'mothball', site: 'ashfordComplex' });
    expect(validate(s, { type: 'setRun', site: 'ashfordComplex', process: 0, run: 'normal' })).toMatch(/Reopen/);
    expect(validate(start(), { type: 'hire', site: 'corranWorks', count: 0.5 })).toMatch(/at least one/);
  });

  it('closed suppliers take no contracts, investment or qualification', () => {
    const s = start();
    const id = Object.keys(s.sites).find((k) => s.sites[k].processes.length && k.includes('Microwave'))!;
    s.sites[id].status = 'closed';
    expect(validate(s, { type: 'invest', site: id, process: 0 })).toMatch(/closed/);
    expect(validate(s, { type: 'signContract', site: id, material: 'guidance', perDay: 1, months: 12 } as never)).toMatch(/closed/);
  });

  it('the live clock stops when a hearing opens', () => {
    const s = advanceDays(start(), 355);
    const t = advanceDays(s, 20, { stopOnHold: true });
    expect(onHold(t)).toBe(true);
    expect(t.day).toBe(360);
    expect(advanceDays(t, 5, { stopOnHold: true })).toBe(t);
  });
});

describe('two players', () => {
  it("neither director can automate, or decide for, the other's plants", () => {
    const s = { ...openCampaign(newSim({ seed: 2, hotseat: ['Ana', 'Ben'] })), treasury: 20000 };
    s.hotseat!.handover = false;
    expect(validate(s, { type: 'build', kind: 'automate', target: 'ashfordComplex', process: 0 })).toMatch(/Ben/);
    s.strategy.decisions.push({ id: 970, kind: 'ransom', title: '', body: '', options: [{ id: 'pay', label: '', detail: '' }], fallback: 'rebuild', site: 'ashfordComplex', value: 10 });
    expect(validate(s, { type: 'decide', decision: 970, option: 'pay' })).toMatch(/Ben/);
    // Corran is the West's, though it sits on the heartland grid: the West may sign for that grid.
    expect(validate(s, { type: 'powerContract', region: 'central' })).toBeNull();
  });
});

describe('story and hearings', () => {
  it('a tender awarded in the story counts toward the chapter goal', () => {
    let s = { ...openCampaign(newSim({ seed: 3, story: true })), treasury: 20000 };
    s.story!.briefing = null;
    const c = s.contracts[0];
    s = apply(s, { type: 'openTender', material: c.material, perDay: c.perDay, months: 12 });
    const t = s.tenders[0];
    const bid = t.bids.find((b) => b.perDay > 0)!;
    s = apply(s, { type: 'awardTender', tender: t.id, site: bid.site });
    expect(s.story!.counts.awarded).toBe(1);
  });

  it("a budget change made while the hearing sits is kept", () => {
    let s = start();
    openHearing(s, 220, feed);
    s.appropriation = 231; // a story chapter or the stockpile law moves it
    for (const q of s.hearing!.questions) s = apply(s, { type: 'hearingAnswer', question: q.id, option: q.fallback });
    s = apply(s, { type: 'hearingRequest', level: 'accept' });
    expect(s.appropriation).toBe(231);
  });

  it('a no-exports promise is not broken by an order signed before it', () => {
    const s = start();
    s.exports.push({ id: 1, customer: 'x', line: 'stinger', qty: 100, delivered: 10, price: 1, start: s.day - 30, endDay: s.day + 100 });
    s.month.exported = 10;
    s.promises.push({ id: 5, kind: 'noExports', text: 't', faction: 'hawks', made: s.day, due: s.day + 360 });
    promisesMonth(s, feed);
    expect(s.promises).toHaveLength(1);
  });

  it('a plant mothballed since its claim does not strike', () => {
    let s = start();
    s = apply(s, { type: 'mothball', site: 'ashfordComplex' });
    for (const u of s.unions.towns) u.strength = 90;
    industrialAction(s, { id: 1, kind: 'labour', site: 'ashfordComplex', stage: 0, due: s.day }, feed);
    expect(s.month.strikes ?? 0).toBe(0);
  });
});
