import { useEffect, useState } from 'react';
import {
  DIFFICULTY,
  LINES,
  LINE_IDS,
  applyAction,
  deserialize,
  endTurn,
  newGame,
  readiness,
  seedFrom,
  serialize,
  type Action,
  type Difficulty,
  type GameState,
} from '../engine';
import ComponentsPanel from './ComponentsPanel';
import LinesPanel from './LinesPanel';
import ReportPanel from './ReportPanel';
import ReservePanel from './ReservePanel';
import { money, monthLabel, pct, textToneFor } from './format';

const SAVE_KEY = 'forge-command-save-v1';

function loadSave(): GameState | null {
  try {
    return deserialize(localStorage.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}

function NewGame({ onStart, onCancel }: { onStart: (s: GameState) => void; onCancel?: () => void }) {
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [seed, setSeed] = useState(() => String(Math.floor(Math.random() * 1e6)));
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ops-bg/85 p-4">
      <div className="panel w-full max-w-md">
        <div className="panel-title">New campaign</div>
        <div className="space-y-4 p-4">
          <p className="text-[11px] leading-relaxed text-ops-dim">
            Four years, one month per turn. Keep the reserve stocked and the board solvent while fictional crises come and go.
          </p>
          <div>
            <div className="label mb-1">Difficulty</div>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => (
                <button key={d} className={`btn ${difficulty === d ? 'btn-active' : ''}`} onClick={() => setDifficulty(d)} aria-pressed={difficulty === d}>
                  {DIFFICULTY[d].label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-ops-dim">
              {difficulty === 'easy' && 'No component shortages, fast ramp-up, a bigger budget.'}
              {difficulty === 'normal' && 'Supply shocks on, normal ramp-up and budget.'}
              {difficulty === 'hard' && 'Tighter suppliers, slow ramp-up, more crises, a smaller budget.'}
            </p>
          </div>
          <label className="block">
            <span className="label mb-1 block">Seed (same seed, same campaign)</span>
            <input className="input w-full" value={seed} onChange={(e) => setSeed(e.target.value)} />
          </label>
          <div className="flex justify-end gap-2">
            {onCancel && (
              <button className="btn" onClick={onCancel}>
                Cancel
              </button>
            )}
            <button className="btn btn-primary" onClick={() => onStart(newGame({ seed: seedFrom(seed.trim() || '0'), difficulty }))}>
              Start
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GameOver({ state, onNew }: { state: GameState; onNew: () => void }) {
  const avg = state.history.reduce((a, h) => a + h.readiness, 0) / Math.max(1, state.history.length);
  const unmet = LINE_IDS.filter((id) => state.reserves[id].unmet > 0);
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ops-bg/85 p-4">
      <div className="panel w-full max-w-md">
        <div className="panel-title">Campaign complete</div>
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded border border-ops-line/60 p-2">
              <div className="label">Average readiness</div>
              <div className={`font-sans text-2xl font-semibold ${textToneFor(avg)}`}>{pct(avg)}</div>
            </div>
            <div className="rounded border border-ops-line/60 p-2">
              <div className="label">Treasury</div>
              <div className={`font-sans text-2xl font-semibold ${state.treasury < 0 ? 'text-ops-red' : 'text-white'}`}>{money(state.treasury)}</div>
            </div>
          </div>
          <p className="text-[11px] text-ops-dim">
            {unmet.length === 0
              ? 'Every request was met from the reserve.'
              : `Requests went unmet for ${unmet.map((id) => LINES[id].name).join(', ')}.`}
          </p>
          <div className="flex justify-end">
            <button className="btn btn-primary" onClick={onNew}>
              New campaign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState<GameState | null>(loadSave);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    try {
      if (state) localStorage.setItem(SAVE_KEY, serialize(state));
    } catch {
      /* storage may be unavailable; the game still plays */
    }
  }, [state]);

  const act = (a: Action) => setState((s) => (s ? applyAction(s, a) : s));
  const start = (s: GameState) => {
    setState(s);
    setPicking(false);
  };

  if (!state) return <NewGame onStart={start} />;

  const ready = readiness(state);
  const crisis = state.crisis;
  return (
    <div className="mx-auto max-w-[1600px] space-y-3 p-3">
      <header className="panel flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">
        <h1 className="font-sans text-xl font-bold tracking-[0.2em] text-ops-amber">FORGE COMMAND</h1>
        <div>
          <div className="label">Month</div>
          <div className="text-white">
            {monthLabel(state.month)} <span className="text-ops-dim">({state.month + 1}/{state.months})</span>
          </div>
        </div>
        <div>
          <div className="label">Treasury</div>
          <div className={state.treasury < 0 ? 'text-ops-red' : 'text-white'}>{money(state.treasury)}</div>
        </div>
        <div>
          <div className="label">Budget</div>
          <div className="text-white">{money(state.appropriation)}/mo</div>
        </div>
        <div>
          <div className="label">Readiness</div>
          <div className={textToneFor(ready)}>{pct(ready)}</div>
        </div>
        <div>
          <div className="label">Difficulty</div>
          <div className="text-white">{DIFFICULTY[state.difficulty].label}</div>
        </div>
        <div className="ml-auto flex gap-2">
          <button className="btn" onClick={() => setPicking(true)}>
            New campaign
          </button>
          <button className="btn btn-primary px-4 py-1.5 text-[12px]" disabled={state.over} onClick={() => setState(endTurn(state))}>
            End month →
          </button>
        </div>
      </header>

      {crisis && (
        <div
          role="status"
          className={`panel px-4 py-2 ${crisis.phase === 'active' ? 'border-ops-red/60 text-ops-red' : 'border-ops-amber/60 text-ops-amber'}`}
        >
          {crisis.phase === 'warning'
            ? `Intel warning: ${crisis.name}. Heavier ${crisis.family === 'air' ? 'interceptor' : 'land fires'} draw expected soon.`
            : `Crisis: ${crisis.name}. ${crisis.family === 'air' ? 'Interceptor' : 'Land fires'} draw ×${crisis.intensity.toFixed(1)}.`}
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-3">
          <LinesPanel state={state} act={act} />
          <ComponentsPanel state={state} act={act} />
        </div>
        <div className="space-y-3">
          <ReportPanel state={state} />
          <ReservePanel state={state} />
        </div>
      </div>

      <footer className="pb-2 text-center text-[10px] text-ops-dim">
        A game. Designations and makers are real; plants, suppliers, nations and crises are fictional. Rates are scaled from public figures.
      </footer>

      {picking && <NewGame onStart={start} onCancel={() => setPicking(false)} />}
      {state.over && !picking && <GameOver state={state} onNew={() => setPicking(true)} />}
    </div>
  );
}
