// What a move does (20.6, design pass C6). A forecast of a move's effect turned out to be unreliable (a quick forecast
// cannot see new capacity, and playing the game forward is mostly noise from events), so each card says instead what
// the move does, in the game's own numbers: how much capacity, how soon, how many people, by when. Always true, and it
// ties the choice to its effect without promising an outcome.
import { RESEARCH } from '../sim/strategy';
import { QUALIFY_DAYS, TRAINING_DAYS, type SimAction } from '../sim/actions';
import { TENDER_DAYS } from '../sim/economy';
import { DAYS_PER_MONTH, RUN_FACTOR, processRate } from '../sim/selectors';
import { rampStep } from '../sim/tick';
import { HOMES_PER_PROJECT, HOUSING_DAYS } from '../sim/towns';
import type { SimState } from '../sim/types';
import { FINISHED, MATERIALS, RECIPES, SITE_BY_ID, type MaterialId } from '../sim/world';
import { qty } from '../ui/format';

const months = (days: number) => Math.max(1, Math.round(days / DAYS_PER_MONTH));
const monthsText = (days: number) => `${months(days)} month${months(days) > 1 ? 's' : ''}`;
/** A round keeps its name as written (SM-6, 155mm shells); a part or material is lower case mid-sentence. */
const named = (m: MaterialId) => ((FINISHED as string[]).includes(m) ? MATERIALS[m].name : MATERIALS[m].name.toLowerCase());

/** One plain sentence on what the move does, or null where the card already says it all. */
export function whatItDoes(s: SimState, a: SimAction): string | null {
  switch (a.type) {
    case 'expand':
    case 'invest': {
      const p = s.sites[a.site].processes[a.process];
      if (!p) return null;
      // The same sum the rules use for the new capacity, at the line's present shifts.
      const total = p.capacity + (p.ramp ?? []).reduce((x, r) => x + r.cap, 0);
      const add = (total / (1 + 0.25 * p.expansions)) * (a.type === 'invest' ? 0.3 : 0.25) * RUN_FACTOR[p.run];
      const full = Math.ceil(0.9 / rampStep(s));
      return `Adds ${qty(add)} a day of ${named(RECIPES[p.recipe].output)}: about a tenth at once, all of it in about ${monthsText(full)}.`;
    }
    case 'setRun': {
      const site = s.sites[a.site];
      const p = site.processes[a.process];
      if (!p) return null;
      const now = processRate(s, site, p);
      const then = (now / Math.max(1e-9, RUN_FACTOR[p.run])) * RUN_FACTOR[a.run];
      if (!Number.isFinite(then) || p.run === 'idle') return null;
      const out = RECIPES[p.recipe].output;
      const label = named(out);
      return `${label.charAt(0).toUpperCase()}${label.slice(1)} at ${SITE_BY_ID[a.site].name} goes from ${qty(now)} to ${qty(then)} a day.`;
    }
    case 'openTender':
      return `Qualified makers bid within ${monthsText(TENDER_DAYS)} for ${qty(a.perDay)} a day of ${named(a.material)} over ${a.months} months; you choose the bid.`;
    case 'qualify':
      return `${SITE_BY_ID[a.site].name} can supply your arsenals in about ${monthsText(QUALIFY_DAYS)}.`;
    case 'hire':
      return `${a.count} trainees at ${SITE_BY_ID[a.site].name}, working in about ${monthsText(TRAINING_DAYS)}.`;
    case 'housing':
      return `${HOMES_PER_PROJECT} homes in about ${monthsText(HOUSING_DAYS)}, so the plants nearby can hire.`;
    case 'research': {
      // The advice already gives the effect and says it ties up the engineers: the timing is what it leaves out.
      return `Done in about ${monthsText(RESEARCH[a.research].days)}.`;
    }
    default:
      return null;
  }
}
