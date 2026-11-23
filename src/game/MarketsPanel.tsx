// Markets: prices, tenders and bids, contracts, export orders, allies and events in progress.
import { useMemo, useState } from 'react';
import { validate, type SimAction } from '../sim/actions';
import { TENDER_COST, bidders, priceNow } from '../sim/economy';
import { ALLIES, ALLY_IDS, SEASON_NOTE, seasonOf } from '../sim/living';
import { inputRates } from '../sim/selectors';
import type { SimState } from '../sim/types';
import { FINISHED, MATERIALS, SITES, SITE_BY_ID, type MaterialId } from '../sim/world';
import { Bar, Btn, COLORS, LineChart, NumberInput, Segmented } from '../ui/kit';
import { pct, qty } from '../ui/format';
import { dateLabel, monthLabel2 } from './useSim';
import { Explain } from '../ui/Explain';
import { tr } from '../sim/worldgen';
import { seasonWhy } from './explain';

const CHAIN_LABEL = { labour: 'Pay dispute', quality: 'Suspect parts', safety: 'Mine safety' } as const;

/** What your own plants use of each material a day. */
function stateNeed(s: SimState): Partial<Record<MaterialId, number>> {
  const out: Partial<Record<MaterialId, number>> = {};
  for (const def of SITES) if (def.owner === 'state') for (const [m, v] of Object.entries(inputRates(s, s.sites[def.id])) as [MaterialId, number][]) out[m] = (out[m] ?? 0) + v;
  return out;
}

