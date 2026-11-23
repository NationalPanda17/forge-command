// Counts something a story chapter's goal depends on. Kept apart from story.ts so actions and industry can call it
// without importing the whole story (and its event chains) into the module graph.
import type { SimState } from './types';

/** Player actions call this directly: their feed items fall between days, where the daily count never sees them. */
export function storyCount(s: SimState, key: string): void {
  if (s.story) s.story.counts[key] = (s.story.counts[key] ?? 0) + 1;
}
