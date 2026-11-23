// Power: each region's grid, its price and reserve, blackouts, power contracts and your plants' generators.
import { validate, type SimAction } from '../sim/actions';
import { CONTRACT_MONTHS, GRID_REGIONS, GRID_UPGRADE_DAYS, blackoutOdds, contractPrice, generatorCost, gridUpgradeCost, intensityOf, powerPrice, regionPlants } from '../sim/energy';
import type { SimState } from '../sim/types';
import { REGIONS, SITE_BY_ID } from '../sim/world';
import { Bar, Btn } from '../ui/kit';
import { money, pct } from '../ui/format';
import { dateLabel } from './useSim';

const HUNGER = (v: number) => (v >= 2.5 ? 'very power-hungry' : v >= 1.5 ? 'power-hungry' : v >= 0.9 ? 'average' : 'light');

export default function PowerPanel({ state, act, onSite }: { state: SimState; act: (a: SimAction) => void; onSite: (id: string) => void }) {
  const e = state.energy;
  const month = state.history.at(-1);
  return (
    <div className="space-y-4 p-3 text-[11px]">
      <p className="text-ops-dim">
        Every region has its own grid. Your plants pay for power by how hungry they are, at the grid's price, and private suppliers pass their power bills on in their prices. When a grid runs short of reserve, in winter, or when the rival strikes it in a crisis, blackouts stop lines: plants with their own generators keep 70% of their output.
      </p>
      {e.shock && <p className="text-ops-red">A fuel shock is under way: power prices are up by about {pct(e.shock.size)} for another {Math.max(1, Math.round(e.shock.days / 30))} months or so.</p>}
      {month && (
        <p className="text-ops-dim">
          Last month your plants' power cost {money(month.spend.energy ?? 0)}
          {(month.blackoutDays ?? 0) > 0 ? `, and blackouts lasted ${month.blackoutDays} region-day${month.blackoutDays === 1 ? '' : 's'}` : ''}.
        </p>
      )}
      <section>
        <h3 className="label mb-1">Grids</h3>
        <ul className="space-y-2">
          {GRID_REGIONS.map((r) => {
            const g = e.grids[r];
            const plants = regionPlants(state, r);
            const contract = e.contracts.find((c) => c.region === r && c.until > state.day);
            const pc: SimAction = { type: 'powerContract', region: r };
            const up: SimAction = { type: 'gridUpgrade', region: r };
            return (
              <li key={r} className="space-y-1 rounded border border-ops-line/60 p-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-white">{REGIONS[r].name}</span>
                  <span className={g.outage > 0 ? 'text-ops-red' : g.price > 1.2 ? 'text-ops-amber' : 'text-ops-dim'}>
                    {g.outage > 0 ? `blackout · ${g.outage} day${g.outage > 1 ? 's' : ''} left` : `power at ${pct(g.price)} of normal`}
                  </span>
                </div>
                <Bar ratio={g.reserve / 0.4} tone={g.reserve < 0.1 ? 'bg-ops-red' : g.reserve < 0.16 ? 'bg-ops-amber' : 'bg-ops-green'} title="Spare generating capacity: the thinner it is, the likelier a blackout" />
                <div className="flex flex-wrap justify-between gap-2 text-[10px] text-ops-dim">
                  <span>
                    Reserve {pct(g.reserve)} · blackout risk {pct(Math.min(1, blackoutOdds(state, r) * 30))} a month
                    {g.upgrading !== null ? ` · new capacity in ${Math.ceil(g.upgrading / 30)} months` : ''}
                  </span>
                  <span>{contract ? `Your contract: ${pct(contract.price)} until ${dateLabel(contract.until)}` : plants.length ? `${plants.length} of your plants` : 'None of your plants'}</span>
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  <Btn why={validate(state, pc)} onClick={() => act(pc)} title={`Fix the price your plants pay here for ${CONTRACT_MONTHS} months, at 5% over today's price.`}>
                    Power contract at {pct(contractPrice(state, r))}
                  </Btn>
                  <Btn why={validate(state, up)} onClick={() => act(up)} title={`More generating capacity: +8 points of reserve after about ${Math.round(GRID_UPGRADE_DAYS / 30)} months. The regions approve.`}>
                    Upgrade the grid · {money(gridUpgradeCost(state))}
                  </Btn>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <section>
        <h3 className="label mb-1">Your plants</h3>
        <ul className="space-y-1">
          {GRID_REGIONS.flatMap((r) => regionPlants(state, r)).map((d) => {
            const site = state.sites[d.id];
            const has = e.generators.includes(d.id);
            const a: SimAction = { type: 'generator', site: d.id };
            return (
              <li key={d.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <span className="min-w-0 break-words">
                  <button type="button" className="text-left text-ops-text hover:underline" onClick={() => onSite(d.id)}>
                    {site.plantName ?? SITE_BY_ID[d.id].name}
                  </button>{' '}
                  <span className="text-ops-dim">
                    · {HUNGER(intensityOf(site))} · pays {pct(powerPrice(state, d.region))}
                  </span>
                </span>
                {has ? (
                  <span className="text-ops-green">Generators</span>
                ) : (
                  <Btn why={validate(state, a)} onClick={() => act(a)} title="Keeps 70% of output through a blackout, at twice the power cost while it runs.">
                    Generators · {money(generatorCost(state, d.id))}
                  </Btn>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
