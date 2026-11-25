// Choices that last: multi-year procurement programmes, standing policies, and a second term.
import { termReport } from './analytics';
import { applyBoon, grudges, termStats, type BoonId } from './legacy';
import { clamp } from './rng';
import { DAYS_PER_MONTH } from './selectors';
import type { FeedItem, SimState } from './types';
import { MATERIALS, RECIPES, SITES, type LineId } from './world';

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

// ---------- Programmes ----------

export interface Programme {
  id: number;
  line: LineId;
  /** Rounds a month the Board has promised. */
  perMonth: number;
  /** $M a month the Committee adds to your budget while the promise is kept. */
  funding: number;
  start: number;
  endDay: number;
  /** Months the promise was missed. */
  misses: number;
}

export const PROGRAMME_YEARS = [3, 5] as const;
export const MAX_MISSES = 3;

/** What your arsenals can make of a line in a month, at full capacity. */
export function monthlyCapacity(s: SimState, line: LineId): number {
  let n = 0;
  for (const def of SITES) {
    if (def.owner !== 'state') continue;
    for (const p of s.sites[def.id].processes) if (RECIPES[p.recipe].output === line) n += (p.capacity + (p.ramp ?? []).reduce((a, r) => a + r.cap, 0)) * DAYS_PER_MONTH;
  }
  return n;
}

/** The terms the Committee would offer for a programme. */
export function programmeTerms(s: SimState, line: LineId, years: 3 | 5): { perMonth: number; funding: number } {
  const cap = monthlyCapacity(s, line);
  const perMonth = Math.max(1, Math.round(cap * (years === 5 ? 0.8 : 0.7)));
  // Funding pays for a good share of the rounds: a longer promise earns a better rate.
  const funding = Math.round(perMonth * MATERIALS[line].price * s.priceIndex * (years === 5 ? 0.75 : 0.6) * 10) / 10;
  return { perMonth, funding };
}

export function programmeMonth(s: SimState, feed: Feed): void {
  for (const p of [...s.programmes]) {
    if (s.day > p.endDay) {
      s.programmes = s.programmes.filter((x) => x.id !== p.id);
      s.strategy.factions.industry = clamp(s.strategy.factions.industry + 4);
      s.confidence = clamp(s.confidence + 3);
      feed(s, 'good', `The ${MATERIALS[p.line].name} programme ends with its promise kept. The Committee is pleased.`, undefined, true);
      continue;
    }
    const made = s.month.made[p.line] ?? 0;
    if (made >= p.perMonth * 0.9) {
      s.treasury += p.funding;
      s.month.income.appropriation += p.funding;
    } else {
      p.misses++;
      s.confidence = clamp(s.confidence - 2);
      if (p.misses >= MAX_MISSES) {
        s.programmes = s.programmes.filter((x) => x.id !== p.id);
        s.confidence = clamp(s.confidence - 6);
        s.strategy.factions.hawks = clamp(s.strategy.factions.hawks - 5);
        feed(s, 'bad', `The ${MATERIALS[p.line].name} programme is cancelled after ${MAX_MISSES} missed months. The money goes elsewhere.`, undefined, true);
      } else feed(s, 'warn', `${MATERIALS[p.line].name} programme: ${Math.round(made)} made against ${p.perMonth} promised. This month's funding is withheld (${p.misses} of ${MAX_MISSES} misses).`);
    }
  }
}

// ---------- Policies ----------

