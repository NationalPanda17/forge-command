import { useState } from 'react';
import {
  COMPONENTS,
  COMPONENT_IDS,
  CONTRACT_DISCOUNT,
  LINES,
  LINE_IDS,
  NATIONS,
  SPOT_PREMIUM,
  SUPPLIERS,
  backlogOf,
  inTransit,
  investCost,
  LEAD_TIME,
  MAX_INVEST,
  cancelPenalty,
  componentCap,
  contractCostPerMonth,
  contractPrice,
  contractedPerMonth,
  plannedNeed,
  qualifyCost,
  qualifyMonths,
  supplierCap,
  suppliersOf,
  validateAction,
  type Action,
  type ComponentId,
  type GameState,
} from '../../engine';
import { Bar, Btn, Chip, NumberInput, Panel, Stat } from '../kit';
import { money, qty, textToneFor } from '../format';
import Facilities from '../Facilities';
import Markets from '../Markets';

type Term = 12 | 24 | 36;

function SupplierRow({ state, sid, act }: { state: GameState; sid: string; act: (a: Action) => void }) {
  const def = SUPPLIERS[sid];
  const st = state.suppliers[sid];
  const cs = state.components[def.component];
  const need = plannedNeed(state, def.component);
  const free = Math.max(0, supplierCap(state, sid) - contractedPerMonth(cs, sid));
  const [amount, setAmount] = useState(() => Math.ceil(Math.max(1, Math.min(free, need * 0.3))));
  const [term, setTerm] = useState<Term>(24);
  const sign: Action = { type: 'signContract', component: def.component, supplier: sid, qtyPerMonth: amount, months: term };
  const qualify: Action = { type: 'qualifySupplier', supplier: sid };
  const invest: Action = { type: 'investSupplier', supplier: sid };
  const lead = LEAD_TIME[def.nation];
  const chips = [];
  if (st.bankrupt) chips.push(<Chip key="b" tone="border-ops-red/60 text-ops-red">bankrupt</Chip>);
  else if (st.qualified) chips.push(<Chip key="q" tone="border-ops-green/60 text-ops-green">qualified</Chip>);
  else if (st.qualifyingMonths !== null) chips.push(<Chip key="q" tone="border-ops-cyan/60 text-ops-cyan">qualifying · {st.qualifyingMonths} mo</Chip>);
  else chips.push(<Chip key="q">not qualified</Chip>);
  if (st.embargoMonths > 0) chips.push(<Chip key="e" tone="border-ops-red/60 text-ops-red">export ban · {st.embargoMonths} mo</Chip>);
  if (st.shockMonths > 0 || (st.qualified && st.capFactor < 0.9)) chips.push(<Chip key="s" tone="border-ops-red/60 text-ops-red">disrupted {Math.round(st.capFactor * 100)}%</Chip>);
  if (st.congestionMonths > 0) chips.push(<Chip key="c" tone="border-ops-amber/60 text-ops-amber">port congestion</Chip>);
  if (lead > 0) chips.push(<Chip key="l" title="Shipments take this long to reach you">ships in {lead} mo</Chip>);
  if (st.investingMonths !== null) chips.push(<Chip key="i" tone="border-ops-cyan/60 text-ops-cyan">expanding · {st.investingMonths} mo</Chip>);
  if (st.capBonus > 0) chips.push(<Chip key="cb" tone="border-ops-green/60 text-ops-green">+{st.capBonus * 30}% funded</Chip>);
  return (
    <tr>
      <td>
        <div className="text-white" title={def.blurb}>
          {def.name}
        </div>
        <div className="text-[10px] text-ops-dim">
          {NATIONS[def.nation].name} · price ×{def.priceMult.toFixed(2)}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-1">{chips}</div>
      </td>
      <td>
        {!st.bankrupt && (
          <>
            <Bar ratio={st.health / 100} className="w-16" title={`Financial health ${Math.round(st.health)}`} />
            <div className="text-[10px] text-ops-dim">health {Math.round(st.health)}</div>
          </>
        )}
      </td>
      <td>
        <div className="text-white">{qty(supplierCap(state, sid))}</div>
        <div className="text-[10px] text-ops-dim">of {qty(def.baseCap)} · sent {qty(st.lastDelivered)}</div>
      </td>
      <td>
        <div className="text-white">{qty(contractedPerMonth(cs, sid))}</div>
        <div className="text-[10px] text-ops-dim">free {qty(free)}</div>
      </td>
      <td>
        {st.qualified ? (
          <div className="flex flex-wrap items-center gap-1">
            <NumberInput value={amount} onChange={setAmount} label={`Monthly quantity from ${def.name}`} />
            <select className="input py-0.5" value={term} onChange={(e) => setTerm(Number(e.target.value) as Term)} aria-label="Contract length">
              <option value={12}>12 mo</option>
              <option value={24}>24 mo</option>
              <option value={36}>36 mo</option>
            </select>
            {st.capBonus < MAX_INVEST && st.investingMonths === null && (
              <Btn why={validateAction(state, invest)} title="Pay for a 30% expansion of this supplier. Ready in 8 months, and it steadies the supplier's finances." onClick={() => act(invest)}>
                Fund +30% · {money(investCost(sid))}
              </Btn>
            )}
            <Btn
              why={validateAction(state, sign)}
              title={`${Math.round((1 - CONTRACT_DISCOUNT[term]) * 100)}% off list. Take-or-pay: you pay every month, delivered or not.`}
              onClick={() => act(sign)}
            >
              Sign · {money(amount * contractPrice(state, sid, term))}/mo
            </Btn>
          </div>
        ) : !st.bankrupt && st.qualifyingMonths === null ? (
          <Btn why={validateAction(state, qualify)} title="Test articles, audits and paperwork before this source can ship to you." onClick={() => act(qualify)}>
            Qualify · {money(qualifyCost(state, sid))} · {qualifyMonths(state, sid)} mo
          </Btn>
        ) : null}
      </td>
    </tr>
  );
}

