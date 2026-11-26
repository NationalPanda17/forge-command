// Command panels: stockpile lifecycle, logistics, the fight, money and the live feed.
import { THREATS, THREAT_IDS } from '../sim/fight';
import { AUDITOR, AUDIT_LIMITS, REVIEW_MONTHS, WASTE_IDS, WASTE_NAME, counted, teamCost, teamUpkeep, wasteSince } from '../sim/audit';
import { validate } from '../sim/actions';
import { MODES, ROUTES, ROUTE_KEY, MATERIALS, REGIONS, FIGHTING_REGIONS, SITE_BY_ID, FINISHED, type LineId, type MaterialId, type RegionId } from '../sim/world';
import { lotQty, nationalDailyDraw, nationalStock, readiness, regionDailyDraw, reserveTarget, unserviceableTotal } from '../sim/selectors';
import type { SimAction } from '../sim/actions';
import type { SimState } from '../sim/types';
import { Bar, Btn, COLORS, LineChart, Segmented } from '../ui/kit';
import { tr } from '../sim/worldgen';
import { messageDot, messageTone, money, pct, qty } from '../ui/format';
import { dateLabel, monthLabel2 } from './useSim';

const linesOf = (s: SimState) => FINISHED.filter((l) => s.lines[l as LineId].unlocked) as LineId[];

/** Age profile of every serviceable round of a line, in years. */
function ageBands(s: SimState, line: LineId): number[] {
  const bands = new Array(11).fill(0);
  for (const site of Object.values(s.sites)) for (const l of site.lots[line] ?? []) bands[Math.min(10, Math.max(0, Math.floor((s.day - l.made) / 360)))] += l.qty;
  return bands;
}

