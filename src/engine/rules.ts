// The rules a campaign runs under: difficulty, scenario, challenge modifiers and sandbox settings combined.
import { DIFFICULTY, SCENARIOS, type DifficultyRules } from './data';
import type { GameState } from './types';

export function rulesOf(state: Pick<GameState, 'difficulty' | 'custom' | 'modifiers'>): DifficultyRules {
  const base = DIFFICULTY[state.difficulty];
  const c = state.custom;
  const embargo = state.modifiers?.includes('embargoWorld');
  if (!c && !embargo) return base;
  return {
    ...base,
    crisisChance: base.crisisChance * (c?.crisisMult ?? 1),
    eventRate: base.eventRate * (c?.eventMult ?? 1),
    shockChance: base.shockChance * (embargo ? 1.5 : 1),
  };
}

export function pressureOf(state: Pick<GameState, 'scenario' | 'custom'>): number {
  return SCENARIOS[state.scenario].pressure * (state.custom?.pressureMult ?? 1);
}

/** Base appropriation before reviews: difficulty, scenario, austerity and sandbox settings. */
export function baseAppropriation(state: Pick<GameState, 'difficulty' | 'scenario' | 'custom' | 'modifiers'>): number {
  return DIFFICULTY[state.difficulty].appropriation * SCENARIOS[state.scenario].budgetMult * (state.custom?.budgetMult ?? 1) * (state.modifiers?.includes('austerity') ? 0.8 : 1);
}
