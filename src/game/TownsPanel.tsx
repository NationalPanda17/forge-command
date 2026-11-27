// Towns: where your people live, how much room each town has, and what happens when a plant closes.
import { validate, type SimAction } from '../sim/actions';
import { MOOD_WORD, communityTowns, fundCost } from '../sim/communities';
import { DISCONTENT_WORD, discontent, hireFactor } from '../sim/homefront';
import { HOMES_PER_PROJECT, HOUSING_DAYS, employed, hireRoom, housingCost, townOf } from '../sim/towns';
import type { SimState } from '../sim/types';
import { CITIES, SITES, SITE_BY_ID } from '../sim/world';
import { Bar, Btn } from '../ui/kit';
import { money, pct } from '../ui/format';
import { PAY_DEAL, payDealCost, surgeBanned, unionTowns } from '../sim/unions';
import { TEMPERS } from '../sim/cast';
import { dateLabel } from './useSim';

export default function TownsPanel({ state, act, onSite }: { state: SimState; act: (a: SimAction) => void; onSite: (id: string) => void }) {
  const plants = SITES.filter((d) => d.owner === 'state' && state.sites[d.id].processes.length > 0 && state.sites[d.id].status !== 'closed');
  const unionOn = new Set(unionTowns(state));
  const shown = new Set([...CITIES.map((c, i) => (state.towns[i] && employed(state, c.name) > 0 ? i : -1)).filter((i) => i >= 0), ...communityTowns(state), ...unionOn]);
  const towns = [...shown]
    .map((i) => ({ c: CITIES[i], i, t: state.towns[i], work: employed(state, CITIES[i].name) }))
    .sort((a, b) => b.work - a.work);
  return (
    <div className="space-y-4 p-3 text-[11px]">
      <p className="text-ops-dim">
        Every plant draws its people from the nearest town. A town can only supply as many as it has homes for, and fewer if it resents you: build housing where you need to hire. Towns grow with jobs, and shrink when the work goes.
      </p>
      {state.communities.burnBanUntil > state.day && (
        <p className="text-ops-red">A court order bans open burning at the demilitarization site until {dateLabel(state.communities.burnBanUntil)}.</p>
      )}
      {state.communities.permits.length > 0 && (
        <p className="text-ops-amber">
          Waiting on a permit: {state.communities.permits.map((p) => `${p.kind === 'plant' ? SITE_BY_ID[p.target]?.name ?? 'a plant' : 'a rail link'} (${CITIES[p.town].name})`).join(', ')}. The decision is on the Board.
        </p>
      )}
      <section>
        <h3 className="label mb-1">Your towns</h3>
        <p className="mb-2 text-ops-dim">
          Each town's people, its mood toward you and its union move together. A resentful town hardens its union and sends fewer people to your lines; a strong union and a resentful town together are where spies and saboteurs find their way in. Settled claims and community funds calm a town; refusals, strikes, mothballing, deep vetting and a bad audit stir it up.
        </p>
        <ul className="space-y-2">
          {towns.map(({ c, i, t, work }) => {
            const house: SimAction = { type: 'housing', town: i };
            const fund: SimAction = { type: 'communityFund', town: i };
            const mood = state.communities.mood[i];
            const u = unionOn.has(i) ? state.unions.towns[i] : null;
            const d = discontent(state, i);
            const slowed = hireFactor(mood) < 1;
            const room = t ? hireRoom(state, c.name) : 0;
            const leader = state.cast?.leaders[i];
            return (
              <li key={c.name} className="rounded border border-ops-line/60 p-2">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
                  <span className="min-w-0 truncate text-white">{c.name}</span>
                  <span
                    className={d >= 0.55 ? 'text-ops-red' : d >= 0.4 ? 'text-ops-amber' : 'text-ops-green'}
                    title="Discontent, from the union's strength and the town's mood. It raises the odds of spies and ransomware at your plants here, and hardens the union."
                  >
                    {DISCONTENT_WORD(d)} · {Math.round(d * 100)}
                  </span>
                </div>
                {t && (
                  <>
                    <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-[10px]">
                      <span className="text-ops-dim">Work</span>
                      <span className={room < 50 ? 'text-ops-amber' : 'text-ops-dim'}>
                        {Math.round(work).toLocaleString('en-US')} · room {room.toLocaleString('en-US')}
                        {slowed ? ' · mood slows hiring' : ''}
                      </span>
                    </div>
                    <Bar ratio={work / Math.max(1, t.pool)} tone={work / Math.max(1, t.pool) > 0.95 ? 'bg-ops-amber' : 'bg-ops-cyan'} title="Workers against the town's labour pool" />
                  </>
                )}
                <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-[10px]">
                  <span className="text-ops-dim">Mood</span>
                  <span className={mood < 30 ? 'text-ops-red' : mood < 45 ? 'text-ops-amber' : 'text-ops-dim'}>
                    {MOOD_WORD(mood)} · {Math.round(mood)}
                  </span>
                </div>
                <Bar ratio={mood / 100} tone={mood < 30 ? 'bg-ops-red' : mood < 45 ? 'bg-ops-amber' : 'bg-ops-green'} title="The town's mood toward you" />
                {u && (
                  <>
                    <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-[10px]">
                      <span className="text-ops-dim">Union</span>
                      <span className={u.strength >= 50 ? 'text-ops-amber' : 'text-ops-dim'}>
                        {Math.round(u.strength)} · pay {u.wage >= state.priceIndex ? 'keeps up with' : 'trails'} prices
                      </span>
                    </div>
                    <Bar ratio={u.strength / 100} tone={u.strength >= 70 ? 'bg-ops-red' : u.strength >= 50 ? 'bg-ops-amber' : 'bg-ops-cyan'} title="Union strength: at 50 or more it strikes rather than working to rule" />
                    {leader && (
                      <p className="mt-0.5 text-[10px] text-ops-dim">
                        Led by <span className="text-ops-text">{leader.name}</span>, a <span className={leader.temper === 'firebrand' ? 'text-ops-amber' : 'text-ops-text'}>{TEMPERS[leader.temper].name.toLowerCase()}</span>.
                      </p>
                    )}
                  </>
                )}
                <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1">
                  {t && (
                    <Btn why={validate(state, house)} onClick={() => act(house)} title={`${HOMES_PER_PROJECT} homes, about ${Math.round(HOUSING_DAYS / 30)} months; the town warms a little`}>
                      Build housing · {money(housingCost(state))}
                    </Btn>
                  )}
                  <Btn why={validate(state, fund)} onClick={() => act(fund)} title="A library, a clinic, a sports ground: the town warms to you and its union cools. Every six months.">
                    Community fund · {money(fundCost(state))}
                  </Btn>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] text-ops-dim">A national deal gives every munitions worker {pct(PAY_DEAL)} more and cools every union. Once a year.</span>
          <Btn why={validate(state, { type: 'payDeal' })} onClick={() => act({ type: 'payDeal' })}>
            National pay deal · {money(payDealCost(state))}
          </Btn>
        </div>
        {plants.some((d) => surgeBanned(state, d.id)) && (
          <p className="mt-2 text-[10px] text-ops-dim">
            No round-the-clock shifts by agreement: {plants.filter((d) => surgeBanned(state, d.id)).map((d) => `${SITE_BY_ID[d.id].name} until ${dateLabel(state.unions.noSurge[d.id])}`).join(', ')}.
          </p>
        )}
      </section>
      <section>
        <h3 className="label mb-1">Your plants</h3>
        <p className="mb-2 text-ops-dim">Mothballing lays the crew off and saves their wages. The town and the region will not forget it.</p>
        <ul className="space-y-1">
          {plants.map((d) => {
            const site = state.sites[d.id];
            const a: SimAction = site.mothballed ? { type: 'reopen', site: d.id } : { type: 'mothball', site: d.id };
            return (
              <li key={d.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <span className="min-w-0 break-words">
                  <button type="button" className="text-left text-ops-text hover:underline" onClick={() => onSite(d.id)}>
                    {site.plantName ?? SITE_BY_ID[d.id].name}
                  </button>{' '}
                  <span className="text-ops-dim">
                    · {townOf(d.id)} · {site.mothballed ? 'mothballed' : `${Math.round(site.workers)} at work`}
                  </span>
                </span>
                <Btn kind={site.mothballed ? 'primary' : 'warn'} why={validate(state, a)} onClick={() => act(a)}>
                  {site.mothballed ? 'Reopen' : 'Mothball'}
                </Btn>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
