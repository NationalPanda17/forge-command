// Running costs against the budget (20.1, design pass C0): the running gap, the reserve that grows with it, the
// runway, and the advisor's warning.
import { describe, expect, it } from 'vitest';
import { newSim } from '../../src/sim/setup';
import { advanceDays, openCampaign } from '../../src/sim/tick';
import { advise } from '../../src/sim/advisor';
import { prudentReserve, runningGap, runway } from '../../src/sim/spending';
import DEPTH from '../../src/sim/tuning/depth.json';
import type { SimState } from '../../src/sim/types';

const T = DEPTH.spending;

/** A game three months in, with each of those months' recurring costs set to `monthly` and no export sales. */
function withCosts(monthly: number, treasury: number): SimState {
  const s = advanceDays(openCampaign(newSim({ seed: 3 })), 95);
  for (const h of s.history.slice(-T.gapMonths)) {
    h.spend = { purchases: monthly, operations: 0, transport: 0, projects: 500, demil: 0, energy: 0 };
    h.income = { appropriation: s.appropriation, sales: 0 };
  }
  s.treasury = treasury;
  return s;
}

describe('running costs', () => {
  it('measures the gap from recurring costs only, ignoring one-off projects', () => {
    const s = withCosts(0, 1000);
    expect(runningGap(withCosts(s.appropriation + 40, 1000))).toBeCloseTo(40, 5);
    expect(runningGap(withCosts(s.appropriation - 40, 1000))).toBeCloseTo(-40, 5);
  });

  it('keeps a year of the gap on top of the base reserve, and only the base when the budget covers the costs', () => {
    const base = 300;
    const over = withCosts(0, 1000);
    const short = withCosts(over.appropriation + 25, 1000);
    expect(prudentReserve(short, base)).toBeCloseTo(base + T.reserveMonths * 25, 5);
    expect(prudentReserve(withCosts(over.appropriation - 25, 1000), base)).toBe(base);
  });

  it('gives the months left at the current gap, or none when there is no gap', () => {
    const s = withCosts(0, 600);
    expect(runway(withCosts(s.appropriation + 50, 600))).toBeCloseTo(12, 5);
    expect(runway(withCosts(s.appropriation - 10, 600))).toBeNull();
  });

  it('warns on Home when the treasury would run out within the warning window, and not otherwise', () => {
    const s = withCosts(0, 600);
    const warned = advise(withCosts(s.appropriation + 50, 600), 40);
    expect(warned.some((a) => a.id === 'deficit')).toBe(true);
    // A year and a half of money at this gap is beyond the window: no warning yet.
    const far = advise(withCosts(s.appropriation + 50, 50 * (T.warnRunwayMonths + 6)), 40);
    expect(far.some((a) => a.id === 'deficit')).toBe(false);
    // A gap too small to matter is not worth a card.
    const tiny = advise(withCosts(s.appropriation + T.warnMinGap / 2, 30), 40);
    expect(tiny.some((a) => a.id === 'deficit')).toBe(false);
  });
});
