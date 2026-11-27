// The advisor: the next best moves, each with a button that does it or takes you to it.
import { useEffect, useMemo, useRef, useState } from 'react';
import { SAFE_RESERVE, advise, diagnose, safeAdvice, threeMonthPlan, type Advice, type AdvicePanel } from '../sim/advisor';
import { MATERIALS } from '../sim/world';
import { money, pct } from '../ui/format';
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
  hideDecisions = false,
}: {
  /** Leave out the "answer the decisions" move where the screen has its own button for them. */
  hideDecisions?: boolean;
  state: SimState;
  act: (a: SimAction) => void;
  onPanel: (p: AdvicePanel) => void;
  onSite: (id: string) => void;
  onMaterial: (m: MaterialId) => void;
}) {
  // Advice weighs every suggestion by trying it on a copy of the game, so it is worked out at most every 1.5 seconds
  // while the clock runs, and at once when the game stands still.
  const [snap, setSnap] = useState(state);
  const last = useRef(0);
  useEffect(() => {
    const wait = 1500 - (Date.now() - last.current);
    const take = () => {
      last.current = Date.now();
      setSnap(state);
    };
    if (wait <= 0) take();
    else {
      const t = setTimeout(take, wait);
      return () => clearTimeout(t);
    }
  }, [state]);
  const items = useMemo(() => advise(snap), [snap]);
  // The count and the tooltip use the snapshot; a click works out the steps afresh from the game as it is now.
  const safe = useMemo(() => safeAdvice(snap), [snap]);
  const [planOpen, setPlanOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [allItems, setAllItems] = useState(false);
  const plan = useMemo(() => (planOpen ? threeMonthPlan(snap) : []), [snap, planOpen]);
  const diagnosis = useMemo(() => (whyOpen ? diagnose(snap) : []), [snap, whyOpen]);

  const go = (a: Advice) => (a.panel ? onPanel(a.panel) : a.site ? onSite(a.site) : a.material ? onMaterial(a.material) : undefined);
  return (
    <section className="border-b border-ops-line/60 p-3 text-[11px]" aria-label="Advisor">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="label !text-ops-amber">Advisor · next best moves</h3>
        <span className="flex flex-wrap gap-1">
          <Btn
            kind="primary"
            why={safe.length ? null : 'Nothing to take just now.'}
            onClick={() => safeAdvice(state).forEach((a) => act(a))}
            title={`What your chief of staff would do now: answer the Board and any hearing, staff and supply the plants, start research and set the lines, keeping the treasury above ${money(Math.max(state.automation?.reserve ?? 0, SAFE_RESERVE))} (${safe.length} step${safe.length === 1 ? '' : 's'})`}
          >
            Take the safe advice
          </Btn>
          <Btn pressed={whyOpen} onClick={() => setWhyOpen(!whyOpen)} title="Why each round that is short, or soon will be, is short">
            Why short?
          </Btn>
          <Btn pressed={planOpen} onClick={() => setPlanOpen(!planOpen)} title="What is coming over the next three months, and what to do about it">
            Three-month plan
          </Btn>
        </span>
      </div>
      {whyOpen && (
        <div className="mb-3 space-y-1 rounded border border-ops-amber/40 p-2">
          {diagnosis.length ? (
            diagnosis.map((d) => (
              <div key={d.line}>
                <span className={d.level < 0.5 ? 'text-ops-red' : 'text-ops-amber'}>
                  {MATERIALS[d.line].name} · {pct(d.level)} of target{d.months !== null ? ` · below half in ${d.months} month${d.months > 1 ? 's' : ''}` : ''}
                </span>
                <span className="block text-ops-text">{d.cause}</span>
              </div>
            ))
          ) : (
            <p className="text-ops-dim">Every round is at 80% of target or better, with no shortfall forecast for six months.</p>
          )}
        </div>
      )}
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
      {/* The first move is the featured next step; the rest are a short list, with more on request (19.3). Home already
          has a button for the Board's decisions, so the advice does not ask a second time. */}
      {(() => {
        const list = hideDecisions ? items.filter((x) => x.id !== 'decisions') : items;
        const [first, ...rest] = list;
        const shown = allItems ? rest : rest.slice(0, 3);
        return (
          <>
            {first && (
              <div className={`mb-1.5 rounded border p-3 ${TONE[first.tone]}`} style={{ boxShadow: 'inset 3px 0 0 rgb(var(--ops-amber) / 0.85)' }}>
                <div className="label mb-1 !text-ops-amber">Next step</div>
                <div className="text-[13px] font-semibold text-white">{first.title}</div>
                <div className="mt-0.5 text-ops-dim">{first.why}</div>
                {first.tradeoff && <div className="mt-0.5 text-ops-amber/90">{first.tradeoff}</div>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {first.action && (
                    <Btn kind="primary" onClick={() => act(first.action!)}>
                      Do it
                    </Btn>
                  )}
                  {(first.panel || first.site || first.material) && (
                    <button type="button" className="text-[11px] text-ops-cyan hover:underline" onClick={() => go(first)}>
                      Show ›
                    </button>
                  )}
                </div>
              </div>
            )}
            <ol className="space-y-1.5">
              {shown.map((a) => (
                <li key={a.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded border p-2 ${TONE[a.tone]}`}>
                  <span className="min-w-0">
                    <span className="text-white">{a.title}</span>
                    <span className="block text-[10px] text-ops-dim">{a.why}</span>
                    {a.tradeoff && <span className="block text-[10px] text-ops-amber/90">{a.tradeoff}</span>}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {a.action && (
                      <Btn kind="primary" onClick={() => act(a.action!)}>
                        Do it
                      </Btn>
                    )}
                    {(a.panel || a.site || a.material) && (
                      <button type="button" className="text-[11px] text-ops-cyan hover:underline" onClick={() => go(a)}>
                        Show ›
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ol>
            {rest.length > 3 && (
              <button type="button" className="mt-1 text-[11px] text-ops-cyan hover:underline" onClick={() => setAllItems(!allItems)}>
                {allItems ? 'Fewer suggestions' : `${rest.length - 3} more suggestion${rest.length - 3 > 1 ? 's' : ''}`}
              </button>
            )}
          </>
        );
      })()}
    </section>
  );
}
