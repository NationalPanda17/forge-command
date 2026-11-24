import { describe, expect, it } from 'vitest';
import { apply, validate } from '../../src/sim/actions';
import { advise, threeMonthPlan } from '../../src/sim/advisor';
import { DEMIL, communitiesMonth, communityTowns, moodOf, objectionOdds, permitHeld, seekPermit } from '../../src/sim/communities';
import { FOUNDABLE_IDS, PLOT_IDS } from '../../src/sim/industry';
import { newSim } from '../../src/sim/setup';
import { resolveDecision } from '../../src/sim/strategy';
import { advanceDays, feed, openCampaign } from '../../src/sim/tick';
import { townIndex, townOf } from '../../src/sim/towns';

const start = (seed = 1) => ({ ...openCampaign(newSim({ seed })), treasury: 20000 });
const plot = () => PLOT_IDS[0];
const recipe = () => FOUNDABLE_IDS[0];

describe('communities and permits', () => {
  it('a content town never objects; an angry one usually does', () => {
    expect(objectionOdds(60)).toBe(0);
    expect(objectionOdds(10)).toBeGreaterThan(0.7);
  });

  it('an objection holds the plant up until it is settled; a package wins the town over', () => {
    let s = start();
    const t = townIndex(townOf(plot()));
    s.communities.mood[t] = 0;
    for (let i = 0; i < 20 && !s.communities.permits.length; i++) {
      s = start(i + 1);
      s.communities.mood[t] = 0;
      s = apply(s, { type: 'found', plot: plot(), recipe: recipe() });
    }
    expect(s.communities.permits).toHaveLength(1);
    expect(permitHeld(s, plot())).toBe(true);
    const days = s.sites[plot()].repairDays;
    s = advanceDays(s, 10);
    expect(s.sites[plot()].repairDays).toBe(days);
    const d = s.strategy.decisions.find((x) => x.kind === 'permit')!;
    resolveDecision(s, d.id, 'package', feed);
    expect(permitHeld(s, plot())).toBe(false);
    expect(s.communities.mood[t]).toBeGreaterThan(10);
    s = advanceDays(s, 10);
    expect(s.sites[plot()].repairDays).toBeLessThan(days);
  });

  it('withdrawing gives most of the money back and returns the plot', () => {
    let s = start();
    const t = townIndex(townOf(plot()));
    for (let i = 0; i < 20 && !s.communities.permits.length; i++) {
      s = start(i + 1);
      s.communities.mood[t] = 0;
      s = apply(s, { type: 'found', plot: plot(), recipe: recipe() });
    }
    const before = s.treasury;
    const d = s.strategy.decisions.find((x) => x.kind === 'permit')!;
    resolveDecision(s, d.id, 'withdraw', feed);
    expect(s.treasury).toBeGreaterThan(before);
    expect(s.sites[plot()].processes).toHaveLength(0);
    expect(s.sites[plot()].status).toBe('closed');
  });

  it('open burning sours the town beside the pit, and an angry town can win a court order', () => {
    const s = start();
    const t = townIndex(townOf(DEMIL));
    s.policy.demilMethod = 'burn';
    s.month.demilled = 3000;
    const m0 = s.communities.mood[t];
    communitiesMonth(s, feed);
    expect(s.communities.mood[t]).toBeLessThan(m0);
    let banned = false;
    for (let i = 0; i < 40 && !banned; i++) {
      const x = start(i + 1);
      x.day = 400;
      x.policy.demilMethod = 'burn';
      x.communities.mood[t] = 5;
      communitiesMonth(x, feed);
      banned = x.communities.burnBanUntil > x.day;
      if (banned) {
        expect(x.policy.demilMethod).toBe('recycle');
        expect(validate(x, { type: 'setPolicy', policy: { demilMethod: 'burn' } })).toMatch(/court/);
      }
    }
    expect(banned).toBe(true);
  });

  it('community funds and open days lift a town, with a wait between them', () => {
    let s = start();
    const t = townIndex(townOf('corranWorks'));
    s.communities.mood[t] = 30;
    s = apply(s, { type: 'communityFund', town: t });
    expect(s.communities.mood[t]).toBe(42);
    expect(validate(s, { type: 'communityFund', town: t })).toMatch(/recently/);
    s = apply(s, { type: 'openDay', town: t });
    expect(moodOf(s, 'corranWorks')).toBe(46);
  });

  it('mothballing a plant sours its town', () => {
    let s = start();
    const m0 = moodOf(s, 'ashfordComplex');
    s = apply(s, { type: 'mothball', site: 'ashfordComplex' });
    expect(moodOf(s, 'ashfordComplex')).toBeLessThan(m0 - 5);
  });
});

