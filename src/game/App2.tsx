// Forge Command 2.0: title screen and game.
import { useRef, useState } from 'react';
import { migrate, newSim } from '../sim/setup';
import { openCampaign } from '../sim/tick';
import type { Difficulty, SimState } from '../sim/types';
import { seedFrom } from '../sim/rng';
import { Btn } from '../ui/kit';
import Shell from './Shell';
import { dateLabel, loadSim, saveSim } from './useSim';

const DIFF: Record<Difficulty, string> = {
  easy: 'More money and a forgiving Committee.',
  normal: 'The intended experience.',
  hard: 'Tight money, and every mistake shows.',
};

function Title({ onStart, autoPause, setAutoPause }: { onStart: (s: SimState) => void; autoPause: boolean; setAutoPause: (v: boolean) => void }) {
  const saved = loadSim();
  const file = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [years, setYears] = useState(4);
  const [seed, setSeed] = useState(() => String(Math.floor(Math.random() * 1e6)));
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <header className="pt-8 text-center">
        <h1 className="font-sans text-5xl font-bold tracking-[0.25em] text-ops-amber">FORGE COMMAND</h1>
        <p className="mt-2 text-[13px] text-ops-dim">From the mine to the launcher to the burning pit. Run a nation's munitions industry, in real time.</p>
      </header>
      {saved && !saved.over && (
        <div className="flex justify-center">
          <Btn kind="primary" className="px-4 py-2 text-[12px]" onClick={() => onStart(saved)}>
            Continue · {dateLabel(saved.day)}
          </Btn>
        </div>
      )}
      <section className="panel">
        <div className="panel-title">New campaign</div>
        <div className="space-y-4 p-4 text-[12px]">
          <p className="text-ops-text">
            You are Director of the Munitions Production Board of the Commonwealth of Aldmere. Sixty-five sites, from iron pits and gas wells to arsenals, depots,
            air-defense batteries and a demilitarization yard, all tied together by rail, road, sea and air. Keep the rounds flowing.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <div className="label mb-1">Difficulty</div>
              <div className="flex gap-1">
                {(Object.keys(DIFF) as Difficulty[]).map((d) => (
                  <Btn key={d} pressed={difficulty === d} onClick={() => setDifficulty(d)}>
                    {d}
                  </Btn>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-ops-dim">{DIFF[difficulty]}</p>
            </div>
            <div>
              <div className="label mb-1">Term</div>
              <div className="flex gap-1">
                {[2, 4, 6].map((y) => (
                  <Btn key={y} pressed={years === y} onClick={() => setYears(y)}>
                    {y} years
                  </Btn>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="label mb-1 block">Seed</span>
              <input className="input w-full" value={seed} onChange={(e) => setSeed(e.target.value)} />
            </label>
          </div>
          <div className="flex justify-end">
            <Btn kind="primary" className="px-5 py-2 text-[13px]" onClick={() => onStart(openCampaign(newSim({ seed: seedFrom(seed || '0'), difficulty, months: years * 12 })))}>
              Take command →
            </Btn>
          </div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-title">Saves and settings</div>
        <div className="flex flex-wrap items-center gap-2 p-4 text-[12px]">
          {saved && (
            <Btn
              onClick={() => {
                const url = URL.createObjectURL(new Blob([JSON.stringify(saved)], { type: 'application/json' }));
                const a = document.createElement('a');
                a.href = url;
                a.download = `forge-command-day-${saved.day}.json`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              Export current save
            </Btn>
          )}
          <Btn onClick={() => file.current?.click()}>Import a save…</Btn>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const s = JSON.parse(await f.text()) as SimState;
                if (s?.version === 1 && s.sites && s.strategy) onStart(migrate(s));
                else setErr('That file is not a Forge Command 2.0 save.');
              } catch {
                setErr('That file could not be read.');
              }
              e.target.value = '';
            }}
          />
          <label className="ml-auto flex items-center gap-2">
            <input type="checkbox" checked={autoPause} onChange={(e) => setAutoPause(e.target.checked)} />
            Pause on important events
          </label>
          {err && <p className="w-full text-ops-red">{err}</p>}
        </div>
      </section>

      <p className="text-center text-[10px] text-ops-dim">A game. Designations and makers are real; every site, company, nation and person is fictional.</p>
    </div>
  );
}

export default function App2() {
  const [game, setGame] = useState<SimState | null>(null);
  const [autoPause, setAutoPause] = useState(true);
  if (!game) return <Title onStart={setGame} autoPause={autoPause} setAutoPause={setAutoPause} />;
  return (
    <Shell
      initial={game}
      autoPause={autoPause}
      onMenu={(s) => {
        saveSim(s);
        setGame(null);
      }}
    />
  );
}
