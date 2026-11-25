// The record book, kept in this browser: every finished term's score, careers, and lifetime totals.
// Sandbox games are not scored.
import { termReport } from '../sim/analytics';
import type { Difficulty, ScenarioId, SimState } from '../sim/types';

export type RunKind = 'campaign' | 'story' | 'hotseat' | 'custom' | 'tutorial';

export interface ScoreEntry {
  key: string;
  date: string;
  score: number;
  grade: string;
  scenario: ScenarioId;
  difficulty: Difficulty;
  outcome: SimState['outcome'];
  kind?: RunKind;
  world?: 'classic' | 'generated';
  term?: number;
  /** A custom scenario's name. */
  custom?: string;
  /** Your chief of staff ran some of it. */
  assisted?: boolean;
}

export interface Totals {
  terms: number;
  completed: number;
  dismissed: number;
  /** The most terms served in one game. */
  longestCareer: number;
  roundsMade: number;
  exported: number;
  promisesKept: number;
}

const KEY = 'forge-command-scores';
const TOTALS = 'forge-command-totals';
const EMPTY: Totals = { terms: 0, completed: 0, dismissed: 0, longestCareer: 0, roundsMade: 0, exported: 0, promisesKept: 0 };

export const kindOf = (s: SimState): RunKind => (s.story ? 'story' : s.hotseat ? 'hotseat' : s.scenario === 'custom' ? 'custom' : s.scenario === 'tutorial' ? 'tutorial' : 'campaign');
export const KIND_NAME: Record<RunKind, string> = { campaign: 'Campaign', story: 'Story', hotseat: 'Two players', custom: 'Custom', tutorial: 'Tutorial' };

export function loadScores(): ScoreEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function loadTotals(): Totals {
  try {
    return { ...EMPTY, ...(JSON.parse(localStorage.getItem(TOTALS) ?? '{}') ?? {}) };
  } catch {
    return { ...EMPTY };
  }
}

/** The key a finished term is filed under. */
export const entryKey = (s: SimState) => `${s.seed}-${s.scenario}-${s.difficulty}-${s.day}-${s.term ?? 1}`;

/** Files a finished term once; returns the scoreboard, best first. */
export function recordScore(s: SimState): ScoreEntry[] {
  const list = loadScores();
  if (s.mode === 'sandbox') return list;
  const key = entryKey(s);
  if (list.some((e) => e.key === key)) return list;
  const r = termReport(s);
  list.push({
    key,
    date: new Date().toISOString().slice(0, 10),
    score: r.score,
    grade: r.grade,
    scenario: s.scenario,
    difficulty: s.difficulty,
    outcome: s.outcome,
    kind: kindOf(s),
    world: s.world === null ? 'classic' : 'generated',
    term: s.term ?? 1,
    custom: s.custom?.name,
    assisted: !!s.automation?.assisted,
  });
  list.sort((a, b) => b.score - a.score);
  const kept = list.slice(0, 100);
  const t = loadTotals();
  t.terms++;
  if (s.outcome === 'complete') t.completed++;
  if (s.outcome === 'dismissed') t.dismissed++;
  t.longestCareer = Math.max(t.longestCareer, s.term ?? 1);
  t.roundsMade += Math.round(r.made);
  t.exported += Math.round(r.exported);
  t.promisesKept += s.promisesKept ?? 0;
  try {
    localStorage.setItem(KEY, JSON.stringify(kept));
    localStorage.setItem(TOTALS, JSON.stringify(t));
  } catch {
    /* storage may be unavailable */
  }
  return kept;
}

/** The best entry for each kind of game and difficulty. */
export function bests(list: ScoreEntry[]): { kind: RunKind; difficulty: Difficulty; entry: ScoreEntry }[] {
  const out = new Map<string, ScoreEntry>();
  for (const e of list) {
    const k = `${e.kind ?? 'campaign'}|${e.difficulty}`;
    if (!out.has(k) || out.get(k)!.score < e.score) out.set(k, e);
  }
  const order: RunKind[] = ['campaign', 'story', 'custom', 'hotseat', 'tutorial'];
  const diffs: Difficulty[] = ['easy', 'normal', 'hard'];
  return [...out.entries()]
    .map(([k, entry]) => ({ kind: k.split('|')[0] as RunKind, difficulty: k.split('|')[1] as Difficulty, entry }))
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || diffs.indexOf(a.difficulty) - diffs.indexOf(b.difficulty));
}
