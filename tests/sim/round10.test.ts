import { describe, expect, it } from 'vitest';
import { apply, validate } from '../../src/sim/actions';
import { GRID_UPGRADE_DAYS, energyMonth, powerFactor, powerPrice, supplierEnergyFactor } from '../../src/sim/energy';
import { FRAUD_MARKUP, oversightMonth, reviewDue, wasteSince } from '../../src/sim/audit';
import { newSim } from '../../src/sim/setup';
import { advanceDays, feed, openCampaign } from '../../src/sim/tick';
import { resolveDecision } from '../../src/sim/strategy';
import { SITE_BY_ID } from '../../src/sim/world';

const start = (seed = 1) => ({ ...openCampaign(newSim({ seed })), treasury: 20000 });

describe('energy and the grid', () => {
  it('a blackout stops plants without generators; generators keep them going', () => {
    let s = start();
    const r = SITE_BY_ID.corranWorks.region;
    s.energy.grids[r].outage = 3;
    expect(powerFactor(s, s.sites.corranWorks)).toBe(0.25);
    s = apply(s, { type: 'generator', site: 'corranWorks' });
    expect(powerFactor(s, s.sites.corranWorks)).toBe(0.7);
    expect(validate(s, { type: 'generator', site: 'corranWorks' })).toMatch(/already/);
    s.energy.grids[r].outage = 0;
    expect(powerFactor(s, s.sites.corranWorks)).toBe(1);
  });

  it('a power contract holds the price while the market climbs', () => {
    let s = start();
    const r = SITE_BY_ID.corranWorks.region;
    s = apply(s, { type: 'powerContract', region: r });
    const fixed = powerPrice(s, r);
    s.energy.shock = { size: 0.6, days: 200 };
    for (let i = 0; i < 4; i++) energyMonth(s, feed);
    expect(s.energy.grids[r].price).toBeGreaterThan(fixed + 0.2);
    expect(powerPrice(s, r)).toBe(fixed);
  });

  it('dear power makes power-hungry suppliers dearer, and your plants pay a power bill', () => {
    let s = start();
    const smelter = Object.keys(s.sites).find((id) => SITE_BY_ID[id].owner === 'private' && SITE_BY_ID[id].kind === 'smelter')!;
    const cheap = supplierEnergyFactor(s, smelter);
    s.energy.grids[SITE_BY_ID[smelter].region].price = 1.5;
    expect(supplierEnergyFactor(s, smelter)).toBeGreaterThan(cheap);
    s = advanceDays(s, 3);
    expect(s.month.spend.energy).toBeGreaterThan(0);
  });

  it('a grid upgrade adds reserve once it is built', () => {
    let s = start();
    const before = s.energy.grids.east.reserve;
    s = apply(s, { type: 'gridUpgrade', region: 'east' });
    s = advanceDays(s, GRID_UPGRADE_DAYS + 1);
    expect(s.energy.grids.east.reserve).toBeGreaterThan(before + 0.05);
  });
});

