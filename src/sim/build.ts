// Building the network: new links, route upgrades, an icebreaker for the northern winter, supplier resilience
// grants and plant automation. Projects take time and money, then change the world when they finish.
import { permitHeld, seekPermit } from './communities';
import { UPGRADE_STEP, setNetwork } from './graph';
import { clamp } from './rng';
import type { FeedItem, Project, SimState } from './types';
import { CANDIDATE_BY_ID, CANDIDATE_ROUTES, MATERIALS, RECIPES, ROUTES, ROUTE_KEY, SITE_BY_ID, routeKm, type RouteDef } from './world';

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

export const MAX_UPGRADE = 2;
export const ICEBREAKER_COST = 90;
export const ICEBREAKER_DAYS = 200;
export const HARDEN_DAYS = 90;
export const AUTOMATE_DAYS = 180;

/** Every route that exists today, built links included. */
export function liveRoutes(s: SimState): RouteDef[] {
  return [...ROUTES, ...CANDIDATE_ROUTES.filter((c) => s.network.built.includes(c.id))];
}

export function routeByKey(s: SimState, key: string): RouteDef | undefined {
  return liveRoutes(s).find((r) => ROUTE_KEY(r.a, r.b) === key);
}

export const linkCost = (s: SimState, id: string) => {
  const c = CANDIDATE_BY_ID[id];
  return Math.round(routeKm(c) * (c.mode === 'rail' ? 0.3 : 0.1) * s.priceIndex);
};
export const linkDays = (id: string) => (CANDIDATE_BY_ID[id].mode === 'rail' ? 270 : 150);

export function upgradeCost(s: SimState, key: string): number {
  const r = routeByKey(s, key);
  if (!r) return Infinity;
  const level = s.network.upgrades[key] ?? 0;
  const base = r.mode === 'sea' ? 30 : routeKm(r) * (r.mode === 'rail' ? 0.12 : 0.05);
  return Math.max(6, Math.round(base * (level + 1) * s.priceIndex));
}
export const upgradeDays = (s: SimState, key: string) => (routeByKey(s, key)?.mode === 'sea' ? 150 : 120);
/** Daily tonnes a route carries now, with upgrades. */
export const routeCap = (s: SimState, r: RouteDef) => r.cap * (1 + UPGRADE_STEP * (s.network.upgrades[ROUTE_KEY(r.a, r.b)] ?? 0));

export const hardenCost = (s: SimState, site: string) => Math.round((12 + SITE_BY_ID[site].crew * 0.03) * s.priceIndex);

export function automateCost(s: SimState, site: string, process: number): number {
  const p = s.sites[site].processes[process];
  const out = RECIPES[p.recipe].output;
  return Math.max(15, Math.round(p.capacity * MATERIALS[out].price * 360 * 0.18 * s.priceIndex));
}

const busy = (s: SimState, kind: Project['kind'], target: string, process?: number) => s.network.projects.some((p) => p.kind === kind && p.target === target && p.process === process);

/** Why a project cannot start, or null. */
export function buildBlock(s: SimState, kind: Project['kind'], target: string, process?: number): string | null {
  if (busy(s, kind, target, process)) return 'Already under way.';
  const money = (c: number) => (s.treasury >= c ? null : `Not enough money (needs $${Math.round(c)}M).`);
  switch (kind) {
    case 'link':
      if (!CANDIDATE_BY_ID[target]) return 'Unknown link.';
      if (s.network.built.includes(target)) return 'Already built.';
      return money(linkCost(s, target));
    case 'upgrade': {
      const r = routeByKey(s, target);
      if (!r) return 'Unknown route.';
      if (r.mode === 'air') return 'Airlift cannot be upgraded.';
      if ((s.network.upgrades[target] ?? 0) >= MAX_UPGRADE) return 'Fully upgraded.';
      return money(upgradeCost(s, target));
    }
    case 'icebreaker':
      if (s.network.icebreaker) return 'Already in service.';
      return money(ICEBREAKER_COST * s.priceIndex);
    case 'harden': {
      const def = SITE_BY_ID[target];
      if (!def || def.owner !== 'private') return 'Only domestic suppliers.';
      if (s.network.hardened.includes(target)) return 'Already hardened.';
      return money(hardenCost(s, target));
    }
    case 'automate': {
      const def = SITE_BY_ID[target];
      if (!def || def.owner !== 'state') return 'Only your own plants.';
      const p = s.sites[target].processes[process ?? -1];
      if (!p) return 'Unknown line.';
      if (p.automated) return 'Already automated.';
      return money(automateCost(s, target, process!));
    }
  }
}