export default function MarketsPanel({ state, act, onSite }: { state: SimState; act: (a: SimAction) => void; onSite: (id: string) => void }) {
  const need = useMemo(() => stateNeed(state), [state]);
  const tenderable = useMemo(
    () => (Object.keys(MATERIALS) as MaterialId[]).filter((m) => !FINISHED.includes(m) && (need[m] ?? 0) > 0 && bidders(state, m).length > 0).sort((a, b) => MATERIALS[a].name.localeCompare(MATERIALS[b].name)),
    [state, need],
  );
  const [chosen, setMaterial] = useState<MaterialId>(tenderable[0] ?? 'steel');
  // If the chosen material drops off the list, fall back to the first one still on it.
  const material = tenderable.includes(chosen) ? chosen : (tenderable[0] ?? chosen);
  const [perDay, setPerDay] = useState<number>(() => Math.round((need[tenderable[0] ?? 'steel'] ?? 1) * 1000) / 1000);
  const [months, setMonths] = useState<'12' | '24' | '36'>('24');
  const tenderAction: SimAction = { type: 'openTender', material, perDay, months: Number(months) as 12 | 24 | 36 };
  const why = validate(state, tenderAction);
  const season = seasonOf(state.day);
  const hist = state.history.slice(-36);

  return (
    <div className="space-y-4 p-3 text-[11px]">
      <section>
        <h3 className="label mb-1">Prices</h3>
        <p className="mb-2 text-ops-text">
          Costs are up{' '}
          <Explain title="Prices" lines={() => seasonWhy(state)}>
            <span className={state.priceIndex > 1.08 ? 'text-ops-amber' : 'text-white'}>{pct(state.priceIndex - 1)}</span>
          </Explain>{' '}
          over normal prices. Spot buying costs 30% over list; contracts lock today's price.
        </p>
        {hist.length >= 2 && (
          <LineChart height={70} min={1} max={Math.max(1.05, ...hist.map((h) => h.priceIndex ?? 1)) + 0.01} xLabels={[monthLabel2(hist[0].month), monthLabel2(hist.at(-1)!.month)]} format={(v) => v.toFixed(3)} series={[{ label: 'Price index', values: hist.map((h) => h.priceIndex ?? 1), color: COLORS.amber }]} />
        )}
        <p className="mt-2 text-ops-dim">
          <span className="text-ops-text">{season[0].toUpperCase() + season.slice(1)}.</span> {tr(SEASON_NOTE[season])}
        </p>
      </section>

      <section>
        <h3 className="label mb-1">Open a tender</h3>
        <p className="mb-2 text-ops-dim">Every qualified supplier bids. More bidders mean sharper prices; struggling firms bid low but deliver less reliably.</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1">
            <span className="sr-only">Material</span>
            <select
              className="input py-0.5"
              value={material}
              onChange={(e) => {
                const m = e.target.value as MaterialId;
                setMaterial(m);
                setPerDay(Math.round((need[m] ?? 1) * 1000) / 1000);
              }}
            >
              {tenderable.map((m) => (
                <option key={m} value={m}>
                  {MATERIALS[m].name} ({bidders(state, m).length} bidder{bidders(state, m).length > 1 ? 's' : ''})
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <NumberInput value={perDay} onChange={setPerDay} step={0.01} label="Units a day" className="w-24" />
            <span className="text-ops-dim">{MATERIALS[material]?.unit} a day</span>
          </label>
          <Segmented label="Contract length" value={months} onChange={setMonths} options={[{ id: '12', label: '1 yr' }, { id: '24', label: '2 yr' }, { id: '36', label: '3 yr' }]} />
          <Btn kind="primary" why={why} onClick={() => act(tenderAction)}>
            Open tender (${TENDER_COST}M)
          </Btn>
        </div>
        <p className="mt-1 text-ops-dim">Your plants use {qty(need[material] ?? 0)} a day. List price today ${priceNow(state, material).toFixed(4)}M.</p>
      </section>

      {state.tenders.length > 0 && (
        <section>
          <h3 className="label mb-1">Bids</h3>
          <div className="space-y-3">
            {state.tenders.map((t) => (
              <article key={t.id} className="rounded border border-ops-line p-2">
                <div className="mb-1 flex flex-wrap justify-between gap-2">
                  <span className="text-white">
                    {qty(t.perDay)} {MATERIALS[t.material].name} a day, {t.months / 12} year{t.months > 12 ? 's' : ''}
                  </span>
                  <span className="text-ops-dim">bids lapse {dateLabel(t.expires)}</span>
                </div>
                <ul className="space-y-1.5">
                  {t.bids.map((b) => {
                    const a: SimAction = { type: 'awardTender', tender: t.id, site: b.site };
                    return (
                      <li key={b.site} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                        <span className="min-w-0">
                          <button type="button" className="text-white hover:underline" onClick={() => onSite(b.site)}>
                            {SITE_BY_ID[b.site].name}
                          </button>
                          <span className="block text-[10px] text-ops-dim">
                            ${b.price.toFixed(4)}M · {qty(b.perDay)} a day · reliability {pct(b.reliability)} · {b.note}
                          </span>
                        </span>
                        <Btn why={validate(state, a)} onClick={() => act(a)}>
                          Award
                        </Btn>
                      </li>
                    );
                  })}
                </ul>
              </article>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="label mb-1">Contracts</h3>
        {state.contracts.length ? (
          <ul className="space-y-1">
            {state.contracts.map((c) => {
              const now = priceNow(state, c.material);
              const left = Math.max(0, c.endDay - state.day);
              return (
                <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <span className="min-w-0">
                    <span className="text-white">{MATERIALS[c.material].name}</span> <span className="text-ops-dim">from {SITE_BY_ID[c.site].name}</span>
                    <span className="block text-[10px] text-ops-dim">
                      {qty(c.perDay)} a day at ${c.price.toFixed(4)}M ({c.price < now ? <span className="text-ops-green">{pct(1 - c.price / now)} under today's list</span> : <span className="text-ops-amber">at or over list</span>})
                    </span>
                  </span>
                  <span className={left < 60 ? 'text-ops-amber' : 'text-ops-dim'}>{left < 60 ? `ends in ${left} days` : `to ${dateLabel(c.endDay)}`}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-ops-amber">No contracts. Everything is bought on the spot market at a 30% premium.</p>
        )}
      </section>

      <section>
        <h3 className="label mb-1">Export orders</h3>
        {state.exports.length ? (
          <ul className="space-y-2">
            {state.exports.map((x) => (
              <li key={x.id}>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-white">
                    {MATERIALS[x.line].name} for {x.customer}
                  </span>
                  <span className="text-ops-dim">
                    {qty(x.delivered)} of {qty(x.qty)} · due {dateLabel(x.endDay)}
                  </span>
                </div>
                <Bar ratio={x.delivered / Math.max(1, x.qty)} tone="bg-ops-cyan" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ops-dim">None. Foreign customers ask from time to time; offers arrive as decisions on the Board.</p>
        )}
      </section>

      <section>
        <h3 className="label mb-1">Allies</h3>
        <ul className="space-y-2">
          {ALLY_IDS.map((a) => (
            <li key={a}>
              <div className="flex justify-between gap-2">
                <span className="text-white">{ALLIES[a].name}</span>
                <span className={state.allies[a] >= 60 ? 'text-ops-green' : state.allies[a] >= 40 ? 'text-ops-text' : 'text-ops-red'}>{Math.round(state.allies[a])}</span>
              </div>
              <Bar ratio={state.allies[a] / 100} tone={state.allies[a] >= 60 ? 'bg-ops-green' : state.allies[a] >= 40 ? 'bg-ops-cyan' : 'bg-ops-red'} />
              <p className="mt-0.5 text-[10px] text-ops-dim">{tr(ALLIES[a].blurb)} Good relations unlock emergency sales when you are short.</p>
            </li>
          ))}
        </ul>
      </section>

      {state.chains.length > 0 && (
        <section>
          <h3 className="label mb-1">Developing situations</h3>
          <ul className="space-y-1">
            {state.chains.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2">
                <button type="button" className="text-ops-amber hover:underline" onClick={() => onSite(c.site)}>
                  {CHAIN_LABEL[c.kind]} at {SITE_BY_ID[c.site].name}
                </button>
                <span className="text-ops-dim">next {dateLabel(c.due)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
