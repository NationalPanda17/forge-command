import type { GameState } from '../engine';
import { money, monthLabel } from './format';

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="h-10 text-[10px] text-ops-dim">History appears after a couple of months.</div>;
  const w = 240;
  const h = 40;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - v * (h - 4) - 2}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full" preserveAspectRatio="none" role="img" aria-label="Readiness history">
      <line x1={0} x2={w} y1={h - 0.9 * (h - 4) - 2} y2={h - 0.9 * (h - 4) - 2} stroke="rgb(var(--ops-line))" strokeDasharray="3 3" />
      <polyline points={pts} fill="none" stroke="rgb(var(--ops-cyan))" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function ReportPanel({ state }: { state: GameState }) {
  const last = state.history.at(-1);
  return (
    <section className="panel">
      <div className="panel-title">
        <span>Monthly report</span>
        {last && <span className="label normal-case tracking-normal">{monthLabel(last.month)}</span>}
      </div>
      <div className="space-y-3 p-3">
        <div>
          <div className="label mb-1">Readiness</div>
          <Sparkline values={state.history.map((h) => h.readiness)} />
        </div>
        {last ? (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              {(
                [
                  ['Parts', last.spend.components],
                  ['Plants', last.spend.operations],
                  ['Capital', last.spend.capital],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="rounded border border-ops-line/60 px-1 py-1">
                  <div className="label">{k}</div>
                  <div className="text-white">{money(v)}</div>
                </div>
              ))}
            </div>
            <ul className="space-y-1 text-[11px]">
              {last.messages.length === 0 && <li className="text-ops-dim">A quiet month.</li>}
              {last.messages.map((m, i) => (
                <li
                  key={i}
                  className={
                    m.startsWith('Shortfall') || m.startsWith('Recall') || m.startsWith('Shortage') || m.includes('over budget')
                      ? 'text-ops-red'
                      : m.startsWith('Quality') || m.startsWith('Intel') || m.startsWith('Crisis')
                        ? 'text-ops-amber'
                        : 'text-ops-text'
                  }
                >
                  {m}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-[11px] leading-relaxed text-ops-dim">
            You run the munitions production board of the Commonwealth of Aldmere. Keep the national reserve near its goal
            without running out of money. Every line draws on the same few suppliers: when one of them stumbles, every line
            that needs that part slows down. Set shifts, buy parts and add floor space, then end the month.
          </p>
        )}
      </div>
    </section>
  );
}
