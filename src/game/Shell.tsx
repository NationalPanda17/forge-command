// The 2.0 game screen: the map at the centre, a command panel beside it, and the clock on top.
import { useMemo, useRef, useState } from 'react';
import { seasonOf } from '../sim/living';
import MarketsPanel from './MarketsPanel';
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

type PanelId = 'watch' | 'site' | 'plan' | 'material' | 'markets' | 'stockpile' | 'logistics' | 'fight' | 'strategy' | 'money' | 'feed' | 'guide';
const PANELS: { id: PanelId; label: string }[] = [
  { id: 'watch', label: 'Watch' },
  { id: 'site', label: 'Site' },
  { id: 'plan', label: 'Plan' },
  { id: 'material', label: 'Materials' },
  { id: 'markets', label: 'Markets' },
  { id: 'stockpile', label: 'Stockpile' },
  { id: 'logistics', label: 'Logistics' },
  { id: 'fight', label: 'Fight' },
  { id: 'strategy', label: 'Board' },
  { id: 'money', label: 'Money' },
  { id: 'feed', label: 'Feed' },
  { id: 'guide', label: 'Guide' },
];
const SPEEDS: Speed[] = [0, 1, 2, 4, 8];

function markersFor(s: SimState): Record<string, MapMarker> {
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
    out[site.id] = { tone, badge, pulse: s.crisis?.phase === 'active' && def.region === s.crisis.region && (def.kind === 'adBase' || def.kind === 'airBase' || def.kind === 'artillery') };
  }
  return out;
}

export default function Shell({ initial, onMenu, autoPause }: { initial: SimState; onMenu: (s: SimState) => void; autoPause: boolean }) {
  const { state, speed, setSpeed, act, step } = useSim(initial, autoPause);
  const [selected, setSelected] = useState<string | null>('corranWorks');
  const [material, setMaterial] = useState<MaterialId>('pac3');
  const [panel, setPanel] = useState<PanelId>('watch');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return;
      if (e.key === ' ') {
        e.preventDefault();
        setSpeed(speed === 0 ? lastSpeed.current : 0);
      } else if (['1', '2', '3', '4'].includes(e.key)) setSpeed(([1, 2, 4, 8] as Speed[])[Number(e.key) - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [speed, setSpeed]);
  const [layers, setLayers] = useState<MapLayers>(DEFAULT_LAYERS);
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
  const markers = useMemo(() => markersFor(state), [state]);
  const shipments: MapShipment[] = useMemo(
    () =>
      state.shipments.slice(-250).map((sh) => ({
        id: sh.id,
        path: sh.path,
        progress: Math.min(1, Math.max(0, (state.day - sh.depart) / Math.max(1, sh.arrive - sh.depart))),
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
      <header className="panel flex flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2">
        <button type="button" className="font-sans text-lg font-bold tracking-[0.2em] text-ops-amber" onClick={() => onMenu(state)} title="Main menu">
          FORGE COMMAND
        </button>
        <div>
          <div className="label">Date</div>
          <div className="text-white">{dateLabel(state.day)}</div>
        </div>
        <div>
          <div className="label">Season</div>
          <div className="text-white" title={`Prices are ${Math.round((state.priceIndex - 1) * 100)}% above the start of your term.`}>
            {seasonOf(state.day)[0].toUpperCase() + seasonOf(state.day).slice(1)} <span className="text-ops-dim">· prices +{Math.round((state.priceIndex - 1) * 100)}%</span>
          </div>
        </div>
        <div>
          <div className="label">Treasury</div>
          <div className={state.treasury < 0 ? 'text-ops-red' : 'text-white'}>{money(state.treasury)}</div>
        </div>
        <div>
          <div className="label">Readiness</div>
          <div className={textToneFor(ready)}>{pct(ready)}</div>
        </div>
        <div>
          <div className="label">Confidence</div>
          <div className={textToneFor(state.confidence / 70)}>{Math.round(state.confidence)}</div>
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
        </div>
      </header>

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
          <MapView markers={markers} shipments={shipments} routeUse={routeUse} crisisRegion={state.crisis?.region ?? null} selected={selected} onSelect={select} layers={layers} height="calc(100vh - 220px)" />
          <div className="border-t border-ops-line/60 px-2 py-1">
            <MapLegend />
          </div>
        </div>
        <aside className="panel flex min-h-[420px] min-w-0 flex-col overflow-hidden xl:max-h-[calc(100vh-150px)]">
          <nav className="flex gap-1 overflow-x-auto border-b border-ops-line/60 px-2 py-1" aria-label="Panels">
            {PANELS.map((p) => (
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
            {panel === 'site' && (selected ? <SitePanel state={state} siteId={selected} act={act} onMaterial={showMaterial} /> : <p className="p-3 text-[11px] text-ops-dim">Click any site on the map.</p>)}
            {panel === 'material' && <MaterialPanel state={state} material={material} onMaterial={showMaterial} onSite={select} />}
            {panel === 'stockpile' && <StockpilePanel state={state} act={act} onMaterial={showMaterial} />}
            {panel === 'logistics' && <LogisticsPanel state={state} act={act} onSite={select} />}
            {panel === 'fight' && <FightPanel state={state} act={act} />}
            {panel === 'strategy' && <StrategyPanel state={state} act={act} />}
            {panel === 'money' && <MoneyPanel state={state} />}
            {panel === 'feed' && <Feed state={state} onSite={select} />}
            {panel === 'watch' && <WatchPanel state={state} onSite={select} onMaterial={showMaterial} />}
            {panel === 'guide' && <GuidePanel />}
          </div>
        </aside>
      </div>
      <footer className="panel max-h-28 overflow-y-auto">
        <Feed state={state} onSite={select} limit={6} />
      </footer>
      {state.over && !reportClosed && <TermReport state={state} onClose={() => setReportClosed(true)} onMenu={() => onMenu(state)} />}
      <span className="hidden">{Object.keys(RECIPES).length + Object.keys(MATERIALS).length}</span>
    </div>
  );
}
