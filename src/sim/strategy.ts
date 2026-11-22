// The strategic layer on top of the network: research, key staff, Committee factions, decisions and objectives.
import { clamp, pick, rand } from './rng';
import type { AllyId, FeedItem, SimState } from './types';
import { FIRST_NAMES, LAST_NAMES } from './names';
import { variantInput } from './industry';
import { queueTest } from './testing';
import { LINE_RATE, MATERIALS, RECIPES, SITES, SITE_BY_ID, type LineId, type MaterialId } from './world';

// ---------- Research ----------

export type ResearchId =
  | 'apkws' | 'coyote' | 'javelin' | 'galliumLight' | 'commonMotors' | 'digitalTest' | 'rapidQual' | 'imFill'
  | 'yieldAnalytics' | 'seekerDTC' | 'smartFuzes' | 'hpm' | 'germaniumRecovery' | 'cleanDemil'
  | 'swarmControl' | 'networkedFire' | 'seekerSoftware' | 'discrimination' | 'tamirSecondLine' | 'precisionKits';

export interface ResearchDef {
  id: ResearchId;
  name: string;
  cost: number;
  days: number;
  requires: ResearchId[];
  effect: string;
}

export const RESEARCH: Record<ResearchId, ResearchDef> = {
  apkws: { id: 'apkws', name: 'Laser-guided rockets', cost: 60, days: 180, requires: [], effect: 'Adds an APKWS line at Northgate. About $30K a round against $35K drones.' },
  coyote: { id: 'coyote', name: 'Interceptor drones', cost: 90, days: 240, requires: [], effect: 'Adds a Coyote Block 2 line at Corran.' },
  javelin: { id: 'javelin', name: 'Javelin production licence', cost: 80, days: 180, requires: [], effect: 'Adds a Javelin line at Ashford.' },
  galliumLight: { id: 'galliumLight', name: 'Gallium-light radar chips', cost: 70, days: 240, requires: [], effect: 'GaN chips need 40% less gallium.' },
  commonMotors: { id: 'commonMotors', name: 'Common motor cases', cost: 80, days: 270, requires: [], effect: 'Every missile needs 15% less rocket motor.' },
  digitalTest: { id: 'digitalTest', name: 'Digital-twin acceptance', cost: 50, days: 180, requires: [], effect: 'Final integration scraps half as many rounds.' },
  rapidQual: { id: 'rapidQual', name: 'Rapid supplier qualification', cost: 30, days: 120, requires: [], effect: 'Qualifying a supplier takes half as long.' },
  imFill: { id: 'imFill', name: 'Insensitive-munition fills', cost: 45, days: 180, requires: [], effect: 'Warheads and shells need 10% less explosive.' },
  yieldAnalytics: { id: 'yieldAnalytics', name: 'Yield analytics', cost: 40, days: 150, requires: [], effect: 'Scrap falls 30% at every stage you own.' },
  seekerDTC: { id: 'seekerDTC', name: 'Design-to-cost seekers', cost: 90, days: 300, requires: ['galliumLight'], effect: 'Rounds need 20% fewer seekers.' },
  smartFuzes: { id: 'smartFuzes', name: 'Precision fuzes for 155mm', cost: 70, days: 240, requires: [], effect: 'Fire missions need 15% fewer shells.' },
  hpm: { id: 'hpm', name: 'High-power microwave defense', cost: 200, days: 420, requires: ['coyote'], effect: '20% of drones are stopped before any interceptor fires.' },
  germaniumRecovery: { id: 'germaniumRecovery', name: 'Germanium recovery circuit', cost: 55, days: 210, requires: [], effect: 'Tarn Smelter recovers 60% more germanium.' },
  cleanDemil: { id: 'cleanDemil', name: 'Contained demilitarization', cost: 45, days: 150, requires: [], effect: 'Recycling at Karrow recovers twice the value and costs a third less.' },
  swarmControl: { id: 'swarmControl', name: 'Counter-swarm fire control', cost: 70, days: 150, requires: [], effect: 'Counters drone swarms: cheap interceptors hit drones 12% more often, and fewer swarms get organised.' },
  networkedFire: { id: 'networkedFire', name: 'Networked fire control', cost: 90, days: 180, requires: [], effect: 'Counters supersonic cruise missiles: IRIS-T, Coyote and Tamir regain their aim.' },
  seekerSoftware: { id: 'seekerSoftware', name: 'Seeker software upgrade', cost: 80, days: 180, requires: [], effect: 'Counters manoeuvring warheads: each ballistic missile needs a fifth fewer interceptors.' },
  discrimination: { id: 'discrimination', name: 'Decoy discrimination', cost: 75, days: 180, requires: [], effect: 'Counters decoys and jammers: cruise and ballistic missiles need 15% fewer interceptors.' },
  tamirSecondLine: { id: 'tamirSecondLine', name: 'Second Tamir line', cost: 85, days: 210, requires: [], effect: 'Counters heavier rocket barrages: Tamir capacity at Northgate grows 40%.' },
  precisionKits: { id: 'precisionKits', name: 'Precision guidance kits', cost: 70, days: 180, requires: [], effect: 'Counters new armoured divisions: land fighting needs 15% fewer shells and GMLRS.' },
};
export const RESEARCH_IDS = Object.keys(RESEARCH) as ResearchId[];

