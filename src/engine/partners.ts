// Partner nations: tenders, delivery contracts and goodwill.
import { EXPORT_POLICIES, LINES, PARTNERS, PARTNER_IDS } from './data';
import { clamp, pick, rand, randInt, randRange } from './rng';
import type { GameState, LineId, MonthReport, PartnerContract, PartnerId, Tender } from './types';

/** Lines a partner wants that you actually make. */
export const wantsOf = (state: GameState, p: PartnerId) => PARTNERS[p].wants.filter((l) => state.lines[l].tranches.length > 0);

export function spawnTender(state: GameState): Tender | null {
  const partner = pick(state, PARTNER_IDS);
  const wants = wantsOf(state, partner);
  if (!wants.length) return null;
  const line = pick(state, wants);
  const def = LINES[line];
  const qty = Math.max(1, Math.round(def.baseCapacity * randRange(state, 0.08, 0.25)));
  const tender: Tender = {
    id: state.nextId++,
    partner,
    line,
    qtyPerMonth: qty,
    months: randInt(state, 6, 18),
    unitPrice: Math.round(def.unitCost * randRange(state, 1.15, 1.5) * EXPORT_POLICIES[state.exportPolicy].priceMult * 10000) / 10000,
    expires: state.month + 3,
  };
  state.tenders.push(tender);
  return tender;
}

export function maybeSpawnTender(state: GameState, messages: MonthReport['messages']): void {
  state.tenders = state.tenders.filter((t) => t.expires > state.month);
  if (state.tenders.length < 3 && rand(state) < 0.2 * EXPORT_POLICIES[state.exportPolicy].tenderRate) {
    const t = spawnTender(state);
    if (t) messages.push({
      tone: 'info',
      text: `Tender: ${PARTNERS[t.partner].name} wants ${t.qtyPerMonth.toLocaleString('en-US')} ${LINES[t.line].name} a month for ${t.months} months.`,
    });
  }
}

export function acceptTender(state: GameState, id: number): void {
  const t = state.tenders.find((x) => x.id === id);
  if (!t) return;
  state.tenders = state.tenders.filter((x) => x.id !== id);
  const c: PartnerContract = {
    id: state.nextId++,
    partner: t.partner,
    line: t.line,
    qtyPerMonth: t.qtyPerMonth,
    monthsLeft: t.months,
    unitPrice: t.unitPrice,
    owed: 0,
    delivered: 0,
  };
  state.partnerContracts.push(c);
  state.partners[t.partner].goodwill = clamp(state.partners[t.partner].goodwill + 3);
}

/** Units of each line owed to partners this month (after this month's quota is added). */
export function partnerDemand(state: GameState, line: LineId): number {
  return state.partnerContracts
    .filter((c) => c.line === line)
    .reduce((s, c) => s + c.owed + (c.monthsLeft > 0 ? c.qtyPerMonth : 0), 0);
}

/**
 * Delivers up to `available` units of a line to partners, oldest contract first.
 * Returns units delivered and revenue earned.
 */
export function deliverToPartners(state: GameState, line: LineId, available: number): { delivered: number; revenue: number } {
  let left = available;
  let delivered = 0;
  let revenue = 0;
  for (const c of state.partnerContracts) {
    if (c.line !== line) continue;
    const d = Math.min(left, c.owed);
    c.owed -= d;
    c.delivered += d;
    left -= d;
    delivered += d;
    revenue += d * c.unitPrice;
  }
  return { delivered, revenue };
}

/** Adds this month's quota to every live contract. Call before production is allocated. */
export function accruePartnerQuotas(state: GameState): void {
  for (const c of state.partnerContracts) {
    if (c.monthsLeft > 0) {
      c.owed += c.qtyPerMonth;
      c.monthsLeft--;
    }
  }
}

/** Goodwill and penalties after deliveries. Returns penalty $M. */
export function settlePartners(state: GameState, messages: MonthReport['messages']): number {
  let penalties = 0;
  const keep: PartnerContract[] = [];
  for (const c of state.partnerContracts) {
    const p = state.partners[c.partner];
    const name = PARTNERS[c.partner].name;
    if (c.monthsLeft === 0 && c.owed <= 0) {
      p.goodwill = clamp(p.goodwill + 8);
      messages.push({ tone: 'good', text: `Contract complete: ${name} received every ${LINES[c.line].name} on time.` });
      continue;
    }
    if (c.owed > c.qtyPerMonth * 2) {
      p.goodwill = clamp(p.goodwill - 3);
      const late = c.owed - c.qtyPerMonth * 2;
      penalties += late * c.unitPrice * 0.05;
    }
    if (c.monthsLeft === 0 && c.owed > 0) {
      penalties += c.owed * c.unitPrice * 0.3;
      p.goodwill = clamp(p.goodwill - 12);
      messages.push({ tone: 'bad', text: `${name} closed its ${LINES[c.line].name} contract with ${c.owed.toLocaleString('en-US')} undelivered. Penalty charged.` });
      continue;
    }
    keep.push(c);
  }
  state.partnerContracts = keep;
  return penalties;
}

export const averageGoodwill = (state: GameState) => PARTNER_IDS.reduce((s, p) => s + state.partners[p].goodwill, 0) / PARTNER_IDS.length;
