// Unions and strikes: each town's munitions workers are organised. A union grows stronger when pay falls behind
// prices and morale sags. It brings claims (pay, hours or safety); refused claims end in a strike, or in a
// work-to-rule where the union is weaker, and a strike can spread to the other plants in the same town.
import { clamp, rand, randInt } from './rng';
import { MAX_SAFETY, safetyCost } from './people';
import { townIndex, townOf } from './towns';
import type { Chain, FeedItem, SimState } from './types';
import { CITIES, SITES, SITE_BY_ID } from './world';

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

export interface UnionState {
  /** In city-list order: how strong each town's union is (0..100), and its pay against the start of your term. */
  towns: { strength: number; wage: number }[];
  /** Plants where a deal rules out round-the-clock shifts, and until when. */
  noSurge: Record<string, number>;
  /** Day a national pay deal can next be offered. */
  dealReady: number;
}

export const newUnions = (): UnionState => ({ towns: CITIES.map(() => ({ strength: 40, wage: 1 })), noSurge: {}, dealReady: 0 });

/** Your working plants. */
const plants = (s: SimState) => SITES.filter((d) => d.owner === 'state' && d.crew > 0 && s.sites[d.id].processes.length > 0 && s.sites[d.id].status !== 'closed' && !s.sites[d.id].mothballed);

export const unionAt = (s: SimState, siteId: string) => s.unions?.towns[townIndex(townOf(siteId))];
/** Pay at a site against the start of the term. */
export const wageOf = (s: SimState, siteId: string) => unionAt(s, siteId)?.wage ?? 1;
/** Towns with at least one of your working plants. */
export const unionTowns = (s: SimState) => [...new Set(plants(s).map((d) => townIndex(townOf(d.id))))].sort((a, b) => a - b);

export const PAY_DEAL = 0.03;
export const payDealCost = (s: SimState) => Math.round(10 * s.priceIndex);
export const surgeBanned = (s: SimState, siteId: string) => (s.unions?.noSurge[siteId] ?? 0) > s.day;

export function unionsMonth(s: SimState): void {
  for (const i of unionTowns(s)) {
    const u = s.unions.towns[i];
    const here = plants(s).filter((d) => townIndex(townOf(d.id)) === i);
    const morale = here.reduce((a, d) => a + s.sites[d.id].morale, 0) / Math.max(1, here.length);
    u.strength = clamp(u.strength + (55 - morale) * 0.06 + Math.max(0, s.priceIndex - u.wage) * 6 - 0.6, 5, 95);
  }
}

/** How much likelier a claim is this month, by the strongest union. */
export const claimBoost = (s: SimState) => Math.max(0.5, Math.max(0, ...unionTowns(s).map((i) => s.unions.towns[i].strength)) / 45);

