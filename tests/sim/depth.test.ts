import { describe, expect, it } from 'vitest';
import { apply, validate } from '../../src/sim/actions';
import { balances, bottleneck, forecast, termReport, trace } from '../../src/sim/analytics';
import { bidders, makeTender } from '../../src/sim/economy';
import { legCapFactor, plantSeasonFactor, seasonOf } from '../../src/sim/living';
import { lotQty, nationalStock } from '../../src/sim/selectors';
import { migrate, newSim } from '../../src/sim/setup';
import { resolveDecision } from '../../src/sim/strategy';
import { advanceDays, feed, openCampaign } from '../../src/sim/tick';
import type { SimState } from '../../src/sim/types';

const start = (seed = 1, scenario: SimState['scenario'] = 'standard') => ({ ...openCampaign(newSim({ seed, scenario })), treasury: 5000 });

describe('economy', () => {
  it('prices rise month by month', () => {
    const s = advanceDays(start(), 360);
    expect(s.priceIndex).toBeGreaterThan(1.02);
    expect(s.history.at(-1)!.priceIndex).toBeGreaterThan(1);
  });

  it('a tender gathers bids from every qualified maker, cheapest first', () => {
    const s = start();
    const m = 'steel';
    const ids = bidders(s, m);
    expect(ids.length).toBeGreaterThan(0);
    const t = makeTender(s, m, 1, 24);
    expect(t.bids).toHaveLength(ids.length);
    for (let i = 1; i < t.bids.length; i++) expect(t.bids[i].price).toBeGreaterThanOrEqual(t.bids[i - 1].price);
  });

  it('awarding a bid creates a contract at the bid price', () => {
    let s = apply(start(), { type: 'openTender', material: 'steel', perDay: 1, months: 24 });
    expect(s.tenders).toHaveLength(1);
    expect(validate(s, { type: 'openTender', material: 'steel', perDay: 1, months: 24 })).toMatch(/already open/);
    const t = s.tenders[0];
    const bid = t.bids.find((b) => b.perDay > 0)!;
    s = apply(s, { type: 'awardTender', tender: t.id, site: bid.site });
    expect(s.tenders).toHaveLength(0);
    const c = s.contracts.at(-1)!;
    expect(c.site).toBe(bid.site);
    expect(c.price).toBeCloseTo(bid.price);
  });

  it('tenders need a qualified supplier', () => {
    const s = start();
    for (const site of Object.values(s.sites)) site.qualified = false;
    expect(validate(s, { type: 'openTender', material: 'steel', perDay: 1, months: 12 })).toMatch(/Qualify/);
  });
});

describe('living world', () => {
  it('has seasons that slow transport and energetics', () => {
    const s = start();
    s.day = 15; // January
    expect(seasonOf(s.day)).toBe('winter');
    expect(legCapFactor(s, 'portMeric', 'depotNorth', 'sea')).toBeLessThan(1);
    s.day = 6 * 30 + 5; // July
    expect(seasonOf(s.day)).toBe('summer');
    expect(plantSeasonFactor(s, 'propellantMix')).toBeLessThan(1);
    expect(plantSeasonFactor(s, 'steelMaking')).toBe(1);
    expect(legCapFactor(s, 'portMeric', 'depotNorth', 'sea')).toBe(1);
  });

  it('delivers export orders from the central depot and pays for them', () => {
    let s = start();
    s.exports.push({ id: 999, customer: 'a test customer', line: 'stinger', qty: 30, delivered: 0, price: 0.5, start: s.day, endDay: s.day + 60 });
    const before = lotQty(s.sites.depotCentral.lots.stinger);
    s = advanceDays(s, 20);
    const x = s.exports.find((e) => e.id === 999)!;
    expect(x.delivered).toBeGreaterThan(0);
    expect(x.delivered).toBeLessThanOrEqual(30);
    expect(lotQty(s.sites.depotCentral.lots.stinger)).toBeLessThan(before + 1e6);
  });

  it('buying from an ally lands rounds at the central depot', () => {
    let s = start();
    s.strategy.decisions.push({ id: 777, kind: 'allyOffer', title: '', body: '', options: [{ id: 'buy', label: '', detail: '' }, { id: 'pass', label: '', detail: '' }], fallback: 'pass', data: { ally: 'merrow', line: 'pac3', qty: 40, price: 4 } });
    const stock = nationalStock(s, 'pac3');
    s = apply(s, { type: 'decide', decision: 777, option: 'buy' });
    expect(s.shipments.some((sh) => sh.material === 'pac3' && sh.to === 'depotCentral' && sh.qty === 40)).toBe(true);
    expect(nationalStock(s, 'pac3')).toBeCloseTo(stock + 40);
  });

  it('a refused pay claim ends in a strike', () => {
    let s = start();
    s.chains.push({ id: 555, kind: 'labour', site: 'corranWorks', stage: 0, due: s.day + 5 });
    s.strategy.decisions.push({ id: 556, kind: 'labour', title: '', body: '', options: [{ id: 'refuse', label: '', detail: '' }], fallback: 'refuse', site: 'corranWorks', value: 10, data: { chain: 555 } });
    resolveDecision(s, 556, 'refuse', feed);
    s = advanceDays(s, 6);
    expect(s.sites.corranWorks.disruptionDays).toBeGreaterThan(0);
    expect(s.chains.some((c) => c.id === 555)).toBe(false);
  });

  it('paying the claim settles it', () => {
    let s = start();
    s.chains.push({ id: 555, kind: 'labour', site: 'corranWorks', stage: 0, due: s.day + 5 });
    s.strategy.decisions.push({ id: 556, kind: 'labour', title: '', body: '', options: [{ id: 'pay', label: '', detail: '' }], fallback: 'pay', site: 'corranWorks', value: 10, data: { chain: 555 } });
    resolveDecision(s, 556, 'pay', feed);
    s = advanceDays(s, 6);
    expect(s.sites.corranWorks.disruptionDays).toBe(0);
  });
});

