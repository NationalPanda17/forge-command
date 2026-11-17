import { DEPUTY, STORY, objectiveDef, type GameState } from '../engine';
import { Chip, Panel } from './kit';
import { monthLabel } from './format';

export default function Objectives({ state }: { state: GameState }) {
  if (!state.objectives.length) return null;
  return (
    <Panel title="Objectives" right={`${state.objectives.filter((o) => o.status === 'done').length} of ${state.objectives.length} done`} id="objectives">
      <ul className="divide-y divide-ops-line/50">
        {state.objectives.map((o) => {
          const def = objectiveDef(state, o.id);
          if (!def) return null;
          return (
            <li key={o.id} className="px-3 py-2 text-[11px]">
              <div className="flex items-baseline justify-between gap-2">
                <span className={`font-sans text-[13px] font-semibold ${o.status === 'failed' ? 'text-ops-dim line-through' : 'text-white'}`}>{def.title}</span>
                {o.status === 'done' ? (
                  <Chip tone="border-ops-green/60 text-ops-green">done</Chip>
                ) : o.status === 'failed' ? (
                  <Chip tone="border-ops-red/60 text-ops-red">missed</Chip>
                ) : (
                  <span className="text-ops-dim">by {monthLabel(def.deadline)}</span>
                )}
              </div>
              <div className="text-ops-text">{def.text}</div>
              <div className="text-[10px] text-ops-dim">Reward: {def.rewardText}</div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function Briefing({ state }: { state: GameState }) {
  return (
    <div className="space-y-2 p-3 text-[12px] leading-relaxed">
      <p className="text-ops-text">{STORY[state.scenario].briefing}</p>
      <p className="text-[11px] text-ops-dim">{DEPUTY}</p>
      <p className="text-[11px] text-ops-dim">
        Every month, fictional threats arrive and your rounds are drawn from the regional depots. Set the plan, then press <span className="text-ops-cyan">End month</span>.
      </p>
    </div>
  );
}
