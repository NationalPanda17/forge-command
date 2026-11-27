// Release 19.1: the Committee's warning (docs/mandate.md, "Probation"). The first time confidence falls to the warning
// mark in a term, the Committee puts you on probation: a readiness target and a few months to meet it, during which it
// holds its judgment (confidence cannot fall below the mark). Meet the target and you carry on; miss it and you go.
// Once probation has been used, an empty confidence dismisses as before.
import T from './tuning/mandate.json';
import { readiness } from './selectors';
import type { FeedItem, SimState } from './types';

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;
const P = T.probation;

export interface Probation {
  /** Month (history length) by which the target must be met. */
  until: number;
  /** National readiness the Committee wants to see. */
  target: number;
}

/** The readiness the Committee demands: a clear step up from where you are, within reach. */
export const probationTarget = (ready: number) => Math.min(P.targetMax, Math.max(P.targetMin, ready + P.targetGain));

/**
 * At each month's close, after confidence is updated. Returns true if the director is dismissed.
 * Without probation (turned off in the tuning, or already used this term) an empty confidence dismisses at once.
 */
export function judge(s: SimState, feed: Feed): boolean {
  const ready = readiness(s);
  const months = s.history.length;
  if (s.probation) {
    // The Committee holds its judgment until the deadline.
    s.confidence = Math.max(s.confidence, P.confidence);
    if (ready >= s.probation.target) {
      feed(s, 'good', `Probation is over: readiness is back to ${Math.round(ready * 100)}%. The Committee is satisfied, for now.`, undefined, true);
      s.confidence = Math.min(100, s.confidence + P.recoverBonus);
      s.probation = null;
      return false;
    }
    if (months >= s.probation.until) {
      feed(s, 'bad', `Probation is up and readiness is ${Math.round(ready * 100)}%, short of the ${Math.round(s.probation.target * 100)}% the Committee asked for.`, undefined, true);
      return true;
    }
    return false;
  }
  const term = s.term ?? 1;
  const used = !P.enabled || s.probationTerm === term;
  if (used) return s.confidence <= 0;
  if (s.confidence > P.warnAt) return false;
  s.probationTerm = term;
  s.probation = { until: months + P.months, target: probationTarget(ready) };
  s.confidence = Math.max(s.confidence, P.confidence);
  feed(s, 'bad', `The Defence Committee puts you on probation: raise readiness to ${Math.round(s.probation.target * 100)}% within ${P.months} months, or you are dismissed. Until then it holds its judgment.`, undefined, true);
  return false;
}
