// Navigation: the panels, grouped so the tab bar stays short, with a count of what needs you in each.
import type { SimState } from '../sim/types';

export type PanelId =
  | 'home'
  | 'inbox'
  | 'watch'
  | 'site'
  | 'plan'
  | 'material'
  | 'markets'
  | 'build'
  | 'stockpile'
  | 'logistics'
  | 'fight'
  | 'strategy'
  | 'money'
  | 'news'
  | 'feed'
  | 'guide'
  | 'sandbox'
  | 'intel'
  | 'policy'
  | 'industry'
  | 'story'
  | 'testing'
  | 'towns'
  | 'allies'
  | 'power'
  | 'stats'
  | 'staff';

export const PANEL_LABEL: Record<PanelId, string> = {
  home: 'Home',
  inbox: 'Inbox',
  watch: 'Watch',
  site: 'Site',
  plan: 'Plan',
  material: 'Materials',
  markets: 'Markets',
  build: 'Build',
  stockpile: 'Stockpile',
  logistics: 'Logistics',
  fight: 'Fight',
  strategy: 'Board',
  money: 'Money',
  news: 'Courier',
  feed: 'Feed',
  guide: 'Guide',
  sandbox: 'Sandbox',
  intel: 'Intel',
  policy: 'Policy',
  industry: 'Industry',
  story: 'Story',
  testing: 'Testing',
  towns: 'Towns',
  allies: 'Allies',
  power: 'Power',
  stats: 'Stats',
  staff: 'Staff',
};

/** What each panel is for, for the command palette. */
export const PANEL_BLURB: Record<PanelId, string> = {
  home: 'The overview: key numbers, what needs you, what changed',
  inbox: 'Decisions, alerts, warnings and field notes in one place',
  watch: 'The advisor and everything that needs you',
  site: 'The selected site',
  plan: 'Forecasts and weak links',
  material: 'Trace a material from round to mine',
  markets: 'Prices, tenders, contracts and exports',
  build: 'Rail links, upgrades and resilience',
  stockpile: 'Ageing stock, surveillance and disposal',
  logistics: 'Depot targets and traffic',
  fight: 'Threats, leakers and doctrine',
  strategy: 'Research, key staff, decisions and the Committee',
  money: 'Income, spending and oversight',
  news: 'The monthly newspaper',
  feed: 'Everything that happened',
  guide: 'How the game works',
  sandbox: 'Change the rules as you play',
  intel: 'The rival, operations, spies and hackers',
  policy: 'Programmes and standing policies',
  industry: 'Open plots, in-house lines and designs',
  story: 'The chapter and its goals',
  testing: 'Test ranges and acceptance',
  towns: 'Moods, housing, unions and permits',
  allies: 'Allies, co-production and the export desk',
  power: 'Grids, blackouts and generators',
  stats: 'The term in charts',
  staff: 'Engineers and your chief of staff',
};

export type GroupId = 'home' | 'production' | 'supply' | 'people' | 'rival' | 'records';

export const GROUPS: { id: GroupId; label: string; panels: PanelId[] }[] = [
  { id: 'home', label: 'Home', panels: ['home', 'inbox', 'watch', 'story', 'sandbox', 'guide'] },
  { id: 'production', label: 'Production', panels: ['site', 'plan', 'material', 'industry', 'testing', 'stockpile'] },
  { id: 'supply', label: 'Supply', panels: ['markets', 'build', 'logistics', 'power', 'allies'] },
  { id: 'people', label: 'People', panels: ['strategy', 'towns', 'staff', 'policy'] },
  { id: 'rival', label: 'Rival', panels: ['intel', 'fight'] },
  { id: 'records', label: 'Records', panels: ['money', 'stats', 'news', 'feed'] },
];

export const groupOf = (p: PanelId): GroupId => GROUPS.find((g) => g.panels.includes(p))?.id ?? 'home';

/** The panels this game shows: the story and sandbox tabs only in those modes. */
export function panelsFor(s: Pick<SimState, 'story' | 'mode'>, g: { panels: PanelId[] }): PanelId[] {
  return g.panels.filter((p) => (p !== 'story' || !!s.story) && (p !== 'sandbox' || s.mode === 'sandbox'));
}

/** Every panel in tab order, for [ and ]. */
export const allPanels = (s: Pick<SimState, 'story' | 'mode'>) => GROUPS.flatMap((g) => panelsFor(s, g));

export interface Badge {
  count: number;
  bad: boolean;
}
export const EMPTY_BADGE: Badge = { count: 0, bad: false };

/** Badges per panel: decisions, the inbox, and the watch list's items by the tab where each fix lives. */
export function panelBadges(s: SimState, watch: { tone: string; panel?: string; text?: string }[], unread: number): Partial<Record<PanelId, Badge>> {
  const out: Partial<Record<PanelId, Badge>> = {};
  const add = (p: PanelId, n: number, bad: boolean) => {
    const b = out[p] ?? { count: 0, bad: false };
    out[p] = { count: b.count + n, bad: b.bad || bad };
  };
  if (s.strategy.decisions.length) add('strategy', s.strategy.decisions.length, true);
  if (unread) add('inbox', unread, false);
  // The watch list's "decisions waiting" line repeats the decision count above.
  for (const w of watch) if (w.panel && w.tone !== 'info' && !/decisions? waiting/.test(w.text ?? '')) add(w.panel as PanelId, 1, w.tone === 'bad');
  return out;
}

export function groupBadge(s: Pick<SimState, 'story' | 'mode'>, badges: Partial<Record<PanelId, Badge>>, g: { panels: PanelId[] }): Badge {
  let count = 0;
  let bad = false;
  for (const p of panelsFor(s, g)) {
    const b = badges[p];
    if (!b) continue;
    count += b.count;
    bad ||= b.bad;
  }
  return { count, bad };
}
