// The real-time clock: advances the simulation while unpaused, at 1, 2, 4 or 8 days a second.
import { useCallback, useEffect, useRef, useState } from 'react';
import { apply, type SimAction } from '../sim/actions';
import { advanceDays } from '../sim/tick';
import type { SimState } from '../sim/types';
import { migrate } from '../sim/setup';

export type Speed = 0 | 1 | 2 | 4 | 8;

const SAVE_KEY = 'forge-command-2-autosave';

export function loadSim(): SimState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SimState;
    return s?.version === 1 && s.sites ? migrate(s) : null;
  } catch {
    return null;
  }
}

export function saveSim(s: SimState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* storage may be full or unavailable */
  }
}

export function useSim(initial: SimState, autoPause: boolean) {
  const [state, setState] = useState(initial);
  const [speed, setSpeed] = useState<Speed>(0);
  const acc = useRef(0);
  const last = useRef(performance.now());

  useEffect(() => setState(initial), [initial]);

  useEffect(() => {
    if (speed === 0) return;
    last.current = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      acc.current += ((now - last.current) / 1000) * speed;
      last.current = now;
      const days = Math.floor(acc.current);
      if (days < 1) return;
      acc.current -= days;
      setState((s) => {
        const next = advanceDays(s, Math.min(days, 8));
        if (next.over || (autoPause && next.alert)) setSpeed(0);
        if (Math.floor(next.day / 30) !== Math.floor(s.day / 30)) saveSim(next);
        return next;
      });
    }, 50);
    return () => window.clearInterval(id);
  }, [speed, autoPause]);

  const act = useCallback((a: SimAction) => setState((s) => apply(s, a)), []);
  const step = useCallback((days: number) => setState((s) => advanceDays(s, days)), []);

  return { state, setState, speed, setSpeed, act, step };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dateLabel = (day: number) => `${(day % 30) + 1} ${MONTHS[Math.floor(day / 30) % 12]} · Year ${Math.floor(day / 360) + 1}`;
export const monthLabel2 = (month: number) => `${MONTHS[month % 12]} Y${Math.floor(month / 12) + 1}`;
