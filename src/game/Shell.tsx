// The 2.0 game screen: the map at the centre, a command panel beside it, and the clock on top.
import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { lazyPart } from '../ui/lazyPart';
import { PanelBoundary } from '../ui/ErrorBoundary';
import { monthOfYear, seasonOf } from '../sim/living';
import { Hearing } from './Hearing';
import { Handover, HotseatChip } from './Hotseat';
import StoryPanel, { Briefing } from './StoryPanel';
import { SettingsDialog, type SettingsTab } from './Options';
import HomePanel, { snapshot } from './HomePanel';
import InboxPanel from './InboxPanel';
import CommandPalette, { placeCommands, type Command } from './CommandPalette';
import { GROUPS, PANEL_LABEL, allPanels, groupBadge, groupOf, panelBadges, panelsFor, type GroupId, type PanelId } from './nav';
import { loadPauseRules, pauseFor, savePauseRules, type PauseRules } from './events';
import { feedKey, unreadCount } from './inbox';
import { safeAdvice } from '../sim/advisor';
import { engineerNeed } from '../sim/engineers';
import { validate } from '../sim/actions';
import { SiteCard, chainOf, quickActions } from './mapInfo';
import { downloadSave, saveSlot } from './saves';
import { isFounded } from '../sim/industry';
import AdvisorCard from './AdvisorCard';
import { Explain } from '../ui/Explain';
import { tr } from '../sim/worldgen';
import { confidenceWhy, readinessWhy, seasonWhy, treasuryWhy } from './explain';
import { sfx, setSoundEnabled, setSoundVolume, soundFor } from '../ui/sound';
import { loadAudioPrefs, moodFor, music, saveAudioPrefs, type AudioPrefs } from '../ui/music';
import type { MapNetwork, MapRipple } from '../ui/map/MapView';
import PlanPanel from './PlanPanel';
import { STEPS, TUTORIAL_DONE, TutorialCard } from './Tutorial';
import { TipCard, nextTip, setTipsEnabled, tipsEnabled } from './Tips';
import { checkAchievements, type AchievementDef } from './achievements';
import MapView, { DEFAULT_LAYERS, MapLayerToggles, MapLegend, type MapLayers, type MapMarker, type MapShipment } from '../ui/map/MapView';
import { readiness } from '../sim/selectors';
import type { SimState } from '../sim/types';
import { MATERIALS, RECIPES, ROUTES, ROUTE_KEY, SITE_BY_ID, type MaterialId } from '../sim/world';
import { Btn, Flash } from '../ui/kit';
import { Icon } from '../ui/icons';
import { money, pct, textToneFor } from '../ui/format';
import MaterialPanel from './MaterialPanel';
import { Feed, FightPanel, LogisticsPanel, MoneyPanel, StockpilePanel } from './OpsPanels';
import SitePanel from './SitePanel';
import StrategyPanel from './StrategyPanel';
import { GuidePanel, WatchPanel, watchList } from './WatchGuide';
import { useEffect } from 'react';
import { dateLabel, useSim, type Speed } from './useSim';

// Panels opened now and then are loaded the first time they are opened, so the game starts sooner.
const MarketsPanel = lazyPart(() => import('./MarketsPanel'));
const BuildPanel = lazyPart(() => import('./BuildPanel'));
const NewsPanel = lazyPart(() => import('./NewsPanel'));
const SandboxPanel = lazyPart(() => import('./SandboxPanel'));
const IntelPanel = lazyPart(() => import('./IntelPanel'));
const DoctrinePanel = lazyPart(() => import('./DoctrinePanel'));
const IndustryPanel = lazyPart(() => import('./IndustryPanel'));
const TestingPanel = lazyPart(() => import('./TestingPanel'));
const TownsPanel = lazyPart(() => import('./TownsPanel'));
const AlliesPanel = lazyPart(() => import('./AlliesPanel'));
const PowerPanel = lazyPart(() => import('./PowerPanel'));
const StatsPanel = lazyPart(() => import('./StatsPanel'));
const StaffPanel = lazyPart(() => import('./StaffPanel'));
const PolicyPanel = lazyPart(() => import('./PolicyPanel'));
const TermReport = lazyPart(() => import('./TermReport'));

export type { PanelId } from './nav';
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