export const hasResearch = (s: SimState, r: ResearchId) => s.strategy.research.done.includes(r);

const NEW_LINE_SITE: Partial<Record<ResearchId, { line: LineId; site: string; crew: number }>> = {
  apkws: { line: 'apkws', site: 'northgateCenter', crew: 260 },
  coyote: { line: 'coyote', site: 'corranWorks', crew: 220 },
  javelin: { line: 'javelin', site: 'ashfordComplex', crew: 300 },
};

/** A recipe's inputs after research. */
export function recipeInputs(s: SimState, recipe: string): Partial<Record<MaterialId, number>> {
  return withVariant(s, recipe, baseInputs(s, recipe));
}

function withVariant(s: SimState, recipe: string, inputs: Partial<Record<MaterialId, number>>): Partial<Record<MaterialId, number>> {
  if (!s.variants || !Object.keys(s.variants).length) return inputs;
  const out: Partial<Record<MaterialId, number>> = {};
  for (const [m, q] of Object.entries(inputs) as [MaterialId, number][]) out[m] = q * variantInput(s, recipe, m);
  return out;
}

function baseInputs(s: SimState, recipe: string): Partial<Record<MaterialId, number>> {
  const rec = RECIPES[recipe];
  const out: Partial<Record<MaterialId, number>> = { ...rec.inputs };
  const scale = (m: MaterialId, f: number) => {
    if (out[m] !== undefined) out[m] = out[m]! * f;
  };
  if (rec.id === 'ganChipFab' && hasResearch(s, 'galliumLight')) scale('gallium', 0.6);
  if (MATERIALS[rec.output].tier === 'finished') {
    if (hasResearch(s, 'commonMotors')) scale('rocketMotor', 0.85);
    if (hasResearch(s, 'seekerDTC')) {
      scale('seekerRF', 0.8);
      scale('seekerIR', 0.8);
    }
  }
  if (hasResearch(s, 'imFill') && (rec.id === 'warheadLoading' || rec.id === 'shell155')) scale('highExplosive', 0.9);
  return out;
}

export function recipeScrap(s: SimState, recipe: string, owner: string): number {
  const rec = RECIPES[recipe];
  let scrap = rec.scrap;
  if (owner === 'state' && hasResearch(s, 'yieldAnalytics')) scrap *= 0.7;
  if (MATERIALS[rec.output].tier === 'finished' && hasResearch(s, 'digitalTest')) scrap *= 0.5;
  return scrap;
}

export function startResearch(s: SimState, r: ResearchId): void {
  s.treasury -= RESEARCH[r].cost;
  s.month.spend.projects += RESEARCH[r].cost;
  s.strategy.research.active = { id: r, days: Math.round(RESEARCH[r].days * (1 - 0.12 * skillOf(s, 'research'))) };
}

