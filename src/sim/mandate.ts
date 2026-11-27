// The Committee's mandate (docs/mandate.md): each term the Defence Committee sets 3–4 weighted goals that pull against
// each other. Each goal is measured from the monthly reports, scored 0–1 for each fiscal year of the term, and the
// weighted sum is the main part of the grade and of the Committee's monthly confidence. The mandate tightens one step
// each fiscal year (up to a cap), and starts tighter in later terms.
//
// Everything here is derived from the history and the scenario, so nothing new is saved beyond a few month-end
// figures (see recordMandateMonth), and older saves need no migration.
import { independenceWeight } from './features';
import T from './tuning/mandate.json';
import { monthSpend, monthWaste } from './audit';
import { communityTowns } from './communities';
import type { Difficulty, MonthReport, ScenarioId, SimState } from './types';
import { REGIONS, SITES, type RegionId } from './world';

export type GoalId = 'readiness' | 'value' | 'jobs' | 'independence' | 'stewardship' | 'shield';
type Band = keyof typeof T.goals;

export const GOALS: Record<GoalId, { name: string; blurb: string }> = {
  readiness: { name: 'Readiness', blurb: 'Rounds in reserve against the Committee’s target, averaged over the year.' },
  value: { name: 'Value for money', blurb: 'What running the industry costs against your budget, for the readiness it buys. Spot buying and overstock make it worse.' },
  jobs: { name: 'Regional jobs', blurb: 'Work spread fairly across the regions (your plants and contracted suppliers), and the mood of your towns.' },
  independence: { name: 'Supply independence', blurb: 'The share of what you buy that comes from foreign suppliers. Foreign is cheaper; home is safer.' },
  stewardship: { name: 'Stewardship', blurb: 'Little waste for the Auditor-General, and money in hand at the year’s end.' },
  shield: { name: 'Shield', blurb: 'The share of incoming threats that got through. Interceptors cost money.' },
};

/** A straight ramp from 0 at `zero` to 1 at `full` (either way round), clamped. */
export function lin(x: number, zero: number, full: number): number {
  if (zero === full) return x >= full ? 1 : 0;
  return Math.max(0, Math.min(1, (x - zero) / (full - zero)));
}

const termMonths = (s: SimState): MonthReport[] => s.history.slice(s.termMonth ?? 0);

/** The term's months split into fiscal years of twelve. */
export function termYears(s: SimState, months: MonthReport[] = termMonths(s)): MonthReport[][] {
  const out: MonthReport[][] = [];
  for (let i = 0; i < months.length; i += 12) out.push(months.slice(i, i + 12));
  return out;
}

/** How many steps tighter the mandate is in fiscal year `year` (0-based) of this term. */
export function ratchetFor(s: SimState, year: number): number {
  if (s.scenario === 'tutorial') return 0;
  return Math.min(T.ratchetMax, year) + Math.min(T.ratchetMax, (s.term ?? 1) - 1);
}

const hasForeign = () => SITES.some((d) => d.owner === 'foreign');

/** The goals and weights for this game, in a given fiscal year. Goals that cannot be measured on this map are dropped. */
export function mandateGoals(s: SimState, year = currentYear(s)): { id: GoalId; weight: number }[] {
  const scenario: ScenarioId = s.story ? 'standard' : s.scenario;
  let table: Partial<Record<GoalId, number>> = T.mandates[scenario as keyof typeof T.mandates] ?? T.mandates.standard;
  // The tutorial adds stewardship in its second year.
  if (scenario === 'tutorial' && year >= 1) table = { readiness: 0.35, value: 0.25, jobs: 0.25, stewardship: 0.15 };
  let goals = (Object.entries(table) as [GoalId, number][]).map(([id, weight]) => ({ id, weight }));
  // On a map that relies on a foreign supplier (19.0b), the Committee also weighs supply independence.
  const indep = independenceWeight(s);
  if (indep > 0 && !goals.some((g) => g.id === 'independence')) goals.push({ id: 'independence', weight: indep });
  if (!hasForeign()) goals = goals.filter((g) => g.id !== 'independence');
  if (!communityTowns(s).length) goals = goals.filter((g) => g.id !== 'jobs');
  const total = goals.reduce((a, g) => a + g.weight, 0) || 1;
  return goals.map((g) => ({ id: g.id, weight: g.weight / total }));
}

