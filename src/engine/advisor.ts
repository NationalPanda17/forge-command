// The advisor reads the state and suggests moves. Easy: one-click orders. Normal: hints. Hard: silent.
import { expandCost, qualifyCost, reworkCost, validateAction } from './actions';
import { CAMPUSES, CAMPUS_IDS, COMPONENTS, COMPONENT_IDS, DIFFICULTY, LINES, LINE_IDS, MIN_SAFE_TEST_SHARE, SUPPLIERS, suppliersOf } from './data';
import {
  campusCrewNeed,
  componentCap,
  contractedPerMonth,
  coverMonths,
  effectiveCapacity,
  freeBays,
  plannedNeed,
  supplierCap,
} from './selectors';
import type { Action, GameState } from './types';

export interface Advice {
  id: string;
  tone: 'urgent' | 'suggest' | 'info';
  text: string;
  action?: Action;
  actionLabel?: string;
}

export function advise(state: GameState): Advice[] {
  const out: Advice[] = [];
  const ok = (a: Action) => validateAction(state, a) === null;

  if (state.decisions.length) {
    out.push({ id: 'decisions', tone: 'urgent', text: `${state.decisions.length} decision${state.decisions.length > 1 ? 's are' : ' is'} waiting for you.` });
  }

  // Components: contracts and supply.
  for (const c of COMPONENT_IDS) {
    const cs = state.components[c];
    const need = plannedNeed(state, c);
    if (need <= 0) continue;
    const live = cs.contracts.reduce((t, k) => t + (k.monthsLeft > 1 ? k.qtyPerMonth : 0), 0);
    const cap = componentCap(state, c);
    if (live < need * 0.75 && DIFFICULTY[state.difficulty].shortages) {
      const options = suppliersOf(c)
        .filter((sid) => state.suppliers[sid].qualified && !state.suppliers[sid].bankrupt)
        .map((sid) => ({ sid, free: supplierCap(state, sid) - contractedPerMonth(cs, sid) }))
        .filter((o) => o.free > need * 0.05)
        .sort((a, b) => SUPPLIERS[a.sid].priceMult - SUPPLIERS[b.sid].priceMult || b.free - a.free);
      const best = options[0];
      if (best) {
        const qty = Math.ceil(Math.min(best.free, need * 0.95 - live));
        if (qty > 0) {
          const action: Action = { type: 'signContract', component: c, supplier: best.sid, qtyPerMonth: qty, months: 24 };
          out.push({
            id: `contract-${c}`,
            tone: live < need * 0.4 ? 'urgent' : 'suggest',
            text: `${COMPONENTS[c].name}: contracts cover ${Math.round((live / need) * 100)}% of what your lines will need. Sign with ${SUPPLIERS[best.sid].name} for ${qty.toLocaleString('en-US')} ${COMPONENTS[c].unit}/month.`,
            action: ok(action) ? action : undefined,
            actionLabel: 'Sign 24-month contract',
          });
        }
      }
    }
    const starved = LINE_IDS.filter((id) => state.lines[id].last.limit === c && !state.lines[id].substitutes[c]);
    if (starved.length) {
      out.push({
        id: `sub-${c}`,
        tone: 'urgent',
        text: `${starved.map((id) => LINES[id].name).join(', ')} stalled for lack of ${COMPONENTS[c].name.toLowerCase()}. Allow ${COMPONENTS[c].substitute.name.toLowerCase()} as a substitute: rounds come out degraded, but they come out.`,
        action: { type: 'setSubstituteAll', component: c, on: true },
        actionLabel: 'Allow substitute',
      });
    }
    if (cap < need * 0.95 && DIFFICULTY[state.difficulty].shortages) {
      const cand = suppliersOf(c).find((sid) => !state.suppliers[sid].qualified && !state.suppliers[sid].bankrupt && state.suppliers[sid].qualifyingMonths === null);
      const qualifying = suppliersOf(c).some((sid) => state.suppliers[sid].qualifyingMonths !== null);
      if (cand && !qualifying) {
        const action: Action = { type: 'qualifySupplier', supplier: cand };
        out.push({
          id: `qualify-${c}`,
          tone: 'suggest',
          text: `Qualified suppliers can ship only ${Math.round(cap).toLocaleString('en-US')} of the ${Math.round(need).toLocaleString('en-US')} ${COMPONENTS[c].unit} of ${COMPONENTS[c].name.toLowerCase()} you need. Start qualifying ${SUPPLIERS[cand].name} ($${qualifyCost(state, cand)}M).`,
          action: ok(action) ? action : undefined,
          actionLabel: 'Start qualification',
        });
      }
    }
  }

  // Reserve versus forecast.
  for (const id of LINE_IDS) {
    const line = state.lines[id];
    const cover = coverMonths(state, id);
    if (cover < 2 && line.run !== 'surge' && line.wear < 55) {
      const action: Action = { type: 'setRun', line: id, run: 'surge' };
      out.push({ id: `surge-${id}`, tone: cover < 1 ? 'urgent' : 'suggest', text: `${LINES[id].name} reserve covers ${cover.toFixed(1)} months of forecast draw. Surge the line.`, action, actionLabel: 'Surge' });
    }
    if (line.run === 'surge' && line.wear >= 60) {
      out.push({ id: `rest-${id}`, tone: 'suggest', text: `The ${LINES[id].name} line is worn (${Math.round(line.wear)}). Faults are getting likely: drop to normal shifts.`, action: { type: 'setRun', line: id, run: 'normal' }, actionLabel: 'Normal shifts' });
    }
    if (cover > 9 && line.run !== 'idle') {
      out.push({ id: `idle-${id}`, tone: 'info', text: `${LINES[id].name} reserve is deep (${cover.toFixed(0)} months). Idling the line saves money.`, action: { type: 'setRun', line: id, run: 'idle' }, actionLabel: 'Idle' });
    }
    const f = state.forecast.draw[id];
    const peak = Math.max(...f);
    const expand: Action = { type: 'expandLine', line: id };
    if (peak > effectiveCapacity(line) * 1.05 && cover < 4 && ok(expand) && state.treasury > expandCost(id) + 150) {
      out.push({ id: `expand-${id}`, tone: 'suggest', text: `Forecast draw on ${LINES[id].name} (${peak.toFixed(0)}/month) outruns the line. Add a bay.`, action: expand, actionLabel: `Expand ($${expandCost(id)}M)` });
    }
    if (line.quarantine.length && ok({ type: 'reworkQuarantine', line: id })) {
      out.push({ id: `rework-${id}`, tone: 'suggest', text: `${line.quarantine.reduce((a, q) => a + q.qty, 0)} ${LINES[id].name} sit in quarantine. Rework recovers most of them.`, action: { type: 'reworkQuarantine', line: id }, actionLabel: `Rework ($${reworkCost(state, id).toFixed(0)}M)` });
    }
    if (line.testShare < MIN_SAFE_TEST_SHARE) {
      out.push({ id: `test-${id}`, tone: 'suggest', text: `${LINES[id].name} test share is below 3%. Latent defects may slip into the reserve.`, action: { type: 'setTestShare', line: id, share: 0.05 }, actionLabel: 'Set to 5%' });
    }
  }

  // Workforce.
  for (const c of CAMPUS_IDS) {
    const cs = state.campuses[c];
    const need = campusCrewNeed(state, c);
    const coming = cs.trainees.reduce((a, t) => a + t.count, 0);
    const gap = Math.ceil(need * 1.03 - cs.workers - coming);
    if (gap > 5) {
      const n = Math.min(gap, cs.pool);
      const action: Action = { type: 'hire', campus: c, count: n };
      out.push({ id: `hire-${c}`, tone: cs.workers < need * 0.9 ? 'urgent' : 'suggest', text: `${CAMPUSES[c].name} is short ${gap} workers for the current plan. Training takes ${DIFFICULTY[state.difficulty].trainingMonths} months.`, action: n > 0 && ok(action) ? action : undefined, actionLabel: `Hire ${n}` });
    }
    if (cs.morale < 40) {
      out.push({ id: `morale-${c}`, tone: 'urgent', text: `Morale at ${CAMPUSES[c].name} is ${Math.round(cs.morale)}. Strikes are possible. Ease off surge shifts or pay premium wages.`, action: cs.wage === 'standard' ? { type: 'setWage', campus: c, wage: 'premium' } : undefined, actionLabel: 'Premium wages' });
    }
    if (freeBays(state, c) === 0 && !cs.construction.length) {
      out.push({ id: `bays-${c}`, tone: 'info', text: `${CAMPUSES[c].name} has no free bays. New buildings take ${DIFFICULTY[state.difficulty].buildMonths} months.` });
    }
  }

  if (state.treasury < 0) out.push({ id: 'broke', tone: 'urgent', text: 'You are over budget. Idle deep lines, cut spot buys, or ask the Committee for a supplemental.' });
  if (state.crisis?.phase === 'active' && state.mods.supplementalCooldown === 0 && !state.mods.supplementalPending && state.treasury < 300) {
    out.push({ id: 'supplemental', tone: 'suggest', text: 'A crisis is on: the Committee is more likely to approve a supplemental now.', action: { type: 'requestSupplemental' }, actionLabel: 'Request supplemental' });
  }
  if (state.tenders.length) out.push({ id: 'tenders', tone: 'info', text: `${state.tenders.length} partner tender${state.tenders.length > 1 ? 's' : ''} open. Partner sales earn money and goodwill, if you can deliver.` });

  const rank = { urgent: 0, suggest: 1, info: 2 } as const;
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
}
