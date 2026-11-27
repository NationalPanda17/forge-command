// Forge Command: title screen (campaign, sandbox, tutorial) and the game.
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, Insignia, type IconName } from '../ui/icons';
import Skyline from './Skyline';
import { lazyPart } from '../ui/lazyPart';
import { SANDBOX_SETTINGS, SCENARIOS, migrate, newSim } from '../sim/setup';
import { KIND_NAME, bests, loadScores, loadTotals } from './scores';
import { CustomEditor } from './CustomEditor';
import { DEFAULT_CUSTOM, type CustomScenario } from '../sim/custom';
import { PRESETS } from '../sim/automation';
import { makeSpec } from '../sim/worldgen';
import { featureLines, makeFeatures } from '../sim/features';
import { deleteSlot, listSlots, loadSlot } from './saves';
import { DisplayOptions } from './Options';
import { setTipsEnabled, tipsEnabled } from './Tips';
import { loadPauseRules, savePauseRules } from './events';
import { ACHIEVEMENTS, loadAchievements } from './achievements';
import { openCampaign } from '../sim/tick';
import type { Difficulty, ScenarioId, Settings, SimState } from '../sim/types';
import { seedFrom } from '../sim/rng';
import { Btn, NumberInput, Segmented } from '../ui/kit';
import { dateLabel, loadSim, saveSim } from './useSim';

// The game screen loads after the title screen is up, so the first thing a player sees appears quickly.
const Shell = lazyPart(() => import('./Shell'));

const DIFF: Record<Difficulty, string> = {
  easy: 'More money and a forgiving Committee.',
  normal: 'The intended experience.',
  hard: 'Tight money, and every mistake shows.',
};

type Mode = 'story' | 'campaign' | 'sandbox' | 'hotseat' | 'tutorial';
/** The title screen's pages: the main menu, and one page for each of its entries. */
type Screen = 'menu' | 'new' | 'load' | 'records' | 'settings';

const MODES: { id: Mode; name: string; blurb: string }[] = [
  { id: 'story', name: 'Story', blurb: 'Four chapters, a year each, with the people around you and consequences that carry forward.' },
  { id: 'campaign', name: 'Campaign', blurb: 'A scored term as Director. The Committee judges you, and you can be dismissed.' },
  { id: 'sandbox', name: 'Sandbox', blurb: 'Free play. Set the rules, change them as you go, add money, start crises. No score.' },
  { id: 'hotseat', name: 'Two players', blurb: 'Hot-seat on one device: each runs half the country, sharing the money and the railways. Turns change every month.' },
  { id: 'tutorial', name: 'Tutorial', blurb: 'A guided first two years on Easy, with no crisis for the first year.' },
];

