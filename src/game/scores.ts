// Weekly challenges and local best scores, kept in this browser.
import { termReport } from '../sim/analytics';
import { seedFrom } from '../sim/rng';
import type { Difficulty, ScenarioId, SimState } from '../sim/types';

/** ISO week label, like 2026-W47. */
export function isoWeek(d = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const start = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - start.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const ROTATION: { scenario: ScenarioId; difficulty: Difficulty }[] = [
  { scenario: 'standard', difficulty: 'normal' },
  { scenario: 'warFooting', difficulty: 'normal' },
  { scenario: 'sanctions', difficulty: 'normal' },
  { scenario: 'rebuild', difficulty: 'hard' },
  { scenario: 'standard', difficulty: 'hard' },
  { scenario: 'warFooting', difficulty: 'hard' },
];

/** Everyone gets the same campaign in the same week: two years, a fixed seed and a set scenario. */
export function challengeFor(week: string): { seed: number; scenario: ScenarioId; difficulty: Difficulty; months: number } {
  const seed = seedFrom(`forge-command-${week}`);
  return { seed, ...ROTATION[seed % ROTATION.length], months: 24 };
}

export interface ScoreEntry {
  key: string;
  date: string;
  score: number;
  grade: string;
  scenario: ScenarioId;
  difficulty: Difficulty;
  outcome: SimState['outcome'];
  week: string | null;
}

const KEY = 'forge-command-scores';

export function loadScores(): ScoreEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Files a finished campaign once; returns the scoreboard. */
export function recordScore(s: SimState): ScoreEntry[] {
  const list = loadScores();
  const key = `${s.seed}-${s.scenario}-${s.difficulty}-${s.day}-${s.challenge?.week ?? ''}`;
  if (list.some((e) => e.key === key)) return list;
  const r = termReport(s);
  list.push({ key, date: new Date().toISOString().slice(0, 10), score: r.score, grade: r.grade, scenario: s.scenario, difficulty: s.difficulty, outcome: s.outcome, week: s.challenge?.week ?? null });
  list.sort((a, b) => b.score - a.score);
  const kept = list.slice(0, 50);
  try {
    localStorage.setItem(KEY, JSON.stringify(kept));
  } catch {
    /* storage may be unavailable */
  }
  return kept;
}

export const bestForWeek = (week: string) => loadScores().filter((e) => e.week === week).sort((a, b) => b.score - a.score)[0] ?? null;
