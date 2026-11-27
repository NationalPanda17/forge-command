// Money as the player reads it (19.3): $M in, a short string out ($128K, $12.8M, $1.36B). Shared by the game's own
// messages and the screens, so a price looks the same wherever it appears.
/** $M in, short money string out. */
export function money(m: number): string {
  if (!Number.isFinite(m)) return '—';
  const a = Math.abs(m);
  const sign = m < 0 && a >= 0.000001 ? '−' : '';
  if (a >= 1000) return `${sign}$${(a / 1000).toFixed(2)}B`;
  if (a >= 10) return `${sign}$${a.toFixed(0)}M`;
  if (a >= 1) return `${sign}$${a.toFixed(1)}M`;
  if (a >= 0.001) return `${sign}$${(a * 1000).toFixed(0)}K`;
  if (a >= 0.000001) return `${sign}$${Math.round(a * 1e6)}`;
  return `${sign}$0`;
}
