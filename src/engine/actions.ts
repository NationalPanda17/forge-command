// Player actions: validateAction explains why one is not allowed, applyAction never mutates its input.
import {
  CAMPUSES,
  CANCEL_PENALTY,
  COMPONENTS,
  CONTRACT_DISCOUNT,
  DIFFICULTY,
  EXPAND_STEP,
  HIRE_COST,
  LINES,
  MAX_UPGRADE,
  NEW_TRANCHE_MATURITY,
  RETOOL_COST_SHARE,
  RETOOL_MONTHS,
  REWORK_COST_SHARE,
  SUPPLIERS,
  UPGRADE,
} from './data';
import { resolveDecision } from './events';
import { acceptTender } from './partners';
import { expansions, freeBays } from './selectors';
import type { Action, CampusId, GameState, LineId, UpgradeKind } from './types';

export const expandCost = (id: LineId) => LINES[id].expandCost;
export const retoolCost = (to: LineId) => Math.round(LINES[to].expandCost * RETOOL_COST_SHARE);
export const upgradeCost = (id: LineId, kind: UpgradeKind) => Math.round(LINES[id].expandCost * UPGRADE[kind].costShare);
export const buildCost = (c: CampusId) => CAMPUSES[c].buildCost;
export const qualifyCost = (state: GameState, sid: string) => Math.round(SUPPLIERS[sid].qualifyCost * DIFFICULTY[state.difficulty].qualifyMult);
export const qualifyMonths = (state: GameState, sid: string) => Math.max(2, Math.round(SUPPLIERS[sid].qualifyMonths * DIFFICULTY[state.difficulty].qualifyMult));
export const reworkCost = (state: GameState, id: LineId) =>
  state.lines[id].quarantine.reduce((s, q) => s + q.qty, 0) * LINES[id].unitCost * REWORK_COST_SHARE;
export const contractPrice = (sid: string, months: 12 | 24 | 36) =>
  COMPONENTS[SUPPLIERS[sid].component].price * SUPPLIERS[sid].priceMult * CONTRACT_DISCOUNT[months];
export const cancelPenalty = (state: GameState, component: keyof GameState['components'], contract: number) => {
  const k = state.components[component].contracts.find((x) => x.id === contract);
  return k ? k.qtyPerMonth * k.monthsLeft * k.unitPrice * CANCEL_PENALTY : 0;
};
export const supplementalAvailable = (state: GameState) => state.mods.supplementalCooldown === 0 && !state.mods.supplementalPending;

const funds = (state: GameState, cost: number) => (state.treasury >= cost ? null : `Not enough funds (needs $${Math.round(cost)}M).`);

export function validateAction(state: GameState, a: Action): string | null {
  if (state.over) return 'The campaign is over.';
  switch (a.type) {
    case 'setRun':
    case 'setPriority':
    case 'setSubstitute':
      return state.lines[a.line] ? null : 'Unknown line.';
    case 'setSubstituteAll':
      return null;
    case 'setTestShare':
      return a.share >= 0 && a.share <= 0.2 ? null : 'Test share must be between 0% and 20%.';
    case 'expandLine':
      if (freeBays(state, LINES[a.line].campus) < 1) return `No free bay at ${CAMPUSES[LINES[a.line].campus].name}. Build or retool first.`;
      return funds(state, expandCost(a.line));
    case 'retoolBay':
      if (a.from === a.to) return 'Pick a different line.';
      if (LINES[a.from].campus !== LINES[a.to].campus) return 'Retooling only works between lines on the same campus.';
      if (expansions(state.lines[a.from]) < 1) return `${LINES[a.from].name} has no expansion bay to give up.`;
      return funds(state, retoolCost(a.to));
    case 'buildBays':
      if (state.campuses[a.campus].construction.length > 0) return 'A building is already under construction here.';
      return funds(state, buildCost(a.campus));
    case 'upgradeLine': {
      const line = state.lines[a.line];
      if (line.installing) return 'An upgrade is already being installed.';
      if (line.upgrades[a.kind] >= MAX_UPGRADE) return 'Already at the top level.';
      return funds(state, upgradeCost(a.line, a.kind));
    }
    case 'reworkQuarantine':
      if (!state.lines[a.line].quarantine.length) return 'Nothing in quarantine.';
      return funds(state, reworkCost(state, a.line));
    case 'hire':
      if (!Number.isFinite(a.count) || a.count <= 0) return 'Hire at least one worker.';
      if (a.count > state.campuses[a.campus].pool) return `Only ${state.campuses[a.campus].pool} people in the local hiring pool.`;
      return funds(state, a.count * HIRE_COST);
    case 'setWage':
      return null;
    case 'setSpotOrder':
      return Number.isFinite(a.qty) && a.qty >= 0 ? null : 'Order must be zero or more.';
    case 'signContract': {
      const sup = SUPPLIERS[a.supplier];
      if (!sup || sup.component !== a.component) return 'Unknown supplier.';
      const st = state.suppliers[a.supplier];
      if (st.bankrupt) return `${sup.name} is bankrupt.`;
      if (!st.qualified) return `${sup.name} is not qualified yet.`;
      if (!(a.months in CONTRACT_DISCOUNT)) return 'Contracts run 12, 24 or 36 months.';
      return Number.isFinite(a.qtyPerMonth) && a.qtyPerMonth > 0 ? null : 'Quantity must be above zero.';
    }
    case 'cancelContract':
      if (!state.components[a.component].contracts.some((k) => k.id === a.contract)) return 'No such contract.';
      return funds(state, cancelPenalty(state, a.component, a.contract));
    case 'qualifySupplier': {
      const st = state.suppliers[a.supplier];
      if (!st) return 'Unknown supplier.';
      if (st.bankrupt) return 'That supplier is bankrupt.';
      if (st.qualified) return 'Already qualified.';
      if (st.qualifyingMonths !== null) return 'Qualification already under way.';
      return funds(state, qualifyCost(state, a.supplier));
    }
    case 'acceptTender':
    case 'declineTender':
      return state.tenders.some((t) => t.id === a.tender) ? null : 'That tender is gone.';
    case 'resolveDecision':
      return state.decisions.some((d) => d.id === a.decision) ? null : 'That decision is gone.';
    case 'requestSupplemental':
      if (state.mods.supplementalPending) return 'A request is already with the Committee.';
      if (state.mods.supplementalCooldown > 0) return `The Committee will not hear another request for ${state.mods.supplementalCooldown} months.`;
      return null;
    case 'setDoctrine':
      return null;
  }
}

