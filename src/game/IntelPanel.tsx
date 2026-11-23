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
import { CLEARANCE_NAME, activity, security, targets } from '../sim/security';
import { SITE_BY_ID } from '../sim/world';
import { dateLabel } from './useSim';
import { BACKUPS_COST, CYBER_AREAS, CYBER_AREA_IDS, CYBER_LEVEL, DRILLS_COST, MAX_CYBER, attackOdds, cyberCost, railFactor, upkeep } from '../sim/cyber';
import { pct } from '../ui/format';

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
        <h3 className="label mb-1">Counter-intelligence</h3>
        <p className="mb-2 text-ops-dim">
          {RIVAL_NAME[0].toUpperCase() + RIVAL_NAME.slice(1)}'s agents target your plants, more often as its programmes grow. Vet your staff to stop sabotage, stolen designs and leaks. {state.history.slice(-12).reduce((a, h) => a + (h.incidents ?? 0), 0)} incidents in the last year.
        </p>
        <ul className="space-y-1">
          {targets(state).map((id) => {
            const sec = security(state, id);
            return (
              <li key={id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <span className="min-w-0 truncate text-ops-text">
                  {state.sites[id].plantName ?? SITE_BY_ID[id].name} <span className="text-ops-dim">· {CLEARANCE_NAME[state.sites[id].clearance ?? 0]}</span>
                </span>
                <span className={sec < 0.35 ? 'text-ops-red' : sec < 0.6 ? 'text-ops-amber' : 'text-ops-green'}>
                  {Math.round(sec * 100)}% secure · {(activity(state) * (1 - sec) * 100).toFixed(1)}% a month
                </span>
              </li>
            );
          })}
        </ul>
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

      <section>
        <h3 className="label mb-1">Cyber defence</h3>
        <p className="mb-2 text-ops-dim">
          The rival's hackers go after three systems, more often as its weapons programmes grow. Each level of defence makes an attack a quarter less likely. Backups bring a system back far sooner; drills keep crews and dispatchers working without computers.
        </p>
        {state.cyber.railDays > 0 && (
          <p className="mb-2 text-ops-red">
            The rail booking system is down: trains run at {pct(railFactor(state))} of capacity for about {Math.max(1, Math.round(state.cyber.railDays / 7))} more weeks.
          </p>
        )}
        <ul className="space-y-2">
          {CYBER_AREA_IDS.map((area) => {
            const a: SimAction = { type: 'cyberDefence', area };
            const lvl = state.cyber.levels[area];
            return (
              <li key={area} className="rounded border border-ops-line/60 p-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-white">{CYBER_AREAS[area].name}</span>
                  <span className={lvl >= 2 ? 'text-ops-green' : lvl === 0 ? 'text-ops-amber' : 'text-ops-text'}>
                    {CYBER_LEVEL[lvl]} · {(attackOdds(state, area) * 100).toFixed(1)}% a month
                  </span>
                </div>
                <p className="text-[10px] text-ops-dim">{CYBER_AREAS[area].blurb}</p>
                {lvl < MAX_CYBER && (
                  <div className="mt-1 flex justify-end">
                    <Btn why={validate(state, a)} onClick={() => act(a)}>
                      Raise to {CYBER_LEVEL[lvl + 1].toLowerCase()} · {money(cyberCost(state, area))}
                    </Btn>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <Btn why={validate(state, { type: 'cyberBackups' })} onClick={() => act({ type: 'cyberBackups' })} pressed={state.cyber.backups}>
            {state.cyber.backups ? 'Backups in place' : `Offline backups · ${money(BACKUPS_COST(state))}`}
          </Btn>
          <Btn why={validate(state, { type: 'cyberDrills' })} onClick={() => act({ type: 'cyberDrills' })} pressed={state.cyber.drills}>
            {state.cyber.drills ? 'Crews drill for it' : `Manual fallback drills · ${money(DRILLS_COST(state))}`}
          </Btn>
          {upkeep(state) > 0 && <span className="text-[10px] text-ops-dim">Upkeep {money(upkeep(state))} a month</span>}
        </div>
      </section>
    </div>
  );
}
