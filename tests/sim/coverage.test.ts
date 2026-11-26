// Actions and decisions that no other test exercises, the Courier, lots, and determinism.
import { describe, expect, it } from 'vitest';
import { apply, validate } from '../../src/sim/actions';
import { addLots, takeLots } from '../../src/sim/lots';
import { lotQty } from '../../src/sim/selectors';
import { newSim } from '../../src/sim/setup';
import { resolveDecision } from '../../src/sim/strategy';
import { advanceDays, feed, openCampaign } from '../../src/sim/tick';
import type { SiteState } from '../../src/sim/types';
import { SITE_BY_ID } from '../../src/sim/world';

const start = (seed = 1) => ({ ...openCampaign(newSim({ seed })), treasury: 20000 });
const decision = (s: ReturnType<typeof start>, d: Record<string, unknown>) => {
  const id = s.nextId++;
  s.strategy.decisions.push({ id, title: 'Test', body: '', fallback: '', options: [], ...d } as never);
  return id;
};

describe('actions no other test covers', () => {
  it('repairs a worn plant, and refuses one in good repair', () => {
    let s = start();
    s.sites.corranWorks.condition = 99;
    expect(validate(s, { type: 'repair', site: 'corranWorks' })).toMatch(/good repair/);
    s.sites.corranWorks.condition = 50;
    const t = s.treasury;
    s = apply(s, { type: 'repair', site: 'corranWorks' });
    expect(s.treasury).toBeLessThan(t);
    s = advanceDays(s, 120);
    expect(s.sites.corranWorks.condition).toBeGreaterThan(50);
  });

  it('cancels a contract', () => {
    let s = start();
    const c = s.contracts[0];
    s = apply(s, { type: 'cancelContract', contract: c.id });
    expect(s.contracts.some((x) => x.id === c.id)).toBe(false);
    expect(validate(s, { type: 'cancelContract', contract: c.id })).toMatch(/No such/);
  });

  it('invests in a supplier, and only in a domestic company', () => {
    let s = start();
    const priv = Object.values(s.sites).find((x) => SITE_BY_ID[x.id].owner === 'private' && x.processes.length && x.status === 'active')!;
    expect(validate(s, { type: 'invest', site: 'corranWorks', process: 0 })).toMatch(/domestic/);
    const before = priv.processes[0].expansions;
    s = apply(s, { type: 'invest', site: priv.id, process: 0 });
    expect(s.sites[priv.id].processes[0].expansions).toBe(before + 1);
  });

  it('hires and fires key staff', () => {
    let s = start();
    const c = s.strategy.candidates[0];
    s = apply(s, { type: 'hireStaff', candidate: c.id });
    expect(s.strategy.staff[c.role]).not.toBeNull();
    s = apply(s, { type: 'fireStaff', role: c.role });
    expect(s.strategy.staff[c.role]).toBeNull();
    expect(validate(s, { type: 'fireStaff', role: c.role })).toMatch(/Nobody/);
  });

  it('moves a test programme up the queue', () => {
    const s = start();
    s.tests.push({ id: 801, line: 'pac3', variant: 'lean', needed: 3, passed: 0, failed: 0, range: null, investigating: 0, odds: 0.85, queued: 0 });
    s.tests.push({ id: 802, line: 'sm6', variant: 'lean', needed: 3, passed: 0, failed: 0, range: null, investigating: 0, odds: 0.85, queued: 0 });
    const t = apply(s, { type: 'prioritiseTest', test: 802 });
    expect(t.tests.findIndex((x) => x.id === 802)).toBeLessThan(t.tests.findIndex((x) => x.id === 801));
    expect(validate(s, { type: 'prioritiseTest', test: 9999 })).toMatch(/No such/);
  });

  it('ends a co-production deal early, at a cost to relations', () => {
    let s = start();
    s.allies.calder = 80;
    s = apply(s, { type: 'coproduce', ally: 'calder', line: 'stinger' });
    const id = s.diplomacy.coprod[0].id;
    const rel = s.allies.calder;
    s = apply(s, { type: 'endCoproduction', id });
    expect(s.diplomacy.coprod).toHaveLength(0);
    expect(s.allies.calder).toBeLessThan(rel);
  });

  it('cyber backups shorten a ransomware attack; the audit team can be disbanded', () => {
    let s = start();
    s = apply(s, { type: 'cyberBackups' });
    expect(s.cyber.backups).toBe(true);
    expect(validate(s, { type: 'cyberBackups' })).toMatch(/already/);
    s = apply(s, { type: 'auditTeam' });
    s = apply(s, { type: 'disbandAuditTeam' });
    expect(s.oversight.team).toBe(false);
    expect(validate(s, { type: 'disbandAuditTeam' })).toMatch(/no internal/);
  });

  it('the tutorial step action works only in the tutorial', () => {
    const s = start();
    expect(validate(s, { type: 'tutorial', step: 2 })).toMatch(/Not in the tutorial/);
    const t = apply(openCampaign(newSim({ seed: 1, scenario: 'tutorial' })), { type: 'tutorial', step: 3 });
    expect(t.tutorial?.step).toBe(3);
  });
});

