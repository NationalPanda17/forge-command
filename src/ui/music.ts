// Generated background music that follows the situation: no audio files. Slow pad chords, a sparse melody above them,
// and a low pulse and soft percussion when there is trouble. Six moods: calm, uneasy (a crisis is coming), tense
// (a crisis is on), hearing (the Committee sits), triumph (a term well served) and sombre (dismissed).
export type Mood = 'calm' | 'uneasy' | 'tense' | 'hearing' | 'triumph' | 'somber';

/** Chord voicings, root first, in hertz. */
const CHORDS: Record<Mood, number[][]> = {
  calm: [
    [146.83, 220.0, 293.66, 349.23], // D minor
    [116.54, 174.61, 233.08, 293.66], // B flat
    [130.81, 196.0, 261.63, 329.63], // C
    [110.0, 164.81, 220.0, 277.18], // A
  ],
  uneasy: [
    [146.83, 220.0, 293.66, 349.23],
    [155.56, 233.08, 311.13, 392.0], // E flat
    [146.83, 207.65, 293.66, 349.23], // D diminished colour
    [138.59, 207.65, 277.18, 329.63],
  ],
  tense: [
    [146.83, 207.65, 293.66, 349.23],
    [138.59, 207.65, 277.18, 329.63],
    [146.83, 220.0, 311.13, 349.23],
    [130.81, 196.0, 277.18, 311.13],
  ],
  hearing: [
    [130.81, 196.0, 261.63, 329.63], // C
    [174.61, 220.0, 261.63, 349.23], // F
    [146.83, 220.0, 293.66, 349.23], // D minor
    [196.0, 246.94, 293.66, 392.0], // G
  ],
  triumph: [
    [146.83, 220.0, 293.66, 369.99], // D major
    [196.0, 246.94, 293.66, 392.0], // G
    [220.0, 277.18, 329.63, 440.0], // A
    [146.83, 220.0, 293.66, 369.99],
  ],
  somber: [
    [110.0, 164.81, 220.0, 261.63], // A minor
    [87.31, 130.81, 174.61, 220.0], // F
    [98.0, 146.83, 196.0, 233.08], // G minor
    [82.41, 123.47, 164.81, 196.0], // E minor
  ],
};
/** Seconds per chord, by mood: tension moves faster. */
const PACE: Record<Mood, number> = { calm: 9, uneasy: 8, tense: 6, hearing: 7, triumph: 6, somber: 10 };
/** Brightness of the pad filter. */
const BRIGHT: Record<Mood, number> = { calm: 650, uneasy: 750, tense: 950, hearing: 800, triumph: 1200, somber: 500 };
/** A melody note (scale step above the chord root) per beat; -1 is a rest. Four beats a chord. */
const MELODY: Record<Mood, number[]> = {
  calm: [-1, 2, -1, 1, -1, -1, 3, -1],
  uneasy: [-1, 1, -1, -1, 2, -1, 1, -1],
  tense: [0, -1, 1, -1, 0, -1, 2, 1],
  hearing: [2, -1, 3, -1, 2, 1, -1, -1],
  triumph: [2, 3, -1, 4, -1, 3, 2, -1],
  somber: [-1, -1, 1, -1, -1, 0, -1, -1],
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: number | null = null;
let step = 0;
let mood: Mood = 'calm';
let volume = 0.5;
let pulse: { osc: OscillatorNode; lfo: OscillatorNode; gain: GainNode } | null = null;
let hidden = false;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended' && !hidden) void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function chord(a: AudioContext, out: GainNode, freqs: number[], seconds: number): void {
  const t = a.currentTime;
  const filter = a.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(BRIGHT[mood], t);
  filter.Q.value = 0.7;
  filter.connect(out);
  freqs.forEach((f, i) => {
    for (const detune of [-6, 6]) {
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = i === 0 ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.detune.value = detune;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.02 / (i + 1), t + Math.min(3, seconds / 3));
      g.gain.linearRampToValueAtTime(0.016 / (i + 1), t + seconds - 1);
      g.gain.linearRampToValueAtTime(0, t + seconds + 2.5);
      o.connect(g).connect(filter);
      o.start(t);
      o.stop(t + seconds + 3);
    }
  });
}

