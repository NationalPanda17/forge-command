import { describe, expect, it } from 'vitest';
import { apply } from '../../src/sim/actions';
import { CHAPTERS, CHAPTER_DAYS, chapterGoals, epilogue } from '../../src/sim/story';
import { newSim } from '../../src/sim/setup';
import { advanceDays, openCampaign } from '../../src/sim/tick';

describe('the story campaign', () => {
  it('opens with the first briefing', () => {
    const s = openCampaign(newSim({ seed: 1, story: true }));
    expect(s.story?.chapter).toBe(0);
    expect(s.story?.briefing).toBe(0);
    expect(chapterGoals(s)).toHaveLength(3);
    const r = apply(s, { type: 'storyBriefed' });
    expect(r.story?.briefing).toBeNull();
  });

  it('closes each chapter after a year, records the result, prints a special Courier and opens the next', () => {
    let s = { ...openCampaign(newSim({ seed: 2, story: true })), treasury: 20000 };
    s = advanceDays(s, CHAPTER_DAYS + 1);
    expect(s.story?.results).toHaveLength(1);
    expect(s.story?.chapter).toBe(1);
    expect(s.story?.briefing).toBe(1);
    expect(s.news.some((e) => e.special?.includes(CHAPTERS[0].title))).toBe(true);
    // Chapter two brings the rival forward.
    s = advanceDays(s, 20);
    expect(s.rival.known.length).toBeGreaterThan(0);
  });

  it('runs four chapters over the term and ends with an epilogue', () => {
    let s = { ...openCampaign(newSim({ seed: 3, story: true })), treasury: 50000, confidence: 100 };
    for (let i = 0; i < 4 * 12 && !s.over; i++) {
      s.confidence = Math.max(s.confidence, 60);
      s = advanceDays(s, 30);
    }
    expect(s.story?.results).toHaveLength(4);
    expect(epilogue(s).length).toBeGreaterThan(20);
  });
});
