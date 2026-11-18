// Forge Command: title screen (campaign, sandbox, tutorial) and the game.
import { useRef, useState } from 'react';
import { SANDBOX_SETTINGS, SCENARIOS, migrate, newSim } from '../sim/setup';
import { loadScores } from './scores';
import { makeSpec } from '../sim/worldgen';
import { deleteSlot, listSlots, loadSlot } from './saves';
import { DisplayOptions } from './Options';
import { ACHIEVEMENTS, loadAchievements } from './achievements';
import { openCampaign } from '../sim/tick';
import type { Difficulty, ScenarioId, Settings, SimState } from '../sim/types';
import { seedFrom } from '../sim/rng';
import { Btn, NumberInput, Segmented } from '../ui/kit';
import Shell from './Shell';
import { dateLabel, loadSim, saveSim } from './useSim';

const DIFF: Record<Difficulty, string> = {
  easy: 'More money and a forgiving Committee.',
  normal: 'The intended experience.',
  hard: 'Tight money, and every mistake shows.',
};

type Mode = 'story' | 'campaign' | 'sandbox' | 'hotseat' | 'tutorial';

const MODES: { id: Mode; name: string; blurb: string }[] = [
  { id: 'story', name: 'Story', blurb: 'Four chapters, a year each, with the people around you and consequences that carry forward.' },
  { id: 'campaign', name: 'Campaign', blurb: 'A scored term as Director. The Committee judges you, and you can be dismissed.' },
  { id: 'sandbox', name: 'Sandbox', blurb: 'Free play. Set the rules, change them as you go, add money, start crises. No score.' },
  { id: 'hotseat', name: 'Two players', blurb: 'Hot-seat on one device: each runs half the country, sharing the money and the railways. Turns change every month.' },
  { id: 'tutorial', name: 'Tutorial', blurb: 'A guided first two years on Easy, with no crisis for the first year.' },
];

