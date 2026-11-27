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
/**
 * Browsers give a site about five million characters of storage. Past this much, a long game's next save may not fit,
 * so saving says so (18.2).
 */
export const STORAGE_SOFT_LIMIT = 3_000_000;

/** Characters this game's saves (the autosave, the named saves and their index) take in this browser. */
export function storageUse(store: Pick<Storage, 'length' | 'key' | 'getItem'> = localStorage): number {
  let n = 0;
  try {
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k?.startsWith('forge-command')) n += k.length + (store.getItem(k)?.length ?? 0);
    }
  } catch {
    /* storage unavailable */
  }
  return n;
}

/** A warning to add after saving when the browser's storage is filling up, or null. */
export function storageWarning(used = storageUse()): string | null {
  return used > STORAGE_SOFT_LIMIT ? `Saves now fill about ${Math.round((used / 5_000_000) * 100)}% of this browser's room: delete old ones, or export them to files.` : null;
}

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
  const existed = list.length !== listSlots().length;
  try {
    localStorage.setItem(slotKey(n), JSON.stringify(s));
    list.unshift({ name: n, saved: new Date().toISOString().slice(0, 16).replace('T', ' '), day: s.day, scenario: s.scenario, mode: s.mode, story: !!s.story });
    localStorage.setItem(INDEX, JSON.stringify(list));
    return null;
  } catch {
    // A new save that is not in the list could never be deleted: take it back out.
    if (!existed)
      try {
        localStorage.removeItem(slotKey(n));
      } catch {
        /* storage unavailable */
      }
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

/** Hands the player a game as a file they can import later from the title screen. */
export function downloadSave(s: SimState): void {
  try {
    const url = URL.createObjectURL(new Blob([JSON.stringify(s)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `forge-command-day-${s.day}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    /* nothing to hand over */
  }
}
