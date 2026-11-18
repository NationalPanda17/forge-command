// Testing and qualification: new rounds and new designs are fired at the test ranges before they are accepted.
// Each range runs one programme at a time; failures stop a programme for an investigation and a design decision.
import { clamp, rand, randInt } from './rng';
import type { FeedItem, SimState } from './types';
import { MATERIALS, SITES, SITE_BY_ID, type LineId } from './world';
import { VARIANTS, type VariantId } from './industry';
import { takeLots } from './lots';
import { lotQty } from './selectors';

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

export interface TestProgramme {
  id: number;
  line: LineId;
  /** A design change to qualify; absent for a new round. */
  variant?: VariantId;
  /** Firings needed to pass. */
  needed: number;
  passed: number;
  failed: number;
  /** The range firing it, once one is free. */
  range: string | null;
  /** Days left in a failure investigation. */
  investigating: number;
  /** Odds each firing passes. */
  odds: number;
  /** Day it joined the schedule: firings start ten days later at the earliest. */
  queued?: number;
}

export const RANGES = () => SITES.filter((d) => d.kind === 'testRange').map((d) => d.id);
export const FIRINGS_PER_MONTH = 3;
export const programmeName = (p: TestProgramme) => (p.variant ? `${VARIANTS[p.variant].name} ${MATERIALS[p.line].name}` : `${MATERIALS[p.line].name} first-article`);

/** Is a line's production cleared for issue? Starting lines always are. */
export const accepted = (s: SimState, line: LineId) => s.lines[line]?.accepted !== false;

export function queueTest(s: SimState, line: LineId, variant: VariantId | undefined, feed: Feed): void {
  s.tests.push({ id: s.nextId++, line, variant, needed: variant ? 3 : 4, passed: 0, failed: 0, range: null, investigating: 0, odds: variant ? 0.85 : 0.8, queued: s.day });
  feed(s, 'info', `${variant ? VARIANTS[variant].name + ' ' : ''}${MATERIALS[line].name} joins the test schedule. It is not accepted until it passes its firings.`);
}

/** Free ranges take the next programmes in the queue. */
function assign(s: SimState): void {
  for (const r of RANGES()) {
    if (s.tests.some((t) => t.range === r)) continue;
    const next = s.tests.find((t) => t.range === null);
    if (next) next.range = r;
  }
}

export function testingDay(s: SimState, _feed: Feed): void {
  assign(s);
  for (const t of s.tests) if (t.investigating > 0) t.investigating--;
}

export function testingMonth(s: SimState, feed: Feed): void {
  assign(s);
  for (const t of [...s.tests]) {
    if (!t.range || t.investigating > 0 || s.day - (t.queued ?? 0) < 10) continue;
    for (let i = 0; i < FIRINGS_PER_MONTH && t.passed < t.needed && t.investigating === 0; i++) {
      // A new round is fired from real production; a design change from test articles.
      if (!t.variant) {
        const arsenal = SITES.find((d) => d.owner === 'state' && s.sites[d.id].processes.some((p) => p.recipe === t.line));
        if (!arsenal || lotQty(s.sites[arsenal.id].lots[t.line]) < 1) break;
        takeLots(s.sites[arsenal.id], t.line, 1);
      } else {
        const cost = MATERIALS[t.line].price * 1.5 * s.priceIndex;
        s.treasury -= cost;
        s.month.spend.projects += cost;
      }
      if (rand(s) < t.odds) {
        t.passed++;
        continue;
      }
      t.failed++;
      t.investigating = randInt(s, 20, 35);
      s.strategy.decisions.push({
        id: s.nextId++,
        kind: 'testFailure',
        title: `${programmeName(t)} fails a firing`,
        body: `A test round failed at ${SITE_BY_ID[t.range].name}. The investigation will take about ${Math.round(t.investigating / 7)} weeks. Then: fix the design, or press on and hope.`,
        options: [
          { id: 'fix', label: `Fix the design ($${Math.round(20 * s.priceIndex)}M)`, detail: 'Better odds from now on, and one more firing to pass.' },
          { id: 'press', label: 'Press on', detail: 'No cost; the odds stay as they are.' },
        ],
        fallback: 'press',
        data: { chain: t.id },
      });
      feed(s, 'warn', `${programmeName(t)} fails a test firing. A decision is waiting.`, t.range, true);
    }
    if (t.passed >= t.needed) {
      s.tests = s.tests.filter((x) => x.id !== t.id);
      if (t.variant) {
        s.variants[t.line] = t.variant;
        feed(s, 'good', `Accepted: ${programmeName(t)} goes into service. ${VARIANTS[t.variant].effect}`, undefined, true);
      } else {
        s.lines[t.line].accepted = true;
        feed(s, 'good', `Accepted: ${MATERIALS[t.line].name} passes its firings. Production is released for issue.`, undefined, true);
      }
    }
  }
}

export function resolveTesting(s: SimState, d: { kind: string; data?: { chain?: number } }, opt: string, feed: Feed): boolean {
  if (d.kind !== 'testFailure') return false;
  const t = s.tests.find((x) => x.id === d.data?.chain);
  if (!t) return true;
  if (opt === 'fix') {
    const cost = Math.round(20 * s.priceIndex);
    s.treasury -= cost;
    s.month.spend.projects += cost;
    t.odds = clamp(t.odds + 0.12, 0, 0.97);
    t.needed++;
    feed(s, 'info', `The design of ${programmeName(t)} is fixed.`);
  }
  return true;
}

/** Moves a programme one place up the queue. */
export function prioritise(s: SimState, id: number): void {
  const i = s.tests.findIndex((t) => t.id === id);
  if (i <= 0) return;
  [s.tests[i - 1], s.tests[i]] = [s.tests[i], s.tests[i - 1]];
}