function finishResearch(s: SimState, r: ResearchId, feed: Feed): void {
  s.strategy.research.done.push(r);
  feed(s, 'good', `Research complete: ${RESEARCH[r].name}. ${RESEARCH[r].effect}`, undefined, true);
  const nl = NEW_LINE_SITE[r];
  if (nl) {
    s.lines[nl.line].unlocked = true;
    s.lines[nl.line].since = s.day;
    // A new round is not issued until it passes its firings at the ranges.
    s.lines[nl.line].accepted = false;
    queueTest(s, nl.line, undefined, feed);
    const site = s.sites[nl.site];
    const rate = LINE_RATE[nl.line];
    site.processes.push({ recipe: nl.line, capacity: rate, maturity: 0.1, run: 'normal', partial: 0, lastOutput: 0, lastLimit: null, expansions: 0 });
    site.extraCrew += nl.crew;
    feed(s, 'info', `${MATERIALS[nl.line].name} line installed at ${SITE_BY_ID[nl.site].name}. Hire ${nl.crew} more workers there to run it.`, nl.site);
  }
  if (r === 'germaniumRecovery') for (const p of s.sites.tarnSmelter.processes) p.capacity *= 1.6;
  if (r === 'tamirSecondLine') for (const p of s.sites.northgateCenter.processes) if (p.recipe === 'tamir') (p.ramp ??= []).push({ cap: p.capacity * 0.4, maturity: 0.2 });
}

// ---------- Key staff ----------

export type StaffRole = 'procurement' | 'quality' | 'logistics' | 'research' | 'labor';
export const STAFF_ROLES: Record<StaffRole, { title: string; effect: (k: number) => string }> = {
  procurement: { title: 'Chief of Procurement', effect: (k) => `Purchases ${k * 4}% cheaper` },
  quality: { title: 'Quality Director', effect: (k) => `Scrap ${k * 10}% lower in your plants` },
  logistics: { title: 'Head of Logistics', effect: (k) => `Routes carry ${k * 8}% more; freight ${k * 10}% cheaper` },
  research: { title: 'Chief Engineer', effect: (k) => `Research ${k * 12}% faster` },
  labor: { title: 'Labour Relations Director', effect: (k) => `Training ${k * 15}% faster; fewer strikes` },
};
export const STAFF_ROLE_IDS = Object.keys(STAFF_ROLES) as StaffRole[];

export interface Person {
  id: number;
  name: string;
  role: StaffRole;
  skill: number;
  salary: number;
}

export const skillOf = (s: SimState, role: StaffRole) => s.strategy.staff[role]?.skill ?? 0;

export function makeCandidates(s: SimState): Person[] {
  return STAFF_ROLE_IDS.flatMap((role) =>
    [0, 1].map(() => {
      const skill = rand(s) < 0.25 ? 3 : rand(s) < 0.55 ? 2 : 1;
      return { id: s.nextId++, name: `${pick(s, FIRST_NAMES)} ${pick(s, LAST_NAMES)}`, role, skill, salary: Math.round(0.12 * skill * (0.85 + rand(s) * 0.3) * 1000) / 1000 };
    }),
  );
}

// ---------- Committee factions ----------

export type FactionId = 'hawks' | 'treasury' | 'regions' | 'industry';
export const FACTIONS: Record<FactionId, { name: string; weight: number; wants: string }> = {
  hawks: { name: 'Defence hawks', weight: 0.35, wants: 'Full racks and few leakers.' },
  treasury: { name: 'Treasury bench', weight: 0.25, wants: 'Staying within budget.' },
  regions: { name: 'Regional members', weight: 0.2, wants: 'Jobs at home and no burning pits near their towns.' },
  industry: { name: 'Industry caucus', weight: 0.2, wants: 'Buying at home and investing in domestic plants.' },
};
export const FACTION_IDS = Object.keys(FACTIONS) as FactionId[];

// ---------- Decisions ----------

export interface DecisionOption {
  id: string;
  label: string;
  detail: string;
}
export interface Decision {
  id: number;
  kind: 'bailout' | 'budget' | 'reprice' | 'supplement' | 'allyRequest' | 'allyOffer' | 'export' | 'labour' | 'recall' | 'inspection' | 'spyRing' | 'testFailure' | 'ransom';
  title: string;
  body: string;
  options: DecisionOption[];
  fallback: string;
  site?: string;
  value?: number;
  data?: { line?: LineId; material?: MaterialId; qty?: number; price?: number; ally?: AllyId; customer?: string; chain?: number; contract?: number; months?: number; claim?: string; town?: number };
}