/** A soft bell-like note: the melody. */
function note(a: AudioContext, out: GainNode, freq: number, at: number, length: number): void {
  const o = a.createOscillator();
  const o2 = a.createOscillator();
  const g = a.createGain();
  o.type = 'sine';
  o2.type = 'sine';
  o.frequency.value = freq;
  o2.frequency.value = freq * 2.01;
  const t = a.currentTime + at;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(mood === 'somber' ? 0.012 : 0.016, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
  const g2 = a.createGain();
  g2.gain.value = 0.25;
  o.connect(g).connect(out);
  o2.connect(g2).connect(g);
  o.start(t);
  o2.start(t);
  o.stop(t + length + 0.05);
  o2.stop(t + length + 0.05);
}

/** A muted drum: tension's heartbeat. */
function thud(a: AudioContext, out: GainNode, at: number): void {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = 'sine';
  const t = a.currentTime + at;
  o.frequency.setValueAtTime(90, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
  g.gain.setValueAtTime(0.06, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.35);
}

/** The scale above a chord's root: minor for dark moods, major for bright ones. */
const SCALE = (m: Mood) => (m === 'triumph' || m === 'hearing' ? [0, 2, 4, 5, 7, 9, 11, 12] : [0, 2, 3, 5, 7, 8, 10, 12]);

function setPulse(a: AudioContext, out: GainNode, on: boolean): void {
  if (on && !pulse) {
    const osc = a.createOscillator();
    const gain = a.createGain();
    const lfo = a.createOscillator();
    const depth = a.createGain();
    osc.type = 'sine';
    osc.frequency.value = 55;
    gain.gain.value = 0.018;
    lfo.frequency.value = 1.1;
    depth.gain.value = 0.018;
    lfo.connect(depth).connect(gain.gain);
    osc.connect(gain).connect(out);
    osc.start();
    lfo.start();
    pulse = { osc, lfo, gain };
  } else if (!on && pulse) {
    const t = a.currentTime;
    pulse.gain.gain.cancelScheduledValues(t);
    pulse.gain.gain.linearRampToValueAtTime(0, t + 2);
    pulse.osc.stop(t + 2.1);
    pulse.lfo.stop(t + 2.1);
    pulse = null;
  }
}

function tick(): void {
  const a = audio();
  if (!a || !master) return;
  // Hidden: keep the clock going quietly, so the music picks up again when the tab comes back.
  if (hidden) {
    timer = window.setTimeout(tick, 2000);
    return;
  }
  const set = CHORDS[mood];
  const seconds = PACE[mood];
  const freqs = set[step % set.length];
  chord(a, master, freqs, seconds);
  // Melody: half of the chord's beats, from its root, an octave up.
  const beat = seconds / 4;
  const scale = SCALE(mood);
  const half = step % 2;
  for (let i = 0; i < 4; i++) {
    const d = MELODY[mood][half * 4 + i];
    if (d >= 0) note(a, master, freqs[0] * 2 * Math.pow(2, scale[d % scale.length] / 12), i * beat + 0.2, beat * 1.6);
  }
  if (mood === 'tense') for (let i = 0; i < 4; i++) thud(a, master, i * beat);
  if (mood === 'uneasy') thud(a, master, 0);
  step++;
  // Each chord schedules the next, so a change of mood changes the pace too.
  timer = window.setTimeout(tick, seconds * 1000);
}

export const music = {
  get playing() {
    return timer !== null;
  },
  get mood() {
    return mood;
  },
  start(): void {
    const a = audio();
    if (!a || timer !== null) return;
    master = a.createGain();
    master.gain.value = volume;
    master.connect(a.destination);
    tick();
    setPulse(a, master, mood === 'tense' || mood === 'uneasy');
  },
  stop(): void {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    const a = ctx;
    if (a && master) {
      setPulse(a, master, false);
      const m = master;
      m.gain.linearRampToValueAtTime(0, a.currentTime + 1.5);
      window.setTimeout(() => m.disconnect(), 1800);
    }
    master = null;
  },
  setMood(next: Mood): void {
    if (next === mood) return;
    mood = next;
    step = 0;
    if (ctx && master) setPulse(ctx, master, mood === 'tense' || mood === 'uneasy');
  },
  setVolume(v: number): void {
    volume = Math.max(0, Math.min(1, v));
    if (ctx && master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.3);
  },
  /** Silence while the game's tab is hidden; carry on when it comes back. */
  setHidden(h: boolean): void {
    hidden = h;
    if (!ctx) return;
    if (h) void ctx.suspend();
    else void ctx.resume();
  },
};

// ---------- Audio settings, remembered in this browser ----------

export interface AudioPrefs {
  sfx: boolean;
  music: boolean;
  /** Music volume, 0..1. */
  volume: number;
  /** Sound effects volume, 0..1. */
  sfxVolume: number;
}
const KEY = 'forge-command-audio';
const DEFAULTS: AudioPrefs = { sfx: true, music: false, volume: 0.5, sfxVolume: 0.7 };
export function loadAudioPrefs(): AudioPrefs {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}) };
  } catch {
    return { ...DEFAULTS };
  }
}
export function saveAudioPrefs(p: AudioPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage may be unavailable */
  }
}

/** The mood the game is in. */
export function moodFor(s: { hearing: unknown; crisis: { phase: string } | null; over: boolean; outcome: string; confidence: number }): Mood {
  if (s.over) return s.outcome === 'dismissed' || s.confidence < 40 ? 'somber' : 'triumph';
  if (s.hearing) return 'hearing';
  if (s.crisis?.phase === 'active') return 'tense';
  if (s.crisis?.phase === 'warning') return 'uneasy';
  return 'calm';
}
