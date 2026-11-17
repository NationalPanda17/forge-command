// The advisor: the next best moves, each with a button that does it or takes you to it.
import { useMemo } from 'react';
import { advise, type Advice, type AdvicePanel } from '../sim/advisor';
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
  if (!items.length) return null;
  const go = (a: Advice) => (a.panel ? onPanel(a.panel) : a.site ? onSite(a.site) : a.material ? onMaterial(a.material) : undefined);
  return (
    <section className="border-b border-ops-line/60 p-3 text-[11px]" aria-label="Advisor">
      <h3 className="label mb-2 text-ops-cyan">Advisor · next best moves</h3>
      <ol className="space-y-1.5">
        {items.map((a) => (
          <li key={a.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded border p-2 ${TONE[a.tone]}`}>
            <span className="min-w-0">
              <span className="text-white">{a.title}</span>
              <span className="block text-[10px] text-ops-dim">{a.why}</span>
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
