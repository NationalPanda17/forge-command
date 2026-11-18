// Planning: each round's stock over time and a year ahead, what limits it, and the weakest links in the chain.
import { useMemo, useState } from 'react';
import { balances, forecast, monthsTo, siteName, trace, weakLinks } from '../sim/analytics';
import { inGrace, nationalStock, reserveTarget } from '../sim/selectors';
import type { SimState } from '../sim/types';
import { FINISHED, MATERIALS, type LineId, type MaterialId } from '../sim/world';
import { Bar, COLORS, LineChart } from '../ui/kit';
import { Explain } from '../ui/Explain';
import { flowWhy, stockWhy } from './explain';
import { pct, qty } from '../ui/format';
import { monthLabel2 } from './useSim';

const ratioTone = (r: number) => (r >= 1.1 ? 'bg-ops-green' : r >= 0.95 ? 'bg-ops-amber' : 'bg-ops-red');
const ratioText = (r: number) => (r >= 1.1 ? 'text-ops-green' : r >= 0.95 ? 'text-ops-amber' : 'text-ops-red');
const ratioLabel = (r: number) => (Number.isFinite(r) ? `${Math.round(r * 100)}%` : '—');

export default function PlanPanel({ state, onMaterial, onSite }: { state: SimState; onMaterial: (m: MaterialId) => void; onSite: (id: string) => void }) {
  const lines = (FINISHED as LineId[]).filter((l) => state.lines[l].unlocked);
  const [line, setLine] = useState<LineId>(lines[0]);
  const bal = useMemo(() => balances(state), [state]);
  const f = useMemo(() => forecast(state, line, 12), [state, line]);
  const steps = useMemo(() => trace(state, line, bal), [state, line, bal]);
  const weak = useMemo(() => weakLinks(state, bal).slice(0, 8), [state, bal]);

  // Timeline: up to two years of history, today, then twelve months of forecast.
  const hist = state.history.slice(-24);
  const n = hist.length;
  const future = f.slice(1);
  const stockSeries = [...hist.map((h) => h.stock?.[line] ?? null), f[0].stock, ...future.map(() => null)];
  const forecastSeries = [...hist.map(() => null), f[0].stock, ...future.map((p) => p.stock)];
  const targetSeries = [...hist.map((h) => h.target?.[line] ?? null), f[0].target, ...future.map((p) => p.target)];
  const startMonth = n ? hist[0].month : state.history.length;
  const xLabels = [monthLabel2(startMonth), monthLabel2(startMonth + n + future.length)];

  const half = monthsTo(state, line, 0.5);
  const level = nationalStock(state, line) / Math.max(1, reserveTarget(state, line));
  const end = f.at(-1)!;
  const over = lines.filter((l) => nationalStock(state, l) > reserveTarget(state, l) * 2 && reserveTarget(state, l) > 0);

  return (
    <div className="space-y-4 p-3 text-[11px]">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Round">
        {lines.map((l) => {
          const r = nationalStock(state, l) / Math.max(1, reserveTarget(state, l));
          return (
            <button key={l} type="button" aria-pressed={l === line} onClick={() => setLine(l)} className={`btn min-h-[24px] px-2 py-0.5 normal-case tracking-normal ${l === line ? 'border-ops-cyan text-ops-cyan' : ''}`}>
              {MATERIALS[l].name} <span className={ratioText(r)}>{pct(Math.min(9.99, r))}</span>
            </button>
          );
        })}
      </div>

      <section>
        <h3 className="label mb-1">{MATERIALS[line].name}: stock and a year ahead</h3>
        <LineChart
          height={130}
          xLabels={xLabels}
          marker={n}
          markerLabel="today"
          format={(v) => qty(v)}
          series={[
            { label: 'Stock', values: stockSeries, color: COLORS.cyan },
            { label: 'Forecast', values: forecastSeries, color: COLORS.cyan, dashed: true },
            { label: 'Target', values: targetSeries, color: COLORS.dim, dashed: true },
          ]}
        />
        <p className="mt-2 text-ops-text">
          Now at{' '}
          <Explain title={`${MATERIALS[line].name} stock`} lines={() => stockWhy(state, line)}>
            <span className={ratioText(level)}>{pct(level)}</span>
          </Explain>{' '}
          of target.
          {inGrace(state, line) ? ' A new line: the Committee will judge it after its first year.' : ''}
          {half !== null ? (
            <span className="text-ops-red"> At this rate it falls below half of target in {half} month{half > 1 ? 's' : ''}.</span>
          ) : end.stock >= end.target ? (
            <span className="text-ops-green"> On course to stay at or above target for the year.</span>
          ) : (
            <span className="text-ops-amber"> Ends the year at {pct(end.stock / Math.max(1, end.target))} of target.</span>
          )}
        </p>
        <p className="mt-1 text-ops-dim">
          <Explain title="Each month" lines={() => flowWhy(state, line)}>Each month</Explain>: about {qty(end.made)} made, {qty(end.used)} expected to be fired{state.crisis ? ' (crisis included)' : ''}, and {qty(f.reduce((a, p) => a + p.retired, 0) / 12)} reaching the end of their life.
        </p>
      </section>

      <section>
        <h3 className="label mb-1">What limits it</h3>
        <p className="mb-2 text-ops-dim">Supply against demand at each level of the bill of materials, following the tightest input down to the mine.</p>
        <ol className="space-y-1.5">
          {steps.map((st) => (
            <li key={st.material} className="grid grid-cols-[minmax(0,1fr)_88px_44px] items-center gap-2" style={{ paddingLeft: Math.min(st.depth, 6) * 8 }}>
              <span className="min-w-0">
                <button type="button" className="truncate text-left text-white hover:underline" onClick={() => onMaterial(st.material)}>
                  {MATERIALS[st.material].name}
                </button>
                <span className="block break-words text-[10px] text-ops-dim">
                  {qty(st.supply)} a day against {qty(st.demand)}
                  {st.top && (
                    <>
                      {' · '}
                      <button type="button" className="hover:underline" onClick={() => onSite(st.top!)}>
                        {siteName(st.top)}
                      </button>
                    </>
                  )}
                </span>
              </span>
              <Bar ratio={Math.min(1, Number.isFinite(st.ratio) ? st.ratio / 1.5 : 1)} tone={ratioTone(st.ratio)} />
              <span className={`text-right ${ratioText(st.ratio)}`}>{ratioLabel(st.ratio)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h3 className="label mb-1">Weakest links in the whole chain</h3>
        {weak.length ? (
          <ul className="space-y-1">
            {weak.map((b) => (
              <li key={b.material} className="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-2">
                <button type="button" className="truncate text-left text-ops-text hover:underline" onClick={() => onMaterial(b.material)}>
                  {MATERIALS[b.material].name} <span className="text-ops-dim">· {siteName(b.top)}</span>
                </button>
                <span className={`text-right ${ratioText(b.ratio)}`}>{ratioLabel(b.ratio)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ops-green">Every material has headroom over today's plan.</p>
        )}
      </section>

      {over.length > 0 && (
        <section className="rounded border border-ops-amber/40 bg-ops-amber/5 p-2">
          <h3 className="label mb-1 text-ops-amber">Overstocked</h3>
          <p className="text-ops-text">
            {over.map((l) => MATERIALS[l].name).join(', ')} {over.length > 1 ? 'are' : 'is'} above twice target. Those lines still eat motors, warheads and seekers that other rounds need: idle or slow them at their arsenal.
          </p>
        </section>
      )}
    </div>
  );
}
