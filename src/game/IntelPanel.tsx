// Intel: what the rival has fielded, what is coming, and how to counter it.
import { validate, type SimAction } from '../sim/actions';
import { THREATS, THREAT_IDS } from '../sim/fight';
import { COUNTER_NAMES, DEVELOPMENTS, RIVAL_NAME, rivalArrivals, rivalShots } from '../sim/rival';
import { RESEARCH } from '../sim/strategy';
import type { SimState } from '../sim/types';
import { Btn } from '../ui/kit';
import { Explain } from '../ui/Explain';
import { money } from '../ui/format';
import { threatWhy } from './explain';
import { dateLabel } from './useSim';

export default function IntelPanel({ state, act }: { state: SimState; act: (a: SimAction) => void }) {
  const known = state.rival.known;
  const left = state.rival.order.length - known.length;
  return (
    <div className="space-y-4 p-3 text-[11px]">
      <p className="text-ops-text">
        {RIVAL_NAME[0].toUpperCase() + RIVAL_NAME.slice(1)} keeps building. Each new weapon changes which rounds you need and how many. Intel warns about three months ahead, and every one has a counter you can research.
      </p>

      <section>
        <h3 className="label mb-1">Known developments</h3>
        {known.length === 0 ? (
          <p className="text-ops-dim">Nothing new yet. Intel expects the first report {state.rival.next > state.day ? `around ${dateLabel(state.rival.next)}` : 'any day'}.</p>
        ) : (
          <ol className="space-y-2">
            {[...known].reverse().map((k) => {
              const d = DEVELOPMENTS[k.id];
              const fielded = k.fielded <= state.day;
              const done = state.strategy.research.done.includes(d.counter);
              const active = state.strategy.research.active?.id === d.counter;
              const a: SimAction = { type: 'research', research: d.counter };
              return (
                <li key={k.id} className={`rounded border p-2 ${fielded && !done ? 'border-ops-red/50' : 'border-ops-line/60'}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-sans text-[14px] font-semibold text-white">{d.name}</span>
                    <span className={fielded ? 'text-ops-red' : 'text-ops-amber'}>{fielded ? `in the field since ${dateLabel(k.fielded)}` : `expected ${dateLabel(k.fielded)}`}</span>
                  </div>
                  <p className="text-ops-dim">{d.intel}</p>
                  <p className="text-ops-text">{d.effect}</p>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <span className={done ? 'text-ops-green' : 'text-ops-text'}>
                      Counter: {COUNTER_NAMES[d.counter]}
                      {done ? ' · done' : active ? ` · in progress, ${state.strategy.research.active!.days} days left` : ''}
                    </span>
                    {!done && !active && (
                      <Btn kind="primary" why={validate(state, a)} onClick={() => act(a)}>
                        Research · {money(RESEARCH[d.counter].cost)}
                      </Btn>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {left > 0 && <p className="mt-2 text-ops-dim">Intel believes {left} more programme{left > 1 ? 's are' : ' is'} under way.</p>}
      </section>

      <section>
        <h3 className="label mb-1">Threats now, against the start of your term</h3>
        <ul className="space-y-1">
          {THREAT_IDS.map((t) => {
            const load = rivalArrivals(state, t) * rivalShots(state, t);
            return (
              <li key={t} className="flex justify-between gap-2">
                <span className="text-ops-text">{THREATS[t].name}</span>
                <Explain title={THREATS[t].name} lines={() => threatWhy(state, t)}>
                  <span className={load > 1.05 ? 'text-ops-red' : 'text-ops-dim'}>×{load.toFixed(2)} interceptors needed</span>
                </Explain>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
