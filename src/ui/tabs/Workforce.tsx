import { useState } from 'react';
import {
  CAMPUSES,
  CAMPUS_IDS,
  DIFFICULTY,
  HIRE_COST,
  LINES,
  campusCrewNeed,
  crewNeed,
  linesAt,
  staffing,
  validateAction,
  wageBill,
  type Action,
  type CampusId,
  type GameState,
  type WagePolicy,
} from '../../engine';
import { Bar, Btn, NumberInput, Panel, Segmented, Stat } from '../kit';
import { int, money, pct, textToneFor } from '../format';

function CampusCard({ state, campus, act }: { state: GameState; campus: CampusId; act: (a: Action) => void }) {
  const def = CAMPUSES[campus];
  const cs = state.campuses[campus];
  const need = campusCrewNeed(state, campus);
  const trainees = cs.trainees.reduce((a, t) => a + t.count, 0);
  const gap = Math.max(0, Math.ceil(need * 1.03 - cs.workers - trainees));
  const [hire, setHire] = useState(() => Math.min(gap || 25, cs.pool));
  const hireAction: Action = { type: 'hire', campus, count: hire };
  return (
    <Panel title={def.name} right={def.region}>
      <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-4">
        <Stat label="Skilled workers" value={int(cs.workers)} sub={`need ${int(need)} for this plan`} tone={textToneFor(cs.workers / Math.max(1, need))} />
        <Stat label="In training" value={int(trainees)} sub={cs.trainees.length ? cs.trainees.map((t) => `${t.count} in ${t.monthsLeft} mo`).join(', ') : `training takes ${DIFFICULTY[state.difficulty].trainingMonths} months`} />
        <Stat label="Hiring pool" value={int(cs.pool)} sub="local people ready to hire" />
        <Stat label="Payroll" value={`${money(wageBill(state, campus))}/mo`} sub={cs.wage === 'premium' ? 'premium wages' : 'standard wages'} />
      </div>
      <div className="grid gap-3 border-t border-ops-line/50 p-3 md:grid-cols-2">
        <div>
          <div className="flex items-baseline justify-between">
            <span className="label">Staffing</span>
            <span className={textToneFor(staffing(state, campus))}>{pct(staffing(state, campus))}</span>
          </div>
          <Bar ratio={staffing(state, campus)} className="mt-1" />
          <div className="mt-2 flex items-baseline justify-between">
            <span className="label">Morale</span>
            <span className={textToneFor(cs.morale / 70)}>{Math.round(cs.morale)}</span>
          </div>
          <Bar ratio={cs.morale / 100} className="mt-1" />
          <p className="mt-1 text-[10px] text-ops-dim">Surge shifts and understaffing wear morale down. Below about 30, strike votes start.</p>
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <NumberInput value={hire} onChange={setHire} label={`Workers to hire at ${def.name}`} />
            <Btn kind="primary" why={validateAction(state, hireAction)} onClick={() => act(hireAction)}>
              Hire · {money(hire * HIRE_COST)}
            </Btn>
            {gap > 0 && <span className="text-[10px] text-ops-amber">short {gap} for this plan</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="label">Wages</span>
            <Segmented<WagePolicy>
              label="Wage policy"
              value={cs.wage}
              onChange={(wage) => act({ type: 'setWage', campus, wage })}
              options={[
                { id: 'standard', label: 'Standard' },
                { id: 'premium', label: 'Premium +15%' },
              ]}
            />
          </div>
          <table className="w-full text-[11px]">
            <tbody>
              {linesAt(campus).map((id) => (
                <tr key={id}>
                  <td className="text-ops-dim">{LINES[id].name}</td>
                  <td className="text-right">{int(crewNeed(state, id))} crew</td>
                  <td className="text-right text-ops-dim">{state.lines[id].run}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  );
}

export default function Workforce({ state, act }: { state: GameState; act: (a: Action) => void }) {
  return (
    <div className="grid gap-3 xl:grid-cols-3">
      {CAMPUS_IDS.map((c) => (
        <CampusCard key={c} state={state} campus={c} act={act} />
      ))}
    </div>
  );
}
