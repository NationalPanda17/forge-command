// The 2.0 game screen: the map at the centre, a command panel beside it, and the clock on top.
import { Suspense, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { lazyPart } from '../ui/lazyPart';
import { PanelBoundary } from '../ui/ErrorBoundary';
import { monthOfYear, seasonOf } from '../sim/living';
import { Hearing } from './Hearing';
import { Handover, HotseatChip } from './Hotseat';
import StoryPanel, { Briefing } from './StoryPanel';
import { CountryBrief, wantsBrief } from './CountryBrief';
import { SettingsDialog, type SettingsTab } from './Options';
import HomePanel, { snapshot } from './HomePanel';
import InboxPanel from './InboxPanel';
import CommandPalette, { placeCommands, type Command } from './CommandPalette';
import { GROUPS, PANEL_LABEL, allPanels, groupBadge, groupOf, panelBadges, panelsFor, resolvePanel, type GroupId, type PanelId } from './nav';
import { loadPauseRules, pauseFor, savePauseRules, type PauseRules } from './events';
import { feedKey, unreadCount } from './inbox';
import { safeAdvice } from '../sim/advisor';
import { engineerNeed } from '../sim/engineers';
import { apply, validate, type SimAction } from '../sim/actions';
import { SiteCard, chainOf, quickActions } from './mapInfo';
import { downloadSave, saveSlot, storageWarning } from './saves';
import { isFounded } from '../sim/industry';
import { Explain } from '../ui/Explain';
import { countryTitle, tr } from '../sim/worldgen';
import { confidenceWhy, readinessWhy, seasonWhy, treasuryWhy } from './explain';
import { play, setGameSpeed, setQuietAtSpeed, setSoundEnabled, setSoundVolume, soundFor } from '../ui/sound';
import { setMasterVolume } from '../ui/mixer';
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
import { Icon, Insignia, type IconName } from '../ui/icons';
import { money, pct, textToneFor } from '../ui/format';
import MaterialPanel from './MaterialPanel';
import { FightPanel, LogisticsPanel, MoneyPanel, StockpilePanel } from './OpsPanels';
import SitePanel from './SitePanel';
import StrategyPanel from './StrategyPanel';
import { GuidePanel, watchList } from './WatchGuide';
import { AlertChips, alertGroups } from './Alerts';
import { Outliner } from './Outliner';
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

/**
 * Where the overlays sit over the full-window map (18.3), in pixels: the command bar (8 + 56), the status bar under it,
 * the map's layer bar under that, and the panels' width. The map's safe area is worked out from these.
 */
const CHROME = { statusTop: 72, layersTop: 116, mapTop: 156, panelWidth: 470 } as const;

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
    // The map's chokepoint (19.0b): the only plant that makes a part every arsenal needs.
    if (!badge && s.features?.chokepoint?.site === site.id) badge = 'CP';
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
  const { state, speed, setSpeed: rawSetSpeed, act: rawAct, step: rawStep, clock, pausedBy, clearPause, saveFailed } = useSim(initial, (next, prev) => pauseFor(rulesRef.current, next.alerts ?? [], next.history.length > prev.history.length));
  // Feedback where you clicked (17.1): each action shows what it did and what it cost, or why it could not be done,
  // beside the pointer. Several actions at once (the safe advice) are summed into one note.
  const [actNote, setActNote] = useState<ActNote | null>(null);
  const pointer = useRef<{ x: number; y: number; t: number }>({ x: 0, y: 0, t: 0 });
  useEffect(() => {
    const onDown = (e: PointerEvent) => (pointer.current = { x: e.clientX, y: e.clientY, t: performance.now() });
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, []);
  const pending = useRef<{ before: SimState; after: SimState; n: number; why: string | null; timer: number } | null>(null);
  const liveState = useRef(state);
  liveState.current = state;
  const act = useCallback(
    (a: SimAction) => {
      const quiet = a.type === 'tutorial' || a.type === 'tipSeen' || a.type === 'storyBriefed' || a.type === 'handover';
      if (!quiet) {
        const p = pending.current;
        const from = p ? p.after : liveState.current;
        const why = validate(from, a);
        const after = why ? from : apply(from, a);
        if (p) window.clearTimeout(p.timer);
        const next = { before: p?.before ?? liveState.current, after, n: (p?.n ?? 0) + (why ? 0 : 1), why: why ?? p?.why ?? null, timer: 0 };
        next.timer = window.setTimeout(() => {
          pending.current = null;
          setActNote(noteFor(next.before, next.after, next.n, next.why, pointer.current));
        }, 40);
        pending.current = next;
      }
      rawAct(a);
    },
    [rawAct],
  );
  useEffect(() => {
    if (!actNote) return;
    const t = window.setTimeout(() => setActNote(null), actNote.tone === 'bad' ? 3200 : 2400);
    return () => window.clearTimeout(t);
  }, [actNote]);
  // A generated country opens with its brief (19.0b), read before the clock first runs.
  const [briefOpen, setBriefOpen] = useState(() => wantsBrief(state));
  // A handover or an unread briefing holds the clock: nothing may restart it behind the screen.
  const held = briefOpen || !!state.hotseat?.handover || !!state.hearing || (state.story?.briefing !== null && state.story?.briefing !== undefined);
  // Any change of speed by the player, or a step, ends the reason the clock last stopped.
  // The speed when the last control was pressed, so a press can tell pause from resume from a speed change.
  const speedRef = useRef(speed);
  speedRef.current = speed;
  // The sounds thin out at 4× and 8× (Settings, Sound).
  useEffect(() => setGameSpeed(speed), [speed]);
  // Every button in the game gives a quiet tick (the clock's own controls have their own sounds).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const b = (e.target as Element | null)?.closest?.('button');
      if (!b || b.disabled || b.closest('[aria-label="Game speed"]') || b.classList.contains('fc-clock-pause')) return;
      play('click');
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  const setSpeed = useCallback(
    (sp: Speed) => {
      clearPause();
      const next = held ? 0 : sp;
      if (next !== speedRef.current) play(next === 0 ? 'pause' : speedRef.current === 0 ? 'resume' : 'speed');
      rawSetSpeed(next);
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
  const [panel, setPanelRaw] = useState<PanelId>('home');
  // The last tab used in each group, so a group opens where you left it.
  const [lastIn, setLastIn] = useState<Partial<Record<GroupId, PanelId>>>({});
  const setPanel = useCallback((to: PanelId) => {
    // Watch and Feed were folded into Home and the Log in 17.1; links to them still work.
    const p = resolvePanel(to);
    setPanelRaw(p);
    setLastIn((l) => (l[groupOf(p)] === p ? l : { ...l, [groupOf(p)]: p }));
  }, []);
  const [palette, setPalette] = useState(false);
  // For the keyboard: the tabs with alerts, and the last tab used in each group.
  const alertRef = useRef<PanelId[]>([]);
  const lastInRef = useRef(lastIn);
  lastInRef.current = lastIn;

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
      // Shift and a number opens a tab group (the number alone sets the speed).
      const digit = /^Digit([1-6])$/.exec(e.code);
      if (e.shiftKey && digit) {
        const g = GROUPS[Number(digit[1]) - 1];
        if (g) setPanel(lastInRef.current[g.id] ?? panelsFor(stateRef.current, g)[0]);
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        setSpeed(speed === 0 ? lastSpeed.current : 0);
      } else if (['1', '2', '3', '4'].includes(e.key)) setSpeed(([1, 2, 4, 8] as Speed[])[Number(e.key) - 1]);
      else if (e.key === 'h' || e.key === 'H') setPanel('home');
      // P folds the panels away or brings them back; F leaves the map alone on screen, and F again brings it all back.
      else if (e.key === 'p' || e.key === 'P') {
        setFocus(false);
        setPanelOpen(!panelOpenRef.current || focusRef.current);
      } else if (e.key === 'f' || e.key === 'F') setFocus((f) => !f);
      else if (e.key === '.') {
        // The next alert's tab, in turn.
        const list = alertRef.current;
        if (list.length) setPanel(list[(list.indexOf(panelRef.current) + 1) % list.length]);
      }
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
  // The map key is a pop-over from the layer bar, closed at first.
  const [legendOpen, setLegendOpen] = useState(false);
  // The panels fold away to a tab (P), and F leaves the map alone on screen; the fold is remembered in this browser.
  const [panelOpen, setPanelOpenRaw] = useState(() => {
    try {
      return localStorage.getItem('forge-command-panels') !== 'closed';
    } catch {
      return true;
    }
  });
  const setPanelOpen = useCallback((open: boolean) => {
    setPanelOpenRaw(open);
    try {
      localStorage.setItem('forge-command-panels', open ? 'open' : 'closed');
    } catch {
      /* storage unavailable */
    }
  }, []);
  const [focus, setFocus] = useState(false);
  const panelOpenRef = useRef(panelOpen);
  panelOpenRef.current = panelOpen;
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const insets = useMemo(
    () => ({ top: focus ? CHROME.statusTop + 44 : CHROME.mapTop, left: 8, bottom: 8, right: panelOpen && !focus ? CHROME.panelWidth + 16 : 48 }),
    [panelOpen, focus],
  );
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
    setMasterVolume(audioPrefs.master ?? 1);
    setQuietAtSpeed(audioPrefs.quietAtSpeed ?? true);
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
        if (play(id)) soundAt.current = performance.now();
        break;
      }
    }
  }, [state.feed]);
  useEffect(() => {
    // The event's own sound already says it.
    if (state.alert && performance.now() - soundAt.current > 250) play('alert');
  }, [state.alert]);
  // The treasury going into debt is heard, once each time it happens.
  const inDebt = state.treasury < 0;
  const wasInDebt = useRef(inDebt);
  useEffect(() => {
    if (inDebt && !wasInDebt.current) play('failure');
    wasInDebt.current = inDebt;
  }, [inDebt]);
  const months = useRef(state.history.length);
  useEffect(() => {
    if (state.history.length > months.current) play('month');
    months.current = state.history.length;
  }, [state.history.length]);
  useEffect(() => {
    if (toast.length) play('fanfare');
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
  alertRef.current = alertGroups(watch).map((g) => g.panel);
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

  const banner = pausedBy as { text: string; tone: string; site?: string; more?: number } | null;

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
    <div className={`relative h-[100dvh] min-w-[1100px] overflow-hidden ${speed === 0 ? 'fc-paused' : ''}`}>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </div>
      <a href="#panels" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-ops-panel focus:px-2 focus:py-1">Skip to panels</a>
      <header className="fc-zoom fc-cmdbar absolute left-2 right-2 top-2 z-30 flex h-14 items-center gap-3 px-3">
        <button type="button" className="flex shrink-0 items-center gap-2.5 pr-1 text-left" onClick={() => onMenu(state)} title="Main menu">
          <Insignia size={34} />
          <span className="leading-none">
            <span className="fc-title-word block font-sans text-[19px] font-bold tracking-[0.18em]">FORGE COMMAND</span>
            <span className="mt-1 block max-w-[190px] truncate font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-ops-dim">{countryTitle()}</span>
          </span>
        </button>
        {state.mode === 'sandbox' && (
          <button type="button" onClick={() => setPanel('sandbox')} className="chip shrink-0 border-ops-amber/60 text-ops-amber">
            Sandbox
          </button>
        )}
        <div className="fc-divider" aria-hidden="true" />
        <div className="flex min-w-0 items-center gap-1.5">
          <Resource icon="coin" label="Treasury" tone={state.treasury < 0 ? 'red' : 'amber'}>
            <span className={state.treasury < 0 ? 'text-ops-red' : 'text-white'}>
              <Explain title="Treasury" lines={() => treasuryWhy(state)}>
                {money(state.treasury)}
              </Explain>
            </span>
          </Resource>
          <Resource icon="shield" label="Readiness" tone={ready >= 0.9 ? 'green' : ready >= 0.6 ? 'amber' : 'red'}>
            <span className={textToneFor(ready)}>
              <Flash value={Math.round(ready * 100)}>
                <Explain title="Readiness" lines={() => readinessWhy(state)}>
                  {pct(ready)}
                </Explain>
              </Flash>
            </span>
          </Resource>
          <Resource icon="star" label="Confidence" tone={state.confidence >= 63 ? 'green' : state.confidence >= 42 ? 'amber' : 'red'}>
            <span className={textToneFor(state.confidence / 70)}>
              <Flash value={Math.round(state.confidence)}>
                <Explain title="Confidence" lines={() => confidenceWhy(state)}>
                  {Math.round(state.confidence)}
                </Explain>
              </Flash>
            </span>
          </Resource>
          {/* On a narrower window the season gives way; its effects show in the weather layer and the alerts. */}
          <Resource icon={seasonOf(state.day)} label={seasonOf(state.day)} tone="cyan" className="max-[1199px]:hidden">
            <span className="text-white" title={`Prices are ${Math.round((state.priceIndex - 1) * 100)}% above normal.`}>
              <Explain title="Season and prices" lines={() => seasonWhy(state)}>
                +{Math.round((state.priceIndex - 1) * 100)}%
              </Explain>
            </span>
          </Resource>
          <HotseatChip state={state} />
        </div>
        {state.crisis && (
          <div className={`fc-crisis flex min-w-0 shrink items-center gap-2 ${state.crisis.phase === 'active' ? 'fc-crisis-active' : ''}`} title={state.crisis.name}>
            <Icon name="alert" size={16} />
            <span className="min-w-0 leading-tight">
              <span className="label block !text-current">{state.crisis.phase === 'active' ? 'Crisis' : 'Warning'}</span>
              <span className="hidden max-w-[200px] truncate font-sans text-[14px] font-semibold min-[1440px]:block">{state.crisis.name}</span>
            </span>
          </div>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {state.over && reportClosed && (
            <Btn kind="primary" onClick={() => setReportClosed(false)} title="Your grade, the term in charts, and the next term">
              <Icon name="report" />
              Term report
            </Btn>
          )}
          <div className="fc-clock">
            <div className="min-w-[132px] px-1 leading-none">
              <div className="font-sans text-[19px] font-bold uppercase tracking-[0.06em] text-white">{dateLabel(state.day)}</div>
              <div className={`mt-1 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] ${speed === 0 ? 'text-ops-amber' : 'text-ops-dim'}`}>
                {speed === 0 ? 'Paused · Space to run' : `${speed} day${speed > 1 ? 's' : ''} a second`}
              </div>
            </div>
            <button
              type="button"
              className={`fc-clock-pause ${speed === 0 ? 'is-paused' : ''}`}
              aria-pressed={speed === 0}
              aria-label={speed === 0 ? 'Resume' : 'Pause'}
              title={speed === 0 ? 'Resume (space)' : 'Pause (space)'}
              onClick={() => setSpeed(speed === 0 ? lastSpeed.current || 1 : 0)}
            >
              <Icon name={speed === 0 ? 'play' : 'pause'} size={15} />
            </button>
            <div className="flex items-end gap-[3px] self-stretch py-1" role="group" aria-label="Game speed">
              {SPEEDS.filter((sp) => sp > 0).map((sp, i) => (
                <button
                  key={sp}
                  type="button"
                  className={`fc-pip ${speed >= sp ? 'is-on' : ''}`}
                  style={{ ['--h' as string]: `${7 + i * 4}px` }}
                  aria-pressed={speed === sp}
                  aria-label={`Speed ${sp}×`}
                  title={`${sp} day${sp > 1 ? 's' : ''} a second`}
                  onClick={() => setSpeed(sp)}
                >
                  <span />
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-[3px]" role="group" aria-label="Step">
              <button type="button" className="fc-step" disabled={held || speed !== 0} onClick={() => step(1)} title={held ? 'Deal with the open screen first' : speed !== 0 ? 'Pause first' : 'Advance one day'}>
                +1d
              </button>
              <button type="button" className="fc-step" disabled={held || speed !== 0} onClick={() => step(7)} title={held ? 'Deal with the open screen first' : speed !== 0 ? 'Pause first' : 'Advance one week'}>
                +7d
              </button>
            </div>
          </div>
          <div className="seg" role="group" aria-label="Game">
            <Btn onClick={() => setSaving(saving === null ? `Day ${state.day + 1}` : null)} title="Save this game under a name" ariaLabel="Save" pressed={saving !== null}>
              <Icon name="save" />
            </Btn>
            <Btn onClick={() => setPalette(true)} title="Go to any tab, site, material or town, or run a command (Ctrl K or /)" ariaLabel="Search">
              <Icon name="search" />
            </Btn>
            <Btn onClick={() => setHelp('clock')} title="Pause rules, field notes, sound, display and keyboard shortcuts (?)" ariaLabel="Settings">
              <Icon name="settings" />
            </Btn>
            <Btn pressed={audioPrefs.sfx} onClick={() => setAudio({ sfx: !audioPrefs.sfx })} title="Sound effects" ariaLabel="Sound effects">
              <Icon name={audioPrefs.sfx ? 'sound' : 'mute'} />
            </Btn>
            <Btn pressed={audioPrefs.music} onClick={() => setAudio({ music: !audioPrefs.music })} title="Generated background music" ariaLabel="Music">
              <Icon name="music" />
            </Btn>
          </div>
        </div>
      </header>

      {/* The status bar (17.1): one notice at a time, the most important first, in a slot that never moves the map;
          and on the right, the alerts: what needs you now, which clear themselves once it is dealt with. */}
      <div className="fc-zoom fc-statusbar absolute left-2 z-30" style={{ top: CHROME.statusTop, right: insets.right }} role="region" aria-label="Notices and alerts">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {saving !== null ? (
            <form
              className="flex min-w-0 items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const why = saveSlot(saving, state);
                setSaveNote(why ?? [`Saved as “${saving.trim()}”.`, storageWarning()].filter(Boolean).join(' '));
                if (!why) setSaving(null);
              }}
            >
              <label className="flex items-center gap-2">
                <span className="label">Save as</span>
                <input className="input h-6 w-56 py-0" value={saving} onChange={(e) => setSaving(e.target.value)} autoFocus maxLength={40} />
              </label>
              <Btn kind="primary" type="submit">Save</Btn>
              <Btn onClick={() => setSaving(null)}>Cancel</Btn>
            </form>
          ) : saveFailed ? (
            <div role="alert" className="fc-drop flex min-w-0 items-center gap-2 text-ops-amber">
              <Icon name="alert" />
              <span className="min-w-0 truncate" title="Its storage is full or switched off. Keep a copy as a file so you do not lose your game.">This browser would not save your game. Keep a copy as a file.</span>
              <Btn kind="warn" onClick={() => downloadSave(state)}>Download save</Btn>
            </div>
          ) : banner && speed === 0 ? (
            <div className={`fc-drop flex min-w-0 items-center gap-2 ${banner.tone === 'bad' ? 'text-ops-red' : banner.tone === 'good' ? 'text-ops-green' : 'text-ops-amber'}`}>
              <Icon name="pause" />
              <span className="min-w-0 truncate" title={tr(banner.text)}>
                Paused: {tr(banner.text)}
              </span>
              {(banner.more ?? 0) > 0 && (
                <button type="button" className="shrink-0 text-ops-dim underline decoration-dotted underline-offset-2 hover:text-ops-text" onClick={() => setPanel('inbox')}>
                  +{banner.more} more in the log
                </button>
              )}
              {banner.site && <Btn onClick={() => select(banner.site!)}>Show</Btn>}
              <Btn kind="primary" onClick={() => setSpeed(lastSpeed.current)}>
                Resume
              </Btn>
            </div>
          ) : toast.length > 0 ? (
            <div className="fc-drop flex min-w-0 items-center gap-2 text-ops-green">
              <Icon name="trophy" />
              <span className="min-w-0 truncate">
                <span className="text-white">{toast[0].title}</span> <span className="text-ops-dim">· {toast[0].text}</span>
                {toast.length > 1 && <span className="text-ops-dim"> · and {toast.length - 1} more</span>}
              </span>
            </div>
          ) : saveNote ? (
            <div role="status" className="fc-drop flex min-w-0 items-center gap-2 text-ops-green">
              <Icon name="save" />
              <span className="min-w-0 truncate">{saveNote}</span>
              <Btn onClick={() => setSaveNote(null)}>OK</Btn>
            </div>
          ) : lead ? (
            <button type="button" onClick={() => setPanel('news')} className="flex min-w-0 items-center gap-2 text-left hover:text-white">
              <span className="label shrink-0">Courier</span>
              <span className="min-w-0 truncate text-ops-text">{tr(lead.title)}</span>
            </button>
          ) : (
            <span className="label">All quiet</span>
          )}
        </div>
        <AlertChips items={watch} onPanel={setPanel} />
      </div>

      {/* The map fills the window (18.3). Everything else floats over it, and the map keeps its view, rulers and
          controls in the safe area the overlays leave free. */}
      <div className="absolute inset-0 z-0">
          <MapView
            key={state.world ?? 'classic'}
            markers={markers}
            shipments={shipments}
            routeUse={routeUse}
            crisisRegion={state.crisis?.region ?? null}
            selected={selected}
            onSelect={select}
            layers={layers}
            height="100%"
            bare
            insets={insets}
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
      {!focus && <Outliner state={slow} onPanel={setPanel} onSite={select} top={insets.top + 64} left={insets.left + 12} />}
      {!focus && (
        <div className="fc-zoom fc-hud absolute z-20 flex items-center gap-2 px-2 py-1" style={{ left: 8, top: CHROME.layersTop }}>
          <MapLayerToggles layers={layers} onChange={setLayers} />
          <Btn pressed={legendOpen} onClick={() => setLegendOpen(!legendOpen)} title="What the map's symbols mean">
            Key
          </Btn>
        </div>
      )}
      {legendOpen && !focus && (
        <div className="fc-zoom fc-hud absolute z-20 max-h-[55vh] w-[560px] overflow-y-auto" style={{ left: 8, top: CHROME.layersTop + 40 }} role="dialog" aria-label="Map key">
          <MapLegend className="p-3" />
        </div>
      )}
      {panelOpen && !focus && (
        // A small tab on the panels' outer edge folds them away; it sits above the map's zoom buttons, clear of them.
        <button type="button" className="fc-zoom fc-panel-fold absolute z-20" style={{ top: CHROME.statusTop + 48, right: CHROME.panelWidth + 8 }} onClick={() => setPanelOpen(false)} title="Fold the panels away (P); F for the map alone" aria-label="Fold the panels away">
          <Icon name="continue" size={12} />
        </button>
      )}
      {!panelOpen && (
        <button type="button" className="fc-zoom fc-panel-tab absolute right-2 z-20" style={{ top: CHROME.statusTop }} onClick={() => setPanelOpen(true)} title="Show the panels (P)" aria-label="Show the panels">
          <Icon name="back" />
          <span>Panels</span>
        </button>
      )}
        <aside id="panels" tabIndex={-1} className={`fc-zoom panel absolute bottom-2 right-2 z-20 flex flex-col overflow-hidden ${panelOpen ? '' : 'hidden'}`} style={{ top: CHROME.statusTop, width: CHROME.panelWidth }}>
          <nav className="fc-gtabs flex overflow-x-auto border-b border-ops-line px-1" aria-label="Panel groups">
            {GROUPS.map((g) => {
              const on = group === g.id;
              const b = groupBadge(state, badges, g);
              return (
                <button
                  key={g.id}
                  type="button"
                  data-group={g.id}
                  className={`fc-gtab ${on ? 'is-on' : ''}`}
                  aria-current={on ? 'true' : undefined}
                  onClick={() => setPanel(on ? panel : (lastIn[g.id] ?? panelsFor(state, g)[0]))}
                >
                  {g.label}
                  {b.count > 0 && (
                    <span className={`ml-1 rounded-[2px] px-1 font-sans text-[10px] font-bold ${b.bad ? 'bg-ops-red/20 text-ops-red' : 'bg-ops-amber/20 text-ops-amber'}`} aria-label={`${b.count} need${b.count === 1 ? 's' : ''} you`}>
                      {b.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          <nav className="flex gap-1 overflow-x-auto border-b border-ops-line/60 bg-black/20 px-2 py-1.5" aria-label="Panels">
            {panelsFor(state, GROUPS.find((g) => g.id === group)!).map((id) => {
              const b = badges[id];
              return (
                <button
                  key={id}
                  type="button"
                  data-panel={id}
                  className={`fc-ptab ${panel === id ? 'is-on' : ''}`}
                  aria-current={panel === id ? 'page' : undefined}
                  onClick={() => setPanel(id)}
                >
                  {PANEL_LABEL[id]}
                  {b && b.count > 0 && <span className={`ml-1 text-[10px] ${b.bad ? 'text-ops-red' : 'text-ops-amber'}`}>{b.count}</span>}
                </button>
              );
            })}
          </nav>
          {/* One coach at a time: the tutorial while it runs, otherwise the next field note. */}
          {state.tutorial && state.tutorial.step < TUTORIAL_DONE && <TutorialCard state={state} onStep={(step) => act({ type: 'tutorial', step })} />}
          {tip && !(state.tutorial && state.tutorial.step < TUTORIAL_DONE) && (
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
          <div key={panel} className="fc-enter fc-scroll-fade min-h-0 flex-1 overflow-y-auto">
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
            {panel === 'guide' && <GuidePanel />}
            {panel === 'home' && <HomePanel state={slow} act={act} seen={seen} unread={unread} onPanel={setPanel} onSite={select} onLine={showMaterial} onMaterial={showMaterial} />}
            {panel === 'inbox' && <InboxPanel state={state} readKey={readKey} tip={tip} onMarkRead={markRead} onPanel={setPanel} onSite={select} />}
            </Suspense>
            </PanelBoundary>
          </div>
        </aside>
      {actNote && <ActNoteView note={actNote} />}
      <Briefing state={state} act={act} />
      {briefOpen && <CountryBrief state={state} onClose={() => setBriefOpen(false)} />}
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

const RES_TONE = {
  amber: 'text-ops-amber border-ops-amber/45 bg-ops-amber/10',
  green: 'text-ops-green border-ops-green/45 bg-ops-green/10',
  red: 'text-ops-red border-ops-red/50 bg-ops-red/10',
  cyan: 'text-ops-cyan border-ops-cyan/45 bg-ops-cyan/10',
} as const;

/** One readout in the command bar: an icon tile, a small label and a large figure. */
function Resource({ icon, label, tone, children, className = '' }: { icon: IconName; label: string; tone: keyof typeof RES_TONE; children: ReactNode; className?: string }) {
  return (
    <div className={`fc-res ${className}`}>
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-[2px] border ${RES_TONE[tone]}`}>
        <Icon name={icon} size={15} />
      </span>
      <span className="min-w-0 leading-none">
        <span className="label block whitespace-nowrap !text-[10px]">{label}</span>
        <span className="mt-0.5 block whitespace-nowrap font-sans text-[18px] font-bold">{children}</span>
      </span>
    </div>
  );
}

interface ActNote {
  key: number;
  text: string;
  money: string | null;
  tone: 'good' | 'bad' | 'info';
  x: number;
  y: number;
}

const short = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(2)}B` : v >= 1 ? `${Math.round(v)}M` : `${Math.round(v * 1000)}K`);

/** What an action (or a batch of them) did, for the note beside the pointer. */
function noteFor(before: SimState, after: SimState, n: number, why: string | null, at: { x: number; y: number; t: number }): ActNote {
  const recent = performance.now() - at.t < 1500;
  // Keyboard actions: beside whatever has focus.
  const box = !recent ? (document.activeElement as HTMLElement | null)?.getBoundingClientRect() : null;
  const x = recent ? at.x : box ? box.left + box.width / 2 : window.innerWidth / 2;
  const y = recent ? at.y : box ? box.top : 80;
  const key = Date.now();
  if (n === 0) return { key, text: why ?? 'Not possible just now.', money: null, tone: 'bad', x, y };
  const spent = after.treasury - before.treasury;
  const money = Math.abs(spent) >= 0.05 ? `${spent < 0 ? '−' : '+'}$${short(Math.abs(spent))}` : null;
  const fresh = after.feed.slice(before.feed.length);
  const text = n > 1 ? `${n} actions taken` : fresh.length ? tr(fresh[fresh.length - 1].text) : 'Done.';
  return { key, text, money, tone: why ? 'info' : 'good', x, y };
}

function ActNoteView({ note }: { note: ActNote }) {
  // Kept inside the window: above the point, and clear of the edges.
  const left = Math.max(12, Math.min(window.innerWidth - 332, note.x - 160));
  const top = Math.max(12, note.y - 56);
  return (
    <div key={note.key} className={`fc-actnote ${note.tone === 'bad' ? 'is-bad' : ''}`} style={{ left, top }} role="status" aria-live="polite">
      <span className="min-w-0 truncate">{note.text}</span>
      {note.money && <span className={`shrink-0 font-sans text-[14px] font-bold ${note.money.startsWith('−') ? 'text-ops-amber' : 'text-ops-green'}`}>{note.money}</span>}
    </div>
  );
}
