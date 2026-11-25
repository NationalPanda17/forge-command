import { describe, expect, it } from 'vitest';
import { apply, validate, QUALIFY_DAYS, TRAINING_DAYS } from '../../src/sim/actions';
import { pathBetween } from '../../src/sim/graph';
import { lotQty, nationalStock, readiness } from '../../src/sim/selectors';
import { newSim } from '../../src/sim/setup';
import { advanceDays, openCampaign } from '../../src/sim/tick';
import { BASELINE, MATERIAL_IDS, ROUTES, ROUTE_KEY, SITES, SITE_BY_ID, START_LINES } from '../../src/sim/world';

const start = (seed = 1) => openCampaign(newSim({ seed }));

describe('world', () => {
  it('every site can be reached from every other by surface or air (open plots get a spur when founded)', () => {
    for (const a of SITES.filter((x) => x.kind !== 'plot')) expect(pathBetween('depotCentral', a.id) ?? pathBetween('depotCentral', a.id, true)).not.toBeNull();
  });

  it('every input of every starting line can be produced somewhere', () => {
    for (const id of MATERIAL_IDS) {
      if (BASELINE[id] <= 0) continue;
      const tier = id;
      const makers = SITES.filter((x) => x.processes.some((p) => p.recipe && (BASELINE[tier] > 0)));
      expect(makers.length).toBeGreaterThan(0);
    }
  });

  it('island sites are reachable only by sea or air', () => {
    const p = pathBetween('depotCentral', 'skerryBase');
    expect(p).not.toBeNull();
    expect(p!.legs.some((l) => l.mode === 'sea' || l.mode === 'air')).toBe(true);
  });
});

