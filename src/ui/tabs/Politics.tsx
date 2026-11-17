import {
  EXPORT_POLICIES,
  FACTIONS,
  FACTION_IDS,
  QUIRKS,
  STAFF_ROLES,
  STAFF_ROLE_IDS,
  factionAverage,
  hireCost,
  validateAction,
  type Action,
  type ExportPolicy,
  type GameState,
} from '../../engine';
import { Bar, Btn, COLORS, LineChart, Panel, Segmented } from '../kit';
import { money, shortMonth, textToneFor } from '../format';

export default function Politics({ state, act }: { state: GameState; act: (a: Action) => void }) {
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_440px]">
      <div className="min-w-0 space-y-3">
        <Panel title="Key staff" right="hire the people who run the Board with you">
          <div className="grid gap-3 p-3 md:grid-cols-2">
            {STAFF_ROLE_IDS.map((role) => {
              const p = state.staff[role];
              const cands = state.candidates.filter((c) => c.role === role);
              return (
                <article key={role} className="rounded border border-ops-line/70 p-3 text-[11px]">
                  <div className="label">{STAFF_ROLES[role].title}</div>
                  {p ? (
                    <div className="mt-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-sans text-[15px] font-semibold text-white">{p.name}</span>
                        <span className="text-ops-dim">{p.tenure} mo in post</span>
                      </div>
                      <div className="text-ops-green">{STAFF_ROLES[role].effect(p.skill)}</div>
                      <div className="text-ops-dim">
                        Skill {p.skill}/3 · {QUIRKS[p.quirk].name}: {QUIRKS[p.quirk].blurb} · {money(p.salary)}/mo
                      </div>
                      <Btn className="mt-1" kind="danger" why={validateAction(state, { type: 'fireStaff', role })} onClick={() => act({ type: 'fireStaff', role })}>
                        Let go · severance {money(hireCost(p))}
                      </Btn>
                    </div>
                  ) : (
                    <p className="mt-1 text-ops-amber">Vacant.</p>
                  )}
                  {cands.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-ops-line/50 pt-2">
                      <div className="text-[10px] text-ops-dim">Candidates (new names every six months)</div>
                      {cands.map((c) => (
                        <div key={c.id} className="flex flex-wrap items-center justify-between gap-1">
                          <span>
                            <span className="text-white">{c.name}</span> <span className="text-ops-dim">· skill {c.skill} · {QUIRKS[c.quirk].name} · {money(c.salary)}/mo</span>
                          </span>
                          <Btn why={validateAction(state, { type: 'hireStaff', candidate: c.id })} title={STAFF_ROLES[role].effect(c.skill)} onClick={() => act({ type: 'hireStaff', candidate: c.id })}>
                            Hire · {money(hireCost(c))}
                          </Btn>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="space-y-3">
        <Panel title="The Defence Committee" right={`factions average ${Math.round(factionAverage(state))}`}>
          <ul className="divide-y divide-ops-line/50">
            {FACTION_IDS.map((id) => {
              const v = state.factions[id];
              return (
                <li key={id} className="px-3 py-2 text-[11px]">
                  <div className="flex items-baseline justify-between">
                    <span className="font-sans text-[13px] font-semibold text-white">{FACTIONS[id].name}</span>
                    <span className={textToneFor(v / 70)}>{Math.round(v)}</span>
                  </div>
                  <Bar ratio={v / 100} className="my-1" />
                  <div className="text-[10px] text-ops-dim">
                    {FACTIONS[id].wants} Weight {Math.round(FACTIONS[id].weight * 100)}%.
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-ops-line/50 p-3 text-[10px] text-ops-dim">
            Above 55 on average, the factions lift the Committee's confidence in you each month. Below it, they drag it down.
          </p>
        </Panel>

        <Panel title="Public support" right={`${Math.round(state.publicSupport)}`}>
          <div className="p-3 text-[11px]">
            <LineChart min={0} max={100} xLabels={state.history.map((h) => shortMonth(h.month))} series={[{ label: 'Confidence', values: state.history.map((h) => h.confidence), color: COLORS.amber }]} />
            <p className="mt-1 text-[10px] text-ops-dim">The public rallies in a crisis, and turns on you when threats get through. Their mood moves the hawks.</p>
          </div>
        </Panel>

        <Panel title="Export policy">
          <div className="space-y-2 p-3 text-[11px]">
            <Segmented<ExportPolicy>
              label="Export policy"
              value={state.exportPolicy}
              onChange={(policy) => act({ type: 'setExportPolicy', policy })}
              options={(Object.keys(EXPORT_POLICIES) as ExportPolicy[]).map((p) => ({ id: p, label: EXPORT_POLICIES[p].name }))}
            />
            <p className="text-ops-dim">{EXPORT_POLICIES[state.exportPolicy].blurb}</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
