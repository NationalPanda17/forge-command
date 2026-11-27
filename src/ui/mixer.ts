// The mixer (17.2): one audio context for the whole game. Sound effects and music each have their own bus, both feed
// a master volume and a compressor (so a burst of sounds never clips), and the music dips briefly under an important
// sound so it can be heard.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let masterVolume = 1;

/** The context and its buses, created on first use (after a click, as browsers require). Null without Web Audio. */
export function mixer(): { ctx: AudioContext; music: GainNode; sfx: GainNode } | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.25;
      master = ctx.createGain();
      master.gain.value = masterVolume;
      musicBus = ctx.createGain();
      sfxBus = ctx.createGain();
      musicBus.connect(master);
      sfxBus.connect(master);
      master.connect(comp).connect(ctx.destination);
    }
    return { ctx, music: musicBus!, sfx: sfxBus! };
  } catch {
    return null;
  }
}

/** Master volume, 0..1. */
export function setMasterVolume(v: number): void {
  masterVolume = Math.max(0, Math.min(1, v));
  if (ctx && master) master.gain.setTargetAtTime(masterVolume, ctx.currentTime, 0.05);
}

/** Lowers the music by `db` decibels for `seconds`, then brings it back. */
export function duckMusic(db = 4, seconds = 1.2): void {
  if (!ctx || !musicBus) return;
  const t = ctx.currentTime;
  const low = Math.pow(10, -db / 20);
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setTargetAtTime(low, t, 0.03);
  musicBus.gain.setTargetAtTime(1, t + seconds, 0.4);
}

/** Wakes the context if the browser suspended it (it does until the first click). */
export function resumeAudio(): void {
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}

/** Silence while the tab is hidden; carry on when it comes back. */
export function setAudioHidden(hidden: boolean): void {
  if (!ctx) return;
  if (hidden) void ctx.suspend();
  else void ctx.resume();
}