export function projectCost(s: SimState, kind: Project['kind'], target: string, process?: number): number {
  switch (kind) {
    case 'link':
      return linkCost(s, target);
    case 'upgrade':
      return upgradeCost(s, target);
    case 'icebreaker':
      return Math.round(ICEBREAKER_COST * s.priceIndex);
    case 'harden':
      return hardenCost(s, target);
    case 'automate':
      return automateCost(s, target, process!);
  }
}

export function projectDays(s: SimState, kind: Project['kind'], target: string): number {
  return kind === 'link' ? linkDays(target) : kind === 'upgrade' ? upgradeDays(s, target) : kind === 'icebreaker' ? ICEBREAKER_DAYS : kind === 'harden' ? HARDEN_DAYS : AUTOMATE_DAYS;
}

export function projectName(s: SimState, p: { kind: Project['kind']; target: string; process?: number }): string {
  switch (p.kind) {
    case 'link':
      return CANDIDATE_BY_ID[p.target].name;
    case 'upgrade': {
      const r = routeByKey(s, p.target);
      return r ? `${r.mode === 'sea' ? 'Port works' : 'Upgrade'}: ${SITE_BY_ID[r.a].name} – ${SITE_BY_ID[r.b].name}` : p.target;
    }
    case 'icebreaker':
      return 'Icebreaker for the Meric lanes';
    case 'harden':
      return `Resilience grant: ${SITE_BY_ID[p.target].name}`;
    case 'automate':
      return `Automation: ${RECIPES[s.sites[p.target].processes[p.process!].recipe].name} at ${SITE_BY_ID[p.target].name}`;
  }
}

export function startProject(s: SimState, kind: Project['kind'], target: string, process: number | undefined, feed: Feed): void {
  const cost = projectCost(s, kind, target, process);
  const days = projectDays(s, kind, target);
  s.treasury -= cost;
  s.month.spend.projects += cost;
  const id = s.nextId++;
  s.network.projects.push({ id, kind, target, process, days, total: days, cost });
  // A new line across the country needs a permit from the town at its first end.
  if (kind === 'link' && CANDIDATE_BY_ID[target]) seekPermit(s, 'link', String(id), CANDIDATE_BY_ID[target].a, feed, id);
  // Building at home pleases the regions and industry.
  if (kind === 'link' || kind === 'upgrade') s.strategy.factions.regions = clamp(s.strategy.factions.regions + 1.5);
  if (kind === 'harden') s.strategy.factions.industry = clamp(s.strategy.factions.industry + 1);
  s.strategy.investedThisMonth += kind === 'harden' ? cost : 0;
}

export function buildDay(s: SimState, feed: Feed): void {
  if (!s.network.projects.length) return;
  for (const p of s.network.projects) if (!permitHeld(s, String(p.id))) p.days--;
  const done = s.network.projects.filter((p) => p.days <= 0);
  if (!done.length) return;
  s.network.projects = s.network.projects.filter((p) => p.days > 0);
  for (const p of done) {
    const name = projectName(s, p);
    switch (p.kind) {
      case 'link':
        s.network.built.push(p.target);
        feed(s, 'good', `${name} opens to traffic.`, CANDIDATE_BY_ID[p.target].a, true);
        break;
      case 'upgrade':
        s.network.upgrades[p.target] = (s.network.upgrades[p.target] ?? 0) + 1;
        feed(s, 'good', `${name} is finished: the route now carries ${Math.round(UPGRADE_STEP * 100 * s.network.upgrades[p.target])}% more.`, p.target.split('|')[0]);
        break;
      case 'icebreaker':
        s.network.icebreaker = true;
        feed(s, 'good', 'The icebreaker enters service: the Meric lanes stay open through the winter.', 'portMeric', true);
        break;
      case 'harden':
        s.network.hardened.push(p.target);
        feed(s, 'good', `${SITE_BY_ID[p.target].name} finishes its resilience works: spares, fire walls and backup power.`, p.target);
        break;
      case 'automate':
        s.sites[p.target].processes[p.process!].automated = true;
        feed(s, 'good', `${name} is complete: the line needs fewer hands and scraps less.`, p.target);
        break;
    }
  }
  setNetwork(s.network.built, s.network.upgrades);
}