describe('decisions no other test covers', () => {
  it('a supplier asking to reprice: agreeing raises the contract price', () => {
    const s = start();
    const c = s.contracts[0];
    const was = c.price;
    const id = decision(s, { kind: 'reprice', site: c.site, fallback: 'refuse', options: [{ id: 'accept' }, { id: 'refuse' }], data: { contract: c.id, price: was * 1.2 } });
    resolveDecision(s, id, 'accept', feed);
    expect(s.contracts.find((x) => x.id === c.id)!.price).toBeCloseTo(was * 1.2);
  });

  it('a supplementary budget, when granted, adds money', () => {
    let granted = false;
    for (let i = 0; i < 10 && !granted; i++) {
      const s = start(i + 1);
      const t = s.treasury;
      const id = decision(s, { kind: 'supplement', fallback: 'skip', options: [{ id: 'ask' }, { id: 'skip' }], value: 300, data: { qty: 90 } });
      resolveDecision(s, id, 'ask', feed);
      if (s.treasury > t) granted = true;
    }
    expect(granted).toBe(true);
  });

  it('an ally asking for rounds: sending them warms relations and empties the depot a little', () => {
    const s = start();
    const before = lotQty(s.sites.depotCentral.lots.pac3);
    const rel = s.allies.merrow;
    const id = decision(s, { kind: 'allyRequest', fallback: 'decline', options: [{ id: 'send' }, { id: 'decline' }], data: { ally: 'merrow', line: 'pac3', qty: 10, price: 4 } });
    resolveDecision(s, id, 'send', feed);
    expect(lotQty(s.sites.depotCentral.lots.pac3)).toBe(before - 10);
    expect(s.allies.merrow).toBeGreaterThan(rel);
  });

  it('an ally offer, when bought, ships rounds home', () => {
    const s = start();
    const n = s.shipments.length;
    const id = decision(s, { kind: 'allyOffer', fallback: 'pass', options: [{ id: 'buy' }, { id: 'pass' }], data: { ally: 'calder', line: 'pac3', qty: 20, price: 5 } });
    resolveDecision(s, id, 'buy', feed);
    expect(s.shipments.length).toBe(n + 1);
  });

  it('a recall halves suspect parts in your arsenals; an inspection you fund ends the disruption', () => {
    const s = start();
    s.sites.corranWorks.stock.guidance = 100;
    s.chains.push({ id: 700, kind: 'quality', site: 'haldenMicrowave', stage: 0, due: s.day + 45, material: 'guidance' });
    const id = decision(s, { kind: 'recall', site: 'haldenMicrowave', value: 10, fallback: 'accept', options: [{ id: 'recall' }, { id: 'accept' }], data: { chain: 700, material: 'guidance' } });
    resolveDecision(s, id, 'recall', feed);
    expect(s.sites.corranWorks.stock.guidance).toBe(50);
    const mine = Object.keys(s.sites).find((k) => SITE_BY_ID[k].kind === 'mine')!;
    s.sites[mine].disruptionDays = 30;
    s.chains.push({ id: 701, kind: 'safety', site: mine, stage: 1, due: s.day + 60 });
    const id2 = decision(s, { kind: 'inspection', site: mine, value: 8, fallback: 'leave', options: [{ id: 'fund' }, { id: 'leave' }], data: { chain: 701 } });
    resolveDecision(s, id2, 'fund', feed);
    expect(s.sites[mine].disruptionDays).toBe(0);
  });

  it('an old save with the pre-hearing budget card still resolves it', () => {
    const s = start();
    const a = s.appropriation;
    const id = decision(s, { kind: 'budget', fallback: 'accept', options: [{ id: 'lean' }] });
    resolveDecision(s, id, 'lean', feed);
    expect(s.appropriation).toBe(Math.round(a * 0.95));
  });
});

describe('the Courier, lots and determinism', () => {
  it('the Courier prints one edition a month, and keeps two years', () => {
    // Thirty months of a game left to run itself; confidence is held up so the Committee does not end it first.
    let s = start();
    for (let i = 0; i < 30; i++) s = advanceDays({ ...s, confidence: Math.max(s.confidence, 70) }, 30);
    expect(s.news.length).toBe(24);
    expect(s.news.at(-1)!.headlines.length).toBeGreaterThan(0);
  });

  it('lots leave oldest first', () => {
    const site = { lots: {} } as unknown as SiteState;
    addLots(site, 'pac3', [{ qty: 5, made: 10, until: 500 }]);
    addLots(site, 'pac3', [{ qty: 5, made: 1, until: 400 }]);
    const out = takeLots(site, 'pac3', 6);
    expect(out[0].made).toBe(1);
    expect(out.reduce((a, l) => a + l.qty, 0)).toBe(6);
    expect(lotQty(site.lots.pac3)).toBe(4);
  });

  it('the same seed always plays out the same, and advancing never changes the state you started from', () => {
    const a = start(9);
    const copy = JSON.stringify(a);
    const x = advanceDays(a, 200);
    const y = advanceDays(start(9), 200);
    expect(JSON.stringify(a)).toBe(copy);
    expect(JSON.stringify(x)).toBe(JSON.stringify(y));
    const t = JSON.stringify(x);
    apply(x, { type: 'hire', site: 'corranWorks', count: 10 });
    expect(JSON.stringify(x)).toBe(t);
  });
});
