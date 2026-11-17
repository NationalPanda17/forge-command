// Deterministic, serializable RNG (mulberry32). The state lives inside GameState so saves replay identically.

export function rand(s: { rng: number }): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const randRange = (s: { rng: number }, a: number, b: number) => a + rand(s) * (b - a);
export const randInt = (s: { rng: number }, a: number, b: number) => Math.floor(randRange(s, a, b + 1));
export function pick<T>(s: { rng: number }, arr: readonly T[]): T {
  return arr[Math.floor(rand(s) * arr.length)];
}

/** Turns any string or number into a 32-bit seed. */
export function seedFrom(input: string | number): number {
  const str = String(input);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));
