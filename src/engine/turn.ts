// Month resolution. endTurn never mutates its input.
import {
  CAMPUSES,
  CAMPUS_IDS,
  COMPONENTS,
  COMPONENT_IDS,
  CRISES,
  DIFFICULTY,
  EXPAND_STEP,
  GRACE_MONTHS,
  LINES,
  LINE_IDS,
  SCENARIOS,
  SPOT_PREMIUM,
  STAGES,
  SUPPLIERS,
  UPGRADE,
  WEAR_DELTA,
  linesAt,
  suppliersOf,
} from './data';
import { applyAction } from './actions';
import { adaptOpponent, computeForecast, resolveDemand } from './demand';
import { runFacilities, runFactory } from './factory';
import { applyFallbacks, goBankrupt, rollEvents } from './events';
import { accruePartnerQuotas, averageGoodwill, maybeSpawnTender, settlePartners } from './partners';
import { clamp, pick, rand, randInt, randRange } from './rng';
import { lineOverhead, newTranche, readiness, storageCost, supplierCap, wageBill } from './selectors';
import { emptyLedger } from './setup';
import type { Action, GameState, MonthReport, YearReview } from './types';

type Messages = MonthReport['messages'];
const round2 = (v: number) => Math.round(v * 100) / 100;
const fmt = (v: number) => Math.round(v).toLocaleString('en-US');

function advanceCrisis(s: GameState, messages: Messages): void {
  const rules = DIFFICULTY[s.difficulty];
  const sc = SCENARIOS[s.scenario];
  if (!s.crisis) {
    if (s.month >= sc.quietMonths && rand(s) < rules.crisisChance) {
      const def = pick(s, CRISES);
      s.crisis = { id: def.id, name: def.name, family: def.family, phase: 'warning', monthsLeft: 2, intensity: round2(randRange(s, 0.8, 1.3)), mix: { ...def.mix }, blurb: def.blurb };
      messages.push({ tone: 'warn', text: `Intel: tension rising over the ${def.name}. Expect heavier ${def.family === 'air' ? 'interceptor' : 'land fires'} draw in about 2 months.` });
    }
    return;
  }
  if (s.crisis.phase === 'warning') {
    s.crisis.monthsLeft--;
    if (s.crisis.monthsLeft <= 0) {
      s.crisis.phase = 'active';
      s.crisis.monthsLeft = randInt(s, 4, 10);
      messages.push({ tone: 'bad', text: `Crisis: the ${s.crisis.name} has begun.` });
    }
  }
}

function endCrisisMonth(s: GameState, messages: Messages): void {
  if (s.crisis?.phase !== 'active') return;
  s.crisis.monthsLeft--;
  if (s.crisis.monthsLeft <= 0) {
    messages.push({ tone: 'good', text: `The ${s.crisis.name} has wound down. Draw returns to normal.` });
    s.crisis = null;
  }
}

/** Projects finish: buildings, retooled bays, upgrades, trainees, qualifications. */
function advanceProjects(s: GameState, messages: Messages): void {
  for (const c of CAMPUS_IDS) {
    const cs = s.campuses[c];
    for (const b of cs.construction) b.monthsLeft--;
    for (const b of cs.construction.filter((x) => x.monthsLeft <= 0)) {
      cs.bays += b.bays;
      messages.push({ tone: 'good', text: `New building opens at ${CAMPUSES[c].name}: +${b.bays} bays.` });
    }
    cs.construction = cs.construction.filter((x) => x.monthsLeft > 0);
    for (const r of cs.retooling) r.monthsLeft--;
    for (const r of cs.retooling.filter((x) => x.monthsLeft <= 0)) {
      s.lines[r.to].tranches.push(newTranche(s, LINES[r.to].baseCapacity * EXPAND_STEP));
      messages.push({ tone: 'good', text: `Retooled bay now builds ${LINES[r.to].name}.` });
    }
    cs.retooling = cs.retooling.filter((x) => x.monthsLeft > 0);
    let graduated = 0;
    for (const t of cs.trainees) t.monthsLeft--;
    for (const t of cs.trainees.filter((x) => x.monthsLeft <= 0)) graduated += t.count;
    cs.trainees = cs.trainees.filter((x) => x.monthsLeft > 0);
    if (graduated) {
      cs.workers += graduated;
      messages.push({ tone: 'good', text: `${graduated} trainees qualify at ${CAMPUSES[c].name}.` });
    }
    if (cs.securityMonths > 0) cs.securityMonths--;
    const before = cs.testCellBuilds.length;
    cs.testCellBuilds = cs.testCellBuilds.map((m) => m - 1).filter((m) => m > 0);
    const done = before - cs.testCellBuilds.length;
    if (done > 0) {
      cs.testCells += done;
      messages.push({ tone: 'good', text: `New test cell${done > 1 ? 's' : ''} open at ${CAMPUSES[c].name}.` });
    }
  }
  for (const id of LINE_IDS) {
    const line = s.lines[id];
    if (line.installing) {
      line.installing.monthsLeft--;
      if (line.installing.monthsLeft <= 0) {
        line.upgrades[line.installing.kind]++;
        messages.push({ tone: 'good', text: `${UPGRADE[line.installing.kind].name} level ${line.upgrades[line.installing.kind]} is live on the ${LINES[id].name} line.` });
        line.installing = null;
      }
    }
    if (line.debottlenecking) {
      line.debottlenecking.monthsLeft--;
      if (line.debottlenecking.monthsLeft <= 0) {
        const i = line.debottlenecking.stage;
        line.debottleneck[i] = (line.debottleneck[i] ?? 0) + 1;
        messages.push({ tone: 'good', text: `${STAGES[id][i].name} on the ${LINES[id].name} line widened (+20%).` });
        line.debottlenecking = null;
      }
    }
  }
}

