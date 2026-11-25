// What the map shows about a site beyond its marker: a hover card with its key numbers, quick actions from a right-click
// or long press, and the supply chain around the selected site.
import { validate, type SimAction } from '../sim/actions';
import { isFounded } from '../sim/industry';
import type { SimState } from '../sim/types';
import { MATERIALS, RECIPES, SITES, SITE_BY_ID, type MaterialId } from '../sim/world';
import { tr } from '../sim/worldgen';
import { processRate } from '../sim/selectors';
import { TRAITS } from '../sim/cast';

/** A daily rate, as precise as it needs to be. */
const rate = (v: number) => (v >= 10 ? String(Math.round(v)) : v >= 1 ? v.toFixed(1) : v.toFixed(2));
import { KIND_LABEL } from '../ui/map/icons';
import { pct } from '../ui/format';

const LIMIT_WORD: Record<string, string> = { capacity: 'at capacity', idle: 'idle', crew: 'short of crew', damaged: 'damaged', demand: 'no demand' };

/** The sites that feed this one and the sites it feeds, by what their lines make and use. */
export function chainOf(s: SimState, id: string): { up: string[]; down: string[] } | null {
  const site = s.sites[id];
  if (!site || !site.processes.length) return null;
  const inputs = new Set<MaterialId>();
  const outputs = new Set<MaterialId>();
  for (const p of site.processes) {
    const r = RECIPES[p.recipe];
    if (!r) continue;
    outputs.add(r.output);
    for (const m of Object.keys(r.inputs) as MaterialId[]) inputs.add(m);
  }
  const up: string[] = [];
  const down: string[] = [];
  for (const d of SITES) {
    if (d.id === id) continue;
    const o = s.sites[d.id];
    if (!o || !o.processes.length || o.status === 'closed' || o.mothballed || (d.kind === 'plot' && !isFounded(s, d.id))) continue;
    const recipes = o.processes.map((p) => RECIPES[p.recipe]).filter(Boolean);
    if (recipes.some((r) => inputs.has(r.output))) up.push(d.id);
    if (recipes.some((r) => Object.keys(r.inputs).some((m) => outputs.has(m as MaterialId)))) down.push(d.id);
  }
  return { up: up.slice(0, 14), down: down.slice(0, 14) };
}

const siteName = (s: SimState, id: string) => tr(s.sites[id]?.plantName ?? SITE_BY_ID[id].name);

/** The hover card: what a site is, how it is doing, and what its lines are making. */
export function SiteCard({ state, id }: { state: SimState; id: string }) {
  const def = SITE_BY_ID[id];
  const site = state.sites[id];
  if (!def || !site) return null;
  const status =
    site.status === 'building'
      ? `Being built · ${site.repairDays} days left`
      : site.status === 'damaged'
        ? `Damaged · repairs ${site.repairDays} days`
        : site.status === 'closed'
          ? 'Closed'
          : site.embargoDays > 0
            ? `Export ban · ${site.embargoDays} days`
            : site.disruptionDays > 0
              ? `Disrupted · ${pct(site.disruptionFactor)} output`
              : site.processes.length && site.processes.every((p) => p.run === 'idle')
                ? 'Idle'
                : 'Working';
  const bad = site.status !== 'active' || site.embargoDays > 0;
  return (
    <div className="w-60 max-w-[70vw] text-[11px]">
      <div className="truncate font-sans text-[13px] font-semibold text-white">{siteName(state, id)}</div>
      <div className="truncate text-[10px] text-ops-dim">
        {KIND_LABEL[site.plantKind ?? def.kind]}
        {def.owner === 'state' ? ' · yours' : def.nation ? ` · ${def.nation}` : ' · private'}
      </div>
      <div className={`mt-1 ${bad ? 'text-ops-red' : site.disruptionDays > 0 ? 'text-ops-amber' : 'text-ops-green'}`}>{status}</div>
      {site.processes.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {site.processes.slice(0, 3).map((p, i) => {
            const out = RECIPES[p.recipe]?.output;
            const lim = p.lastLimit ? (LIMIT_WORD[p.lastLimit] ?? `short of ${MATERIALS[p.lastLimit as MaterialId]?.name.toLowerCase() ?? p.lastLimit}`) : null;
            return (
              <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <span className="truncate text-ops-text">{out ? MATERIALS[out].name : p.recipe}</span>
                <span className={lim && !['at capacity', 'no demand'].includes(lim) ? 'text-ops-amber' : 'text-ops-dim'}>
                  {p.run === 'idle' ? 'idle' : `up to ${rate(processRate(state, site, p))}/day`}
                  {lim && p.run !== 'idle' && lim !== 'at capacity' ? ` · ${lim}` : ''}
                </span>
              </li>
            );
          })}
          {site.processes.length > 3 && <li className="text-ops-dim">and {site.processes.length - 3} more lines</li>}
        </ul>
      )}
      {state.cast?.managers[id] && (
        <div className="mt-1 truncate text-[10px] text-ops-text">
          {state.cast.managers[id].name} · {TRAITS[state.cast.managers[id].trait].name.toLowerCase()} · level {state.cast.managers[id].level}
        </div>
      )}
      {def.owner === 'state' && site.processes.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-ops-dim">
          <span>{Math.round(site.workers)} crew</span>
          <span className={site.morale < 40 ? 'text-ops-amber' : ''}>morale {Math.round(site.morale)}</span>
          <span className={site.fatigue >= 50 ? 'text-ops-amber' : ''}>fatigue {Math.round(site.fatigue)}</span>
        </div>
      )}
      <div className="mt-1 text-[10px] text-ops-dim">Right-click or long-press for quick actions</div>
    </div>
  );
}

export interface QuickAction {
  label: string;
  why?: string | null;
  run: () => void;
}

/** The quick actions for a site: inspect it, trace what it makes, and the common moves for its kind. */
export function quickActions(
  s: SimState,
  id: string,
  go: { site: (id: string) => void; material: (m: MaterialId) => void; act: (a: SimAction) => void },
): QuickAction[] {
  const def = SITE_BY_ID[id];
  const site = s.sites[id];
  if (!def || !site) return [];
  const out: QuickAction[] = [{ label: 'Inspect', run: () => go.site(id) }];
  const doing = (label: string, a: SimAction) => out.push({ label, why: validate(s, a), run: () => go.act(a) });
  const first = site.processes.findIndex((p) => RECIPES[p.recipe]);
  const made = first >= 0 ? RECIPES[site.processes[first].recipe].output : null;
  if (made) out.push({ label: `Trace ${MATERIALS[made].name}`, run: () => go.material(made) });
  if (def.owner === 'state' && site.processes.length && site.status === 'active') {
    const idle = site.processes.findIndex((p) => p.run === 'idle');
    if (idle >= 0) doing(`Restart ${MATERIALS[RECIPES[site.processes[idle].recipe].output].name}`, { type: 'setRun', site: id, process: idle, run: 'normal' });
    else if (first >= 0) doing(`Expand ${MATERIALS[made!].name}`, { type: 'expand', site: id, process: first });
    doing('Vet the staff', { type: 'vet', site: id });
    if (s.energy && !s.energy.generators.includes(id)) doing('Backup generators', { type: 'generator', site: id });
  } else if (def.owner !== 'state' && site.processes.length) {
    if (!site.qualified) doing('Qualify as a supplier', { type: 'qualify', site: id });
    if (first >= 0) doing(`Invest in ${MATERIALS[made!].name}`, { type: 'invest', site: id, process: first });
  }
  return out;
}
