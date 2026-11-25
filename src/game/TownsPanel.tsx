// Towns: where your people live, how much room each town has, and what happens when a plant closes.
import { validate, type SimAction } from '../sim/actions';
import { MOOD_WORD, communityTowns, fundCost, openDayCost } from '../sim/communities';
import { HOMES_PER_PROJECT, HOUSING_DAYS, employed, housingCost, townOf } from '../sim/towns';
import type { SimState } from '../sim/types';
import { CITIES, SITES, SITE_BY_ID } from '../sim/world';
import { Bar, Btn } from '../ui/kit';
import { money, pct } from '../ui/format';
import { PAY_DEAL, payDealCost, surgeBanned, unionTowns } from '../sim/unions';
import { TEMPERS } from '../sim/cast';
import { dateLabel } from './useSim';

export default function TownsPanel({ state, act, onSite }: { state: SimState; act: (a: SimAction) => void; onSite: (id: string) => void }) {
  const plants = SITES.filter((d) => d.owner === 'state' && state.sites[d.id].processes.length > 0 && state.sites[d.id].status !== 'closed');
  const towns = CITIES.map((c, i) => ({ c, i, t: state.towns[i], work: employed(state, c.name) }))
    .filter((x) => x.t && x.work > 0)
    .sort((a, b) => b.work - a.work);
  return (
    <div className="space-y-4 p-3 text-[11px]">
      <p className="text-ops-dim">
        Every plant draws its people from the nearest town. A town can only supply as many as it has homes for: build housing where you need to hire. Towns grow with jobs, and shrink when the work goes.
      </p>
      <section>
        <h3 className="label mb-1">Towns with munitions jobs</h3>
        <ul className="space-y-2">
          {towns.map(({ c, i, t, work }) => {
            const a: SimAction = { type: 'housing', town: i };
            const room = Math.max(0, Math.floor(t.pool - work));
            return (
              <li key={c.name} className="rounded border border-ops-line/60 p-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-white">{c.name}</span>
                  <span className={room < 50 ? 'text-ops-amber' : 'text-ops-dim'}>
                    {Math.round(work).toLocaleString('en-US')} at work · room for {room.toLocaleString('en-US')} more
                  </span>
                </div>
                <Bar ratio={work / Math.max(1, t.pool)} tone={work / Math.max(1, t.pool) > 0.95 ? 'bg-ops-amber' : 'bg-ops-cyan'} title="Workers against the town's labour pool" />
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[10px] text-ops-dim">
                  <span>
                    {Math.round(t.housing).toLocaleString('en-US')} homes
                    {t.building.length > 0 && ` · ${t.building.reduce((x, b) => x + b.homes, 0)} being built`}
                    {t.slump >= 3 && <span className="text-ops-amber"> · losing people</span>}
                  </span>
                  <Btn why={validate(state, a)} onClick={() => act(a)} title={`${HOMES_PER_PROJECT} homes, about ${Math.round(HOUSING_DAYS / 30)} months`}>
                    Build housing · {money(housingCost(state))}
                  </Btn>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <section>
        <h3 className="label mb-1">Communities</h3>
        <p className="mb-2 text-ops-dim">
          Every town has a mood toward you. Jobs and community funds lift it; smoke from open burning, test firings, round-the-clock shifts and mothballing a plant sour it. An unhappy town objects to new plants and rail links, and below 30 its people protest at your gates.
        </p>
        {state.communities.burnBanUntil > state.day && (
          <p className="mb-2 text-ops-red">A court order bans open burning at the demilitarization site until {dateLabel(state.communities.burnBanUntil)}.</p>
        )}
        {state.communities.permits.length > 0 && (
          <p className="mb-2 text-ops-amber">
            Waiting on a permit: {state.communities.permits.map((p) => `${p.kind === 'plant' ? SITE_BY_ID[p.target]?.name ?? 'a plant' : 'a rail link'} (${CITIES[p.town].name})`).join(', ')}. The decision is on the Board.
          </p>
        )}
        <ul className="space-y-2">
          {communityTowns(state).map((i) => {
            const mood = state.communities.mood[i];
            const fund: SimAction = { type: 'communityFund', town: i };
            const open: SimAction = { type: 'openDay', town: i };
            return (
              <li key={i}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-white">{CITIES[i].name}</span>
                  <span className={mood < 30 ? 'text-ops-red' : mood < 45 ? 'text-ops-amber' : 'text-ops-dim'}>
                    {MOOD_WORD(mood)} · {Math.round(mood)}
                  </span>
                </div>
                <Bar ratio={mood / 100} tone={mood < 30 ? 'bg-ops-red' : mood < 45 ? 'bg-ops-amber' : 'bg-ops-green'} title="The town's mood toward you" />
                <div className="mt-1 flex flex-wrap justify-end gap-1">
                  <Btn why={validate(state, open)} onClick={() => act(open)} title="Families tour your plant: a small lift, every two months">
                    Open day · {money(openDayCost(state))}
                  </Btn>
                  <Btn why={validate(state, fund)} onClick={() => act(fund)} title="A library, a clinic, a sports ground: a big lift, every six months">
                    Community fund · {money(fundCost(state))}
                  </Btn>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <section>
        <h3 className="label mb-1">Unions</h3>
        <p className="mb-2 text-ops-dim">
          Each town's munitions workers are organised. A union grows stronger when pay falls behind prices and morale sags, and brings claims for pay, hours or safety. A strong union strikes, and the strike can spread to the town's other plants; a weaker one works to rule.
        </p>
        <ul className="space-y-2">
          {unionTowns(state).map((i) => {
            const u = state.unions.towns[i];
            return (
              <li key={i}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-white">{CITIES[i].name}</span>
                  <span className={u.strength >= 50 ? 'text-ops-amber' : 'text-ops-dim'}>
                    strength {Math.round(u.strength)} · pay {u.wage >= state.priceIndex ? 'keeps up with' : 'trails'} prices ({pct(u.wage - 1)} against {pct(state.priceIndex - 1)})
                  </span>
                </div>
                <Bar ratio={u.strength / 100} tone={u.strength >= 70 ? 'bg-ops-red' : u.strength >= 50 ? 'bg-ops-amber' : 'bg-ops-cyan'} title="Union strength: at 50 or more it strikes rather than working to rule" />
                {state.cast?.leaders[i] && (
                  <p className="mt-0.5 text-[10px] text-ops-dim">
                    Led by <span className="text-ops-text">{state.cast.leaders[i].name}</span>, a <span className={state.cast.leaders[i].temper === 'firebrand' ? 'text-ops-amber' : 'text-ops-text'}>{TEMPERS[state.cast.leaders[i].temper].name.toLowerCase()}</span>: {TEMPERS[state.cast.leaders[i].temper].blurb.charAt(0).toLowerCase() + TEMPERS[state.cast.leaders[i].temper].blurb.slice(1)}
                  </p>
                )}
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
