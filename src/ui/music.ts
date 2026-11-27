import { mixer, setAudioHidden } from './mixer';
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

/** Other melodic phrases for each mood: the base phrase, sung backwards, and thinned out (17.2: less repetition). */
const PHRASES: Record<Mood, number[][]> = Object.fromEntries(
  (Object.keys(MELODY) as Mood[]).map((m) => {
    const base = MELODY[m];
    const back = [...base].reverse();
    const thin = base.map((d, i) => (i % 3 === 1 ? -1 : d));
    return [m, [base, back, thin]];
  }),
) as Record<Mood, number[][]>;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: number | null = null;
let step = 0;
let chordAt = 0;
let mood: Mood = 'calm';
let volume = 0.35;
let pulse: { oscs: OscillatorNode[]; lfo: OscillatorNode; gain: GainNode } | null = null;
let bed: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
let hammerAt = 0;
let hidden = false;

function audio(): AudioContext | null {
  const m = mixer();
  if (!m) return null;
  ctx = m.ctx;
  if (ctx.state === 'suspended' && !hidden) void ctx.resume();
  return ctx;
}

// Music only, never the game: Math.random is fine here.
const chance = (p: number) => Math.random() < p;

function chord(a: AudioContext, out: GainNode, freqs: number[], seconds: number, level = 1): void {
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
      g.gain.linearRampToValueAtTime((0.02 * level) / (i + 1), t + Math.min(3, seconds / 3));
      g.gain.linearRampToValueAtTime((0.016 * level) / (i + 1), t + seconds - 1);
      g.gain.linearRampToValueAtTime(0, t + seconds + 2.5);
      o.connect(g).connect(filter);
      o.start(t);
      o.stop(t + seconds + 3);
    }
  });
}

/** A struck note for the melody: a little bronze in it, not a pure bell. */
function note(a: AudioContext, out: GainNode, freq: number, at: number, length: number): void {
  const t = a.currentTime + at;
  const peak = mood === 'somber' ? 0.012 : 0.016;
  for (const [ratio, level] of [[1, 1], [2.01, 0.25], [2.76, 0.1]] as const) {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'sine';
    o.frequency.value = freq * ratio;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak * level, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length / (ratio > 2.5 ? 2 : 1));
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + length + 0.05);
  }
}

/** A muted drum: tension's heartbeat. With `far`, a distant drop forge in the works across the valley. */
function thud(a: AudioContext, out: GainNode, at: number, far = false): void {
  const o = a.createOscillator();
  const g = a.createGain();
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = far ? 260 : 900;
  o.type = 'sine';
  const t = a.currentTime + at;
  o.frequency.setValueAtTime(far ? 70 : 90, t);
  o.frequency.exponentialRampToValueAtTime(far ? 32 : 40, t + 0.25);
  g.gain.setValueAtTime(far ? 0.035 : 0.06, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (far ? 0.6 : 0.3));
  o.connect(f).connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.7);
}

/** The scale above a chord's root: minor for dark moods, major for bright ones. */
const SCALE = (m: Mood) => (m === 'triumph' || m === 'hearing' ? [0, 2, 4, 5, 7, 9, 11, 12] : [0, 2, 3, 5, 7, 8, 10, 12]);

/** Tension's low pulse, at 110 Hz with an octave above it so laptop speakers can carry it. */
function setPulse(a: AudioContext, out: GainNode, on: boolean): void {
  if (on && !pulse) {
    const gain = a.createGain();
    const lfo = a.createOscillator();
    const depth = a.createGain();
    gain.gain.value = 0.014;
    lfo.frequency.value = 1.1;
    depth.gain.value = 0.014;
    lfo.connect(depth).connect(gain.gain);
    const oscs = [110, 220].map((f, i) => {
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.value = i ? 0.35 : 1;
      o.connect(g).connect(gain);
      o.start();
      return o;
    });
    gain.connect(out);
    lfo.start();
    pulse = { oscs, lfo, gain };
  } else if (!on && pulse) {
    const t = a.currentTime;
    pulse.gain.gain.cancelScheduledValues(t);
    pulse.gain.gain.linearRampToValueAtTime(0, t + 2);
    for (const o of pulse.oscs) o.stop(t + 2.1);
    pulse.lfo.stop(t + 2.1);
    pulse = null;
  }
}

/** The bed under everything: the low roar of furnaces far off, breathing slowly. */
function startBed(a: AudioContext, out: GainNode): void {
  if (bed) return;
  const len = a.sampleRate * 4;
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  // Brown noise: each sample a small step from the last.
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02;
    data[i] = last * 3.5;
  }
  const src = a.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 220;
  const gain = a.createGain();
  gain.gain.value = 0;
  gain.gain.linearRampToValueAtTime(0.05, a.currentTime + 4);
  const lfo = a.createOscillator();
  const depth = a.createGain();
  lfo.frequency.value = 0.07;
  depth.gain.value = 0.02;
  lfo.connect(depth).connect(gain.gain);
  src.connect(f).connect(gain).connect(out);
  src.start();
  lfo.start();
  bed = { src, gain };
}
function stopBed(a: AudioContext): void {
  if (!bed) return;
  const t = a.currentTime;
  bed.gain.gain.cancelScheduledValues(t);
  bed.gain.gain.linearRampToValueAtTime(0, t + 2);
  bed.src.stop(t + 2.1);
  bed = null;
}

