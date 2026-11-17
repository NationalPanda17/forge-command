// Generated background music: slow pad chords, with a low pulse when a crisis is on. No audio files.
type Mood = 'calm' | 'tense';

const CALM: number[][] = [
  [146.83, 220.0, 293.66, 349.23], // D minor
  [116.54, 174.61, 233.08, 293.66], // B flat
  [130.81, 196.0, 261.63, 329.63], // C
  [110.0, 164.81, 220.0, 277.18], // A
];
const TENSE: number[][] = [
  [146.83, 207.65, 293.66, 349.23],
  [138.59, 207.65, 277.18, 329.63],
  [146.83, 220.0, 311.13, 349.23],
  [130.81, 196.0, 277.18, 311.13],
];
const CHORD_SECONDS = 9;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: number | null = null;
let step = 0;
let mood: Mood = 'calm';
let volume = 0.5;
let pulse: { osc: OscillatorNode; gain: GainNode } | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function chord(a: AudioContext, out: GainNode, freqs: number[]): void {
  const t = a.currentTime;
  const filter = a.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(mood === 'tense' ? 900 : 650, t);
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
      g.gain.linearRampToValueAtTime(0.022 / (i + 1), t + 3);
      g.gain.linearRampToValueAtTime(0.018 / (i + 1), t + CHORD_SECONDS - 1);
      g.gain.linearRampToValueAtTime(0, t + CHORD_SECONDS + 2.5);
      o.connect(g).connect(filter);
      o.start(t);
      o.stop(t + CHORD_SECONDS + 3);
    }
  });
}

function setPulse(a: AudioContext, out: GainNode, on: boolean): void {
  if (on && !pulse) {
    const osc = a.createOscillator();
    const gain = a.createGain();
    const lfo = a.createOscillator();
    const depth = a.createGain();
    osc.type = 'sine';
    osc.frequency.value = 55;
    gain.gain.value = 0.02;
    lfo.frequency.value = 1.1;
    depth.gain.value = 0.02;
    lfo.connect(depth).connect(gain.gain);
    osc.connect(gain).connect(out);
    osc.start();
    lfo.start();
    pulse = { osc, gain };
  } else if (!on && pulse) {
    const t = a.currentTime;
    pulse.gain.gain.cancelScheduledValues(t);
    pulse.gain.gain.linearRampToValueAtTime(0, t + 2);
    pulse.osc.stop(t + 2.1);
    pulse = null;
  }
}

function tick(): void {
  const a = audio();
  if (!a || !master) return;
  const set = mood === 'tense' ? TENSE : CALM;
  chord(a, master, set[step % set.length]);
  step++;
}

export const music = {
  get playing() {
    return timer !== null;
  },
  start(): void {
    const a = audio();
    if (!a || timer !== null) return;
    master = a.createGain();
    master.gain.value = volume;
    master.connect(a.destination);
    tick();
    timer = window.setInterval(tick, CHORD_SECONDS * 1000);
    setPulse(a, master, mood === 'tense');
  },
  stop(): void {
    if (timer !== null) window.clearInterval(timer);
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
    if (ctx && master) setPulse(ctx, master, mood === 'tense');
  },
  setVolume(v: number): void {
    volume = Math.max(0, Math.min(1, v));
    if (ctx && master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.3);
  },
};

// ---------- Audio settings, remembered in this browser ----------

export interface AudioPrefs {
  sfx: boolean;
  music: boolean;
  volume: number;
}
const KEY = 'forge-command-audio';
export function loadAudioPrefs(): AudioPrefs {
  try {
    return { sfx: true, music: false, volume: 0.5, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}) };
  } catch {
    return { sfx: true, music: false, volume: 0.5 };
  }
}
export function saveAudioPrefs(p: AudioPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage may be unavailable */
  }
}
