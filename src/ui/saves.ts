// Browser saves: an autosave plus three manual slots, and file export/import.
import { deserialize, serialize, type GameState } from '../engine';
import { monthLabel } from './format';

const AUTO = 'forge-command-autosave-v2';
const SLOT = (n: number) => `forge-command-slot-${n}-v2`;
export const SLOTS = [1, 2, 3];

function read(key: string): GameState | null {
  try {
    return deserialize(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function write(key: string, state: GameState): boolean {
  try {
    localStorage.setItem(key, serialize(state));
    return true;
  } catch {
    return false;
  }
}

export const loadAutosave = () => read(AUTO);
export const autosave = (s: GameState) => write(AUTO, s);
export const clearAutosave = () => {
  try {
    localStorage.removeItem(AUTO);
  } catch {
    /* ignore */
  }
};
export const loadSlot = (n: number) => read(SLOT(n));
export const saveSlot = (n: number, s: GameState) => write(SLOT(n), s);

export function describeSave(s: GameState | null): string {
  if (!s) return 'Empty';
  return `${monthLabel(s.month)} · ${s.difficulty} · ${s.scenario}${s.over ? ' · finished' : ''}`;
}

export function exportSave(s: GameState): void {
  const blob = new Blob([serialize(s)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `forge-command-${s.scenario}-m${s.month + 1}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importSave(file: File): Promise<GameState | null> {
  return deserialize(await file.text());
}

const PREFS = 'forge-command-prefs-v1';
export interface Prefs {
  tutorialDone: boolean;
  highContrast: boolean;
}
export function loadPrefs(): Prefs {
  try {
    return { tutorialDone: false, highContrast: false, ...JSON.parse(localStorage.getItem(PREFS) ?? '{}') };
  } catch {
    return { tutorialDone: false, highContrast: false };
  }
}
export function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREFS, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