export const currentYear = (s: SimState) => Math.floor(termMonths(s).length / 12);

/** The zero and full thresholds of one band in a year, after the ratchet (and the Rebuild scenario's early ease). */
function band(s: SimState, b: Band, year: number): [number, number] {
  const g = T.goals[b];
  const d: Difficulty = s.difficulty;
  const r = ratchetFor(s, year) * g.ratchet;
  // In a war, under sanctions or rebuilding, the Committee expects less on the racks (more so early in a rebuild).
  let ease = 0;
  if (b === 'readiness') ease = ((T.scenarioReadinessEase as Record<string, number>)[s.scenario] ?? 0) + (s.scenario === 'rebuild' ? (T.rebuildReadinessEase[year] ?? 0) : 0);
  return [g.zero[d] + r - ease, g.full[d] + r - ease];
}

const sum = (ms: MonthReport[], f: (m: MonthReport) => number) => ms.reduce((a, m) => a + f(m), 0);
const mean = (ms: MonthReport[], f: (m: MonthReport) => number) => (ms.length ? sum(ms, f) / ms.length : 0);

/** The raw figure for a goal over some months (what the Home card shows), and how it scores from 0 to 1. */
export function measure(s: SimState, id: GoalId, ms: MonthReport[], year: number): { raw: number; score: number } {
  const at = (b: Band, x: number) => lin(x, ...band(s, b, year));
  switch (id) {
    case 'readiness': {
      const raw = mean(ms, (m) => m.readiness);
      return { raw, score: at('readiness', raw) };
    }
    case 'value': {
      // Running costs at constant prices, against the budget, for the readiness bought.
      const cost = sum(ms, (m) => (m.spend.purchases + m.spend.operations + m.spend.transport + (m.spend.energy ?? 0)) / (m.priceIndex ?? 1));
      const ready = Math.max(0.3, mean(ms, (m) => m.readiness));
      const raw = ms.length ? cost / (ms.length * Math.max(1, s.strategy.baseBudget) * ready) : 1;
      return { raw, score: at('value', raw) };
    }
    case 'jobs': {
      const bal = mean(ms, (m) => m.jobsBalance ?? 0.6);
      const mood = mean(ms, (m) => m.townMood ?? 55);
      return { raw: bal, score: 0.6 * at('jobsBalance', bal) + 0.4 * at('jobsMood', mood) };
    }
    case 'independence': {
      const bought = sum(ms, (m) => m.spend.purchases);
      const raw = bought > 0 ? sum(ms, (m) => m.foreign ?? 0) / bought : 0;
      return { raw, score: at('independence', raw) };
    }
    case 'stewardship': {
      const spend = sum(ms, monthSpend);
      const waste = spend > 0 ? sum(ms, monthWaste) / spend : 0;
      const cover = ms.at(-1)?.cover ?? 0;
      return { raw: waste, score: 0.5 * at('waste', waste) + 0.5 * at('cover', cover) };
    }
    case 'shield': {
      const leaked = sum(ms, (m) => Object.values(m.leaked).reduce((a, b) => a + b, 0));
      const stopped = sum(ms, (m) => Object.values(m.stopped).reduce((a, b) => a + b, 0));
      const raw = leaked + stopped > 0 ? leaked / (leaked + stopped) : 0;
      return { raw, score: at('shield', raw) };
    }
  }
}

export interface GoalResult {
  id: GoalId;
  weight: number;
  raw: number;
  score: number;
}

