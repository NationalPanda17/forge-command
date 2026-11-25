// Doctrine: five forks in how you run the industry. Pick one answer to each, for good; later forks open as you settle
// earlier ones.
import { validate, type SimAction } from '../sim/actions';
import { FORKS, TIER, TIER_NEEDS, chosenCount, doctrineCost, doctrineDef, forkOpen, industryName, type ForkDef, type Side } from '../sim/doctrine';
import type { SimState } from '../sim/types';
import { Btn } from '../ui/kit';
import { money } from '../ui/format';

function Option({ state, act, fork, side }: { state: SimState; act: (a: SimAction) => void; fork: ForkDef; side: Side }) {
  const d = fork[side];
  const chosen = state.doctrine.chosen[fork.id];
  const active = state.doctrine.active;
  const mine = chosen === side || (active?.fork === fork.id && active.side === side);
  const closed = (chosen && chosen !== side) || (active?.fork === fork.id && active.side !== side);
  const a: SimAction = { type: 'adoptDoctrine', fork: fork.id, side };
  return (
    <div className={`min-w-0 rounded border p-2 ${mine ? 'border-ops-cyan/60 bg-ops-cyan/5' : closed ? 'border-ops-line/40 opacity-50' : 'border-ops-line/60'}`}>
      <div className={`font-sans text-[13px] font-semibold ${mine ? 'text-ops-cyan' : 'text-white'}`}>{d.name}</div>
      <p className="text-ops-green">+ {d.pro}</p>
      <p className="text-ops-amber">− {d.con}</p>
      {!chosen && !(active?.fork === fork.id) && (
        <div className="mt-1 flex justify-end">
          <Btn kind="primary" why={validate(state, a)} onClick={() => act(a)}>
            Adopt · {money(doctrineCost(state, fork.id))}
          </Btn>
        </div>
      )}
      {mine && chosen && <p className="mt-1 text-[10px] text-ops-cyan">In force</p>}
      {closed && <p className="mt-1 text-[10px] text-ops-dim">Closed for good</p>}
    </div>
  );
}

export default function DoctrinePanel({ state, act }: { state: SimState; act: (a: SimAction) => void }) {
  const active = state.doctrine.active;
  return (
    <div className="space-y-4 p-3 text-[11px]">
      <p className="text-ops-text">
        How do you want to run the industry? Each fork has two answers, and the one you choose closes the other for good. A doctrine takes money and a few months to bed in, one at a time. Settle one to open the second tier, two to open the third.
      </p>
      <p className="text-ops-dim">
        You are building <span className="text-white">{industryName(state)}</span> · {chosenCount(state)} of {FORKS.length} doctrines settled.
      </p>
      {active && (
        <div className="rounded border border-ops-cyan/50 p-2">
          <div className="flex flex-wrap justify-between gap-2">
            <span className="text-ops-cyan">Bedding in: {doctrineDef(active.fork, active.side).name}</span>
            <span className="text-ops-dim">{Math.ceil(active.days / 30)} month{Math.ceil(active.days / 30) === 1 ? '' : 's'} left</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded bg-ops-line/60">
            <div className="h-full bg-ops-cyan" style={{ width: `${Math.round((1 - active.days / active.total) * 100)}%` }} />
          </div>
        </div>
      )}
      {FORKS.map((f) => {
        const open = forkOpen(state, f.id);
        return (
          <section key={f.id} className={open ? '' : 'opacity-60'}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="label">
                {f.title} · tier {f.tier}
              </h3>
              <span className="text-[10px] text-ops-dim">{open ? `${Math.round(TIER[f.tier].days / 30)} months to bed in` : `Opens once ${TIER_NEEDS[f.tier]} doctrine${TIER_NEEDS[f.tier] > 1 ? 's are' : ' is'} settled`}</span>
            </div>
            <p className="mb-1 text-ops-text">{f.question}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Option state={state} act={act} fork={f} side="a" />
              <Option state={state} act={act} fork={f} side="b" />
            </div>
          </section>
        );
      })}
    </div>
  );
}
