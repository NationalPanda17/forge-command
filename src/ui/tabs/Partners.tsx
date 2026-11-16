import { LINES, PARTNERS, PARTNER_IDS, effectiveCapacity, partnerDemand, type Action, type GameState } from '../../engine';
import { Bar, Btn, Empty, Panel } from '../kit';
import { money, monthLabel, qty } from '../format';

export default function Partners({ state, act }: { state: GameState; act: (a: Action) => void }) {
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-3">
        <Panel title="Open tenders" right="partners pay above cost, and expect delivery">
          {state.tenders.length === 0 ? (
            <Empty>No tenders open. New ones arrive from time to time.</Empty>
          ) : (
            <div className="grid gap-3 p-3 md:grid-cols-2">
              {state.tenders.map((t) => {
                const line = state.lines[t.line];
                const committed = partnerDemand(state, t.line);
                const share = (committed + t.qtyPerMonth) / Math.max(1, effectiveCapacity(line));
                return (
                  <article key={t.id} className="rounded border border-ops-line/70 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-sans text-[15px] font-semibold text-white">{PARTNERS[t.partner].name}</h3>
                      <span className="text-[10px] text-ops-dim">expires {monthLabel(t.expires)}</span>
                    </div>
                    <p className="text-[12px]">
                      {qty(t.qtyPerMonth)} {LINES[t.line].name} a month for {t.months} months at {money(t.unitPrice)} each
                    </p>
                    <p className="text-[10px] text-ops-dim">
                      Worth {money(t.qtyPerMonth * t.months * t.unitPrice)} in total. Would take {Math.round(share * 100)}% of the line's current output, with what you already owe.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Btn kind="primary" onClick={() => act({ type: 'acceptTender', tender: t.id })}>
                        Accept
                      </Btn>
                      <Btn onClick={() => act({ type: 'declineTender', tender: t.id })}>Decline</Btn>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Delivery contracts" right="partners are served from fresh output, before the reserve">
          {state.partnerContracts.length === 0 ? (
            <Empty>No contracts yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-ops w-full min-w-[640px]">
                <thead>
                  <tr>
                    <th>Partner</th>
                    <th>Line</th>
                    <th>Per month</th>
                    <th>Months left</th>
                    <th>Owed now</th>
                    <th>Delivered</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {state.partnerContracts.map((c) => (
                    <tr key={c.id}>
                      <td className="text-white">{PARTNERS[c.partner].name}</td>
                      <td>{LINES[c.line].name}</td>
                      <td>{qty(c.qtyPerMonth)}</td>
                      <td>{c.monthsLeft}</td>
                      <td className={c.owed > c.qtyPerMonth ? 'text-ops-red' : ''}>{qty(c.owed)}</td>
                      <td>{qty(c.delivered)}</td>
                      <td>{money(c.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Partner nations" right="goodwill">
        <ul className="divide-y divide-ops-line/50">
          {PARTNER_IDS.map((p) => {
            const g = state.partners[p].goodwill;
            return (
              <li key={p} className="px-3 py-2">
                <div className="flex items-baseline justify-between">
                  <span className="font-sans text-[14px] font-semibold text-white">{PARTNERS[p].name}</span>
                  <span>{Math.round(g)}</span>
                </div>
                <Bar ratio={g / 100} className="my-1" />
                <p className="text-[10px] text-ops-dim">{PARTNERS[p].blurb}</p>
                <p className="text-[10px] text-ops-dim">Buys: {PARTNERS[p].wants.map((l) => LINES[l].name).join(', ')}</p>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-ops-line/50 p-3 text-[10px] leading-relaxed text-ops-dim">
          Partners above 70 goodwill sometimes share critical materials or co-fund new bays. Late deliveries cost goodwill and penalties.
        </p>
      </Panel>
    </div>
  );
}
