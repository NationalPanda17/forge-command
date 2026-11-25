// The people who run things: a named manager at each of your plants, each with a trait that shapes how the plant runs,
// and a leader for each town's union with a temperament of their own. Managers grow with promotion, grow restless when
// the plant is unhappy, and can be tempted away by private firms; union leaders come and go at union elections.
import { clamp, pick, rand, randInt, seedFrom } from './rng';
import { FIRST_NAMES, LAST_NAMES } from './names';
import { townIndex, townOf } from './towns';
import type { FeedItem, SimState } from './types';
import { CITIES, SITES, SITE_BY_ID } from './world';

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

export type Trait = 'driver' | 'safety' | 'popular' | 'meticulous' | 'mentor' | 'cornerCutter';
export const TRAITS: Record<Trait, { name: string; blurb: string }> = {
  driver: { name: 'Driver', blurb: 'Pushes for output (+4%, rising by half with each promotion), but crews tire faster.' },
  safety: { name: 'Safety first', blurb: 'Fewer accidents (−20%, more with each promotion) and a little better morale.' },
  popular: { name: 'Popular', blurb: 'Crews like them: morale +3 (more with each promotion), and the town’s union cools.' },
  meticulous: { name: 'Meticulous', blurb: 'Scrap falls 12%, more with each promotion.' },
  mentor: { name: 'Mentor', blurb: 'Crews learn faster and can grow more skilled.' },
  cornerCutter: { name: 'Corner-cutter', blurb: 'Output +7% (more with each promotion), but accidents rise sharply and scrap creeps up.' },
};
export const TRAIT_IDS = Object.keys(TRAITS) as Trait[];

export type Temper = 'firebrand' | 'pragmatist' | 'moderate';
export const TEMPERS: Record<Temper, { name: string; blurb: string }> = {
  firebrand: { name: 'Firebrand', blurb: 'Claims come more often and strikes spread further; hard to talk down.' },
  pragmatist: { name: 'Pragmatist', blurb: 'Open to a counter-offer: talks succeed more often.' },
  moderate: { name: 'Moderate', blurb: 'The union slowly loses its edge.' },
};
export const TEMPER_IDS = Object.keys(TEMPERS) as Temper[];

export interface Manager {
  id: number;
  name: string;
  trait: Trait;
  /** 1 to 3: each promotion strengthens the trait. */
  level: number;
  /** 0..100: below 45, private firms can tempt them away. */
  loyalty: number;
  since: number;
}

export interface Leader {
  name: string;
  temper: Temper;
  since: number;
}

export interface CastState {
  /** The cast's own random sequence, so its dice never shift the rest of the game's. */
  rng: number;
  managers: Record<string, Manager>;
  leaders: Record<number, Leader>;
  /** Candidates you could appoint, refreshed every quarter. */
  pool: Manager[];
  poolDay: number;
}

export const MAX_LEVEL = 3;
export const promoteCost = (s: SimState, m: Manager) => Math.round(4 * m.level * s.priceIndex);
export const matchCost = (s: SimState, m: Manager) => Math.round(2 * m.level * s.priceIndex);
const ELECTION_DAYS = 720;

/** Your plants with a manager's job: running, with lines. */
export const managedPlants = (s: SimState) => SITES.filter((d) => d.owner === 'state' && s.sites[d.id]?.processes.length > 0 && s.sites[d.id].status !== 'closed');

/** The cast's dice. */
const R = (s: SimState): { rng: number } => s.cast;

function person(s: SimState, trait?: Trait): Manager {
  return { id: s.nextId++, name: `${pick(R(s), FIRST_NAMES)} ${pick(R(s), LAST_NAMES)}`, trait: trait ?? pick(R(s), TRAIT_IDS), level: 1, loyalty: randInt(R(s), 55, 75), since: s.day };
}

function freshPool(s: SimState): Manager[] {
  return [0, 1, 2, 3].map(() => {
    const m = person(s);
    // Some candidates come with experience.
    if (rand(R(s)) < 0.3) m.level = 2;
    m.loyalty = 60;
    return m;
  });
}

