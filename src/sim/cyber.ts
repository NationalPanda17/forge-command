// Cyber and IT attacks: the rival's hackers go after plant control systems, the rail booking system and your
// suppliers' networks. Defences make attacks rarer; backups shorten the damage; manual fallback drills keep things
// moving while the systems are down.
import { clamp, pick, rand, randInt } from './rng';
import { troubleScale } from './scale';
import type { FeedItem, SimState } from './types';
import { SITES, SITE_BY_ID } from './world';

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

export type CyberArea = 'plants' | 'rail' | 'suppliers';
export const CYBER_AREAS: Record<CyberArea, { name: string; blurb: string }> = {
  plants: { name: 'Plant control systems', blurb: 'Ransomware on the shop floor stops an arsenal’s lines.' },
  rail: { name: 'Rail booking system', blurb: 'With the booking system down, trains run on paper and phone calls.' },
  suppliers: { name: 'Supplier networks', blurb: 'A breach at a supplier stops its deliveries and leaks design data.' },
};
export const CYBER_AREA_IDS = Object.keys(CYBER_AREAS) as CyberArea[];
export const MAX_CYBER = 3;
export const CYBER_LEVEL = ['None', 'Basic', 'Hardened', 'Defence in depth'] as const;

export interface CyberState {
  levels: Record<CyberArea, number>;
  backups: boolean;
  drills: boolean;
  /** Days the rail booking system stays down. */
  railDays: number;
  /** Until this day, hackers who were paid come back more often. */
  ransomPaid: number;
}

export const newCyber = (): CyberState => ({ levels: { plants: 0, rail: 0, suppliers: 0 }, backups: false, drills: false, railDays: 0, ransomPaid: 0 });

export const cyberCost = (s: SimState, area: CyberArea) => Math.round((25 + 20 * s.cyber.levels[area]) * s.priceIndex);
export const BACKUPS_COST = (s: SimState) => Math.round(20 * s.priceIndex);
export const DRILLS_COST = (s: SimState) => Math.round(10 * s.priceIndex);
/** Monthly upkeep of backups and drills, $M. */
export const upkeep = (s: SimState) => ((s.cyber.backups ? 2 : 0) + (s.cyber.drills ? 1 : 0)) * s.priceIndex;

/** Chance of an attack on an area in a month. */
export function attackOdds(s: SimState, area: CyberArea): number {
  const base = 0.012 * (1 + 0.4 * (s.rival?.known.length ?? 0)) * troubleScale(s);
  const repeat = area === 'plants' && s.cyber.ransomPaid > s.day ? 1.5 : 1;
  return clamp(base * (1 - 0.25 * s.cyber.levels[area]) * repeat, 0, 0.5);
}

/** Rail capacity while the booking system is down. */
export const railFactor = (s: SimState) => (s.cyber && s.cyber.railDays > 0 ? (s.cyber.drills ? 0.8 : 0.5) : 1);

export function validateCyber(s: SimState, a: { type: string; area?: CyberArea }): string | null {
  const funds = (c: number) => (s.treasury >= c ? null : `Not enough money (needs $${c}M).`);
  if (a.type === 'cyberDefence') {
    if (!(a.area! in CYBER_AREAS)) return 'No such system.';
    if (s.cyber.levels[a.area!] >= MAX_CYBER) return 'Already at the highest level.';
    return funds(cyberCost(s, a.area!));
  }
  if (a.type === 'cyberBackups') return s.cyber.backups ? 'Backups are already in place.' : funds(BACKUPS_COST(s));
  if (a.type === 'cyberDrills') return s.cyber.drills ? 'Crews already drill for it.' : funds(DRILLS_COST(s));
  return null;
}

export function applyCyber(s: SimState, a: { type: string; area?: CyberArea }, feed: Feed): void {
  const pay = (v: number) => {
    s.treasury -= v;
    s.month.spend.projects += v;
  };
  if (a.type === 'cyberDefence') {
    pay(cyberCost(s, a.area!));
    s.cyber.levels[a.area!]++;
    feed(s, 'info', `${CYBER_AREAS[a.area!].name}: defences raised to ${CYBER_LEVEL[s.cyber.levels[a.area!]].toLowerCase()}.`);
  } else if (a.type === 'cyberBackups') {
    pay(BACKUPS_COST(s));
    s.cyber.backups = true;
    feed(s, 'info', 'Offline backups are in place: systems that are hit come back far sooner.');
  } else if (a.type === 'cyberDrills') {
    pay(DRILLS_COST(s));
    s.cyber.drills = true;
    feed(s, 'info', 'Crews and dispatchers now drill for working without computers.');
  }
}

export function cyberDay(s: SimState, feed: Feed): void {
  if (s.cyber.railDays > 0 && --s.cyber.railDays === 0) feed(s, 'good', 'The rail booking system is back: trains run at full capacity again.');
}

