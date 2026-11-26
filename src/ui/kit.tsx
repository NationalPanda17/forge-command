// Small shared UI pieces.
import { useEffect, useRef, type ReactNode } from 'react';
import { toneFor } from './format';

export function Panel({ title, right, children, className = '', id }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`panel ${className}`} id={id}>
      {title && (
        <div className="panel-title">
          <span>{title}</span>
          {right && <span className="label normal-case tracking-normal">{right}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Bar({ ratio, tone, className = '', title }: { ratio: number; tone?: string; className?: string; title?: string }) {
  const r = Math.max(0, Math.min(1, ratio));
  return (
    <div className={`bar ${className}`} title={title} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(r * 100)}>
      <span className={`transition-[width] duration-700 ease-out motion-reduce:transition-none ${tone ?? toneFor(ratio)}`} style={{ width: `${r * 100}%` }} />
    </div>
  );
}

export function Stat({ label, value, sub, tone = 'text-white' }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="label">{label}</div>
      <div className={`truncate ${tone}`}>{value}</div>
      {sub && <div className="truncate text-[10px] text-ops-dim">{sub}</div>}
    </div>
  );
}

export function Chip({ children, tone = 'border-ops-line text-ops-dim', title }: { children: ReactNode; tone?: string; title?: string }) {
  return (
    <span className={`chip ${tone}`} title={title}>
      {children}
    </span>
  );
}

export function Btn({
  children,
  onClick,
  disabled,
  why,
  kind = 'default',
  className = '',
  title,
  pressed,
  id,
  type = 'button',
  ariaLabel,
}: {
  /** A name for screen readers, for a button whose face is a symbol. */
  ariaLabel?: string;
  id?: string;
  /** A button inside a form can submit it. */
  type?: 'button' | 'submit';
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** Reason the action is unavailable: disables the button and becomes its tooltip. */
  why?: string | null;
  kind?: 'default' | 'primary' | 'danger' | 'warn';
  className?: string;
  title?: string;
  pressed?: boolean;
}) {
  const k = kind === 'primary' ? 'btn-primary' : kind === 'danger' ? 'btn-danger' : kind === 'warn' ? 'border-ops-amber/60 bg-ops-amber/10 text-ops-amber hover:bg-ops-amber/20' : '';
  return (
    <button
      id={id}
      type={type}
      className={`btn ${k} ${pressed ? 'btn-active' : ''} ${className}`}
      onClick={onClick}
      disabled={disabled || !!why}
      title={why ?? title}
      aria-pressed={pressed}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label, tones }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string; tones?: Partial<Record<T, string>> }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`btn min-w-[24px] px-1.5 ${value === o.id ? (tones?.[o.id] ?? 'btn-active') : ''}`}
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export interface Series {
  label: string;
  /** null leaves a gap (for example, history and forecast on one chart). */
  values: (number | null)[];
  color: string;
  dashed?: boolean;
}

const lastValue = (v: (number | null)[]) => {
  for (let i = v.length - 1; i >= 0; i--) if (v[i] !== null && Number.isFinite(v[i])) return v[i] as number;
  return 0;
};