export function newCast(s: SimState): CastState {
  const c: CastState = { rng: seedFrom(`cast|${s.seed}|${s.day}`), managers: {}, leaders: {}, pool: [], poolDay: s.day };
  s.cast = c;
  for (const d of managedPlants(s)) {
    const m = person(s);
    m.level = rand(R(s)) < 0.4 ? 2 : 1;
    c.managers[d.id] = m;
  }
  for (const t of unionTownsOf(s)) c.leaders[t] = { name: `${pick(R(s), FIRST_NAMES)} ${pick(R(s), LAST_NAMES)}`, temper: pick(R(s), TEMPER_IDS), since: s.day - randInt(R(s), 0, 600) };
  c.pool = freshPool(s);
  return c;
}

const unionTownsOf = (s: SimState) => [...new Set(managedPlants(s).map((d) => townIndex(townOf(d.id))))].filter((i) => i >= 0);

// ---------- Effects ----------

/** How strong a trait is at a manager's level: 1, 1.5, 2. */
const k = (m: Manager) => 0.5 + 0.5 * m.level;
const mgr = (s: SimState, site: string, t: Trait) => {
  const m = s.cast?.managers[site];
  return m && m.trait === t ? k(m) : 0;
};

export const managerOutput = (s: SimState, site: string) => 1 + 0.04 * mgr(s, site, 'driver') + 0.07 * mgr(s, site, 'cornerCutter');
export const managerFatigue = (s: SimState, site: string) => 1 + 0.2 * mgr(s, site, 'driver');
export const managerAccidents = (s: SimState, site: string) => Math.max(0.2, 1 - 0.2 * mgr(s, site, 'safety')) * (1 + 0.35 * mgr(s, site, 'cornerCutter'));
export const managerMorale = (s: SimState, site: string) => 3 * mgr(s, site, 'popular') + 1 * mgr(s, site, 'safety');
export const managerScrap = (s: SimState, site: string) => Math.max(0.3, 1 - 0.12 * mgr(s, site, 'meticulous')) * (1 + 0.05 * mgr(s, site, 'cornerCutter'));
export const managerSkillCap = (s: SimState, site: string) => 3 * mgr(s, site, 'mentor');
export const managerSkillRate = (s: SimState, site: string) => 1 + 0.4 * mgr(s, site, 'mentor');

const leader = (s: SimState, town: number) => s.cast?.leaders[town]?.temper;
/** How much likelier the town's union is to bring a claim or spread a strike. */
export const leaderHeat = (s: SimState, town: number) => (leader(s, town) === 'firebrand' ? 1.3 : 1);
/** Change in the odds a counter-offer is accepted. */
export const leaderTalk = (s: SimState, town: number) => (leader(s, town) === 'pragmatist' ? 0.15 : leader(s, town) === 'firebrand' ? -0.1 : 0);
/** The union's monthly drift from its leader and the popular managers in town. */
export function leaderDrift(s: SimState, town: number): number {
  let d = leader(s, town) === 'moderate' ? -0.3 : 0;
  for (const def of managedPlants(s)) if (townIndex(townOf(def.id)) === town) d -= 0.15 * mgr(s, def.id, 'popular');
  return d;
}

// ---------- Actions ----------

export function validateCast(s: SimState, a: { type: string; site?: string; candidate?: number }): string | null {
  const m = a.site ? s.cast.managers[a.site] : undefined;
  if (a.type === 'promoteManager') {
    if (!m) return 'No manager there.';
    if (m.level >= MAX_LEVEL) return `${m.name} is as senior as a plant manager gets.`;
    return s.treasury >= promoteCost(s, m) ? null : `Not enough money (needs $${promoteCost(s, m)}M).`;
  }
  if (a.type === 'appointManager') {
    if (!a.site || !managedPlants(s).some((d) => d.id === a.site)) return 'Not one of your running plants.';
    if (!s.cast.pool.some((c) => c.id === a.candidate)) return 'That candidate is no longer available.';
    return null;
  }
  return null;
}

