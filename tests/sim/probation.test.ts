// Release 19.1: the Committee's warning, probation before dismissal (docs/mandate.md).
import { describe, expect, it } from 'vitest';
import { judge, probationTarget } from '../../src/sim/probation';
import { readiness } from '../../src/sim/selectors';
import { newSim } from '../../src/sim/setup';
import { openCampaign } from '../../src/sim/tick';
import type { SimState } from '../../src/sim/types';
import T from '../../src/sim/tuning/mandate.json';

const P = T.probation;
const quiet = () => {};
const start = (): SimState => openCampaign(newSim({ seed: 1 }));

describe('probation', () => {
  it('starts when confidence first falls to the warning mark, with a target above today’s readiness', () => {
    const s = start();
    s.confidence = P.warnAt;
    expect(judge(s, quiet)).toBe(false);
    expect(s.probation).toEqual({ until: s.history.length + P.months, target: probationTarget(readiness(s)) });
    expect(s.confidence).toBeGreaterThanOrEqual(P.confidence);
  });

  it('holds confidence at the mark while it runs', () => {
    const s = start();
    s.confidence = P.warnAt;
    judge(s, quiet);
    s.probation!.target = 2; // out of reach
    s.confidence = 0;
    expect(judge(s, quiet)).toBe(false);
    expect(s.confidence).toBe(P.confidence);
  });

  it('ends, with a little confidence back, once readiness reaches the target', () => {
    const s = start();
    s.confidence = P.warnAt;
    judge(s, quiet);
    s.probation!.target = readiness(s) - 0.01;
    const before = s.confidence;
    expect(judge(s, quiet)).toBe(false);
    expect(s.probation).toBeNull();
    expect(s.confidence).toBe(before + P.recoverBonus);
  });

  it('dismisses when the deadline passes short of the target', () => {
    const s = start();
    s.confidence = P.warnAt;
    judge(s, quiet);
    s.probation = { until: s.history.length, target: 2 };
    expect(judge(s, quiet)).toBe(true);
  });

  it('comes once a term: after that an empty confidence dismisses at once', () => {
    const s = start();
    s.probationTerm = s.term ?? 1;
    s.confidence = P.warnAt;
    expect(judge(s, quiet)).toBe(false);
    s.confidence = 0;
    expect(judge(s, quiet)).toBe(true);
  });

  it('keeps the target within its bounds', () => {
    expect(probationTarget(0)).toBe(P.targetMin);
    expect(probationTarget(1)).toBe(P.targetMax);
  });
});
