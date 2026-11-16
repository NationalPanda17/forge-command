import { LINES, costExchange, monthlyBurn, supplementalAvailable, validateAction, type Action, type GameState, type Ledger as LedgerT } from '../../engine';
import { Btn, COLORS, Empty, LineChart, Panel, Stat } from '../kit';
import { money, qty, shortMonth } from '../format';

const ROWS: { key: keyof LedgerT; label: string; sign: 1 | -1 }[] = [
  { key: 'appropriation', label: 'Appropriation', sign: 1 },
  { key: 'revenue', label: 'Partner sales and supplementals', sign: 1 },
  { key: 'wages', label: 'Wages', sign: -1 },
  { key: 'overhead', label: 'Plant overhead', sign: -1 },
  { key: 'components', label: 'Components', sign: -1 },
  { key: 'storage', label: 'Storage', sign: -1 },
  { key: 'projects', label: 'Projects and hiring', sign: -1 },
  { key: 'penalties', label: 'Penalties', sign: -1 },
];

export default function Ledger({ state, act }: { state: GameState; act: (a: Action) => void }) {
  const last = state.history.at(-1);
  const months = state.history.map((h) => shortMonth(h.month));
  const cx = costExchange(state);
  const totals = cx.reduce((a, r) => ({ spend: a.spend + r.spend, stopped: a.stopped + r.stopped }), { spend: 0, stopped: 0 });
  const supp: Action = { type: 'requestSupplemental' };
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <Panel title="Finances">
        <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-4">
          <Stat label="Treasury" value={money(state.treasury)} tone={state.treasury < 0 ? 'text-ops-red' : 'text-white'} />
          <Stat label="Appropriation" value={`${money(state.appropriation)}/mo`} sub="reset each fiscal year" />
          <Stat label="Fixed burn" value={`${money(monthlyBurn(state))}/mo`} sub="wages, overhead, contracts" />
          <div>
            <div className="label">Supplemental</div>
            <Btn why={validateAction(state, supp)} onClick={() => act(supp)} title="Ask the Defence Committee for extra money. Better odds during a crisis and with high confidence.">
              {state.mods.supplementalPending ? 'Request sent' : 'Request'}
            </Btn>
            {!supplementalAvailable(state) && !state.mods.supplementalPending && <div className="text-[10px] text-ops-dim">cooldown {state.mods.supplementalCooldown} mo</div>}
          </div>
        </div>
        <div className="px-3 pb-3">
          <LineChart xLabels={months} series={[{ label: 'Treasury', values: state.history.map((h) => h.treasury), color: COLORS.green }]} format={(v) => money(v)} />
        </div>
        {last ? (
          <table className="table-ops w-full">
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.key}>
                  <td className="text-ops-dim">{r.label}</td>
                  <td className={`text-right ${r.sign > 0 ? 'text-ops-green' : ''}`}>
                    {r.sign > 0 ? '+' : '−'}
                    {money(last.ledger[r.key]).replace('−', '')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>The ledger fills in after your first month.</Empty>
        )}
      </Panel>

      <div className="space-y-3">
        <Panel title="Cost exchange" right="interceptor dollars fired vs threat dollars stopped">
          <div className="overflow-x-auto">
            <table className="table-ops w-full min-w-[520px]">
              <thead>
                <tr>
                  <th>Interceptor</th>
                  <th className="text-right">Made</th>
                  <th className="text-right">Fired</th>
                  <th className="text-right">Spent</th>
                  <th className="text-right">Stopped</th>
                  <th className="text-right">Ratio</th>
                </tr>
              </thead>
              <tbody>
                {cx.map((r) => (
                  <tr key={r.line}>
                    <td className="text-white">{LINES[r.line].name}</td>
                    <td className="text-right">{qty(r.made)}</td>
                    <td className="text-right">{qty(r.used)}</td>
                    <td className="text-right">{money(r.spend)}</td>
                    <td className="text-right text-ops-green">{money(r.stopped)}</td>
                    <td className={`text-right ${r.ratio >= 1 ? 'text-ops-green' : r.ratio >= 0.7 ? 'text-ops-amber' : 'text-ops-red'}`}>{r.used > 0 ? `${r.ratio.toFixed(2)}×` : '—'}</td>
                  </tr>
                ))}
                <tr>
                  <td className="text-ops-dim">All interceptors</td>
                  <td />
                  <td />
                  <td className="text-right">{money(totals.spend)}</td>
                  <td className="text-right text-ops-green">{money(totals.stopped)}</td>
                  <td className="text-right">{totals.spend > 0 ? `${(totals.stopped / totals.spend).toFixed(2)}×` : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="px-3 py-2 text-[10px] leading-relaxed text-ops-dim">
            Above 1× you stop more threat value than you fire. Cheap drones and rockets drag the ratio down: a $480K Stinger against a $35K drone is a losing trade
            on paper, even when it saves something far more valuable.
          </p>
        </Panel>

        <Panel title="Fiscal-year reviews">
          {state.reviews.length === 0 ? (
            <Empty>The Defence Committee reviews the Board at the end of every year.</Empty>
          ) : (
            <ul className="divide-y divide-ops-line/50">
              {[...state.reviews].reverse().map((r) => (
                <li key={r.year} className="px-3 py-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="font-sans text-[14px] font-semibold text-white">Year {r.year}</span>
                    <span>
                      {money(r.oldAppropriation)} → <span className={r.newAppropriation >= r.oldAppropriation ? 'text-ops-green' : 'text-ops-red'}>{money(r.newAppropriation)}</span>/mo
                    </span>
                  </div>
                  <div className="text-ops-dim">
                    readiness {Math.round(r.readiness * 100)}% · {Math.round(r.leakers)} through · confidence {Math.round(r.confidence)}
                  </div>
                  <ul className="mt-1 list-disc pl-4">
                    {r.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
