// People and politics: key staff, Committee factions, public support and export policy.
import {
  CAMPUS_IDS,
  COMPONENTS,
  FACILITY_IDS,
  FACTIONS,
  FACTION_IDS,
  FIRST_NAMES,
  LAST_NAMES,
  PARTNER_IDS,
  SALARY_PER_SKILL,
  STAFF_ROLES,
  STAFF_ROLE_IDS,
  SUPPLIERS,
  SUPPLIER_IDS,
} from './data';
import { averageGoodwill } from './partners';
import { clamp, pick, rand, randInt } from './rng';
import type { GameState, MonthReport, Person, Quirk, StaffRole } from './types';

type Messages = MonthReport['messages'];

export const skillOf = (s: GameState, role: StaffRole) => s.staff[role]?.skill ?? 0;
export const hasQuirk = (s: GameState, q: Quirk) => STAFF_ROLE_IDS.some((r) => s.staff[r]?.quirk === q);
export const salaries = (s: GameState) => STAFF_ROLE_IDS.reduce((a, r) => a + (s.staff[r]?.salary ?? 0), 0);

/** Price multiplier from a good Chief of Procurement. */
export const procurementMult = (s: GameState) => 1 - 0.04 * skillOf(s, 'procurement');
export const qualityMult = (s: GameState) => 1 - 0.15 * skillOf(s, 'quality');
export const transportMult = (s: GameState) => 1 + 0.1 * skillOf(s, 'logistics');
export const airliftMult = (s: GameState) => 1 - 0.2 * skillOf(s, 'logistics');
export const researchMult = (s: GameState) => 1 - 0.12 * skillOf(s, 'research');
export const moraleBonus = (s: GameState) => 3 * skillOf(s, 'labor') - (hasQuirk(s, 'abrasive') ? 3 : 0);

export function makeCandidate(s: GameState, role: StaffRole): Person {
  const skill = rand(s) < 0.25 ? 3 : rand(s) < 0.55 ? 2 : 1;
  const r = rand(s);
  const quirk: Quirk = r < 0.45 ? 'none' : r < 0.6 ? 'abrasive' : r < 0.75 ? 'connected' : r < 0.9 ? 'frugal' : 'favourite';
  return {
    id: s.nextId++,
    name: `${pick(s, FIRST_NAMES)} ${pick(s, LAST_NAMES)}`,
    role,
    skill,
    quirk,
    salary: Math.round(SALARY_PER_SKILL * skill * (0.85 + rand(s) * 0.3) * 1000) / 1000,
    tenure: 0,
  };
}

export function refreshCandidates(s: GameState): void {
  s.candidates = STAFF_ROLE_IDS.flatMap((role) => [makeCandidate(s, role), makeCandidate(s, role)]);
}

/** Share of last month's component deliveries (by value) that came from domestic suppliers. */
function domesticShare(s: GameState): number {
  let home = 0;
  let all = 0;
  for (const sid of SUPPLIER_IDS) {
    const v = s.suppliers[sid].lastDelivered * COMPONENTS[SUPPLIERS[sid].component].price;
    all += v;
    if (SUPPLIERS[sid].nation === 'aldmere') home += v;
  }
  return all > 0 ? home / all : 0.65;
}

export interface PoliticsInput {
  readiness: number;
  excessLeaks: number;
  monthlyNet: number;
}

