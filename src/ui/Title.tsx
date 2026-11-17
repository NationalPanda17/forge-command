import { useRef, useState } from 'react';
import { DIFFICULTY, SCENARIOS, newGame, seedFrom, type CustomRules, type Difficulty, type GameState, type Modifier, type ScenarioId } from '../engine';
import { ACHIEVEMENTS, loadAchievements } from './achievements';
import { Btn } from './kit';
import { SLOTS, describeSave, importSave, loadAutosave, loadSlot } from './saves';

export default function Title({ onStart, onCancel }: { onStart: (s: GameState, fresh: boolean) => void; onCancel?: () => void }) {
  const [scenario, setScenario] = useState<ScenarioId>('standard');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [months, setMonths] = useState(48);
  const [seed, setSeed] = useState(() => String(Math.floor(Math.random() * 1e6)));
  const [error, setError] = useState<string | null>(null);
  const [mods, setMods] = useState<Modifier[]>([]);
  const [sandbox, setSandbox] = useState(false);
  const [custom, setCustom] = useState<CustomRules>({ treasuryMult: 1, budgetMult: 1, pressureMult: 1, crisisMult: 1, eventMult: 1, reserveMonths: 3, allResearch: false });
  const got = loadAchievements();
  const toggle = (m: Modifier) => setMods((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m]));
  const startDaily = () => {
    const day = new Date().toISOString().slice(0, 10);
    const ids = Object.keys(SCENARIOS) as ScenarioId[];
    const sc = ids[seedFrom(day) % ids.length];
    onStart(newGame({ seed: seedFrom(`daily-${day}`), difficulty: 'normal', scenario: sc, months: 48, modifiers: ['ironman'] }), true);
  };
  const slider = (key: keyof Omit<CustomRules, 'allResearch'>, label: string, min: number, max: number, step: number, fmt: (v: number) => string) => (
    <label className="block text-[11px]">
      <span className="flex justify-between">
        <span className="text-ops-dim">{label}</span>
        <span className="text-white">{fmt(custom[key])}</span>
      </span>
      <input type="range" className="w-full accent-cyan-400" min={min} max={max} step={step} value={custom[key]} onChange={(e) => setCustom({ ...custom, [key]: Number(e.target.value) })} />
    </label>
  );
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
          <div>
            <div className="label mb-2">Challenge modifiers</div>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ['ironman', 'Ironman', 'One autosave. No loading slots, no going back.'],
                  ['austerity', 'Austerity', 'The budget is 20% smaller, every year.'],
                  ['embargoWorld', 'Embargo world', 'Export bans three times as often; suppliers stumble more.'],
                  ['endless', 'Endless', 'No end date. How long can you last?'],
                ] as [Modifier, string, string][]
              ).map(([m, name, tip]) => (
                <Btn key={m} pressed={mods.includes(m)} title={tip} onClick={() => toggle(m)}>
                  {name}
                </Btn>
              ))}
            </div>
          </div>
          <div>
            <button type="button" className="label hover:text-ops-text" aria-expanded={sandbox} onClick={() => setSandbox((x) => !x)}>
              {sandbox ? '▾' : '▸'} Sandbox: custom rules {sandbox ? '(on: achievements are off)' : ''}
            </button>
            {sandbox && (
              <div className="mt-2 grid gap-3 rounded border border-ops-line/60 p-3 sm:grid-cols-2 lg:grid-cols-3">
                {slider('treasuryMult', 'Starting treasury', 0.25, 4, 0.25, (v) => `×${v}`)}
                {slider('budgetMult', 'Monthly budget', 0.5, 2, 0.05, (v) => `×${v.toFixed(2)}`)}
                {slider('pressureMult', 'Threat pressure', 0.5, 2, 0.05, (v) => `×${v.toFixed(2)}`)}
                {slider('crisisMult', 'Crisis frequency', 0, 3, 0.25, (v) => `×${v}`)}
                {slider('eventMult', 'Event frequency', 0, 3, 0.25, (v) => `×${v}`)}
                {slider('reserveMonths', 'Starting reserve', 0, 8, 1, (v) => `${v} months`)}
                <label className="flex items-center gap-2 text-[11px]">
                  <input type="checkbox" checked={custom.allResearch} onChange={(e) => setCustom({ ...custom, allResearch: e.target.checked })} />
                  <span className="text-ops-dim">All research done from the start</span>
                </label>
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Btn className="px-4 py-2 text-[12px]" title="Same world for everyone today. Normal difficulty, ironman." onClick={startDaily}>
              Daily challenge
            </Btn>
            <Btn
              kind="primary"
              className="px-5 py-2 text-[13px]"
              onClick={() => onStart(newGame({ seed: seedFrom(seed.trim() || '0'), difficulty, scenario, months, modifiers: mods, custom: sandbox ? custom : null }), true)}
            >
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

      <section className="panel">
        <div className="panel-title">
          <span>Achievements</span>
          <span className="label normal-case tracking-normal">
            {Object.keys(got).length} of {ACHIEVEMENTS.length}
          </span>
        </div>
        <ul className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {ACHIEVEMENTS.map((a) => (
            <li key={a.id} className={`rounded border p-2 text-[11px] ${got[a.id] ? 'border-ops-amber/60' : 'border-ops-line/50 opacity-60'}`}>
              <div className={got[a.id] ? 'text-ops-amber' : 'text-ops-text'}>
                {got[a.id] ? '★ ' : '☆ '}
                {a.name}
              </div>
              <div className="text-[10px] text-ops-dim">{a.text}</div>
            </li>
          ))}
        </ul>
      </section>

      <p className="pb-6 text-center text-[10px] text-ops-dim">
        A game. Designations and makers are real; campuses, suppliers, nations, partners and crises are fictional. Rates are scaled from public figures or made up.
      </p>
    </div>
  );
}
