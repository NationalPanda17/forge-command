import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { validate } from '../../src/sim/actions';
import { CHAPTER_DAYS } from '../../src/sim/story';
import { newSim } from '../../src/sim/setup';
import { advanceDays, compactHistory, openCampaign } from '../../src/sim/tick';
import type { MonthReport } from '../../src/sim/types';
import { Briefing } from '../../src/game/StoryPanel';

describe('15.1 launch fixes', () => {
  it('opens no chapter briefing for a director dismissed on the last day of a chapter', () => {
    // Arrange: a story game kept healthy to the day before chapter one ends, then the Committee gives up.
    let s = { ...openCampaign(newSim({ seed: 4, story: true })), treasury: 50000, confidence: 100 };
    while (s.day < CHAPTER_DAYS - 1) {
      s.story!.briefing = null;
      s.confidence = 100;
      s = advanceDays(s, Math.min(10, CHAPTER_DAYS - 1 - s.day));
    }
    s.story!.briefing = null;
    s.confidence = 0;
    s.treasury = -20000;
    // Act: the month (and the chapter) closes.
    s = advanceDays(s, 1);
    // Assert: dismissed, and no briefing stands open over the term report.
    expect(s.over).toBe(true);
    expect(s.outcome).toBe('dismissed');
    expect(s.story?.briefing ?? null).toBeNull();
    expect(renderToString(createElement(Briefing, { state: s, act: () => {} }))).toBe('');
  });

  it('turns down a contract or tender for an infinite quantity', () => {
    // Arrange
    const s = { ...openCampaign(newSim({ seed: 5 })), treasury: 50000 };
    const site = Object.keys(s.sites).find((id) => validate(s, { type: 'signContract', site: id, material: 'steel', perDay: 1, months: 12 }) === null);
    // Act and assert
    expect(validate(s, { type: 'openTender', material: 'steel', perDay: Infinity, months: 12 })).toMatch(/above zero/);
    if (site) expect(validate(s, { type: 'signContract', site, material: 'steel', perDay: Infinity, months: 12 })).toMatch(/above zero/);
  });

  it('rounds months two years back and drops ten-year-old plant detail, keeping one entry a month', () => {
    // Arrange: 121 months of reports with long decimals and a plant breakdown.
    const s = openCampaign(newSim({ seed: 6 }));
    const month = (i: number): MonthReport => ({ ...structuredClone(s.month), month: i, readiness: 0.123456789, plantOutput: { a: 1.23456 } });
    const h: MonthReport[] = [];
    // Act: add them one at a time, as the game does.
    for (let i = 0; i < 121; i++) {
      h.push(month(i));
      compactHistory(h);
    }
    // Assert
    expect(h).toHaveLength(121);
    expect(h[0].readiness).toBe(0.12);
    expect(h[0].plantOutput).toBeUndefined();
    expect(h[90].plantOutput).toEqual({ a: 1.23 });
    expect(h[110].plantOutput).toEqual({ a: 1.23456 });
    expect(h[120].readiness).toBe(0.123456789);
  });

  it('keeps a long game playable once its history has been compacted', () => {
    // Arrange: three years, so the oldest months are rounded.
    let s = { ...openCampaign(newSim({ seed: 7, months: 48 })), treasury: 50000, confidence: 90 };
    // Act
    for (let i = 0; i < 36 && !s.over; i++) {
      s.confidence = Math.max(s.confidence, 60);
      s = advanceDays(s, 30);
    }
    // Assert
    expect(s.history.length).toBeGreaterThanOrEqual(36);
    expect(JSON.stringify(s)).not.toMatch(/NaN|null,"readiness"/);
    expect(s.history[0].readiness).toBe(Math.round(s.history[0].readiness * 100) / 100);
  });
});
