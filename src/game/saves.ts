// Named save slots, kept side by side in this browser (the autosave is separate).
import { migrate } from '../sim/setup';
import type { SimState } from '../sim/types';

export interface SlotInfo {
  name: string;
  saved: string;
  day: number;
  scenario: SimState['scenario'];
  mode: SimState['mode'];
  story: boolean;
}

const INDEX = 'forge-command-slots';
const slotKey = (name: string) => `forge-command-slot:${name}`;
export const MAX_SLOTS = 8;

export function listSlots(): SlotInfo[] {
  try {
    const v = JSON.parse(localStorage.getItem(INDEX) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Saves under a name; returns null, or why it could not. */
export function saveSlot(name: string, s: SimState): string | null {
  const n = name.trim().slice(0, 40);
  if (!n) return 'Give the save a name.';
  const list = listSlots().filter((x) => x.name !== n);
  if (list.length >= MAX_SLOTS) return `At most ${MAX_SLOTS} named saves. Delete one first.`;
  try {
    localStorage.setItem(slotKey(n), JSON.stringify(s));
    list.unshift({ name: n, saved: new Date().toISOString().slice(0, 16).replace('T', ' '), day: s.day, scenario: s.scenario, mode: s.mode, story: !!s.story });
    localStorage.setItem(INDEX, JSON.stringify(list));
    return null;
  } catch {
    return 'This browser has no room left for another save. Delete one, or export it to a file.';
  }
}

export function loadSlot(name: string): SimState | null {
  try {
    const raw = localStorage.getItem(slotKey(name));
    if (!raw) return null;
    const s = JSON.parse(raw) as SimState;
    return s?.version === 1 && s.sites ? migrate(s) : null;
  } catch {
    return null;
  }
}

export function deleteSlot(name: string): void {
  try {
    localStorage.removeItem(slotKey(name));
    localStorage.setItem(INDEX, JSON.stringify(listSlots().filter((x) => x.name !== name)));
  } catch {
    /* storage may be unavailable */
  }
}
