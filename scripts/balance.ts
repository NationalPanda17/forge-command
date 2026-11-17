// Balance check: plays campaigns with a scripted player and prints the debrief grades.
//   npm run balance            follow the advisor
//   npm run balance -- idle    do nothing (decisions take their defaults)
import { advise, debrief, newGame, playTurn, type Action, type Difficulty, type GameState, type ScenarioId } from '../src/engine';

export function advisorPolicy(s: GameState): Action[] {
  const acts: Action[] = [];
  for (const d of s.decisions) acts.push({ type: 'resolveDecision', decision: d.id, option: d.options[0].id });
  for (const a of advise(s)) if (a.action && a.tone !== 'info') acts.push(a.action);
  return acts;
}

const idle = (s: GameState): Action[] => s.decisions.map((d) => ({ type: 'resolveDecision', decision: d.id, option: d.fallback }) as Action);
const mode = process.argv.includes('idle') ? 'idle' : 'advisor';

if (!process.env.NO_MAIN) for (const difficulty of ['easy', 'normal', 'hard'] as Difficulty[]) {
  for (const scenario of ['standard', 'brokenChain', 'longWar', 'rebuild'] as ScenarioId[]) {
    for (const seed of [1, 2]) {
      let s = newGame({ seed, difficulty, scenario });
      while (!s.over) s = playTurn(s, mode === 'idle' ? idle(s) : advisorPolicy(s));
      const d = debrief(s);
      console.log(difficulty.padEnd(6), scenario.padEnd(11), seed, s.outcome.padEnd(9), `month ${String(s.month).padStart(2)}`, `score ${String(d.score).padStart(4)}`, d.grades.map((g) => `${g.grade}:${g.value}`).join(' '));
    }
  }
}
