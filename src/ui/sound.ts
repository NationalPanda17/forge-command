// Small synthesized sounds (no audio files): one for each kind of event, so you can hear what happened without looking.
let ctx: AudioContext | null = null;
let enabled = true;
let volume = 0.7;

export const setSoundEnabled = (on: boolean) => {
  enabled = on;
};
export const setSoundVolume = (v: number) => {
  volume = Math.max(0, Math.min(1, v));
};

function audio(): AudioContext | null {
  if (!enabled || volume <= 0 || typeof window === 'undefined' || document.hidden) return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.05, slideTo?: number): void {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  const t = a.currentTime + start;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain * volume, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** A short burst of filtered noise: crackle, static, a crowd. */
function noise(start: number, dur: number, freq: number, gain = 0.04): void {
  const a = audio();
  if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  // Sound only, never the game: Math.random is fine here.
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 1.2;
  const g = a.createGain();
  g.gain.value = gain * volume;
  src.connect(f).connect(g).connect(a.destination);
  src.start(a.currentTime + start);
}

export const sfx = {
  /** A control pressed: a short, dry tick. */
  click: () => tone(1250, 0, 0.035, 'triangle', 0.014),
  /** The clock stops: a falling tape-stop. */
  pause: () => tone(330, 0, 0.22, 'triangle', 0.03, 140),
  /** The clock starts: the same, rising. */
  resume: () => tone(170, 0, 0.18, 'triangle', 0.03, 360),
  /** Speed changed: a gear ratchet, one tick for each step. */
  speed: () => {
    tone(700, 0, 0.03, 'square', 0.012);
    tone(820, 0.045, 0.03, 'square', 0.012);
  },
  month: () => {
    tone(523, 0, 0.18, 'sine');
    tone(659, 0.09, 0.22, 'sine');
  },
  alert: () => {
    tone(220, 0, 0.18, 'sawtooth', 0.03);
    tone(196, 0.16, 0.22, 'sawtooth', 0.03);
  },
  fanfare: () => {
    tone(523, 0, 0.15, 'triangle');
    tone(659, 0.12, 0.15, 'triangle');
    tone(784, 0.24, 0.3, 'triangle');
  },
  /** A new decision card: a soft knock. */
  decision: () => {
    tone(392, 0, 0.12, 'triangle', 0.04);
    tone(392, 0.16, 0.12, 'triangle', 0.04);
  },
  /** Power fails: a falling hum. */
  blackout: () => tone(220, 0, 0.9, 'sawtooth', 0.03, 55),
  /** A strike or protest: a murmuring crowd. */
  crowd: () => {
    noise(0, 0.6, 700, 0.05);
    noise(0.25, 0.5, 500, 0.04);
  },
  /** Hackers: static and a glitch. */
  cyber: () => {
    noise(0, 0.25, 3000, 0.04);
    tone(1200, 0.05, 0.08, 'square', 0.02);
    tone(600, 0.15, 0.08, 'square', 0.02);
  },
  /** Spies: a sly two-note figure. */
  spy: () => {
    tone(311, 0, 0.2, 'triangle', 0.04);
    tone(294, 0.2, 0.35, 'triangle', 0.04);
  },
  /** Good news: a rising chime. */
  success: () => {
    tone(659, 0, 0.12, 'sine', 0.045);
    tone(880, 0.1, 0.25, 'sine', 0.045);
  },
  /** Bad news: a falling pair. */
  failure: () => {
    tone(330, 0, 0.15, 'triangle', 0.04);
    tone(247, 0.14, 0.3, 'triangle', 0.04);
  },
  /** Research or building finished: a bright triad. */
  done: () => {
    tone(523, 0, 0.1, 'sine', 0.035);
    tone(659, 0.06, 0.1, 'sine', 0.035);
    tone(784, 0.12, 0.2, 'sine', 0.035);
  },
  /** The rival fields a weapon: a low warning. */
  rival: () => {
    tone(110, 0, 0.5, 'sawtooth', 0.035);
    tone(104, 0.3, 0.5, 'sawtooth', 0.03);
  },
};

export type SoundId = keyof typeof sfx;

/** How weighty each sound is: a lesser sound never cuts across a weightier one just played. */
const PRIORITY: Record<SoundId, number> = {
  click: 0, speed: 1, pause: 1, resume: 1, month: 2, done: 3, success: 3, decision: 4, failure: 4, crowd: 5, spy: 5, cyber: 5, fanfare: 5, alert: 6, blackout: 7, rival: 8,
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
  lastPlayed[id] = now;
  if (PRIORITY[id] >= 2) held = { until: now + HOLD, priority: PRIORITY[id] };
  sfx[id]();
  return true;
}

/** Clears the cooldowns (tests, or a new game). */
export function resetSounds(): void {
  for (const k of Object.keys(lastPlayed)) delete lastPlayed[k as SoundId];
  held = { until: 0, priority: -1 };
}

/** Which sound a feed line calls for, if any. */
export function soundFor(text: string, tone: string): SoundId | null {
  if (/Power is back/.test(text)) return 'success';
  if (/^A blackout hits|black out /.test(text)) return 'blackout';
  if (/^Strike at|walks out|^Work to rule|^Protesters block/.test(text)) return 'crowd';
  if (/Ransomware|[Hh]ackers|cyber attack/.test(text)) return 'cyber';
  if (/^Operation succeeds/.test(text)) return 'success';
  if (/^Operation fails|operation is exposed/i.test(text)) return 'failure';
  if (/spy ring|[Ss]abotage at/.test(text) && tone !== 'good') return 'spy';
  if (tone === 'bad' && /fields /.test(text) && /Directorate|rival/i.test(text)) return 'rival';
  if (/^Research complete|opens to traffic|opens and starts|is fitted out|opens its doors/i.test(text) || /^Accepted: /.test(text)) return 'done';
  if (/A decision is waiting/.test(text)) return 'decision';
  return null;
}
