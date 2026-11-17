// Logistics: convoys carry rounds from the central reserve to regional depots, allies lend stock in a pinch,
// and a rival power builds up its arms industry.
import {  rulesOf } from './rules';
import {  LINES, LINE_IDS, LOAN_COOLDOWN, LOAN_GOODWILL, PARTNERS, THEATERS, THEATER_IDS, WEIGHT } from './data';
import { expectedTheaterDraw } from './demand';
import { clamp, randRange } from './rng';
import { isEstablished, readiness } from './selectors';
import { transportMult } from './politics';
import type { GameState, LineId, MonthReport, PartnerId, TheaterId } from './types';

type Messages = MonthReport['messages'];
/** $M a month per tonne of transport capacity. */
export const TRANSPORT_UPKEEP = 0.004;

export const inbound = (s: GameState, theater: TheaterId, id: LineId) =>
  s.convoys.filter((c) => c.theater === theater && c.line === id).reduce((a, c) => a + c.full + c.degraded, 0);

export const depotTotal = (s: GameState, theater: TheaterId, id: LineId) => s.theaters[theater].depot[id].full + s.theaters[theater].depot[id].degraded;

/** Convoys that reach their depots this month. */
export function receiveConvoys(s: GameState): void {
  const here = s.convoys.filter((c) => c.arrive <= s.month);
  s.convoys = s.convoys.filter((c) => c.arrive > s.month);
  for (const c of here) {
    const dep = s.theaters[c.theater].depot[c.line];
    dep.full += c.full;
    dep.degraded += c.degraded;
  }
}

/** What each depot would like to receive this month. */
export function depotNeeds(s: GameState): { theater: TheaterId; line: LineId; qty: number }[] {
  const out: { theater: TheaterId; line: LineId; qty: number }[] = [];
  for (const theater of THEATER_IDS) {
    const months = s.theaters[theater].targetMonths;
    if (months <= 0) continue;
    const draw = expectedTheaterDraw(s, 1, theater);
    for (const id of LINE_IDS) {
      if (!isEstablished(s, id) || draw[id] <= 0) continue;
      const need = draw[id] * months - depotTotal(s, theater, id) - inbound(s, theater, id);
      if (need >= 1) out.push({ theater, line: id, qty: Math.floor(need) });
    }
  }
  return out;
}

/** Plans and sends this month's convoys. Returns tonnes moved. */
export function dispatchConvoys(s: GameState, messages: Messages): number {
  const needs = depotNeeds(s);
  if (!needs.length) return 0;
  // Share each line's central stock across the depots that want it.
  const byLine = new Map<LineId, number>();
  for (const n of needs) byLine.set(n.line, (byLine.get(n.line) ?? 0) + n.qty);
  const lineScale = new Map<LineId, number>();
  for (const [id, want] of byLine) {
    const r = s.reserves[id];
    lineScale.set(id, Math.min(1, (r.stock + r.degraded) / want));
  }
  const tonnes = needs.reduce((a, n) => a + n.qty * (lineScale.get(n.line) ?? 0) * WEIGHT[n.line], 0);
  const cap = s.transport * transportMult(s);
  const tScale = tonnes > cap ? cap / tonnes : 1;
  let moved = 0;
  for (const n of needs) {
    const qty = Math.floor(n.qty * (lineScale.get(n.line) ?? 0) * tScale);
    if (qty <= 0) continue;
    const r = s.reserves[n.line];
    const full = Math.min(r.stock, qty);
    const degraded = Math.min(r.degraded, qty - full);
    r.stock -= full;
    r.degraded -= degraded;
    s.convoys.push({ id: s.nextId++, theater: n.theater, line: n.line, full, degraded, arrive: s.month + 1 });
    moved += (full + degraded) * WEIGHT[n.line];
  }
  if (tScale < 0.95) messages.push({ tone: 'warn', text: `Convoys ran at full capacity (${Math.round(cap).toLocaleString('en-US')} t): some depots will not be topped up this month.` });
  return moved;
}

/** Fills every depot to its target from the central reserve, instantly (used at the start of a campaign). */
export function seedDepots(s: GameState): void {
  for (const theater of THEATER_IDS) {
    const draw = expectedTheaterDraw(s, 1, theater);
    for (const id of LINE_IDS) {
      const r = s.reserves[id];
      const qty = Math.min(r.stock, Math.round(draw[id] * s.theaters[theater].targetMonths));
      r.stock -= qty;
      s.theaters[theater].depot[id].full += qty;
    }
  }
}

export const loanQty = (id: LineId) => Math.max(1, Math.round(LINES[id].baseCapacity * 1.5));

export function loanBlocker(s: GameState, p: PartnerId, id: LineId): string | null {
  const st = s.partners[p];
  if (!PARTNERS[p].wants.includes(id)) return `${PARTNERS[p].name} does not stock ${LINES[id].name}.`;
  if (!isEstablished(s, id)) return `You do not make ${LINES[id].name}, so you could not pay it back.`;
  if (st.loanCooldown > 0) return `${PARTNERS[p].name} will not lend again for ${st.loanCooldown} months.`;
  if (st.goodwill < LOAN_GOODWILL) return `${PARTNERS[p].name} needs goodwill of ${LOAN_GOODWILL} to lend.`;
  return null;
}

/** An ally lends rounds now; you repay them from production over eight months. */
export function takeLoan(s: GameState, p: PartnerId, id: LineId): number {
  const qty = loanQty(id);
  s.reserves[id].stock += qty;
  s.partners[p].goodwill = clamp(s.partners[p].goodwill - 4);
  s.partners[p].loanCooldown = LOAN_COOLDOWN;
  s.partnerContracts.push({ id: s.nextId++, partner: p, line: id, qtyPerMonth: Math.ceil(qty / 8), monthsLeft: 8, unitPrice: 0, owed: 0, delivered: 0 });
  return qty;
}

/** The rival's arms industry grows; a well-stocked reserve slows it. */
export function growRival(s: GameState): void {
  const hard = rulesOf(s).adaptive ? 0.002 : 0;
  const deterred = readiness(s) > 0.85 ? 0.004 : 0;
  s.rival = Math.max(80, Math.round(s.rival * (1 + randRange(s, 0.002, 0.007) + hard - deterred) * 100) / 100);
  for (const p of Object.keys(s.partners) as PartnerId[]) if (s.partners[p].loanCooldown > 0) s.partners[p].loanCooldown--;
}

export const theaterName = (t: TheaterId) => THEATERS[t].name;
