// The production flow of one line: stages, their load, and the units waiting between them.
import { Fragment } from 'react';
import { COMPONENTS, DEBOTTLENECK_MONTHS, MAX_DEBOTTLENECK, STAGES, debottleneckCost, stageYield, validateAction, type Action, type GameState, type LineId } from '../engine';
import { money, qty } from './format';

const LIMIT_TEXT = {
  capacity: { text: 'at full stretch', tone: 'text-ops-amber' },
  starved: { text: 'waiting for work', tone: 'text-ops-dim' },
  blocked: { text: 'buffer full', tone: 'text-ops-amber' },
  parts: { text: 'short of parts', tone: 'text-ops-red' },
  tests: { text: 'out of test-cell hours', tone: 'text-ops-red' },
} as const;

export default function Flow({ state, id, act }: { state: GameState; id: LineId; act: (a: Action) => void }) {
  const line = state.lines[id];
  const stages = STAGES[id];
  const ran = line.stages.some((s) => s.cap > 0);
  // The bottleneck: of the stages running flat out, the one with the least capacity.
  let neck = -1;
  if (ran) {
    let smallest = Infinity;
    line.stages.forEach((s, i) => {
      if (s.cap > 0 && s.throughput / s.cap > 0.97 && s.cap < smallest) {
        smallest = s.cap;
        neck = i;
      }
    });
  }
  return (
    <div className="mt-3">
      <div className="label mb-1">Production flow</div>
      <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
        {stages.map((st, i) => {
          const last = line.stages[i];
          const util = last && last.cap > 0 ? last.throughput / last.cap : 0;
          const lim = last?.limit ? LIMIT_TEXT[last.limit as keyof typeof LIMIT_TEXT] : null;
          const level = line.debottleneck[i] ?? 0;
          const widening = line.debottlenecking?.stage === i;
          const action: Action = { type: 'debottleneck', line: id, stage: i };
          const why = validateAction(state, action);
          return (
            <Fragment key={st.id}>
              {i > 0 && (
                <div className="flex min-w-[46px] flex-col items-center justify-center text-[10px] text-ops-dim" title="Units waiting between stages">
                  <span aria-hidden="true">→</span>
                  <span className="text-ops-text">{qty(line.wip[i - 1] ?? 0)}</span>
                  <span>waiting</span>
                </div>
              )}
              <div className={`min-w-[132px] flex-1 rounded border p-2 text-[10px] ${i === neck ? 'border-ops-amber/70 bg-ops-amber/5' : 'border-ops-line/60'}`}>
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-[11px] text-white">{st.name}</span>
                  {i === neck && <span className="text-ops-amber" title="The stage running closest to its limit">bottleneck</span>}
                </div>
                <div className="mt-0.5 text-ops-text">
                  {qty(last?.throughput ?? 0)} <span className="text-ops-dim">/ {qty(last?.cap ?? 0)}</span>
                </div>
                <div className="bar my-1">
                  <span className={util > 0.97 ? 'bg-ops-amber' : 'bg-ops-cyan'} style={{ width: `${Math.min(100, util * 100)}%` }} />
                </div>
                <div className={lim?.tone ?? 'text-ops-dim'}>{ran ? (lim?.text ?? '—') : 'not run yet'}</div>
                <div className="text-ops-dim">
                  yield {(stageYield(state, id, i) * 100).toFixed(1)}%
                  {st.comps.length > 0 && ` · uses ${st.comps.filter((c) => c in COMPONENTS).map((c) => COMPONENTS[c].name.replace('Gallium & germanium', 'Ga/Ge').toLowerCase()).join(', ')}`}
                  {st.testHours ? ` · ${st.testHours} test-h each` : ''}
                </div>
                <button
                  type="button"
                  className="mt-1 text-ops-cyan hover:underline disabled:cursor-not-allowed disabled:text-ops-dim disabled:no-underline"
                  disabled={!!why}
                  title={why ?? `Adds 20% capacity to this stage only. Takes ${DEBOTTLENECK_MONTHS} months.`}
                  onClick={() => act(action)}
                >
                  {widening ? `widening · ${line.debottlenecking!.monthsLeft} mo` : level >= MAX_DEBOTTLENECK ? `widened ${level}/${MAX_DEBOTTLENECK}` : `widen ${level}/${MAX_DEBOTTLENECK} · ${money(debottleneckCost(id))}`}
                </button>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
