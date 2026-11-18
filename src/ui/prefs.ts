// Display preferences, remembered in this browser: colour palette, text size and reduced motion.
export interface DisplayPrefs {
  /** 'cb' swaps in a colour-blind-safe palette. */
  palette: 'default' | 'cb';
  text: 'normal' | 'large' | 'larger';
  reduceMotion: boolean;
}

const KEY = 'forge-command-display';
export const DEFAULT_PREFS: DisplayPrefs = { palette: 'default', text: 'normal', reduceMotion: false };

export function loadPrefs(): DisplayPrefs {
  try {
    return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function applyPrefs(p: DisplayPrefs): void {
  const html = document.documentElement;
  html.dataset.palette = p.palette;
  html.dataset.text = p.text;
  html.classList.toggle('rm', p.reduceMotion);
}

export function savePrefs(p: DisplayPrefs): void {
  applyPrefs(p);
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage may be unavailable */
  }
}
