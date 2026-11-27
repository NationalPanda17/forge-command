// Decisions, research, key staff, the Committee and objectives.
import { validate, type SimAction } from '../sim/actions';
import { recommend } from '../sim/automation';
import { FACTIONS, FACTION_IDS, OBJECTIVES, RESEARCH, RESEARCH_IDS, STAFF_ROLES, STAFF_ROLE_IDS, hasResearch } from '../sim/strategy';
import type { SimState } from '../sim/types';
import { Bar, Btn, Chip, ChoiceCard, ChoiceOption } from '../ui/kit';
import { Icon } from '../ui/icons';
import { decisionIcon } from '../ui/kinds';
import { money, textToneFor } from '../ui/format';
import { dateLabel } from './useSim';
import { tr } from '../sim/worldgen';

export function Decisions({ state, act }: { state: SimState; act: (a: SimAction) => void }) {
  if (!state.strategy.decisions.length) return null;
  return (
    <div className="space-y-2">
      {state.strategy.decisions.map((d) => {
        const r = recommend(state, d);
        const o = d.options.find((x) => x.id === r.option);
        return (
          <ChoiceCard key={d.id} eyebrow="The Board · decide by month end" icon={<Icon name={decisionIcon(d.kind)} size={16} />} title={tr(d.title)}>
            <p className="mt-1 text-ops-text">{tr(d.body)}</p>
            {o && (
              <p className="mt-1 text-[10px] text-ops-cyan">
                Advisor: {tr(o.label)}. <span className="text-ops-dim">{r.why}</span>
              </p>
            )}
            <div className="mt-2 space-y-1">
              {d.options.map((x) => (
                <ChoiceOption
                  key={x.id}
                  label={tr(x.label)}
                  detail={tr(x.detail)}
                  advised={x.id === r.option}
                  marks={x.id === d.fallback ? <span className="text-[10px] text-ops-dim">default at month end</span> : undefined}
                  onClick={() => act({ type: 'decide', decision: d.id, option: x.id })}
                />
              ))}
            </div>
          </ChoiceCard>
        );
      })}
    </div>
  );
}

export default function StrategyPanel({ state, act }: { state: SimState; act: (a: SimAction) => void }) {
  const st = state.strategy;
  return (
    <div className="space-y-4 p-3 text-[11px]">
      <Decisions state={state} act={act} />

      <section>
        <h3 className="label mb-1">Engineering program</h3>
        {st.research.active ? (
          <div className="mb-2">
            <div className="flex justify-between">
              <span className="text-white">{RESEARCH[st.research.active.id].name}</span>
              <span className="text-ops-cyan">{Math.ceil(st.research.active.days)} days left</span>
            </div>
            <Bar ratio={1 - st.research.active.days / Math.max(1, st.research.active.total ?? RESEARCH[st.research.active.id].days)} tone="bg-ops-cyan" className="mt-1" />
          </div>
        ) : (
          <p className="mb-2 text-ops-amber">Your engineers are idle.</p>
        )}
        <ul className="space-y-1">
          {RESEARCH_IDS.map((id) => {
            const r = RESEARCH[id];
            const done = hasResearch(state, id);
            return (
              <li key={id} className="flex flex-wrap items-start justify-between gap-1 border-b border-ops-line/40 pb-1">
                <span className="min-w-0 flex-1">
                  <span className={done ? 'text-ops-green' : 'text-white'}>{r.name}</span>
                  <span className="block text-[10px] text-ops-dim">{r.effect}</span>
                </span>
                {done ? (
                  <Chip tone="border-ops-green/60 text-ops-green">done</Chip>
                ) : (
                  // A button that spends money is amber and names the spend (19.3).
                  <span className="flex flex-col items-end gap-0.5">
                    <Btn kind="warn" why={st.research.active?.id === id ? 'In progress' : validate(state, { type: 'research', research: id })} onClick={() => act({ type: 'research', research: id })}>
                      Research · {money(r.cost)} · {Math.round(r.days / 30)} mo
                    </Btn>
                    {st.research.active?.id !== id && /Not enough money/.test(validate(state, { type: 'research', research: id }) ?? '') && (
                      <span className="text-[10px] text-ops-amber">Needs {money(r.cost - state.treasury)} more</span>
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <div className="label mb-1">Key staff</div>
        <ul className="space-y-2">
          {STAFF_ROLE_IDS.map((role) => {
            const p = st.staff[role];
            const cands = st.candidates.filter((c) => c.role === role);
            return (
              <li key={role}>
                <div className="flex justify-between gap-2">
                  <span className="text-ops-dim">{STAFF_ROLES[role].title}</span>
                  {p ? (
                    <span>
                      <span className="text-white">{p.name}</span> <span className="text-ops-green">· {STAFF_ROLES[role].effect(p.skill)}</span>{' '}
                      <button
                        type="button"
                        className="text-ops-red hover:underline disabled:opacity-50"
                        disabled={!!validate(state, { type: 'fireStaff', role })}
                        title={validate(state, { type: 'fireStaff', role }) ?? `Severance: three months' salary, ${money(p.salary * 3)}`}
                        onClick={() => act({ type: 'fireStaff', role })}
                      >
                        let go · {money(p.salary * 3)}
                      </button>
                    </span>
                  ) : (
                    <span className="text-ops-amber">vacant</span>
                  )}
                </div>
                {cands.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-1 pl-3 text-[10px]">
                    <span>
                      {c.name} · skill {c.skill} · {money(c.salary)}/mo
                    </span>
                    <Btn
                      why={validate(state, {
                        type: 'hireStaff',
                        candidate: c.id,
                      })}
                      onClick={() => act({ type: 'hireStaff', candidate: c.id })}
                      title="A signing bonus of three months' salary"
                    >
                      Hire · {money(c.salary * 3)}
                    </Btn>
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <div className="label mb-1">The Defence Committee</div>
        {FACTION_IDS.map((id) => (
          <div key={id} className="mb-1">
            <div className="flex justify-between">
              <span>{FACTIONS[id].name}</span>
              <span className={textToneFor(st.factions[id] / 70)}>{Math.round(st.factions[id])}</span>
            </div>
            <Bar ratio={st.factions[id] / 100} />
            <div className="text-[10px] text-ops-dim">{FACTIONS[id].wants}</div>
          </div>
        ))}
      </section>

      {state.promises.length > 0 && (
        <section>
          <div className="label mb-1">Promises to the Committee</div>
          <ul className="space-y-1">
            {state.promises.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0">
                  <span className="text-white">{p.text}</span>
                  <span className="block text-[10px] text-ops-dim">Made to the {FACTIONS[p.faction].name.toLowerCase()}.</span>
                </span>
                <span className="shrink-0 text-ops-dim">by {dateLabel(p.due)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="label mb-1">Objectives</div>
        {st.objectives.map((o) => {
          const def = OBJECTIVES.find((x) => x.id === o.id)!;
          return (
            <div key={o.id} className="mb-1 flex items-baseline justify-between gap-2">
              <span>
                <span className={o.status === 'failed' ? 'text-ops-dim line-through' : 'text-white'}>{def.title}</span>
                <span className="block text-[10px] text-ops-dim">
                  {def.text} Reward ${def.money}M.
                </span>
              </span>
              {o.status === 'open' ? (
                <span className="text-ops-dim">by {dateLabel(def.by)}</span>
              ) : (
                <Chip tone={o.status === 'done' ? 'border-ops-green/60 text-ops-green' : 'border-ops-red/60 text-ops-red'}>{o.status}</Chip>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
