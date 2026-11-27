import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { newSim } from '../../src/sim/setup';
import { advanceDays, feed, openCampaign } from '../../src/sim/tick';
import type { SimState } from '../../src/sim/types';
import { SITES } from '../../src/sim/world';
import { GROUPS, PANEL_LABEL, allPanels, groupBadge, groupOf, panelBadges, panelsFor, type PanelId } from '../../src/game/nav';
import { DEFAULT_PAUSE, EVENT_KIND_IDS, eventKind, pauseFor } from '../../src/game/events';
import { feedKey, inboxItems, unreadCount } from '../../src/game/inbox';
import { placeCommands, score, search, type Command } from '../../src/game/CommandPalette';
import CommandPalette from '../../src/game/CommandPalette';
import { SiteCard, chainOf, quickActions } from '../../src/game/mapInfo';
import HomePanel, { changesSince, snapshot } from '../../src/game/HomePanel';
import InboxPanel from '../../src/game/InboxPanel';
import { SettingsDialog } from '../../src/game/Options';
import { watchList } from '../../src/game/WatchGuide';

const start = (seed = 1) => openCampaign(newSim({ seed }));
const noop = () => {};
const clean = (html: string) => {
  expect(html).not.toMatch(/NaN|undefined|Infinity/);
  return html.replace(/<!-- -->/g, '');
};

describe('grouped tabs', () => {
  it('every panel is in exactly one group, and every panel has a label', () => {
    const all = GROUPS.flatMap((g) => g.panels);
    expect(new Set(all).size).toBe(all.length);
    // Since 17.1, Watch and Feed are folded into Home and the Log: every other panel sits in a group.
    for (const p of Object.keys(PANEL_LABEL) as PanelId[]) expect(all.includes(p) || p === 'watch' || p === 'feed').toBe(true);
    expect(groupOf('strategy')).toBe('home');
    expect(groupOf('watch')).toBe('home');
    expect(groupOf('feed')).toBe('home');
    expect(groupOf('intel')).toBe('rival');
  });

  it('the story and sandbox tabs show only in those games', () => {
    const s = start();
    expect(allPanels(s)).not.toContain('story');
    expect(allPanels(s)).not.toContain('sandbox');
    expect(allPanels({ ...s, mode: 'sandbox' })).toContain('sandbox');
    expect(panelsFor(s, GROUPS[0])[0]).toBe('home');
  });

  it('badges count decisions, unread mail and watch items where their fix lives, and add up by group', () => {
    const s = start();
    s.strategy.decisions = [{ id: 1, kind: 'budget', title: 'x', body: '', options: [], fallback: 'a' }];
    const b = panelBadges(s, [{ tone: 'bad', panel: 'towns' }, { tone: 'warn', panel: 'towns' }, { tone: 'info', panel: 'power' }], 3);
    expect(b.strategy).toEqual({ count: 1, bad: true });
    expect(b.towns).toEqual({ count: 2, bad: true });
    expect(b.power).toBeUndefined();
    expect(b.inbox?.count).toBe(3);
    expect(groupBadge(s, b, GROUPS.find((g) => g.id === 'people')!)).toEqual({ count: 2, bad: true });
    // The Board and the Log sit in Command (17.1), so their counts add up there.
    expect(groupBadge(s, b, GROUPS.find((g) => g.id === 'home')!)).toEqual({ count: 4, bad: true });
    // The watch list's own "decisions waiting" line is not counted twice; promises due are counted on the Board.
    const w = panelBadges(s, [{ tone: 'warn', panel: 'strategy', text: '1 decision waiting on the Board tab.' }, { tone: 'warn', panel: 'strategy', text: 'Promise due in 1 month: x (Board tab).' }], 0);
    expect(w.strategy).toEqual({ count: 2, bad: true });
    for (const item of watchList(s)) expect(item.text.length).toBeGreaterThan(0);
  });
});

