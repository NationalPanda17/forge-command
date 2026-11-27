// Synthesized sounds (no audio files), in the game's "Industrial Command" palette (17.2): struck bronze and steel for
// news, relay clicks and teleprinters for the controls and intelligence, low brass for the rival, a klaxon only for a
// real emergency. One sound for each kind of event, so you can hear what happened without looking; every sound also
// has its line in the log, so nothing is told by sound alone.
import { duckMusic, mixer } from './mixer';

let enabled = true;
let volume = 0.7;
/** At 4× and 8×, the lesser sounds (month chimes, good news) are left out when this is on. */
let quietAtSpeed = true;
let gameSpeed = 1;

export const setSoundEnabled = (on: boolean) => {
  enabled = on;
};
export const setSoundVolume = (v: number) => {
  volume = Math.max(0, Math.min(1, v));
};
export const setQuietAtSpeed = (on: boolean) => {
  quietAtSpeed = on;
};
/** The clock's speed, so the sounds can thin out at 4× and 8×. */
export const setGameSpeed = (speed: number) => {
  gameSpeed = speed;
};

function out(): { a: AudioContext; bus: GainNode } | null {
  if (!enabled || volume <= 0 || typeof window === 'undefined' || document.hidden) return null;
  const m = mixer();
  if (!m) return null;
  if (m.ctx.state === 'suspended') void m.ctx.resume();
  return { a: m.ctx, bus: m.sfx };
}

