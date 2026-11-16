import {
  COMPONENTS,
  LINES,
  LINE_IDS,
  MAX_EXPANSIONS,
  effectiveCapacity,
  expandCost,
  expansions,
  installedCapacity,
  lineOpCost,
  plannedOutput,
  validateAction,
  type Action,
  type GameState,
  type LineId,
  type Priority,
  type RunMode,
} from '../engine';
import { money, qty, toneFor } from './format';

const RUNS: RunMode[] = ['idle', 'normal', 'surge'];

function limitLabel(state: GameState, id: LineId): { text: string; tone: string } {
  const l = state.lines[id].lastLimit;
  if (l === null) return { text: '—', tone: 'text-ops-dim' };
  if (l === 'idle') return { text: 'idle', tone: 'text-ops-dim' };
  if (l === 'capacity') return { text: 'at capacity', tone: 'text-ops-green' };
  return { text: `short: ${COMPONENTS[l].name.toLowerCase()}`, tone: 'text-ops-red' };
}

export default function LinesPanel({ state, act }: { state: GameState; act: (a: Action) => void }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <span>Production lines</span>
        <span className="label normal-case tracking-normal">units per month</span>
      </div>
      <div className="overflow-x-auto">
        <table className="table-ops w-full min-w-[860px]">
          <thead>
            <tr>
              <th>Line</th>
              <th>Rate</th>
              <th>Ramp-up</th>
              <th>Wear</th>
              <th>Shifts</th>
              <th>Priority</th>
              <th>Last month</th>
              <th>Capacity</th>
            </tr>
          </thead>
          <tbody>
            {LINE_IDS.map((id) => {
              const def = LINES[id];
              const line = state.lines[id];
              const expand: Action = { type: 'expandLine', line: id };
              const why = validateAction(state, expand);
              const limit = limitLabel(state, id);
              return (
                <tr key={id}>
                  <td>
                    <div className="font-sans text-[14px] font-semibold text-white">{def.name}</div>
                    <div className="text-[10px] text-ops-dim">
                      {def.maker} · {def.plant}
                    </div>
                    <div className="text-[10px] text-ops-dim" title="Public reference rate; the game runs about a fifth of it.">
                      ref. {def.publicRate}
                    </div>
                  </td>
                  <td>
                    <div className="text-white">{qty(plannedOutput(line))}</div>
                    <div className="text-[10px] text-ops-dim">
                      of {qty(installedCapacity(line))} installed · {money(lineOpCost(state, id))}/mo
                    </div>
                  </td>
                  <td>
                    <div className="flex w-24 gap-0.5" title={`${qty(effectiveCapacity(line))} effective of ${qty(installedCapacity(line))}`}>
                      {line.tranches.map((t, i) => (
                        <div key={i} className="bar flex-1" style={{ flexGrow: t.capacity }}>
                          <span className={t.maturity >= 1 ? 'bg-ops-green' : 'bg-ops-cyan'} style={{ width: `${t.maturity * 100}%` }} />
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="bar w-16">
                      <span className={toneFor(1 - line.wear / 100)} style={{ width: `${line.wear}%` }} />
                    </div>
                    <div className="text-[10px] text-ops-dim">{Math.round(line.wear)}</div>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      {RUNS.map((r) => (
                        <button
                          key={r}
                          className={`btn px-1.5 ${line.run === r ? (r === 'surge' ? 'border-ops-amber bg-ops-amber/20 text-white' : 'btn-active') : ''}`}
                          onClick={() => act({ type: 'setRun', line: id, run: r })}
                          aria-pressed={line.run === r}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td>
                    <select
                      className="input py-0.5"
                      value={line.priority}
                      onChange={(e) => act({ type: 'setPriority', line: id, priority: e.target.value as Priority })}
                      aria-label={`${def.name} priority for scarce parts`}
                    >
                      <option value="high">high</option>
                      <option value="normal">normal</option>
                      <option value="low">low</option>
                    </select>
                  </td>
                  <td>
                    <div className="text-white">
                      {qty(line.lastOutput)}
                      {line.lastQuarantined > 0 && <span className="ml-1 text-ops-red">−{qty(line.lastQuarantined)} QA</span>}
                    </div>
                    <div className={`text-[10px] ${limit.tone}`}>{limit.text}</div>
                  </td>
                  <td>
                    <button className="btn" disabled={!!why} title={why ?? 'New floor space starts at about 30% and ramps up'} onClick={() => act(expand)}>
                      +25% · {money(expandCost(id))}
                    </button>
                    <div className="mt-0.5 text-[10px] text-ops-dim">
                      {expansions(line)}/{MAX_EXPANSIONS} expansions
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
