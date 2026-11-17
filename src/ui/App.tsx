import { useEffect, useState } from 'react';
import { DIFFICULTY, SCENARIOS, THEATERS, applyAction, endTurn, readiness, type Action, type GameState } from '../engine';
import { Btn } from './kit';
import { money, monthLabel, pct, textToneFor } from './format';
import { DebriefModal, ReviewModal } from './Modals';
import Title from './Title';
import { applyUpdate, onUpdateReady, updateReady } from './pwa';
import Tutorial, { STEPS } from './Tutorial';
import { SLOTS, autosave, describeSave, exportSave, loadPrefs, loadSlot, saveSlot, savePrefs, type Prefs } from './saves';
import Guide from './tabs/Guide';
import Intel from './tabs/Intel';
import Ledger from './tabs/Ledger';
import Overview from './tabs/Overview';
import Partners from './tabs/Partners';
import Plants from './tabs/Plants';
import Research from './tabs/Research';
import Supply from './tabs/Supply';
import Workforce from './tabs/Workforce';
import World from './tabs/World';

export type TabId = 'overview' | 'map' | 'plants' | 'workforce' | 'supply' | 'research' | 'partners' | 'intel' | 'ledger' | 'guide';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'map', label: 'Map' },
  { id: 'plants', label: 'Plants' },
  { id: 'workforce', label: 'Workforce' },
  { id: 'supply', label: 'Supply chain' },
  { id: 'research', label: 'Research' },
  { id: 'partners', label: 'Partners' },
  { id: 'intel', label: 'Intel' },
  { id: 'ledger', label: 'Ledger' },
  { id: 'guide', label: 'Guide' },
];