function charge(s: GameState, cost: number): void {
  s.treasury -= cost;
  s.pending.projects += cost;
}

export function applyAction(state: GameState, a: Action): GameState {
  if (validateAction(state, a)) return state;
  const s = structuredClone(state);
  switch (a.type) {
    case 'setRun':
      s.lines[a.line].run = a.run;
      break;
    case 'setPriority':
      s.lines[a.line].priority = a.priority;
      break;
    case 'setSubstitute':
      s.lines[a.line].substitutes[a.component] = a.on;
      break;
    case 'setSubstituteAll':
      for (const id of Object.keys(s.lines) as LineId[]) if (LINES[id].bom[a.component]) s.lines[id].substitutes[a.component] = a.on;
      break;
    case 'setTestShare':
      s.lines[a.line].testShare = Math.round(a.share * 100) / 100;
      break;
    case 'expandLine':
      charge(s, expandCost(a.line));
      s.lines[a.line].tranches.push({ capacity: LINES[a.line].baseCapacity * EXPAND_STEP, maturity: NEW_TRANCHE_MATURITY, base: false });
      break;
    case 'retoolBay': {
      charge(s, retoolCost(a.to));
      const from = s.lines[a.from];
      // Give up the least mature expansion bay.
      let idx = -1;
      from.tranches.forEach((t, i) => {
        if (!t.base && (idx < 0 || t.maturity < from.tranches[idx].maturity)) idx = i;
      });
      from.tranches.splice(idx, 1);
      s.campuses[LINES[a.to].campus].retooling.push({ to: a.to, monthsLeft: RETOOL_MONTHS });
      break;
    }
    case 'buildBays': {
      charge(s, buildCost(a.campus));
      const months = DIFFICULTY[s.difficulty].buildMonths;
      s.campuses[a.campus].construction.push({ bays: CAMPUSES[a.campus].buildBays, monthsLeft: months, total: months });
      break;
    }
    case 'upgradeLine':
      charge(s, upgradeCost(a.line, a.kind));
      s.lines[a.line].installing = { kind: a.kind, monthsLeft: UPGRADE[a.kind].months };
      break;
    case 'reworkQuarantine': {
      charge(s, reworkCost(s, a.line));
      const line = s.lines[a.line];
      const qty = line.quarantine.reduce((t, q) => t + q.qty, 0);
      const ok = Math.round(qty * 0.8);
      s.reserves[a.line].stock += ok;
      s.reserves[a.line].made += ok;
      line.quarantine = [];
      break;
    }
    case 'hire': {
      const n = Math.floor(a.count);
      charge(s, n * HIRE_COST);
      const c = s.campuses[a.campus];
      c.pool -= n;
      c.trainees.push({ count: n, monthsLeft: DIFFICULTY[s.difficulty].trainingMonths });
      break;
    }
    case 'setWage':
      s.campuses[a.campus].wage = a.wage;
      break;
    case 'setSpotOrder':
      s.components[a.component].spotOrder = Math.round(a.qty * 100) / 100;
      break;
    case 'signContract':
      s.components[a.component].contracts.push({
        id: s.nextId++,
        supplier: a.supplier,
        qtyPerMonth: Math.round(a.qtyPerMonth * 100) / 100,
        monthsLeft: a.months,
        months: a.months,
        unitPrice: contractPrice(a.supplier, a.months),
        backlog: 0,
      });
      break;
    case 'cancelContract': {
      const pen = cancelPenalty(s, a.component, a.contract);
      s.treasury -= pen;
      s.pending.penalties += pen;
      s.components[a.component].contracts = s.components[a.component].contracts.filter((k) => k.id !== a.contract);
      break;
    }
    case 'qualifySupplier':
      charge(s, qualifyCost(s, a.supplier));
      s.suppliers[a.supplier].qualifyingMonths = qualifyMonths(s, a.supplier);
      break;
    case 'acceptTender':
      acceptTender(s, a.tender);
      break;
    case 'declineTender':
      s.tenders = s.tenders.filter((t) => t.id !== a.tender);
      break;
    case 'resolveDecision': {
      resolveDecision(s, a.decision, a.option, s.inbox);
      break;
    }
    case 'requestSupplemental':
      s.mods.supplementalPending = true;
      break;
    case 'setDoctrine':
      s.doctrine.conserve = a.conserve;
      break;
  }
  return s;
}