describe('audits and oversight', () => {
  it('a fraudulent supplier overbills, and your audit team catches it', () => {
    let s = start();
    const c = s.contracts[0];
    c.fraud = true;
    s = advanceDays(s, 20);
    const k = s.contracts.find((x) => x.id === c.id)!;
    expect(k.overbilled ?? 0).toBeGreaterThan(0);
    expect(wasteSince({ ...s, history: [...s.history, s.month] }, 1).by.fraud).toBeCloseTo(k.overbilled!, 5);
    s = apply(s, { type: 'auditTeam' });
    for (let i = 0; i < 30 && !s.strategy.decisions.some((d) => d.kind === 'fraud'); i++) oversightMonth(s, feed);
    const d = s.strategy.decisions.find((x) => x.kind === 'fraud')!;
    expect(d).toBeDefined();
    const t = s.treasury;
    resolveDecision(s, d.id, 'prosecute', feed);
    expect(s.contracts.some((x) => x.id === c.id)).toBe(false);
    expect(s.treasury).toBeGreaterThan(t);
    expect(FRAUD_MARKUP).toBeGreaterThan(0);
  });

  it('the Auditor-General rewards a clean year and questions a wasteful one', () => {
    const clean = start();
    while ((clean.history.length + 1) % 12 !== 6) clean.history.push({ ...clean.month, month: clean.history.length });
    const c0 = clean.confidence;
    oversightMonth(clean, feed);
    expect(clean.oversight.findings.at(-1)?.verdict).toBe('clean');
    expect(clean.confidence).toBe(c0 + 2);

    const messy = start();
    while ((messy.history.length + 1) % 12 !== 6) messy.history.push({ ...messy.month, month: messy.history.length, waste: { spot: 200 }, spend: { ...messy.month.spend, purchases: 300 } });
    oversightMonth(messy, feed);
    expect(messy.oversight.findings.at(-1)?.verdict).toBe('damning');
    expect(messy.strategy.decisions.some((d) => d.kind === 'audit')).toBe(true);
  });
});

describe('the statistics room', () => {
  it('records what each plant made and what each decision did', () => {
    let s = start();
    s = advanceDays(s, 30);
    const h = s.history.at(-1)!;
    expect(Object.keys(h.plantOutput ?? {}).length).toBeGreaterThan(0);
    s.strategy.decisions.push({ id: 901, kind: 'bailout', title: 'Test', body: '', options: [{ id: 'bail', label: 'Bail', detail: '' }], fallback: 'let', site: 'corranWorks', value: 10 });
    resolveDecision(s, 901, 'bail', feed);
    const rec = s.month.decisions!.at(-1)!;
    expect(rec.title).toBe('Test');
    expect(rec.treasury).toBe(-10);
  });
});

describe('review fixes', () => {
  it('settling overbilling clears the case, so a relapse can be caught again', () => {
    const s = start();
    const c = s.contracts[0];
    Object.assign(c, { fraud: true, flagged: true, overbilled: 5 });
    s.strategy.decisions.push({ id: 950, kind: 'fraud', title: 'x', body: '', options: [{ id: 'settle', label: '', detail: '' }], fallback: 'settle', site: c.site, value: 5, data: { contract: c.id } });
    resolveDecision(s, 950, 'settle', feed);
    expect(c.fraud).toBe(false);
    expect(c.flagged).toBe(false);
  });

  it('the Auditor-General reviews twice a year', () => {
    const s = start();
    const due: number[] = [];
    for (let m = 0; m < 24; m++) {
      s.history = Array.from({ length: m }, (_, i) => ({ ...s.month, month: i }));
      if (reviewDue(s)) due.push(m);
    }
    expect(due).toEqual([5, 11, 17, 23]);
  });

  it('in two-player games, each director runs only their own grids', () => {
    const s = { ...openCampaign(newSim({ seed: 2, hotseat: ['Ana', 'Ben'] })), treasury: 20000 };
    s.hotseat!.handover = false;
    expect(validate(s, { type: 'gridUpgrade', region: 'east' })).toMatch(/Ben/);
    expect(validate(s, { type: 'gridUpgrade', region: 'north' })).toBeNull();
  });

  it('a contested report that is softened goes on the record one grade kinder', () => {
    const s = start();
    s.oversight.findings.push({ month: 5, waste: 100, spend: 500, verdict: 'damning', worst: 'spot' });
    let softened = false;
    for (let i = 0; i < 20 && !softened; i++) {
      const t = structuredClone(s);
      t.rng = 1000 + i;
      t.strategy.decisions.push({ id: 960, kind: 'audit', title: '', body: '', options: [{ id: 'contest', label: '', detail: '' }], fallback: 'accept', value: 1 });
      resolveDecision(t, 960, 'contest', feed);
      if (t.oversight.findings.at(-1)!.verdict === 'concerns') softened = true;
    }
    expect(softened).toBe(true);
  });
});
