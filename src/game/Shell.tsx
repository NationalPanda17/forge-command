// The 2.0 game screen: the map at the centre, a command panel beside it, and the clock on top.
import { useMemo, useRef, useState } from 'react';
import { monthOfYear, seasonOf } from '../sim/living';
import MarketsPanel from './MarketsPanel';
import BuildPanel from './BuildPanel';
import NewsPanel from './NewsPanel';
import SandboxPanel from './SandboxPanel';
import IntelPanel from './IntelPanel';
import IndustryPanel from './IndustryPanel';
import StoryPanel, { Briefing } from './StoryPanel';
import { KeyboardHelp } from './Options';
import { saveSlot } from './saves';
import { isFounded } from '../sim/industry';
import PolicyPanel from './PolicyPanel';
import AdvisorCard from './AdvisorCard';
import { Explain } from '../ui/Explain';
import { confidenceWhy, readinessWhy, seasonWhy, treasuryWhy } from './explain';
import { sfx, setSoundEnabled } from '../ui/sound';
import { loadAudioPrefs, music, saveAudioPrefs, type AudioPrefs } from '../ui/music';
import type { MapNetwork, MapRipple } from '../ui/map/MapView';
import PlanPanel from './PlanPanel';
import TermReport from './TermReport';
import { STEPS, TUTORIAL_DONE, TutorialCard } from './Tutorial';
import { checkAchievements, type AchievementDef } from './achievements';
import MapView, { DEFAULT_LAYERS, MapLayerToggles, MapLegend, type MapLayers, type MapMarker, type MapShipment } from '../ui/map/MapView';
import { readiness } from '../sim/selectors';
import type { SimState } from '../sim/types';
import { MATERIALS, RECIPES, ROUTES, ROUTE_KEY, SITE_BY_ID, type MaterialId } from '../sim/world';
import { Btn } from '../ui/kit';
import { money, pct, textToneFor } from '../ui/format';
import MaterialPanel from './MaterialPanel';
import { Feed, FightPanel, LogisticsPanel, MoneyPanel, StockpilePanel } from './OpsPanels';
import SitePanel from './SitePanel';
import StrategyPanel from './StrategyPanel';
import { GuidePanel, WatchPanel } from './WatchGuide';
import { useEffect } from 'react';
import { dateLabel, useSim, type Speed } from './useSim';

type PanelId = 'watch' | 'site' | 'plan' | 'material' | 'markets' | 'build' | 'stockpile' | 'logistics' | 'fight' | 'strategy' | 'money' | 'news' | 'feed' | 'guide' | 'sandbox' | 'intel' | 'policy' | 'industry' | 'story';
const PANELS: { id: PanelId; label: string }[] = [
  { id: 'watch', label: 'Watch' },
  { id: 'site', label: 'Site' },
  { id: 'plan', label: 'Plan' },
  { id: 'material', label: 'Materials' },
  { id: 'markets', label: 'Markets' },
  { id: 'build', label: 'Build' },
  { id: 'industry', label: 'Industry' },
  { id: 'intel', label: 'Intel' },
  { id: 'policy', label: 'Policy' },
  { id: 'stockpile', label: 'Stockpile' },
  { id: 'logistics', label: 'Logistics' },
  { id: 'fight', label: 'Fight' },
  { id: 'strategy', label: 'Board' },
  { id: 'money', label: 'Money' },
  { id: 'news', label: 'Courier' },
  { id: 'feed', label: 'Feed' },
  { id: 'guide', label: 'Guide' },
];
const SPEEDS: Speed[] = [0, 1, 2, 4, 8];

function markersFor(s: SimState, showPlots: boolean): Record<string, MapMarker> {
  const out: Record<string, MapMarker> = {};
  for (const site of Object.values(s.sites)) {
    const def = SITE_BY_ID[site.id];
    let tone: MapMarker['tone'] = 'ok';
    let badge: string | undefined;
    if (site.embargoDays > 0 || site.status !== 'active') tone = 'bad';
    else if (site.disruptionDays > 0) tone = 'warn';
    else if (site.processes.length && site.processes.every((p) => p.run === 'idle')) tone = 'idle';
    else if (site.processes.some((p) => p.lastLimit && !['capacity', 'demand', 'idle'].includes(p.lastLimit))) tone = 'warn';
    if (def.owner !== 'state' && !site.qualified && site.processes.length) badge = '?';
    const unserv = Object.values(site.unserviceable).reduce((a, q) => a + (q ?? 0), 0);
    if (unserv >= 1) badge = '!';
    if (def.kind === 'plot') {
      // Open plots show only while you are planning; a founded plant shows as what it now is.
      if (!isFounded(s, site.id)) {
        out[site.id] = { tone: 'idle', hidden: !showPlots };
        continue;
      }
      out[site.id] = { tone: site.status === 'building' ? 'idle' : tone, kind: site.plantKind, name: site.plantName };
      continue;
    }
    out[site.id] = { tone, badge, pulse: s.crisis?.phase === 'active' && def.region === s.crisis.region && (def.kind === 'adBase' || def.kind === 'airBase' || def.kind === 'artillery') };
  }
  return out;
}