export function applyCast(s: SimState, a: { type: string; site?: string; candidate?: number }, feed: Feed): void {
  const c = s.cast;
  if (a.type === 'promoteManager') {
    const m = c.managers[a.site!];
    const cost = promoteCost(s, m);
    s.treasury -= cost;
    s.month.spend.operations += cost;
    m.level++;
    m.loyalty = clamp(m.loyalty + 15);
    feed(s, 'good', `${m.name} is promoted at ${SITE_BY_ID[a.site!].name}: ${TRAITS[m.trait].name.toLowerCase()}, now level ${m.level}.`, a.site);
  } else if (a.type === 'appointManager') {
    const old = c.managers[a.site!];
    const pickd = c.pool.find((x) => x.id === a.candidate)!;
    c.pool = c.pool.filter((x) => x.id !== a.candidate);
    c.managers[a.site!] = { ...pickd, since: s.day };
    // A change at the top unsettles the floor, more so when a popular manager goes.
    const site = s.sites[a.site!];
    site.morale = clamp(site.morale - (old?.trait === 'popular' ? 8 : 3));
    // Any offer to the old manager lapses with them.
    s.strategy.decisions = s.strategy.decisions.filter((x) => !(x.kind === 'poach' && x.site === a.site));
    feed(s, 'info', `${pickd.name} takes over at ${SITE_BY_ID[a.site!].name}${old ? `, replacing ${old.name}` : ''}.`, a.site);
  }
}

// ---------- Months ----------

export function castMonth(s: SimState, feed: Feed): void {
  const c = s.cast;
  if (!c) return;
  // New plants get a manager; closed ones lose theirs.
  const plants = managedPlants(s);
  for (const d of plants) if (!c.managers[d.id]) c.managers[d.id] = person(s);
  for (const id of Object.keys(c.managers)) if (!plants.some((d) => d.id === id)) delete c.managers[id];
  // Loyalty follows the plant's mood and the manager's standing.
  for (const d of plants) {
    const m = c.managers[d.id];
    const site = s.sites[d.id];
    const target = 50 + (site.morale - 55) * 0.4 + 6 * (m.level - 1) + Math.min(10, (s.day - m.since) / 120);
    m.loyalty = clamp(m.loyalty + (target - m.loyalty) * 0.15);
    // Restless, experienced managers get offers from private firms.
    // Only a working plant's manager is worth poaching.
    if (site.status !== 'active' || site.mothballed) continue;
    if (m.loyalty < 45 && m.level >= 2 && rand(R(s)) < 0.05 * m.level && !s.strategy.decisions.some((x) => x.kind === 'poach')) {
      s.strategy.decisions.push({
        id: s.nextId++,
        kind: 'poach',
        title: `${m.name} has an offer`,
        body: `A private firm wants ${m.name}, your ${TRAITS[m.trait].name.toLowerCase()} manager at ${d.name} (level ${m.level}, loyalty ${Math.round(m.loyalty)}). Keep them, or let them go.`,
        options: [
          { id: 'match', label: `Match the offer ($${matchCost(s, m)}M)`, detail: 'They stay, and their loyalty recovers.' },
          ...(m.level < MAX_LEVEL ? [{ id: 'promote', label: `Promote them ($${promoteCost(s, m)}M)`, detail: 'They stay, a level stronger.' }] : []),
          { id: 'release', label: 'Let them go', detail: 'The best candidate on your list takes over; the floor is unsettled.' },
        ],
        fallback: 'release',
        site: d.id,
        value: matchCost(s, m),
        data: { manager: m.id },
      });
      feed(s, 'warn', `${m.name} at ${d.name} has an offer from a private firm. A decision is waiting.`, d.id, true);
    }
  }
  // Union elections.
  for (const t of unionTownsOf(s)) {
    const l = c.leaders[t];
    if (!l) c.leaders[t] = { name: `${pick(R(s), FIRST_NAMES)} ${pick(R(s), LAST_NAMES)}`, temper: pick(R(s), TEMPER_IDS), since: s.day };
    else if (s.day - l.since >= ELECTION_DAYS && rand(R(s)) < 0.25) {
      // A strong union tends to elect a firebrand; a weak one a moderate.
      const strength = s.unions?.towns[t]?.strength ?? 40;
      const temper: Temper = rand(R(s)) < strength / 120 ? 'firebrand' : rand(R(s)) < 0.5 ? 'pragmatist' : 'moderate';
      const name = `${pick(R(s), FIRST_NAMES)} ${pick(R(s), LAST_NAMES)}`;
      c.leaders[t] = { name, temper, since: s.day };
      feed(s, temper === 'firebrand' ? 'warn' : 'info', `The union in ${CITIES[t].name} elects ${name}, a ${TEMPERS[temper].name.toLowerCase()}.`);
    }
  }
  // A fresh list of candidates every quarter.
  if (s.day - c.poolDay >= 90) {
    c.pool = freshPool(s);
    c.poolDay = s.day;
  }
}

