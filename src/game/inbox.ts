// The inbox: decisions, alerts, warnings and field notes in one list, with what is unread since you last looked.
import type { FeedItem, SimState } from '../sim/types';
import { EVENT_KINDS, eventKind, type EventKind } from './events';
import type { PanelId } from './nav';
import { TIPS } from './Tips';

export type InboxKind = 'decision' | 'alert' | 'warning' | 'note';

export interface InboxItem {
  key: string;
  kind: InboxKind;
  tone: FeedItem['tone'];
  day: number;
  text: string;
  /** What it is about, for the label. */
  about: string;
  site?: string;
  panel: PanelId;
  unread: boolean;
}

/** A feed line, identified by its day and text: lines are copied on every update, so objects cannot be compared. */
export const feedKey = (f?: Pick<FeedItem, 'day' | 'text'>) => (f ? `${f.day}|${f.text}` : '');

/** Feed lines that belong in the inbox. */
/** Alerts and bad news: routine warnings stay in the feed, or the inbox would drown in them. */
/** Decision lines are listed as the cards themselves, and counted on the Board. */
export const inInbox = (f: FeedItem) => (!!f.alert || f.tone === 'bad') && !/A decision is waiting/.test(f.text);

/** Where the read mark sits in the feed: the index of the last line read, or -1. */
function readIndex(feed: FeedItem[], readKey: string): number {
  if (!readKey) return -1;
  for (let i = feed.length - 1; i >= 0; i--) if (feedKey(feed[i]) === readKey) return i;
  return -1;
}

export function unreadCount(s: SimState, readKey: string): number {
  const from = readIndex(s.feed, readKey);
  let n = 0;
  for (let i = from + 1; i < s.feed.length; i++) if (inInbox(s.feed[i])) n++;
  return Math.min(99, n);
}

export function inboxItems(s: SimState, readKey: string, tip?: { id: string; title: string; text: string; panel: PanelId } | null): InboxItem[] {
  const out: InboxItem[] = [];
  for (const d of s.strategy.decisions) {
    out.push({ key: `d-${d.id}`, kind: 'decision', tone: 'warn', day: s.day, text: d.title, about: 'Decision waiting', site: d.site, panel: 'strategy', unread: true });
  }
  if (tip) out.push({ key: `tip-${tip.id}`, kind: 'note', tone: 'info', day: s.day, text: `${tip.title}. ${tip.text}`, about: 'Field note', panel: tip.panel, unread: true });
  const from = readIndex(s.feed, readKey);
  // Keys from the line itself, so they stay put as the feed scrolls.
  const seenKeys = new Map<string, number>();
  for (let i = s.feed.length - 1; i >= 0 && out.length < 120; i--) {
    const f = s.feed[i];
    if (!inInbox(f)) continue;
    const k: EventKind = eventKind(f.text, f.tone);
    const fk = feedKey(f);
    const dup = seenKeys.get(fk) ?? 0;
    seenKeys.set(fk, dup + 1);
    out.push({
      key: `f-${fk}-${dup}`,
      kind: f.alert ? 'alert' : 'warning',
      tone: f.tone,
      day: f.day,
      text: f.text,
      about: EVENT_KINDS[k].label,
      site: f.site,
      panel: EVENT_KINDS[k].panel,
      unread: i > from,
    });
  }
  // Field notes already read in this game, for reference.
  for (const id of [...(s.tipsSeen ?? [])].reverse()) {
    const t = TIPS.find((x) => x.id === id);
    if (t) out.push({ key: `seen-${id}`, kind: 'note', tone: 'info', day: -1, text: `${t.title}. ${t.text}`, about: 'Field note', panel: t.panel, unread: false });
  }
  return out;
}