/** A compact multi-series line chart (SVG). */
export function LineChart({
  series,
  height = 120,
  min,
  max,
  format = (v: number) => v.toFixed(0),
  xLabels,
  marker,
  markerLabel,
}: {
  series: Series[];
  height?: number;
  min?: number;
  max?: number;
  format?: (v: number) => string;
  xLabels?: string[];
  /** Index of a vertical marker, such as today. */
  marker?: number;
  markerLabel?: string;
}) {
  const n = Math.max(...series.map((s) => s.values.length));
  if (n < 2) return <div className="flex h-16 items-center text-[11px] text-ops-dim">History appears after a couple of months.</div>;
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null && Number.isFinite(v));
  const lo = min ?? Math.min(0, ...all);
  const hi = max ?? Math.max(...all, lo + 1);
  const w = 400;
  const pad = 4;
  const y = (v: number) => pad + (height - 2 * pad) * (1 - (v - lo) / (hi - lo || 1));
  const x = (i: number) => (i / (n - 1)) * w;
  const runs = (vals: (number | null)[]) => {
    const out: string[] = [];
    let cur: string[] = [];
    vals.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) {
        if (cur.length > 1) out.push(cur.join(' '));
        cur = [];
      } else cur.push(`${x(i)},${y(v)}`);
    });
    if (cur.length > 1) out.push(cur.join(' '));
    return out;
  };
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-[10px] text-ops-dim">
        <span>{format(hi)}</span>
        {markerLabel && <span className="text-ops-cyan">{markerLabel}</span>}
      </div>
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none" role="img" aria-label={series.map((s) => s.label).join(', ')}>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={0} x2={w} y1={pad + (height - 2 * pad) * g} y2={pad + (height - 2 * pad) * g} stroke="rgb(var(--ops-line))" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        {lo < 0 && hi > 0 && <line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke="rgb(var(--ops-dim))" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
        {marker !== undefined && <line x1={x(marker)} x2={x(marker)} y1={0} y2={height} stroke="rgb(var(--ops-cyan) / 0.6)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />}
        {series.map((s) =>
          runs(s.values).map((pts, k) => (
            <polyline key={`${s.label}-${k}`} points={pts} fill="none" stroke={s.color} strokeWidth={1.75} strokeDasharray={s.dashed ? '5 4' : undefined} vectorEffect="non-scaling-stroke" />
          )),
        )}
      </svg>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-[10px] text-ops-dim">
        <span>{xLabels?.[0]}</span>
        <span className="flex flex-1 flex-wrap justify-center gap-x-3 gap-y-1">
          {series.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1 whitespace-nowrap">
              <span className="inline-block h-0.5 w-3" style={{ background: s.color }} />
              {s.label} <span className="text-ops-text">{format(lastValue(s.values))}</span>
            </span>
          ))}
        </span>
        <span>{xLabels?.[xLabels.length - 1]}</span>
      </div>
    </div>
  );
}

export const COLORS = {
  cyan: 'rgb(var(--ops-cyan))',
  amber: 'rgb(var(--ops-amber))',
  green: 'rgb(var(--ops-green))',
  red: 'rgb(var(--ops-red))',
  violet: 'rgb(var(--ops-violet))',
  blue: 'rgb(var(--ops-blue))',
  dim: 'rgb(var(--ops-dim))',
};

export function NumberInput({ value, onChange, min = 0, step = 1, label, className = 'w-20' }: { value: number; onChange: (v: number) => void; min?: number; step?: number; label: string; className?: string }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min={min}
      step={step}
      className={`input py-0.5 ${className}`}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => {
        // Typing 1e999 must not hand the game Infinity.
        const n = Number(e.target.value);
        onChange(Math.max(min, Number.isFinite(n) ? n : 0));
      }}
      aria-label={label}
    />
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="p-3 text-[11px] text-ops-dim">{children}</p>;
}

/** A small trend line with no axes: the shape of the last few months. */
export function Sparkline({ values, color = COLORS.cyan, width = 96, height = 22, label }: { values: number[]; color?: string; width?: number; height?: number; label: string }) {
  if (values.length < 2) return <svg width={width} height={height} role="img" aria-label={`${label}: not enough history yet`} />;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (width - 4) + 2).toFixed(1)},${(height - 2 - ((v - lo) / span) * (height - 4)).toFixed(1)}`).join(' ');
  const last = pts.split(' ').at(-1)!.split(',');
  return (
    <svg width={width} height={height} role="img" aria-label={`${label}, last ${values.length} months`} className="block">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2} fill={color} />
    </svg>
  );
}

/** Wraps a number in the header: when `value` moves, it glows green (up) or red (down) for a moment. */
export function Flash({ value, children }: { value: number; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  useEffect(() => {
    const el = ref.current;
    if (!el || value === prev.current) return;
    const cls = value > prev.current ? 'fc-up' : 'fc-down';
    prev.current = value;
    el.classList.remove('fc-up', 'fc-down');
    void el.offsetWidth; // restart the animation
    el.classList.add(cls);
  }, [value]);
  return (
    <span ref={ref} className="inline-block">
      {children}
    </span>
  );
}
