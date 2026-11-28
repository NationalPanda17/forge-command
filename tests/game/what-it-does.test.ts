// What a move does (20.6, design pass C6): each card's sentence must match what the rules then do.
import { describe, expect, it } from 'vitest';
import { newSim } from '../../src/sim/setup';
import { advanceDays, openCampaign, rampStep } from '../../src/sim/tick';
import { apply } from '../../src/sim/actions';
import { RUN_FACTOR, processRate } from '../../src/sim/selectors';
import { whatItDoes } from '../../src/game/whatItDoes';
import type { SimState } from '../../src/sim/types';

const game = () => advanceDays(openCampaign(newSim({ seed: 7 })), 40);
/** The first number in a sentence ("Adds 167 a day…" → 167). */
const firstNumber = (t: string) => Number(t.match(/[\d.]+/)![0]);

/** An arsenal line to work on: Corran's first process. */
function line(s: SimState) {
  const site = s.sites.corranWorks;
  return { site, index: 0, p: site.processes[0] };
}

describe('what a move does', () => {
  it('states the capacity an expansion adds, as the rules add it', () => {
    const s = game();
    const { index, p } = line(s);
    const a = { type: 'expand', site: 'corranWorks', process: index } as const;
    const text = whatItDoes(s, a)!;
    const next = apply(s, a);
    const ramp = next.sites.corranWorks.processes[index].ramp!;
    const added = ramp[ramp.length - 1].cap * RUN_FACTOR[p.run];
    expect(firstNumber(text)).toBeCloseTo(added, added >= 10 ? 0 : 1);
  });

  it('says how long new capacity takes, and the line has it all by then', () => {
    const s = game();
    const a = { type: 'expand', site: 'corranWorks', process: 0 } as const;
    const months = Number(whatItDoes(s, a)!.match(/all of it in about (\d+) month/)![1]);
    expect(months).toBe(Math.round(Math.ceil(0.9 / rampStep(s)) / 30));
    const before = s.sites.corranWorks.processes[0].capacity;
    const later = advanceDays(apply(s, a), (months + 1) * 30);
    // The new capacity has matured and joined the line.
    expect(later.sites.corranWorks.processes[0].capacity).toBeGreaterThan(before);
    expect(later.sites.corranWorks.processes[0].ramp ?? []).toHaveLength(0);
  });

  it('gives a shift change as the line’s output before and after', () => {
    const s = game();
    const { site, index } = line(s);
    const text = whatItDoes(s, { type: 'setRun', site: 'corranWorks', process: index, run: 'single' })!;
    const next = apply(s, { type: 'setRun', site: 'corranWorks', process: index, run: 'single' });
    const [from, to] = [...text.matchAll(/([\d.]+) (?:to|a day)/g)].map((m) => Number(m[1]));
    expect(from).toBeCloseTo(processRate(s, site, site.processes[index]), 1);
    expect(to).toBeCloseTo(processRate(next, next.sites.corranWorks, next.sites.corranWorks.processes[index]), 1);
  });

  it('says nothing for a move whose card already explains it', () => {
    expect(whatItDoes(game(), { type: 'cyberDefence' } as never)).toBeNull();
  });
});