// ---------- Objectives ----------

export interface ObjectiveDef {
  id: string;
  title: string;
  text: string;
  /** Deadline day. */
  by: number;
  check: (s: SimState) => boolean;
  money: number;
}

export const OBJECTIVES: ObjectiveDef[] = [
  { id: 'source', title: 'A second source', text: 'Qualify any supplier that was not qualified at the start.', by: 360, check: (s) => SITES.some((x) => !x.qualified && s.sites[x.id].qualified), money: 120 },
  { id: 'recycle', title: 'Clean hands', text: 'Switch demilitarization to recycling.', by: 270, check: (s) => s.policy.demilMethod === 'recycle', money: 40 },
  { id: 'drones', title: 'Cheap shots', text: 'Get an APKWS or Coyote line running.', by: 900, check: (s) => s.lines.apkws.unlocked || s.lines.coyote.unlocked, money: 150 },
  { id: 'team', title: 'Build the team', text: 'Fill all five key staff posts.', by: 360, check: (s) => STAFF_ROLE_IDS.every((r) => s.strategy.staff[r]), money: 60 },
  { id: 'ready', title: 'Full racks', text: 'Reach 95% readiness.', by: 720, check: (s) => (s.history.at(-1)?.readiness ?? 0) >= 0.95, money: 200 },
];

// ---------- Monthly strategy ----------

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

export function strategyDay(s: SimState, feed: Feed): void {
  const r = s.strategy.research.active;
  if (r) {
    r.days--;
    if (r.days <= 0) {
      s.strategy.research.active = null;
      finishResearch(s, r.id, feed);
    }
  }
}

export function strategyMonth(s: SimState, feed: Feed, input: { readiness: number; excessLeaks: number; burned: number }): void {
  const f = s.strategy.factions;
  f.hawks += (input.readiness - 0.6) * 4 - Math.min(6, input.excessLeaks * 0.4);
  f.treasury += s.treasury < 0 ? -1 - -s.treasury / 500 : 0.5;
  const workers = Object.values(s.sites).reduce((a, x) => a + x.workers, 0);
  f.regions += Math.max(-2, Math.min(2, (workers / Math.max(1, s.strategy.startWorkers) - 1) * 8)) - Math.min(3, input.burned / 2000);
  f.industry += s.strategy.investedThisMonth > 0 ? 1.5 : -0.2;
  s.strategy.investedThisMonth = 0;
  for (const id of FACTION_IDS) f[id] = clamp(f[id] + (55 - f[id]) * 0.03);
  const avg = FACTION_IDS.reduce((a, id) => a + f[id] * FACTIONS[id].weight, 0);
  s.confidence = clamp(s.confidence + (avg - 55) * 0.025);

  // Salaries.
  const pay = STAFF_ROLE_IDS.reduce((a, role) => a + (s.strategy.staff[role]?.salary ?? 0), 0);
  s.treasury -= pay;
  s.month.spend.operations += pay;
  if ((s.history.length + 1) % 6 === 0) s.strategy.candidates = makeCandidates(s);

  // Private companies: finances drift; struggling ones ask for help.
  for (const def of SITES) {
    if (def.owner !== 'private') continue;
    const site = s.sites[def.id];
    if (site.status === 'closed') continue;
    const busy = site.processes.some((p) => p.lastLimit === 'capacity');
    site.health = clamp(site.health + (busy ? 1.2 : -1.5) + (rand(s) - 0.55) * 4 - (site.disruptionDays > 0 ? 3 : 0));
    if (site.health < 22 && !s.strategy.decisions.some((d) => d.site === def.id)) {
      const cost = Math.round(20 + def.crew * 0.06);
      s.strategy.decisions.push({
        id: s.nextId++,
        kind: 'bailout',
        title: `${def.name} is near collapse`,
        body: `${def.name} has missed payroll and its lenders are circling. If it closes, everything downstream of it loses a supplier.`,
        options: [
          { id: 'bail', label: `Bail it out ($${cost}M)`, detail: 'Its finances recover.' },
          { id: 'let', label: 'Let the market decide', detail: 'About even odds it closes for good.' },
        ],
        fallback: 'let',
        site: def.id,
        value: cost,
      });
      feed(s, 'warn', `${def.name} is in financial trouble. A decision is waiting.`, def.id, true);
    }
  }

  // Objectives.
  for (const o of s.strategy.objectives) {
    if (o.status !== 'open') continue;
    const def = OBJECTIVES.find((x) => x.id === o.id)!;
    if (def.check(s)) {
      o.status = 'done';
      s.treasury += def.money;
      s.month.income.sales += def.money;
      feed(s, 'good', `Objective complete: ${def.title}. The Committee releases $${def.money}M.`, undefined, true);
    } else if (s.day >= def.by) {
      o.status = 'failed';
      s.confidence = clamp(s.confidence - 3);
      feed(s, 'bad', `Objective missed: ${def.title}.`);
    }
  }

  // Fiscal year: a budget review and a budget request.
  if ((s.history.length + 1) % 12 === 0) {
    // Budgets keep up with most, but not all, of inflation.
    const next = Math.round(s.strategy.baseBudget * (1 + (s.priceIndex - 1) * 0.7) * (0.85 + s.confidence / 333));
    // The Committee's provisional figure; the hearing (see hearings.ts) settles the final one.
    s.appropriation = next;
    void f;
  }
}

