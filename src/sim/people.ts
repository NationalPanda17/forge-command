// The people in your plants: skill, morale, fatigue, safety and apprenticeships, and accidents when things slip.
import { clamp, rand, randInt } from './rng';
import type { FeedItem, SimState, SiteState } from './types';
import { SITES, SITE_BY_ID } from './world';

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

export const PEOPLE_START = { skill: 70, morale: 65, fatigue: 0, safety: 0, apprentices: 0 } as const;
/** New hires join at this skill; apprentices at a little more. */
export const NEW_HIRE_SKILL = 40;
export const APPRENTICE_SKILL = 55;
export const MAX_SAFETY = 3;
export const APPRENTICE_COST = 0.02;

/** Output factor from crew skill and morale (your sites only). */
export function peopleFactor(site: SiteState): number {
  const skill = 0.9 + 0.2 * ((site.skill ?? 70) / 100);
  const morale = site.morale ?? 65;
  return skill * (morale < 50 ? 0.85 + 0.003 * morale : 1);
}

/** Scrap factor from crew skill (your sites only). */
export const skillScrap = (site: SiteState) => 1.15 - 0.3 * ((site.skill ?? 70) / 100);

export const safetyCost = (s: SimState, site: string) => Math.round((8 + SITE_BY_ID[site].crew * 0.012) * ((s.sites[site].safety ?? 0) + 1) * s.priceIndex);

/** Where morale is heading: safety helps; fatigue and wages falling behind prices hurt. */
export function moraleTarget(s: SimState, site: SiteState): number {
  return clamp(62 + 6 * (site.safety ?? 0) - 0.35 * (site.fatigue ?? 0) - Math.max(0, s.priceIndex - 1) * 60 + (site.apprentices > 0 ? 3 : 0));
}

const ownPlants = () => SITES.filter((d) => d.owner === 'state' && d.crew > 0 && d.processes.length > 0);

export function peopleDay(s: SimState, feed: Feed, eventScale: number): void {
  for (const def of ownPlants()) {
    const site = s.sites[def.id];
    const runs = site.processes.map((p) => p.run);
    const surge = runs.includes('surge');
    const busy = runs.some((r) => r === 'normal' || r === 'surge');
    const light = !busy && runs.includes('single');
    site.fatigue = clamp(site.fatigue + (surge ? 0.35 : busy ? -0.25 : light ? -0.4 : -0.5));
    // Experience grows while the lines run; apprenticeships raise the ceiling.
    if (busy || light) {
      const cap = 88 + (site.apprentices > 0 ? 7 : 0);
      site.skill = Math.min(cap, site.skill + Math.max(0, cap - site.skill) * 0.002);
    }
    site.morale = clamp(site.morale + (moraleTarget(s, site) - site.morale) * 0.02);
    // Accidents: tired crews, worn plant and weak safety make them likelier.
    const p = 0.00025 * eventScale * (1 + site.fatigue / 35) * (1.6 - site.condition / 100) * (1 - 0.25 * site.safety);
    if (site.status === 'active' && rand(s) < p) {
      site.disruptionDays = Math.max(site.disruptionDays, randInt(s, 10, 30));
      site.disruptionFactor = Math.min(site.disruptionFactor, 0.4);
      site.morale = clamp(site.morale - 15);
      s.strategy.factions.regions = clamp(s.strategy.factions.regions - 2);
      s.confidence = clamp(s.confidence - 1);
      const what = site.fatigue > 50 ? 'Exhausted crews' : site.condition < 60 ? 'Worn equipment' : 'A lapse in procedure';
      feed(s, 'bad', `Accident at ${def.name}: ${what.toLowerCase()} blamed. Lines run at 40% while the investigators work.`, def.id, true);
    }
  }
}

export function peopleMonth(s: SimState, feed: Feed): void {
  let cost = 0;
  for (const def of ownPlants()) {
    const site = s.sites[def.id];
    if (site.apprentices > 0) {
      site.trainees.push({ count: site.apprentices, days: 135, apprentice: true });
      cost += site.apprentices * APPRENTICE_COST * s.priceIndex;
    }
    if (site.morale < 35) feed(s, 'warn', `Morale is low at ${def.name}. Output suffers, and the union is restless.`, def.id);
  }
  if (cost > 0) {
    s.treasury -= cost;
    s.month.spend.operations += cost;
  }
}

/** Blends newly qualified workers into a site's skill. */
export function absorbHires(site: SiteState, count: number, apprentices: number): void {
  if (count <= 0) return;
  const total = site.workers + count;
  site.skill = (site.skill * site.workers + NEW_HIRE_SKILL * (count - apprentices) + APPRENTICE_SKILL * apprentices) / Math.max(1, total);
}

/** The lowest-morale arsenal, for disputes to start at. */
export function unhappiest(s: SimState): string | null {
  const plants = ownPlants().filter((d) => d.kind === 'arsenal');
  if (!plants.length) return null;
  return plants.reduce((a, b) => (s.sites[b.id].morale < s.sites[a.id].morale ? b : a)).id;
}
