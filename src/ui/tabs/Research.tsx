import { LINES, LINE_IDS, RESEARCH, RESEARCH_IDS, establishCost, hasResearch, validateAction, type Action, type GameState, type ResearchId } from '../../engine';
import { Bar, Btn, Chip, Panel } from '../kit';
import { money } from '../format';

const GROUPS: { title: string; blurb: string; ids: ResearchId[] }[] = [
  { title: 'New products', blurb: 'License and set up new production lines.', ids: ['apkws', 'coyote', 'javelin'] },
  { title: 'Design changes', blurb: 'Redesign rounds to need fewer scarce parts.', ids: ['galliumLight', 'commonMotors', 'imFill', 'seekerDTC', 'smartFuzes'] },
  { title: 'Process', blurb: 'Build faster, test faster, scrap less.', ids: ['digitalTest', 'leanAssembly', 'yieldAnalytics', 'lightsOut', 'rapidQual'] },
  { title: 'Defense', blurb: 'Change the fight itself.', ids: ['hpm'] },
];

export default function Research({ state, act }: { state: GameState; act: (a: Action) => void }) {
  const active = state.research.active;
  const done = state.research.done.length;
  return (
    <div className="space-y-3">
      <Panel title="Engineering program" right={`${done} of ${RESEARCH_IDS.length} projects complete`}>
        <div className="p-3 text-[12px]">
          {active ? (
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-sans text-[16px] font-semibold text-white">{RESEARCH[active.id].name}</span>
                <span className="text-ops-cyan">
                  {active.monthsLeft} month{active.monthsLeft === 1 ? '' : 's'} left
                </span>
              </div>
              <Bar ratio={1 - active.monthsLeft / RESEARCH[active.id].months} tone="bg-ops-cyan" className="my-1.5" />
              <p className="text-[11px] text-ops-dim">{RESEARCH[active.id].effect}</p>
            </div>
          ) : (
            <p className="text-ops-amber">Your engineers are idle. Pick a project below. One runs at a time, paid up front.</p>
          )}
        </div>
      </Panel>
      {GROUPS.map((g) => (
        <Panel key={g.title} title={g.title} right={g.blurb}>
          <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
            {g.ids.map((id) => {
              const r = RESEARCH[id];
              const isDone = hasResearch(state, id);
              const running = active?.id === id;
              const action: Action = { type: 'startResearch', research: id };
              const why = validateAction(state, action);
              const line = LINE_IDS.find((l) => LINES[l].research === id);
              const setUp: Action | null = line ? { type: 'establishLine', line } : null;
              return (
                <article key={id} className={`rounded border p-3 text-[11px] ${isDone ? 'border-ops-green/50' : running ? 'border-ops-cyan/60' : 'border-ops-line/70'}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-sans text-[15px] font-semibold text-white">{r.name}</h3>
                    {isDone ? <Chip tone="border-ops-green/60 text-ops-green">done</Chip> : running ? <Chip tone="border-ops-cyan/60 text-ops-cyan">in progress</Chip> : null}
                  </div>
                  <p className="mt-1 text-ops-text">{r.effect}</p>
                  <p className="mt-1 text-[10px] text-ops-dim">{r.blurb}</p>
                  {r.requires.length > 0 && <p className="mt-1 text-[10px] text-ops-dim">Needs: {r.requires.map((q) => RESEARCH[q].name).join(', ')}</p>}
                  {!isDone && !running && (
                    <Btn className="mt-2" kind="primary" why={why} onClick={() => act(action)}>
                      Start · {money(r.cost)} · {r.months} mo
                    </Btn>
                  )}
                  {isDone && setUp && line && state.lines[line].tranches.length === 0 && (
                    <Btn className="mt-2" kind="primary" why={validateAction(state, setUp)} onClick={() => act(setUp)}>
                      Set up {LINES[line].name} line · {money(establishCost(line))}
                    </Btn>
                  )}
                </article>
              );
            })}
          </div>
        </Panel>
      ))}
    </div>
  );
}
