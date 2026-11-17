import {
  DIFFICULTY,
  LINES,
  activeLines,
  THREATS,
  THREAT_IDS,
  advise,
  coverMonths,
  reserveTarget,
  nationalStock,
  type Action,
  type GameState,
} from '../../engine';
import { Bar, Btn, COLORS, LineChart, Panel } from '../kit';
import { int, messageTone, money, monthLabel, qty, shortMonth, textToneFor } from '../format';
import DecisionCards from '../DecisionCards';
import Objectives, { Briefing } from '../Objectives';

export default function Overview({ state, act }: { state: GameState; act: (a: Action) => void }) {
  const last = state.history.at(-1);
  const level = DIFFICULTY[state.difficulty].advisor;
  const tips = level === 'none' ? [] : advise(state);
  const months = state.history.map((h) => shortMonth(h.month));
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-3">
        {state.decisions.length > 0 && <DecisionCards state={state} act={act} />}

        <Panel title={last ? `Report · ${monthLabel(last.month)}` : 'Your first month'} right={last ? `${last.messages.length} items` : undefined}>
          {last ? (
            <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_260px]">
              <ul className="space-y-1 text-[12px] leading-snug">
                {last.messages.length === 0 && <li className="text-ops-dim">A quiet month.</li>}
                {last.messages.map((m, i) => (
                  <li key={i} className={messageTone[m.tone]}>
                    <span aria-hidden="true" className="mr-1.5 opacity-60">
                      {m.tone === 'good' ? '▲' : m.tone === 'bad' ? '▼' : m.tone === 'warn' ? '◆' : '·'}
                    </span>
                    {m.text}
                  </li>
                ))}
              </ul>
              <div className="space-y-2">
                <div className="label">Threats last month</div>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-ops-dim">
                      <th className="text-left font-normal">Class</th>
                      <th className="text-right font-normal">In</th>
                      <th className="text-right font-normal">Stopped</th>
                      <th className="text-right font-normal">Through</th>
                    </tr>
                  </thead>
                  <tbody>
                    {THREAT_IDS.map((t) => {
                      const r = last.threats[t];
                      return (
                        <tr key={t}>
                          <td className="truncate pr-1" title={THREATS[t].name}>
                            {THREATS[t].name.replace('Short-range ', '')}
                          </td>
                          <td className="text-right">{int(r.arrived)}</td>
                          <td className="text-right text-ops-green">{int(r.stopped)}</td>
                          <td className={`text-right ${r.leaked >= 0.5 ? 'text-ops-red' : 'text-ops-dim'}`}>{int(r.leaked)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="flex justify-between text-[11px]">
                  <span className="text-ops-dim">Fired</span>
                  <span>{money(last.interceptorSpend)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-ops-dim">Threat value stopped</span>
                  <span className="text-ops-green">{money(last.threatValueStopped)}</span>
                </div>
              </div>
            </div>
          ) : (
            <Briefing state={state} />
          )}
        </Panel>

        <Panel title="Trends">
          <div className="grid gap-4 p-3 md:grid-cols-2">
            <div>
              <div className="label mb-1">Readiness and confidence</div>
              <LineChart
                min={0}
                max={100}
                xLabels={months}
                series={[
                  { label: 'Readiness', values: state.history.map((h) => h.readiness * 100), color: COLORS.cyan },
                  { label: 'Confidence', values: state.history.map((h) => h.confidence), color: COLORS.amber },
                ]}
                format={(v) => `${Math.round(v)}`}
              />
            </div>
            <div>
              <div className="label mb-1">Threats in vs through</div>
              <LineChart
                min={0}
                xLabels={months}
                series={[
                  { label: 'Arrived', values: state.history.map((h) => Object.values(h.threats).reduce((a, t) => a + t.arrived, 0)), color: COLORS.dim },
                  { label: 'Through', values: state.history.map((h) => Object.values(h.threats).reduce((a, t) => a + t.leaked, 0)), color: COLORS.red },
                ]}
              />
            </div>
          </div>
        </Panel>
      </div>

      <div className="space-y-3">
        <Objectives state={state} />
        {level !== 'none' && (
          <Panel title={level === 'full' ? 'Advisor' : 'Staff hints'} right={tips.length ? `${tips.length}` : undefined} id="advisor">
            {tips.length === 0 ? (
              <p className="p-3 text-[11px] text-ops-dim">Nothing pressing. Steady as she goes.</p>
            ) : (
              <ul className="max-h-[420px] divide-y divide-ops-line/50 overflow-y-auto">
                {tips.slice(0, 12).map((t) => (
                  <li key={t.id} className="px-3 py-2 text-[11px] leading-snug">
                    <div className={t.tone === 'urgent' ? 'text-ops-red' : t.tone === 'suggest' ? 'text-ops-amber' : 'text-ops-dim'}>
                      {t.tone === 'urgent' ? 'Urgent' : t.tone === 'suggest' ? 'Suggestion' : 'Note'}
                    </div>
                    <div className="text-ops-text">{t.text}</div>
                    {level === 'full' && t.action && (
                      <Btn className="mt-1" kind="primary" onClick={() => act(t.action!)}>
                        {t.actionLabel ?? 'Do it'}
                      </Btn>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        <Panel title="National reserve" right="goal: 6 months of calm draw">
          <ul className="divide-y divide-ops-line/50">
            {activeLines(state).map((id) => {
              const r = state.reserves[id];
              const total = nationalStock(state, id);
              const target = reserveTarget(state, id);
              const cover = coverMonths(state, id);
              return (
                <li key={id} className="px-3 py-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-sans text-[13px] font-semibold text-white">{LINES[id].name}</span>
                    <span>
                      <span className="text-white">{qty(total)}</span>
                      <span className="text-ops-dim"> / {qty(target)}</span>
                    </span>
                  </div>
                  <Bar ratio={total / target} className="my-1" />
                  <div className="flex justify-between text-[10px] text-ops-dim">
                    <span>
                      covers <span className={textToneFor(Math.min(1, cover / 4))}>{cover.toFixed(1)} mo</span> of forecast
                      {r.degraded > 0 && <span className="text-ops-amber"> · {qty(r.degraded)} degraded</span>}
                    </span>
                    {r.unmet > 0 && <span className="text-ops-red">unmet {qty(r.unmet)}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
