// Release 19.2: the career (docs/career.md). A career is a campaign in one country, term after term: the second-term
// machinery (commitments.ts startSecondTerm, legacy.ts boons) carries the industry over, and this module adds the
// rules a career brings: a reappointment bar, career points and ranks, a look ahead at the next term, and the
// autopilot's choice to serve on. It is pure: the record kept across games lives in the UI (src/game/career.ts).
import C from './tuning/career.json';
import { termReport } from './analytics';
import { canSecondTerm } from './commitments';
import { boonsFor, type BoonId } from './legacy';
import { DAYS_PER_MONTH } from './selectors';
import type { Difficulty, ScenarioId, SimState } from './types';
import { MATERIALS } from './world';

export const CAREER = C;

/** Is this game a career? */
export const isCareer = (s: SimState) => !!s.careerId;

/** Why the Committee will not reappoint you, or null if it will. Outside a career, the plain second-term rule. */
export function canReappoint(s: SimState): string | null {
  const base = canSecondTerm(s);
  if (base) return base;
  if (!isCareer(s)) return null;
  const score = termReport(s).score;
  if (score < C.reappointMinScore) return `The Committee does not reappoint a director who scores below ${C.reappointMinScore}. This term scored ${score}.`;
  return null;
}

/** Points a term earns: its score, worth more in later terms, on harder settings, postings and abroad. */
export function termPoints(score: number, term: number, difficulty: Difficulty, scenario: ScenarioId, world: boolean, dismissed = false): number {
  const mult = (1 + C.termBonus * (term - 1)) * (C.diffMult[difficulty] ?? 1) * ((C.postingMult as Record<string, number>)[scenario] ?? 1) * (world ? C.worldMult : 1);
  return Math.round(Math.max(0, score) * mult * (dismissed ? C.dismissedTermFactor : 1));
}

/** A career's points from its terms' points, with the retirement bonus once it has earned one. */
export const careerPoints = (terms: number[], retired: boolean) => terms.reduce((a, b) => a + b, 0) + (retired && terms.length >= C.retireBonusFrom ? C.retireBonus : 0);

/** The rank a career's points reach (an index into CAREER.ranks). */
export function rankOf(points: number): number {
  let r = 0;
  C.ranks.forEach((x, i) => points >= x.points && (r = i));
  return r;
}

/** The points of every term served so far in this game, the current one included. */
export function pointsSoFar(s: SimState): number[] {
  const past = (s.career ?? []).map((t) => termPoints(t.score, t.term, s.difficulty, s.scenario, s.world !== null));
  if (s.over) past.push(termPoints(termReport(s).score, s.term ?? 1, s.difficulty, s.scenario, s.world !== null, s.outcome === 'dismissed'));
  return past;
}

/** The smallest grade next term that would reach the next rank, or null if no grade does (or there is none). */
export function gradeForNextRank(s: SimState, points: number): { rank: string; need: number; grade: string | null } | null {
  const r = rankOf(points);
  const next = C.ranks[r + 1];
  if (!next) return null;
  const need = next.points - points;
  const term = (s.term ?? 1) + 1;
  for (const [grade, score] of [['D', 42], ['C', 55], ['B', 68], ['A', 80]] as const) {
    if (termPoints(score, term, s.difficulty, s.scenario, s.world !== null) >= need) return { rank: next.name, need, grade };
  }
  return { rank: next.name, need, grade: null };
}

/** Work you leave running that the next term finishes: the pull of unfinished business. Up to four lines. */
export function unfinishedBusiness(s: SimState): string[] {
  const out: string[] = [];
  const months = (d: number) => Math.max(1, Math.round((d - s.day) / DAYS_PER_MONTH));
  for (const p of s.programmes ?? []) if (p.endDay > s.day) out.push(`Your ${MATERIALS[p.line].name} programme has ${months(p.endDay)} months to run.`);
  const building = Object.values(s.sites).filter((x) => x.status === 'building').length;
  if (building) out.push(`${building} plant${building > 1 ? 's are' : ' is'} still being built.`);
  if (s.strategy.research.active) out.push(`Research under way: ${Math.ceil(s.strategy.research.active.days)} days to go.`);
  const next = s.rival?.known.find((k) => k.fielded > s.day);
  if (next) out.push(`The rival fields a new weapon in about ${months(next.fielded)} months.`);
  return out.slice(0, 4);
}

/** The chief of staff serves on whenever the Committee will have it, taking the first legacy offered. */
export function autoReappoint(s: SimState): { type: 'secondTerm'; boon: BoonId } | null {
  if (canReappoint(s)) return null;
  return { type: 'secondTerm', boon: boonsFor(s)[0] };
}
