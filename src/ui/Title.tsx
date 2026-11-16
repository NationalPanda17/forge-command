import { useRef, useState } from 'react';
import { DIFFICULTY, SCENARIOS, newGame, seedFrom, type Difficulty, type GameState, type ScenarioId } from '../engine';
import { Btn } from './kit';
import { SLOTS, describeSave, importSave, loadAutosave, loadSlot } from './saves';

export default function Title({ onStart, onCancel }: { onStart: (s: GameState, fresh: boolean) => void; onCancel?: () => void }) {
  const [scenario, setScenario] = useState<ScenarioId>('standard');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [months, setMonths] = useState(48);
  const [seed, setSeed] = useState(() => String(Math.floor(Math.random() * 1e6)));
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const auto = loadAutosave();

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <header className="pt-6 text-center">
        <h1 className="font-sans text-4xl font-bold tracking-[0.25em] text-ops-amber sm:text-5xl">FORGE COMMAND</h1>
        <p className="mt-2 text-[13px] text-ops-dim">Munitions production, supply chains and hard choices, one month at a time.</p>
      </header>

      {(auto || onCancel) && (
        <div className="flex flex-wrap justify-center gap-2">
          {auto && !auto.over && (
            <Btn kind="primary" className="px-4 py-2 text-[12px]" onClick={() => onStart(auto, false)}>
              Continue · {describeSave(auto)}
            </Btn>
          )}
          {onCancel && (
            <Btn className="px-4 py-2 text-[12px]" onClick={onCancel}>
              Back to the game
            </Btn>
          )}
        </div>
      )}

      <section className="panel">
        <div className="panel-title">New campaign</div>
        <div className="space-y-4 p-4">
          <div>
            <div className="label mb-2">Scenario</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={scenario === id}
                  onClick={() => setScenario(id)}
                  className={`rounded border p-3 text-left transition-colors ${scenario === id ? 'border-ops-cyan bg-ops-cyan/10' : 'border-ops-line hover:border-ops-cyan/50'}`}
                >
                  <div className="font-sans text-[16px] font-semibold text-white">{SCENARIOS[id].name}</div>
                  <div className="text-[11px] leading-snug text-ops-dim">{SCENARIOS[id].blurb}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="label mb-2">Difficulty</div>
              <div className="grid grid-cols-3 gap-1">
                {(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => (
                  <Btn key={d} pressed={difficulty === d} onClick={() => setDifficulty(d)}>
                    {DIFFICULTY[d].label}
                  </Btn>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-snug text-ops-dim">{DIFFICULTY[difficulty].blurb}</p>
            </div>
            <div>
              <div className="label mb-2">Campaign length</div>
              <div className="grid grid-cols-3 gap-1">
                {[24, 48, 72].map((m) => (
                  <Btn key={m} pressed={months === m} onClick={() => setMonths(m)}>
                    {m / 12} years
                  </Btn>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="label mb-2 block">Seed (same seed, same world)</span>
              <input className="input w-full" value={seed} onChange={(e) => setSeed(e.target.value)} />
            </label>
          </div>
          <div className="flex justify-end">
            <Btn kind="primary" className="px-5 py-2 text-[13px]" onClick={() => onStart(newGame({ seed: seedFrom(seed.trim() || '0'), difficulty, scenario, months }), true)}>
              Take command →
            </Btn>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">Load</div>
        <div className="flex flex-wrap gap-2 p-4">
          {SLOTS.map((n) => {
            const s = loadSlot(n);
            return (
              <Btn key={n} why={s ? null : 'Empty slot'} onClick={() => s && onStart(s, false)}>
                Slot {n} · {describeSave(s)}
              </Btn>
            );
          })}
          <Btn onClick={() => file.current?.click()}>Import from file…</Btn>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const s = await importSave(f);
              if (s) onStart(s, false);
              else setError('That file is not a Forge Command save from this version.');
              e.target.value = '';
            }}
          />
          {error && <p className="w-full text-[11px] text-ops-red">{error}</p>}
        </div>
      </section>

      <p className="pb-6 text-center text-[10px] text-ops-dim">
        A game. Designations and makers are real; campuses, suppliers, nations, partners and crises are fictional. Rates are scaled from public figures or made up.
      </p>
    </div>
  );
}
