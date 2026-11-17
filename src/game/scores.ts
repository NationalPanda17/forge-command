// Local best scores, kept in this browser. Sandbox games are not scored.
import { termReport } from '../sim/analytics';
import type { Difficulty, ScenarioId, SimState } from '../sim/types';

export interface ScoreEntry {
  key: string;
  date: string;
  score: number;
  grade: string;
  scenario: ScenarioId;
  difficulty: Difficulty;
  outcome: SimState['outcome'];
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
  if (s.mode === 'sandbox') return list;
  const key = `${s.seed}-${s.scenario}-${s.difficulty}-${s.day}-`;
  if (list.some((e) => e.key === key)) return list;
  const r = termReport(s);
  list.push({ key, date: new Date().toISOString().slice(0, 10), score: r.score, grade: r.grade, scenario: s.scenario, difficulty: s.difficulty, outcome: s.outcome });
  list.sort((a, b) => b.score - a.score);
  const kept = list.slice(0, 50);
  try {
    localStorage.setItem(KEY, JSON.stringify(kept));
  } catch {
    /* storage may be unavailable */
  }
  return kept;
}
