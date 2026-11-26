import { describe, expect, it } from 'vitest';
import T from '../../src/sim/tuning/mandate.json';
import { lin, mandateGoals, measure, projectMandate, ratchetFor, scoreFrom, scoreMonths } from '../../src/sim/mandate';
import { termReport } from '../../src/sim/analytics';
import { emptyMonth, newSim } from '../../src/sim/setup';
import { advanceDays, openCampaign } from '../../src/sim/tick';
import { PRESETS } from '../../src/sim/automation';
import type { MonthReport } from '../../src/sim/types';

/** A month with the figures the mandate reads, the rest empty. */
function month(i: number, f: Partial<MonthReport>): MonthReport {
  return { ...emptyMonth(i), priceIndex: 1, ...f } as MonthReport;
}

describe('the Committee’s mandate', () => {
  it('scores a goal from nothing at its zero point to full marks at its full point, either way round', () => {
    // Arrange, act and assert: readiness rises to full; value for money falls to full.
    expect(lin(0.65, 0.65, 0.95)).toBe(0);
    expect(lin(0.95, 0.65, 0.95)).toBe(1);
    expect(lin(0.8, 0.65, 0.95)).toBeCloseTo(0.5);
    expect(lin(1.1, 1.1, 0.75)).toBe(0);
    expect(lin(0.75, 1.1, 0.75)).toBe(1);
    expect(lin(0.5, 1.1, 0.75)).toBe(1);
  });

  it('measures readiness against the year’s thresholds, which tighten each fiscal year up to the cap', () => {
    // Arrange
    const s = openCampaign(newSim({ seed: 1 }));
    const ms = [0, 1, 2].map((i) => month(i, { readiness: 0.95 }));
    // Act
    const year0 = measure(s, 'readiness', ms, 0).score;
    const year1 = measure(s, 'readiness', ms, 1).score;
    // Assert: full marks in year one; the same racks fall short once the bar has risen.
    expect(year0).toBeCloseTo(1, 9);
    expect(year1).toBeLessThan(1);
    expect(ratchetFor(s, 1)).toBe(1);
    expect(ratchetFor(s, 9)).toBe(T.ratchetMax);
    expect(ratchetFor({ ...s, scenario: 'tutorial' }, 3)).toBe(0);
  });

  it('gives no credit for the other goals while the racks are empty', () => {
    // Arrange: thrifty, fair and tidy, but nothing on the racks.
    const s = openCampaign(newSim({ seed: 2 }));
    const ms = [0, 1, 2].map((i) => month(i, { readiness: 0.2, jobsBalance: 0.99, townMood: 80, cover: 9 }));
    // Act
    const r = scoreMonths(s, ms, 0);
    // Assert
    for (const g of r.goals) expect(g.score).toBe(0);
    expect(r.total).toBe(0);
  });

  it('weights the scenario’s goals to one, and drops what the map cannot measure', () => {
    // Arrange, act and assert
    for (const scenario of ['standard', 'warFooting', 'sanctions', 'rebuild', 'tutorial'] as const) {
      const goals = mandateGoals(openCampaign(newSim({ seed: 3, scenario })));
      expect(goals.reduce((a, g) => a + g.weight, 0)).toBeCloseTo(1);
      expect(goals.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('builds the term score from the mandate, confidence above the line, the shield and capped objectives', () => {
    // Arrange
    const s = openCampaign(newSim({ seed: 4 }));
    // Act
    const parts = scoreFrom(s, 0.6, 80, 0.85, 9, false);
    const fired = scoreFrom(s, 0.6, 80, 0.85, 9, true);
    // Assert: 55 × 0.6 + 20 × (80 − 50) / 50 + 15 × 0.85 + min(5, 2 × 9) on Normal.
    expect(parts.score).toBe(Math.round(33 + 12 + 12.75 + 5));
    expect(parts.grade).toBe('C');
    expect(fired.score).toBe(parts.score - T.score.dismissed);
  });

  it('counts foreign purchases apart, without adding to what the term spent', () => {
    // Arrange
    let s = openCampaign(newSim({ seed: 5 }));
    // Act: three months of a game left to its own devices.
    s = advanceDays({ ...s, confidence: 80 }, 90);
    // Assert: wherever foreign buying shows, it is part of purchases, never more.
    for (const m of s.history) expect(m.foreign ?? 0).toBeLessThanOrEqual(m.spend.purchases + 1e-9);
    const report = termReport(s);
    expect(report.spend).toBeCloseTo(s.history.reduce((a, m) => a + Object.values(m.spend).reduce((x, y) => x + y, 0), 0));
  });

  it('projects on Home the same mandate score the term report gives at the end of a full term', () => {
    // Arrange: a two-year term run by the chief of staff to its end.
    let s = openCampaign(newSim({ seed: 6, months: 24, automation: PRESETS.full }));
    while (!s.over) s = advanceDays(s, 30);
    // Act
    const projected = projectMandate(s);
    const report = termReport(s);
    // Assert
    expect(projected.parts.mandate).toBeCloseTo(report.mandate, 6);
    expect(['A', 'B', 'C', 'D', 'F']).toContain(projected.parts.grade);
  });
});
