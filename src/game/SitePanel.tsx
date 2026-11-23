// Everything about one site: what it makes, what limits it, what it holds, and what you can do there.
import { useState } from 'react';
import { CONTRACT_DISCOUNT, expandCost, investCost, qualifyCost, refurbishCost, repairCost, validate, type SimAction } from '../sim/actions';
import { BASE_LINES } from '../sim/fight';
import { baseDailyDraw, crewNeed, inbound, inputRates, lotQty, processRate } from '../sim/selectors';
import type { RunLevel, SimState } from '../sim/types';
import { MATERIALS, RECIPES, REGIONS, SITE_BY_ID, type LineId, type MaterialId } from '../sim/world';
import { Bar, Btn, Chip, NumberInput, Segmented } from '../ui/kit';
import { hardenCost } from '../sim/build';
import PlantView from './PlantView';
import { FOUNDABLE, FOUNDABLE_IDS, foundCost } from '../sim/industry';
import { KIND_LABEL } from '../ui/map/icons';
import { Explain } from '../ui/Explain';
import { rateWhy } from './explain';
import { money, qty } from '../ui/format';
import { controllerOf } from '../sim/hotseat';

const OWNER = { state: 'Yours', private: 'Private company', foreign: 'Foreign supplier' } as const;

function limitText(l: string | null): { text: string; tone: string } {
  if (!l) return { text: '—', tone: 'text-ops-dim' };
  if (l === 'capacity') return { text: 'at capacity', tone: 'text-ops-green' };
  if (l === 'idle') return { text: 'idle', tone: 'text-ops-dim' };
  if (l === 'crew') return { text: 'short of crew', tone: 'text-ops-amber' };
  if (l === 'damaged') return { text: 'stopped', tone: 'text-ops-red' };
  if (l === 'demand') return { text: 'no buyers', tone: 'text-ops-dim' };
  return { text: `short of ${MATERIALS[l as MaterialId]?.name.toLowerCase() ?? l}`, tone: 'text-ops-red' };
}

/** Founding a plant on an open plot. */
function FoundHere({ state, plot, act }: { state: SimState; plot: string; act: (a: SimAction) => void }) {
  const [recipe, setRecipe] = useState('motorCasting');
  const a: SimAction = { type: 'found', plot, recipe };
  return (
    <section className="rounded border border-ops-cyan/40 p-2">
      <div className="label mb-1">Found a plant here</div>
      <div className="flex flex-wrap items-center gap-2">
        <select className="input min-w-0 max-w-full py-0.5" value={recipe} onChange={(e) => setRecipe(e.target.value)} aria-label="What to make">
          {FOUNDABLE_IDS.map((r) => (
            <option key={r} value={r}>
              {MATERIALS[RECIPES[r].output].name}
            </option>
          ))}
        </select>
        <Btn kind="primary" why={validate(state, a)} onClick={() => act(a)}>
          Found · {money(foundCost(state, recipe))}
        </Btn>
      </div>
      <p className="mt-1 text-[10px] text-ops-dim">About a year to build, with its own rail spur. It needs {FOUNDABLE[recipe].crew} people once built.</p>
    </section>
  );
}

