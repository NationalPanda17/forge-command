import { COMPONENT_IDS, LINE_IDS } from './data';
import type { GameState } from './types';

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

/** Parses a saved game, or returns null if it is missing, corrupt or from another version. */
export function deserialize(text: string | null | undefined): GameState | null {
  if (!text) return null;
  try {
    const s = JSON.parse(text) as GameState;
    if (s?.version !== 1) return null;
    if (!LINE_IDS.every((id) => s.lines?.[id] && s.reserves?.[id])) return null;
    if (!COMPONENT_IDS.every((id) => s.components?.[id])) return null;
    return s;
  } catch {
    return null;
  }
}
