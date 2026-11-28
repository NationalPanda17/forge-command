// The opening incident of a quiet scenario (20.2, design pass C2): one supplier breaks down in the first weeks. The
// sandbox, the story and the scenarios with their own pressure are left alone.
import { describe, expect, it } from 'vitest';
import { newSim } from '../../src/sim/setup';
import { advanceDays, openCampaign } from '../../src/sim/tick';
import CORE from '../../src/sim/tuning/core.json';
import { advise } from '../../src/sim/advisor';

const T = CORE.opening.incident;
const incident = (s: { feed: { day: number; text: string }[] }) => s.feed.find((f) => f.day <= T.dayMax && /output down to/.test(f.text));

describe('the opening', () => {
  it('breaks one supplier down between the first and last opening day in Peacetime and the tutorial', () => {
    for (const scenario of ['standard', 'tutorial'] as const) {
      for (const seed of [1, 2, 3]) {
        const s = advanceDays(openCampaign(newSim({ seed, scenario })), T.dayMax + 1);
        const hit = incident(s);
        expect(hit, `${scenario} seed ${seed}`).toBeDefined();
        expect(hit!.day).toBeGreaterThanOrEqual(T.dayMin);
      }
    }
  });

  it('hits a supplier you hold a contract with, and the advisor says what to do about it', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = advanceDays(openCampaign(newSim({ seed })), T.dayMax + 1);
      const down = s.contracts.filter((c) => s.sites[c.site].disruptionDays > 0);
      expect(down.length, `seed ${seed}`).toBeGreaterThan(0);
      expect(advise(s, 20).some((a) => a.id.startsWith('cover-')), `seed ${seed}`).toBe(true);
    }
  });

  it('leaves the story, the sandbox and War footing without the opening incident', () => {
    const story = advanceDays(openCampaign(newSim({ seed: 2, story: true })), T.dayMax + 1);
    const sandbox = advanceDays(openCampaign(newSim({ seed: 2, mode: 'sandbox' })), T.dayMax + 1);
    const war = advanceDays(openCampaign(newSim({ seed: 2, scenario: 'warFooting' })), T.dayMax + 1);
    // Ordinary breakdowns cannot happen before day 60, so any breakdown this early would be the opening incident.
    for (const s of [story, sandbox, war]) expect(incident(s)).toBeUndefined();
  });

  it('is the same incident every time for the same seed', () => {
    const a = advanceDays(openCampaign(newSim({ seed: 9 })), T.dayMax + 1);
    const b = advanceDays(openCampaign(newSim({ seed: 9 })), T.dayMax + 1);
    expect(incident(a)?.text).toBe(incident(b)?.text);
    expect(a.rng).toBe(b.rng);
  });
});
