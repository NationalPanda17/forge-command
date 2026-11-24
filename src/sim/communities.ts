// Communities and permits: every town has a mood toward you. Jobs and community funds lift it; open burning, test
// firings, noisy round-the-clock plants and lay-offs sour it. New plants and rail links need a local permit, and an
// unhappy town objects: win it over, override it, or withdraw. Very unhappy towns protest at your gates, and the town
// beside the burning pit can take you to court.
import { clamp, pick, rand, randInt } from './rng';
import { troubleScale } from './scale';
import { townIndex, townOf } from './towns';
import type { FeedItem, SimState } from './types';
import { CITIES, SITES, SITE_BY_ID } from './world';

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

export interface Permit {
  id: number;
  /** A plant founded on a plot, or a new rail link. */
  kind: 'plant' | 'link';
  /** The plot's site id, or the project id of the link. */
  target: string;
  project?: number;
  town: number;
  /** In a two-player game, the director who started the work. */
  player?: number;
}

export interface CommunityState {
  /** Mood toward you, by town in city-list order, 0..100. */
  mood: number[];
  /** Permits held up by an objection, waiting on your decision. */
  permits: Permit[];
  /** Day each town can next receive a community fund, and an open day. */
  fundReady: Record<number, number>;
  openDayReady: Record<number, number>;
  /** Until this day a court order bans open burning at the demilitarization site. */
  burnBanUntil: number;
}

export const newCommunities = (): CommunityState => ({ mood: CITIES.map(() => 55), permits: [], fundReady: {}, openDayReady: {}, burnBanUntil: 0 });

export const DEMIL = 'karrowDemil';
export const fundCost = (s: SimState) => Math.round(8 * s.priceIndex);
export const openDayCost = (s: SimState) => Math.round(1 * s.priceIndex);
export const packageCost = (s: SimState) => Math.round(10 * s.priceIndex);
export const FUND_DAYS = 180;
export const OPEN_DAY_DAYS = 60;

export const moodOf = (s: SimState, siteId: string) => s.communities?.mood[townIndex(townOf(siteId))] ?? 55;
export const MOOD_WORD = (m: number) => (m >= 70 ? 'warm' : m >= 50 ? 'content' : m >= 35 ? 'uneasy' : m >= 20 ? 'angry' : 'hostile');

const shift = (s: SimState, town: number, v: number) => {
  if (town >= 0 && s.communities.mood[town] !== undefined) s.communities.mood[town] = clamp(s.communities.mood[town] + v);
};
/** Moves the mood of the town a site belongs to. */
export const moodAt = (s: SimState, siteId: string, v: number) => shift(s, townIndex(townOf(siteId)), v);

/** Towns where you have a stake: those with your working plants, and the town beside the burning pit. */
export function communityTowns(s: SimState): number[] {
  const t = SITES.filter((d) => d.owner === 'state' && s.sites[d.id].processes.length > 0 && s.sites[d.id].status !== 'closed').map((d) => townIndex(townOf(d.id)));
  return [...new Set([...t, townIndex(townOf(DEMIL))])].filter((i) => i >= 0).sort((a, b) => a - b);
}

/** Chance a town objects to a new plant or link: none while it is content, rising as it sours. */
export const objectionOdds = (mood: number) => clamp((50 - mood) / 50, 0, 0.8);

