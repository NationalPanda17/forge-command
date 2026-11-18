import { describe, expect, it } from 'vitest';
import { apply, validate } from '../../src/sim/actions';
import { FOUND_DAYS, INHOUSE_DAYS, PLOT_IDS, variantOf } from '../../src/sim/industry';
import { pathBetween } from '../../src/sim/graph';
import { recipeInputs } from '../../src/sim/strategy';
import { newSim } from '../../src/sim/setup';
import { advanceDays, openCampaign } from '../../src/sim/tick';

const start = (seed = 1) => ({ ...openCampaign(newSim({ seed })), treasury: 50000 });

describe('building your own industry', () => {
  it('starts with five open plots, closed and unreachable', () => {
    const s = start();
    expect(PLOT_IDS).toHaveLength(5);
    for (const id of PLOT_IDS) expect(s.sites[id].status).toBe('closed');
  });

  it('a founded plant gets its spur, is built, opens and makes parts', () => {
    let s = start();
    s = apply(s, { type: 'found', plot: 'plotAshford', recipe: 'motorCasting' });
    expect(s.sites.plotAshford.status).toBe('building');
    expect(pathBetween('depotCentral', 'plotAshford')).not.toBeNull();
    expect(validate(s, { type: 'found', plot: 'plotAshford', recipe: 'apElectrolysis' })).toMatch(/already/);
    s = apply(s, { type: 'hire', site: 'plotAshford', count: 320 });
    s = advanceDays(s, FOUND_DAYS + 60);
    expect(s.sites.plotAshford.status).toBe('active');
    expect(s.sites.plotAshford.processes[0].lastOutput).toBeGreaterThan(0);
  });

  it('an in-house line is fitted out at an arsenal, then ramps up', () => {
    let s = start();
    s = apply(s, { type: 'inhouse', site: 'corranWorks', recipe: 'seekerRFAssembly' });
    const p = () => s.sites.corranWorks.processes.find((x) => x.recipe === 'seekerRFAssembly')!;
    expect(p()).toBeDefined();
    s = advanceDays(s, 30);
    expect(p().maturity).toBe(0);
    s = advanceDays(s, INHOUSE_DAYS);
    expect(p().maturity).toBeGreaterThan(0);
    expect(validate(s, { type: 'inhouse', site: 'cinderFlats', recipe: 'seekerRFAssembly' })).toMatch(/arsenals/);
  });

  it('a variant changes the bill of materials, kill odds and service life', () => {
    let s = start();
    const before = recipeInputs(s, 'pac3').rocketMotor!;
    s = apply(s, { type: 'design', line: 'pac3', variant: 'extended' });
    expect(validate(s, { type: 'design', line: 'sm6', variant: 'lean' })).toMatch(/busy/);
    s = advanceDays(s, 125);
    // The design is done, but it goes into service only after its test firings.
    expect(s.variants.pac3).toBeUndefined();
    const t = s.tests.find((x) => x.line === 'pac3' && x.variant === 'extended')!;
    expect(t).toBeDefined();
    t.odds = 1;
    s = advanceDays(s, 120);
    expect(s.variants.pac3).toBe('extended');
    expect(recipeInputs(s, 'pac3').rocketMotor!).toBeCloseTo(before * 1.3);
    expect(variantOf(s, 'pac3').pk).toBeGreaterThan(1);
    expect(variantOf(s, 'sm6').shelf).toBe(1);
  });
});