/** A union brings a claim at one of your plants. */
export function unionClaim(s: SimState, feed: Feed): void {
  const towns = unionTowns(s);
  if (!towns.length) return;
  const strongest = [...towns].sort((a, b) => s.unions.towns[b].strength - s.unions.towns[a].strength)[0];
  const town = rand(s) < 0.7 ? strongest : towns[Math.floor(rand(s) * towns.length)];
  const u = s.unions.towns[town];
  const here = plants(s).filter((d) => townIndex(townOf(d.id)) === town);
  const def = [...here].sort((a, b) => s.sites[a.id].morale - s.sites[b.id].morale)[0];
  const site = s.sites[def.id];
  const name = CITIES[town].name;
  const c: Chain = { id: s.nextId++, kind: 'labour', site: def.id, stage: 0, due: s.day + 30 };
  s.chains.push(c);
  const tired = site.fatigue > 40 || site.processes.some((p) => p.run === 'surge');
  const kind = s.priceIndex > u.wage + 0.03 ? 'pay' : tired && !surgeBanned(s, def.id) ? 'hours' : site.safety < 2 && site.safety < MAX_SAFETY ? 'safety' : 'pay';
  const threat = u.strength >= 50 ? 'strike' : 'work to rule';
  const backPay = Math.round(here.reduce((a, d) => a + d.crew, 0) * 0.0095 * 3 * s.priceIndex);
  if (kind === 'pay') {
    s.strategy.decisions.push({
      id: s.nextId++,
      kind: 'labour',
      title: `Pay claim in ${name}`,
      body: `The union in ${name} wants pay to keep up with prices: up ${Math.round((s.priceIndex - 1) * 100)}% since your term began, against ${Math.round((u.wage - 1) * 100)}% on pay. It is ${u.strength >= 70 ? 'strong' : u.strength >= 50 ? 'well organised' : 'not very strong'} (${Math.round(u.strength)}), and will ${threat} in a month if nothing is offered.`,
      options: [
        { id: 'pay', label: `Meet it: 4% more pay ($${backPay}M now)`, detail: 'Wages there stay higher. The dispute ends and the union cools.' },
        { id: 'talk', label: 'Offer 2%', detail: `About ${Math.round((1 - u.strength / 130) * 100)}% odds they accept.` },
        { id: 'refuse', label: 'Refuse', detail: `They will ${threat}.` },
      ],
      fallback: 'refuse',
      site: def.id,
      value: backPay,
      data: { chain: c.id, claim: 'pay', town },
    });
  } else if (kind === 'hours') {
    s.strategy.decisions.push({
      id: s.nextId++,
      kind: 'labour',
      title: `Hours claim at ${def.name}`,
      body: `Crews at ${def.name} are worn out (fatigue ${Math.round(site.fatigue)}). The union wants an end to round-the-clock shifts there for six months, or it will ${threat}.`,
      options: [
        { id: 'agree', label: 'Agree: no round-the-clock shifts for six months', detail: 'Morale lifts; you lose your surge there.' },
        { id: 'refuse', label: 'Refuse', detail: `They will ${threat}.` },
      ],
      fallback: 'refuse',
      site: def.id,
      data: { chain: c.id, claim: 'hours', town },
    });
  } else {
    const cost = safetyCost(s, def.id);
    s.strategy.decisions.push({
      id: s.nextId++,
      kind: 'labour',
      title: `Safety claim at ${def.name}`,
      body: `After a run of near misses, the union at ${def.name} wants the next stage of the safety programme now, or it will ${threat}.`,
      options: [
        { id: 'fund', label: `Fund it now ($${cost}M)`, detail: 'Safer work, better morale.' },
        { id: 'refuse', label: 'Refuse', detail: `They will ${threat}.` },
      ],
      fallback: 'refuse',
      site: def.id,
      value: cost,
      data: { chain: c.id, claim: 'safety', town },
    });
  }
  feed(s, 'warn', `${kind === 'pay' ? `Pay claim in ${name}` : `${kind === 'hours' ? 'Hours' : 'Safety'} claim at ${def.name}`}. A decision is waiting.`, def.id, true);
}

function townPlants(s: SimState, town: number) {
  return plants(s).filter((d) => townIndex(townOf(d.id)) === town);
}

/** The answer to a union's claim. */
export function resolveClaim(s: SimState, d: { site?: string; value?: number; data?: { chain?: number; claim?: string; town?: number } }, opt: string, feed: Feed): void {
  const chain = s.chains.find((c) => c.id === d.data?.chain);
  if (!chain) return;
  const site = s.sites[chain.site];
  const town = d.data?.town ?? townIndex(townOf(chain.site));
  const u = s.unions.towns[town];
  const pay = (v: number) => {
    s.treasury -= v;
    s.month.spend.operations += v;
  };
  const settle = (cool: number, morale: number, text: string) => {
    s.chains = s.chains.filter((c) => c.id !== chain.id);
    u.strength = clamp(u.strength - cool, 5, 95);
    for (const p of townPlants(s, town)) s.sites[p.id].morale = clamp(s.sites[p.id].morale + morale);
    s.strategy.factions.regions = clamp(s.strategy.factions.regions + 2);
    feed(s, 'good', text, chain.site);
  };
  const claim = d.data?.claim ?? 'pay';
  if (claim === 'pay' && opt === 'pay') {
    pay(d.value ?? 0);
    u.wage *= 1.04;
    settle(12, 8, `Pay deal agreed in ${CITIES[town].name}: 4% more.`);
  } else if (claim === 'pay' && opt === 'talk') {
    if (rand(s) < 1 - u.strength / 130) {
      u.wage *= 1.02;
      settle(6, 4, `The union in ${CITIES[town].name} accepts 2%.`);
    } else {
      u.strength = clamp(u.strength + 3, 5, 95);
      feed(s, 'warn', `The union in ${CITIES[town].name} rejects 2%. Industrial action is coming.`, chain.site);
    }
  } else if (claim === 'hours' && opt === 'agree') {
    s.unions.noSurge[chain.site] = s.day + 180;
    for (const p of site.processes) if (p.run === 'surge') p.run = 'normal';
    settle(8, 0, `Hours deal at ${SITE_BY_ID[chain.site].name}: no round-the-clock shifts for six months.`);
    site.morale = clamp(site.morale + 10);
  } else if (claim === 'safety' && opt === 'fund') {
    pay(d.value ?? 0);
    site.safety = Math.min(MAX_SAFETY, site.safety + 1);
    settle(8, 0, `Safety deal at ${SITE_BY_ID[chain.site].name}: the next stage starts now.`);
    site.morale = clamp(site.morale + 6);
  } else {
    u.strength = clamp(u.strength + 5, 5, 95);
    site.morale = clamp(site.morale - 8);
    feed(s, 'warn', `You refuse the claim at ${SITE_BY_ID[chain.site].name}. Industrial action is coming.`, chain.site);
  }
}

