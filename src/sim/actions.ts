// Player actions on the network. validate explains why an action is not allowed; apply never mutates its input.
import { DAYS_PER_MONTH, lotQty } from './selectors';
import type { Policy, RunLevel, SimState } from './types';
import { MATERIALS, RECIPES, SITE_BY_ID, type LineId, type MaterialId } from './world';

export type SimAction =
  | { type: 'setRun'; site: string; process: number; run: RunLevel }
  | { type: 'expand'; site: string; process: number }
  | { type: 'hire'; site: string; count: number }
  | { type: 'repair'; site: string }
  | { type: 'signContract'; site: string; material: MaterialId; perDay: number; months: 12 | 24 | 36 }
  | { type: 'cancelContract'; contract: number }
  | { type: 'qualify'; site: string }
  | { type: 'invest'; site: string; process: number }
  | { type: 'refurbish'; site: string; line: LineId }
  | { type: 'setPolicy'; policy: Partial<Policy> };

export const CONTRACT_DISCOUNT = { 12: 0.9, 24: 0.85, 36: 0.8 } as const;
const HIRE_COST = 0.015;
export const TRAINING_DAYS = 90;

/** $M to add 25% to a process. Scales with the value it makes. */
export function expandCost(s: SimState, site: string, process: number): number {
  const p = s.sites[site].processes[process];
  const out = RECIPES[p.recipe].output;
  const yearly = (p.capacity / (1 + 0.25 * p.expansions)) * MATERIALS[out].price * 360;
  return Math.max(8, Math.round(yearly * 0.12));
}
export const investCost = (s: SimState, site: string, process: number) => Math.round(expandCost(s, site, process) * 1.4);
export const repairCost = (s: SimState, site: string) => Math.max(2, Math.round((100 - s.sites[site].condition) * SITE_BY_ID[site].crew * 0.0004));
export const qualifyCost = (site: string) => Math.round(15 + SITE_BY_ID[site].crew * 0.08);
export const QUALIFY_DAYS = 240;
export const refurbishCost = (line: LineId, qty: number) => qty * MATERIALS[line].price * 0.35;

const funds = (s: SimState, cost: number) => (s.treasury >= cost ? null : `Not enough money (needs $${Math.round(cost)}M).`);

export function validate(s: SimState, a: SimAction): string | null {
  if (s.over) return 'The campaign is over.';
  const site = 'site' in a ? s.sites[a.site] : null;
  if ('site' in a && !site) return 'Unknown site.';
  const def = site ? SITE_BY_ID[site.id] : null;
  switch (a.type) {
    case 'setRun':
      if (def!.owner !== 'state') return 'You can only run your own plants.';
      return site!.processes[a.process] ? null : 'Unknown process.';
    case 'expand':
      if (def!.owner !== 'state') return 'Invest in a supplier to expand its capacity.';
      if (!site!.processes[a.process]) return 'Unknown process.';
      if (site!.processes[a.process].expansions >= 4) return 'No room left on this site.';
      return funds(s, expandCost(s, a.site, a.process));
    case 'hire':
      if (def!.owner !== 'state') return 'Only your own sites hire directly.';
      if (!(a.count > 0)) return 'Hire at least one person.';
      return funds(s, a.count * HIRE_COST);
    case 'repair':
      if (def!.owner !== 'state') return 'Only your own sites.';
      if (site!.condition >= 95) return 'Already in good repair.';
      return funds(s, repairCost(s, a.site));
    case 'signContract': {
      if (def!.owner === 'state') return 'You do not contract with yourself.';
      if (!site!.qualified) return `${def!.name} is not qualified to supply your arsenals yet.`;
      if (!def!.processes.some((p) => RECIPES[p.recipe].output === a.material || RECIPES[p.recipe].extra?.[a.material])) return `${def!.name} does not make that.`;
      return a.perDay > 0 ? null : 'Quantity must be above zero.';
    }
    case 'cancelContract':
      return s.contracts.some((c) => c.id === a.contract) ? null : 'No such contract.';
    case 'qualify':
      if (def!.owner === 'state') return 'Your own sites need no qualification.';
      if (site!.qualified) return 'Already qualified.';
      if (site!.qualifyingDays !== null) return 'Qualification already under way.';
      return funds(s, qualifyCost(a.site));
    case 'invest':
      if (def!.owner !== 'private') return 'You can only invest in domestic companies.';
      if (!site!.processes[a.process]) return 'Unknown process.';
      if (site!.processes[a.process].expansions >= 3) return 'This plant cannot grow any further.';
      return funds(s, investCost(s, a.site, a.process));
    case 'refurbish': {
      const q = site!.unserviceable[a.line] ?? 0;
      if (q < 1) return 'Nothing waiting for refurbishment here.';
      if (a.line === 'shell155') return 'Old shells are not worth refurbishing.';
      return funds(s, refurbishCost(a.line, q));
    }
    case 'setPolicy':
      return null;
  }
}

