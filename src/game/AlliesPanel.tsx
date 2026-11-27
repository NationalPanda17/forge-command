// Allies and exports: allies and co-production, the nations that sell you parts, and the export desk.
import { useState } from 'react';
import { validate, type SimAction } from '../sim/actions';
import { ALLIES, ALLY_IDS } from '../sim/living';
import { COPROD_LAPSE, COPROD_NEEDS, DESK_COST, GUARANTEE_NEEDS, coprodCost, coprodLines, coprodPrice, coprodRounds, guaranteeCost, guaranteed, missionCost, supplierNations } from '../sim/diplomacy';
import { DAYS_PER_MONTH, lotQty } from '../sim/selectors';
import type { AllyId, SimState } from '../sim/types';
import { MATERIALS, SITES, type LineId } from '../sim/world';
import { Bar, Btn } from '../ui/kit';
import { money } from '../ui/format';
import { dateLabel } from './useSim';

const tone = (v: number) => (v >= 65 ? 'bg-ops-green' : v >= 40 ? 'bg-ops-cyan' : 'bg-ops-amber');

function LineSelect({ value, onChange, lines, label }: { value: LineId; onChange: (l: LineId) => void; lines: LineId[]; label: string }) {
  return (
    <select className="input min-w-0 max-w-full py-0.5" value={value} onChange={(e) => onChange(e.target.value as LineId)} aria-label={label}>
      {lines.map((l) => (
        <option key={l} value={l}>
          {MATERIALS[l].name}
        </option>
      ))}
    </select>
  );
}

