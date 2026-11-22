import { describe, expect, it } from 'vitest';
import { apply, validate } from '../../src/sim/actions';
import { banFactor, supplierNations } from '../../src/sim/diplomacy';
import { closeStaleHearing, openHearing, promisesMonth } from '../../src/sim/hearings';
import { attackOdds, railFactor } from '../../src/sim/cyber';
import { industrialAction, unionClaim, unionTowns, unionsMonth } from '../../src/sim/unions';
import { decodeCustom, encodeCustom, tidy, DEFAULT_CUSTOM } from '../../src/sim/custom';
import { legCapFactor } from '../../src/sim/living';
import { termReport } from '../../src/sim/analytics';
import { lotQty } from '../../src/sim/selectors';
import { newSim } from '../../src/sim/setup';
import { advanceDays, feed, openCampaign } from '../../src/sim/tick';
import { resolveDecision } from '../../src/sim/strategy';

const start = (seed = 1) => ({ ...openCampaign(newSim({ seed })), treasury: 20000 });

describe('allies and exports', () => {
  it('trade missions warm a nation, and a guarantee stops its export bans', () => {
    let s = start();
    const n = supplierNations()[0];
    expect(banFactor(s, n)).toBeCloseTo(1);
    expect(validate(s, { type: 'supplyGuarantee', nation: n })).toMatch(/at least/);
    s = apply(s, { type: 'tradeMission', who: n });
    expect(s.diplomacy.nations[n]).toBe(62);
    expect(banFactor(s, n)).toBeLessThan(1);
    expect(validate(s, { type: 'tradeMission', who: n })).toMatch(/recently/);
    s.diplomacy.nations[n] = 70;
    s = apply(s, { type: 'supplyGuarantee', nation: n });
    expect(banFactor(s, n)).toBe(0);
  });

  it('a co-production deal lands rounds every month, and lapses if the ally turns cold', () => {
    let s = start();
    expect(validate(s, { type: 'coproduce', ally: 'merrow', line: 'pac3' })).toMatch(/at least/);
    s.allies.merrow = 70;
    s = apply(s, { type: 'coproduce', ally: 'merrow', line: 'pac3' });
    expect(s.diplomacy.coprod).toHaveLength(1);
    const before = s.shipments.filter((x) => x.material === 'pac3' && x.from === 'portLowmouth').length;
    s = advanceDays(s, 30);
    expect(s.shipments.filter((x) => x.material === 'pac3' && x.from === 'portLowmouth').length + (s.diplomacy.coprod.length ? 0 : 1)).toBeGreaterThan(before);
    s.allies.merrow = 20;
    s = advanceDays(s, 30);
    expect(s.diplomacy.coprod).toHaveLength(0);
  });

  it('the export desk finds a buyer', () => {
    let s = start();
    s = apply(s, { type: 'seekExport', line: 'stinger' });
    const d = s.strategy.decisions.find((x) => x.kind === 'export')!;
    expect(d.title).toMatch(/export desk/);
    expect(validate(s, { type: 'seekExport', line: 'stinger' })).not.toBeNull();
  });
});

describe('budget hearings', () => {
  it('asks three questions, then takes a request', () => {
    let s = start();
    openHearing(s, 220, feed);
    expect(s.hearing!.questions).toHaveLength(3);
    expect(validate(s, { type: 'hearingRequest', level: 'accept' })).toMatch(/Answer every/);
    for (const q of s.hearing!.questions) s = apply(s, { type: 'hearingAnswer', question: q.id, option: q.options[0].id });
    s = apply(s, { type: 'hearingRequest', level: 'lean' });
    expect(s.hearing).toBeNull();
    expect(s.appropriation).toBe(209);
  });

  it('no hearing opens as the term ends', () => {
    const s = advanceDays(openCampaign(newSim({ seed: 6, months: 12 })), 12 * 30 + 1);
    expect(s.over).toBe(true);
    expect(s.hearing).toBeNull();
  });

  it('an unattended hearing closes with the provisional budget', () => {
    const s = start();
    openHearing(s, 230, feed);
    s.day += 30;
    closeStaleHearing(s, feed);
    expect(s.hearing).toBeNull();
    expect(s.appropriation).toBe(230);
  });

  it('a broken promise costs confidence; a kept one earns it', () => {
    const s = start();
    s.promises.push({ id: 1, kind: 'solvent', text: 'x', faction: 'treasury', made: s.day, due: s.day + 360 });
    s.promises.push({ id: 2, kind: 'newPlant', text: 'y', faction: 'regions', made: s.day, due: s.day + 360, base: 0 });
    s.treasury = -10;
    const c = s.confidence;
    promisesMonth(s, feed);
    expect(s.promises).toHaveLength(0);
    expect(s.confidence).toBe(c - 6 + 4);
    expect(s.promisesKept).toBe(1);
  });
});