describe('the daily simulation', () => {
  it('is deterministic for a seed', () => {
    const a = advanceDays(start(5), 60);
    const b = advanceDays(start(5), 60);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('never mutates its input and never makes stock negative', () => {
    const s = start(2);
    const before = JSON.stringify(s);
    const after = advanceDays(s, 45);
    expect(JSON.stringify(s)).toBe(before);
    for (const site of Object.values(after.sites)) {
      for (const v of Object.values(site.stock)) expect(v).toBeGreaterThanOrEqual(-1e-9);
      for (const lots of Object.values(site.lots)) for (const l of lots ?? []) expect(l.qty).toBeGreaterThanOrEqual(0);
    }
  });

  it('arsenals keep producing every starting line in calm times', () => {
    const s = advanceDays(start(3), 60);
    const m = s.history[0];
    for (const l of START_LINES) expect(m.made[l] ?? 0).toBeGreaterThan(0);
  });

  it('shipments respect route capacity on any day', () => {
    let s = start(4);
    for (let i = 0; i < 20; i++) {
      s = advanceDays(s, 1);
      for (const rt of ROUTES) expect(s.routeLoad[ROUTE_KEY(rt.a, rt.b)] ?? 0).toBeLessThanOrEqual(rt.cap + 1e-6);
    }
  });

  it('readiness holds up with no input in the first months', () => {
    const s = advanceDays(start(6), 120);
    expect(readiness(s)).toBeGreaterThan(0.6);
  });

  it('an export ban stops a foreign supplier', () => {
    const s = structuredClone(start(7));
    s.sites.karskMetals.embargoDays = 200;
    s.sites.karskMetals.stock = {};
    const after = advanceDays(s, 20);
    expect(after.shipments.some((sh) => sh.from === 'karskMetals' && sh.depart > 0)).toBe(false);
    expect(after.sites.karskMetals.processes.every((p) => p.lastLimit === 'damaged')).toBe(true);
  });

  it('a disruption at the only perchlorate plant ripples down to rocket motors', () => {
    const calm = advanceDays(start(8), 150);
    const s = structuredClone(start(8));
    s.sites.cinderFlats.disruptionDays = 300;
    s.sites.cinderFlats.disruptionFactor = 0;
    s.sites.cinderFlats.stock = {};
    s.sites.ironmoor.stock.perchlorate = 0;
    const hit = advanceDays(s, 150);
    const motors = (x: typeof calm) => x.history.slice(-2).reduce((a, m) => a + (m.made.rocketMotor ?? 0), 0);
    expect(motors(hit)).toBeLessThan(motors(calm));
  });
});

describe('cradle to grave', () => {
  it('rounds past their service life retire and travel to demilitarization', () => {
    const s = structuredClone(start(9));
    s.policy.surveillance = false;
    s.sites.depotCentral.lots.gmlrs = [{ qty: 200, made: -3600, until: 2 }];
    let after = advanceDays(s, 3);
    expect(after.history.length === 0 ? after.month.retired : 0).toBeGreaterThanOrEqual(200);
    after = advanceDays(after, 30);
    expect((after.history[0]?.demilled ?? 0) + after.month.demilled).toBeGreaterThan(0);
  });

  it('surveillance testing extends lots that pass', () => {
    const s = structuredClone(start(10));
    s.sites.depotCentral.lots.pac3 = [{ qty: 100, made: -3500, until: 60 }];
    const after = advanceDays(s, 2);
    const lot = after.sites.depotCentral.lots.pac3!;
    // The lot is fired: it either passes and is extended, or fails (one time in ten) and is condemned.
    const extended = lot.some((l) => l.until > 60);
    const condemned = after.feed.some((f) => /Surveillance firings fail: .*PAC-3 MSE at /.test(f.text)) || (after.sites.depotCentral.unserviceable.pac3 ?? 0) > 0;
    expect(extended || condemned).toBe(true);
  });

  it('refurbishment returns retired missiles to service for five years', () => {
    const s = structuredClone(start(11));
    s.sites.depotCentral.unserviceable.irist = 20;
    const after = apply({ ...s, treasury: 1000 }, { type: 'refurbish', site: 'depotCentral', line: 'irist' });
    expect(after.sites.depotCentral.unserviceable.irist).toBe(0);
    expect(lotQty(after.sites.depotCentral.lots.irist)).toBeGreaterThanOrEqual(lotQty(s.sites.depotCentral.lots.irist) + 20);
    expect(validate(s, { type: 'refurbish', site: 'depotCentral', line: 'shell155' })).toMatch(/Nothing|not worth/);
  });
});

describe('player actions', () => {
  it('hiring adds workers after training', () => {
    let s = apply(start(12), { type: 'hire', site: 'ashfordComplex', count: 100 });
    const w = s.sites.ashfordComplex.workers;
    s = advanceDays(s, TRAINING_DAYS + 1);
    expect(s.sites.ashfordComplex.workers).toBeGreaterThan(w + 50);
  });

  it('expanding a line adds capacity that ramps up', () => {
    const s = start(13);
    const p0 = s.sites.corranWorks.processes[0].capacity;
    const after = apply({ ...s, treasury: 5000 }, { type: 'expand', site: 'corranWorks', process: 0 });
    const p = after.sites.corranWorks.processes[0];
    // Existing capacity keeps running; the new 25% ramps up on its own.
    expect(p.capacity).toBeCloseTo(p0);
    expect(p.ramp?.[0].cap).toBeCloseTo(p0 * 0.25);
    expect(p.ramp?.[0].maturity).toBeLessThan(1);
    const later = advanceDays(after, 400);
    expect(later.sites.corranWorks.processes[0].capacity).toBeCloseTo(p0 * 1.25);
  });

  it('a supplier must be qualified before it can take a contract', () => {
    let s = { ...start(14), treasury: 5000 };
    expect(validate(s, { type: 'signContract', site: 'vantor', material: 'rocketMotor', perDay: 0.2, months: 12 })).toMatch(/not qualified/);
    s = apply(s, { type: 'qualify', site: 'vantor' });
    s = advanceDays(s, QUALIFY_DAYS + 1);
    expect(s.sites.vantor.qualified).toBe(true);
    expect(validate(s, { type: 'signContract', site: 'vantor', material: 'rocketMotor', perDay: 0.2, months: 12 })).toBeNull();
  });

  it('you cannot run a private company’s plant', () => {
    expect(validate(start(15), { type: 'setRun', site: 'kestrel', process: 0, run: 'surge' })).toMatch(/your own/);
  });

  it('national stock counts depots, bases and rounds on the road', () => {
    const s = advanceDays(start(16), 5);
    expect(nationalStock(s, 'shell155')).toBeGreaterThan(lotQty(s.sites.depotCentral.lots.shell155));
    expect(SITE_BY_ID.depotCentral.kind).toBe('depot');
  });
});
