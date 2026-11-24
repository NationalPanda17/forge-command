// Build: new links, route upgrades, the icebreaker and resilience grants, and everything under construction.
import { validate, type SimAction } from '../sim/actions';
import { permitHeld } from '../sim/communities';
import { ICEBREAKER_COST, MAX_UPGRADE, hardenCost, linkCost, linkDays, liveRoutes, projectName, routeCap, upgradeCost, upgradeDays } from '../sim/build';
import { pathBetween } from '../sim/graph';
import type { SimState } from '../sim/types';
import { CANDIDATE_ROUTES, MATERIALS, RECIPES, ROUTE_KEY, SITES, SITE_BY_ID, isPlotSpur, routeKm } from '../sim/world';
import { Bar, Btn } from '../ui/kit';
import { money, pct } from '../ui/format';

const MODE_NAME = { rail: 'Rail', road: 'Road', sea: 'Sea', air: 'Air' } as const;

/** How many qualified suppliers make each material: a sole source is a single point of failure. */
function sources(m: string): number {
  return SITES.filter((d) => d.owner !== 'state' && d.processes.some((p) => RECIPES[p.recipe].output === m)).length;
}

export default function BuildPanel({ state, act, onHighlight, onSite }: { state: SimState; act: (a: SimAction) => void; onHighlight: (id: string | null) => void; onSite: (id: string) => void }) {
  const n = state.network;
  const hover = (id: string | null) => ({ onMouseEnter: () => onHighlight(id), onMouseLeave: () => onHighlight(null), onFocus: () => onHighlight(id), onBlur: () => onHighlight(null) });
  const busy = liveRoutes(state)
    .filter((r) => r.mode !== 'air')
    .map((r) => {
      const key = ROUTE_KEY(r.a, r.b);
      return { r, key, use: (state.routeLoad[key] ?? 0) / routeCap(state, r), level: n.upgrades[key] ?? 0 };
    })
    .sort((a, b) => b.use - a.use)
    .slice(0, 10);
  const grants = SITES.filter((d) => d.owner === 'private' && d.processes.length && !n.hardened.includes(d.id))
    .map((d) => ({ d, sole: d.processes.some((p) => sources(RECIPES[p.recipe].output) === 1) }))
    .sort((a, b) => Number(b.sole) - Number(a.sole) || b.d.crew - a.d.crew)
    .slice(0, 8);

  return (
    <div className="space-y-4 p-3 text-[11px]">
      <p className="text-ops-dim">Hover a line to see it on the map. Plans show in amber; work in progress moves.</p>

      {n.projects.length > 0 && (
        <section>
          <h3 className="label mb-1">Under construction</h3>
          <ul className="space-y-2">
            {n.projects.map((p) => (
              <li key={p.id} {...hover(p.kind === 'link' || p.kind === 'upgrade' ? p.target : null)} tabIndex={0}>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-white">{projectName(state, p)}</span>
                  <span className={permitHeld(state, String(p.id)) ? 'text-ops-amber' : 'text-ops-dim'}>{permitHeld(state, String(p.id)) ? 'on hold: a town objects' : `${p.days} days left`}</span>
                </div>
                <Bar ratio={1 - p.days / p.total} tone="bg-ops-amber" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="label mb-1">New links</h3>
        <ul className="space-y-2">
          {CANDIDATE_ROUTES.filter((c) => !isPlotSpur(c.id)).map((c) => {
            const built = n.built.includes(c.id);
            const going = n.projects.some((p) => p.kind === 'link' && p.target === c.id);
            const now = pathBetween(c.a, c.b);
            const a: SimAction = { type: 'build', kind: 'link', target: c.id };
            return (
              <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2" {...hover(c.id)}>
                <span className="min-w-0">
                  <span className="text-white">{c.name}</span> <span className="text-ops-dim">· {MODE_NAME[c.mode]}, {Math.round(routeKm(c))} km, {c.cap.toLocaleString('en-US')} t a day</span>
                  <span className="block text-[10px] text-ops-dim">
                    {c.blurb} {!built && now ? `The fastest route today takes ${now.days} day${now.days > 1 ? 's' : ''}.` : ''}
                  </span>
                </span>
                {built ? (
                  <span className="text-ops-green">Open</span>
                ) : going ? (
                  <span className="text-ops-amber">Building</span>
                ) : (
                  <Btn why={validate(state, a)} onClick={() => act(a)} title={`About ${Math.round(linkDays(c.id) / 30)} months to build`}>
                    Build · {money(linkCost(state, c.id))}
                  </Btn>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3 className="label mb-1">Busiest routes</h3>
        <p className="mb-2 text-ops-dim">Yesterday's tonnage against each route's limit. Each upgrade adds half again, twice at most.</p>
        <ul className="space-y-1.5">
          {busy.map(({ r, key, use, level }) => {
            const a: SimAction = { type: 'build', kind: 'upgrade', target: key };
            const going = n.projects.some((p) => p.kind === 'upgrade' && p.target === key);
            return (
              <li key={`${key}-${r.mode}`} className="grid grid-cols-[minmax(0,1fr)_64px_auto] items-center gap-2" {...hover(key)}>
                <span className="min-w-0 truncate">
                  <span className="text-ops-text">
                    {SITE_BY_ID[r.a].name} – {SITE_BY_ID[r.b].name}
                  </span>{' '}
                  <span className="text-ops-dim">
                    · {MODE_NAME[r.mode]}
                    {level ? ` · upgraded ×${level}` : ''}
                  </span>
                </span>
                <span className={use >= 0.85 ? 'text-right text-ops-red' : use >= 0.6 ? 'text-right text-ops-amber' : 'text-right text-ops-dim'}>{pct(use)}</span>
                {level >= MAX_UPGRADE ? (
                  <span className="text-ops-green">Full</span>
                ) : going ? (
                  <span className="text-ops-amber">Building</span>
                ) : (
                  <Btn why={validate(state, a)} onClick={() => act(a)} title={`About ${Math.round(upgradeDays(state, key) / 30)} months`}>
                    {money(upgradeCost(state, key))}
                  </Btn>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3 className="label mb-1">Icebreaker</h3>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-ops-text">Keeps the Meric sea lanes at 90% through the winter, instead of 60%.</span>
          {n.icebreaker ? (
            <span className="text-ops-green">In service</span>
          ) : n.projects.some((p) => p.kind === 'icebreaker') ? (
            <span className="text-ops-amber">Fitting out</span>
          ) : (
            <Btn why={validate(state, { type: 'build', kind: 'icebreaker', target: 'meric' })} onClick={() => act({ type: 'build', kind: 'icebreaker', target: 'meric' })}>
              Commission · {money(ICEBREAKER_COST * state.priceIndex)}
            </Btn>
          )}
        </div>
      </section>

      <section>
        <h3 className="label mb-1">Resilience grants</h3>
        <p className="mb-2 text-ops-dim">Spares, fire walls and backup power at a supplier: disruptions there become rarer, shorter and milder. Sole sources first.</p>
        <ul className="space-y-1.5">
          {grants.map(({ d, sole }) => {
            const a: SimAction = { type: 'build', kind: 'harden', target: d.id };
            const going = n.projects.some((p) => p.kind === 'harden' && p.target === d.id);
            return (
              <li key={d.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <span className="min-w-0 break-words">
                  <button type="button" className="text-left text-ops-text hover:underline" onClick={() => onSite(d.id)}>
                    {d.name}
                  </button>{' '}
                  <span className="text-ops-dim">
                    · {d.processes.map((p) => MATERIALS[RECIPES[p.recipe].output].name.toLowerCase()).join(', ')}
                    {sole ? <span className="text-ops-amber"> · sole source</span> : ''}
                  </span>
                </span>
                {going ? (
                  <span className="text-ops-amber">Under way</span>
                ) : (
                  <Btn why={validate(state, a)} onClick={() => act(a)}>
                    {money(hardenCost(state, d.id))}
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