function Title({ onStart, autoPause, setAutoPause }: { onStart: (s: SimState) => void; autoPause: boolean; setAutoPause: (v: boolean) => void }) {
  // Read once: a save is large, and loading it sets up its map.
  const [saved] = useState(loadSim);
  const file = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  // Someone who has never played here (no game, no score, no save) is pointed at the tutorial first.
  const [firstVisit] = useState(() => !saved && Object.keys(loadAchievements()).length === 0 && loadScores().length === 0 && listSlots().length === 0);
  const [mode, setMode] = useState<Mode>(firstVisit ? 'tutorial' : 'campaign');
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
  const allScores = loadScores();
  const best = bests(allScores);
  const totals = loadTotals();
  const [custom, setCustom] = useState<CustomScenario>(DEFAULT_CUSTOM);
  const mine = scenario === 'custom' ? custom : undefined;
  const [pilot, setPilot] = useState<keyof typeof PRESETS>('off');
  const [tips, setTips] = useState(() => tipsEnabled());
  const autos = PRESETS[pilot];
  const [slots, setSlots] = useState(listSlots);
  const [screen, setScreen] = useState<Screen>('menu');
  // The game is built for desktop and laptop screens.
  const [narrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1100);
  const screenHeading = useRef<HTMLHeadingElement>(null);
  // A new page moves the keyboard (and a screen reader) to its heading; back on the menu, to the page's own entry.
  const lastScreen = useRef<Screen>('menu');
  useEffect(() => {
    if (screen !== 'menu') {
      screenHeading.current?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    } else if (lastScreen.current !== 'menu') {
      document.querySelector<HTMLElement>(`[data-menu="${lastScreen.current}"]`)?.focus({ preventScroll: true });
    }
    lastScreen.current = screen;
  }, [screen]);
  const begin = () => {
    const seedNum = seedFrom(seed || '0');
    if (mode === 'tutorial') return onStart(openCampaign(newSim({ seed: seedNum, scenario: 'tutorial' })));
    if (mode === 'story') return onStart(openCampaign(newSim({ seed: seedNum, difficulty, story: true, automation: autos })));
    if (mode === 'hotseat') return onStart(openCampaign(newSim({ seed: seedNum, difficulty, scenario, months: years * 12, world, hotseat: names, custom: mine })));
    if (mode === 'sandbox') return onStart(openCampaign(newSim({ seed: seedNum, difficulty, scenario, months: years * 12, mode: 'sandbox', settings: rules, money: extra, world, custom: mine, automation: autos })));
    onStart(openCampaign(newSim({ seed: seedNum, difficulty, scenario, months: years * 12, world, custom: mine, automation: autos })));
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
      {scenario === 'custom' && (
        <div className="mt-2">
          <CustomEditor value={custom} onChange={setCustom} />
        </div>
      )}
    </div>
  );
  const kindOf = (s: SimState) => (s.story ? 'Story' : s.scenario === 'tutorial' ? 'Tutorial' : s.hotseat ? 'Two players' : s.mode === 'sandbox' ? 'Sandbox' : 'Campaign');
  const startTutorial = () => onStart(openCampaign(newSim({ seed: seedFrom(seed || '0'), scenario: 'tutorial' })));
  const earnedCount = ACHIEVEMENTS.filter((a) => earned[a.id]).length;

  const setup = (
    <>
      {firstVisit && (
        <div className="panel flex flex-wrap items-center justify-between gap-3 border-ops-cyan/50 px-4 py-3 text-[12px]">
          <p className="min-w-0 flex-1 text-ops-text">
            <span className="font-semibold text-white">New here?</span> The tutorial walks you through your first months, one step at a time. Most numbers explain
            themselves when you hover over or tap them.
          </p>
          <Btn kind={mode === 'tutorial' ? 'default' : 'primary'} onClick={() => setMode(mode === 'tutorial' ? 'campaign' : 'tutorial')}>
            {mode === 'tutorial' ? 'I have played before' : 'Show the tutorial'}
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
            className={`panel flex flex-col justify-start p-3 text-left transition-colors ${mode === m.id ? 'border-ops-amber bg-ops-amber/10' : 'hover:border-ops-dim'}`}
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
                <div className="seg">
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
                      {scenario !== 'tutorial' && featureLines(makeFeatures(world, scenario)).length > 0 && (
                        <span className="mt-1 block text-ops-amber">{featureLines(makeFeatures(world, scenario)).map((l) => l.short).join(' · ')}</span>
                      )}
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
                  <div className="seg">
                    {(Object.keys(DIFF) as Difficulty[]).map((d) => (
                      <Btn key={d} pressed={difficulty === d} onClick={() => setDifficulty(d)}>
                        {d}
                      </Btn>
                    ))}
                  </div>
                  <p className="mt-1 text-[10px] text-ops-dim">{DIFF[difficulty]}</p>
                </div>
                {(mode !== 'sandbox' || !rules.endless) && (
                  <div>
                    <div className="label mb-1">Term</div>
                    <div className="seg">
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
          {(mode === 'campaign' || mode === 'story' || mode === 'sandbox') && (
            <div>
              <div className="label mb-1">Autopilot</div>
              <Segmented<keyof typeof PRESETS>
                label="Autopilot"
                value={pilot}
                onChange={setPilot}
                options={[
                  { id: 'off', label: 'Off' },
                  { id: 'assist', label: 'Assist' },
                  { id: 'full', label: 'Full' },
                ]}
              />
              <p className="mt-1 text-[10px] text-ops-dim">
                {pilot === 'off'
                  ? 'You run everything. The advisor still suggests, and the Staff tab lets you hand things over later.'
                  : pilot === 'assist'
                    ? 'Your chief of staff answers decisions and hearings, and handles staffing, supply contracts and research. You run production, logistics and the rest.'
                    : 'Your chief of staff runs everything, week by week. Sit back, steer with the stance and the reserve, and step in when you like.'}
                {pilot !== 'off' && mode !== 'sandbox' ? ' The game is marked as assisted in your record book.' : ''}
              </p>
            </div>
          )}
          {mode !== 'tutorial' && (
            <div>
              <div className="label mb-1">Field notes</div>
              <Segmented<'on' | 'off'>
                label="Field notes"
                value={tips ? 'on' : 'off'}
                onChange={(v) => {
                  setTips(v === 'on');
                  setTipsEnabled(v === 'on');
                }}
                options={[
                  { id: 'on', label: 'On' },
                  { id: 'off', label: 'Off' },
                ]}
              />
              <p className="mt-1 text-[10px] text-ops-dim">A short tip the first time each system shows up: strikes, blackouts, audits, hackers, spies, the rival and more, with a button to the tab that handles it.</p>
            </div>
          )}
          <div className="flex justify-end border-t border-ops-line/60 pt-4">
            <Btn kind="primary" className="px-6 py-2.5 font-sans text-[15px] font-bold tracking-[0.15em]" onClick={begin}>
              {mode === 'story' ? 'Begin the story' : mode === 'campaign' ? 'Take command' : mode === 'sandbox' ? 'Start sandbox' : mode === 'hotseat' ? 'Start the game' : 'Play the tutorial'}
              <Icon name="continue" />
            </Btn>
          </div>
        </div>
      </section>
    </>
  );

  const loadScreen = (
    <>
      <section className="panel">
        <div className="panel-title">Named saves</div>
        {slots.length === 0 ? (
          <p className="p-4 text-[12px] text-ops-dim">No named saves yet. In a game, Save keeps a copy under a name of your choosing.</p>
        ) : (
          <ul className="divide-y divide-ops-line/50 text-[12px]">
            {slots.map((x) => (
              <li key={x.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate font-sans text-[15px] font-semibold text-white">{x.name}</span>
                  <span className="block truncate text-[11px] text-ops-dim">
                    {x.story ? 'Story' : x.mode === 'sandbox' ? 'Sandbox' : SCENARIOS[x.scenario]?.name ?? x.scenario} · {dateLabel(x.day)} · saved {x.saved}
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
        )}
      </section>
      <section className="panel">
        <div className="panel-title">Save files</div>
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
          {err && <p className="w-full text-ops-red">{err}</p>}
        </div>
      </section>
    </>
  );

  const records = (
    <>
      {allScores.length > 0 ? (
        <section className="panel">
          <div className="panel-title">Record book</div>
          <div className="space-y-4 p-4 text-[11px]">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Terms served', totals.terms],
                ['Terms completed', totals.completed],
                ['Dismissals', totals.dismissed],
                ['Longest career', `${totals.longestCareer} term${totals.longestCareer === 1 ? '' : 's'}`],
                ['Rounds made', totals.roundsMade.toLocaleString('en-US')],
                ['Rounds exported', totals.exported.toLocaleString('en-US')],
                ['Promises kept', totals.promisesKept],
                ['Best score', allScores[0]?.score ?? 0],
              ].map(([label, v]) => (
                <div key={label as string} className="min-w-0 rounded border border-ops-line/60 bg-ops-bg/40 px-3 py-2">
                  <div className="label truncate">{label}</div>
                  <div className="font-sans text-[20px] font-semibold text-white">{v}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="label mb-1">Best by game and difficulty</div>
              <ol className="space-y-1">
                {best.map(({ kind, difficulty, entry: e }) => (
                  <li key={`${kind}-${difficulty}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <span className="min-w-0 break-words text-ops-text">
                      {KIND_NAME[kind]} · {difficulty}
                      <span className="text-ops-dim">
                        {' '}
                        · {e.custom ?? SCENARIOS[e.scenario]?.name ?? e.scenario}
                        {e.world === 'generated' ? ' · new country' : ''}
                        {(e.term ?? 1) > 1 ? ` · term ${e.term}` : ''}
                        {e.assisted ? ' · assisted' : ''} · {e.date}
                      </span>
                    </span>
                    <span className="text-white">
                      {e.grade} · {e.score}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      ) : (
        <p className="panel p-4 text-[12px] text-ops-dim">Your record book fills in when you finish your first term.</p>
      )}
      <section className="panel">
        <div className="panel-title">
          <span>Achievements</span>
          <span className="label normal-case tracking-normal">
            {earnedCount} of {ACHIEVEMENTS.length}
          </span>
        </div>
        <div className="px-4 pt-3">
          <div className="bar">
            <span className="bg-ops-green" style={{ width: `${(earnedCount / ACHIEVEMENTS.length) * 100}%` }} />
          </div>
        </div>
        <ul className="grid gap-x-4 gap-y-1 p-4 text-[11px] sm:grid-cols-2">
          {ACHIEVEMENTS.map((a) => (
            <li key={a.id} className={earned[a.id] ? 'text-ops-green' : 'text-ops-dim'}>
              {earned[a.id] ? '★' : '☆'} <span className={earned[a.id] ? 'text-white' : ''}>{a.title}</span> · {a.text}
            </li>
          ))}
        </ul>
      </section>
    </>
  );

  const settings = (
    <>
      <section className="panel">
        <div className="panel-title">Display</div>
        <div className="p-4">
          <DisplayOptions />
        </div>
      </section>
      <section className="panel">
        <div className="panel-title">Play</div>
        <div className="p-4 text-[12px]">
          <label className="flex flex-wrap items-center gap-2">
            <input type="checkbox" checked={autoPause} onChange={(e) => setAutoPause(e.target.checked)} />
            Pause on important events
            <span className="text-[10px] text-ops-dim">(choose which in a game's Settings)</span>
          </label>
        </div>
      </section>
    </>
  );

  const SCREEN_TITLE: Record<Exclude<Screen, 'menu'>, string> = { new: 'New game', load: 'Load a game', records: 'Records', settings: 'Settings' };

  const footer = (
    <footer className="space-y-1 px-4 pb-4 text-center text-[10px] text-ops-dim">
      <p>A game. Designations and makers are real; every site, company, nation and person is fictional.</p>
      <p>
        Version {typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'} · No account and no tracking: your games are saved in this browser only. ·{' '}
        <a className="underline decoration-dotted underline-offset-2 hover:text-ops-text" href="https://github.com/NationalPanda17/forge-command/issues" target="_blank" rel="noreferrer">
          Report a problem
        </a>
      </p>
    </footer>
  );

  if (screen !== 'menu') {
    return (
      <div className="relative min-h-[100dvh]">
        <div className="fc-hero-glow pointer-events-none fixed inset-0" aria-hidden="true" />
        <div className="fc-zoom relative mx-auto max-w-3xl space-y-4 p-4" onKeyDown={(e) => e.key === 'Escape' && setScreen('menu')}>
          <header className="flex items-center gap-3 pt-4">
            <Btn onClick={() => setScreen('menu')} ariaLabel="Back to the main menu" title="Back (Esc)">
              <Icon name="back" />
              <span className="hidden sm:inline">Back</span>
            </Btn>
            <h1 ref={screenHeading} tabIndex={-1} className="font-sans text-2xl font-bold uppercase tracking-[0.2em] text-white">
              {SCREEN_TITLE[screen]}
            </h1>
            <span className="ml-auto hidden font-sans text-[13px] font-bold tracking-[0.3em] text-ops-amber/80 sm:block">FORGE COMMAND</span>
          </header>
          <div key={screen} className="fc-enter space-y-4">
            {screen === 'new' ? setup : screen === 'load' ? loadScreen : screen === 'records' ? records : settings}
          </div>
          {footer}
        </div>
      </div>
    );
  }

  const items: { id: string; icon: IconName; label: string; sub: string; primary?: boolean; run: () => void; title?: string }[] = [];
  if (saved && !saved.over) items.push({ id: 'continue', icon: 'continue', label: 'Continue', sub: `${kindOf(saved)} · ${dateLabel(saved.day)}`, primary: true, run: () => onStart(saved) });
  if (saved && saved.over)
    items.push({ id: 'report', icon: 'report', label: 'Last term report', sub: `${kindOf(saved)} · ${dateLabel(saved.day)}`, run: () => onStart(saved), title: 'Your grade, the term in charts, and a second term if the Committee offers one' });
  if (firstVisit) items.push({ id: 'tutorial', icon: 'play', label: 'Play the tutorial', sub: 'Two guided years on Easy. Best for a first game.', primary: !saved, run: startTutorial });
  items.push({ id: 'new', icon: 'plus', label: 'New game', sub: 'Story, campaign, sandbox or two players', primary: !saved && !firstVisit, run: () => setScreen('new') });
  items.push({ id: 'load', icon: 'folder', label: 'Load', sub: slots.length > 0 ? `${slots.length} named save${slots.length === 1 ? '' : 's'}, or import a file` : 'Import a save file', run: () => setScreen('load') });
  items.push({ id: 'records', icon: 'trophy', label: 'Records', sub: `Record book · ${earnedCount} of ${ACHIEVEMENTS.length} achievements`, run: () => setScreen('records') });
  items.push({ id: 'settings', icon: 'settings', label: 'Settings', sub: 'Display, text size, colours, pausing', run: () => setScreen('settings') });

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden">
      <Backdrop />
      <main className="fc-zoom relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <header className="fc-rise mb-8 text-center">
          <div className="mb-3 flex justify-center">
            <Insignia size={64} />
          </div>
          <p className="label mb-3 tracking-[0.4em] text-bronze">Munitions Production Board</p>
          <h1 className="font-sans text-[72px] font-bold leading-[0.9] tracking-[0.16em]">
            <span className="fc-title-word block">FORGE</span>
            <span className="fc-title-word block">COMMAND</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xs text-balance text-[12px] text-ops-dim">From the mine to the launcher to the burning pit. Run a nation's munitions industry, in real time.</p>
        </header>
        {narrow && (
          <p className="panel fc-rise mb-3 px-3 py-2 text-[12px] text-ops-amber" role="note">
            Forge Command is made for a computer screen at least 1100 pixels wide. On a smaller window the game scrolls sideways.
          </p>
        )}
        <nav aria-label="Main menu" className="space-y-2">
          {items.map((it, i) => (
            <button
              key={it.id}
              data-menu={it.id}
              type="button"
              className={`fc-menu-item fc-rise ${it.primary ? 'fc-menu-primary' : ''}`}
              style={{ animationDelay: `${120 + i * 50}ms` }}
              onClick={it.run}
              title={it.title}
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded border ${it.primary ? 'border-ops-amber/60 text-ops-amber' : 'border-ops-line text-ops-dim'}`}>
                <Icon name={it.icon} size={16} />
              </span>
              <span className="min-w-0">
                <span className={`block font-sans text-[18px] font-bold uppercase tracking-[0.12em] ${it.primary ? 'text-ops-amber' : 'text-white'}`}>{it.label}</span>
                <span className="block truncate text-[11px] text-ops-dim">{it.sub}</span>
              </span>
            </button>
          ))}
        </nav>
      </main>
      <div className="relative z-10">{footer}</div>
    </div>
  );
}

/** The title screen's backdrop: a forge glow from below, a faint grid of contours, and embers drifting up. */
function Backdrop() {
  const embers = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => {
        const r = (n: number) => {
          const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
          return x - Math.floor(x);
        };
        // Only in the margins beside the 28rem menu column, so an ember never crosses text.
        const x = r(1) * 0.9;
        const left = i % 2 ? `calc((100% - 30rem) / 2 * ${x})` : `calc(100% - (100% - 30rem) / 2 * ${x})`;
        return { left, duration: `${9 + r(2) * 10}s`, delay: `${-r(3) * 18}s`, dx: `${(r(4) - 0.5) * 40}px`, o: 0.35 + r(5) * 0.55, s: 2 + r(6) * 2 };
      }),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="fc-hero-glow absolute inset-0" />
      <svg className="absolute inset-0 h-full w-full opacity-[0.035]" preserveAspectRatio="xMidYMid slice" viewBox="0 0 800 600">
        <g fill="none" stroke="rgb(var(--ops-cyan))" strokeWidth="1">
          {[0, 1, 2, 3, 4, 5, 6].map((k) => (
            <ellipse key={k} cx="560" cy="380" rx={60 + k * 55} ry={34 + k * 32} transform={`rotate(-14 560 380)`} />
          ))}
          {[0, 1, 2, 3, 4].map((k) => (
            <ellipse key={`b${k}`} cx="170" cy="150" rx={40 + k * 45} ry={26 + k * 26} transform={`rotate(18 170 150)`} />
          ))}
        </g>
      </svg>
      <div className="absolute inset-x-0 bottom-16 top-0 hidden overflow-hidden sm:block">
      {embers.map((e, i) => (
        <span
          key={i}
          className="fc-ember"
          style={{ left: e.left, width: e.s, height: e.s, animationDuration: e.duration, animationDelay: e.delay, ['--dx' as string]: e.dx, ['--o' as string]: e.o }}
        />
      ))}
      </div>
      <Skyline className="absolute inset-x-0 bottom-0 h-[42vh] w-full" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ops-bg/90 to-transparent" />
    </div>
  );
}

export default function App2() {
  const [game, setGame] = useState<SimState | null>(null);
  // The master switch for the pause rules, which are kept in this browser; the rest are in Settings.
  const [autoPause, setAutoPauseState] = useState(() => loadPauseRules().on);
  // Settings in a game may have changed it.
  useEffect(() => {
    if (!game) setAutoPauseState(loadPauseRules().on);
  }, [game]);
  const setAutoPause = (on: boolean) => {
    setAutoPauseState(on);
    savePauseRules({ ...loadPauseRules(), on });
  };
  if (!game) return <Title onStart={setGame} autoPause={autoPause} setAutoPause={setAutoPause} />;
  return (
    <Suspense
      fallback={
        <div className="fc-boot" role="status">
          OPENING THE COMMAND CENTRE
          <i />
        </div>
      }
    >
    <Shell
      initial={game}
      onMenu={(s) => {
        saveSim(s);
        setGame(null);
      }}
    />
    </Suspense>
  );
}