describe('scenarios', () => {
  it('war footing starts in a crisis', () => {
    const s = newSim({ seed: 1, scenario: 'warFooting' });
    expect(s.crisis?.phase).toBe('active');
  });
  it('sanctions ban every foreign supplier', () => {
    const s = newSim({ seed: 1, scenario: 'sanctions' });
    expect(Object.values(s.sites).filter((x) => x.embargoDays > 0).length).toBeGreaterThan(2);
    expect(s.priceIndex).toBeGreaterThan(1);
  });
  it('rebuild starts with a thinner reserve and more money', () => {
    const a = newSim({ seed: 1 });
    const b = newSim({ seed: 1, scenario: 'rebuild' });
    expect(nationalStock(b, 'pac3')).toBeLessThan(nationalStock(a, 'pac3'));
    expect(b.treasury).toBeGreaterThan(a.treasury);
  });
  it('the tutorial is easy, short and guided', () => {
    const s = newSim({ seed: 1, scenario: 'tutorial', difficulty: 'hard', months: 48 });
    expect(s.difficulty).toBe('easy');
    expect(s.days).toBe(24 * 30);
    expect(s.tutorial).toEqual({ step: 0 });
  });
  it('old saves are brought up to date', () => {
    const s = newSim({ seed: 1 }) as Partial<SimState>;
    delete s.priceIndex;
    delete s.tenders;
    delete s.allies;
    const m = migrate(s as SimState);
    expect(m.priceIndex).toBe(1);
    expect(m.tenders).toEqual([]);
    expect(m.allies.merrow).toBeGreaterThan(0);
  });
});

describe('analytics', () => {
  it('forecasts a year ahead from today', () => {
    const s = start();
    const f = forecast(s, 'pac3', 12);
    expect(f).toHaveLength(13);
    expect(f[0].stock).toBeCloseTo(nationalStock(s, 'pac3'));
    expect(f.every((p) => p.stock >= 0)).toBe(true);
  });

  it('traces a round down its bill of materials', () => {
    const s = start();
    const t = trace(s, 'pac3');
    expect(t[0].material).toBe('pac3');
    expect(t.length).toBeGreaterThan(2);
    const b = balances(s);
    expect(b.steel.supply).toBeGreaterThan(0);
    expect(bottleneck(s, 'pac3', b)).not.toBeNull();
  });

  it('a stopped supplier shows up as a weak link', () => {
    const s = start();
    s.sites.cinderFlats.status = 'closed';
    expect(balances(s).perchlorate.ratio).toBeLessThan(0.5);
  });

  it('grades a finished term', () => {
    let s = start();
    s = advanceDays(s, 120);
    const r = termReport(s);
    expect(['A', 'B', 'C', 'D', 'F']).toContain(r.grade);
    expect(r.avgReadiness).toBeGreaterThan(0);
  });
});