/** How well a set of months met the mandate: each goal's score (empty racks gate the others), and the weighted sum. */
export function scoreMonths(s: SimState, ms: MonthReport[], year: number): { goals: GoalResult[]; total: number } {
  const r = mean(ms, (m) => m.readiness);
  // Empty racks earn nothing else: the other goals count in full at the readiness goal's zero point and fade to
  // nothing a gate's width below it (a struggling director keeps credit; one who does nothing does not).
  const [rz] = band(s, 'readiness', year);
  const gate = lin(r, rz - T.gateWidth, rz);
  const goals = mandateGoals(s, year).map(({ id, weight }) => {
    const m = measure(s, id, ms, year);
    const gated = id === 'readiness' || id === 'shield' ? m.score : m.score * gate;
    return { id, weight, raw: m.raw, score: gated };
  });
  return { goals, total: goals.reduce((a, g) => a + g.weight * g.score, 0) };
}

/** The term's mandate score so far: each fiscal year's score, weighted by its months. */
export function mandateScore(s: SimState, months: MonthReport[] = termMonths(s)): number {
  const years = termYears(s, months);
  const n = years.reduce((a, y) => a + y.length, 0);
  if (!n) return 0;
  return years.reduce((a, y, i) => a + scoreMonths(s, y, i).total * y.length, 0) / n;
}

/** Fills the month-end figures the mandate needs that the report does not already hold. Called as the month closes. */
export function recordMandateMonth(s: SimState): void {
  // Where the work is: your plants' crews, and suppliers you hold a live contract with, by region.
  const contracted = new Set(s.contracts.filter((c) => c.endDay > s.day).map((c) => c.site));
  const work: Partial<Record<RegionId, number>> = {};
  const fair: Partial<Record<RegionId, number>> = {};
  for (const d of SITES) {
    if (d.owner === 'foreign') continue;
    fair[d.region] = (fair[d.region] ?? 0) + d.crew;
    const site = s.sites[d.id];
    if (!site || site.status === 'closed') continue;
    const here = d.owner === 'state' ? site.workers : contracted.has(d.id) ? d.crew : 0;
    work[d.region] = (work[d.region] ?? 0) + here;
  }
  const totalWork = Object.values(work).reduce((a, b) => a + (b ?? 0), 0);
  const totalFair = Object.values(fair).reduce((a, b) => a + (b ?? 0), 0);
  let gap = 0;
  for (const r of Object.keys(REGIONS) as RegionId[]) gap += Math.abs((totalWork ? (work[r] ?? 0) / totalWork : 0) - (totalFair ? (fair[r] ?? 0) / totalFair : 0));
  s.month.jobsBalance = Math.round((1 - gap / 2) * 1000) / 1000;
  const towns = communityTowns(s);
  s.month.townMood = s.communities && towns.length ? Math.round((towns.reduce((a, t) => a + s.communities.mood[t], 0) / towns.length) * 10) / 10 : 55;
  s.month.cover = Math.round((s.treasury / Math.max(1, s.appropriation)) * 100) / 100;
}

/**
 * The mandate's part of this month's change in confidence (the month being closed is `s.month`, already filled in).
 * Returns the gain or loss, and the readiness floor that keeps empty racks dangerous whatever else is going well.
 */
export function mandateConfidence(s: SimState, ready: number): { mandate: number; floor: number } {
  const c = T.confidence;
  const d: Difficulty = s.difficulty;
  const offset = (c.scenarioOffset as Record<string, number>)[s.scenario] ?? 0;
  const later = c.perLaterTerm * Math.min(3, (s.term ?? 1) - 1);
  const filed = termMonths(s);
  const window = [...filed.slice(-(c.window - 1)), s.month];
  const year = Math.floor(filed.length / 12);
  // Until a few months are on file, only readiness is judged.
  const m = filed.length + 1 < c.window ? measure(s, 'readiness', window, year).score : scoreMonths(s, window, year).total;
  let mandate = (m - c.expect[d] - offset - later) * c.gain;
  if (mandate > 0) mandate *= Math.max(c.satMin, Math.min(1, (100 - s.confidence) / c.satSpan));
  const floor = -Math.max(0, c.floor[d] + offset + later - ready) * c.floorGain;
  return { mandate, floor };
}

