import { describe, expect, it } from 'vitest';
import { validate } from '../../src/sim/actions';
import { safeAdvice } from '../../src/sim/advisor';
import { startChain } from '../../src/sim/living';
import { newSim } from '../../src/sim/setup';
import { advanceDays, openCampaign } from '../../src/sim/tick';
import { SITES } from '../../src/sim/world';
import type { SimState } from '../../src/sim/types';

const noFeed = () => {};

/** A campaign whose private mines, quarries and wells have all closed, and whose component suppliers are unqualified. */
function exhausted(): SimState {
  const s = openCampaign(newSim({ seed: 7 }));
  for (const d of SITES) {
    if (d.owner === 'private' && ['mine', 'quarry', 'well'].includes(d.kind)) s.sites[d.id].status = 'closed';
    if (d.owner === 'private' && d.kind === 'components') s.sites[d.id].qualified = false;
  }
  return s;
}

describe('16.1 stability', () => {
  it('starts no safety accident when every private mine, quarry and well has closed', () => {
    // Arrange
    const s = exhausted();
    // Act and assert: once threw "Cannot read properties of undefined (reading 'id')" in a long endless sandbox.
    expect(() => startChain(s, 'safety', noFeed)).not.toThrow();
    expect(s.chains.some((c) => c.kind === 'safety')).toBe(false);
  });

  it('starts no quality escape when no component supplier is qualified and active', () => {
    // Arrange
    const s = exhausted();
    const decisions = s.strategy.decisions.length;
    // Act and assert
    expect(() => startChain(s, 'quality', noFeed)).not.toThrow();
    expect(s.chains.some((c) => c.kind === 'quality')).toBe(false);
    expect(s.strategy.decisions.length).toBe(decisions);
  });

  it('turns down malformed actions that could only come from an edited save or a script', () => {
    // Arrange
    const s = openCampaign(newSim({ seed: 5 }));
    const sandbox = openCampaign(newSim({ seed: 5, mode: 'sandbox' }));
    const own = SITES.find((d) => d.owner === 'state' && s.sites[d.id].processes.length)!.id;
    const supplier = Object.keys(s.sites).find((id) => validate(s, { type: 'signContract', site: id, material: 'steel', perDay: 1, months: 12 }) === null);
    // Act and assert
    expect(validate(s, { type: 'setRun', site: own, process: 0, run: 'overdrive' as never })).toMatch(/shift pattern/);
    expect(validate(s, { type: 'programme', line: 'pac3', years: 4 as never })).toMatch(/3 or 5 years/);
    if (supplier) expect(validate(s, { type: 'signContract', site: supplier, material: 'steel', perDay: 1, months: 18 as never })).toMatch(/12, 24 or 36/);
    expect(validate({ ...s, story: undefined } as never, { type: 'storyBriefed' })).toMatch(/No briefing/);
    expect(validate(sandbox, { type: 'sandbox', op: { kind: 'money', amount: Number.NaN } } as never)).toMatch(/amount/);
    expect(validate(sandbox, { type: 'sandbox', op: { kind: 'money', amount: Infinity } } as never)).toMatch(/amount/);
    expect(validate(sandbox, { type: 'sandbox', op: { kind: 'money', amount: 500 } } as never)).toBeNull();
  });

  it('answers the waiting decision cards in the safe advice, instead of leaving them to their defaults', () => {
    // Arrange: play on until the Board has a card waiting.
    let s = { ...openCampaign(newSim({ seed: 3 })), treasury: 3000 };
    while (!s.strategy.decisions.length && s.day < 400) s = advanceDays(s, 10);
    expect(s.strategy.decisions.length).toBeGreaterThan(0);
    // Act
    const advice = safeAdvice(s);
    // Assert
    for (const d of s.strategy.decisions) expect(advice.some((a) => a.type === 'decide' && a.decision === d.id)).toBe(true);
  });
});
