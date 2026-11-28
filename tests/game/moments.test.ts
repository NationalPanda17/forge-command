// The big moments (20.5, design pass C5): peak news and a round back at its goal are moments; routine good news is not.
import { describe, expect, it } from 'vitest';
import { newSim } from '../../src/sim/setup';
import { advanceDays, openCampaign } from '../../src/sim/tick';
import { isPeak, momentsBetween } from '../../src/game/moments';
import type { SimState } from '../../src/sim/types';

const game = () => advanceDays(openCampaign(newSim({ seed: 4 })), 65);
const withNews = (s: SimState, tone: 'good' | 'bad' | 'info', text: string, site?: string): SimState => {
  const n = structuredClone(s);
  n.feed.push({ day: n.day, tone, text, site });
  return n;
};

describe('big moments', () => {
  it('marks peak news, and leaves routine good news in the log', () => {
    expect(isPeak('Promise kept: readiness above 80%.', 'good')).toBe(true);
    expect(isPeak('Objective complete: Full racks. The Committee releases $200M.', 'good')).toBe(true);
    expect(isPeak('The Committee’s ask is met: raise GMLRS to 95% of its goal. It releases $40M.', 'good')).toBe(true);
    expect(isPeak('12 trainees qualify at Corran Valley Works.', 'good')).toBe(false);
    expect(isPeak('Promise kept: readiness above 80%.', 'info')).toBe(false);
  });

  it('finds the peaks filed between two states, with their site', () => {
    const s = game();
    const next = withNews(withNews(s, 'good', '12 trainees qualify at Corran Valley Works.'), 'good', 'Objective complete: A second source.', 'corranWorks');
    const found = momentsBetween(s, next);
    expect(found).toHaveLength(1);
    expect(found[0].text).toMatch(/^Objective complete/);
    expect(found[0].site).toBe('corranWorks');
  });

  it('marks a round climbing back to its goal at a month’s close', () => {
    const prev = game();
    const next = structuredClone(prev);
    const [before, now] = next.history.slice(-2);
    before.stock = { ...before.stock, sm6: 50 };
    before.target = { ...before.target, sm6: 100 };
    now.stock = { ...now.stock, sm6: 105 };
    now.target = { ...now.target, sm6: 100 };
    // The month closes between the two states.
    prev.history = prev.history.slice(0, -1);
    const found = momentsBetween(prev, next);
    expect(found.some((m) => /SM-6 is back at the Committee’s goal/.test(m.text))).toBe(true);
  });

  it('finds nothing between two different games', () => {
    const a = game();
    const b = withNews(advanceDays(openCampaign(newSim({ seed: 5 })), 65), 'good', 'Objective complete: A second source.');
    expect(momentsBetween(a, b)).toEqual([]);
  });
});