export default function AlliesPanel({ state, act }: { state: SimState; act: (a: SimAction) => void }) {
  const lines = coprodLines(state);
  const [coLine, setCoLine] = useState<LineId>(lines[0] ?? 'pac3');
  const [exLine, setExLine] = useState<LineId>(lines[0] ?? 'pac3');
  const d = state.diplomacy;
  const ally = (a: AllyId) => {
    const v = state.allies[a];
    const mission: SimAction = { type: 'tradeMission', who: a };
    const co: SimAction = { type: 'coproduce', ally: a, line: coLine };
    return (
      <li key={a} className="space-y-1 rounded border border-ops-line/60 p-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-white">{ALLIES[a].name}</span>
          <span className="text-ops-dim">relations {Math.round(v)}</span>
        </div>
        <Bar ratio={v / 100} tone={tone(v)} title="Relations, 0 to 100" />
        <p className="text-[10px] text-ops-dim">{ALLIES[a].blurb}</p>
        <div className="flex flex-wrap items-center gap-1">
          <Btn why={validate(state, mission)} onClick={() => act(mission)}>
            Trade mission · {money(missionCost(state))}
          </Btn>
          <Btn why={validate(state, co)} onClick={() => act(co)} title={`Needs relations of ${COPROD_NEEDS}. They land ${coprodRounds(state, coLine)} ${MATERIALS[coLine].name} a month at ${money(coprodPrice(state, coLine))} each, for two years.`}>
            Co-produce {MATERIALS[coLine].name} · {money(coprodCost(state))}
          </Btn>
        </div>
      </li>
    );
  };
  return (
    <div className="space-y-4 p-3 text-[11px]">
      <section>
        <h3 className="label mb-1">Allies</h3>
        <p className="mb-2 text-ops-dim">
          Allies ask for help and offer rounds in a crisis. With relations of {COPROD_NEEDS} or more, an ally will co-produce a round with you: a steady flow of rounds for two years, at 90% of the price, though the work goes abroad. A deal lapses if relations fall below {COPROD_LAPSE}.
        </p>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="label">Round to co-produce</span>
          <LineSelect value={coLine} onChange={setCoLine} lines={lines} label="Round to co-produce" />
        </div>
        <ul className="space-y-2">{ALLY_IDS.map(ally)}</ul>
        {d.coprod.length > 0 && (
          <ul className="mt-2 space-y-1">
            {d.coprod.map((c) => {
              const a: SimAction = { type: 'endCoproduction', id: c.id };
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 break-words">
                    <span className="text-ops-text">{MATERIALS[c.line].name}</span> <span className="text-ops-dim">· {ALLIES[c.ally].name} · {c.perMonth} a month at {money(c.perMonth * c.price)} · until {dateLabel(c.until)}</span>
                  </span>
                  <Btn kind="danger" why={validate(state, a)} onClick={() => act(a)}>
                    End early
                  </Btn>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h3 className="label mb-1">Nations that sell you parts</h3>
        <p className="mb-2 text-ops-dim">
          The colder relations are, the likelier a nation is to ban exports to you. Trade missions warm them; at {GUARANTEE_NEEDS} or more, a nation will guarantee its supplies for a year. Selling rounds abroad warms everyone a little.
        </p>
        <ul className="space-y-2">
          {supplierNations().map((n) => {
            const v = d.nations[n] ?? 50;
            const sites = SITES.filter((x) => x.owner === 'foreign' && x.nation === n);
            const banned = sites.filter((x) => state.sites[x.id].embargoDays > 0);
            const mission: SimAction = { type: 'tradeMission', who: n };
            const guarantee: SimAction = { type: 'supplyGuarantee', nation: n };
            return (
              <li key={n} className="space-y-1 rounded border border-ops-line/60 p-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-white">{n}</span>
                  <span className={banned.length ? 'text-ops-red' : guaranteed(state, n) ? 'text-ops-green' : 'text-ops-dim'}>
                    {banned.length ? `export ban · ${Math.round(Math.max(...banned.map((x) => state.sites[x.id].embargoDays)) / 7)} weeks left` : guaranteed(state, n) ? `guaranteed until ${dateLabel(d.guarantees[n])}` : `relations ${Math.round(v)}`}
                  </span>
                </div>
                <Bar ratio={v / 100} tone={tone(v)} title="Relations, 0 to 100" />
                <p className="text-[10px] text-ops-dim">Sells you: {sites.map((x) => x.name).join(', ')}</p>
                <div className="flex flex-wrap gap-1">
                  <Btn why={validate(state, mission)} onClick={() => act(mission)}>
                    Trade mission · {money(missionCost(state))}
                  </Btn>
                  <Btn why={validate(state, guarantee)} onClick={() => act(guarantee)}>
                    Supply guarantee · {money(guaranteeCost(state))}
                  </Btn>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3 className="label mb-1">Export desk</h3>
        <p className="mb-2 text-ops-dim">Buyers sometimes come to you; your desk can also go looking, and the buyers it finds pay a little better. Deliveries never take a reserve below half its target.</p>
        <div className="flex flex-wrap items-center gap-2">
          <LineSelect value={exLine} onChange={setExLine} lines={lines} label="Round to sell" />
          <Btn why={validate(state, { type: 'seekExport', line: exLine })} onClick={() => act({ type: 'seekExport', line: exLine })}>
            Look for a buyer · {money(DESK_COST)}
          </Btn>
        </div>
        {state.exports.length > 0 && (
          <ul className="mt-2 space-y-2">
            {state.exports.map((x) => (
              <li key={x.id}>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-ops-text">
                    {MATERIALS[x.line].name} for {x.customer}
                  </span>
                  <span className="text-ops-dim">
                    {Math.round(x.delivered)} of {x.qty} · {Math.max(0, Math.round((x.endDay - state.day) / DAYS_PER_MONTH))} months left
                  </span>
                </div>
                <Bar ratio={x.delivered / Math.max(1, x.qty)} tone="bg-ops-cyan" />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[10px] text-ops-dim">At the central depot: {lines.map((l) => `${MATERIALS[l].name} ${Math.round(lotQty(state.sites.depotCentral.lots[l]))}`).join(' · ')}</p>
      </section>
    </div>
  );
}