export function cyberMonth(s: SimState, feed: Feed): void {
  const cost = upkeep(s);
  s.treasury -= cost;
  s.month.spend.operations += cost;
  if (s.day < 90 || (s.scenario === 'tutorial' && s.day < 360)) return;
  const hit = (n = 1) => (s.month.cyber = (s.month.cyber ?? 0) + n);
  // Plant control systems.
  if (rand(s) < attackOdds(s, 'plants')) {
    const pool = SITES.filter((d) => d.owner === 'state' && s.sites[d.id].processes.length && s.sites[d.id].status === 'active' && !s.sites[d.id].mothballed);
    if (pool.length) {
      const def = pick(s, pool);
      const site = s.sites[def.id];
      hit();
      if (s.cyber.backups) {
        site.disruptionDays = Math.max(site.disruptionDays, randInt(s, 5, 10));
        site.disruptionFactor = Math.min(site.disruptionFactor, s.cyber.drills ? 0.7 : 0.5);
        feed(s, 'warn', `Ransomware hits the control systems at ${def.name}. Restored from backups: about a week of lost output.`, def.id, true);
      } else {
        const days = randInt(s, 20, 35);
        site.disruptionDays = Math.max(site.disruptionDays, days);
        site.disruptionFactor = Math.min(site.disruptionFactor, s.cyber.drills ? 0.7 : 0.5);
        const ransom = Math.round(15 * s.priceIndex);
        s.strategy.decisions.push({
          id: s.nextId++,
          kind: 'ransom',
          title: `Ransomware at ${def.name}`,
          body: `Hackers have locked the control systems at ${def.name}. Its lines run at ${Math.round(site.disruptionFactor * 100)}% while engineers rebuild them, about ${Math.round(days / 7)} weeks. The hackers want $${ransom}M to unlock them now.`,
          options: [
            { id: 'rebuild', label: 'Rebuild the systems', detail: 'Slow, but nobody is paid off.' },
            { id: 'pay', label: `Pay the ransom ($${ransom}M)`, detail: 'Back within days. The hawks will hear of it, and paid hackers come back.' },
          ],
          fallback: 'rebuild',
          site: def.id,
          value: ransom,
        });
        feed(s, 'bad', `Ransomware hits the control systems at ${def.name}. A decision is waiting.`, def.id, true);
      }
    }
  }
  // The rail booking system.
  if (s.cyber.railDays === 0 && rand(s) < attackOdds(s, 'rail')) {
    s.cyber.railDays = Math.round(randInt(s, 10, 25) * (s.cyber.backups ? 0.5 : 1));
    hit();
    feed(s, 'bad', `A cyber attack takes down the rail booking system: trains run at ${Math.round(railFactor(s) * 100)}% of capacity for about ${Math.round(s.cyber.railDays / 7)} weeks.`, undefined, true);
  }
  // Suppliers' networks.
  if (rand(s) < attackOdds(s, 'suppliers')) {
    const pool = SITES.filter((d) => d.owner === 'private' && s.sites[d.id].processes.length && s.sites[d.id].status === 'active' && s.sites[d.id].disruptionDays === 0);
    if (pool.length) {
      const def = pick(s, pool);
      const site = s.sites[def.id];
      site.disruptionDays = randInt(s, 15, 30);
      site.disruptionFactor = 0.5;
      hit();
      const leak = rand(s) < 0.4 - 0.1 * s.cyber.levels.suppliers;
      if (leak) {
        s.rival.next = Math.max(s.day + 7, s.rival.next - 40);
        s.confidence = clamp(s.confidence - 1);
      }
      feed(s, 'bad', `Hackers breach ${def.name}'s network: output halved for about ${Math.round(site.disruptionDays / 7)} weeks${leak ? ', and design data is stolen. The rival learns from it' : ''}.`, def.id, true);
    }
  }
}

export function resolveCyber(s: SimState, d: { kind: string; site?: string; value?: number }, opt: string, feed: Feed): boolean {
  if (d.kind !== 'ransom') return false;
  const site = d.site ? s.sites[d.site] : null;
  if (opt === 'pay' && site) {
    s.treasury -= d.value ?? 0;
    s.month.spend.projects += d.value ?? 0;
    site.disruptionDays = Math.min(site.disruptionDays, 3);
    s.cyber.ransomPaid = s.day + 360;
    s.strategy.factions.hawks = clamp(s.strategy.factions.hawks - 4);
    feed(s, 'warn', `The ransom is paid. ${SITE_BY_ID[d.site!].name} is unlocked within days.`, d.site);
  } else if (site) feed(s, 'info', `Engineers rebuild the control systems at ${SITE_BY_ID[d.site!].name}.`, d.site);
  return true;
}