describe('pause rules', () => {
  it('sorts events into kinds', () => {
    expect(eventKind('Ransomware hits the control systems at X. A decision is waiting.', 'bad')).toBe('decision');
    expect(eventKind('Strike at X: production down to 30% for about 3 weeks.', 'bad')).toBe('labour');
    expect(eventKind('Crisis: the Artillery duel has begun.', 'bad')).toBe('crisis');
    expect(eventKind('Research complete: hardened fuzes.', 'good')).toBe('good');
    expect(eventKind('Intel: the rival is preparing drone swarms.', 'warn')).toBe('rival');
    expect(eventKind('Hackers breach X’s network: output halved.', 'bad')).toBe('security');
    expect(eventKind('Strikes on the grid black out the North.', 'bad')).toBe('power');
    expect(eventKind('Export ban: the Karsk Federation halts shipments from X.', 'bad')).toBe('disruption');
    expect(eventKind('The Auditor-General finds overbilling at X. A decision is waiting.', 'bad')).toBe('decision');
    expect(eventKind('The Committee votes your request down and sets the budget at $200M a month.', 'bad')).toBe('money');
    // The real crisis warnings, and a supplier's strike.
    expect(eventKind('Intel: tension rising over the Artillery duel (Eastern Marches). Expect heavy fighting there in about two months. Stock the depot now.', 'warn')).toBe('crisis');
    expect(eventKind('Intel: the Meric ice war is coming, with winter. Stock the north now.', 'warn')).toBe('crisis');
    expect(eventKind('A strike at Bowm Offshore Gas: output down to 58% for about 4 weeks.', 'bad')).toBe('labour');
    expect(EVENT_KIND_IDS).toHaveLength(10);
  });

  it('pauses for the worst event it cares about, and not at all when switched off', () => {
    const good = { day: 1, tone: 'good' as const, text: 'Research complete: x.', alert: true };
    const strike = { day: 1, tone: 'bad' as const, text: 'Strike at X.', alert: true };
    expect(pauseFor(DEFAULT_PAUSE, [good], false)).toBeNull();
    expect(pauseFor(DEFAULT_PAUSE, [good, strike], false)).toEqual({ ...strike, more: 0 });
    expect(pauseFor({ ...DEFAULT_PAUSE, kinds: { ...DEFAULT_PAUSE.kinds, labour: false } }, [strike], false)).toBeNull();
    expect(pauseFor({ ...DEFAULT_PAUSE, on: false }, [strike], true)).toBeNull();
    expect(pauseFor({ ...DEFAULT_PAUSE, monthEnd: true }, [], true)?.text).toMatch(/month is over/);
  });

  it('an update keeps every alert, not just the last one, and starts afresh', () => {
    const s = advanceDays(start(3), 200);
    // Over a long run some update collects more than one alert, and each update holds only its own.
    let most = 0;
    let t0 = s;
    for (let i = 0; i < 40; i++) {
      const before = t0.day;
      t0 = advanceDays(t0, 8);
      most = Math.max(most, t0.alerts!.length);
      for (const a of t0.alerts!) {
        expect(a.alert).toBe(true);
        expect(a.day).toBeGreaterThanOrEqual(before);
      }
    }
    expect(most).toBeGreaterThan(1);
    const t = structuredClone(s);
    feed(t, 'bad', 'one', undefined, true);
    feed(t, 'warn', 'two', undefined, true);
    expect(t.alerts!.slice(-2).map((a) => a.text)).toEqual(['one', 'two']);
  });
});

