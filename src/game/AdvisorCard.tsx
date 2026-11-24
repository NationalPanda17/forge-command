// The advisor: the next best moves, each with a button that does it or takes you to it.
import { useMemo, useState } from 'react';
import { advise, threeMonthPlan, type Advice, type AdvicePanel } from '../sim/advisor';
import { monthLabel2 } from './useSim';
import type { SimAction } from '../sim/actions';
import type { SimState } from '../sim/types';
import type { MaterialId } from '../sim/world';
import { Btn } from '../ui/kit';

const TONE = { bad: 'border-ops-red/50', warn: 'border-ops-amber/50', info: 'border-ops-line/60' } as const;

export default function AdvisorCard({
  state,
  act,
  onPanel,
  onSite,
  onMaterial,
}: {
  state: SimState;
  act: (a: SimAction) => void;
  onPanel: (p: AdvicePanel) => void;
  onSite: (id: string) => void;
  onMaterial: (m: MaterialId) => void;
}) {
  const items = useMemo(() => advise(state), [state]);
  const [planOpen, setPlanOpen] = useState(false);
  const plan = useMemo(() => (planOpen ? threeMonthPlan(state) : []), [state, planOpen]);

  const go = (a: Advice) => (a.panel ? onPanel(a.panel) : a.site ? onSite(a.site) : a.material ? onMaterial(a.material) : undefined);
  return (
    <section className="border-b border-ops-line/60 p-3 text-[11px]" aria-label="Advisor">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="label text-ops-cyan">Advisor · next best moves</h3>
        <Btn pressed={planOpen} onClick={() => setPlanOpen(!planOpen)} title="What is coming over the next three months, and what to do about it">
          Three-month plan
        </Btn>
      </div>
      {planOpen && (
        <div className="mb-3 space-y-2 rounded border border-ops-cyan/40 p-2">
          {[0, 1, 2].map((m) => {
            const rows = plan.filter((p) => p.month === m);
            return (
              <div key={m}>
                <div className="label mb-0.5">{monthLabel2(state.month.month + m)}</div>
                {rows.length ? (
                  <ul className="space-y-0.5">
                    {rows.map((p, i) => (
                      <li key={i} className={p.tone === 'bad' ? 'text-ops-red' : p.tone === 'warn' ? 'text-ops-amber' : p.tone === 'good' ? 'text-ops-green' : 'text-ops-text'}>
                        {p.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-ops-dim">Nothing due.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!items.length && <p className="text-ops-dim">Nothing urgent. The three-month plan shows what is coming.</p>}
      <ol className="space-y-1.5">
        {items.map((a) => (
          <li key={a.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded border p-2 ${TONE[a.tone]}`}>
            <span className="min-w-0">
              <span className="text-white">{a.title}</span>
              <span className="block text-[10px] text-ops-dim">{a.why}</span>
              {a.tradeoff && <span className="block text-[10px] text-ops-amber/90">{a.tradeoff}</span>}
            </span>
            <span className="flex shrink-0 flex-col gap-1">
              {a.action && (
                <Btn kind="primary" onClick={() => act(a.action!)}>
                  Do it
                </Btn>
              )}
              {(a.panel || a.site || a.material) && <Btn onClick={() => go(a)}>Show</Btn>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
