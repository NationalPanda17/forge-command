import type { Action, GameState } from '../engine';
import { Panel } from './kit';

export default function DecisionCards({ state, act }: { state: GameState; act: (a: Action) => void }) {
  return (
    <Panel title="Decisions" right="unanswered cards take their default when the month ends" className="border-ops-amber/50" id="decisions">
      <div className="grid gap-3 p-3 md:grid-cols-2">
        {state.decisions.map((d) => (
          <article key={d.id} className="rounded border border-ops-amber/40 bg-ops-amber/5 p-3">
            <h3 className="font-sans text-[15px] font-semibold text-white">{d.title}</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-ops-text">{d.body}</p>
            <div className="mt-2 space-y-1.5">
              {d.options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="btn w-full flex-col items-start gap-0 py-1.5 text-left normal-case tracking-normal"
                  onClick={() => act({ type: 'resolveDecision', decision: d.id, option: o.id })}
                >
                  <span className="text-[12px] text-white">
                    {o.label}
                    {o.id === d.fallback && <span className="ml-2 text-[10px] text-ops-dim">(default)</span>}
                  </span>
                  <span className="text-[10px] text-ops-dim">{o.detail}</span>
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}
