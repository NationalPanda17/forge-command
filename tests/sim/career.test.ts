// Release 19.2: the career (docs/career.md).
import { beforeEach, describe, expect, it } from 'vitest';
import { recommend } from '../../src/sim/automation';
import { CAREER, autoReappoint, canReappoint, careerPoints, rankOf, termPoints } from '../../src/sim/career';
import { ratchetFor } from '../../src/sim/mandate';
import { newSim } from '../../src/sim/setup';
import { advanceDays, openCampaign } from '../../src/sim/tick';
import { apply } from '../../src/sim/actions';
import type { SimState } from '../../src/sim/types';
import { careerBests, loadCareers, recordCareerTerm, unlocked } from '../../src/game/career';

let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
});

/** A short career term, played to its end. */
const finishedTerm = (careerId?: string): SimState => {
  const s = { ...openCampaign(newSim({ seed: 3, months: 12 })), treasury: 20000, ...(careerId ? { careerId } : {}) };
  return advanceDays(s, 12 * 30 + 1);
};

describe('career points and ranks', () => {
  it('scores later terms, harder settings and postings higher', () => {
    expect(termPoints(62, 1, 'normal', 'standard', false)).toBe(62);
    expect(termPoints(66, 2, 'normal', 'standard', false)).toBe(76);
    expect(termPoints(70, 3, 'normal', 'standard', false)).toBe(91);
    expect(careerPoints([62, 76, 91], false)).toBe(229);
    expect(careerPoints([62, 76, 91], true)).toBe(229 + CAREER.retireBonus);
    expect(termPoints(60, 1, 'hard', 'rebuild', true)).toBeGreaterThan(termPoints(60, 1, 'normal', 'standard', false));
    expect(termPoints(60, 1, 'normal', 'standard', false, true)).toBe(30);
  });

  it('ranks by points at the thresholds', () => {
    expect(rankOf(59)).toBe(0);
    expect(rankOf(60)).toBe(1);
    expect(rankOf(269)).toBe(3);
    expect(rankOf(559)).toBe(4);
    expect(rankOf(560)).toBe(5);
  });
});

describe('the Committee in a career', () => {
  it('reappoints only a passing term, and only in a career is there a bar', () => {
    const s = finishedTerm('c1');
    const plain = finishedTerm();
    expect(canReappoint(plain)).toBeNull();
    s.outcome = 'complete';
    // A term that scored below the bar is not reappointed.
    const low = { ...s, history: s.history.map((m) => ({ ...m, readiness: 0, confidence: 0 })), confidence: 0 };
    expect(canReappoint(low)).toMatch(/does not reappoint/);
  });

  it('tightens by one step a term, as before, up to the cap', () => {
    for (let term = 1; term <= 6; term++)
      for (let year = 0; year < 4; year++) {
        const s = { ...newSim({ seed: 1 }), term, termMonth: 0 } as SimState;
        expect(Math.min(3, year) + Math.min(CAREER.termRatchetMax, term - 1)).toBe(ratchetFor(s, year));
      }
  });

  it('serves on through the autopilot, and the new term is funded for the industry it inherits', () => {
    let s = finishedTerm('c2');
    if (s.outcome !== 'complete' || canReappoint(s)) return; // a seed that failed its term has nothing to test here
    const spend = s.history.slice(-3).reduce((a, m) => a + m.spend.purchases + m.spend.operations + m.spend.transport + (m.spend.energy ?? 0), 0) / 3;
    const act = autoReappoint(s)!;
    expect(act.type).toBe('secondTerm');
    s = apply(s, act);
    expect(s.term).toBe(2);
    expect(s.appropriation).toBeGreaterThanOrEqual(Math.round(spend * CAREER.budgetRebase.cover * 0.92) - 1);
  });
});

describe('the chief of staff', () => {
  it('saves a supplier that is the only home source of what it makes', () => {
    const s = { ...openCampaign(newSim({ seed: 1 })), treasury: 600 };
    const d = { id: 1, kind: 'bailout' as const, title: '', body: '', options: [{ id: 'bail', label: '', detail: '' }, { id: 'let', label: '', detail: '' }], fallback: 'let', site: 'brennockMine', value: 100 };
    expect(recommend(s, d).option).toBe('bail');
  });
});

describe('the career record', () => {
  it('records each term once, and survives a corrupt store', () => {
    const s = finishedTerm('c3');
    recordCareerTerm(s);
    recordCareerTerm(s);
    expect(loadCareers()).toHaveLength(1);
    expect(loadCareers()[0].terms).toHaveLength(1);
    localStorage.setItem('forge-command-careers', '{not json');
    expect(loadCareers()).toEqual([]);
  });

  it('opens postings as the record grows', () => {
    expect(unlocked('warFooting', [])).toBe(false);
    const rec = (terms: number, rank = 0) => ({ id: 'x', startedAt: '', country: '', world: null, scenario: 'standard' as const, difficulty: 'normal' as const, terms: Array.from({ length: terms }, (_, i) => ({ term: i + 1, score: 60, grade: 'C', points: 60, title: '', dismissed: false })), status: 'active' as const, points: 0, rank });
    expect(unlocked('warFooting', [rec(1)])).toBe(true);
    expect(unlocked('world', [rec(2)])).toBe(false);
    expect(unlocked('world', [rec(3)])).toBe(true);
    expect(unlocked('hard', [rec(1, 3)])).toBe(true);
    expect(careerBests([rec(2, 1)])).toEqual({ terms: 2, rank: 1, careers: 1 });
  });
});