function ComponentPanel({ state, c, act }: { state: GameState; c: ComponentId; act: (a: Action) => void }) {
  const def = COMPONENTS[c];
  const cs = state.components[c];
  const need = plannedNeed(state, c);
  const cap = componentCap(state, c);
  const contracted = contractedPerMonth(cs);
  const users = LINE_IDS.filter((id) => LINES[id].bom[c]);
  const subsOn = users.filter((id) => state.lines[id].substitutes[c]).length;
  const cover = need > 0 ? cs.stock / need : 99;
  return (
    <Panel title={def.name} right={`used by ${users.map((id) => LINES[id].name).join(', ')}`}>
      <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Stock" value={`${qty(cs.stock)} ${def.unit}`} sub={`${cover > 20 ? '20+' : cover.toFixed(1)} months of plan`} tone={textToneFor(Math.min(1, cover))} />
        <Stat label="Plan needs" value={`${qty(need)}/mo`} sub={cs.lastShort > 0.01 ? `short ${qty(cs.lastShort)} last month` : `used ${qty(cs.lastUsed)} last month`} tone={cs.lastShort > 0.01 ? 'text-ops-red' : 'text-white'} />
        <Stat label="Suppliers can ship" value={`${qty(cap)}/mo`} sub={`shipped ${qty(cs.lastDelivered)} · at sea ${qty(inTransit(state, c))}`} tone={cap < need ? 'text-ops-red' : 'text-white'} />
        <Stat label="Contracted" value={`${qty(contracted)}/mo`} sub={`${money(contractCostPerMonth(cs))}/mo${backlogOf(cs) > 0.01 ? ` · owed ${qty(backlogOf(cs))}` : ''}`} tone={contracted < need * 0.7 ? 'text-ops-amber' : 'text-white'} />
        <div>
          <div className="label">Spot buy / month</div>
          <NumberInput value={cs.spotOrder} onChange={(v) => act({ type: 'setSpotOrder', component: c, qty: v })} label={`${def.name} spot order per month`} className="w-24" />
          <div className={`text-[10px] ${cs.priceIndex > 1.15 ? 'text-ops-red' : 'text-ops-dim'}`}>
            +{Math.round((SPOT_PREMIUM - 1) * 100)}% over list · market ×{cs.priceIndex.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="label">Substitute</div>
          <Btn
            pressed={subsOn === users.length}
            title={`${def.substitute.name}: ${def.substitute.blurb} Performance ×${def.substitute.perf}. Up to ${qty(def.substitute.cap)} ${def.unit}/month, only when real parts run short.`}
            onClick={() => act({ type: 'setSubstituteAll', component: c, on: subsOn < users.length })}
          >
            {subsOn === users.length ? 'Allowed' : subsOn > 0 ? `${subsOn}/${users.length} lines` : 'Off'}
          </Btn>
          <div className="truncate text-[10px] text-ops-dim">{def.substitute.name}</div>
        </div>
      </div>
      {(cs.lastAged > 0.01 || cs.lastLost > 0.01) && (
        <p className="px-3 pb-2 text-[10px] text-ops-amber">
          {cs.lastAged > 0.01 && `${qty(cs.lastAged)} ${def.unit} aged out of storage last month. `}
          {cs.lastLost > 0.01 && `${qty(cs.lastLost)} ${def.unit} lost at sea.`}
        </p>
      )}
      <div className="overflow-x-auto border-t border-ops-line/50">
        <table className="table-ops w-full min-w-[820px]">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Health</th>
              <th>Can ship</th>
              <th>Contracted</th>
              <th>Order</th>
            </tr>
          </thead>
          <tbody>
            {suppliersOf(c).map((sid) => (
              <SupplierRow key={sid} state={state} sid={sid} act={act} />
            ))}
          </tbody>
        </table>
      </div>
      {cs.contracts.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-ops-line/50 px-3 py-2">
          {cs.contracts.map((k) => (
            <span key={k.id} className="inline-flex items-center gap-2 rounded border border-ops-line/60 px-2 py-1 text-[10px]">
              <span className="text-ops-text">{SUPPLIERS[k.supplier].name}</span>
              <span className="text-ops-dim">
                {qty(k.qtyPerMonth)}/mo · {k.monthsLeft} of {k.months} mo left · {money(k.unitPrice)} each
                {k.backlog > 0.01 && <span className="text-ops-amber"> · owed {qty(k.backlog)}</span>}
              </span>
              {k.monthsLeft > 0 && (
                <button
                  type="button"
                  className="text-ops-red hover:underline disabled:opacity-40"
                  disabled={!!validateAction(state, { type: 'cancelContract', component: c, contract: k.id })}
                  title={`Cancel: penalty ${money(cancelPenalty(state, c, k.id))} (30% of what is left)`}
                  onClick={() => act({ type: 'cancelContract', component: c, contract: k.id })}
                >
                  cancel
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </Panel>
  );
}

export default function Supply({ state, act }: { state: GameState; act: (a: Action) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-ops-dim">
        Contracts fill first, then standing spot buys from the cheapest qualified supplier with room. Contracts lock today's market price; spot buys pay whatever the market charges. Shipments from abroad take one or two months. Qualify second sources before you need them.
      </p>
      <Markets state={state} />
      <Facilities state={state} act={act} />
      {COMPONENT_IDS.map((c) => (
        <ComponentPanel key={c} state={state} c={c} act={act} />
      ))}
    </div>
  );
}