export default function SitePanel({ state, siteId, act, onMaterial }: { state: SimState; siteId: string; act: (a: SimAction) => void; onMaterial: (m: MaterialId) => void }) {
  const def = SITE_BY_ID[siteId];
  const site = state.sites[siteId];
  const [hire, setHire] = useState(50);
  const why = (a: SimAction) => validate(state, a);
  const mine = def.owner === 'state';
  const rates = inputRates(state, site);
  const lines = Object.keys(site.lots) as LineId[];
  const unserv = Object.entries(site.unserviceable).filter(([, q]) => (q ?? 0) >= 1) as [LineId, number][];
  const outgoing = state.shipments.filter((sh) => sh.from === siteId);
  const incoming = state.shipments.filter((sh) => sh.to === siteId);
  const contracts = state.contracts.filter((c) => c.site === siteId);
  const MatLink = ({ m }: { m: MaterialId }) => (
    <button type="button" className="text-ops-cyan hover:underline" onClick={() => onMaterial(m)}>
      {MATERIALS[m].name}
    </button>
  );
  return (
    <div className="space-y-3 p-3 text-[11px]">
      <header>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-sans text-[18px] font-semibold text-white">{site.plantName ?? def.name}</h2>
          <Chip tone={mine ? 'border-ops-amber/60 text-ops-amber' : def.owner === 'foreign' ? 'border-ops-violet/60 text-ops-violet' : 'border-ops-line text-ops-dim'}>{OWNER[def.owner]}</Chip>
        </div>
        <div className="text-[10px] text-ops-dim">
          {def.nation ?? REGIONS[def.region].name} · {KIND_LABEL[site.plantKind ?? def.kind].toLowerCase()}
        </div>
        {state.hotseat && def.owner === 'state' && (() => {
          const h = state.hotseat;
          const c = controllerOf(h, def.id);
          return (
            <div className={`text-[10px] ${c === h.active ? 'text-ops-cyan' : 'text-ops-dim'}`}>
              Run by {h.players[c].name} ({h.players[c].command}){c === h.active ? '' : ': only they can act here'}
            </div>
          );
        })()}
        <p className="mt-1 text-ops-text">{def.blurb}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {site.status !== 'active' && def.kind !== 'plot' && <Chip tone="border-ops-red/60 text-ops-red">{site.status}</Chip>}
          {def.kind === 'plot' && site.status === 'building' && <Chip tone="border-ops-amber/60 text-ops-amber">building · {site.repairDays} d</Chip>}
          {site.disruptionDays > 0 && <Chip tone="border-ops-red/60 text-ops-red">disrupted {Math.round(site.disruptionFactor * 100)}% · {site.disruptionDays} d</Chip>}
          {site.embargoDays > 0 && <Chip tone="border-ops-red/60 text-ops-red">export ban · {site.embargoDays} d</Chip>}
          {!mine && !site.qualified && <Chip>{site.qualifyingDays !== null ? `qualifying · ${site.qualifyingDays} d` : 'not qualified'}</Chip>}
          {!mine && site.qualified && def.owner !== 'foreign' && <Chip tone="border-ops-green/60 text-ops-green">qualified</Chip>}
        </div>
      </header>

      {def.kind === 'plot' && site.processes.length === 0 && <FoundHere state={state} plot={siteId} act={act} />}

      {(mine || def.owner === 'private') && site.processes.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="label">Condition</div>
            <Bar ratio={site.condition / 100} className="mt-1" />
            <div className="text-[10px] text-ops-dim">{Math.round(site.condition)}/100</div>
          </div>
          {mine ? (
            <div>
              <div className="label">Workers</div>
              <div className="text-white">
                {Math.round(site.workers)} <span className="text-ops-dim">/ {Math.round(crewNeed(site))} needed</span>
              </div>
              {site.trainees.length > 0 && <div className="text-[10px] text-ops-dim">{site.trainees.reduce((a, t) => a + t.count, 0)} in training</div>}
            </div>
          ) : (
            <div>
              <div className="label">Financial health</div>
              <Bar ratio={site.health / 100} className="mt-1" />
            </div>
          )}
        </div>
      )}

      {site.processes.length > 0 && (
        <section>
          <div className="label mb-1">Production</div>
          <div className="space-y-2">
            {site.processes.map((p, i) => {
              const rec = RECIPES[p.recipe];
              const lim = limitText(p.lastLimit);
              return (
                <div key={p.recipe} className="rounded border border-ops-line/60 p-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-white">{rec.name}</span>
                    <span className={lim.tone}>{lim.text}</span>
                  </div>
                  <div className="text-ops-dim">
                    makes <MatLink m={rec.output} />: {qty(p.lastOutput)} {MATERIALS[rec.output].unit} yesterday · up to{' '}
                    <Explain title="Daily rate" lines={() => rateWhy(state, siteId, p)}>
                      {qty(processRate(state, site, p))}/day
                    </Explain>
                    {p.maturity < 0.99 && ` · ramping ${Math.round(p.maturity * 100)}%`}
                  </div>
                  {Object.keys(rec.inputs).length > 0 && (
                    <div className="text-[10px] text-ops-dim">
                      from{' '}
                      {(Object.entries(rec.inputs) as [MaterialId, number][]).map(([m2, q], j) => (
                        <span key={m2}>
                          {j > 0 && ', '}
                          {qty(q)} {MATERIALS[m2].unit} <MatLink m={m2} />
                        </span>
                      ))}{' '}
                      each · scrap {Math.round(rec.scrap * 100)}%
                    </div>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {mine && (
                      <Segmented<RunLevel>
                        label={`${rec.name} shifts`}
                        value={p.run}
                        onChange={(run) => act({ type: 'setRun', site: siteId, process: i, run })}
                        options={[
                          { id: 'idle', label: 'Idle' },
                          { id: 'single', label: '1 shift' },
                          { id: 'normal', label: '2 shifts' },
                          { id: 'surge', label: '24 h' },
                        ]}
                        tones={{ surge: 'border-ops-amber bg-ops-amber/20 text-white' }}
                      />
                    )}
                    {mine && (
                      <Btn why={why({ type: 'expand', site: siteId, process: i })} onClick={() => act({ type: 'expand', site: siteId, process: i })} title="+25% capacity; it ramps up over months">
                        Expand · {money(expandCost(state, siteId, i))}
                      </Btn>
                    )}
                    {def.owner === 'private' && (
                      <Btn why={why({ type: 'invest', site: siteId, process: i })} onClick={() => act({ type: 'invest', site: siteId, process: i })} title="Pay for +30% capacity at this company">
                        Fund +30% · {money(investCost(state, siteId, i))}
                      </Btn>
                    )}
                    {def.owner !== 'state' && site.qualified && <ContractButton state={state} siteId={siteId} material={rec.output} act={act} />}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {mine && site.processes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <NumberInput value={hire} onChange={setHire} label="Workers to hire" />
          <Btn why={why({ type: 'hire', site: siteId, count: hire })} onClick={() => act({ type: 'hire', site: siteId, count: hire })} title="Trainees count after 90 days">
            Hire
          </Btn>
          <Btn why={why({ type: 'repair', site: siteId })} onClick={() => act({ type: 'repair', site: siteId })}>
            Overhaul · {money(repairCost(state, siteId))}
          </Btn>
        </div>
      )}
      {mine && def.crew > 0 && site.processes.length > 0 && <PlantView state={state} siteId={siteId} act={act} />}
      {def.owner === 'private' && site.processes.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-ops-dim">
            {state.network.hardened.includes(siteId) ? 'Resilience works done: disruptions are rarer and milder here.' : 'A resilience grant pays for spares, fire walls and backup power.'}
          </span>
          {!state.network.hardened.includes(siteId) &&
            (state.network.projects.some((p) => p.kind === 'harden' && p.target === siteId) ? (
              <span className="text-ops-amber">Works under way</span>
            ) : (
              <Btn why={why({ type: 'build', kind: 'harden', target: siteId })} onClick={() => act({ type: 'build', kind: 'harden', target: siteId })}>
                Resilience grant · {money(hardenCost(state, siteId))}
              </Btn>
            ))}
        </div>
      )}
      {!mine && def.owner === 'private' && !site.qualified && site.qualifyingDays === null && (
        <Btn kind="primary" why={why({ type: 'qualify', site: siteId })} onClick={() => act({ type: 'qualify', site: siteId })} title="Audits, test articles and paperwork: about eight months">
          Qualify as a supplier · {money(qualifyCost(siteId))}
        </Btn>
      )}

      {contracts.length > 0 && (
        <section>
          <div className="label mb-1">Your contracts here</div>
          {contracts.map((c) => (
            <div key={c.id} className="flex items-baseline justify-between gap-2">
              <span>
                {qty(c.perDay)} {MATERIALS[c.material].unit}/day of <MatLink m={c.material} /> at {money(c.price)} · until day {c.endDay}
              </span>
              <button type="button" className="text-ops-red hover:underline" onClick={() => act({ type: 'cancelContract', contract: c.id })}>
                cancel
              </button>
            </div>
          ))}
        </section>
      )}

      {Object.keys(rates).length > 0 && (
        <section>
          <div className="label mb-1">Input stock</div>
          <table className="w-full">
            <tbody>
              {(Object.entries(rates) as [MaterialId, number][]).map(([m2, rate]) => {
                const have = site.stock[m2] ?? 0;
                const days = rate > 0 ? have / rate : 99;
                return (
                  <tr key={m2}>
                    <td>
                      <MatLink m={m2} />
                    </td>
                    <td className="text-right">
                      {qty(have)} {MATERIALS[m2].unit}
                    </td>
                    <td className={`text-right ${days < 3 ? 'text-ops-red' : days < 7 ? 'text-ops-amber' : 'text-ops-dim'}`}>{days > 60 ? '60+' : days.toFixed(1)} d</td>
                    <td className="text-right text-ops-dim">+{qty(inbound(state, siteId, m2))} coming</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {lines.length > 0 && (
        <section>
          <div className="label mb-1">Rounds held</div>
          <table className="w-full">
            <thead>
              <tr className="text-ops-dim">
                <th className="text-left font-normal">Type</th>
                <th className="text-right font-normal">Ready</th>
                <th className="text-right font-normal">Oldest lot expires</th>
                {BASE_LINES[def.kind] && <th className="text-right font-normal">Draw/day</th>}
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const lots = site.lots[l] ?? [];
                const next = lots[0]?.until;
                return (
                  <tr key={l}>
                    <td>
                      <MatLink m={l} />
                    </td>
                    <td className="text-right text-white">{qty(lotQty(lots))}</td>
                    <td className={`text-right ${next !== undefined && next - state.day < 180 ? 'text-ops-amber' : 'text-ops-dim'}`}>{next === undefined ? '—' : `${Math.round((next - state.day) / 30)} mo`}</td>
                    {BASE_LINES[def.kind] && <td className="text-right text-ops-dim">{qty(baseDailyDraw(state, siteId, l))}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {unserv.length > 0 && (
        <section>
          <div className="label mb-1">Past service life</div>
          {unserv.map(([l, q]) => (
            <div key={l} className="flex flex-wrap items-center justify-between gap-1">
              <span>
                {qty(q)} {MATERIALS[l].name}
              </span>
              <Btn why={why({ type: 'refurbish', site: siteId, line: l })} onClick={() => act({ type: 'refurbish', site: siteId, line: l })} title="New motors and recertification: five more years">
                Refurbish · {money(refurbishCost(l, q))}
              </Btn>
            </div>
          ))}
          <p className="text-[10px] text-ops-dim">Otherwise they ship to Karrow for demilitarization.</p>
        </section>
      )}

      {(incoming.length > 0 || outgoing.length > 0) && (
        <section>
          <div className="label mb-1">Shipments</div>
          <ul className="max-h-40 space-y-0.5 overflow-y-auto">
            {incoming.slice(0, 12).map((sh) => (
              <li key={sh.id} className="text-ops-dim">
                ← {qty(sh.qty)} {MATERIALS[sh.material].unit} {MATERIALS[sh.material].name} from {SITE_BY_ID[sh.from].name}, {sh.arrive - state.day} d ({sh.modes.join(' + ')})
              </li>
            ))}
            {outgoing.slice(0, 12).map((sh) => (
              <li key={sh.id} className="text-ops-dim">
                → {qty(sh.qty)} {MATERIALS[sh.material].unit} {MATERIALS[sh.material].name} to {SITE_BY_ID[sh.to].name}, {sh.arrive - state.day} d
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ContractButton({ state, siteId, material, act }: { state: SimState; siteId: string; material: MaterialId; act: (a: SimAction) => void }) {
  const [open, setOpen] = useState(false);
  const [perDay, setPerDay] = useState(1);
  const [months, setMonths] = useState<12 | 24 | 36>(24);
  const a: SimAction = { type: 'signContract', site: siteId, material, perDay, months };
  if (!open) return <Btn onClick={() => setOpen(true)}>Contract…</Btn>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <NumberInput value={perDay} onChange={setPerDay} step={0.1} label="Units per day" />
      <select className="input py-0.5" value={months} onChange={(e) => setMonths(Number(e.target.value) as 12 | 24 | 36)} aria-label="Contract length">
        <option value={12}>12 mo</option>
        <option value={24}>24 mo</option>
        <option value={36}>36 mo</option>
      </select>
      <Btn kind="primary" why={validate(state, a)} onClick={() => { act(a); setOpen(false); }}>
        Sign · {money(perDay * MATERIALS[material].price * state.priceIndex * CONTRACT_DISCOUNT[months] * 30)}/mo
      </Btn>
    </span>
  );
}