describe('the advisor', () => {
  it('shows what each suggested action costs, and warns about angry towns', () => {
    const s = advanceDays(start(), 200);
    const tips = advise(s, 20);
    const withAction = tips.filter((a) => a.action);
    expect(withAction.length).toBeGreaterThan(0);
    for (const a of withAction) if (a.tradeoff?.startsWith('Costs')) expect(a.tradeoff).toMatch(/\$\d/);
    const t = townIndex(townOf('corranWorks'));
    s.communities.mood[t] = 20;
    expect(advise(s, 30).some((a) => a.id === `fund-town-${t}`)).toBe(true);
  });

  it('advising never changes the game', () => {
    const s = advanceDays(start(), 100);
    const copy = JSON.stringify(s);
    advise(s, 20);
    threeMonthPlan(s);
    expect(JSON.stringify(s)).toBe(copy);
  });

  it('the three-month plan lists what is coming, in month order', () => {
    const s = advanceDays(start(), 300);
    const plan = threeMonthPlan(s);
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.every((p) => p.month >= 0 && p.month <= 2)).toBe(true);
    for (let i = 1; i < plan.length; i++) expect(plan[i].month).toBeGreaterThanOrEqual(plan[i - 1].month);
    // A hearing three months out at most.
    expect(plan.some((p) => /budget hearing/.test(p.text))).toBe(true);
  });
});

describe('review fixes', () => {
  const objecting = () => {
    let s = start();
    const t = townIndex(townOf(plot()));
    for (let i = 0; i < 20 && !s.communities.permits.length; i++) {
      s = start(i + 1);
      s.communities.mood[t] = 0;
      s = apply(s, { type: 'found', plot: plot(), recipe: recipe() });
    }
    return s;
  };

  it('withdrawing lets go anyone hired, and takes back the spur and the credit', () => {
    let s = objecting();
    s = apply(s, { type: 'hire', site: plot(), count: 20 });
    const regions = s.strategy.factions.regions;
    const d = s.strategy.decisions.find((x) => x.kind === 'permit')!;
    resolveDecision(s, d.id, 'withdraw', feed);
    expect(s.sites[plot()].workers + s.sites[plot()].trainees.length).toBe(0);
    expect(s.network.built).not.toContain(`plot-${plot()}`);
    expect(s.strategy.factions.regions).toBeLessThan(regions);
  });

  it('a content town costs no random draw, so replays are unchanged', () => {
    const s = start();
    const rng = s.rng;
    seekPermit(s, 'plant', plot(), plot(), feed);
    expect(s.rng).toBe(rng);
    const off = { ...start(), settings: { ...start().settings, events: 0 } };
    off.communities.mood = off.communities.mood.map(() => 0);
    seekPermit(off, 'plant', plot(), plot(), feed);
    expect(off.communities.permits).toHaveLength(0);
  });

  it('the town beside the burning pit is always on the list', () => {
    expect(communityTowns(start())).toContain(townIndex(townOf(DEMIL)));
  });

  it('a court ban does not complete the Clean hands objective', () => {
    const x = start();
    x.day = 400;
    x.policy.demilMethod = 'burn';
    x.communities.mood[townIndex(townOf(DEMIL))] = 0;
    for (let i = 0; i < 40 && x.communities.burnBanUntil <= x.day; i++) {
      x.rng = 1000 + i;
      communitiesMonth(x, feed);
    }
    expect(x.policy.demilMethod).toBe('recycle');
    expect(x.recycleChosen).toBe(false);
  });

  it('the plan files events in the month they happen, even on a month-end day', () => {
    let s = start();
    s = advanceDays(s, 30);
    s.strategy.research.active = { id: 'apkws', days: 10, total: 100 };
    const r = threeMonthPlan(s).find((p) => /Research finishes/.test(p.text));
    expect(r?.month).toBe(0);
  });

  it('in two-player games, a rail-link permit belongs to whoever started the link', () => {
    const s = { ...openCampaign(newSim({ seed: 2, hotseat: ['Ana', 'Ben'] })), treasury: 20000 };
    s.hotseat!.handover = false;
    s.communities.mood = s.communities.mood.map(() => 0);
    s.communities.permits.push({ id: 980, kind: 'link', target: '1', project: 1, town: 0, player: 1 });
    s.strategy.decisions.push({ id: 981, kind: 'permit', title: '', body: '', options: [{ id: 'withdraw', label: '', detail: '' }], fallback: 'override', data: { chain: 980 } });
    expect(validate(s, { type: 'decide', decision: 981, option: 'withdraw' })).toMatch(/Ben/);
  });
});