/** Suppliers drift, stumble and deliver. Returns component spend. */
function runSupply(s: GameState, messages: Messages): number {
  const rules = DIFFICULTY[s.difficulty];
  let spend = 0;
  for (const c of COMPONENT_IDS) {
    const cs = s.components[c];
    const sids = suppliersOf(c);
    for (const sid of sids) {
      const st = s.suppliers[sid];
      const def = SUPPLIERS[sid];
      st.lastDelivered = 0;
      if (st.qualifyingMonths !== null) {
        st.qualifyingMonths--;
        if (st.qualifyingMonths <= 0) {
          st.qualifyingMonths = null;
          st.qualified = true;
          messages.push({ tone: 'good', text: `${def.name} is qualified for ${COMPONENTS[c].name.toLowerCase()}. You can contract with it now.` });
        }
      }
      if (!st.qualified || st.bankrupt) continue;
      const busy = cs.contracts.some((k) => k.supplier === sid && k.monthsLeft > 0);
      st.health = clamp(st.health + randRange(s, -2.5, 2) + (busy ? 1 : -0.4));
      if (!rules.shortages) st.health = Math.max(st.health, 40);
      if (st.health <= 0) {
        goBankrupt(s, sid, messages);
        continue;
      }
      if (!rules.shortages) {
        st.capFactor = 1;
        st.shockMonths = 0;
      } else if (st.shockMonths > 0) {
        st.shockMonths--;
      } else if (s.month >= GRACE_MONTHS && rand(s) < rules.shockChance) {
        st.capFactor = round2(randRange(s, 0.4, 0.7));
        st.shockMonths = randInt(s, 2, 5) - 1;
        messages.push({ tone: 'bad', text: `Shortage: ${def.name} can only deliver ${Math.round(st.capFactor * 100)}% of its ${COMPONENTS[c].name.toLowerCase()} for a while.` });
      } else {
        if (st.capFactor < 0.9) messages.push({ tone: 'good', text: `${def.name} is back to normal deliveries.` });
        st.capFactor = round2(randRange(s, 0.94, 1.04));
      }
    }
    const capLeft: Record<string, number> = Object.fromEntries(sids.map((sid) => [sid, supplierCap(s, sid)]));
    let delivered = 0;
    for (const k of cs.contracts) {
      if (k.monthsLeft > 0) {
        spend += k.qtyPerMonth * k.unitPrice;
        k.backlog += k.qtyPerMonth;
        k.monthsLeft--;
      }
      const d = Math.min(k.backlog, capLeft[k.supplier] ?? 0);
      k.backlog = round2(k.backlog - d);
      capLeft[k.supplier] -= d;
      s.suppliers[k.supplier].lastDelivered += d;
      delivered += d;
    }
    cs.contracts = cs.contracts.filter((k) => k.monthsLeft > 0 || k.backlog > 0.01);
    let spot = cs.spotOrder;
    for (const sid of [...sids].sort((a, b) => SUPPLIERS[a].priceMult - SUPPLIERS[b].priceMult)) {
      if (spot <= 0) break;
      const d = Math.min(spot, capLeft[sid]);
      if (d <= 0) continue;
      spot -= d;
      capLeft[sid] -= d;
      spend += d * COMPONENTS[c].price * SUPPLIERS[sid].priceMult * SPOT_PREMIUM;
      s.suppliers[sid].lastDelivered += d;
      delivered += d;
    }
    cs.stock += delivered;
    cs.lastDelivered = round2(delivered);
    cs.lastUsed = 0;
    cs.lastShort = 0;
    cs.lastSubstituted = 0;
    for (const sid of sids) {
      const st = s.suppliers[sid];
      if (st.embargoMonths > 0) {
        st.embargoMonths--;
        if (st.embargoMonths === 0) messages.push({ tone: 'good', text: `Export restriction on ${SUPPLIERS[sid].name} lifted.` });
      }
      if (st.congestionMonths > 0) st.congestionMonths--;
    }
  }
  return spend;
}