export default function Shell({ initial, onMenu, autoPause }: { initial: SimState; onMenu: (s: SimState) => void; autoPause: boolean }) {
  const { state, speed, setSpeed, act, step, clock } = useSim(initial, autoPause);
  const [selected, setSelected] = useState<string | null>('corranWorks');
  const [material, setMaterial] = useState<MaterialId>('pac3');
  const [panel, setPanel] = useState<PanelId>('watch');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === ' ') {
        e.preventDefault();
        setSpeed(speed === 0 ? lastSpeed.current : 0);
      } else if (['1', '2', '3', '4'].includes(e.key)) setSpeed(([1, 2, 4, 8] as Speed[])[Number(e.key) - 1]);
      else if (e.key === '[' || e.key === ']') {
        const ids = tabsRef.current.map((t) => t.id);
        const i = ids.indexOf(panelRef.current);
        setPanel(ids[(i + (e.key === ']' ? 1 : ids.length - 1)) % ids.length]);
      } else if (e.key === '?') setHelp((h) => !h);
      else if (e.key === 'm' || e.key === 'M') document.querySelector<HTMLElement>('[role="region"][aria-label^="Map of"]')?.focus();
      else if (e.key === 'Escape') setHelp(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [speed, setSpeed]);
  const [layers, setLayers] = useState<MapLayers>(DEFAULT_LAYERS);
  const [help, setHelp] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const tabs = [...(state.story ? [{ id: 'story' as PanelId, label: 'Story' }] : []), ...(state.mode === 'sandbox' ? [{ id: 'sandbox' as PanelId, label: 'Sandbox' }] : []), ...PANELS];
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const panelRef = useRef(panel);
  panelRef.current = panel;
  // A chapter briefing stops the clock until it is read.
  useEffect(() => {
    if (state.story?.briefing !== null && state.story?.briefing !== undefined) setSpeed(0);
  }, [state.story?.briefing, setSpeed]);
  const lastSpeed = useRef<Speed>(1);
  if (speed > 0) lastSpeed.current = speed;

  // Tutorial: each step finishes when the player has done it.
  useEffect(() => {
    const step = state.tutorial?.step;
    if (step === undefined || step >= STEPS.length) return;
    if (STEPS[step].done(state, { panel, selected, speed }, initial)) act({ type: 'tutorial', step: step + 1 });
  }, [state, panel, selected, speed, act, initial]);

  // Achievements, checked once a month and at the end.
  const [toast, setToast] = useState<AchievementDef[]>([]);
  useEffect(() => {
    const fresh = checkAchievements(state);
    if (!fresh.length) return;
    setToast(fresh);
    const t = setTimeout(() => setToast([]), 7000);
    return () => clearTimeout(t);
  }, [state.history.length, state.over, state.tutorial?.step]);

  const [reportClosed, setReportClosed] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);

  // Sound and music.
  const [audioPrefs, setAudioPrefs] = useState<AudioPrefs>(() => loadAudioPrefs());
  const setAudio = (p: Partial<AudioPrefs>) => {
    const next = { ...audioPrefs, ...p };
    setAudioPrefs(next);
    saveAudioPrefs(next);
  };
  useEffect(() => {
    setSoundEnabled(audioPrefs.sfx);
    music.setVolume(audioPrefs.volume);
    if (audioPrefs.music) music.start();
    else music.stop();
  }, [audioPrefs]);
  useEffect(() => () => music.stop(), []);
  useEffect(() => music.setMood(state.crisis?.phase === 'active' ? 'tense' : 'calm'), [state.crisis?.phase]);
  useEffect(() => {
    if (state.alert) sfx.alert();
  }, [state.alert]);
  const months = useRef(state.history.length);
  useEffect(() => {
    if (state.history.length > months.current) sfx.month();
    months.current = state.history.length;
  }, [state.history.length]);
  useEffect(() => {
    if (toast.length) sfx.fanfare();
  }, [toast]);

  // The map: what is built or building, and brief rings where things just happened.
  const network: MapNetwork = useMemo(
    () => ({
      built: state.network.built,
      upgrades: state.network.upgrades,
      building: state.network.projects.filter((p) => p.kind === 'link').map((p) => p.target),
      upgrading: state.network.projects.filter((p) => p.kind === 'upgrade').map((p) => p.target),
    }),
    [state.network],
  );
  const ripples: MapRipple[] = useMemo(
    () =>
      state.feed
        .map((f, i) => ({ f, i }))
        .filter(({ f }) => f.site && f.day >= state.day - 1 && f.tone !== 'info')
        .slice(-12)
        .map(({ f, i }) => ({ key: `${f.day}-${i}-${f.site}`, site: f.site!, tone: f.tone })),
    [state.feed, state.day],
  );
  const lead = state.news.at(-1)?.headlines[0];
  const plansOn = panel === 'build' || panel === 'industry';
  const markers = useMemo(() => markersFor(state, plansOn), [state, plansOn]);
  const shipments: MapShipment[] = useMemo(
    () =>
      state.shipments.slice(-250).map((sh) => ({
        id: sh.id,
        path: sh.path,
        progress: Math.min(1, Math.max(0, (state.day - sh.depart) / Math.max(1, sh.arrive - sh.depart))),
        depart: sh.depart,
        arrive: sh.arrive,
        mode: sh.modes[0] ?? 'road',
      })),
    [state],
  );
  const routeUse = useMemo(() => Object.fromEntries(ROUTES.map((r) => [ROUTE_KEY(r.a, r.b), (state.routeLoad[ROUTE_KEY(r.a, r.b)] ?? 0) / r.cap])), [state]);
  const ready = readiness(state);
  const select = (id: string | null) => {
    setSelected(id);
    if (id) setPanel('site');
  };
  const showMaterial = (m: MaterialId) => {
    setMaterial(m);
    setPanel('material');
  };

  return (
    <div className="flex min-h-screen flex-col gap-2 p-2">
      <a href="#panels" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-ops-panel focus:px-2 focus:py-1">Skip to panels</a>
      <header className="fc-zoom panel flex flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2">
        <button type="button" className="font-sans text-lg font-bold tracking-[0.2em] text-ops-amber" onClick={() => onMenu(state)} title="Main menu">
          FORGE COMMAND
        </button>
        {state.mode === 'sandbox' && (
          <button type="button" onClick={() => setPanel('sandbox')} className="rounded border border-ops-amber/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ops-amber">
            Sandbox
          </button>
        )}
        <div>
          <div className="label">Date</div>
          <div className="text-white">{dateLabel(state.day)}</div>
        </div>
        <div>
          <div className="label">Season</div>
          <div className="text-white" title={`Prices are ${Math.round((state.priceIndex - 1) * 100)}% above the start of your term.`}>
            <Explain title="Season and prices" lines={() => seasonWhy(state)}>
              {seasonOf(state.day)[0].toUpperCase() + seasonOf(state.day).slice(1)} <span className="text-ops-dim">· prices +{Math.round((state.priceIndex - 1) * 100)}%</span>
            </Explain>
          </div>
        </div>
        <div>
          <div className="label">Treasury</div>
          <div className={state.treasury < 0 ? 'text-ops-red' : 'text-white'}>
            <Explain title="Treasury" lines={() => treasuryWhy(state)}>
              {money(state.treasury)}
            </Explain>
          </div>
        </div>
        <div>
          <div className="label">Readiness</div>
          <div className={textToneFor(ready)}>
            <Explain title="Readiness" lines={() => readinessWhy(state)}>
              {pct(ready)}
            </Explain>
          </div>
        </div>
        <div>
          <div className="label">Confidence</div>
          <div className={textToneFor(state.confidence / 70)}>
            <Explain title="Confidence" lines={() => confidenceWhy(state)}>
              {Math.round(state.confidence)}
            </Explain>
          </div>
        </div>
        {state.crisis && (
          <div className={state.crisis.phase === 'active' ? 'text-ops-red' : 'text-ops-amber'}>
            <div className="label">{state.crisis.phase === 'active' ? 'Crisis' : 'Warning'}</div>
            <div className="max-w-[220px] truncate">{state.crisis.name}</div>
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1" role="group" aria-label="Game speed">
          {SPEEDS.map((sp) => (
            <Btn key={sp} pressed={speed === sp} onClick={() => setSpeed(sp)} title={sp === 0 ? 'Pause (space)' : `${sp} day${sp > 1 ? 's' : ''} a second`}>
              {sp === 0 ? '❚❚' : `${sp}×`}
            </Btn>
          ))}
          <Btn onClick={() => step(1)} why={speed !== 0 ? 'Pause first' : null} title="Advance one day">
            +1d
          </Btn>
          <Btn onClick={() => step(7)} why={speed !== 0 ? 'Pause first' : null} title="Advance one week">
            +7d
          </Btn>
          <Btn onClick={() => setSaving(saving === null ? `Day ${state.day + 1}` : null)} title="Save this game under a name" pressed={saving !== null}>
            Save
          </Btn>
          <Btn onClick={() => setHelp(true)} title="Keyboard shortcuts and display options (?)">
            ?
          </Btn>
          <Btn pressed={audioPrefs.sfx} onClick={() => setAudio({ sfx: !audioPrefs.sfx })} title="Sound effects">
            Sound
          </Btn>
          <Btn pressed={audioPrefs.music} onClick={() => setAudio({ music: !audioPrefs.music })} title="Generated background music">
            Music
          </Btn>
        </div>
      </header>

      {saving !== null && (
        <form
          className="fc-zoom panel flex flex-wrap items-center gap-2 px-3 py-2 text-[12px]"
          onSubmit={(e) => {
            e.preventDefault();
            const why = saveSlot(saving, state);
            setSaveNote(why ?? `Saved as “${saving.trim()}”.`);
            if (!why) setSaving(null);
          }}
        >
          <label className="flex items-center gap-2">
            <span className="label">Save as</span>
            <input className="input w-56" value={saving} onChange={(e) => setSaving(e.target.value)} autoFocus maxLength={40} />
          </label>
          <Btn kind="primary">Save</Btn>
          <Btn onClick={() => setSaving(null)}>Cancel</Btn>
        </form>
      )}
      {saveNote && (
        <div role="status" className="fc-zoom panel flex items-center justify-between gap-2 px-3 py-1 text-[12px] text-ops-green">
          <span>{saveNote}</span>
          <Btn onClick={() => setSaveNote(null)}>OK</Btn>
        </div>
      )}

      {lead && (
        <button type="button" onClick={() => setPanel('news')} className="fc-zoom panel flex min-w-0 items-center gap-2 px-3 py-1 text-left text-[11px] hover:border-ops-dim">
          <span className="label shrink-0">Courier</span>
          <span className="min-w-0 truncate text-ops-text">{lead.title}</span>
        </button>
      )}

      {toast.length > 0 && (
        <div role="status" className="panel flex flex-wrap items-center gap-2 border-ops-green/60 px-3 py-2 text-[12px] text-ops-green">
          <span>★ Achievement{toast.length > 1 ? 's' : ''}:</span>
          {toast.map((a) => (
            <span key={a.id} className="text-white">
              {a.title} <span className="text-ops-dim">· {a.text}</span>
            </span>
          ))}
        </div>
      )}

      {state.alert && speed === 0 && (
        <div role="status" className={`panel flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[12px] ${state.alert.tone === 'bad' ? 'border-ops-red/60 text-ops-red' : state.alert.tone === 'good' ? 'border-ops-green/60 text-ops-green' : 'border-ops-amber/60 text-ops-amber'}`}>
          <span>
            Paused: {state.alert.text}
          </span>
          <span className="flex gap-1">
            {state.alert.site && <Btn onClick={() => select(state.alert!.site!)}>Show</Btn>}
            <Btn kind="primary" onClick={() => setSpeed(lastSpeed.current)}>
              Resume
            </Btn>
          </span>
        </div>
      )}

      <div className="grid flex-1 gap-2 xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="panel min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ops-line/60 px-2 py-1">
            <MapLayerToggles layers={layers} onChange={setLayers} />
          </div>
          <MapView
            markers={markers}
            shipments={shipments}
            routeUse={routeUse}
            crisisRegion={state.crisis?.region ?? null}
            selected={selected}
            onSelect={select}
            layers={layers}
            height="calc(100vh - 220px)"
            network={network}
            showPlans={panel === 'build'}
            highlight={highlight}
            ripples={ripples}
            clock={clock}
            weather={!state.settings.seasons ? null : seasonOf(state.day) === 'winter' ? 'snow' : [2, 3].includes(monthOfYear(state.day)) ? 'flood' : [6, 7].includes(monthOfYear(state.day)) ? 'heat' : null}
          />
          <div className="border-t border-ops-line/60 px-2 py-1">
            <MapLegend />
          </div>
        </div>
        <aside id="panels" tabIndex={-1} className="fc-zoom panel flex min-h-[420px] min-w-0 flex-col overflow-hidden xl:max-h-[calc(100vh-150px)]">
          <nav className="flex gap-1 overflow-x-auto border-b border-ops-line/60 px-2 py-1" aria-label="Panels">
            {tabs.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`whitespace-nowrap rounded px-2 py-1 font-sans text-[12px] font-semibold uppercase tracking-wider ${panel === p.id ? 'bg-ops-cyan/15 text-ops-cyan' : 'text-ops-dim hover:text-ops-text'}`}
                aria-current={panel === p.id ? 'page' : undefined}
                onClick={() => setPanel(p.id)}
              >
                {p.label}
                {p.id === 'strategy' && state.strategy.decisions.length > 0 && <span className="ml-1 text-ops-amber">●</span>}
              </button>
            ))}
          </nav>
          {state.tutorial && state.tutorial.step < TUTORIAL_DONE && <TutorialCard state={state} onStep={(step) => act({ type: 'tutorial', step })} />}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {panel === 'plan' && <PlanPanel state={state} onMaterial={showMaterial} onSite={select} />}
            {panel === 'markets' && <MarketsPanel state={state} act={act} onSite={select} />}
            {panel === 'build' && <BuildPanel state={state} act={act} onHighlight={setHighlight} onSite={select} />}
            {panel === 'news' && <NewsPanel state={state} />}
            {panel === 'industry' && <IndustryPanel state={state} act={act} onSite={select} onHighlight={setHighlight} />}
            {panel === 'story' && <StoryPanel state={state} />}
            {panel === 'intel' && <IntelPanel state={state} act={act} />}
            {panel === 'policy' && <PolicyPanel state={state} act={act} />}
            {panel === 'sandbox' && state.mode === 'sandbox' && <SandboxPanel state={state} act={act} selected={selected} />}
            {panel === 'site' && (selected ? <SitePanel state={state} siteId={selected} act={act} onMaterial={showMaterial} /> : <p className="p-3 text-[11px] text-ops-dim">Click any site on the map.</p>)}
            {panel === 'material' && <MaterialPanel state={state} material={material} onMaterial={showMaterial} onSite={select} />}
            {panel === 'stockpile' && <StockpilePanel state={state} act={act} onMaterial={showMaterial} />}
            {panel === 'logistics' && <LogisticsPanel state={state} act={act} onSite={select} />}
            {panel === 'fight' && <FightPanel state={state} act={act} />}
            {panel === 'strategy' && <StrategyPanel state={state} act={act} />}
            {panel === 'money' && <MoneyPanel state={state} />}
            {panel === 'feed' && <Feed state={state} onSite={select} />}
            {panel === 'watch' && (
              <>
                <AdvisorCard state={state} act={act} onPanel={(p) => setPanel(p === 'programmes' ? 'policy' : p === 'site' ? 'site' : p)} onSite={select} onMaterial={showMaterial} />
                <WatchPanel state={state} onSite={select} onMaterial={showMaterial} onPanel={(p) => setPanel(p)} />
              </>
            )}
            {panel === 'guide' && <GuidePanel />}
          </div>
        </aside>
      </div>
      <footer className="fc-zoom panel max-h-28 overflow-y-auto">
        <Feed state={state} onSite={select} limit={6} />
      </footer>
      <Briefing state={state} act={act} />
      {help && <KeyboardHelp onClose={() => setHelp(false)} />}
      {state.over && !reportClosed && (
        <TermReport
          state={state}
          onClose={() => setReportClosed(true)}
          onMenu={() => onMenu(state)}
          onSecondTerm={() => {
            act({ type: 'secondTerm' });
            setReportClosed(false);
          }}
        />
      )}
      <span className="hidden">{Object.keys(RECIPES).length + Object.keys(MATERIALS).length}</span>
    </div>
  );
}