export default function Shell({ initial, onMenu }: { initial: SimState; onMenu: (s: SimState) => void }) {
  // What pauses the clock: chosen in Settings, kept in this browser.
  const [pauseRules, setPauseRulesState] = useState<PauseRules>(() => loadPauseRules());
  const setPauseRules = (r: PauseRules) => {
    setPauseRulesState(r);
    savePauseRules(r);
  };
  const rulesRef = useRef(pauseRules);
  rulesRef.current = pauseRules;
  const { state, speed, setSpeed: rawSetSpeed, act, step: rawStep, clock, pausedBy, clearPause, saveFailed } = useSim(initial, (next, prev) => pauseFor(rulesRef.current, next.alerts ?? [], next.history.length > prev.history.length));
  // A handover or an unread briefing holds the clock: nothing may restart it behind the screen.
  const held = !!state.hotseat?.handover || !!state.hearing || (state.story?.briefing !== null && state.story?.briefing !== undefined);
  // Any change of speed by the player, or a step, ends the reason the clock last stopped.
  const setSpeed = useCallback(
    (sp: Speed) => {
      clearPause();
      rawSetSpeed(held ? 0 : sp);
    },
    [held, rawSetSpeed, clearPause],
  );
  const step = useCallback(
    (days: number) => {
      clearPause();
      rawStep(days);
    },
    [rawStep, clearPause],
  );
  const [selected, setSelected] = useState<string | null>('corranWorks');
  const [material, setMaterial] = useState<MaterialId>('pac3');
  const [panel, setPanelRaw] = useState<PanelId>(initial.tutorial && initial.tutorial.step < TUTORIAL_DONE ? 'watch' : 'home');
  // The last tab used in each group, so a group opens where you left it.
  const [lastIn, setLastIn] = useState<Partial<Record<GroupId, PanelId>>>({});
  const setPanel = useCallback((p: PanelId) => {
    setPanelRaw(p);
    setLastIn((l) => (l[groupOf(p)] === p ? l : { ...l, [groupOf(p)]: p }));
  }, []);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (!document.querySelector('[role="dialog"]')) setPalette(true);
        return;
      }
      // Escape closes Settings wherever the focus is (the search box closes itself).
      if (e.key === 'Escape' && !el?.closest('[aria-label="Search and commands"]')) setHelp(null);
      if (el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      // While a dialog is open, only Escape works; Space presses the focused button, never the clock.
      if (document.querySelector('[aria-label="Search and commands"]')) return;
      if (document.querySelector('[role="dialog"]') && e.key !== 'Escape' && e.key !== '?') return;
      if (e.key === ' ' && el?.closest('button, [role="button"], a')) return;
      if (e.key === ' ') {
        e.preventDefault();
        setSpeed(speed === 0 ? lastSpeed.current : 0);
      } else if (['1', '2', '3', '4'].includes(e.key)) setSpeed(([1, 2, 4, 8] as Speed[])[Number(e.key) - 1]);
      else if (e.key === '[' || e.key === ']') {
        const ids = tabsRef.current.map((t) => t.id);
        const i = ids.indexOf(panelRef.current);
        setPanel(ids[(i + (e.key === ']' ? 1 : ids.length - 1)) % ids.length]);
      } else if (e.key === '/') {
        e.preventDefault();
        setPalette(true);
      } else if (e.key === '?') setHelp((h) => (h ? null : 'keys'));
      else if (e.key === 'm' || e.key === 'M') document.querySelector<HTMLElement>('[role="region"][aria-label^="Map of"]')?.focus();
      else if (e.key === 'Escape') setHelp(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [speed, setSpeed, setPanel]);
  const [layers, setLayers] = useState<MapLayers>(DEFAULT_LAYERS);
  // The map key starts open on a wide screen and folded away on a phone, where it would push the panels far down.
  // The key starts closed: on a phone it would push the panels down, and on a wide screen it would take the map's height.
  const [legendOpen, setLegendOpen] = useState(false);
  // On a wide screen the game fills the window exactly, with no page scroll: the map takes the height that is left.
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1280px)').matches === true);
  useEffect(() => {
    const mq = window.matchMedia?.('(min-width: 1280px)');
    if (!mq) return;
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const [help, setHelp] = useState<SettingsTab | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const tabs = allPanels(state).map((id) => ({ id, label: PANEL_LABEL[id] }));
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const panelRef = useRef(panel);
  panelRef.current = panel;
  // A hot-seat handover stops the clock until the next director takes over.
  useEffect(() => {
    if (state.hotseat?.handover) setSpeed(0);
  }, [state.hotseat?.handover, setSpeed]);
  // So does the budget hearing, until you have made your request.
  useEffect(() => {
    if (state.hearing) setSpeed(0);
  }, [state.hearing, setSpeed]);
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
  // Field notes: one tip the first time each system shows up.
  const [tips, setTips] = useState(() => tipsEnabled());
  const tip = useMemo(() => (tips ? nextTip(state) : null), [tips, state]);
  const setAudio = (p: Partial<AudioPrefs>) => {
    const next = { ...audioPrefs, ...p };
    setAudioPrefs(next);
    saveAudioPrefs(next);
  };
  useEffect(() => {
    setSoundEnabled(audioPrefs.sfx);
    setSoundVolume(audioPrefs.sfxVolume);
    music.setVolume(audioPrefs.volume);
    if (audioPrefs.music) music.start();
    else music.stop();
  }, [audioPrefs]);
  useEffect(() => () => music.stop(), []);
  // The music follows the situation, and falls silent while the tab is hidden.
  useEffect(() => music.setMood(moodFor(state)), [state.hearing, state.crisis?.phase, state.over, state.outcome]);
  useEffect(() => {
    const onVis = () => music.setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  // A sound for what just happened: the most telling event since the last update, at most one at a time.
  // Feed lines are copied on every update, so they are matched by day and text, not by object.
  const lastFeed = useRef(feedKey(state.feed[state.feed.length - 1]));
  const soundAt = useRef(0);
  useEffect(() => {
    const items: typeof state.feed = [];
    for (let i = state.feed.length - 1; i >= 0 && feedKey(state.feed[i]) !== lastFeed.current && items.length < 40; i--) items.push(state.feed[i]);
    lastFeed.current = feedKey(state.feed[state.feed.length - 1]);
    for (const f of items) {
      const id = soundFor(f.text, f.tone);
      if (id) {
        sfx[id]();
        soundAt.current = performance.now();
        break;
      }
    }
  }, [state.feed]);
  useEffect(() => {
    // The event's own sound already says it.
    if (state.alert && performance.now() - soundAt.current > 250) sfx.alert();
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
  // The map's markers keep the same object while nothing on them has changed, so the map does not redraw every tick.
  const markersRef = useRef<{ sig: string; m: Record<string, MapMarker> } | null>(null);
  const markers = useMemo(() => {
    const m = markersFor(state, plansOn);
    const sig = Object.entries(m)
      .map(([id, k]) => `${id}:${k.tone}:${k.badge ?? ''}:${k.hidden ? 1 : 0}:${k.pulse ? 1 : 0}:${k.kind ?? ''}:${k.name ?? ''}`)
      .join('|');
    if (markersRef.current?.sig === sig) return markersRef.current.m;
    markersRef.current = { sig, m };
    return m;
  }, [state, plansOn]);
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
    [state.shipments, state.day],
  );
  const routeUse = useMemo(() => Object.fromEntries(ROUTES.map((r) => [ROUTE_KEY(r.a, r.b), (state.routeLoad[ROUTE_KEY(r.a, r.b)] ?? 0) / r.cap])), [state.routeLoad]);
  const ready = readiness(state);
  const select = (id: string | null) => {
    setSelected(id);
    if (id) setPanel('site');
  };
  const showMaterial = (m: MaterialId) => {
    setMaterial(m);
    setPanel('material');
  };

  // The inbox read mark, and what Home last showed you: both move on when you leave those tabs.
  const [readKey, setReadKey] = useState(() => feedKey(initial.feed.at(-1)));
  const [seen, setSeen] = useState(() => snapshot(initial));
  const stateRef = useRef(state);
  stateRef.current = state;
  const prevPanel = useRef(panel);
  const openedAt = useRef(feedKey(initial.feed.at(-1)));
  useEffect(() => {
    const prev = prevPanel.current;
    prevPanel.current = panel;
    if (prev === panel) return;
    if (prev === 'home') setSeen(snapshot(stateRef.current));
    // Leaving the inbox marks read what was there when you opened it; anything newer stays new.
    if (prev === 'inbox') setReadKey(openedAt.current);
    if (panel === 'inbox') openedAt.current = feedKey(stateRef.current.feed.at(-1));
  }, [panel]);
  const markRead = () => setReadKey(feedKey(state.feed.at(-1)));
  // Work that only needs to keep up with a person (badges, Home) uses a copy of the state refreshed at most once a
  // second while the clock runs, and at once when it is paused or something is done.
  const slowRef = useRef({ s: state, t: 0 });
  {
    const now = typeof performance === 'undefined' ? 0 : performance.now();
    const cur = slowRef.current;
    if (speed === 0 || now - cur.t > 1000 || cur.s.over !== state.over || cur.s.strategy.decisions.length !== state.strategy.decisions.length) slowRef.current = { s: state, t: now };
  }
  const slow = slowRef.current.s;
  const unread = useMemo(() => unreadCount(slow, readKey), [slow, readKey]);
  const watch = useMemo(() => watchList(slow), [slow]);
  const badges = useMemo(() => panelBadges(slow, watch, unread), [slow, watch, unread]);
  const group = groupOf(panel);
  // The selected site's supply chain, drawn on the map; worked out again only when the selection or a month changes.
  const chainKey = Object.values(state.sites)
    .map((x) => `${x.status[0]}${x.mothballed ? 'm' : ''}${x.processes.length}`)
    .join('');
  const chain = useMemo(() => (selected ? chainOf(state, selected) : null), [selected, chainKey]);

  // Search and commands.
  const commands = useMemo<Command[]>(() => {
    if (!palette) return [];
    const safe = safeAdvice(state);
    const gap = state.engineers ? Math.min(Math.ceil(engineerNeed(state).total - state.engineers.staff), Math.floor(state.engineers.market)) : 0;
    const hire = { type: 'hireEngineers' as const, count: Math.max(1, gap) };
    const out: Command[] = [
      { id: 'c-pause', group: 'Command', label: speed === 0 ? 'Resume the clock' : 'Pause the clock', hint: 'Space', why: held ? 'Deal with the open screen first.' : null, run: () => setSpeed(speed === 0 ? lastSpeed.current : 0) },
      ...([1, 2, 4, 8] as Speed[]).map((sp) => ({ id: `c-speed-${sp}`, group: 'Command' as const, label: `Speed ${sp}×`, hint: `${sp} day${sp > 1 ? 's' : ''} a second`, why: held ? 'Deal with the open screen first.' : null, run: () => setSpeed(sp) })),
      { id: 'c-week', group: 'Command', label: 'Advance one week', hint: '+7d', why: held ? 'Deal with the open screen first.' : speed !== 0 ? 'Pause first.' : null, run: () => step(7) },
      { id: 'c-safe', group: 'Command', label: 'Take the safe advice', hint: `${safe.length} suggestion${safe.length === 1 ? '' : 's'} within your reserve`, why: safe.length ? null : 'No safe suggestions right now.', run: () => safe.forEach((a) => act(a)) },
      { id: 'c-hire', group: 'Command', label: 'Hire engineers to the need', hint: gap > 0 ? `${gap} engineers` : 'Staff tab', why: gap > 0 ? validate(state, hire) : 'You have all the engineers the work needs.', run: () => act(hire) },
      { id: 'c-read', group: 'Command', label: 'Mark the inbox read', hint: `${unread} unread`, why: unread ? null : 'Nothing unread.', run: markRead },
      { id: 'c-save', group: 'Command', label: 'Save the game', hint: 'under a name', run: () => setSaving(`Day ${state.day + 1}`) },
      { id: 'c-settings', group: 'Command', label: 'Settings', hint: 'pause rules, field notes, sound, display', run: () => setHelp('clock') },
      { id: 'c-pauserules', group: 'Command', label: 'Pause rules', hint: 'choose what stops the clock', run: () => setHelp('clock') },
      { id: 'c-keys', group: 'Command', label: 'Keyboard shortcuts', hint: '?', run: () => setHelp('keys') },
      { id: 'c-music', group: 'Command', label: audioPrefs.music ? 'Turn the music off' : 'Turn the music on', hint: 'sound', run: () => setAudio({ music: !audioPrefs.music }) },
      { id: 'c-sfx', group: 'Command', label: audioPrefs.sfx ? 'Turn sounds off' : 'Turn sounds on', hint: 'sound effects', run: () => setAudio({ sfx: !audioPrefs.sfx }) },
      { id: 'c-menu', group: 'Command', label: 'Main menu', hint: 'the game is kept', run: () => onMenu(state) },
    ];
    return [...out, ...placeCommands(state, { panel: setPanel, site: select, material: showMaterial })];
    // Rebuilt only while the palette is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette ? state : null, palette, speed, held, unread, audioPrefs]);

  const banner = pausedBy as { text: string; tone: string; site?: string } | null;

  // One live region, always on the page, so screen readers hear what stopped the clock, a crisis, and achievements.
  const [announce, setAnnounce] = useState('');
  useEffect(() => {
    if (banner && speed === 0) setAnnounce(`Paused: ${tr(banner.text)}`);
  }, [banner, speed]);
  useEffect(() => {
    if (state.crisis) setAnnounce(`${state.crisis.phase === 'active' ? 'Crisis' : 'Warning'}: ${state.crisis.name}`);
  }, [state.crisis?.phase, state.crisis?.name]);
  useEffect(() => {
    if (toast.length) setAnnounce(`Achievement: ${toast.map((a) => a.title).join(', ')}`);
  }, [toast]);

  return (
    <div className={`flex min-h-screen flex-col gap-2 p-2 xl:h-[100dvh] xl:min-h-0 xl:overflow-hidden ${speed === 0 ? 'fc-paused' : ''}`}>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </div>
      <a href="#panels" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-ops-panel focus:px-2 focus:py-1">Skip to panels</a>
      <header className="fc-zoom panel flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2 sm:gap-x-5 sm:gap-y-2">
        <button type="button" className="fc-title-word font-sans text-base font-bold tracking-[0.2em] sm:text-lg" onClick={() => onMenu(state)} title="Main menu">
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
        <HotseatChip state={state} />
        <div className="hidden sm:block">
          <div className="label">Season</div>
          <div className="text-white" title={`Prices are ${Math.round((state.priceIndex - 1) * 100)}% above normal.`}>
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
            <Flash value={Math.round(ready * 100)}>
              <Explain title="Readiness" lines={() => readinessWhy(state)}>
                {pct(ready)}
              </Explain>
            </Flash>
          </div>
        </div>
        <div>
          <div className="label">Confidence</div>
          <div className={textToneFor(state.confidence / 70)}>
            <Flash value={Math.round(state.confidence)}>
              <Explain title="Confidence" lines={() => confidenceWhy(state)}>
                {Math.round(state.confidence)}
              </Explain>
            </Flash>
          </div>
        </div>
        {state.crisis && (
          <div className={state.crisis.phase === 'active' ? 'text-ops-red' : 'text-ops-amber'}>
            <div className="label">{state.crisis.phase === 'active' ? 'Crisis' : 'Warning'}</div>
            <div className="max-w-[220px] truncate">{state.crisis.name}</div>
          </div>
        )}
        <div className="flex w-full flex-wrap items-center gap-1.5 sm:ml-auto sm:w-auto">
          <div className="seg" role="group" aria-label="Game speed">
            {SPEEDS.map((sp) => (
              <Btn key={sp} pressed={speed === sp} onClick={() => setSpeed(sp)} ariaLabel={sp === 0 ? 'Pause' : `Speed ${sp}×`} title={sp === 0 ? 'Pause (space)' : `${sp} day${sp > 1 ? 's' : ''} a second`}>
                {sp === 0 ? <Icon name="pause" /> : (
                  <>
                    <Icon name="play" size={10} />
                    {sp}×
                  </>
                )}
              </Btn>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Step">
            <Btn onClick={() => step(1)} why={held ? 'Deal with the open screen first' : speed !== 0 ? 'Pause first' : null} title="Advance one day">
              +1d
            </Btn>
            <Btn onClick={() => step(7)} why={held ? 'Deal with the open screen first' : speed !== 0 ? 'Pause first' : null} title="Advance one week">
              +7d
            </Btn>
          </div>
          {state.over && reportClosed && (
            <Btn kind="warn" onClick={() => setReportClosed(false)} title="Your grade, the term in charts, and the next term">
              <Icon name="report" />
              Term report
            </Btn>
          )}
          <div className="seg" role="group" aria-label="Game">
            <Btn onClick={() => setSaving(saving === null ? `Day ${state.day + 1}` : null)} title="Save this game under a name" ariaLabel="Save" pressed={saving !== null}>
              <Icon name="save" />
              <span className="hidden xl:inline">Save</span>
            </Btn>
            <Btn onClick={() => setPalette(true)} title="Go to any tab, site, material or town, or run a command (Ctrl K or /)" ariaLabel="Search">
              <Icon name="search" />
              <span className="hidden xl:inline">Search</span>
            </Btn>
            <Btn onClick={() => setHelp('clock')} title="Pause rules, field notes, sound, display and keyboard shortcuts (?)" ariaLabel="Settings">
              <Icon name="settings" />
              <span className="hidden xl:inline">Settings</span>
            </Btn>
          </div>
          <div className="seg" role="group" aria-label="Audio">
            <Btn pressed={audioPrefs.sfx} onClick={() => setAudio({ sfx: !audioPrefs.sfx })} title="Sound effects" ariaLabel="Sound effects">
              <Icon name={audioPrefs.sfx ? 'sound' : 'mute'} />
            </Btn>
            <Btn pressed={audioPrefs.music} onClick={() => setAudio({ music: !audioPrefs.music })} title="Generated background music" ariaLabel="Music">
              <Icon name="music" />
            </Btn>
          </div>
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
          <Btn kind="primary" type="submit">Save</Btn>
          <Btn onClick={() => setSaving(null)}>Cancel</Btn>
        </form>
      )}
      {saveFailed && (
        <div role="alert" className="fc-zoom fc-drop panel flex flex-wrap items-center justify-between gap-2 border-ops-amber/60 px-3 py-1.5 text-[12px] text-ops-amber">
          <span>This browser would not save your game (its storage is full or switched off). Keep a copy as a file so you do not lose it.</span>
          <Btn kind="warn" onClick={() => downloadSave(state)}>
            Download save
          </Btn>
        </div>
      )}
      {saveNote && (
        <div role="status" className="fc-zoom fc-drop panel flex items-center justify-between gap-2 px-3 py-1 text-[12px] text-ops-green">
          <span>{saveNote}</span>
          <Btn onClick={() => setSaveNote(null)}>OK</Btn>
        </div>
      )}

      {lead && (
        <button type="button" onClick={() => setPanel('news')} className="fc-zoom panel flex min-w-0 items-center gap-2 px-3 py-1 text-left text-[11px] hover:border-ops-dim">
          <span className="label shrink-0">Courier</span>
          <span className="min-w-0 truncate text-ops-text">{tr(lead.title)}</span>
        </button>
      )}

      {toast.length > 0 && (
        <div className="fc-drop panel flex flex-wrap items-center gap-2 border-ops-green/60 px-3 py-2 text-[12px] text-ops-green">
          <span>★ Achievement{toast.length > 1 ? 's' : ''}:</span>
          {toast.map((a) => (
            <span key={a.id} className="text-white">
              {a.title} <span className="text-ops-dim">· {a.text}</span>
            </span>
          ))}
        </div>
      )}

      {banner && speed === 0 && (
        <div className={`fc-drop panel flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[12px] ${banner.tone === 'bad' ? 'border-ops-red/60 text-ops-red' : banner.tone === 'good' ? 'border-ops-green/60 text-ops-green' : 'border-ops-amber/60 text-ops-amber'}`}>
          <span>
            Paused: {tr(banner.text)}
          </span>
          <span className="flex gap-1">
            {banner.site && <Btn onClick={() => select(banner.site!)}>Show</Btn>}
            <Btn kind="primary" onClick={() => setSpeed(lastSpeed.current)}>
              Resume
            </Btn>
          </span>
        </div>
      )}

      <div className="grid flex-1 gap-2 xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="panel min-w-0 overflow-hidden xl:flex xl:flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ops-line/60 px-2 py-1">
            <MapLayerToggles layers={layers} onChange={setLayers} />
          </div>
          <div className="xl:min-h-0 xl:flex-1">
          <MapView
            key={state.world ?? 'classic'}
            markers={markers}
            shipments={shipments}
            routeUse={routeUse}
            crisisRegion={state.crisis?.region ?? null}
            selected={selected}
            onSelect={select}
            layers={layers}
            height={wide ? '100%' : 'min(calc(100dvh - 220px), max(370px, 78vw))'}
            network={network}
            showPlans={panel === 'build'}
            highlight={highlight}
            ripples={ripples}
            clock={clock}
            hoverCard={(id) => <SiteCard state={stateRef.current} id={id} />}
            quickMenu={(id, close) => (
              <ul className="text-[12px]">
                <li className="truncate px-2 py-1 text-[10px] uppercase tracking-wider text-ops-dim">{tr(stateRef.current.sites[id]?.plantName ?? SITE_BY_ID[id].name)}</li>
                {quickActions(stateRef.current, id, { site: select, material: showMaterial, act }).map((q) => (
                  <li key={q.label}>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={!!q.why}
                      title={q.why ?? undefined}
                      className="block w-full rounded px-2 py-1 text-left text-ops-text hover:bg-ops-cyan/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => {
                        close();
                        q.run();
                      }}
                    >
                      {q.label}
                      {q.why && <span className="block text-[10px] text-ops-amber">{q.why}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            related={chain}
            weather={!state.settings.seasons ? null : seasonOf(state.day) === 'winter' ? 'snow' : [2, 3].includes(monthOfYear(state.day)) ? 'flood' : [6, 7].includes(monthOfYear(state.day)) ? 'heat' : null}
          />
          </div>
          <details className="group border-t border-ops-line/60 px-2 py-1 xl:max-h-44 xl:shrink-0 xl:overflow-y-auto" open={legendOpen} onToggle={(e) => setLegendOpen((e.currentTarget as HTMLDetailsElement).open)}>
            <summary className="label cursor-pointer select-none py-1 hover:text-ops-text">Map key</summary>
            <MapLegend />
          </details>
        </div>
        <aside id="panels" tabIndex={-1} className="fc-zoom panel flex min-h-[420px] min-w-0 flex-col overflow-hidden xl:min-h-0">
          <nav className="flex gap-1 overflow-x-auto border-b border-ops-line/60 px-2 pt-1" aria-label="Panel groups">
            {GROUPS.map((g) => {
              const on = group === g.id;
              const b = groupBadge(state, badges, g);
              return (
                <button
                  key={g.id}
                  type="button"
                  data-group={g.id}
                  className={`whitespace-nowrap rounded-t border-b-2 px-2 py-1 font-sans text-[12px] font-semibold uppercase tracking-wider ${on ? 'border-ops-cyan text-white' : 'border-transparent text-ops-dim hover:text-ops-text'}`}
                  aria-current={on ? 'true' : undefined}
                  onClick={() => setPanel(on ? panel : (lastIn[g.id] ?? panelsFor(state, g)[0]))}
                >
                  {g.label}
                  {b.count > 0 && (
                    <span className={`ml-1.5 rounded-full px-1.5 text-[10px] ${b.bad ? 'bg-ops-red/20 text-ops-red' : 'bg-ops-amber/20 text-ops-amber'}`} aria-label={`${b.count} need${b.count === 1 ? 's' : ''} you`}>
                      {b.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          <nav className="flex gap-1 overflow-x-auto border-b border-ops-line/60 px-2 py-1" aria-label="Panels">
            {panelsFor(state, GROUPS.find((g) => g.id === group)!).map((id) => {
              const b = badges[id];
              return (
                <button
                  key={id}
                  type="button"
                  data-panel={id}
                  className={`whitespace-nowrap rounded px-2 py-1 font-sans text-[12px] font-semibold uppercase tracking-wider ${panel === id ? 'bg-ops-cyan/15 text-ops-cyan' : 'text-ops-dim hover:text-ops-text'}`}
                  aria-current={panel === id ? 'page' : undefined}
                  onClick={() => setPanel(id)}
                >
                  {PANEL_LABEL[id]}
                  {b && b.count > 0 && <span className={`ml-1 text-[10px] ${b.bad ? 'text-ops-red' : 'text-ops-amber'}`}>{b.count}</span>}
                </button>
              );
            })}
          </nav>
          {state.tutorial && state.tutorial.step < TUTORIAL_DONE && <TutorialCard state={state} onStep={(step) => act({ type: 'tutorial', step })} />}
          {tip && (
            <TipCard
              tip={tip}
              onShow={() => {
                setPanel(tip.panel);
                act({ type: 'tipSeen', id: tip.id });
              }}
              onDismiss={() => act({ type: 'tipSeen', id: tip.id })}
              onOff={() => {
                setTipsEnabled(false);
                setTips(false);
              }}
            />
          )}
          <div key={panel} className="fc-enter min-h-0 flex-1 overflow-y-auto">
            <PanelBoundary resetKey={panel} onHome={() => setPanel('home')}>
            <Suspense fallback={<p className="p-3 text-[11px] text-ops-dim">Loading…</p>}>
            {panel === 'plan' && <PlanPanel state={state} onMaterial={showMaterial} onSite={select} />}
            {panel === 'markets' && <MarketsPanel state={state} act={act} onSite={select} />}
            {panel === 'build' && <BuildPanel state={state} act={act} onHighlight={setHighlight} onSite={select} />}
            {panel === 'news' && <NewsPanel state={state} />}
            {panel === 'industry' && <IndustryPanel state={state} act={act} onSite={select} onHighlight={setHighlight} />}
            {panel === 'story' && <StoryPanel state={state} />}
            {panel === 'testing' && <TestingPanel state={state} act={act} onSite={select} />}
            {panel === 'towns' && <TownsPanel state={state} act={act} onSite={select} />}
            {panel === 'allies' && <AlliesPanel state={state} act={act} />}
            {panel === 'power' && <PowerPanel state={state} act={act} onSite={select} />}
            {panel === 'stats' && <StatsPanel state={state} onSite={select} />}
            {panel === 'staff' && <StaffPanel state={state} act={act} onSite={select} />}
            {panel === 'intel' && <IntelPanel state={state} act={act} />}
            {panel === 'doctrine' && <DoctrinePanel state={state} act={act} />}
            {panel === 'policy' && <PolicyPanel state={state} act={act} />}
            {panel === 'sandbox' && state.mode === 'sandbox' && <SandboxPanel state={state} act={act} selected={selected} />}
            {panel === 'site' && (selected ? <SitePanel state={state} siteId={selected} act={act} onMaterial={showMaterial} /> : <p className="p-3 text-[11px] text-ops-dim">Click any site on the map.</p>)}
            {panel === 'material' && <MaterialPanel state={state} material={material} onMaterial={showMaterial} onSite={select} />}
            {panel === 'stockpile' && <StockpilePanel state={state} act={act} onMaterial={showMaterial} />}
            {panel === 'logistics' && <LogisticsPanel state={state} act={act} onSite={select} />}
            {panel === 'fight' && <FightPanel state={state} act={act} />}
            {panel === 'strategy' && <StrategyPanel state={state} act={act} />}
            {panel === 'money' && <MoneyPanel state={state} act={act} />}
            {panel === 'feed' && <Feed state={state} onSite={select} />}
            {panel === 'watch' && (
              <>
                <AdvisorCard state={state} act={act} onPanel={(p) => setPanel(p === 'programmes' ? 'policy' : p === 'site' ? 'site' : p)} onSite={select} onMaterial={showMaterial} />
                <WatchPanel state={state} onSite={select} onMaterial={showMaterial} onPanel={(p) => setPanel(p)} />
              </>
            )}
            {panel === 'guide' && <GuidePanel />}
            {panel === 'home' && <HomePanel state={slow} act={act} seen={seen} unread={unread} onPanel={setPanel} onSite={select} onLine={showMaterial} />}
            {panel === 'inbox' && <InboxPanel state={state} readKey={readKey} tip={tip} onMarkRead={markRead} onPanel={setPanel} onSite={select} />}
            </Suspense>
            </PanelBoundary>
          </div>
        </aside>
      </div>
      <footer className="fc-zoom panel max-h-28 shrink-0 overflow-y-auto">
        <Feed state={state} onSite={select} limit={6} />
      </footer>
      <Briefing state={state} act={act} />
      <Handover state={state} act={act} />
      {!state.hotseat?.handover && !state.over && (state.story?.briefing === null || state.story?.briefing === undefined) && <Hearing state={state} act={act} />}
      {state.over && !reportClosed && (
        <Suspense fallback={null}>
        <TermReport
          state={state}
          onClose={() => setReportClosed(true)}
          onMenu={() => onMenu(state)}
          onSecondTerm={(boon) => {
            act({ type: 'secondTerm', boon });
            setReportClosed(false);
          }}
        />
        </Suspense>
      )}
      {help && (
        <SettingsDialog
          initial={help}
          onClose={() => setHelp(null)}
          audio={{ prefs: audioPrefs, set: setAudio }}
          pause={{ rules: pauseRules, set: setPauseRules }}
          tips={{
            on: tips,
            set: (on) => {
              setTipsEnabled(on);
              setTips(on);
            },
          }}
        />
      )}
      {palette && <CommandPalette commands={commands} onClose={() => setPalette(false)} />}
      <span className="hidden">{Object.keys(RECIPES).length + Object.keys(MATERIALS).length}</span>
    </div>
  );
}