/** How the Committee weighs leaks and land shortfalls in this scenario (1 = in full). */
export const fightScale = (s: SimState) => (T.confidence.fightScale as Record<string, number>)[s.scenario] ?? 1;

/** Next year's budget factor from the Committee's confidence (a narrow band, so the leader is not run away with). */
export const budgetFactor = (confidence: number) => T.budget.base + confidence / T.budget.divisor;

export interface ScoreParts {
  mandate: number;
  avgConfidence: number;
  interception: number;
  objectives: number;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export const gradeFor = (score: number): ScoreParts['grade'] => (score >= T.grades.A ? 'A' : score >= T.grades.B ? 'B' : score >= T.grades.C ? 'C' : score >= T.grades.D ? 'D' : 'F');

/** The term's score from its parts (see docs/mandate.md §4). */
export function scoreFrom(s: SimState, mandate: number, avgConfidence: number, interception: number, objectives: number, dismissed: boolean): ScoreParts {
  const w = T.score;
  // Confidence counts only above the line where the Committee merely tolerates you.
  const trust = Math.max(0, Math.min(1, (avgConfidence - w.confidenceFrom) / (100 - w.confidenceFrom)));
  const raw = w.mandate * mandate + w.confidence * trust + w.interception * interception + Math.min(w.objectiveCap, w.objectiveEach * objectives);
  const score = Math.round(T.difficultyMultiplier[s.difficulty] * raw - (dismissed ? w.dismissed : 0));
  return { mandate, avgConfidence, interception, objectives, score, grade: gradeFor(score) };
}

export interface Projection {
  year: number;
  goals: (GoalResult & { name: string })[];
  /** The term's projected score and grade, if things go on as they are. */
  parts: ScoreParts;
  /** Confidence is low enough that dismissal is a real risk. */
  risk: boolean;
  /** Fewer than three months of the term are on file: too early to project a grade. */
  early: boolean;
}

/** What Home shows: this year's goals so far, and the term's projected grade. */
export function projectMandate(s: SimState): Projection {
  const months = termMonths(s);
  const years = termYears(s, months);
  const year = Math.floor(months.length / 12);
  const thisYear = months.slice(year * 12);
  // Too little of this year on file to judge: assume an even half on each goal.
  const now = thisYear.length >= 3 ? scoreMonths(s, thisYear, year) : { goals: mandateGoals(s, year).map((g) => ({ ...g, raw: NaN, score: 0.5 })), total: 0.5 };
  const closed = years.filter((y) => y.length === 12);
  const closedSum = closed.reduce((a, y, i) => a + scoreMonths(s, y, i).total * 12, 0);
  // Early in a year the closed years speak for the term; with none closed yet, the even half stands in.
  const m = thisYear.length >= 3 || !closed.length ? (closedSum + now.total * Math.max(thisYear.length, 1)) / (closed.length * 12 + Math.max(thisYear.length, 1)) : closedSum / (closed.length * 12);
  const term = Math.max(1, Math.round((s.days - (s.termStartDay ?? 0)) / 30));
  const conf = months.reduce((a, x) => a + x.confidence, 0);
  const left = Math.max(0, term - months.length);
  const avgConfidence = (conf + s.confidence * left) / Math.max(1, months.length + left);
  const stopped = months.reduce((a, x) => a + Object.values(x.stopped).reduce((p, q) => p + q, 0), 0);
  const leaked = months.reduce((a, x) => a + Object.values(x.leaked).reduce((p, q) => p + q, 0), 0);
  const objectives = s.strategy.objectives.filter((o) => o.status === 'done').length;
  const parts = scoreFrom(s, m, avgConfidence, stopped + leaked > 0 ? stopped / (stopped + leaked) : 1, objectives, false);
  return { year, goals: now.goals.map((g) => ({ ...g, name: GOALS[g.id].name })), parts, risk: s.confidence < 20, early: months.length < 3 };
}
