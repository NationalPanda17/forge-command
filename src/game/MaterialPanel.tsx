// Cradle to grave for one material: who makes it, from what, who uses it, and where it all is.
import { useState } from 'react';
import { inbound, isLine, lotQty, nationalDailyDraw, nationalStock, reserveTarget } from '../sim/selectors';
import type { SimState } from '../sim/types';
import { BASELINE, MATERIALS, MATERIAL_IDS, RECIPES, SITES, SITE_BY_ID, type MaterialId } from '../sim/world';
import { Bar, Chip } from '../ui/kit';
import { money, qty } from '../ui/format';

const TIER_ORDER = ['finished', 'component', 'intermediate', 'processed', 'raw'] as const;

function Tree({ m, mult, depth, onMaterial }: { m: MaterialId; mult: number; depth: number; onMaterial: (m: MaterialId) => void }) {
  const [open, setOpen] = useState(depth < 1);
  const rec = Object.values(RECIPES).find((r) => r.output === m);
  const inputs = rec ? (Object.entries(rec.inputs) as [MaterialId, number][]) : [];
  return (
    <li>
      <span className="inline-flex items-center gap-1">
        {inputs.length > 0 ? (
          <button type="button" className="w-3 text-ops-dim" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Collapse' : 'Expand'}>
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-3 text-ops-dim">·</span>
        )}
        <button type="button" className="text-ops-cyan hover:underline" onClick={() => onMaterial(m)}>
          {MATERIALS[m].name}
        </button>
        <span className="text-ops-dim">
          {qty(mult)} {MATERIALS[m].unit}
        </span>
      </span>
      {open && inputs.length > 0 && (
        <ul className="ml-4 border-l border-ops-line/50 pl-2">
          {inputs.map(([inp, q]) => (
            <Tree key={inp} m={inp} mult={(mult * q) / (1 - rec!.scrap)} depth={depth + 1} onMaterial={onMaterial} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function MaterialPanel({ state, material, onMaterial, onSite }: { state: SimState; material: MaterialId; onMaterial: (m: MaterialId) => void; onSite: (id: string) => void }) {
  const def = MATERIALS[material];
  const makers = SITES.filter((x) => x.processes.some((p) => RECIPES[p.recipe].output === material || RECIPES[p.recipe].extra?.[material]));
  const users = Object.values(RECIPES).filter((r) => r.inputs[material]);
  const held = Object.values(state.sites).reduce((a, s) => a + (isLine(material) ? lotQty(s.lots[material]) : s.stock[material] ?? 0), 0);
  const moving = state.shipments.filter((sh) => sh.material === material).reduce((a, sh) => a + sh.qty, 0);
  return (
    <div className="space-y-3 p-3 text-[11px]">
      <div className="flex flex-wrap gap-1">
        {TIER_ORDER.map((t) => (
          <select
            key={t}
            className="input py-0.5 text-[10px]"
            value={MATERIALS[material].tier === t ? material : ''}
            onChange={(e) => e.target.value && onMaterial(e.target.value as MaterialId)}
            aria-label={`${t} materials`}
          >
            <option value="">{t}</option>
            {MATERIAL_IDS.filter((id) => MATERIALS[id].tier === t).map((id) => (
              <option key={id} value={id}>
                {MATERIALS[id].name}
              </option>
            ))}
          </select>
        ))}
      </div>
      <header>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-sans text-[18px] font-semibold text-white">{def.name}</h2>
          <Chip>{def.tier}</Chip>
        </div>
        <p className="text-ops-text">{def.blurb}</p>
        <p className="text-[10px] text-ops-dim">
          {money(def.price)} per {def.unit} · {def.weight < 0.01 ? `${Math.round(def.weight * 1000 * 10) / 10} kg` : `${qty(def.weight)} t`} per {def.unit}
          {def.shelfDays ? ` · keeps about ${Math.round(def.shelfDays / 360)} years` : ''}
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <div className="label">In the network</div>
          <div className="text-white">{qty(held)}</div>
        </div>
        <div>
          <div className="label">On the move</div>
          <div className="text-white">{qty(moving)}</div>
        </div>
        <div>
          <div className="label">{isLine(material) ? 'Calm draw/day' : 'Baseline need/day'}</div>
          <div className="text-white">{qty(isLine(material) ? nationalDailyDraw(state, material) : BASELINE[material])}</div>
        </div>
      </div>
      {isLine(material) && state.lines[material].unlocked && (
        <div>
          <div className="label">National stock vs 6-month goal</div>
          <Bar ratio={nationalStock(state, material) / Math.max(1, reserveTarget(state, material))} className="mt-1" />
          <div className="text-[10px] text-ops-dim">
            {qty(nationalStock(state, material))} of {qty(reserveTarget(state, material))}
          </div>
        </div>
      )}

      <section>
        <div className="label mb-1">Made at</div>
        {makers.length === 0 ? (
          <p className="text-ops-dim">Extracted from the ground.</p>
        ) : (
          <ul className="space-y-0.5">
            {makers.map((x) => {
              const st = state.sites[x.id];
              const p = st.processes.find((pp) => RECIPES[pp.recipe].output === material || RECIPES[pp.recipe].extra?.[material]);
              return (
                <li key={x.id} className="flex items-baseline justify-between gap-2">
                  <button type="button" className="text-left text-white hover:text-ops-cyan" onClick={() => onSite(x.id)}>
                    {x.name}
                    {x.owner === 'foreign' && <span className="text-ops-violet"> · {x.nation}</span>}
                    {!st.qualified && x.owner !== 'state' && <span className="text-ops-dim"> · not qualified</span>}
                  </button>
                  <span className={st.disruptionDays > 0 || st.embargoDays > 0 ? 'text-ops-red' : 'text-ops-dim'}>
                    {p ? `${qty(p.lastOutput)}/day` : ''} {st.embargoDays > 0 ? 'banned' : st.disruptionDays > 0 ? 'disrupted' : ''} · stock {qty(isLine(material) ? lotQty(st.lots[material]) : st.stock[material] ?? 0)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {users.length > 0 && (
        <section>
          <div className="label mb-1">Used for</div>
          <div className="flex flex-wrap gap-1">
            {users.map((r) => (
              <button key={r.id} type="button" className="chip border-ops-line text-ops-text hover:border-ops-cyan" onClick={() => onMaterial(r.output)}>
                {MATERIALS[r.output].name} ({qty(r.inputs[material]!)} {def.unit})
              </button>
            ))}
          </div>
        </section>
      )}

      {Object.values(RECIPES).some((r) => r.output === material) && (
        <section>
          <div className="label mb-1">From the ground up (per {def.unit})</div>
          <ul>
            <Tree m={material} mult={1} depth={0} onMaterial={onMaterial} />
          </ul>
        </section>
      )}

      <section>
        <div className="label mb-1">Where it is now</div>
        <ul className="max-h-48 space-y-0.5 overflow-y-auto">
          {Object.values(state.sites)
            .map((st) => ({ st, q: isLine(material) ? lotQty(st.lots[material]) : st.stock[material] ?? 0 }))
            .filter((x) => x.q > 0.0005)
            .sort((a, b) => b.q - a.q)
            .slice(0, 20)
            .map(({ st, q }) => (
              <li key={st.id} className="flex justify-between gap-2">
                <button type="button" className="text-left hover:text-ops-cyan" onClick={() => onSite(st.id)}>
                  {SITE_BY_ID[st.id].name}
                </button>
                <span className="text-ops-dim">
                  {qty(q)} {inbound(state, st.id, material) > 0 && `(+${qty(inbound(state, st.id, material))})`}
                </span>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
