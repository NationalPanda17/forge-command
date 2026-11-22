import { describe, expect, it } from 'vitest';
import { apply, validate } from '../../src/sim/actions';
import { recipeInputs, RESEARCH } from '../../src/sim/strategy';
import { newSim } from '../../src/sim/setup';
import { advanceDays, openCampaign } from '../../src/sim/tick';
import { lotQty } from '../../src/sim/selectors';

const start = (seed = 1) => ({ ...openCampaign(newSim({ seed })), treasury: 5000 });

describe('research', () => {
  it('a new product line appears at its arsenal when research finishes', () => {
    let s = apply(start(), { type: 'research', research: 'apkws' });
    expect(validate(s, { type: 'research', research: 'coyote' })).toMatch(/busy/);
    s = advanceDays(s, RESEARCH.apkws.days + 1);
    expect(s.lines.apkws.unlocked).toBe(true);
    expect(s.sites.northgateCenter.processes.some((p) => p.recipe === 'apkws')).toBe(true);
    expect(s.sites.northgateCenter.extraCrew).toBeGreaterThan(0);
  });

  it('design changes rewrite recipes', () => {
    const s = start();
    const before = recipeInputs(s, 'ganChipFab').gallium!;
    s.strategy.research.done.push('galliumLight');
    expect(recipeInputs(s, 'ganChipFab').gallium!).toBeCloseTo(before * 0.6);
  });

  it('prerequisites are enforced', () => {
    expect(validate(start(), { type: 'research', research: 'seekerDTC' })).toMatch(/Gallium-light/);
  });
});

describe('staff, factions and decisions', () => {
  it('hiring a chief of procurement is possible and costs money', () => {
    const s = start();
    const c = s.strategy.candidates.find((x) => x.role === 'procurement')!;
    const after = apply(s, { type: 'hireStaff', candidate: c.id });
    expect(after.strategy.staff.procurement?.id).toBe(c.id);
    expect(after.treasury).toBeLessThan(s.treasury);
  });

  it('a struggling supplier raises a bailout decision that defaults if ignored', () => {
    const s = structuredClone(start(3));
    s.sites.lindellFuze.health = 5;
    let after = advanceDays(s, 30);
    const d = after.strategy.decisions.find((x) => x.kind === 'bailout' && x.site === 'lindellFuze');
    expect(d).toBeDefined();
    after = advanceDays(after, 30);
    expect(after.strategy.decisions.some((x) => x.id === d!.id)).toBe(false);
  });

  it('the fiscal year ends in a budget hearing', () => {
    const s = advanceDays(start(4), 360);
    expect(s.hearing?.questions.length).toBe(3);
  });

  it('objectives pay out when met', () => {
    let s = apply(start(5), { type: 'setPolicy', policy: { demilMethod: 'recycle' } });
    const t = s.treasury;
    s = advanceDays(s, 30);
    expect(s.strategy.objectives.find((o) => o.id === 'recycle')?.status).toBe('done');
    expect(s.treasury).toBeGreaterThan(t - 400);
    void lotQty;
  });
});
