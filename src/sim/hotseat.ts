// Hot-seat two-player: two directors share one device, one treasury and one rail network. Each runs half the
// country, control passes at every month end, and each is scored on their own half.
import { BASE_LINES } from './fight';
import { baseDailyDraw, lotQty } from './selectors';
import type { FeedItem, SimState } from './types';
import { MATERIALS, RECIPES, SITES, SITE_BY_ID, type RegionId } from './world';

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

export interface HotseatPlayer {
  name: string;
  command: string;
  regions: RegionId[];
  score: number;
  /** $M this player has spent this month. */
  spent: number;
}

export interface HotseatState {
  players: [HotseatPlayer, HotseatPlayer];
  /** Whose month it is. */
  active: 0 | 1;
  /** Waiting for the device to change hands. */
  handover: boolean;
}

/** Corran's arsenal goes west, so each side has arsenals of its own. */
const WEST_EXTRA = ['corranWorks'];

export function newHotseat(names: [string, string]): HotseatState {
  return {
    players: [
      { name: names[0] || 'Player 1', command: 'Western Command', regions: ['north', 'coast', 'isles'], score: 0, spent: 0 },
      { name: names[1] || 'Player 2', command: 'Eastern Command', regions: ['east', 'central'], score: 0, spent: 0 },
    ],
    active: 0,
    handover: true,
  };
}

/** Which player runs a site: by region, with Corran's arsenal in the west. */
export function controllerOf(h: HotseatState, siteId: string): 0 | 1 {
  if (WEST_EXTRA.includes(siteId)) return 0;
  return h.players[0].regions.includes(SITE_BY_ID[siteId].region) ? 0 : 1;
}

/** Why the active player may not act on a site, or null. */
export function controlBlock(s: SimState, siteId: string | undefined): string | null {
  const h = s.hotseat;
  if (!h || !siteId || SITE_BY_ID[siteId]?.owner !== 'state') return null;
  const c = controllerOf(h, siteId);
  return c === h.active ? null : `${h.players[c].name} (${h.players[c].command}) runs ${SITE_BY_ID[siteId].name}.`;
}

/** How well a player's own bases are stocked, 0..1. */
function stocked(s: SimState, p: HotseatPlayer): number {
  let have = 0;
  let need = 0;
  for (const def of SITES) {
    if (!p.regions.includes(def.region) || !BASE_LINES[def.kind]) continue;
    for (const l of BASE_LINES[def.kind]!) {
      const d = baseDailyDraw(s, def.id, l);
      if (d <= 0) continue;
      need += 1;
      have += Math.min(1, lotQty(s.sites[def.id].lots[l]) / Math.max(1, d * s.policy.baseDays));
    }
  }
  return need ? have / need : 1;
}

/** Value made this month at a player's own plants, $M. */
function output(s: SimState, i: 0 | 1): number {
  let v = 0;
  for (const def of SITES) {
    if (def.owner !== 'state' || controllerOf(s.hotseat!, def.id) !== i) continue;
    for (const p of s.sites[def.id].processes) v += p.lastOutput * 30 * MATERIALS[RECIPES[p.recipe].output].price;
  }
  return v;
}

/** Month end: score both sides, then hand the device over. */
export function hotseatMonth(s: SimState, feed: Feed): void {
  const h = s.hotseat;
  if (!h) return;
  const total = h.players[0].spent + h.players[1].spent;
  h.players.forEach((p, i) => {
    const share = total > 0 ? p.spent / total : 0.5;
    const gain = 10 * stocked(s, p) + Math.min(10, output(s, i as 0 | 1) / 40) - Math.max(0, share - 0.6) * 10;
    p.score = Math.round((p.score + gain) * 10) / 10;
    p.spent = 0;
  });
  h.active = h.active === 0 ? 1 : 0;
  h.handover = true;
  feed(s, 'info', `Month over. ${h.players[h.active].name}, ${h.players[h.active].command}: your turn.`, undefined, true);
}

/** Who leads, for the end of the game. */
export function winner(h: HotseatState): string {
  const [a, b] = h.players;
  if (Math.abs(a.score - b.score) < 1) return 'A draw';
  return `${a.score > b.score ? a.name : b.name} wins`;
}