/** Lines age: wear, first-article inspection, ramp-up, quarantine clocks. */
function ageLines(s: GameState, messages: Messages): void {
  const rules = DIFFICULTY[s.difficulty];
  for (const id of LINE_IDS) {
    const line = s.lines[id];
    const wear = WEAR_DELTA[line.run] - (line.run === 'surge' ? line.upgrades.quality : 0);
    line.wear = clamp(line.wear + wear);
    for (const t of line.tranches) {
      if (t.faiMonths > 0) {
        t.faiMonths--;
        if (t.faiMonths === 0) messages.push({ tone: 'good', text: `First-article inspection passed: new ${LINES[id].name} capacity starts ramping up.` });
      } else t.maturity = Math.min(1, round2(t.maturity + rules.rampPerMonth));
    }
    for (const q of line.quarantine) q.monthsLeft--;
    const scrapped = line.quarantine.filter((q) => q.monthsLeft <= 0).reduce((a, q) => a + q.qty, 0);
    if (scrapped > 0) messages.push({ tone: 'bad', text: `${fmt(scrapped)} quarantined ${LINES[id].name} scrapped after inspection lapsed.` });
    line.quarantine = line.quarantine.filter((q) => q.monthsLeft > 0);
  }
}

function runWorkforce(s: GameState, messages: Messages): void {
  for (const c of CAMPUS_IDS) {
    const cs = s.campuses[c];
    const def = CAMPUSES[c];
    const ids = linesAt(c);
    const surgeShare = ids.filter((id) => s.lines[id].run === 'surge').length / ids.length;
    const understaffed = cs.workers < cs.lastCrewNeed * 0.95;
    const target = 62 + (cs.wage === 'premium' ? 14 : 0) - surgeShare * 30 - (understaffed ? 8 : 0) - (cs.strikeMonths > 0 ? 10 : 0);
    cs.morale = clamp(cs.morale + (target - cs.morale) * 0.25 + randRange(s, -1.5, 1.5));
    const quitRate = 0.006 + (Math.max(0, 50 - cs.morale) / 50) * 0.015;
    const quits = Math.round(cs.workers * quitRate);
    cs.workers = Math.max(0, cs.workers - quits);
    if (quits > cs.workers * 0.012) messages.push({ tone: 'warn', text: `${quits} workers quit ${def.name}. Morale is ${Math.round(cs.morale)}.` });
    cs.pool = Math.min(def.laborPool * 2, cs.pool + Math.round(def.laborPool * 0.2));
    if (cs.strikeMonths > 0) {
      cs.strikeMonths--;
      if (cs.strikeMonths === 0) messages.push({ tone: 'good', text: `The strike at ${def.name} is over.` });
    }
  }
}

function yearReview(s: GameState): YearReview {
  const rules = DIFFICULTY[s.difficulty];
  const sc = SCENARIOS[s.scenario];
  const year = Math.floor(s.month / 12) + 1;
  const months = s.history.slice(-12);
  const avgReady = months.reduce((a, h) => a + h.readiness, 0) / Math.max(1, months.length);
  const leakers = months.reduce((a, h) => a + Object.values(h.threats).reduce((b, t) => b + t.leaked, 0), 0);
  const base = rules.appropriation * sc.budgetMult;
  const crisisBonus = s.crisis ? 1.05 : 1;
  const next = Math.round(base * (0.85 + s.confidence / 333) * crisisBonus);
  const notes: string[] = [];
  if (avgReady >= 0.85) notes.push('The Committee praises the state of the reserve.');
  else if (avgReady < 0.5) notes.push('The Committee is alarmed by how thin the reserve has run.');
  if (leakers > 20) notes.push(`${Math.round(leakers)} threats got through this year. Members want answers.`);
  if (s.treasury < 0) notes.push('You ended the year over budget.');
  if (averageGoodwill(s) >= 65) notes.push('Partner nations speak highly of the Board.');
  notes.push(next > s.appropriation ? 'Next year’s appropriation goes up.' : next < s.appropriation ? 'Next year’s appropriation is cut.' : 'Next year’s appropriation is unchanged.');
  const review: YearReview = { year, readiness: avgReady, leakers, confidence: s.confidence, oldAppropriation: s.appropriation, newAppropriation: next, notes };
  s.appropriation = next;
  return review;
}

