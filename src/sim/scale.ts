// How often trouble comes, by difficulty and the events setting. Kept apart from tick.ts so any module can use it.
import type { SimState } from './types';

const BY_DIFFICULTY = { easy: 0.5, normal: 1, hard: 1.6 } as const;

export const troubleScale = (s: SimState) => BY_DIFFICULTY[s.difficulty] * (s.settings?.events ?? 1);
