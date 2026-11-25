// Your plant managers: who runs each plant, the trait they bring, how senior and how loyal they are; promote them, or
// replace them with someone from the list of candidates.
import { useState } from 'react';
import { validate, type SimAction } from '../sim/actions';
import { MAX_LEVEL, TRAITS, managedPlants, promoteCost } from '../sim/cast';
import type { SimState } from '../sim/types';
import { tr } from '../sim/worldgen';
import { Btn } from '../ui/kit';
import { money } from '../ui/format';
import { dateLabel } from './useSim';

export default function ManagersSection({ state, act, onSite }: { state: SimState; act: (a: SimAction) => void; onSite?: (id: string) => void }) {
  const [replacing, setReplacing] = useState<string | null>(null);
  const c = state.cast;
  const plants = managedPlants(state).filter((d) => c.managers[d.id]);
  return (
    <section>
      <h3 className="label mb-1">Plant managers</h3>
      <p className="mb-2 text-ops-dim">
        Each of your plants is run by a manager whose trait shapes it. Promotion strengthens the trait and wins loyalty. Restless, experienced managers get offers from private firms. A new list of candidates comes every quarter.
      </p>
      <ul className="space-y-1.5">
        {plants.map((d) => {
          const m = c.managers[d.id];
          const up: SimAction = { type: 'promoteManager', site: d.id };
          return (
            <li key={d.id} className="rounded border border-ops-line/60 p-2">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <span className="min-w-0">
                  <button type="button" className="block max-w-full truncate text-left text-white hover:text-ops-cyan" onClick={() => onSite?.(d.id)}>
                    {tr(state.sites[d.id].plantName ?? d.name)}
                  </button>
                  <span className="block text-ops-text">
                    {m.name} · <span className="text-ops-cyan">{TRAITS[m.trait].name}</span> · level {m.level}
                  </span>
                  <span className="block text-[10px] text-ops-dim">{TRAITS[m.trait].blurb}</span>
                </span>
                <span className={`whitespace-nowrap text-right ${m.loyalty < 45 ? 'text-ops-red' : m.loyalty < 60 ? 'text-ops-amber' : 'text-ops-green'}`}>loyalty {Math.round(m.loyalty)}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-1">
                <span className="text-[10px] text-ops-dim">Since {dateLabel(m.since)}</span>
                <span className="flex flex-wrap gap-1">
                  {m.level < MAX_LEVEL && (
                    <Btn why={validate(state, up)} onClick={() => act(up)}>
                      Promote · {money(promoteCost(state, m))}
                    </Btn>
                  )}
                  <Btn pressed={replacing === d.id} onClick={() => setReplacing(replacing === d.id ? null : d.id)} why={c.pool.length ? null : 'No candidates until next quarter.'}>
                    Replace
                  </Btn>
                </span>
              </div>
              {replacing === d.id && (
                <ul className="mt-1 space-y-1 border-t border-ops-line/60 pt-1">
                  {c.pool.map((p) => (
                    <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                      <span className="min-w-0">
                        <span className="text-ops-text">
                          {p.name} · <span className="text-ops-cyan">{TRAITS[p.trait].name}</span> · level {p.level}
                        </span>
                        <span className="block text-[10px] text-ops-dim">{TRAITS[p.trait].blurb}</span>
                      </span>
                      <Btn
                        why={validate(state, { type: 'appointManager', site: d.id, candidate: p.id })}
                        onClick={() => {
                          act({ type: 'appointManager', site: d.id, candidate: p.id });
                          setReplacing(null);
                        }}
                      >
                        Appoint
                      </Btn>
                    </li>
                  ))}
                  <li className="text-[10px] text-ops-dim">A change at the top unsettles the floor: morale dips, more so if a popular manager goes.</li>
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