function Title({ onStart, autoPause, setAutoPause }: { onStart: (s: SimState) => void; autoPause: boolean; setAutoPause: (v: boolean) => void }) {
  const saved = loadSim();
  const file = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('campaign');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [years, setYears] = useState(4);
  const [scenario, setScenario] = useState<ScenarioId>('standard');
  const earned = loadAchievements();
  const [seed, setSeed] = useState(() => String(Math.floor(Math.random() * 1e6)));
  const [rules, setRules] = useState<Settings>(SANDBOX_SETTINGS);
  const [extra, setExtra] = useState({ treasury: 0, appropriation: 0 });
  const [mapKind, setMapKind] = useState<'classic' | 'new'>('new');
  const [names, setNames] = useState<[string, string]>(['Player 1', 'Player 2']);
  const world = mapKind === 'new' ? seedFrom(seed || '0') : null;
  const scores = loadScores().slice(0, 5);
  const [slots, setSlots] = useState(listSlots);
  const begin = () => {
    const seedNum = seedFrom(seed || '0');
    if (mode === 'tutorial') return onStart(openCampaign(newSim({ seed: seedNum, scenario: 'tutorial' })));
    if (mode === 'story') return onStart(openCampaign(newSim({ seed: seedNum, difficulty, story: true })));
    if (mode === 'hotseat') return onStart(openCampaign(newSim({ seed: seedNum, difficulty, scenario, months: years * 12, world, hotseat: names })));
    if (mode === 'sandbox') return onStart(openCampaign(newSim({ seed: seedNum, difficulty, scenario, months: years * 12, mode: 'sandbox', settings: rules, money: extra, world })));
    onStart(openCampaign(newSim({ seed: seedNum, difficulty, scenario, months: years * 12, world })));
  };
  const rule = (k: 'inflation' | 'seasons' | 'crises' | 'endless' | 'dismissal', label: string) => (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={rules[k]} onChange={(e) => setRules({ ...rules, [k]: e.target.checked })} />
      {label}
    </label>
  );
  const scenarioPicker = (
    <div>
      <div className="label mb-1">{mode === 'sandbox' ? 'Starting situation' : 'Scenario'}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(SCENARIOS) as ScenarioId[])
          .filter((id) => id !== 'tutorial')
          .map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={scenario === id}
              onClick={() => setScenario(id)}
              className={`rounded border p-2 text-left ${scenario === id ? 'border-ops-cyan bg-ops-cyan/10' : 'border-ops-line hover:border-ops-dim'}`}
            >
              <div className={`font-sans text-[14px] font-semibold ${scenario === id ? 'text-ops-cyan' : 'text-white'}`}>{SCENARIOS[id].name}</div>
              <div className="text-[11px] text-ops-dim">{SCENARIOS[id].blurb}</div>
            </button>
          ))}
      </div>
    </div>
  );
  return (
    <div className="fc-zoom mx-auto max-w-3xl space-y-4 p-4">
      <header className="pt-8 text-center">
        <h1 className="font-sans text-5xl font-bold tracking-[0.25em] text-ops-amber">FORGE COMMAND</h1>
        <p className="mt-2 text-balance text-[13px] text-ops-dim">From the mine to the launcher to the burning pit. Run a nation's munitions industry, in real time.</p>
      </header>
      {saved && !saved.over && (
        <div className="flex justify-center">
          <Btn kind="primary" className="px-4 py-2 text-[12px]" onClick={() => onStart(saved)}>
            Continue {saved.story ? 'story' : saved.mode === 'sandbox' ? 'sandbox' : 'campaign'} · {dateLabel(saved.day)}
          </Btn>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5" role="group" aria-label="Game mode">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={mode === m.id}
            onClick={() => setMode(m.id)}
            className={`panel flex flex-col justify-start p-3 text-left ${mode === m.id ? 'border-ops-amber bg-ops-amber/10' : 'hover:border-ops-dim'}`}
          >
            <div className={`font-sans text-[17px] font-bold tracking-wider ${mode === m.id ? 'text-ops-amber' : 'text-white'}`}>{m.name}</div>
            <div className="text-[11px] text-ops-dim">{m.blurb}</div>
          </button>
        ))}
      </div>

      <section className="panel">
        <div className="panel-title">{mode === 'story' ? 'The story' : mode === 'campaign' ? 'New campaign' : mode === 'sandbox' ? 'New sandbox' : mode === 'hotseat' ? 'Two players' : 'Tutorial'}</div>
        <div className="space-y-4 p-4 text-[12px]">
          {mode === 'story' ? (
            <>
              <p className="text-ops-text">
                Four years as Director, told in four chapters: inheriting a thin reserve, a rival that starts to move, a workforce that wants a fair deal, and a winter
                war in the north. Each chapter is briefed by someone you will come to know, sets three goals, and changes what comes next.
              </p>
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
            </>
          ) : mode === 'tutorial' ? (
            <p className="text-ops-text">{SCENARIOS.tutorial.blurb} A coach card walks you through the map, the plan, the markets and the Board, one step at a time.</p>
          ) : (
            <>
              <p className="text-ops-text">
                You are Director of the Munitions Production Board of the {world !== null ? makeSpec(world).title : 'Commonwealth of Aldmere'}. Sixty-five sites, from iron pits and gas wells to arsenals, depots,
                air-defense batteries and a demilitarization yard, all tied together by rail, road, sea and air. Keep the rounds flowing.
              </p>
              {mode === 'hotseat' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {(['Western Command: north, coast, isles and Corran', 'Eastern Command: the east and the heartland'] as const).map((label, i) => (
                    <label key={i} className="block">
                      <span className="label mb-1 block">{label}</span>
                      <input
                        className="input w-full"
                        value={names[i]}
                        maxLength={20}
                        onChange={(e) => setNames(i === 0 ? [e.target.value, names[1]] : [names[0], e.target.value])}
                      />
                    </label>
                  ))}
                </div>
              )}
              <div>
                <div className="label mb-1">Map</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Segmented<'classic' | 'new'>
                    label="Map"
                    value={mapKind}
                    onChange={setMapKind}
                    options={[
                      { id: 'new', label: 'A new country' },
                      { id: 'classic', label: 'Classic Aldmere' },
                    ]}
                  />
                  {world !== null && (
                    <Btn onClick={() => setSeed(String(Math.floor(Math.random() * 1e6)))} title="Draw another country">
                      Another
                    </Btn>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-ops-dim">
                  {world !== null ? (
                    <>
                      You will run the industry of the <span className="text-ops-text">{makeSpec(world).title}</span>: a coastline, mountains, cities, sites and names of its own, from seed {seed || '0'}.
                    </>
                  ) : (
                    'The hand-made Commonwealth of Aldmere, the same every time.'
                  )}
                </p>
              </div>
              {scenarioPicker}
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
                {(mode === 'campaign' || !rules.endless) && (
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
                )}
                <label className="block">
                  <span className="label mb-1 block">Seed</span>
                  <input className="input w-full" value={seed} onChange={(e) => setSeed(e.target.value)} />
                </label>
              </div>
              {mode === 'sandbox' && (
                <div className="grid gap-3 rounded border border-ops-line/60 p-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="label mb-1">Rules (you can change them while you play)</div>
                    {rule('inflation', 'Inflation')}
                    {rule('seasons', 'Seasons')}
                    {rule('crises', 'Crises')}
                    {rule('endless', 'No end date')}
                    {rule('dismissal', 'The Committee can dismiss you')}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="label mb-1">Disruptions and events</div>
                      <Segmented<string>
                        label="Disruptions and events"
                        value={String(rules.events)}
                        onChange={(v) => setRules({ ...rules, events: Number(v) })}
                        options={[
                          { id: '0', label: 'None' },
                          { id: '0.5', label: 'Rare' },
                          { id: '1', label: 'Normal' },
                          { id: '2', label: 'Often' },
                        ]}
                      />
                    </div>
                    <label className="flex flex-wrap items-center gap-2">
                      <span className="label">Extra starting money $M</span>
                      <NumberInput value={extra.treasury} onChange={(v) => setExtra({ ...extra, treasury: v })} step={100} label="Extra starting money" />
                    </label>
                    <label className="flex flex-wrap items-center gap-2">
                      <span className="label">Extra budget $M a month</span>
                      <NumberInput value={extra.appropriation} onChange={(v) => setExtra({ ...extra, appropriation: v })} step={10} label="Extra monthly budget" />
                    </label>
                  </div>
                </div>
              )}
            </>
          )}
          <div className="flex justify-end">
            <Btn kind="primary" className="px-5 py-2 text-[13px]" onClick={begin}>
              {mode === 'story' ? 'Begin the story →' : mode === 'campaign' ? 'Take command →' : mode === 'sandbox' ? 'Start sandbox →' : mode === 'hotseat' ? 'Start the game →' : 'Play the tutorial →'}
            </Btn>
          </div>
        </div>
      </section>
      {slots.length > 0 && (
        <section className="panel">
          <div className="panel-title">Named saves</div>
          <ul className="space-y-1 p-4 text-[12px]">
            {slots.map((x) => (
              <li key={x.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <span className="min-w-0 truncate">
                  <span className="text-white">{x.name}</span>{' '}
                  <span className="text-ops-dim">
                    · {x.story ? 'story' : x.mode === 'sandbox' ? 'sandbox' : SCENARIOS[x.scenario]?.name ?? x.scenario} · {dateLabel(x.day)} · saved {x.saved}
                  </span>
                </span>
                <span className="flex gap-1">
                  <Btn
                    kind="primary"
                    onClick={() => {
                      const s = loadSlot(x.name);
                      if (s) onStart(s);
                      else setErr('That save could not be read.');
                    }}
                  >
                    Load
                  </Btn>
                  <Btn
                    kind="danger"
                    onClick={() => {
                      deleteSlot(x.name);
                      setSlots(listSlots());
                    }}
                  >
                    Delete
                  </Btn>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <div className="panel-title">Display</div>
        <div className="p-4">
          <DisplayOptions />
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

      {scores.length > 0 && (
        <section className="panel">
          <div className="panel-title">Your best campaigns</div>
          <ol className="space-y-1 p-4 text-[11px]">
            {scores.map((e, i) => (
              <li key={e.key} className="grid grid-cols-[20px_minmax(0,1fr)_auto] gap-2">
                <span className="text-ops-dim">{i + 1}.</span>
                <span className="min-w-0 truncate text-ops-text">
                  {SCENARIOS[e.scenario]?.name ?? e.scenario} · {e.difficulty} <span className="text-ops-dim">· {e.date}</span>
                </span>
                <span className="text-white">
                  {e.grade} · {e.score}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="panel">
        <div className="panel-title">
          Achievements · {ACHIEVEMENTS.filter((a) => earned[a.id]).length} of {ACHIEVEMENTS.length}
        </div>
        <ul className="grid gap-x-4 gap-y-1 p-4 text-[11px] sm:grid-cols-2">
          {ACHIEVEMENTS.map((a) => (
            <li key={a.id} className={earned[a.id] ? 'text-ops-green' : 'text-ops-dim'}>
              {earned[a.id] ? '★' : '☆'} <span className={earned[a.id] ? 'text-white' : ''}>{a.title}</span> · {a.text}
            </li>
          ))}
        </ul>
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