function SaveMenu({ state, onClose, onLoad }: { state: GameState; onClose: () => void; onLoad: (s: GameState) => void }) {
  const [, force] = useState(0);
  return (
    <div className="panel absolute right-0 top-full z-30 mt-1 w-80 p-3 text-[11px] shadow-2xl">
      <div className="mb-2 flex justify-between">
        <span className="label">Saves</span>
        <button type="button" onClick={onClose} className="text-ops-dim hover:text-white" aria-label="Close">
          ✕
        </button>
      </div>
      <p className="mb-2 text-ops-dim">The game autosaves after every change. Slots keep a copy you can return to.</p>
      {SLOTS.map((n) => {
        const s = loadSlot(n);
        return (
          <div key={n} className="mb-1 flex items-center gap-1">
            <span className="min-w-0 flex-1 truncate">
              Slot {n}: <span className="text-ops-dim">{describeSave(s)}</span>
            </span>
            <Btn
              onClick={() => {
                saveSlot(n, state);
                force((x) => x + 1);
              }}
            >
              Save
            </Btn>
            <Btn why={s ? null : 'Empty'} onClick={() => s && onLoad(s)}>
              Load
            </Btn>
          </div>
        );
      })}
      <Btn className="mt-2 w-full" onClick={() => exportSave(state)}>
        Export to file
      </Btn>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [tab, setTab] = useState<TabId>('overview');
  const [title, setTitle] = useState(true);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [tutorial, setTutorial] = useState<number | null>(null);
  const [savesOpen, setSavesOpen] = useState(false);
  const [seenReviews, setSeenReviews] = useState(0);
  const [debriefOpen, setDebriefOpen] = useState(true);
  const [update, setUpdate] = useState(updateReady);

  useEffect(() => onUpdateReady(() => setUpdate(true)), []);

  useEffect(() => {
    if (state) autosave(state);
  }, [state]);

  useEffect(() => {
    document.documentElement.classList.toggle('hc', prefs.highContrast);
    savePrefs(prefs);
  }, [prefs]);

  const act = (a: Action) => setState((s) => (s ? applyAction(s, a) : s));

  const start = (s: GameState, fresh: boolean) => {
    setState(s);
    setTitle(false);
    setTab('overview');
    setSeenReviews(s.reviews.length);
    setDebriefOpen(true);
    if (fresh && !prefs.tutorialDone) setTutorial(0);
  };

  const finishTutorial = () => {
    setTutorial(null);
    setPrefs((p) => ({ ...p, tutorialDone: true }));
    setTab('overview');
  };

  const endMonth = () => {
    if (!state || state.over) return;
    setState(endTurn(state));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (title || !state) return <Title onStart={start} onCancel={state ? () => setTitle(false) : undefined} />;

  const ready = readiness(state);
  const crisis = state.crisis;
  const review = state.reviews.length > seenReviews ? state.reviews[state.reviews.length - 1] : null;

  return (
    <div className="mx-auto max-w-[1600px] space-y-3 p-3 pb-40">
      <header className="panel z-20 px-3 py-2 lg:sticky lg:top-2">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <button type="button" className="font-sans text-lg font-bold tracking-[0.2em] text-ops-amber" onClick={() => setTitle(true)} title="Main menu">
            FORGE COMMAND
          </button>
          <div>
            <div className="label">Month</div>
            <div className="text-white">
              {monthLabel(state.month)} <span className="text-ops-dim">({Math.min(state.month + 1, state.months)}/{state.months})</span>
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
          <div title="The Defence Committee's confidence in you. At zero, you are dismissed.">
            <div className="label">Confidence</div>
            <div className={textToneFor(state.confidence / 70)}>{Math.round(state.confidence)}</div>
          </div>
          <div className="hidden sm:block">
            <div className="label">{SCENARIOS[state.scenario].name}</div>
            <div className="text-ops-dim">{DIFFICULTY[state.difficulty].label}</div>
          </div>
          <div className="relative ml-auto flex flex-wrap gap-2">
            <Btn onClick={() => setPrefs((p) => ({ ...p, highContrast: !p.highContrast }))} pressed={prefs.highContrast} title="High-contrast theme">
              Contrast
            </Btn>
            <Btn onClick={() => setSavesOpen((o) => !o)}>Saves</Btn>
            {savesOpen && (
              <SaveMenu
                state={state}
                onClose={() => setSavesOpen(false)}
                onLoad={(s) => {
                  setSavesOpen(false);
                  start(s, false);
                }}
              />
            )}
            <Btn kind="primary" className="px-4 py-1.5 text-[12px]" why={state.over ? 'The campaign is over.' : null} onClick={endMonth}>
              End month →{state.decisions.length > 0 && <span className="ml-1 rounded bg-ops-amber px-1 text-[10px] text-ops-bg">{state.decisions.length}</span>}
            </Btn>
          </div>
        </div>
        <nav className="-mx-1 mt-2 flex gap-1 overflow-x-auto border-t border-ops-line/60 pt-2" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`whitespace-nowrap rounded px-3 py-1 font-sans text-[13px] font-semibold uppercase tracking-wider transition-colors ${
                tab === t.id ? 'bg-ops-cyan/15 text-ops-cyan' : 'text-ops-dim hover:text-ops-text'
              }`}
            >
              {t.label}
              {t.id === 'overview' && state.decisions.length > 0 && <span className="ml-1 text-ops-amber">●</span>}
              {t.id === 'research' && !state.research.active && <span className="ml-1 text-ops-amber" title="Engineers idle">●</span>}
              {t.id === 'partners' && state.tenders.length > 0 && <span className="ml-1 text-ops-dim">{state.tenders.length}</span>}
            </button>
          ))}
        </nav>
      </header>

      {update && (
        <div role="status" className="panel flex items-center justify-between gap-2 border-ops-cyan/60 px-4 py-2 text-[12px] text-ops-cyan">
          A new version of Forge Command is ready. Your game is saved.
          <Btn kind="primary" onClick={applyUpdate}>
            Reload
          </Btn>
        </div>
      )}

      {crisis && (
        <div role="status" className={`panel px-4 py-2 text-[12px] ${crisis.phase === 'active' ? 'border-ops-red/60 text-ops-red' : 'border-ops-amber/60 text-ops-amber'}`}>
          {crisis.phase === 'warning'
            ? `Intel warning: the ${crisis.name} may begin in about ${crisis.monthsLeft} month${crisis.monthsLeft === 1 ? '' : 's'}.`
            : `Crisis: the ${crisis.name} (${THEATERS[crisis.theater].name}). ${crisis.blurb}`}
        </div>
      )}

      <main>
        {tab === 'overview' && <Overview state={state} act={act} />}
        {tab === 'map' && <World state={state} act={act} />}
        {tab === 'plants' && <Plants state={state} act={act} />}
        {tab === 'workforce' && <Workforce state={state} act={act} />}
        {tab === 'supply' && <Supply state={state} act={act} />}
        {tab === 'research' && <Research state={state} act={act} />}
        {tab === 'partners' && <Partners state={state} act={act} />}
        {tab === 'intel' && <Intel state={state} act={act} />}
        {tab === 'ledger' && <Ledger state={state} act={act} />}
        {tab === 'guide' && <Guide />}
      </main>

      <footer className="pt-2 text-center text-[10px] text-ops-dim">
        A game. Designations and makers are real; campuses, suppliers, nations, partners and crises are fictional. Rates are scaled from public figures or made up.
        {' · '}
        <button type="button" className="underline hover:text-ops-text" onClick={() => setTutorial(0)}>
          Replay tutorial
        </button>
      </footer>

      {tutorial !== null && (
        <Tutorial
          step={tutorial}
          onStep={(n) => {
            setTutorial(n);
            setTab(STEPS[n]?.tab ?? 'overview');
          }}
          onDone={finishTutorial}
        />
      )}
      {review && <ReviewModal review={review} onClose={() => setSeenReviews(state.reviews.length)} />}
      {!review && state.over && debriefOpen && <DebriefModal state={state} onClose={() => setDebriefOpen(false)} onNew={() => setTitle(true)} />}
    </div>
  );
}