/** Other modules handle their own decision cards; they register here to avoid import cycles. */
export type Resolver = (s: SimState, d: Decision, opt: string, feed: Feed) => boolean;
const RESOLVERS: Resolver[] = [];
export const registerResolver = (r: Resolver) => {
  if (!RESOLVERS.includes(r)) RESOLVERS.push(r);
};

export function resolveDecision(s: SimState, id: number, option: string, feed: Feed): void {
  const d = s.strategy.decisions.find((x) => x.id === id);
  if (!d) return;
  s.strategy.decisions = s.strategy.decisions.filter((x) => x.id !== id);
  const opt = d.options.some((o) => o.id === option) ? option : d.fallback;
  for (const r of RESOLVERS) if (r(s, d, opt, feed)) return;
  if (d.kind === 'bailout' && d.site) {
    const site = s.sites[d.site];
    if (opt === 'bail') {
      s.treasury -= d.value ?? 0;
      s.month.spend.projects += d.value ?? 0;
      site.health = 70;
      s.strategy.factions.industry = clamp(s.strategy.factions.industry + 3);
      feed(s, 'info', `${SITE_BY_ID[d.site].name} is bailed out.`, d.site);
    } else if (rand(s) < 0.5) {
      site.status = 'closed';
      for (const p of site.processes) p.run = 'idle';
      s.contracts = s.contracts.filter((c) => c.site !== d.site);
      s.strategy.factions.regions = clamp(s.strategy.factions.regions - 5);
      feed(s, 'bad', `${SITE_BY_ID[d.site].name} has closed for good.`, d.site, true);
    } else {
      site.health = 35;
      feed(s, 'warn', `${SITE_BY_ID[d.site].name} scrapes through, for now.`, d.site);
    }
  }
  if (d.kind === 'budget') {
    const f = s.strategy.factions;
    if (opt === 'lean') {
      s.appropriation = Math.round(s.appropriation * 0.95);
      f.treasury = clamp(f.treasury + 8);
    } else if (opt === 'push') {
      if (rand(s) * 100 < ((f.hawks + f.treasury) / 2) * 0.9) {
        s.appropriation = Math.round(s.appropriation * 1.12);
        feed(s, 'good', `The Committee grants your request: $${s.appropriation}M a month.`);
      } else {
        s.appropriation = Math.round(s.appropriation * 0.97);
        s.confidence = clamp(s.confidence - 3);
        feed(s, 'bad', `The Committee rejects your request and trims the budget to $${s.appropriation}M a month.`);
      }
    }
  }
}

/** Unanswered decisions take their default at the end of each month. */
export function expireDecisions(s: SimState, feed: Feed): void {
  for (const d of [...s.strategy.decisions]) resolveDecision(s, d.id, d.fallback, feed);
}