/** A claim left unsettled for a month: a strike that may spread, or a work-to-rule. */
export function industrialAction(s: SimState, chain: Chain, feed: Feed): void {
  const town = townIndex(townOf(chain.site));
  const u = s.unions.towns[town];
  const site = s.sites[chain.site];
  const name = SITE_BY_ID[chain.site].name;
  // A plant mothballed since the claim has nobody left to walk out.
  if (site.mothballed || site.status === 'closed') return;
  if (u.strength < 50) {
    site.disruptionDays = Math.max(site.disruptionDays, randInt(s, 30, 45));
    site.disruptionFactor = Math.min(site.disruptionFactor, 0.75);
    feed(s, 'warn', `Work to rule at ${name}: output down to 75% for about ${Math.round(site.disruptionDays / 7)} weeks.`, chain.site, true);
    return;
  }
  const days = randInt(s, 25, 50);
  site.disruptionDays = Math.max(site.disruptionDays, days);
  site.disruptionFactor = Math.min(site.disruptionFactor, 0.3);
  s.strategy.factions.regions = clamp(s.strategy.factions.regions - 3);
  s.month.strikes = (s.month.strikes ?? 0) + 1;
  feed(s, 'bad', `Strike at ${name}: production down to 30% for about ${Math.round(days / 7)} weeks.`, chain.site, true);
  // Sympathy strikes at the other plants in town.
  for (const p of townPlants(s, town)) {
    if (p.id === chain.site || rand(s) >= u.strength / 150) continue;
    const other = s.sites[p.id];
    other.disruptionDays = Math.max(other.disruptionDays, Math.round(days / 2));
    other.disruptionFactor = Math.min(other.disruptionFactor, 0.5);
    s.month.strikes = (s.month.strikes ?? 0) + 1;
    feed(s, 'bad', `The strike spreads: ${p.name} walks out in sympathy. Output down to 50% for about ${Math.round(days / 14)} weeks.`, p.id, true);
  }
  u.strength = clamp(u.strength - 10, 5, 95);
}

export function validatePayDeal(s: SimState): string | null {
  if (s.unions.dealReady > s.day) return 'A national deal was struck less than a year ago.';
  if (!unionTowns(s).length) return 'You have no plants with crews.';
  return s.treasury >= payDealCost(s) ? null : `Not enough money (needs $${payDealCost(s)}M).`;
}

/** A national pay deal: 3% for everyone, and the unions cool off. */
export function payDeal(s: SimState, feed: Feed): void {
  s.treasury -= payDealCost(s);
  s.month.spend.operations += payDealCost(s);
  s.unions.dealReady = s.day + 360;
  for (const i of unionTowns(s)) {
    const u = s.unions.towns[i];
    u.wage *= 1 + PAY_DEAL;
    u.strength = clamp(u.strength - 10, 5, 95);
  }
  for (const d of plants(s)) s.sites[d.id].morale = clamp(s.sites[d.id].morale + 5);
  s.strategy.factions.regions = clamp(s.strategy.factions.regions + 3);
  s.strategy.factions.treasury = clamp(s.strategy.factions.treasury - 2);
  feed(s, 'good', 'National pay deal: 3% more for every munitions worker. The unions cool off.');
}
