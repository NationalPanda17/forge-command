// Praise is earned (20.3, design pass C3): in a first term, the Committee's praise ramps up over the first months, so
// an inherited reserve does not lift confidence on its own. Criticism, and later terms, are unchanged.
import { afterEach, describe, expect, it } from 'vitest';
import { newSim } from '../../src/sim/setup';
import { advanceDays, openCampaign } from '../../src/sim/tick';
import { mandateConfidence } from '../../src/sim/mandate';
import T from '../../src/sim/tuning/mandate.json';

const ramp = T.confidence.earnRamp;
const saved = { ...ramp };
afterEach(() => Object.assign(ramp, saved));

/** The Committee's mandate term for a state, with the ramp as tuned, and with it switched off (start at 1). */
function both(s: ReturnType<typeof newSim>, ready: number) {
  const on = mandateConfidence(s, ready).mandate;
  ramp.start = 1;
  const off = mandateConfidence(s, ready).mandate;
  Object.assign(ramp, saved);
  return { on, off };
}

/** A Peacetime game one month in: one month on file, readiness high, so the Committee is inclined to praise. */
// The Committee judges at the month's close, with the month filled in: here the month just filed stands in for it.
const oneMonthIn = () => {
  const s = advanceDays(openCampaign(newSim({ seed: 2 })), 31);
  s.month = structuredClone(s.history[s.history.length - 1]);
  return s;
};

describe('earned confidence', () => {
  it('gives a new director only part of the praise in the first months', () => {
    const s = oneMonthIn();
    const { on, off } = both(s, 0.97);
    expect(off).toBeGreaterThan(0);
    const filed = s.history.length;
    expect(on).toBeCloseTo(off * (ramp.start + ((1 - ramp.start) * filed) / ramp.months), 6);
    expect(on).toBeLessThan(off);
  });

  it('never softens criticism', () => {
    const s = oneMonthIn();
    // A director far below what the Committee expects: the mandate term is negative, and the ramp leaves it alone.
    T.confidence.expect.normal += 1;
    try {
      const { on, off } = both(s, 0.97);
      expect(off).toBeLessThan(0);
      expect(on).toBe(off);
    } finally {
      T.confidence.expect.normal -= 1;
    }
  });

  it('leaves a second term alone', () => {
    const s = oneMonthIn();
    s.term = 2;
    // Easier expectations, so a second-term director is being praised and the ramp would show if it applied.
    T.confidence.expect.normal -= 0.3;
    try {
      const { on, off } = both(s, 0.97);
      expect(off).toBeGreaterThan(0);
      expect(on).toBe(off);
    } finally {
      T.confidence.expect.normal += 0.3;
    }
  });
});
