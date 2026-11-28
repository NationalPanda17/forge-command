// The tutorial teaches by solving the opening incident (20.7, design pass C7): it finds the breakdown, waits for the
// player's answer, and the advisor's suggested move is an answer.
import { describe, expect, it } from 'vitest';
import { newSim } from '../../src/sim/setup';
import { advanceDays, openCampaign } from '../../src/sim/tick';
import { apply } from '../../src/sim/actions';
import { advise } from '../../src/sim/advisor';
import { STEPS, answered, openingTrouble } from '../../src/game/Tutorial';
import CORE from '../../src/sim/tuning/core.json';

const afterIncident = (seed: number) => advanceDays(openCampaign(newSim({ seed, scenario: 'tutorial', difficulty: 'easy' })), CORE.opening.incident.dayMax + 1);

describe('the tutorial and the opening incident', () => {
  it('finds the breakdown, and it is not answered until the player acts', () => {
    for (const seed of [1, 2, 3, 4]) {
      const s = afterIncident(seed);
      const t = openingTrouble(s);
      expect(t, `seed ${seed}`).not.toBeNull();
      expect(t!.materials.length).toBeGreaterThan(0);
      expect(answered(s), `seed ${seed}`).toBe(false);
    }
  });

  it('counts the advisor’s suggested move as the answer', () => {
    for (const seed of [1, 2, 3, 4]) {
      const s = afterIncident(seed);
      const cover = advise(s, 20).find((a) => a.id.startsWith('cover-'));
      expect(cover?.action, `seed ${seed}`).toBeDefined();
      expect(answered(apply(s, cover!.action!)), `seed ${seed}`).toBe(true);
    }
  });

  it('stops suggesting a second source once one is being qualified', () => {
    for (const seed of [1, 2, 3, 4]) {
      const s = afterIncident(seed);
      const cover = advise(s, 20).find((a) => a.id.startsWith('cover-'));
      if (cover?.action?.type !== 'qualify') continue;
      const after = apply(s, cover.action);
      expect(advise(after, 20).some((a) => a.id.startsWith('cover-')), `seed ${seed}`).toBe(false);
    }
  });

  it('teaches with steps that ask for something, not a tour of every tab', () => {
    const titles = STEPS.map((x) => x.title);
    expect(titles).toContain('Trouble is coming');
    expect(titles).toContain('Answer it');
    expect(STEPS.length).toBeLessThanOrEqual(8);
  });
});