export type PolicyId = 'buyDomestic' | 'stockpileLaw' | 'openBooks' | 'warmBase' | 'greenDemil' | 'exportDrive';
export interface PolicyDef {
  id: PolicyId;
  name: string;
  pro: string;
  con: string;
}
export const POLICIES: Record<PolicyId, PolicyDef> = {
  buyDomestic: { id: 'buyDomestic', name: 'Buy Aldmeran', pro: 'Industry and the regions back you every month.', con: 'Your arsenals no longer take anything from foreign suppliers.' },
  stockpileLaw: { id: 'stockpileLaw', name: 'Strategic stockpile law', pro: 'The budget rises 10% straight away.', con: 'The reserve target becomes 15 months of use instead of 12.' },
  openBooks: { id: 'openBooks', name: 'Open books', pro: 'The treasury bench trusts you more each month.', con: 'Hawks grumble about publishing stock levels.' },
  warmBase: { id: 'warmBase', name: 'Warm industrial base', pro: 'New capacity ramps up half as fast again.', con: 'Running costs rise 6%.' },
  greenDemil: { id: 'greenDemil', name: 'Clean disposal pledge', pro: 'The regions approve every month.', con: 'Open burning is banned: old rounds must be recycled, which costs more.' },
  exportDrive: { id: 'exportDrive', name: 'Export drive', pro: 'Export orders come twice as often, at 10% better prices.', con: 'Hawks dislike rounds leaving the country.' },
};
export const POLICY_IDS = Object.keys(POLICIES) as PolicyId[];
export const MAX_POLICIES = 3;
export const REVOKE_COST = 4;

export const hasPolicy = (s: SimState, p: PolicyId) => (s.policies ?? []).includes(p);

export function policyMonth(s: SimState): void {
  const f = s.strategy.factions;
  if (hasPolicy(s, 'buyDomestic')) {
    f.industry = clamp(f.industry + 1);
    f.regions = clamp(f.regions + 0.5);
  }
  if (hasPolicy(s, 'openBooks')) {
    f.treasury = clamp(f.treasury + 1);
    f.hawks = clamp(f.hawks - 0.4);
  }
  if (hasPolicy(s, 'greenDemil')) f.regions = clamp(f.regions + 0.8);
  if (hasPolicy(s, 'exportDrive')) f.hawks = clamp(f.hawks - 0.5);
}

/** Reserve target in days of use. */
export const reserveDays = (s: SimState) => (hasPolicy(s, 'stockpileLaw') ? 450 : 365);

// ---------- A second term ----------

export const TERM_MONTHS = 48;

export function canSecondTerm(s: SimState): string | null {
  if (s.mode !== 'campaign') return 'Only in a campaign.';
  if (!s.over || s.outcome !== 'complete') return 'Only at the end of a completed term.';
  if (s.scenario === 'tutorial') return 'Not after the tutorial.';
  return null;
}

/** The Committee reappoints you: the game goes on with the reserve, plants and network you built. */
export function startSecondTerm(s: SimState, feed: Feed, boon?: BoonId): void {
  const r = termReport(s);
  // The grudges you made, worked out on the term just ended.
  grudges(s, termStats(s));
  s.career = [...(s.career ?? []), { term: s.term ?? 1, score: r.score, grade: r.grade, outcome: s.outcome, months: s.history.length - (s.termMonth ?? 0), avgReadiness: Math.round(r.avgReadiness * 100) / 100 }];
  s.over = false;
  s.outcome = 'running';
  s.term = (s.term ?? 1) + 1;
  s.termMonth = s.history.length;
  s.days = s.day + TERM_MONTHS * DAYS_PER_MONTH;
  s.confidence = clamp(45 + (r.score - 50) * 0.4, 30, 75);
  // Your reputation sets the new budget; this term's objectives are behind you.
  const rep = clamp(1 + (r.score - 60) / 400, 0.92, 1.08);
  s.appropriation = Math.round(s.appropriation * rep);
  s.strategy.baseBudget = Math.round(s.strategy.baseBudget * rep);
  s.strategy.objectives = [];
  s.termStartDay = s.day;
  feed(
    s,
    'info',
    `Term ${s.term} begins. On a ${r.grade} record the Committee reappoints you with confidence at ${Math.round(s.confidence)} and ${rep >= 1 ? 'raises' : 'trims'} your budget to $${s.appropriation}M a month. It expects a little more this time, and the rival moves faster.`,
    undefined,
    true,
  );
  // The legacy you chose, on top of the new term's settings.
  applyBoon(s, boon, feed);
}
