import { describe, expect, it } from 'vitest';
import { apply, validate } from '../../src/sim/actions';
import { routeByKey, routeCap } from '../../src/sim/build';
import { pathBetween } from '../../src/sim/graph';
import { legCapFactor } from '../../src/sim/living';
import { peopleFactor } from '../../src/sim/people';
import { crewNeed, processRate } from '../../src/sim/selectors';
import { migrate, newSim } from '../../src/sim/setup';
import { advanceDays, openCampaign } from '../../src/sim/tick';
import type { SimState } from '../../src/sim/types';
import { ROUTE_KEY } from '../../src/sim/world';

const start = (seed = 1) => ({ ...openCampaign(newSim({ seed })), treasury: 20000 });

describe('building the network', () => {
  it('a new link opens after construction and changes routing', () => {
    let s = start();
    const before = pathBetween('corranWorks', 'depotCoast')!;
    s = apply(s, { type: 'build', kind: 'link', target: 'westline' });
    expect(s.network.projects).toHaveLength(1);
    expect(validate(s, { type: 'build', kind: 'link', target: 'westline' })).toMatch(/under way/);
    s = advanceDays(s, 280);
    expect(s.network.built).toContain('westline');
    const after = pathBetween('corranWorks', 'depotCoast')!;
    expect(after.days).toBeLessThanOrEqual(before.days);
    expect(after.legs.some((l) => l.key === ROUTE_KEY('corranWorks', 'depotCoast'))).toBe(true);
  });

  it('upgrades raise a route’s daily tonnage, twice at most', () => {
    let s = start();
    const key = ROUTE_KEY('depotCentral', 'corranWorks');
    const cap0 = routeCap(s, routeByKey(s, key)!);
    s = apply(s, { type: 'build', kind: 'upgrade', target: key });
    s = advanceDays(s, 125);
    expect(routeCap(s, routeByKey(s, key)!)).toBeGreaterThan(cap0);
    s = apply(s, { type: 'build', kind: 'upgrade', target: key });
    s = advanceDays(s, 125);
    expect(validate(s, { type: 'build', kind: 'upgrade', target: key })).toMatch(/Fully/);
  });

  it('the icebreaker keeps the northern lanes open in winter', () => {
    const s = start();
    s.day = 15;
    const before = legCapFactor(s, 'portMeric', 'depotNorth', 'sea');
    s.network.icebreaker = true;
    expect(legCapFactor(s, 'portMeric', 'depotNorth', 'sea')).toBeGreaterThan(before);
  });

  it('automation cuts the crew a line needs', () => {
    let s = start();
    const need = crewNeed(s.sites.corranWorks);
    s = apply(s, { type: 'build', kind: 'automate', target: 'corranWorks', process: 0 });
    s = advanceDays(s, 185);
    expect(s.sites.corranWorks.processes[0].automated).toBe(true);
    expect(crewNeed(s.sites.corranWorks)).toBeLessThan(need);
  });

  it('resilience grants only go to domestic suppliers', () => {
    const s = start();
    expect(validate(s, { type: 'build', kind: 'harden', target: 'corranWorks' })).toMatch(/domestic/);
    expect(validate(s, { type: 'build', kind: 'harden', target: 'cinderFlats' })).toBeNull();
  });
});

describe('plants and people', () => {
  it('skill and morale change output', () => {
    const s = start();
    const site = s.sites.corranWorks;
    const p = site.processes[0];
    const base = processRate(s, site, p);
    site.skill = 95;
    expect(processRate(s, site, p)).toBeGreaterThan(base);
    site.morale = 20;
    expect(peopleFactor(site)).toBeLessThan(1);
  });

  it('round-the-clock shifts build fatigue; a single shift lets crews recover', () => {
    let s = start();
    s = apply(s, { type: 'setRun', site: 'corranWorks', process: 0, run: 'surge' });
    s = advanceDays(s, 60);
    const tired = s.sites.corranWorks.fatigue;
    expect(tired).toBeGreaterThan(5);
    s.sites.corranWorks.processes.forEach((_, i) => (s = apply(s, { type: 'setRun', site: 'corranWorks', process: i, run: 'single' })));
    s = advanceDays(s, 30);
    expect(s.sites.corranWorks.fatigue).toBeLessThan(tired);
  });

  it('safety programmes and apprenticeships are your own plants only', () => {
    let s = start();
    expect(validate(s, { type: 'safety', site: 'cinderFlats' })).toMatch(/own/);
    s = apply(s, { type: 'safety', site: 'corranWorks' });
    expect(s.sites.corranWorks.safety).toBe(1);
    s = apply(s, { type: 'apprentices', site: 'corranWorks', perMonth: 12 });
    s = advanceDays(s, 31);
    expect(s.sites.corranWorks.trainees.some((t) => t.apprentice)).toBe(true);
  });
});

describe('news and the sandbox', () => {
  it('prints a Courier edition every month', () => {
    const s = advanceDays(start(), 90);
    expect(s.news).toHaveLength(3);
    expect(s.news[0].headlines.length).toBeGreaterThan(0);
  });

  it('sandbox rules switch off inflation, seasons and crises', () => {
    let s = openCampaign(newSim({ seed: 2, settings: { inflation: false, seasons: false, crises: false, events: 0, endless: true } }));
    s.day = 15;
    expect(legCapFactor(s, 'portMeric', 'depotNorth', 'sea')).toBe(1);
    s = advanceDays(s, 720);
    expect(s.priceIndex).toBe(1);
    expect(s.crisis).toBeNull();
    expect(s.over).toBe(false);
  });

  it('a sandbox has no end date and no dismissal, and its controls work', () => {
    let s = openCampaign(newSim({ seed: 1, mode: 'sandbox' }));
    expect(s.mode).toBe('sandbox');
    expect(s.settings.endless).toBe(true);
    expect(s.settings.dismissal).toBe(false);
    s = apply(s, { type: 'sandbox', op: { kind: 'money', amount: 500 } });
    s = apply(s, { type: 'sandbox', op: { kind: 'crisis', region: 'north' } });
    expect(s.crisis?.phase).toBe('active');
    s = apply(s, { type: 'sandbox', op: { kind: 'disrupt', site: 'cinderFlats' } });
    expect(s.sites.cinderFlats.disruptionDays).toBeGreaterThan(0);
    s = apply(s, { type: 'sandbox', op: { kind: 'calm' } });
    expect(s.sites.cinderFlats.disruptionDays).toBe(0);
    s.confidence = 0;
    s = advanceDays(s, 31);
    expect(s.over).toBe(false);
  });

  it('sandbox controls are refused in a campaign', () => {
    const s = start();
    expect(validate(s, { type: 'sandbox', op: { kind: 'money', amount: 500 } })).toMatch(/sandbox/);
  });

  it('older saves gain the new fields', () => {
    const s = newSim({ seed: 1 }) as Partial<SimState>;
    delete s.network;
    delete s.news;
    for (const site of Object.values(s.sites!)) delete (site as Partial<typeof site>).skill;
    const m = migrate(s as SimState);
    expect(m.network.built).toEqual([]);
    expect(m.sites.corranWorks.skill).toBeGreaterThan(0);
    expect(m.settings.inflation).toBe(true);
  });
});
