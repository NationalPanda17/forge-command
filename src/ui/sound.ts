// Small synthesized sounds (no audio files): a click, an end-of-month chime, an alert and a fanfare.
let ctx: AudioContext | null = null;
let enabled = true;

export const setSoundEnabled = (on: boolean) => {
  enabled = on;
};

function audio(): AudioContext | null {
  if (!enabled || typeof window === 'undefined') return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.05): void {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = a.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export const sfx = {
  click: () => tone(880, 0, 0.05, 'triangle', 0.025),
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
};
