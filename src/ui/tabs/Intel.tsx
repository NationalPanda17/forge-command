import {
  DIFFICULTY,
  LINES,
  activeLines,
  THREATS,
  THREAT_IDS,
  coverMonths,
  threatPlural,
  effectiveCapacity,
  reserveTotal,
  type Action,
  type GameState,
} from '../../engine';
import { Btn, COLORS, LineChart, Panel } from '../kit';
import { money, pct, qty, shortMonth, textToneFor } from '../format';

export default function Intel({ state, act }: { state: GameState; act: (a: Action) => void }) {
  const c = state.crisis;
  const rules = DIFFICULTY[state.difficulty];
  const months = state.history.map((h) => shortMonth(h.month));
  const series = (t: (typeof THREAT_IDS)[number], color: string) => ({ label: THREATS[t].name.replace('Short-range ', '').replace('One-way attack ', ''), values: state.history.map((h) => h.threats[t].arrived), color });
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-3">
        <Panel title="Situation">
          <div className="p-3">
            {c ? (
              <div className={c.phase === 'active' ? 'text-ops-red' : 'text-ops-amber'}>
                <div className="font-sans text-[18px] font-semibold">{c.name}</div>
                <p className="text-[12px] text-ops-text">{c.blurb}</p>
                <p className="mt-1 text-[11px]">
                  {c.phase === 'warning'
                    ? `Warning: expected to begin in about ${c.monthsLeft} month${c.monthsLeft === 1 ? '' : 's'}.`
                    : `Active. Intensity ${c.intensity.toFixed(2)}. Expected to last about ${c.monthsLeft} more month${c.monthsLeft === 1 ? '' : 's'}.`}
                  {c.family === 'land'
                    ? ' Land fires demand is way up.'
                    : ` Heavier: ${Object.entries(c.mix)
                        .map(([t, m]) => `${threatPlural(t as keyof typeof THREATS)} ×${m}`)
                        .join(', ')}.`}
                </p>
              </div>
            ) : (
              <p className="text-[12px] text-ops-dim">No crisis. Background activity only: the usual drones, rockets and the odd missile.</p>
            )}
            {rules.adaptive && (
              <p className="mt-2 text-[11px] text-ops-violet">
                {state.forecast.focus
                  ? `Intel believes the opponent is leaning on ${threatPlural(state.forecast.focus)}, aimed at your thinnest stocks.`
                  : 'Intel cannot read the opponent’s intentions this month.'}{' '}
                Reliability {pct(state.forecast.confidence)}.
              </p>
            )}
          </div>
        </Panel>

        <Panel title="Three-month forecast" right={`intel reliability ${pct(state.forecast.confidence)}`}>
          <div className="overflow-x-auto">
            <table className="table-ops w-full min-w-[620px]">
              <thead>
                <tr>
                  <th>Line</th>
                  <th className="text-right">Next</th>
                  <th className="text-right">+2</th>
                  <th className="text-right">+3</th>
                  <th className="text-right">Line can build</th>
                  <th className="text-right">Reserve</th>
                  <th className="text-right">Cover</th>
                </tr>
              </thead>
              <tbody>
                {activeLines(state).map((id) => {
                  const f = state.forecast.draw[id];
                  const cap = effectiveCapacity(state.lines[id]);
                  const cover = coverMonths(state, id);
                  return (
                    <tr key={id}>
                      <td className="text-white">{LINES[id].name}</td>
                      {f.map((v, i) => (
                        <td key={i} className={`text-right ${v > cap ? 'text-ops-amber' : ''}`}>
                          {qty(v)}
                        </td>
                      ))}
                      <td className="text-right text-ops-dim">{qty(cap)}</td>
                      <td className="text-right">{qty(reserveTotal(state.reserves[id]))}</td>
                      <td className={`text-right ${textToneFor(Math.min(1, cover / 4))}`}>{cover.toFixed(1)} mo</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-3 py-2 text-[10px] text-ops-dim">Amber: forecast draw is above what the line can build at a normal pace.</p>
        </Panel>

        <Panel title="Threat arrivals">
          <div className="p-3">
            <LineChart
              min={0}
              xLabels={months}
              series={[series('drone', COLORS.cyan), series('rocket', COLORS.dim), series('cruise', COLORS.amber), series('ballistic', COLORS.red), series('aircraft', COLORS.violet)]}
            />
          </div>
        </Panel>
      </div>

      <div className="space-y-3">
        <Panel title="Doctrine">
          <div className="space-y-2 p-3 text-[11px]">
            <p className="text-ops-text">
              <span className="text-white">Conserve</span> keeps PAC-3 and SM-6 off drones and rockets, even when the cheaper interceptors run dry. More threats get
              through, but you stop firing $4M missiles at $35K drones.
            </p>
            <div className="flex gap-2">
              <Btn pressed={!state.doctrine.conserve} onClick={() => act({ type: 'setDoctrine', conserve: false })}>
                Engage everything
              </Btn>
              <Btn pressed={state.doctrine.conserve} onClick={() => act({ type: 'setDoctrine', conserve: true })}>
                Conserve
              </Btn>
            </div>
          </div>
        </Panel>
        <Panel title="Threat classes">
          <ul className="divide-y divide-ops-line/50">
            {THREAT_IDS.map((t) => {
              const th = THREATS[t];
              return (
                <li key={t} className="px-3 py-2 text-[11px]">
                  <div className="flex items-baseline justify-between">
                    <span className="font-sans text-[13px] font-semibold text-white">{th.name}</span>
                    <span className="text-ops-dim">≈ {money(th.estCost)}</span>
                  </div>
                  <p className="text-[10px] text-ops-dim">{th.blurb}</p>
                  <p className="text-[10px]">
                    {th.assign.map((a, i) => (
                      <span key={a.line} className={a.weight > 0 ? 'text-ops-text' : 'text-ops-dim'}>
                        {i > 0 && ' › '}
                        {LINES[a.line].name}
                        {a.weight > 0 ? ` ${Math.round(a.weight * 100)}%` : ''}
                      </span>
                    ))}
                  </p>
                  <p className="text-[10px] text-ops-dim">
                    {th.shots} shots per threat · about {Math.round(th.calm)} a month in calm times
                  </p>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