describe('cyber', () => {
  it('defences make attacks rarer; a rail outage slows trains', () => {
    let s = start();
    s.day = 400;
    const before = attackOdds(s, 'rail');
    s = apply(s, { type: 'cyberDefence', area: 'rail' });
    expect(attackOdds(s, 'rail')).toBeLessThan(before);
    s.cyber.railDays = 10;
    expect(railFactor(s)).toBe(0.5);
    expect(legCapFactor(s, 'corranWorks', 'depotCentral', 'rail')).toBeLessThanOrEqual(0.5);
    s = apply(s, { type: 'cyberDrills' });
    expect(railFactor(s)).toBe(0.8);
  });

  it('paying a ransom unlocks a plant within days', () => {
    const s = start();
    s.sites.corranWorks.disruptionDays = 30;
    s.strategy.decisions.push({ id: 900, kind: 'ransom', title: '', body: '', options: [{ id: 'pay', label: '', detail: '' }], fallback: 'rebuild', site: 'corranWorks', value: 15 });
    resolveDecision(s, 900, 'pay', feed);
    expect(s.sites.corranWorks.disruptionDays).toBe(3);
    expect(s.cyber.ransomPaid).toBeGreaterThan(s.day);
  });
});

describe('unions and strikes', () => {
  it('unions grow when prices outrun pay; a pay deal cools them', () => {
    let s = start();
    const t = unionTowns(s)[0];
    const before = s.unions.towns[t].strength;
    s.priceIndex = 1.3;
    unionsMonth(s);
    expect(s.unions.towns[t].strength).toBeGreaterThan(before);
    const strong = s.unions.towns[t].strength;
    s = apply(s, { type: 'payDeal' });
    expect(s.unions.towns[t].strength).toBeLessThan(strong);
    expect(s.unions.towns[t].wage).toBeCloseTo(1.03);
    expect(validate(s, { type: 'payDeal' })).toMatch(/year/);
  });

  it('a refused claim from a strong union is a strike, counted for the month', () => {
    const s = start();
    for (const u of s.unions.towns) u.strength = 90;
    s.priceIndex = 1.2;
    unionClaim(s, feed);
    const d = s.strategy.decisions.find((x) => x.kind === 'labour')!;
    expect(d.options.map((o) => o.id)).toContain('refuse');
    resolveDecision(s, d.id, 'refuse', feed);
    const chain = s.chains.find((c) => c.kind === 'labour')!;
    industrialAction(s, chain, feed);
    expect(s.month.strikes).toBeGreaterThanOrEqual(1);
    expect(s.sites[chain.site].disruptionFactor).toBeLessThanOrEqual(0.3);
  });

  it('an hours deal rules out round-the-clock shifts', () => {
    const s = start();
    s.unions.noSurge.corranWorks = s.day + 100;
    expect(validate(s, { type: 'setRun', site: 'corranWorks', process: 0, run: 'surge' })).toMatch(/union deal/);
  });
});

describe('career and custom scenarios', () => {
  it('each term is graded on its own months, and the next one remembers it', () => {
    let s = openCampaign(newSim({ seed: 3, months: 12 }));
    s = advanceDays(s, 12 * 30 + 2);
    expect(s.outcome).toBe('complete');
    const first = termReport(s);
    s = apply(s, { type: 'secondTerm' });
    expect(s.term).toBe(2);
    expect(s.career).toHaveLength(1);
    expect(s.career[0].score).toBe(first.score);
    s = advanceDays(s, 60);
    expect(s.history.length - (s.termMonth ?? 0)).toBe(2);
    expect(termReport(s).avgReadiness).toBeCloseTo(s.history.slice(-2).reduce((a, h) => a + h.readiness, 0) / 2);
  });

  it('a scenario survives the trip through a code, and bad codes are refused', () => {
    const c = tidy({ ...DEFAULT_CUSTOM, name: 'Cold winter', treasury: 1234, reserve: 0.5, crisis: 'meric', rivalPace: 'fast', bans: { [supplierNations()[0]]: 6 }, events: 2 });
    const back = decodeCustom(encodeCustom(c));
    expect(back).toEqual(c);
    expect(c.treasury).toBe(1250);
    expect(decodeCustom('hello')).toBeNull();
    expect(decodeCustom('FC1-!!!')).toBeNull();
    expect(tidy({ treasury: 1e9, confidence: -5, prices: NaN }).treasury).toBe(3000);
  });

  it('a custom scenario sets up the game it describes', () => {
    const n = supplierNations()[0];
    const base = newSim({ seed: 5 });
    const s = newSim({ seed: 5, custom: { ...DEFAULT_CUSTOM, treasury: 2000, reserve: 0.5, crisis: 'meric', bans: { [n]: 6 }, confidence: 40 } });
    expect(s.scenario).toBe('custom');
    expect(s.treasury).toBe(2000);
    expect(s.confidence).toBe(40);
    expect(s.crisis?.id).toBe('meric');
    expect(lotQty(s.sites.depotCentral.lots.pac3)).toBeLessThan(lotQty(base.sites.depotCentral.lots.pac3) * 0.6);
    const banned = Object.values(s.sites).filter((x) => x.embargoDays === 180);
    expect(banned.length).toBeGreaterThan(0);
  });
});