/** The answer to a poaching offer. */
/** Why a poaching answer cannot be given now. */
export function poachWhy(s: SimState, d: { site?: string }, opt: string): string | null {
  const m = d.site ? s.cast.managers[d.site] : undefined;
  if (!m) return null;
  if (opt === 'match' && s.treasury < matchCost(s, m)) return `Not enough money (needs $${matchCost(s, m)}M).`;
  if (opt === 'promote' && m.level < MAX_LEVEL && s.treasury < promoteCost(s, m)) return `Not enough money (needs $${promoteCost(s, m)}M).`;
  return null;
}

export function resolvePoach(s: SimState, d: { kind: string; site?: string; data?: { manager?: number } }, opt: string, feed: Feed): boolean {
  if (d.kind !== 'poach' || !d.site) return false;
  const m = s.cast.managers[d.site];
  // The offer was for someone else, or the plant has closed: it lapses.
  if (!m || (d.data?.manager !== undefined && m.id !== d.data.manager) || s.sites[d.site]?.status === 'closed') return true;
  const name = SITE_BY_ID[d.site].name;
  if (opt === 'promote' && m.level >= MAX_LEVEL) {
    // Already promoted to the top since the offer came: that settles it.
    m.loyalty = Math.max(m.loyalty, 65);
    feed(s, 'info', `${m.name} turns the offer down and stays at ${name}.`, d.site);
  } else if (opt === 'match' && s.treasury >= matchCost(s, m)) {
    s.treasury -= matchCost(s, m);
    s.month.spend.operations += matchCost(s, m);
    m.loyalty = 70;
    feed(s, 'info', `You match the offer. ${m.name} stays at ${name}.`, d.site);
  } else if (opt === 'promote' && m.level < MAX_LEVEL && s.treasury >= promoteCost(s, m)) {
    s.treasury -= promoteCost(s, m);
    s.month.spend.operations += promoteCost(s, m);
    m.level++;
    m.loyalty = 65;
    feed(s, 'good', `${m.name} is promoted and stays at ${name}, now level ${m.level}.`, d.site);
  } else if (opt === 'release' || opt === 'match' || opt === 'promote') {
    // Let go (or the money was no longer there when the card was settled).
    const next = [...s.cast.pool].sort((a, b) => b.level - a.level)[0] ?? person(s);
    s.cast.pool = s.cast.pool.filter((x) => x.id !== next.id);
    s.cast.managers[d.site] = { ...next, since: s.day };
    s.sites[d.site].morale = clamp(s.sites[d.site].morale - 4);
    feed(s, 'warn', `${m.name} leaves ${name} for a private firm. ${next.name} takes over.`, d.site);
  }
  return true;
}

/** Your best manager: the most senior, then the longest-serving. */
export function bestManager(s: SimState): { site: string; m: Manager } | null {
  const all = Object.entries(s.cast?.managers ?? {}).map(([site, m]) => ({ site, m }));
  if (!all.length) return null;
  // The most senior, then the most loyal; a corner-cutter only if there is no one else.
  const cut = (x: { m: Manager }) => (x.m.trait === 'cornerCutter' ? 1 : 0);
  return all.sort((a, b) => cut(a) - cut(b) || b.m.level - a.m.level || b.m.loyalty - a.m.loyalty || a.m.since - b.m.since)[0];
}