/** Called when a plant is founded or a rail link begins: an unhappy town may object, holding the work up. */
export function seekPermit(s: SimState, kind: Permit['kind'], target: string, siteForTown: string, feed: Feed, project?: number): void {
  const town = townIndex(townOf(siteForTown));
  const mood = s.communities.mood[town] ?? 55;
  const odds = objectionOdds(mood) * Math.min(1, troubleScale(s));
  // No objection is possible from a content town: no draw, so the game plays out as before.
  if (odds <= 0 || rand(s) >= odds) return;
  const id = s.nextId++;
  s.communities.permits.push({ id, kind, target, project, town, player: s.hotseat?.active });
  const what = kind === 'plant' ? `the new plant at ${SITE_BY_ID[target].name}` : 'the new rail link';
  const cost = packageCost(s);
  s.strategy.decisions.push({
    id: s.nextId++,
    kind: 'permit',
    title: `${CITIES[town].name} objects`,
    body: `Residents of ${CITIES[town].name}, ${MOOD_WORD(mood)} with you already, have objected to ${what}. Work is on hold until the permit is settled.`,
    options: [
      { id: 'package', label: `Win them over ($${cost}M)`, detail: 'A community package: a clinic, a sports ground, road repairs. The permit is granted and the town warms to you.' },
      { id: 'override', label: 'Override the objection', detail: 'Work resumes now. The town and the regional members will resent it.' },
      { id: 'withdraw', label: 'Withdraw', detail: 'Give it up and recover most of the money.' },
    ],
    fallback: 'override',
    value: cost,
    site: kind === 'plant' ? target : undefined,
    data: { chain: id },
  });
  feed(s, 'warn', `${CITIES[town].name} objects to ${what}. A decision is waiting.`, kind === 'plant' ? target : undefined, true);
}

/** Is construction on this plot, or this project, held up by an objection? */
export const permitHeld = (s: SimState, target: string) => !!s.communities?.permits.some((p) => p.target === target || String(p.project) === target);

export function resolveCommunity(s: SimState, d: { kind: string; value?: number; data?: { chain?: number } }, opt: string, feed: Feed, refund: (p: Permit) => number): boolean {
  if (d.kind !== 'permit') return false;
  const p = s.communities.permits.find((x) => x.id === d.data?.chain);
  if (!p) return true;
  s.communities.permits = s.communities.permits.filter((x) => x.id !== p.id);
  const name = CITIES[p.town].name;
  if (opt === 'package') {
    s.treasury -= d.value ?? 0;
    s.month.spend.projects += d.value ?? 0;
    shift(s, p.town, 15);
    feed(s, 'good', `A community package wins ${name} over: the permit is granted and work resumes.`);
  } else if (opt === 'withdraw') {
    const back = refund(p);
    s.treasury += back;
    s.month.income.sales += back;
    shift(s, p.town, 5);
    feed(s, 'info', `You withdraw. $${Math.round(back)}M of the money is recovered, and ${name} is relieved.`);
  } else {
    shift(s, p.town, -20);
    s.strategy.factions.regions = clamp(s.strategy.factions.regions - 3);
    feed(s, 'warn', `You override ${name}'s objection. Work resumes, and the town will remember.`);
  }
  return true;
}

export function validateCommunity(s: SimState, a: { type: string; town?: number }): string | null {
  const t = a.town!;
  if (!CITIES[t]) return 'No such town.';
  if (a.type === 'communityFund') {
    if ((s.communities.fundReady[t] ?? 0) > s.day) return 'A fund was given there recently.';
    if (s.communities.mood[t] >= 90) return 'The town could hardly be happier.';
    return s.treasury >= fundCost(s) ? null : `Not enough money (needs $${fundCost(s)}M).`;
  }
  if (a.type === 'openDay') {
    if ((s.communities.openDayReady[t] ?? 0) > s.day) return 'You held an open day there recently.';
    if (!SITES.some((d) => d.owner === 'state' && townIndex(townOf(d.id)) === t && s.sites[d.id].processes.length)) return 'You have no plant there to open.';
    return s.treasury >= openDayCost(s) ? null : `Not enough money (needs $${openDayCost(s)}M).`;
  }
  return null;
}