/** A short cue as the mood changes, so the change is heard at once. */
function stinger(a: AudioContext, out: GainNode, m: Mood): void {
  const t = a.currentTime;
  const horn = (f: number, at: number, dur: number, g = 0.03) => {
    for (const d of [0, 1.006]) {
      const o = a.createOscillator();
      const gn = a.createGain();
      const lp = a.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 800;
      o.type = 'sawtooth';
      o.frequency.value = f * (d || 1);
      gn.gain.setValueAtTime(0, t + at);
      gn.gain.linearRampToValueAtTime(g * (d ? 0.6 : 1), t + at + 0.25);
      gn.gain.linearRampToValueAtTime(0, t + at + dur);
      o.connect(lp).connect(gn).connect(out);
      o.start(t + at);
      o.stop(t + at + dur + 0.1);
    }
  };
  if (m === 'tense') {
    horn(73.4, 0, 1.6, 0.04);
    horn(77.8, 0.5, 1.4, 0.03);
    thud(a, out, 0);
    thud(a, out, 0.5);
  } else if (m === 'uneasy') {
    horn(146.8, 0, 0.9);
    horn(138.6, 0.6, 1.2);
  } else if (m === 'hearing') {
    horn(130.8, 0, 1.2);
    horn(196, 0.35, 1.4);
  } else if (m === 'triumph') {
    horn(146.8, 0, 0.7);
    horn(185, 0.25, 0.7);
    horn(220, 0.5, 1.6, 0.035);
  } else if (m === 'somber') {
    horn(110, 0, 2.2, 0.03);
    horn(87.3, 0.8, 2.4, 0.025);
  } else {
    note(a, out, 293.7, 0, 1.6);
  }
}

/** The next chord: mostly the next in the set, sometimes a step back or a jump, so the progression never loops. */
function nextChord(n: number): number {
  if (chance(0.55)) return (chordAt + 1) % n;
  if (chance(0.5)) return (chordAt + n - 1) % n;
  return Math.floor(Math.random() * n);
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
  chordAt = step === 0 ? 0 : nextChord(set.length);
  const freqs = set[chordAt];
  // Now and then the music takes a breath: the pad alone, softer, with no melody.
  const breath = step > 3 && chance(0.14);
  chord(a, master, freqs, seconds, breath ? 0.6 : 1);
  if (!breath) {
    const beat = seconds / 4;
    const scale = SCALE(mood);
    const phrase = PHRASES[mood][Math.floor(Math.random() * PHRASES[mood].length)];
    const half = step % 2;
    for (let i = 0; i < 4; i++) {
      const d = phrase[half * 4 + i];
      if (d >= 0) note(a, master, freqs[0] * 2 * Math.pow(2, scale[d % scale.length] / 12), i * beat + 0.2, beat * 1.6);
    }
    if (mood === 'tense') for (let i = 0; i < 4; i++) thud(a, master, i * beat);
    if (mood === 'uneasy') thud(a, master, 0);
  }
  // In quiet times, a drop forge somewhere across the valley.
  if ((mood === 'calm' || mood === 'uneasy') && a.currentTime > hammerAt) {
    thud(a, master, 1 + Math.random() * seconds * 0.6, true);
    hammerAt = a.currentTime + 7 + Math.random() * 9;
  }
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
    const m = mixer();
    if (!a || !m || timer !== null) return;
    master = a.createGain();
    master.gain.value = volume;
    master.connect(m.music);
    startBed(a, master);
    tick();
    setPulse(a, master, mood === 'tense' || mood === 'uneasy');
  },
  stop(): void {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    const a = ctx;
    if (a && master) {
      setPulse(a, master, false);
      stopBed(a);
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
    if (ctx && master) {
      setPulse(ctx, master, mood === 'tense' || mood === 'uneasy');
      // A cue at once, and the new mood's music a moment later rather than at the end of the old chord.
      stinger(ctx, master, mood);
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(tick, 1400);
    }
  },
  setVolume(v: number): void {
    volume = Math.max(0, Math.min(1, v));
    if (ctx && master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.3);
  },
  /** Silence while the game's tab is hidden; carry on when it comes back. */
  setHidden(h: boolean): void {
    hidden = h;
    setAudioHidden(h);
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
  /** Everything, 0..1 (older saved settings lack it: 1). */
  master?: number;
  /** At 4× and 8×, leave routine news to the log (older saved settings lack it: on). */
  quietAtSpeed?: boolean;
}
const KEY = 'forge-command-audio';
// Music is on for new players since 17.2, at a level that sits under the sounds.
const DEFAULTS: AudioPrefs = { sfx: true, music: true, volume: 0.35, sfxVolume: 0.7, master: 1, quietAtSpeed: true };
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
