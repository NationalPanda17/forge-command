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
  /** t: continuous simulated time in days. committed: the last day React has drawn. */
  const sim = useRef({ t: initial.day, committed: initial.day, pending: false });

  useEffect(() => setState(initial), [initial]);

  // Each new state: the simulation has caught up with the clock.
  useEffect(() => {
    const c = sim.current;
    c.committed = state.day;
    c.pending = false;
    if (c.t < state.day || c.t > state.day + 1) c.t = state.day;
  }, [state]);

  useEffect(() => {
    if (speed === 0) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const c = sim.current;
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      // Time flows smoothly; it never runs more than a couple of days ahead of the simulation.
      c.t = Math.min(c.t + dt * speed, c.committed + 2);
      const due = Math.floor(c.t) - c.committed;
      if (due >= 1 && !c.pending) {
        c.pending = true;
        setState((s) => {
          const next = advanceDays(s, Math.min(due, 8));
          if (next.over || (autoPause && next.alert)) setSpeed(0);
          if (Math.floor(next.day / 30) !== Math.floor(s.day / 30)) saveSim(next);
          return next;
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [speed, autoPause]);

  const act = useCallback((a: SimAction) => setState((s) => apply(s, a)), []);
  const step = useCallback((days: number) => setState((s) => advanceDays(s, days)), []);
  /** Continuous simulated time for drawing: today plus how far through it we are. */
  const clock = useCallback(() => {
    const c = sim.current;
    return Math.min(c.t, c.committed + 0.999);
  }, []);

  return { state, setState, speed, setSpeed, act, step, clock };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dateLabel = (day: number) => `${(day % 30) + 1} ${MONTHS[Math.floor(day / 30) % 12]} · Year ${Math.floor(day / 360) + 1}`;
export const monthLabel2 = (month: number) => `${MONTHS[month % 12]} Y${Math.floor(month / 12) + 1}`;
