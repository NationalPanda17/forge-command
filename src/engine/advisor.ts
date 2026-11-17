// The advisor reads the state and suggests moves. Easy: one-click orders. Normal: hints. Hard: silent.
import { debottleneckCost, establishCost, expandCost, qualifyCost, reworkCost, testCellCost, validateAction } from './actions';
import { CAMPUSES, CAMPUS_IDS, COMPONENTS, COMPONENT_IDS, DIFFICULTY, FACILITIES, FACILITY_IDS, LINES, LINE_IDS, MIN_SAFE_TEST_SHARE, RESEARCH, STAGES, THEATERS, THEATER_IDS, DEFAULT_DEPOT_MONTHS, TRANSPORT_STEP, TRANSPORT_COST, PARTNERS, PARTNER_IDS, STAFF_ROLES, STAFF_ROLE_IDS, SUPPLIERS, suppliersOf } from './data';
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
import { loanQty } from './logistics';
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
  for (const id of LINE_IDS.filter((x) => state.lines[x].tranches.length > 0)) {
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

  // Factory floor: test cells and stage bottlenecks.
  for (const c of CAMPUS_IDS) {
    const cs = state.campuses[c];
    const t = cs.lastTestHours;
    if (t.avail > 0 && t.need > t.avail * 1.02 && cs.testCellBuilds.length === 0) {
      const action: Action = { type: 'buildTestCell', campus: c };
      out.push({
        id: `testcell-${c}`,
        tone: t.need > t.avail * 1.15 ? 'urgent' : 'suggest',
        text: `Acceptance testing at ${CAMPUSES[c].name} needs ${Math.round(t.need)} test-cell hours a month and has ${Math.round(t.avail)}. Finished rounds are queuing for test.`,
        action: ok(action) ? action : undefined,
        actionLabel: `Build test cell ($${testCellCost(c)}M)`,
      });
    }
  }
  for (const id of LINE_IDS.filter((x) => state.lines[x].tranches.length > 0)) {
    const line = state.lines[id];
    if (line.run === 'idle' || line.debottlenecking || coverMonths(state, id) > 4) continue;
    const st = line.stages;
    for (let i = 0; i < st.length - 1; i++) {
      if (st[i].limit === 'capacity' && st[i + 1].limit === 'starved' && st[i].throughput > 0) {
        const action: Action = { type: 'debottleneck', line: id, stage: i };
        if (ok(action) && state.treasury > debottleneckCost(id) + 100) {
          out.push({
            id: `debottleneck-${id}`,
            tone: 'suggest',
            text: `${STAGES[id][i].name} is the slowest step on the ${LINES[id].name} line: the next stage sits waiting. Widen it.`,
            action,
            actionLabel: `Widen +20% ($${debottleneckCost(id)}M)`,
          });
        }
        break;
      }
    }
  }
  for (const f of FACILITY_IDS) {
    const def = FACILITIES[f];
    if (state.facilities[f].status !== 'none') continue;
    const troubled = suppliersOf(def.component).some(
      (sid) => state.suppliers[sid].qualified && (state.suppliers[sid].embargoMonths > 0 || state.suppliers[sid].shockMonths > 0 || state.suppliers[sid].health < 35),
    );
    if (troubled && state.treasury > def.buildCost + 250) {
      out.push({
        id: `facility-${f}`,
        tone: 'info',
        text: `${COMPONENTS[def.component].name} keep running short. Building ${def.name} would make you independent of suppliers for part of your needs.`,
        action: { type: 'buildFacility', facility: f },
        actionLabel: `Build ($${def.buildCost}M)`,
      });
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

  // Logistics: stock the region a crisis is heading for, keep convoys moving, borrow in a pinch.
  const c = state.crisis;
  if (c && state.theaters[c.theater].targetMonths < 3) {
    out.push({
      id: 'depot-crisis',
      tone: c.phase === 'warning' ? 'urgent' : 'suggest',
      text: `The ${c.name} will hit ${THEATERS[c.theater].name}. Raise that depot's stock target so convoys move rounds there before they are needed.`,
      action: { type: 'setDepotTarget', theater: c.theater, months: 3 },
      actionLabel: 'Target 3 months',
    });
  }
  if (!c) {
    for (const th of THEATER_IDS) {
      if (state.theaters[th].targetMonths > DEFAULT_DEPOT_MONTHS) {
        out.push({ id: `depot-calm-${th}`, tone: 'info', text: `${THEATERS[th].name} is quiet again. A lower depot target frees convoys and stock for elsewhere.`, action: { type: 'setDepotTarget', theater: th, months: DEFAULT_DEPOT_MONTHS }, actionLabel: `Back to ${DEFAULT_DEPOT_MONTHS} months` });
        break;
      }
    }
  }
  const last = state.history.at(-1);
  if (last && last.messages.some((m) => m.text.startsWith('Convoys ran at full capacity')) && validateAction(state, { type: 'buyTransport' }) === null) {
    out.push({ id: 'transport', tone: 'suggest', text: 'Convoys are running at full capacity. More rail wagons and trucks would keep the depots stocked.', action: { type: 'buyTransport' }, actionLabel: `+${TRANSPORT_STEP} t ($${TRANSPORT_COST}M)` });
  }
  for (const id of LINE_IDS.filter((x) => state.lines[x].tranches.length > 0)) {
    if (coverMonths(state, id) >= 0.8) continue;
    const p = PARTNER_IDS.find((q) => validateAction(state, { type: 'requestLoan', partner: q, line: id }) === null);
    if (p) {
      out.push({ id: `loan-${id}`, tone: 'urgent', text: `${LINES[id].name} is nearly gone. ${PARTNERS[p].name} could lend you ${loanQty(id).toLocaleString('en-US')} now, repaid from production later.`, action: { type: 'requestLoan', partner: p, line: id }, actionLabel: 'Ask for a loan' });
      break;
    }
  }

  // Staff: fill empty posts with the best candidate you can afford.
  for (const role of STAFF_ROLE_IDS) {
    if (state.staff[role]) continue;
    const best = state.candidates.filter((c) => c.role === role).sort((a, b) => b.skill - a.skill || a.salary - b.salary)[0];
    if (best && state.treasury > 150 && validateAction(state, { type: 'hireStaff', candidate: best.id }) === null) {
      out.push({ id: `staff-${role}`, tone: 'suggest', text: `Nobody is ${STAFF_ROLES[role].title}. ${best.name} (skill ${best.skill}) is available: ${STAFF_ROLES[role].effect(best.skill).toLowerCase()}.`, action: { type: 'hireStaff', candidate: best.id }, actionLabel: `Hire ${best.name.split(' ')[0]}` });
      break;
    }
  }

  // Research: keep the engineers busy.
  if (!state.research.active && state.treasury > 250) {
    const order: (keyof typeof RESEARCH)[] = ['galliumLight', 'apkws', 'digitalTest', 'rapidQual', 'commonMotors', 'yieldAnalytics', 'imFill', 'leanAssembly', 'seekerDTC', 'javelin', 'coyote', 'smartFuzes', 'lightsOut', 'hpm'];
    const next = order.find((r) => validateAction(state, { type: 'startResearch', research: r }) === null);
    if (next) {
      out.push({ id: 'research', tone: 'info', text: `Your engineers are idle. Next up could be ${RESEARCH[next].name}: ${RESEARCH[next].effect}`, action: { type: 'startResearch', research: next }, actionLabel: `Start ($${RESEARCH[next].cost}M)` });
    }
  }
  for (const id of LINE_IDS) {
    if (state.lines[id].tranches.length === 0 && validateAction(state, { type: 'establishLine', line: id }) === null && state.treasury > establishCost(id) + 200) {
      out.push({ id: `establish-${id}`, tone: 'suggest', text: `${LINES[id].name} is ready to build. Set up the line at ${CAMPUSES[LINES[id].campus].name}.`, action: { type: 'establishLine', line: id }, actionLabel: `Set up ($${establishCost(id)}M)` });
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