export function endTurn(state: GameState): GameState {
  if (state.over) return state;
  const s = structuredClone(state);
  const messages: Messages = [...s.inbox];
  s.inbox = [];
  const ledger = emptyLedger();
  ledger.projects = s.pending.projects;
  ledger.revenue = s.pending.revenue;
  ledger.penalties = s.pending.penalties;

  applyFallbacks(s, messages);
  advanceCrisis(s, messages);
  adaptOpponent(s);
  rollEvents(s, messages);
  advanceProjects(s, messages);

  ledger.components = runSupply(s, messages);
  accruePartnerQuotas(s);
  const plants = runFacilities(s, messages);
  ledger.components += plants.materials;
  const prod = runFactory(s, messages);
  ageLines(s, messages);
  ledger.components += prod.componentSpend;
  ledger.revenue += prod.revenue;
  const partnerPenalty = settlePartners(s, messages);
  ledger.penalties += partnerPenalty;

  const demand = resolveDemand(s);
  messages.push(...demand.messages);
  runWorkforce(s, messages);
  endCrisisMonth(s, messages);
  maybeSpawnTender(s, messages);

  // Money.
  ledger.wages = CAMPUS_IDS.reduce((a, c) => a + wageBill(s, c), 0);
  ledger.overhead = LINE_IDS.reduce((a, id) => a + lineOverhead(s, id), 0) + plants.overhead;
  ledger.storage = storageCost(s);
  ledger.appropriation = s.appropriation;
  s.treasury += s.appropriation + prod.revenue - ledger.wages - ledger.overhead - ledger.components - ledger.storage - partnerPenalty;

  if (s.mods.supplementalPending) {
    s.mods.supplementalPending = false;
    const p = s.confidence / 100 + (s.crisis?.phase === 'active' ? 0.25 : 0) - 0.15;
    if (rand(s) < p) {
      const amount = Math.round(s.appropriation * randRange(s, 1.5, 3));
      s.treasury += amount;
      ledger.revenue += amount;
      s.mods.supplementalCooldown = 6;
      messages.push({ tone: 'good', text: `The Defence Committee approves a $${amount}M supplemental.` });
    } else {
      s.confidence = clamp(s.confidence - 2);
      s.mods.supplementalCooldown = 4;
      messages.push({ tone: 'bad', text: 'The Defence Committee turns down your supplemental request.' });
    }
  } else if (s.mods.supplementalCooldown > 0) s.mods.supplementalCooldown--;
  if (s.mods.energyMonths > 0) s.mods.energyMonths--;

  // Confidence.
  const ready = readiness(s);
  // The Committee expects some leakers in calm times; it judges what goes beyond that.
  const expectedLeaks = 2.5 * SCENARIOS[s.scenario].pressure;
  let dc = (ready - 0.5) * 6 + 0.3;
  dc -= Math.min(10, Math.max(0, demand.leakSeverity - expectedLeaks) * 0.4);
  dc -= demand.landShortfall * 4;
  if (s.treasury < 0) {
    dc -= 2 + -s.treasury / 250;
    messages.push({ tone: 'bad', text: 'The Board is over budget. The Committee is watching.' });
  }
  s.confidence = clamp(s.confidence + dc);
  s.treasury = round2(s.treasury);

  s.history.push({
    month: s.month,
    output: prod.output,
    draw: demand.draw,
    readiness: round2(ready),
    confidence: Math.round(s.confidence * 10) / 10,
    treasury: s.treasury,
    ledger: Object.fromEntries(Object.entries(ledger).map(([k, v]) => [k, round2(v)])) as unknown as typeof ledger,
    threats: demand.threats,
    interceptorSpend: round2(demand.interceptorSpend),
    threatValueStopped: round2(demand.threatValueStopped),
    messages,
  });
  s.pending = emptyLedger();

  if ((s.month + 1) % 12 === 0) s.reviews.push(yearReview(s));
  s.month++;
  if (s.confidence <= 0) {
    s.over = true;
    s.outcome = 'dismissed';
  } else if (s.month >= s.months) {
    s.over = true;
    s.outcome = 'complete';
  }
  s.forecast = computeForecast(s);
  return s;
}

/** Plays a list of actions then ends the turn: handy for tests and replays. */
export function playTurn(state: GameState, actions: Action[] = []): GameState {
  return endTurn(actions.reduce(applyAction, state));
}
