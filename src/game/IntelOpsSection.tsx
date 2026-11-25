// Operations against the rival: what each costs, its odds and the risk of exposure, and how past ones went.
import { validate, type SimAction } from '../sim/actions';
import { AGENCY, MAX_AGENCY, OPS, OP_IDS, agencyCost, opCost, opExposure, opOdds } from '../sim/intelops';
import type { SimState } from '../sim/types';
import { Btn } from '../ui/kit';
import { money, pct } from '../ui/format';
import { dateLabel } from './useSim';

export default function IntelOpsSection({ state, act }: { state: SimState; act: (a: SimAction) => void }) {
  const it = state.intel;
  const up: SimAction = { type: 'intelAgency' };
  return (
    <section>
      <h3 className="label mb-1">Operations</h3>
      <p className="mb-2 text-ops-dim">
        Take the fight to the rival. Each operation takes time and may fail. If it is exposed, public confidence and the allies' goodwill suffer, and the rival hurries its own work. Every success puts the rival more on guard.
      </p>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-ops-text">
          {AGENCY[it.agency]}
          {it.alert >= 0.5 && <span className="text-ops-amber"> · rival on guard</span>}
          {it.supplyUntil > state.day && <span className="text-ops-green"> · supply disrupted until {dateLabel(it.supplyUntil)}</span>}
        </span>
        {it.agency < MAX_AGENCY && (
          <Btn why={validate(state, up)} onClick={() => act(up)}>
            Grow the service · {money(agencyCost(state))}
          </Btn>
        )}
      </div>
      {it.active && (
        <div className="mb-2 rounded border border-ops-cyan/50 p-2">
          <div className="flex flex-wrap justify-between gap-2">
            <span className="text-ops-cyan">Under way: {OPS[it.active.kind].name.toLowerCase()}</span>
            <span className="text-ops-dim">{Math.ceil(it.active.days / 7)} weeks left</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded bg-ops-line/60">
            <div className="h-full bg-ops-cyan" style={{ width: `${Math.round((1 - it.active.days / it.active.total) * 100)}%` }} />
          </div>
        </div>
      )}
      <ul className="space-y-1.5">
        {OP_IDS.map((k) => {
          const a: SimAction = { type: 'intelOp', kind: k };
          return (
            <li key={k} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded border border-ops-line/60 p-2">
              <span className="min-w-0">
                <span className="text-white">{OPS[k].name}</span>
                <span className="block text-[10px] text-ops-dim">{OPS[k].blurb}</span>
                <span className="block text-[10px] text-ops-text">
                  {pct(opOdds(state, k))} to succeed · {pct(opExposure(state, k))} risk of exposure · about {Math.round(OPS[k].days / 30)} months
                </span>
              </span>
              <Btn why={validate(state, a)} onClick={() => act(a)}>
                Launch · {money(opCost(state, k))}
              </Btn>
            </li>
          );
        })}
      </ul>
      {it.record.length > 0 && (
        <ol className="mt-2 space-y-0.5">
          {[...it.record]
            .reverse()
            .slice(0, 6)
            .map((r, i) => (
              <li key={`${r.day}-${i}`} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
                <span className="text-ops-dim">{dateLabel(r.day)}</span>
                <span className="min-w-0 break-words">
                  <span className="text-ops-text">{OPS[r.kind].name}: </span>
                  <span className={r.result === 'success' ? 'text-ops-green' : 'text-ops-amber'}>{r.result === 'success' ? 'succeeded' : 'failed'}</span>
                  {r.exposed && <span className="text-ops-red"> · exposed</span>}
                </span>
              </li>
            ))}
        </ol>
      )}
    </section>
  );
}