describe('the inbox', () => {
  it('counts alerts and bad news since the read mark, but not routine warnings', () => {
    const s = start();
    const mark = feedKey(s.feed.at(-1));
    expect(unreadCount(s, mark)).toBe(0);
    feed(s, 'warn', 'Kirby is losing people: too few jobs.');
    feed(s, 'bad', 'Strike at X: production down.');
    feed(s, 'good', 'Research complete: x.', undefined, true);
    expect(unreadCount(s, mark)).toBe(2);
    expect(unreadCount(s, feedKey(s.feed.at(-1)))).toBe(0);
    const items = inboxItems(s, mark);
    expect(items.filter((i) => i.unread).map((i) => i.text)).toEqual(['Research complete: x.', 'Strike at X: production down.']);
    expect(items.find((i) => i.text.startsWith('Strike'))?.panel).toBe('towns');
  });

  it('counts exactly what it shows: decision lines are left to the cards', () => {
    const s = start();
    const mark = feedKey(s.feed.at(-1));
    feed(s, 'warn', 'Pay claim in Kirby. A decision is waiting.', undefined, true);
    expect(unreadCount(s, mark)).toBe(0);
    feed(s, 'bad', 'Strike at X.', undefined, true);
    feed(s, 'bad', 'Strike at X.', undefined, true);
    expect(unreadCount(s, mark)).toBe(inboxItems(s, mark).filter((i) => i.unread && i.kind !== 'decision' && i.kind !== 'note').length);
    const keys = inboxItems(s, mark).map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('lists decision cards first, and field notes', () => {
    const s = start();
    s.strategy.decisions = [{ id: 7, kind: 'budget', title: 'The budget', body: '', options: [], fallback: 'a' }];
    s.tipsSeen = ['strike'];
    const items = inboxItems(s, '', { id: 'hearing', title: 'The hearing', text: 'Answer it.', panel: 'strategy' });
    expect(items[0]).toMatchObject({ kind: 'decision', text: 'The budget', unread: true });
    expect(items[1]).toMatchObject({ kind: 'note', unread: true });
    expect(items.at(-1)).toMatchObject({ kind: 'note', unread: false });
  });
});

describe('search', () => {
  const cmd = (label: string, group: Command['group'] = 'Site', hint?: string): Command => ({ id: label, group, label, hint, run: noop });

  it('matches word starts first, then inside words, then hints, and needs every word', () => {
    const list = [cmd('Corran Valley Works'), cmd('Northgate Integration Center'), cmd('Staff', 'Tab', 'Engineers and your chief of staff')];
    expect(search(list, 'corr')[0].label).toBe('Corran Valley Works');
    expect(search(list, 'valley works')).toHaveLength(1);
    expect(search(list, 'engineers')[0].label).toBe('Staff');
    expect(search(list, 'zzz')).toHaveLength(0);
    expect(score(cmd('Staff', 'Tab'), 'staff')).toBeGreaterThan(score(cmd('Staffordshire Works'), 'staff'));
  });

  it('finds every tab, site, material and town of the game', () => {
    const s = start();
    const went: string[] = [];
    const list = placeCommands(s, { panel: (p) => went.push(`p:${p}`), site: (id) => went.push(`s:${id}`), material: (m) => went.push(`m:${m}`) });
    expect(list.filter((c) => c.group === 'Tab')).toHaveLength(allPanels(s).length);
    expect(list.filter((c) => c.group === 'Site').length).toBeGreaterThan(SITES.length / 2);
    search(list, 'corran valley')[0].run();
    expect(went).toEqual(['s:corranWorks']);
    expect(list.every((c) => c.label && !/undefined/.test(c.label + (c.hint ?? '')))).toBe(true);
  });
});

describe('the map', () => {
  it('traces an arsenal’s suppliers and a supplier’s customers', () => {
    const s = start();
    const ch = chainOf(s, 'corranWorks')!;
    expect(ch.up.length).toBeGreaterThan(0);
    expect(ch.up).not.toContain('corranWorks');
    const supplier = ch.up[0];
    expect(chainOf(s, supplier)!.down).toContain('corranWorks');
    const depot = SITES.find((d) => d.kind === 'depot')!;
    expect(chainOf(s, depot.id)).toBeNull();
  });

  it('offers quick actions that fit the site, each checked', () => {
    const s = { ...start(), treasury: 5000 };
    const acts: unknown[] = [];
    const q = quickActions(s, 'corranWorks', { site: noop, material: noop, act: (a) => acts.push(a) });
    expect(q.map((x) => x.label)).toEqual(expect.arrayContaining(['Inspect', 'Vet the staff', 'Backup generators']));
    q.find((x) => x.label === 'Vet the staff')!.run();
    expect(acts).toEqual([{ type: 'vet', site: 'corranWorks' }]);
    const priv = SITES.find((d) => d.owner === 'private' && s.sites[d.id].processes.length)!;
    expect(quickActions(s, priv.id, { site: noop, material: noop, act: noop }).some((x) => x.label.startsWith('Invest in'))).toBe(true);
    expect(quickActions({ ...s, treasury: 0 }, 'corranWorks', { site: noop, material: noop, act: noop }).find((x) => x.label === 'Vet the staff')?.why).toBeTruthy();
  });

  it('every site has a hover card', () => {
    const s = advanceDays(start(), 40);
    for (const d of SITES) clean(renderToString(createElement(SiteCard, { state: s, id: d.id })));
  });
});

describe('home', () => {
  it('reports what changed since you last looked', () => {
    const s = start();
    const snap = snapshot(s);
    const later = advanceDays(s, 90);
    feed(later, 'bad', 'Strike at X: production down.', undefined, true);
    const ch = changesSince(later, snap);
    expect(ch.days).toBe(90);
    expect(ch.events.labour).toBeGreaterThanOrEqual(1);
    expect(ch.treasury).toBeCloseTo(later.treasury - s.treasury);
    expect(changesSince(later, snapshot(later)).days).toBe(0);
  });

  it('renders the dashboard, the inbox, search and every settings section', () => {
    const s: SimState = advanceDays(start(5), 150);
    s.strategy.decisions = [{ id: 1, kind: 'budget', title: 'x', body: '', options: [], fallback: 'a' }];
    const home = clean(renderToString(createElement(HomePanel, { state: s, act: noop, seen: snapshot(start(5)), unread: 4, onPanel: noop, onSite: noop, onLine: noop })));
    expect(home).toMatch(/Needs you now/);
    expect(home).toMatch(/Since you last looked · 150 days ago/);
    expect(home).toMatch(/Log · 4 new/);
    expect(clean(renderToString(createElement(InboxPanel, { state: s, readKey: '', tip: null, onMarkRead: noop, onPanel: noop, onSite: noop })))).toMatch(/Mark all read/);
    const list = placeCommands(s, { panel: noop, site: noop, material: noop });
    expect(clean(renderToString(createElement(CommandPalette, { commands: list, onClose: noop })))).toMatch(/Search and commands/);
    for (const initial of ['clock', 'sound', 'display', 'keys'] as const) {
      const html = clean(
        renderToString(
          createElement(SettingsDialog, {
            onClose: noop,
            initial,
            audio: { prefs: { sfx: true, music: false, volume: 0.5, sfxVolume: 0.7 }, set: noop },
            pause: { rules: DEFAULT_PAUSE, set: noop },
            tips: { on: true, set: noop },
          }),
        ),
      );
      expect(html).toMatch(initial === 'clock' ? /Pause at the end of every month/ : initial === 'sound' ? /Music volume/ : initial === 'display' ? /Reduce motion/ : /Ctrl K or \//);
    }
  });
});
