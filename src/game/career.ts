// The career record (19.2, docs/career.md): every career you have served, kept in this browser across games, and the
// unlocks it earns. The game itself stays pure: a save knows only its careerId and its own terms (s.career).
import { CAREER, careerPoints, pointsSoFar, rankOf } from '../sim/career';
import { termReport } from '../sim/analytics';
import { legacyOf } from '../sim/legacy';
import { SCENARIOS } from '../sim/setup';
import type { Difficulty, ScenarioId, SimState } from '../sim/types';
import { countryTitle } from '../sim/worldgen';

const KEY = 'forge-command-careers';
const META = 'forge-command-career-meta';

export type CareerStatus = 'active' | 'retired' | 'dismissed' | 'notReappointed' | 'abandoned';

export interface CareerTermRecord {
  term: number;
  score: number;
  grade: string;
  points: number;
  title: string;
  dismissed: boolean;
}

export interface CareerRecord {
  id: string;
  startedAt: string;
  country: string;
  world: number | null;
  scenario: ScenarioId;
  difficulty: Difficulty;
  terms: CareerTermRecord[];
  status: CareerStatus;
  points: number;
  rank: number;
}

export function loadCareers(): CareerRecord[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveCareers(list: CareerRecord[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, CAREER.recordKeep)));
  } catch {
    /* storage unavailable */
  }
}

/** "Open every posting" for players who would rather not earn them. Ranks are still awarded. */
export function openPostings(): boolean {
  try {
    return JSON.parse(localStorage.getItem(META) ?? '{}').openPostings === true;
  } catch {
    return false;
  }
}
export function setOpenPostings(v: boolean): void {
  try {
    localStorage.setItem(META, JSON.stringify({ openPostings: v }));
  } catch {
    /* storage unavailable */
  }
}

export const newCareerId = (seed: number) => `${seed}-${Date.now()}`;

/** Starts a career's record. Any other active career is marked abandoned. */
export function beginCareer(s: SimState): void {
  const list = loadCareers().map((c) => (c.status === 'active' ? { ...c, status: 'abandoned' as const } : c));
  list.unshift({ id: s.careerId!, startedAt: new Date().toISOString(), country: countryTitle(), world: s.world, scenario: s.scenario, difficulty: s.difficulty, terms: [], status: 'active', points: 0, rank: 0 });
  saveCareers(list);
}

/**
 * Writes the term just ended into its career's record (once per term: a second call changes nothing new), and the
 * career's status. Call when a career game's term is over, and again with `retire` if the player retires.
 */
export function recordCareerTerm(s: SimState, opts: { retire?: boolean; notReappointed?: boolean } = {}): CareerRecord | null {
  if (!s.careerId || !s.over) return null;
  const list = loadCareers();
  let rec = list.find((c) => c.id === s.careerId);
  if (!rec) {
    rec = { id: s.careerId, startedAt: new Date().toISOString(), country: countryTitle(), world: s.world, scenario: s.scenario, difficulty: s.difficulty, terms: [], status: 'active', points: 0, rank: 0 };
    list.unshift(rec);
  }
  const pts = pointsSoFar(s);
  const term = s.term ?? 1;
  const r = termReport(s);
  const past = (s.career ?? []).map((t, i) => rec!.terms.find((x) => x.term === t.term) ?? { term: t.term, score: t.score, grade: t.grade, points: pts[i], title: '', dismissed: false });
  const now: CareerTermRecord = { term, score: r.score, grade: r.grade, points: pts.at(-1) ?? 0, title: legacyOf(s).title, dismissed: s.outcome === 'dismissed' };
  rec.terms = [...past.filter((t) => t.term !== term), now].sort((a, b) => a.term - b.term);
  rec.status = s.outcome === 'dismissed' ? 'dismissed' : opts.retire ? 'retired' : opts.notReappointed ? 'notReappointed' : 'active';
  rec.points = careerPoints(rec.terms.map((t) => t.points), rec.status === 'retired');
  rec.rank = rankOf(rec.points);
  saveCareers(list);
  return rec;
}

/** The best any career has done: the most terms served, and the highest rank. */
export function careerBests(list = loadCareers()): { terms: number; rank: number; careers: number } {
  return {
    terms: Math.max(0, ...list.map((c) => c.terms.filter((t) => !t.dismissed).length)),
    rank: Math.max(0, ...list.map((c) => c.rank)),
    careers: list.length,
  };
}

export type UnlockId = keyof typeof CAREER.unlocks;
type Rule = { name: string; terms?: number; term?: number; rank?: number; orTerm?: number };

/** Whether a career posting or option is open, from the record (or because every posting is opened). */
export function unlocked(id: UnlockId, list = loadCareers()): boolean {
  if (openPostings()) return true;
  const rule = CAREER.unlocks[id] as Rule;
  const b = careerBests(list);
  const reached = Math.max(0, ...list.map((c) => c.terms.length));
  if (rule.terms !== undefined && b.terms >= rule.terms) return true;
  if (rule.term !== undefined && reached >= rule.term) return true;
  if (rule.rank !== undefined && b.rank >= rule.rank) return true;
  if (rule.orTerm !== undefined && reached >= rule.orTerm) return true;
  return false;
}

/** What it takes to open a posting, in a few words. */
export function unlockText(id: UnlockId): string {
  const rule = CAREER.unlocks[id] as Rule;
  if (rule.terms !== undefined) return `Complete ${rule.terms === 1 ? 'a term' : `${rule.terms} terms`} in a career.`;
  if (rule.rank !== undefined) return `Reach ${CAREER.ranks[rule.rank].name}, or term ${rule.orTerm} in a career.`;
  return `Reach term ${rule.term} in a career.`;
}

/** The scenario's unlock, if it has one. */
export const scenarioUnlock = (id: ScenarioId): UnlockId | null => (id in CAREER.unlocks ? (id as UnlockId) : null);

/** The next thing still locked, for the end-of-term teaser. */
export function nextUnlock(list = loadCareers()): { name: string; how: string } | null {
  const id = (Object.keys(CAREER.unlocks) as UnlockId[]).find((u) => !unlocked(u, list));
  return id ? { name: CAREER.unlocks[id].name, how: unlockText(id) } : null;
}

export const postingName = (id: ScenarioId) => SCENARIOS[id]?.name ?? id;
