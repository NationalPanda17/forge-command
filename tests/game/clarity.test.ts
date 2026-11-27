import { describe, expect, it } from 'vitest';
import { alertGroups } from '../../src/game/Alerts';
import { underWay } from '../../src/game/Outliner';
import { resolvePanel } from '../../src/game/nav';
import { newSim } from '../../src/sim/setup';
import { openCampaign } from '../../src/sim/tick';

describe('17.1 command clarity', () => {
  it('groups alerts by the tab that fixes them, worst first, and leaves out mere information', () => {
    // Arrange
    const items = [
      { tone: 'warn' as const, text: 'Hire at Corran.', panel: 'staff' as const },
      { tone: 'info' as const, text: 'Engineers idle.', panel: 'strategy' as const },
      { tone: 'bad' as const, text: 'Blackout risk.', panel: 'power' as const },
      { tone: 'warn' as const, text: 'Short of crews.', panel: 'staff' as const },
    ];
    // Act
    const groups = alertGroups(items);
    // Assert
    expect(groups.map((g) => g.panel)).toEqual(['power', 'staff']);
    expect(groups[1].texts).toHaveLength(2);
    expect(groups.some((g) => g.panel === 'strategy')).toBe(false);
  });

  it('lists what is under way, a crisis first and then the soonest to finish', () => {
    // Arrange
    const s = openCampaign(newSim({ seed: 2 }));
    s.strategy.research.active = { id: 'apkws', days: 90, total: 120 };
    s.network.projects = [{ id: 1, kind: 'harden', target: Object.keys(s.sites)[0], days: 20, total: 60, cost: 10 }];
    s.crisis = { id: 'x', name: 'Northern crisis', region: 'north', family: 'air', phase: 'warning', days: 40, intensity: 1 } as never;
    // Act
    const list = underWay(s);
    // Assert
    expect(list[0].key).toBe('crisis');
    expect(list.findIndex((x) => x.key === 'p1')).toBeLessThan(list.findIndex((x) => x.key === 'research'));
    expect(list.find((x) => x.key === 'research')?.done).toBeCloseTo(0.25);
  });

  it('sends links to the folded Watch and Feed tabs to Home and the Log', () => {
    // Act and assert
    expect(resolvePanel('watch')).toBe('home');
    expect(resolvePanel('feed')).toBe('inbox');
    expect(resolvePanel('markets')).toBe('markets');
  });
});