export function applyCommunity(s: SimState, a: { type: string; town?: number }, feed: Feed): void {
  const t = a.town!;
  if (a.type === 'communityFund') {
    s.treasury -= fundCost(s);
    s.month.spend.projects += fundCost(s);
    s.communities.fundReady[t] = s.day + FUND_DAYS;
    shift(s, t, 12);
    feed(s, 'good', `A community fund for ${CITIES[t].name}: a new library and a youth club. The town warms to you.`);
  } else if (a.type === 'openDay') {
    s.treasury -= openDayCost(s);
    s.month.spend.projects += openDayCost(s);
    s.communities.openDayReady[t] = s.day + OPEN_DAY_DAYS;
    shift(s, t, 4);
    feed(s, 'info', `Families in ${CITIES[t].name} tour your plant on an open day.`);
  }
}

/** The month's mood: drift toward content, then what you did to each town. */
export function communitiesMonth(s: SimState, feed: Feed): void {
  const c = s.communities;
  for (let i = 0; i < c.mood.length; i++) c.mood[i] = clamp(c.mood[i] + (55 - c.mood[i]) * 0.05);
  // Open burning: smoke over the town beside the pit.
  if (s.policy.demilMethod === 'burn' && s.month.demilled > 0) moodAt(s, DEMIL, -Math.min(4, s.month.demilled / 1000));
  // Test firings: the ranges are loud.
  for (const t of s.tests ?? []) if (t.range && t.investigating === 0 && s.day - (t.queued ?? 0) >= 10) moodAt(s, t.range, -0.8);
  // Your plants: jobs please; noisy round-the-clock shifts do not.
  for (const d of SITES) {
    if (d.owner !== 'state') continue;
    const site = s.sites[d.id];
    if (!site.processes.length || site.status === 'closed' || site.mothballed) continue;
    if (site.workers > 200) moodAt(s, d.id, 0.4);
    if (site.processes.some((p) => p.run === 'surge')) moodAt(s, d.id, -0.6);
  }
  // A content country is a quieter Committee; an angry one is not.
  const towns = communityTowns(s);
  const avg = towns.reduce((a, t) => a + c.mood[t], 0) / Math.max(1, towns.length);
  // Centred on the towns' resting mood, so content towns leave the regional members where they are.
  s.strategy.factions.regions = clamp(s.strategy.factions.regions + (avg - 55) * 0.02);
  // Protests and the court.
  if (s.day < 120 || (s.scenario === 'tutorial' && s.day < 360)) return;
  for (const t of towns) {
    if (c.mood[t] >= 30 || rand(s) >= 0.25 * troubleScale(s)) continue;
    const here = SITES.filter((d) => d.owner === 'state' && townIndex(townOf(d.id)) === t && s.sites[d.id].processes.length && s.sites[d.id].status === 'active' && !s.sites[d.id].mothballed);
    if (!here.length) continue;
    const def = pick(s, here);
    const site = s.sites[def.id];
    site.disruptionDays = Math.max(site.disruptionDays, randInt(s, 5, 12));
    site.disruptionFactor = Math.min(site.disruptionFactor, 0.7);
    s.strategy.factions.regions = clamp(s.strategy.factions.regions - 1);
    s.month.protests = (s.month.protests ?? 0) + 1;
    feed(s, 'bad', `Protesters block the gates at ${def.name}: output down to 70% for about ${Math.round(site.disruptionDays / 7) || 1} week${site.disruptionDays > 10 ? 's' : ''}.`, def.id, true);
  }
  const pit = townIndex(townOf(DEMIL));
  if (s.policy.demilMethod === 'burn' && c.mood[pit] < 25 && c.burnBanUntil <= s.day && rand(s) < 0.3 * troubleScale(s)) {
    c.burnBanUntil = s.day + 180;
    s.policy = { ...s.policy, demilMethod: 'recycle' };
    s.recycleChosen = false;
    feed(s, 'bad', `Residents of ${CITIES[pit].name} win a court order: no open burning at the demilitarization site for six months. Old rounds must be recycled.`, DEMIL, true);
  }
}

/** Mothballing a plant hurts its town. */
export const onMothball = (s: SimState, siteId: string) => moodAt(s, siteId, -10);
/** New homes please a town. */
export const onHousing = (s: SimState, town: number) => shift(s, town, 3);