/** One oscillator with an envelope. */
function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.05, slideTo?: number, filterHz?: number): void {
  const o = out();
  if (!o) return;
  const { a, bus } = o;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  const t = a.currentTime + start;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain * volume, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node: AudioNode = osc.connect(g);
  if (filterHz) {
    const f = a.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterHz;
    node = node.connect(f);
  }
  node.connect(bus);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** A short burst of filtered noise: a relay, steam, static, a crowd. */
function noise(start: number, dur: number, freq: number, gain = 0.04, q = 1.2, type: BiquadFilterType = 'bandpass'): void {
  const o = out();
  if (!o) return;
  const { a, bus } = o;
  const len = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  // Sound only, never the game: Math.random is fine here.
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.value = gain * volume;
  src.connect(f).connect(g).connect(bus);
  src.start(a.currentTime + start);
}

/**
 * A struck metal object: partials that are not whole multiples of the fundamental (that is what makes bronze sound
 * like bronze, not like a flute), each dying away at its own rate.
 */
function strike(freq: number, start = 0, gain = 0.05, ring = 1.4): void {
  const partials: [number, number, number][] = [
    [1, 1, 1],
    [2.76, 0.55, 0.6],
    [5.4, 0.3, 0.35],
    [8.93, 0.18, 0.2],
  ];
  for (const [ratio, level, decay] of partials) tone(freq * ratio, start, ring * decay, 'sine', gain * level);
  noise(start, 0.03, freq * 4, gain * 0.6, 2);
}

/** Low brass: a sawtooth swelling through a low-pass filter. */
function brass(freq: number, start: number, dur: number, gain = 0.035): void {
  tone(freq, start, dur, 'sawtooth', gain, undefined, 900);
  tone(freq * 1.005, start, dur, 'sawtooth', gain * 0.7, undefined, 700);
}

export const sfx = {
  /** A control pressed: a relay closing. */
  click: () => noise(0, 0.018, 2400, 0.05, 3),
  /** The clock stops: a falling tape-stop. */
  pause: () => tone(330, 0, 0.22, 'triangle', 0.03, 140),
  /** The clock starts: the same, rising. */
  resume: () => tone(170, 0, 0.18, 'triangle', 0.03, 360),
  /** Speed changed: a gear ratchet. */
  speed: () => {
    noise(0, 0.02, 1800, 0.05, 4);
    noise(0.05, 0.02, 2100, 0.05, 4);
  },
  /** A month closes: a struck bronze bell, low and short. */
  month: () => strike(196, 0, 0.03, 1.1),
  /** Something needs you: a two-note signal through a filter. */
  alert: () => {
    tone(440, 0, 0.16, 'square', 0.02, undefined, 1400);
    tone(370, 0.17, 0.22, 'square', 0.02, undefined, 1400);
  },
  /** A real emergency (a crisis begins): a klaxon. */
  alarm: () => {
    for (let i = 0; i < 2; i++) {
      tone(330, i * 0.55, 0.42, 'sawtooth', 0.026, 300, 1600);
      tone(495, i * 0.55, 0.42, 'sawtooth', 0.014, 450, 1600);
    }
  },
  /** An achievement: a brass call over a bell. */
  fanfare: () => {
    brass(196, 0, 0.35, 0.03);
    brass(247, 0.18, 0.35, 0.03);
    brass(294, 0.36, 0.7, 0.032);
    strike(587, 0.36, 0.02, 1.6);
  },
  /** A new decision card: the teleprinter, then a soft bell. */
  decision: () => {
    for (let i = 0; i < 5; i++) noise(i * 0.045, 0.02, 3200, 0.035, 3);
    strike(523, 0.26, 0.02, 0.9);
  },
  /** Power fails: a falling transformer hum and a crackle. */
  blackout: () => {
    tone(110, 0, 1.1, 'sawtooth', 0.03, 40, 600);
    noise(0, 0.35, 1200, 0.04, 0.8);
  },
  /** A strike or protest: a murmuring crowd. */
  crowd: () => {
    noise(0, 0.6, 700, 0.05);
    noise(0.25, 0.5, 500, 0.04);
  },
  /** Hackers: static and a glitch. */
  cyber: () => {
    noise(0, 0.25, 3000, 0.04);
    tone(1200, 0.05, 0.08, 'square', 0.015, undefined, 2500);
    tone(600, 0.15, 0.08, 'square', 0.015, undefined, 2500);
  },
  /** Spies: the teleprinter, slow, and a low note. */
  spy: () => {
    for (let i = 0; i < 3; i++) noise(i * 0.12, 0.025, 2600, 0.03, 3);
    tone(156, 0.38, 0.5, 'triangle', 0.035);
  },
  /** Good news: two struck notes, rising. */
  success: () => {
    strike(392, 0, 0.026, 1);
    strike(523, 0.12, 0.026, 1.2);
  },
  /** Bad news: a muffled low strike. */
  failure: () => {
    strike(147, 0, 0.034, 0.9);
    tone(110, 0.05, 0.45, 'triangle', 0.03, 92);
  },
  /** Research or building finished: the anvil. */
  done: () => {
    strike(880, 0, 0.022, 0.8);
    strike(880, 0.16, 0.016, 0.6);
  },
  /** The rival fields a weapon: low brass, swelling. */
  rival: () => {
    brass(73.4, 0, 1.1, 0.04);
    brass(110, 0.08, 1.0, 0.025);
  },
};

export type SoundId = keyof typeof sfx;

/** How weighty each sound is: a lesser sound never cuts across a weightier one just played. */
const PRIORITY: Record<SoundId, number> = {
  click: 0, speed: 1, pause: 1, resume: 1, month: 2, done: 3, success: 3, decision: 4, failure: 4, crowd: 5, spy: 5, cyber: 5, fanfare: 5, alert: 6, blackout: 7, rival: 8, alarm: 9,
};
/** The least time, in real milliseconds, before the same sound plays again. */
const COOLDOWN: Partial<Record<SoundId, number>> = { click: 40, speed: 60, pause: 150, resume: 150, month: 20000 };
const EVENT_COOLDOWN = 1500;
/** After an event sound, lesser sounds wait this long (so a burst of news at 8× is one sound, not a chord). */
const HOLD = 700;

const lastPlayed: Partial<Record<SoundId, number>> = {};
let held: { until: number; priority: number } = { until: 0, priority: -1 };

/**
 * Plays a sound unless it played too recently, or a weightier sound has just played. Returns whether it played.
 * Everything should go through here rather than calling sfx directly; `now` is for tests.
 */
export function play(id: SoundId, now: number = typeof performance === 'undefined' ? Date.now() : performance.now()): boolean {
  const wait = COOLDOWN[id] ?? EVENT_COOLDOWN;
  if (now - (lastPlayed[id] ?? -Infinity) < wait) return false;
  if (now < held.until && PRIORITY[id] < held.priority && PRIORITY[id] >= 2) return false;
  // At 4× and 8×, routine news (the month, good news, builds) is left to the log.
  if (quietAtSpeed && gameSpeed >= 4 && PRIORITY[id] >= 2 && PRIORITY[id] <= 3) return false;
  lastPlayed[id] = now;
  if (PRIORITY[id] >= 2) held = { until: now + HOLD, priority: PRIORITY[id] };
  // The music steps back for anything that matters.
  if (PRIORITY[id] >= 4) duckMusic(PRIORITY[id] >= 7 ? 7 : 4, PRIORITY[id] >= 7 ? 2 : 1.2);
  sfx[id]();
  return true;
}

/** Clears the cooldowns (tests, or a new game). */
export function resetSounds(): void {
  for (const k of Object.keys(lastPlayed)) delete lastPlayed[k as SoundId];
  held = { until: 0, priority: -1 };
  gameSpeed = 1;
}

/** Which sound a feed line calls for, if any. */
export function soundFor(text: string, tone: string): SoundId | null {
  if (/^Crisis: .* has begun/.test(text)) return 'alarm';
  if (/has wound down/.test(text)) return 'success';
  if (/Power is back/.test(text)) return 'success';
  if (/^A blackout hits|black out /.test(text)) return 'blackout';
  if (/^Strike at|walks out|^Work to rule|^Protesters block/.test(text)) return 'crowd';
  if (/Ransomware|[Hh]ackers|cyber attack/.test(text)) return 'cyber';
  if (/^Operation succeeds/.test(text)) return 'success';
  if (/^Operation fails|operation is exposed/i.test(text)) return 'failure';
  if (/spy ring|[Ss]abotage at/.test(text) && tone !== 'good') return 'spy';
  if (tone === 'bad' && /fields /.test(text) && /Directorate|rival/i.test(text)) return 'rival';
  if (/votes your request down|^Promise broken|^Objective missed|has closed for good/.test(text)) return 'failure';
  if (/grants your request|^Promise kept|^Objective complete|grants a supplementary/.test(text)) return 'success';
  if (/^Research complete|opens to traffic|opens and starts|is fitted out|opens its doors|is finished:|finishes its resilience|is complete:|line installed/i.test(text) || /^Accepted: /.test(text)) return 'done';
  if (/A decision is waiting/.test(text)) return 'decision';
  return null;
}