export function runPolitics(s: GameState, input: PoliticsInput, messages: Messages): void {
  const f = s.factions;
  const before = { ...f };
  const crisis = s.crisis?.phase === 'active';

  f.hawks += (input.readiness - 0.6) * 4 - Math.min(6, input.excessLeaks * 0.4) + (hasQuirk(s, 'favourite') ? 0.5 : 0) + (s.publicSupport - 50) * 0.02;
  f.hawks += s.exportPolicy === 'restrictive' ? 0.3 : s.exportPolicy === 'open' ? -0.4 : 0;

  f.treasury += s.treasury < 0 ? -1 - -s.treasury / 500 : 0.5;
  f.treasury += input.monthlyNet < 0 ? -0.8 : 0.4;
  f.treasury += hasQuirk(s, 'frugal') ? 0.5 : 0;

  const workers = CAMPUS_IDS.reduce((a, c) => a + s.campuses[c].workers, 0);
  f.regions += clamp((workers / Math.max(1, s.startWorkers) - 1) * 8, -2, 2);
  f.regions -= CAMPUS_IDS.filter((c) => s.campuses[c].strikeMonths > 0).length * 2;

  f.industry += (domesticShare(s) - 0.65) * 6 + FACILITY_IDS.filter((x) => s.facilities[x].status === 'running').length * 0.5;

  f.internationalists += (averageGoodwill(s) - 50) * 0.05 + (s.exportPolicy === 'open' ? 0.5 : s.exportPolicy === 'restrictive' ? -0.5 : 0);

  for (const id of FACTION_IDS) f[id] = clamp(f[id] + (55 - f[id]) * 0.03);

  s.publicSupport = clamp(s.publicSupport + (crisis ? 0.5 : 0) - Math.min(5, input.excessLeaks * 0.6) + (input.readiness - 0.6) * 2 + (55 - s.publicSupport) * 0.05);

  // The factions pull the Committee's overall confidence.
  s.confidence = clamp(s.confidence + (factionAverage(s) - 55) * 0.025);

  for (const id of FACTION_IDS) {
    if (before[id] >= 35 && f[id] < 35) messages.push({ tone: 'bad', text: `The ${FACTIONS[id].name.toLowerCase()} are turning against you. They want: ${FACTIONS[id].wants.toLowerCase()}` });
  }

  // Partners warm to a well-connected staff member.
  if (hasQuirk(s, 'connected')) for (const p of PARTNER_IDS) s.partners[p].goodwill = clamp(s.partners[p].goodwill + 0.4);

  // Staff: tenure, poaching and retirement.
  for (const role of STAFF_ROLE_IDS) {
    const p = s.staff[role];
    if (!p) continue;
    p.tenure++;
    if (p.skill >= 2 && rand(s) < 0.012 && !s.decisions.some((d) => d.kind === 'poach')) {
      s.decisions.push({
        id: s.nextId++,
        kind: 'poach',
        title: `A rival firm wants ${p.name}`,
        body: `${p.name}, your ${STAFF_ROLES[role].title}, has an offer from a private contractor at half again the salary.`,
        options: [
          { id: 'match', label: 'Match the offer', detail: `Salary rises to $${Math.round(p.salary * 1.5 * 1000)}K a month.` },
          { id: 'release', label: 'Let them go', detail: 'The post falls vacant.' },
        ],
        fallback: 'release',
        data: { role },
      });
    } else if (p.tenure > 30 && rand(s) < 0.01) {
      messages.push({ tone: 'warn', text: `${p.name}, your ${STAFF_ROLES[role].title}, retires. The post is vacant.` });
      s.staff[role] = null;
    }
  }
  if (s.month % 6 === 5) refreshCandidates(s);
}

export const factionAverage = (s: GameState) => FACTION_IDS.reduce((a, id) => a + s.factions[id] * FACTIONS[id].weight, 0);

/** End-of-year budget request: a decision card. */
export function budgetRequestDecision(s: GameState): void {
  const odds = Math.round(((s.factions.hawks + s.factions.treasury) / 2) * 0.9);
  s.decisions.push({
    id: s.nextId++,
    kind: 'budgetRequest',
    title: 'Your budget request for next year',
    body: `The Committee has set a provisional appropriation of $${s.appropriation}M a month. You can accept it, ask for less to please the treasury bench, or push for more.`,
    options: [
      { id: 'standard', label: 'Accept it', detail: 'No fuss.' },
      { id: 'lean', label: 'Ask for 5% less', detail: 'The treasury bench will remember it fondly.' },
      { id: 'ambitious', label: 'Push for 12% more', detail: `About a ${odds}% chance. If it fails, you get 3% less and look greedy.` },
    ],
    fallback: 'standard',
    data: { odds },
  });
}

export function resolvePoliticsDecision(s: GameState, kind: string, option: string, data: Record<string, string | number>, messages: Messages): boolean {
  if (kind === 'poach') {
    const role = data.role as StaffRole;
    const p = s.staff[role];
    if (!p) return true;
    if (option === 'match') {
      p.salary = Math.round(p.salary * 1.5 * 1000) / 1000;
      messages.push({ tone: 'info', text: `${p.name} stays.` });
    } else {
      messages.push({ tone: 'warn', text: `${p.name} leaves for the private sector. The post is vacant.` });
      s.staff[role] = null;
    }
    return true;
  }
  if (kind === 'budgetRequest') {
    if (option === 'lean') {
      s.appropriation = Math.round(s.appropriation * 0.95);
      s.factions.treasury = clamp(s.factions.treasury + 8);
    } else if (option === 'ambitious') {
      if (rand(s) * 100 < Number(data.odds)) {
        s.appropriation = Math.round(s.appropriation * 1.12);
        s.factions.hawks = clamp(s.factions.hawks + 3);
        messages.push({ tone: 'good', text: `The Committee grants your ambitious request: $${s.appropriation}M a month.` });
      } else {
        s.appropriation = Math.round(s.appropriation * 0.97);
        s.confidence = clamp(s.confidence - 3);
        s.factions.treasury = clamp(s.factions.treasury - 5);
        messages.push({ tone: 'bad', text: `The Committee rejects your request as greedy and trims the budget to $${s.appropriation}M a month.` });
      }
    }
    return true;
  }
  return false;
}

export const randomTenure = (s: GameState) => randInt(s, 0, 12);
