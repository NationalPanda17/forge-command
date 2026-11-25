// Your own industry: found plants on open plots, bring parts in-house, and choose each round's design.
import { useState } from 'react';
import { permitHeld } from '../sim/communities';
import { validate, type SimAction } from '../sim/actions';
import { DESIGN_DAYS, FOUNDABLE, FOUNDABLE_IDS, PLOT_IDS, VARIANTS, VARIANT_IDS, designCost, foundCost, inhouseCost, isFounded, type VariantId } from '../sim/industry';
import type { SimState } from '../sim/types';
import { FINISHED, MATERIALS, RECIPES, REGIONS, SITES, SITE_BY_ID, type LineId } from '../sim/world';
import { Bar, Btn } from '../ui/kit';
import { money, qty } from '../ui/format';

const ARSENALS = SITES.filter((d) => d.owner === 'state' && d.kind === 'arsenal').map((d) => d.id);
const recipeLabel = (r: string) => `${MATERIALS[RECIPES[r].output].name} (${RECIPES[r].name.toLowerCase()})`;

/** How many suppliers outside your own plants make a material: one means a single point of failure. */
function outsideSources(s: SimState, r: string): number {
  const out = RECIPES[r].output;
  return SITES.filter((d) => d.owner !== 'state' && s.sites[d.id].processes.some((p) => RECIPES[p.recipe].output === out)).length;
}

export default function IndustryPanel({ state, act, onSite, onHighlight }: { state: SimState; act: (a: SimAction) => void; onSite: (id: string) => void; onHighlight: (id: string | null) => void }) {
  const [plotRecipe, setPlotRecipe] = useState<Record<string, string>>({});
  const [arsenal, setArsenal] = useState(ARSENALS[0]);
  const [inRecipe, setInRecipe] = useState(FOUNDABLE_IDS[0]);
  const lines = (FINISHED as LineId[]).filter((l) => state.lines[l].unlocked);
  const option = (r: string) => (
    <option key={r} value={r}>
      {recipeLabel(r)}
      {outsideSources(state, r) <= 1 ? ' · sole source today' : ''}
    </option>
  );
  const inAction: SimAction = { type: 'inhouse', site: arsenal, recipe: inRecipe };
  return (
    <div className="space-y-5 p-3 text-[11px]">
      <section>
        <h3 className="label mb-1">Open plots</h3>
        <p className="mb-2 text-ops-dim">Found a plant of your own: it takes about a year to build, comes with a rail spur, and needs its own crew. Parts with a single supplier today are marked.</p>
        <ul className="space-y-2">
          {PLOT_IDS.map((id) => {
            const def = SITE_BY_ID[id];
            const site = state.sites[id];
            const founded = isFounded(state, id);
            const r = plotRecipe[id] ?? 'motorCasting';
            const a: SimAction = { type: 'found', plot: id, recipe: r };
            return (
              <li key={id} className="rounded border border-ops-line/60 p-2" onMouseEnter={() => onHighlight(`plot-${id}`)} onMouseLeave={() => onHighlight(null)}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <button type="button" className="text-white hover:underline" onClick={() => onSite(id)}>
                    {founded ? site.plantName : def.name}
                  </button>
                  <span className="text-ops-dim">{REGIONS[def.region].name}</span>
                </div>
                {founded ? (
                  site.status === 'building' ? (
                    <div className="mt-1">
                      <div className="flex justify-between text-ops-amber">
                        <span>{permitHeld(state, def.id) ? 'On hold: the town objects (Board)' : 'Under construction'}</span>
                        <span>{site.repairDays} days left</span>
                      </div>
                      <Bar ratio={1 - site.repairDays / 360} tone="bg-ops-amber" />
                    </div>
                  ) : (
                    <p className="text-ops-text">
                      Makes {MATERIALS[RECIPES[site.processes[0].recipe].output].name.toLowerCase()}: {qty(site.processes[0].lastOutput)} yesterday · crew {Math.round(site.workers)} of {site.extraCrew}
                    </p>
                  )
                ) : (
                  <>
                    <p className="text-ops-dim">{def.blurb}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <select className="input min-w-0 max-w-full py-0.5" value={r} onChange={(e) => setPlotRecipe({ ...plotRecipe, [id]: e.target.value })} aria-label={`What to make at ${def.name}`}>
                        {FOUNDABLE_IDS.map(option)}
                      </select>
                      <Btn kind="primary" why={validate(state, a)} onClick={() => act(a)}>
                        Found · {money(foundCost(state, r))}
                      </Btn>
                    </div>
                    <p className="mt-0.5 text-[10px] text-ops-dim">Needs {FOUNDABLE[r].crew} people once built.</p>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3 className="label mb-1">Bring a part in-house</h3>
        <p className="mb-2 text-ops-dim">Fit out a new line at one of your arsenals: cheaper and quicker than a new plant, about eight months.</p>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input py-0.5" value={arsenal} onChange={(e) => setArsenal(e.target.value)} aria-label="Arsenal">
            {ARSENALS.map((id) => (
              <option key={id} value={id}>
                {SITE_BY_ID[id].name}
              </option>
            ))}
          </select>
          <select className="input min-w-0 max-w-full py-0.5" value={inRecipe} onChange={(e) => setInRecipe(e.target.value)} aria-label="Part to make">
            {FOUNDABLE_IDS.map(option)}
          </select>
          <Btn kind="primary" why={validate(state, inAction)} onClick={() => act(inAction)}>
            Add line · {money(inhouseCost(state, inRecipe))}
          </Btn>
        </div>
        {state.inhouse.length > 0 && (
          <ul className="mt-2 space-y-1">
            {state.inhouse.map((j) => (
              <li key={`${j.site}-${j.recipe}`} className="flex flex-wrap justify-between gap-2 text-ops-amber">
                <span>
                  {RECIPES[j.recipe].name} at {SITE_BY_ID[j.site].name}
                </span>
                <span>{j.days} days to fit out</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="label mb-1">Round designs</h3>
        <p className="mb-2 text-ops-dim">
          Each round can be built to one design. A new design takes about {Math.round(DESIGN_DAYS / 30)} months and {money(designCost(state))}, one at a time, and applies to everything made after.
        </p>
        {state.design && (
          <p className="mb-2 text-ops-amber">
            Designing {VARIANTS[state.design.variant].name.toLowerCase()} {MATERIALS[state.design.line].name}: {Math.ceil(state.design.days)} days left.
          </p>
        )}
        <ul className="space-y-2">
          {lines.map((l) => {
            const cur: VariantId = state.variants[l] ?? 'standard';
            return (
              <li key={l} className="rounded border border-ops-line/60 p-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-white">{MATERIALS[l].name}</span>
                  <span className="text-ops-cyan">{VARIANTS[cur].name}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {VARIANT_IDS.filter((v) => v !== cur).map((v) => {
                    const a: SimAction = { type: 'design', line: l, variant: v };
                    return (
                      <Btn key={v} why={validate(state, a)} onClick={() => act(a)} title={VARIANTS[v].effect}>
                        {VARIANTS[v].name}
                      </Btn>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
        <ul className="mt-2 space-y-0.5 text-[10px] text-ops-dim">
          {VARIANT_IDS.filter((v) => v !== 'standard').map((v) => (
            <li key={v}>
              <span className="text-ops-text">{VARIANTS[v].name}:</span> {VARIANTS[v].effect}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