function charge(s: SimState, cost: number): void {
  s.treasury -= cost;
  s.month.spend.projects += cost;
}

export function apply(state: SimState, a: SimAction): SimState {
  if (validate(state, a)) return state;
  const s = structuredClone(state);
  switch (a.type) {
    case 'setRun':
      s.sites[a.site].processes[a.process].run = a.run;
      break;
    case 'expand':
    case 'invest': {
      const cost = a.type === 'expand' ? expandCost(s, a.site, a.process) : investCost(s, a.site, a.process);
      charge(s, cost);
      const p = s.sites[a.site].processes[a.process];
      const base = p.capacity / (1 + 0.25 * p.expansions);
      const add = base * (a.type === 'invest' ? 0.3 : 0.25);
      // New capacity is installed, inspected, then ramps up from about 30%.
      p.maturity = (p.capacity * p.maturity + add * 0.1) / (p.capacity + add);
      p.capacity += add;
      p.expansions++;
      s.feed.push({ day: s.day, tone: 'info', text: `New capacity ordered at ${SITE_BY_ID[a.site].name}: ${RECIPES[p.recipe].name}.`, site: a.site });
      break;
    }
    case 'hire':
      charge(s, a.count * HIRE_COST);
      s.sites[a.site].trainees.push({ count: Math.floor(a.count), days: TRAINING_DAYS });
      break;
    case 'repair':
      charge(s, repairCost(s, a.site));
      s.sites[a.site].condition = 100;
      break;
    case 'signContract':
      s.contracts.push({
        id: s.nextId++,
        site: a.site,
        material: a.material,
        perDay: a.perDay,
        price: MATERIALS[a.material].price * CONTRACT_DISCOUNT[a.months],
        endDay: s.day + a.months * DAYS_PER_MONTH,
      });
      break;
    case 'cancelContract':
      s.contracts = s.contracts.filter((c) => c.id !== a.contract);
      break;
    case 'qualify':
      charge(s, qualifyCost(a.site));
      s.sites[a.site].qualifyingDays = QUALIFY_DAYS;
      break;
    case 'refurbish': {
      const site = s.sites[a.site];
      const q = site.unserviceable[a.line] ?? 0;
      charge(s, refurbishCost(a.line, q));
      site.unserviceable[a.line] = 0;
      // New motors and recertification: five more years of service.
      const lots = site.lots[a.line] ?? (site.lots[a.line] = []);
      lots.push({ qty: q, made: s.day, until: s.day + 5 * 360 });
      lots.sort((x, y) => x.until - y.until);
      s.feed.push({ day: s.day, tone: 'good', text: `${Math.round(q)} ${MATERIALS[a.line].name} refurbished at ${SITE_BY_ID[a.site].name}: five more years of service.`, site: a.site });
      void lotQty;
      break;
    }
    case 'setPolicy':
      s.policy = { ...s.policy, ...a.policy, depotDays: { ...s.policy.depotDays, ...(a.policy.depotDays ?? {}) } };
      break;
  }
  return s;
}

export function applyAll(s: SimState, actions: SimAction[]): SimState {
  return actions.reduce(apply, s);
}
