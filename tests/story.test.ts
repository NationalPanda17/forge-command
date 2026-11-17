import { describe, expect, it } from 'vitest';
import { RESEARCH_IDS, STORY, endTurn, newGame, playTurn, pressureOf, rulesOf, type Action, type GameState } from '../src/engine';

const resolveAll = (s: GameState): Action[] => s.decisions.map((d) => ({ type: 'resolveDecision', decision: d.id, option: d.fallback }) as Action);

describe('story objectives', () => {
  it('every scenario starts with its own open objectives', () => {
    for (const sc of Object.keys(STORY) as (keyof typeof STORY)[]) {
      const s = newGame({ seed: 1, scenario: sc });
      expect(s.objectives.length).toBe(STORY[sc].objectives.length);
      expect(s.objectives.every((o) => o.status === 'open')).toBe(true);
    }
  });

  it('completing an objective pays its reward once', () => {
    const s = structuredClone(newGame({ seed: 2 }));
    s.suppliers.vantor.qualified = true;
    const after = endTurn(s);
    expect(after.objectives.find((o) => o.id === 'std-source')?.status).toBe('done');
    expect(after.history[0].messages.some((m) => m.text.startsWith('Objective complete: A second source'))).toBe(true);
    const again = endTurn(after);
    expect(again.history[1].messages.some((m) => m.text.startsWith('Objective complete: A second source'))).toBe(false);
  });

  it('missing a deadline fails the objective', () => {
    let s = newGame({ seed: 3, difficulty: 'easy' });
    for (let i = 0; i < 12; i++) s = playTurn(s, resolveAll(s));
    expect(s.objectives.find((o) => o.id === 'std-source')?.status).toBe('failed');
  });

  it('chapter beats from the deputy arrive on schedule', () => {
    let s = newGame({ seed: 4, difficulty: 'easy' });
    for (let i = 0; i < 7; i++) s = playTurn(s, resolveAll(s));
    expect(s.history.some((h) => h.messages.some((m) => m.text.startsWith('Deputy Director')))).toBe(true);
  });
});

describe('modifiers and sandbox', () => {
  it('austerity cuts the budget by a fifth', () => {
    const plain = newGame({ seed: 5 });
    const tight = newGame({ seed: 5, modifiers: ['austerity'] });
    expect(tight.appropriation).toBe(Math.round(plain.appropriation * 0.8));
  });

  it('endless campaigns have no end date', () => {
    expect(newGame({ seed: 5, modifiers: ['endless'] }).months).toBeGreaterThan(1000);
  });

  it('embargo world makes suppliers less reliable', () => {
    const s = newGame({ seed: 5, modifiers: ['embargoWorld'] });
    expect(rulesOf(s).shockChance).toBeGreaterThan(rulesOf(newGame({ seed: 5 })).shockChance);
  });

  it('sandbox rules change money, pressure, reserve and research', () => {
    const custom = { treasuryMult: 2, budgetMult: 1.5, pressureMult: 1.5, crisisMult: 0, eventMult: 0, reserveMonths: 6, allResearch: true };
    const s = newGame({ seed: 6, custom });
    const plain = newGame({ seed: 6 });
    expect(s.treasury).toBe(plain.treasury * 2);
    expect(pressureOf(s)).toBeCloseTo(pressureOf(plain) * 1.5);
    expect(s.research.done).toHaveLength(RESEARCH_IDS.length);
    expect(rulesOf(s).crisisChance).toBe(0);
    expect(s.reserves.pac3.stock + Object.values(s.theaters).reduce((a, t) => a + t.depot.pac3.full, 0)).toBeGreaterThan(
      plain.reserves.pac3.stock + Object.values(plain.theaters).reduce((a, t) => a + t.depot.pac3.full, 0),
    );
  });
});
