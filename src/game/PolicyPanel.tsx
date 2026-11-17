// Choices that last: multi-year procurement programmes and standing policies.
import { useState } from 'react';
import { validate, type SimAction } from '../sim/actions';
import { MAX_MISSES, MAX_POLICIES, POLICIES, POLICY_IDS, REVOKE_COST, programmeTerms } from '../sim/commitments';
import type { SimState } from '../sim/types';
import { FINISHED, MATERIALS, type LineId } from '../sim/world';
import { Bar, Btn, Segmented } from '../ui/kit';
import { money } from '../ui/format';
import { dateLabel } from './useSim';

export default function PolicyPanel({ state, act }: { state: SimState; act: (a: SimAction) => void }) {
  const lines = (FINISHED as LineId[]).filter((l) => state.lines[l].unlocked);
  const [line, setLine] = useState<LineId>(lines[0]);
  const [years, setYears] = useState<'3' | '5'>('3');
  const y = Number(years) as 3 | 5;
  const terms = programmeTerms(state, line, y);
  const sign: SimAction = { type: 'programme', line, years: y };
  return (
    <div className="space-y-5 p-3 text-[11px]">
      <section>
        <h3 className="label mb-1">Multi-year programmes</h3>
        <p className="mb-2 text-ops-dim">
          Promise the Committee a steady monthly output of one round, and it adds money to your budget every month you deliver. Miss {MAX_MISSES} months and the programme is cancelled, with a loss of confidence. Keep the promise to the end for a bonus.
        </p>
        {state.programmes.length > 0 && (
          <ul className="mb-3 space-y-2">
            {state.programmes.map((p) => {
              const made = state.month.made[p.line] ?? 0;
              return (
                <li key={p.id}>
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="text-white">{MATERIALS[p.line].name}</span>
                    <span className="text-ops-dim">
                      {p.perMonth} a month for {money(p.funding)} · until {dateLabel(p.endDay)} · {p.misses} of {MAX_MISSES} misses
                    </span>
                  </div>
                  <Bar ratio={made / Math.max(1, p.perMonth)} tone={made >= p.perMonth * 0.9 ? 'bg-ops-green' : 'bg-ops-amber'} title={`${Math.round(made)} made so far this month`} />
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <select className="input py-0.5" value={line} onChange={(e) => setLine(e.target.value as LineId)} aria-label="Round">
            {lines.map((l) => (
              <option key={l} value={l}>
                {MATERIALS[l].name}
              </option>
            ))}
          </select>
          <Segmented label="Programme length" value={years} onChange={setYears} options={[{ id: '3', label: '3 years' }, { id: '5', label: '5 years' }]} />
          <Btn kind="primary" why={validate(state, sign)} onClick={() => act(sign)}>
            Sign
          </Btn>
        </div>
        <p className="mt-1 text-ops-dim">
          Terms: {terms.perMonth} {MATERIALS[line].name} a month, for {money(terms.funding)} a month while you deliver.
        </p>
      </section>

      <section>
        <h3 className="label mb-1">
          Standing policies · {state.policies.length} of {MAX_POLICIES}
        </h3>
        <p className="mb-2 text-ops-dim">Each changes the game for as long as it stands. Revoking one costs {REVOKE_COST} confidence.</p>
        <ul className="space-y-2">
          {POLICY_IDS.map((id) => {
            const p = POLICIES[id];
            const on = state.policies.includes(id);
            const a: SimAction = on ? { type: 'revokePolicy', policy: id } : { type: 'adoptPolicy', policy: id };
            return (
              <li key={id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded border p-2 ${on ? 'border-ops-cyan/60 bg-ops-cyan/5' : 'border-ops-line/60'}`}>
                <span className="min-w-0">
                  <span className={on ? 'text-ops-cyan' : 'text-white'}>{p.name}</span>
                  <span className="block text-[10px] text-ops-green">+ {p.pro}</span>
                  <span className="block text-[10px] text-ops-amber">− {p.con}</span>
                </span>
                <Btn kind={on ? 'warn' : 'default'} why={validate(state, a)} onClick={() => act(a)}>
                  {on ? 'Revoke' : 'Adopt'}
                </Btn>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
