import { useState } from 'react';
import {
  COMPONENTS,
  COMPONENT_IDS,
  CONTRACT_DISCOUNT,
  LINES,
  LINE_IDS,
  SPOT_PREMIUM,
  contractCostPerMonth,
  contractedPerMonth,
  plannedNeed,
  supplierCap,
  type Action,
  type ComponentId,
  type GameState,
} from '../engine';
import { money, qty, textToneFor } from './format';

type Term = 12 | 24 | 36;

function ContractForm({ state, id, act }: { state: GameState; id: ComponentId; act: (a: Action) => void }) {
  const def = COMPONENTS[id];
  const [amount, setAmount] = useState(() => Math.ceil(plannedNeed(state, id) * 0.25));
  const [term, setTerm] = useState<Term>(24);
  const perMonth = amount * def.price * CONTRACT_DISCOUNT[term];
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        className="input w-20 py-0.5"
        value={amount}
        onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
        aria-label={`${def.name} contract quantity per month`}
      />
      <select className="input py-0.5" value={term} onChange={(e) => setTerm(Number(e.target.value) as Term)} aria-label="Contract length">
        <option value={12}>12 mo</option>
        <option value={24}>24 mo</option>
        <option value={36}>36 mo</option>
      </select>
      <button
        className="btn"
        disabled={amount <= 0}
        title={`${Math.round((1 - CONTRACT_DISCOUNT[term]) * 100)}% off list. Take-or-pay: you pay every month whether you need the parts or not.`}
        onClick={() => act({ type: 'signContract', component: id, qtyPerMonth: amount, months: term })}
      >
        Sign · {money(perMonth)}/mo
      </button>
    </div>
  );
}

export default function ComponentsPanel({ state, act }: { state: GameState; act: (a: Action) => void }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <span>Shared components</span>
        <span className="label normal-case tracking-normal">
          spot buys cost {Math.round((SPOT_PREMIUM - 1) * 100)}% over list · contracts fill first
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="table-ops w-full min-w-[960px]">
          <thead>
            <tr>
              <th>Component</th>
              <th>Stock</th>
              <th>Plan needs</th>
              <th>Supplier can ship</th>
              <th>Contracted</th>
              <th>Spot / mo</th>
              <th>New multi-year contract</th>
            </tr>
          </thead>
          <tbody>
            {COMPONENT_IDS.map((id) => {
              const def = COMPONENTS[id];
              const cs = state.components[id];
              const need = plannedNeed(state, id);
              const cap = supplierCap(state, id);
              const contracted = contractedPerMonth(cs);
              const backlog = cs.contracts.reduce((s, k) => s + k.backlog, 0);
              const users = LINE_IDS.filter((l) => LINES[l].bom[id]).map((l) => LINES[l].name);
              const cover = need > 0 ? cs.stock / need : 9;
              return (
                <tr key={id}>
                  <td>
                    <div className="font-sans text-[14px] font-semibold text-white" title={def.blurb}>
                      {def.name}
                    </div>
                    <div className="text-[10px] text-ops-dim">
                      {def.supplier} · {def.supplierNation}
                    </div>
                    <div className="max-w-[220px] truncate text-[10px] text-ops-dim" title={users.join(', ')}>
                      used by {users.join(', ')}
                    </div>
                  </td>
                  <td>
                    <div className={`${textToneFor(Math.min(1, cover))}`}>{qty(cs.stock)}</div>
                    <div className="text-[10px] text-ops-dim">{def.unit}</div>
                  </td>
                  <td>
                    <div className="text-white">{qty(need)}</div>
                    {cs.lastShort > 0.01 && <div className="text-[10px] text-ops-red">short {qty(cs.lastShort)} last mo</div>}
                  </td>
                  <td>
                    <div className={cap < need ? 'text-ops-red' : 'text-white'}>{qty(cap)}</div>
                    {cs.shockMonths > 0 || cs.capFactor < 0.9 ? (
                      <span className="chip border-ops-red/60 text-ops-red">disrupted</span>
                    ) : (
                      <div className="text-[10px] text-ops-dim">delivered {qty(cs.lastDelivered)}</div>
                    )}
                  </td>
                  <td>
                    <div className="text-white">{qty(contracted)}</div>
                    <div className="text-[10px] text-ops-dim">
                      {money(contractCostPerMonth(cs))}/mo
                      {cs.contracts.length > 0 && ` · ${Math.max(...cs.contracts.map((k) => k.monthsLeft))} mo left`}
                    </div>
                    {backlog > 0.01 && <div className="text-[10px] text-ops-amber">owed {qty(backlog)}</div>}
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      className="input w-20 py-0.5"
                      value={cs.spotOrder}
                      onChange={(e) => act({ type: 'setSpotOrder', component: id, qty: Math.max(0, Number(e.target.value) || 0) })}
                      aria-label={`${def.name} standing spot order per month`}
                    />
                    <div className="text-[10px] text-ops-dim">≈ {money(cs.spotOrder * def.price * SPOT_PREMIUM)}/mo</div>
                  </td>
                  <td>
                    <ContractForm state={state} id={id} act={act} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
