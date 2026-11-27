// The playtest feedback report (19.3.5): every question is listed, answers read plainly, and the game details are the
// player's choice and carry nothing personal.
import { describe, expect, it } from 'vitest';
import { newSim } from '../../src/sim/setup';
import { QUESTIONS, feedbackReport, gameContext, hasAnswer } from '../../src/game/feedback';

const VIEW = { w: 1440, h: 900 };

describe('playtest feedback', () => {
  it('lists every question, with "(no answer)" where the player left one blank', () => {
    const text = feedbackReport({ clear: 4, again: 'Maybe', confused: 'The Board.\nThe tenders.' }, null);
    for (const q of QUESTIONS) expect(text).toContain(q.text);
    expect(text).toContain('4 of 5');
    expect(text).toContain('Maybe');
    expect(text).toContain('  The Board.\n  The tenders.');
    expect(text.match(/\(no answer\)/g)?.length).toBe(QUESTIONS.length - 3);
    expect(text).not.toContain('About this game');
  });

  it('adds where the player is in the game only when asked', () => {
    const s = newSim({ seed: 7 });
    const context = gameContext(s, '19.3.5', VIEW);
    const text = feedbackReport({ fair: 3 }, context);
    expect(text).toContain('About this game');
    expect(text).toContain('Version: 19.3.5');
    expect(text).toContain('Window: 1440×900');
    expect(context.some((c) => c.startsWith('Mode: '))).toBe(true);
  });

  it('counts only real answers', () => {
    expect(hasAnswer({})).toBe(false);
    expect(hasAnswer({ broken: '   ' })).toBe(false);
    expect(hasAnswer({ pace: 'About right' })).toBe(true);
  });
});
