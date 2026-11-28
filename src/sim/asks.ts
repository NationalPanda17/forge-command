// The Committee asks (20.4, design pass C4). The Committee's goals are a year long; between them, every few months it
// asks for one concrete thing with a deadline a few months out, taken from where the game stands: lift the thinnest
// round, or start a second source for a part only one maker supplies. (Running costs were tried as a third kind and
// dropped: a three-month average cannot be turned round in 90 days, and an ask nobody can meet only discourages. The
// advisor's running-cost warning covers it.)
// Meeting it releases a little money and some confidence; missing it costs a little. A short goal between the long
// ones, so there is always something within reach. No random draws: the asks follow from the state.
import T from './tuning/mandate.json';
import { clamp } from './rng';
import { nationalStock, reserveTarget } from './selectors';
import type { FeedItem, SimState } from './types';
import { FINISHED, MATERIALS, RECIPES, SITES, SITE_BY_ID, type LineId, type MaterialId } from './world';

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

const A = T.asks;

export type Ask =
  | { kind: 'reserve'; line: LineId; target: number; by: number; issued: number }
  | { kind: 'source'; material: MaterialId; by: number; issued: number };

/** Scored games only: not the sandbox, and not the story, whose chapters set their own goals. */
const asking = (s: SimState) => A.enabled && s.mode === 'campaign' && !s.story && !s.hotseat;

/** Stock against the Committee's target for one round. */
const level = (s: SimState, l: LineId) => nationalStock(s, l) / Math.max(1e-9, reserveTarget(s, l));

/** Contracted parts that only one qualified maker supplies, and an unqualified maker that could become the second. */
function singleSources(s: SimState): { material: MaterialId; spare: string }[] {
  const out: { material: MaterialId; spare: string }[] = [];
  for (const c of s.contracts) {
    if (out.some((x) => x.material === c.material)) continue;
    const makes = (id: string) => s.sites[id].status !== 'closed' && s.sites[id].processes.some((p) => RECIPES[p.recipe].output === c.material);
    const makers = SITES.filter((d) => d.owner !== 'state' && makes(d.id));
    if (makers.filter((d) => s.sites[d.id].qualified).length !== 1) continue;
    const spare = makers.find((d) => !s.sites[d.id].qualified && s.sites[d.id].qualifyingDays === null);
    if (spare) out.push({ material: c.material, spare: spare.id });
  }
  return out;
}

/** Whether the ask is met now. */
export function askMet(s: SimState, a: Ask): boolean {
  if (a.kind === 'reserve') return level(s, a.line) >= a.target;
  return SITES.some((d) => d.owner !== 'state' && s.sites[d.id].qualifyingDays !== null && s.sites[d.id].processes.some((p) => RECIPES[p.recipe].output === a.material)) || singleSources(s).every((x) => x.material !== a.material);
}

/** How far along the ask is, from 0 to 1, for the card on Home. */
export function askProgress(s: SimState, a: Ask): number {
  if (askMet(s, a)) return 1;
  if (a.kind === 'reserve') return Math.max(0, Math.min(1, level(s, a.line) / a.target));
  return 0;
}

/** The ask in words: what the Committee wants. */
export function askText(s: SimState, a: Ask): { title: string; detail: string } {
  if (a.kind === 'reserve') {
    const name = MATERIALS[a.line].name;
    return { title: `Raise ${name} to ${Math.round(a.target * 100)}% of its goal`, detail: `It is your thinnest round, at ${Math.round(level(s, a.line) * 100)}% of the reserve the Committee wants.` };
  }
  const spare = singleSources(s).find((x) => x.material === a.material);
  return {
    title: `Start a second source of ${MATERIALS[a.material].name.toLowerCase()}`,
    detail: `Only one qualified maker supplies it.${spare ? ` ${SITE_BY_ID[spare.spare].name} could, once qualified: right-click it on the map.` : ''}`,
  };
}

/** The next ask, from where the game stands: the thinnest round if it is short, else a single source. */
function nextAsk(s: SimState): Ask | null {
  const by = s.day + A.days;
  const lines = (FINISHED as LineId[]).filter((l) => s.lines[l].unlocked && reserveTarget(s, l) > 0);
  const thinnest = lines.sort((a, b) => level(s, a) - level(s, b))[0];
  if (thinnest && level(s, thinnest) < A.reserveBelow) {
    const target = Math.min(1, Math.round((level(s, thinnest) + A.reserveStep) * 20) / 20);
    return { kind: 'reserve', line: thinnest, target, by, issued: s.day };
  }
  const single = singleSources(s)[0];
  if (single) return { kind: 'source', material: single.material, by, issued: s.day };
  return null;
}

/** Each day: an ask met is rewarded at once; one past its deadline is missed. */
export function askDay(s: SimState, feed: Feed): void {
  const a = s.strategy.ask;
  if (!a || !asking(s)) return;
  const { title } = askText(s, a);
  if (askMet(s, a)) {
    s.treasury += A.money;
    s.month.income.sales += A.money;
    s.confidence = clamp(s.confidence + A.confidence);
    s.strategy.ask = null;
    s.strategy.askDone = (s.strategy.askDone ?? 0) + 1;
    feed(s, 'good', `The Committee’s ask is met: ${title.charAt(0).toLowerCase()}${title.slice(1)}. It releases $${A.money}M.`, undefined, true);
  } else if (s.day >= a.by) {
    s.confidence = clamp(s.confidence - A.missedConfidence);
    s.strategy.ask = null;
    feed(s, 'warn', `The Committee’s ask was not met: ${title.charAt(0).toLowerCase()}${title.slice(1)}.`);
  }
}

/** At a month's close: a new ask every few months, when none is open. */
export function askMonth(s: SimState, feed: Feed): void {
  if (!asking(s) || s.strategy.ask) return;
  const month = s.history.length + 1;
  if (month < A.firstMonth || (month - A.firstMonth) % A.everyMonths !== 0) return;
  const a = nextAsk(s);
  if (!a) return;
  s.strategy.ask = a;
  const { title } = askText(s, a);
  feed(s, 'info', `The Committee asks: ${title.charAt(0).toLowerCase()}${title.slice(1)}, within ${Math.round(A.days / 30)} months. Meet it for $${A.money}M and its goodwill.`, undefined, true);
}