export function StockpilePanel({ state, act, onMaterial }: { state: SimState; act: (a: SimAction) => void; onMaterial: (m: MaterialId) => void }) {
  const demil = state.sites.karrowDemil;
  const queue = Object.values(demil.unserviceable).reduce((a, q) => a + (q ?? 0), 0);
  return (
    <div className="space-y-3 p-3 text-[11px]">
      <p className="text-ops-dim">
        Every round ages from the day it is made. Surveillance firings at the test ranges can recertify lots near the end of their life for two more years. Past it, rounds retire: refurbish them at the depot, or send them to Karrow to be burned or recycled.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={state.policy.surveillance} onChange={(e) => act({ type: 'setPolicy', policy: { surveillance: e.target.checked } })} />
          Surveillance testing
        </label>
        <span className="flex items-center gap-1">
          Demilitarization
          <Segmented
            label="Demilitarization method"
            value={state.policy.demilMethod}
            onChange={(v) => act({ type: 'setPolicy', policy: { demilMethod: v } })}
            options={[
              { id: 'burn', label: 'Open burn' },
              { id: 'recycle', label: 'Recycle' },
            ]}
          />
        </span>
      </div>
      <p className="text-[10px] text-ops-dim">
        Open burning is cheap and dirty. Recycling costs more, recovers steel, aluminium and explosive for sale, and keeps the neighbours quiet. Waiting at Karrow: {qty(queue)} rounds. Retired anywhere: {qty(unserviceableTotal(state))}.
      </p>
      <table className="w-full">
        <thead>
          <tr className="text-ops-dim">
            <th className="text-left font-normal">Type</th>
            <th className="text-right font-normal">Stock</th>
            <th className="text-left font-normal">Age (years: 0 to 10+)</th>
            <th className="text-right font-normal">Goal</th>
          </tr>
        </thead>
        <tbody>
          {linesOf(state).map((l) => {
            const bands = ageBands(state, l);
            const max = Math.max(1, ...bands);
            const shelf = Math.round(MATERIALS[l].shelfDays / 360);
            return (
              <tr key={l} className="align-middle">
                <td>
                  <button type="button" className="text-ops-cyan hover:underline" onClick={() => onMaterial(l)}>
                    {MATERIALS[l].name}
                  </button>
                </td>
                <td className="text-right text-white">{qty(nationalStock(state, l))}</td>
                <td>
                  <div className="flex h-5 items-end gap-px" title={`Service life about ${shelf} years`}>
                    {bands.map((b, i) => (
                      <div key={i} className={i >= shelf - 1 ? 'bg-ops-red' : i >= shelf - 3 ? 'bg-ops-amber' : 'bg-ops-cyan'} style={{ width: 8, height: `${Math.max(1, (b / max) * 20)}px`, opacity: b > 0 ? 0.9 : 0.15 }} />
                    ))}
                  </div>
                </td>
                <td className="text-right text-ops-dim">{qty(reserveTarget(state, l))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function LogisticsPanel({ state, act, onSite }: { state: SimState; act: (a: SimAction) => void; onSite: (id: string) => void }) {
  const busy = ROUTES.map((r) => ({ r, use: (state.routeLoad[ROUTE_KEY(r.a, r.b)] ?? 0) / r.cap }))
    .filter((x) => x.use > 0.4)
    .sort((a, b) => b.use - a.use)
    .slice(0, 8);
  const byMode: Record<string, number> = {};
  for (const sh of state.shipments) byMode[sh.modes[0] ?? 'road'] = (byMode[sh.modes[0] ?? 'road'] ?? 0) + sh.qty * MATERIALS[sh.material].weight;
  return (
    <div className="space-y-3 p-3 text-[11px]">
      <div className="grid grid-cols-4 gap-2">
        {Object.entries(MODES).map(([k, mm]) => (
          <div key={k}>
            <div className="label">{mm.name}</div>
            <div className="text-white">{qty(byMode[k] ?? 0)} t</div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-ops-dim">{state.shipments.length} shipments moving. Bases pull from their regional depot, depots from Corran Central, and Corran from the arsenals.</p>
      <section>
        <div className="label mb-1">Regional depot targets (days of the region's draw)</div>
        {FIGHTING_REGIONS.map((r) => (
          <div key={r} className="mb-1 flex flex-wrap items-center justify-between gap-1">
            <button type="button" className="text-left hover:text-ops-cyan" onClick={() => onSite(REGIONS[r].depot)}>
              {REGIONS[r].name}
            </button>
            <Segmented
              label={`${REGIONS[r].name} depot target`}
              value={String(state.policy.depotDays[r])}
              onChange={(v) => act({ type: 'setPolicy', policy: { depotDays: { ...state.policy.depotDays, [r]: Number(v) } } })}
              options={['15', '30', '45', '60', '90'].map((d) => ({ id: d, label: `${d}d` }))}
            />
          </div>
        ))}
        <div className="mt-1 flex flex-wrap items-center justify-between gap-1">
          <span>Base ready stock</span>
          <Segmented
            label="Base ready stock in days"
            value={String(state.policy.baseDays)}
            onChange={(v) => act({ type: 'setPolicy', policy: { baseDays: Number(v) } })}
            options={['5', '10', '20', '30'].map((d) => ({ id: d, label: `${d}d` }))}
          />
        </div>
      </section>
      <section>
        <div className="label mb-1">Busiest routes today</div>
        {busy.length === 0 ? (
          <p className="text-ops-dim">No route is under strain.</p>
        ) : (
          busy.map(({ r, use }) => (
            <div key={ROUTE_KEY(r.a, r.b)} className="mb-1">
              <div className="flex justify-between">
                <span>
                  {MODES[r.mode].name}: {SITE_BY_ID[r.a].name} – {SITE_BY_ID[r.b].name}
                </span>
                <span className={use > 0.95 ? 'text-ops-red' : 'text-ops-amber'}>{pct(use)}</span>
              </div>
              <Bar ratio={use} tone={use > 0.95 ? 'bg-ops-red' : 'bg-ops-amber'} />
            </div>
          ))
        )}
      </section>
    </div>
  );
}

export function FightPanel({ state, act }: { state: SimState; act: (a: SimAction) => void }) {
  const m = state.month;
  const c = state.crisis;
  return (
    <div className="space-y-3 p-3 text-[11px]">
      {c ? (
        <div className={c.phase === 'active' ? 'text-ops-red' : 'text-ops-amber'}>
          <div className="font-sans text-[16px] font-semibold">{c.name}</div>
          <div>
            {REGIONS[c.region].name} · {c.phase === 'warning' ? `expected in about ${c.days} days` : `active, about ${c.days} days left`} · intensity {c.intensity}
          </div>
        </div>
      ) : (
        <p className="text-ops-dim">No crisis. Background attacks only.</p>
      )}
      <table className="w-full">
        <thead>
          <tr className="text-ops-dim">
            <th className="text-left font-normal">This month</th>
            <th className="text-right font-normal">In</th>
            <th className="text-right font-normal">Stopped</th>
            <th className="text-right font-normal">Through</th>
          </tr>
        </thead>
        <tbody>
          {THREAT_IDS.map((t) => (
            <tr key={t}>
              <td>{THREATS[t].name}</td>
              <td className="text-right">{Math.round(m.arrived[t])}</td>
              <td className="text-right text-ops-green">{Math.round(m.stopped[t])}</td>
              <td className={`text-right ${m.leaked[t] >= 0.5 ? 'text-ops-red' : 'text-ops-dim'}`}>{Math.round(m.leaked[t])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between">
        <span className="text-ops-dim">Interceptors fired / threat value stopped</span>
        <span>
          {money(m.interceptorSpend)} / <span className="text-ops-green">{money(m.threatValueStopped)}</span>
        </span>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={state.policy.conserve} onChange={(e) => act({ type: 'setPolicy', policy: { conserve: e.target.checked } })} />
        Conserve doctrine: keep PAC-3 and SM-6 off drones and rockets
      </label>
      <section>
        <div className="label mb-1">Regional draw per day (calm)</div>
        <table className="w-full">
          <thead>
            <tr className="text-ops-dim">
              <th className="text-left font-normal">Type</th>
              {FIGHTING_REGIONS.map((r) => (
                <th key={r} className="text-right font-normal">
                  {REGIONS[r].name.split(' ')[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linesOf(state).map((l) => (
              <tr key={l}>
                <td>{MATERIALS[l].name}</td>
                {FIGHTING_REGIONS.map((r) => (
                  <td key={r} className="text-right text-ops-dim">
                    {qty(regionDailyDraw(state, r as RegionId, l))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export function MoneyPanel({ state, act }: { state: SimState; act: (a: SimAction) => void }) {
  const waste = wasteSince(state, REVIEW_MONTHS);
  const last = state.oversight.findings.at(-1);
  const flagged = state.contracts.filter((c) => c.flagged);
  const h = state.history;
  const x = h.map((r) => monthLabel2(r.month));
  const m = state.month;
  const rows: [string, number][] = [
    ['Appropriation', m.income.appropriation],
    ['Sales, recycling and recoveries', m.income.sales],
    ['Purchases', -m.spend.purchases],
    ['Operations and wages', -m.spend.operations],
    ['Power', -(m.spend.energy ?? 0)],
    ['Transport', -m.spend.transport],
    ['Projects', -m.spend.projects],
    ['Demilitarization', -m.spend.demil],
  ];
  return (
    <div className="space-y-3 p-3 text-[11px]">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <div className="label">Treasury</div>
          <div className={state.treasury < 0 ? 'text-ops-red' : 'text-white'}>{money(state.treasury)}</div>
        </div>
        <div>
          <div className="label">Budget</div>
          <div className="text-white">{money(state.appropriation)}/mo</div>
        </div>
        <div>
          <div className="label">Readiness</div>
          <div className="text-white">{pct(readiness(state))}</div>
        </div>
      </div>
      <table className="w-full">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="text-ops-dim">{k} (month to date)</td>
              <td className={`text-right ${v > 0 ? 'text-ops-green' : ''}`}>{money(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <LineChart xLabels={x} format={money} series={[{ label: 'Treasury', values: h.map((r) => r.treasury), color: COLORS.green }]} />
      <LineChart
        min={0}
        max={100}
        xLabels={x}
        series={[
          { label: 'Readiness', values: h.map((r) => r.readiness * 100), color: COLORS.cyan },
          { label: 'Confidence', values: h.map((r) => r.confidence), color: COLORS.amber },
        ]}
      />
      <section className="space-y-2 rounded border border-ops-line/60 p-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="label">Oversight</span>
          <span className="text-[10px] text-ops-dim">{AUDITOR}</span>
        </div>
        <p className="text-ops-dim">
          Every six months the Auditor-General reviews your spending. Waste counts against you: premiums for buying without a contract, idle lines, ransoms, penalties, and suppliers quietly overbilling. A clean review earns the Committee's trust.
        </p>
        {last && (
          <p className={last.verdict === 'clean' ? 'text-ops-green' : last.verdict === 'concerns' ? 'text-ops-amber' : 'text-ops-red'}>
            Last review ({monthLabel2(last.month)}): {last.verdict === 'clean' ? 'clean' : last.verdict === 'concerns' ? 'concerns raised' : 'damning'} · waste {money(last.waste)}, {pct(last.waste / Math.max(1, last.spend))} of spending.
          </p>
        )}
        <table className="w-full">
          <tbody>
            {WASTE_IDS.map((k) => (
              <tr key={k}>
                <td className="text-ops-dim">{WASTE_NAME[k]}</td>
                <td className="text-right text-ops-text">{money(waste.by[k])}</td>
              </tr>
            ))}
            <tr>
              <td className="text-ops-text">Waste over the last six months</td>
              <td className={`text-right ${counted(state, waste.total) / Math.max(1, waste.spend) >= AUDIT_LIMITS[state.difficulty][0] ? 'text-ops-amber' : 'text-white'}`}>
                {money(waste.total)} · {pct(waste.total / Math.max(1, waste.spend))}
              </td>
            </tr>
          </tbody>
        </table>
        {flagged.length > 0 && <p className="text-ops-red">Overbilling found at {flagged.map((c) => SITE_BY_ID[c.site].name).join(', ')}: a decision is waiting on the Board.</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] text-ops-dim">
            {state.oversight.team ? `Your internal audit team costs ${money(teamUpkeep(state))} a month and checks every contract.` : 'An internal audit team finds overbilling within months and softens the Auditor-General’s findings.'}
            {(state.fraudsCaught ?? 0) > 0 ? ` Overbilling caught: ${state.fraudsCaught}.` : ''}
          </span>
          {state.oversight.team ? (
            <Btn why={validate(state, { type: 'disbandAuditTeam' })} onClick={() => act({ type: 'disbandAuditTeam' })}>
              Disband the team
            </Btn>
          ) : (
            <Btn why={validate(state, { type: 'auditTeam' })} onClick={() => act({ type: 'auditTeam' })}>
              Hire an audit team · {money(teamCost(state))}
            </Btn>
          )}
        </div>
      </section>
      <p className="text-[10px] text-ops-dim">
        You pay for everything delivered to your arsenals and depots (contract or spot price), the freight to get it there, and your own plants' wages and running costs. Upstream companies buy from each other on their own account. Calm draw:{' '}
        {linesOf(state)
          .slice(0, 3)
          .map((l) => `${MATERIALS[l].name} ${qty(nationalDailyDraw(state, l))}/day`)
          .join(', ')}
        .
      </p>
    </div>
  );
}

export function Feed({ state, onSite, limit = 40 }: { state: SimState; onSite: (id: string) => void; limit?: number }) {
  const items = state.feed.slice(-limit).reverse();
  return (
    <ul className="space-y-0.5 px-3 py-2 text-[11px] leading-snug">
      {items.length === 0 && <li className="text-ops-dim">Nothing yet.</li>}
      {items.map((f, i) => (
        <li key={`${f.day}-${i}`} className="grid grid-cols-[3.25rem_6px_minmax(0,1fr)] items-baseline gap-x-2 rounded px-1 py-px hover:bg-ops-cyan/5">
          <span className="whitespace-nowrap text-ops-dim">{dateLabel(f.day).split(' · ')[0]}</span>
          <span className={`h-1.5 w-1.5 -translate-y-px self-center rounded-full ${messageDot[f.tone]}`} aria-hidden="true" />
          <span className={`min-w-0 ${messageTone[f.tone]}`}>
            {f.site ? (
              <button type="button" className="text-left hover:underline" onClick={() => onSite(f.site!)}>
                {tr(f.text)}
              </button>
            ) : (
              tr(f.text)
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export const _unused = { lotQty, Btn };
