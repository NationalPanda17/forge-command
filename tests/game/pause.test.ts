import { describe, expect, it } from 'vitest';
import { DEFAULT_PAUSE, pauseFor } from '../../src/game/events';
import type { FeedItem } from '../../src/sim/types';

const item = (text: string, tone: FeedItem['tone']): FeedItem => ({ day: 40, text, tone }) as FeedItem;

describe('16.1 pause rules', () => {
  it('does not stop the clock for minor news by default', () => {
    // Arrange: an alert that is none of the named kinds.
    const alerts = [item('A delegation from the coast visits the works.', 'info')];
    // Act and assert
    expect(pauseFor(DEFAULT_PAUSE, alerts, false)).toBeNull();
  });

  it('pauses for the worst event and counts the others that came with it', () => {
    // Arrange: three events at once, two of which pause.
    const alerts = [item('Accident at Halvard Pits: work is suspended.', 'bad'), item('Budget hearing: the Committee sits.', 'warn'), item('A delegation visits.', 'info')];
    // Act
    const hit = pauseFor(DEFAULT_PAUSE, alerts, false);
    // Assert
    expect(hit?.text).toMatch(/^Accident/);
    expect(hit && 'more' in hit ? hit.more : 0).toBe(1);
  });
});
