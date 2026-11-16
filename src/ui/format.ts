const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const monthLabel = (m: number) => `${MONTHS[m % 12]} · Year ${Math.floor(m / 12) + 1}`;

/** $M in, short money string out. */
export function money(m: number): string {
  const sign = m < 0 ? '−' : '';
  const a = Math.abs(m);
  if (a >= 1000) return `${sign}$${(a / 1000).toFixed(2)}B`;
  if (a >= 10) return `${sign}$${a.toFixed(0)}M`;
  if (a >= 1) return `${sign}$${a.toFixed(1)}M`;
  return `${sign}$${(a * 1000).toFixed(0)}K`;
}

export function qty(v: number): string {
  const a = Math.abs(v);
  const digits = a >= 100 ? 0 : a >= 10 ? 1 : 2;
  return v.toLocaleString('en-US', { maximumFractionDigits: digits });
}

export const pct = (v: number) => `${Math.round(v * 100)}%`;

export function toneFor(ratio: number): string {
  if (ratio >= 0.9) return 'bg-ops-green';
  if (ratio >= 0.5) return 'bg-ops-amber';
  return 'bg-ops-red';
}

export function textToneFor(ratio: number): string {
  if (ratio >= 0.9) return 'text-ops-green';
  if (ratio >= 0.5) return 'text-ops-amber';
  return 'text-ops-red';
}
