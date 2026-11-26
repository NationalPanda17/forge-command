// Kinds of event, for the inbox, the pause rules and the command palette: what a feed line is about, and the tab
// that deals with it.
import type { FeedItem } from '../sim/types';
import type { PanelId } from './nav';

export type EventKind = 'decision' | 'crisis' | 'rival' | 'security' | 'labour' | 'power' | 'disruption' | 'money' | 'good' | 'other';

export const EVENT_KINDS: Record<EventKind, { label: string; blurb: string; panel: PanelId }> = {
  decision: { label: 'Decisions and hearings', blurb: 'A decision card or the budget hearing is waiting.', panel: 'strategy' },
  crisis: { label: 'Crises', blurb: 'A crisis is announced or begins.', panel: 'logistics' },
  rival: { label: 'The rival', blurb: 'Intel reports a new weapon, or the rival fields one.', panel: 'intel' },
  security: { label: 'Spies, hackers and sabotage', blurb: 'Cyber attacks, sabotage, stolen designs and leaks.', panel: 'intel' },
  labour: { label: 'Strikes and towns', blurb: 'Strikes, protests, permit objections and court orders.', panel: 'towns' },
  power: { label: 'Power', blurb: 'Blackouts and fuel shocks.', panel: 'power' },
  disruption: { label: 'Accidents and disruptions', blurb: 'Accidents, export bans, closures and suppliers in trouble.', panel: 'markets' },
  money: { label: 'Money and the Committee', blurb: 'Budgets, audits, overbilling and broken promises.', panel: 'money' },
  good: { label: 'Good news', blurb: 'Research done, plants opened, rounds accepted, operations that succeed.', panel: 'feed' },
  other: { label: 'Everything else', blurb: 'Any other important event.', panel: 'feed' },
};
export const EVENT_KIND_IDS = Object.keys(EVENT_KINDS) as EventKind[];

/** What a feed line is about. */
export function eventKind(text: string, tone: FeedItem['tone']): EventKind {
  if (/A decision is waiting|^Budget hearing|^Month over\./.test(text)) return 'decision';
  if (/^Crisis|^Sandbox: the .* begins|^Intel: tension rising|is coming, with winter|Expect heavy fighting/.test(text)) return 'crisis';
  if (tone === 'good') return 'good';
  if (/^Intel: | fields /.test(text)) return 'rival';
  if (/Ransomware|[Hh]ackers|cyber attack|[Ss]abotage|spy ring|stolen|leaked|Suspect parts|operation is exposed|^Operation fails/.test(text)) return 'security';
  // Power first: "Strikes on the grid black out…" is an air raid, not a walkout.
  if (/blackout|black out|fuel prices|[Pp]ower costs/.test(text)) return 'power';
  if (/^Strike at|^The strike|^A strike at|walks out|[Ww]ork to rule|Protesters|objects to|court order|mothballed|union/i.test(text)) return 'labour';
  if (/Accident|disrupted|output down|has closed|Export ban|financial trouble|pulls out|closes .* short/.test(text)) return 'disruption';
  if (/Committee|Auditor|auditors|budget|Promise broken|overbilling/i.test(text)) return 'money';
  return 'other';
}

/** The tab for a feed line. */
export const panelFor = (f: Pick<FeedItem, 'text' | 'tone'>): PanelId => EVENT_KINDS[eventKind(f.text, f.tone)].panel;

// ---------- Pause rules, kept in this browser ----------

export interface PauseRules {
  /** Pause for important events at all. */
  on: boolean;
  kinds: Record<EventKind, boolean>;
  /** Pause when each month ends. */
  monthEnd: boolean;
}
const KEY = 'forge-command-pause';
export const DEFAULT_PAUSE: PauseRules = {
  on: true,
  // Minor news ("everything else") no longer stops the clock by default: it was most of the interruptions at speed.
  kinds: { decision: true, crisis: true, rival: true, security: true, labour: true, power: true, disruption: true, money: true, good: false, other: false },
  monthEnd: false,
};
export function loadPauseRules(): PauseRules {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<PauseRules> | null;
    if (!raw) return structuredClone(DEFAULT_PAUSE);
    return { ...DEFAULT_PAUSE, ...raw, kinds: { ...DEFAULT_PAUSE.kinds, ...(raw.kinds ?? {}) } };
  } catch {
    return structuredClone(DEFAULT_PAUSE);
  }
}
export function savePauseRules(r: PauseRules): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    /* storage may be unavailable */
  }
}

/** The event that stops the clock, and how many other pausing events arrived with it (they are in the log). */
export type PauseHit = (FeedItem | { text: string; tone: 'info'; day: number }) & { more?: number };

/** The event that should stop the clock, if any, among those that just happened. */
export function pauseFor(rules: PauseRules, alerts: FeedItem[], monthEnded: boolean): PauseHit | null {
  if (!rules.on) return null;
  // The worst first: a bad event over a warning over good news.
  const rank = { bad: 0, warn: 1, info: 2, good: 3 } as const;
  const pausing = [...alerts].sort((a, b) => rank[a.tone] - rank[b.tone]).filter((a) => rules.kinds[eventKind(a.text, a.tone)]);
  if (pausing.length) return { ...pausing[0], more: pausing.length - 1 };
  if (rules.monthEnd && monthEnded) return { text: 'The month is over.', tone: 'info', day: alerts[0]?.day ?? 0 };
  return null;
}
