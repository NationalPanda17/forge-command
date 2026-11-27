// Allies and exports: relations with the nations that sell you parts, trade missions and supply guarantees that keep
// their export bans away, co-production deals with allies, and an export desk that goes looking for buyers.
import { money } from './money';
import { clamp, pick } from './rng';
import { DAYS_PER_MONTH, nationalDailyDraw } from './selectors';
import type { AllyId, FeedItem, SimState } from './types';
import { FINISHED, MATERIALS, SITES, type LineId } from './world';
import { pathBetween } from './graph';

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

export interface CoProduction {
  id: number;
  ally: AllyId;
  line: LineId;
  /** Rounds landed each month. */
  perMonth: number;
  /** $M a round. */
  price: number;
  until: number;
}

export interface DiplomacyState {
  /** Relations with each nation that sells you parts, 0..100. */
  nations: Record<string, number>;
  /** Day each nation's supply guarantee runs out. */
  guarantees: Record<string, number>;
  /** Day a nation (or ally) can next receive a trade mission. */
  missions: Record<string, number>;
  coprod: CoProduction[];
  /** Day the export desk can next look for buyers. */
  deskReady: number;
}

const ALLY_NAMES: Record<AllyId, string> = { merrow: 'Merrow Compact', calder: 'Calder League' };

/** The nations that sell you parts. */
export const supplierNations = () => [...new Set(SITES.filter((d) => d.owner === 'foreign' && d.nation).map((d) => d.nation!))].sort();

export function newDiplomacy(s: SimState): DiplomacyState {
  const start = s.scenario === 'sanctions' ? 35 : 50;
  return { nations: Object.fromEntries(supplierNations().map((n) => [n, start])), guarantees: {}, missions: {}, coprod: [], deskReady: 0 };
}

export const MISSION_DAYS = 90;
export const missionCost = (s: SimState) => Math.round(15 * s.priceIndex);
export const guaranteeCost = (s: SimState) => Math.round(40 * s.priceIndex);
export const coprodCost = (s: SimState) => Math.round(30 * s.priceIndex);
export const DESK_COST = 5;
export const GUARANTEE_NEEDS = 65;
export const COPROD_NEEDS = 60;
/** A co-production deal lapses if relations with the ally fall below this. */
export const COPROD_LAPSE = 35;

const isAlly = (who: string): who is AllyId => who === 'merrow' || who === 'calder';

/** Relations with a supplier nation or an ally. */
export const relations = (s: SimState, who: string) => (isAlly(who) ? s.allies[who] : s.diplomacy.nations[who] ?? 50);

export const guaranteed = (s: SimState, nation: string) => (s.diplomacy.guarantees[nation] ?? 0) > s.day;

/** How likely a nation is to ban exports, against a neutral 50: 0 while a guarantee holds. */
export function banFactor(s: SimState, nation: string | undefined): number {
  if (!nation || !s.diplomacy) return 1;
  if (guaranteed(s, nation)) return 0;
  return clamp(2 - relations(s, nation) / 50, 0.2, 2);
}

/** Rounds a co-production deal would land each month for a line. */
export const coprodRounds = (s: SimState, line: LineId) => Math.max(5, Math.round(nationalDailyDraw(s, line) * DAYS_PER_MONTH * 0.15));
export const coprodPrice = (s: SimState, line: LineId) => Math.round(MATERIALS[line].price * s.priceIndex * 0.9 * 1e4) / 1e4;

export function validateDiplomacy(s: SimState, a: { type: string; who?: string; nation?: string; ally?: AllyId; line?: LineId; id?: number }): string | null {
  const d = s.diplomacy;
  switch (a.type) {
    case 'tradeMission': {
      const who = a.who!;
      if (!isAlly(who) && !(who in d.nations)) return 'No such nation.';
      if ((d.missions[who] ?? 0) > s.day) return 'A mission went recently. Wait a while.';
      if (relations(s, who) >= 95) return 'Relations could hardly be better.';
      return s.treasury >= missionCost(s) ? null : `Not enough money (needs $${missionCost(s)}M).`;
    }
    case 'supplyGuarantee': {
      const n = a.nation!;
      if (!(n in d.nations)) return 'No such nation.';
      if (guaranteed(s, n)) return 'A guarantee is already in force.';
      if (relations(s, n) < GUARANTEE_NEEDS) return `Relations must be at least ${GUARANTEE_NEEDS}.`;
      return s.treasury >= guaranteeCost(s) ? null : `Not enough money (needs $${guaranteeCost(s)}M).`;
    }
    case 'coproduce': {
      const line = a.line!;
      if (!s.lines[line]?.unlocked) return 'That round is not in production.';
      if (d.coprod.some((c) => c.line === line)) return 'A deal for this round is already in force.';
      if (s.allies[a.ally!] < COPROD_NEEDS) return `Relations must be at least ${COPROD_NEEDS}.`;
      return s.treasury >= coprodCost(s) ? null : `Not enough money (needs $${coprodCost(s)}M).`;
    }
    case 'endCoproduction':
      return d.coprod.some((c) => c.id === a.id) ? null : 'No such deal.';
    case 'seekExport':
      if (!s.lines[a.line!]?.unlocked) return 'That round is not in production.';
      if (d.deskReady > s.day) return 'The export desk is still working on its last enquiry.';
      if (s.strategy.decisions.some((x) => x.kind === 'export')) return 'An export offer is already waiting for you.';
      return s.treasury >= DESK_COST ? null : `Not enough money (needs $${DESK_COST}M).`;
  }
  return null;
}

const CUSTOMERS = ['the Sorrel Republic', 'the Ardent Isles', 'the Hallen Confederation', 'the Duchy of Ostmark'];

export function applyDiplomacy(s: SimState, a: { type: string; who?: string; nation?: string; ally?: AllyId; line?: LineId; id?: number }, feed: Feed): void {
  const d = s.diplomacy;
  const pay = (v: number) => {
    s.treasury -= v;
    s.month.spend.projects += v;
  };
  switch (a.type) {
    case 'tradeMission': {
      const who = a.who!;
      pay(missionCost(s));
      d.missions[who] = s.day + MISSION_DAYS;
      if (isAlly(who)) s.allies[who] = clamp(s.allies[who] + 8);
      else d.nations[who] = clamp(d.nations[who] + 12);
      feed(s, 'good', `A trade mission visits the ${isAlly(who) ? ALLY_NAMES[who] : who}. Relations improve.`);
      break;
    }
    case 'supplyGuarantee':
      pay(guaranteeCost(s));
      d.guarantees[a.nation!] = s.day + 360;
      feed(s, 'good', `The ${a.nation} guarantees its supplies for a year: no export bans from it until then.`);
      break;
    case 'coproduce': {
      pay(coprodCost(s));
      const line = a.line!;
      d.coprod.push({ id: s.nextId++, ally: a.ally!, line, perMonth: coprodRounds(s, line), price: coprodPrice(s, line), until: s.day + 24 * DAYS_PER_MONTH });
      s.allies[a.ally!] = clamp(s.allies[a.ally!] + 5);
      // Work that goes abroad is work that does not happen at home.
      s.strategy.factions.industry = clamp(s.strategy.factions.industry - 4);
      s.strategy.factions.regions = clamp(s.strategy.factions.regions - 2);
      feed(s, 'good', `Co-production agreed with the ${ALLY_NAMES[a.ally!]}: ${MATERIALS[line].name} rounds land every month for two years.`);
      break;
    }
    case 'endCoproduction': {
      const c = d.coprod.find((x) => x.id === a.id)!;
      d.coprod = d.coprod.filter((x) => x.id !== a.id);
      s.allies[c.ally] = clamp(s.allies[c.ally] - 10);
      feed(s, 'warn', `You end the ${MATERIALS[c.line].name} co-production deal early. The ${ALLY_NAMES[c.ally]} is not pleased.`);
      break;
    }
    case 'seekExport': {
      pay(DESK_COST);
      d.deskReady = s.day + 60;
      const line = a.line!;
      const months = pick(s, [6, 9, 12]);
      const qty = Math.max(20, Math.round(nationalDailyDraw(s, line) * DAYS_PER_MONTH * months * 0.2));
      // A buyer found by your own desk pays a little better than one who comes to you.
      const price = Math.round(MATERIALS[line].price * s.priceIndex * 1.3 * 1e4) / 1e4;
      const customer = pick(s, CUSTOMERS);
      s.strategy.decisions.push({
        id: s.nextId++,
        kind: 'export',
        title: `Your export desk finds a buyer: ${customer}`,
        body: `${customer[0].toUpperCase() + customer.slice(1)} will take ${qty} ${MATERIALS[line].name} over ${months} months at ${money(price)} a round (${money(qty * price)}). Deliveries come from the central depot and never take the reserve below half its target. Falling more than 10% short costs a penalty.`,
        options: [
          { id: 'accept', label: 'Sign the contract', detail: 'Income and goodwill with industry.' },
          { id: 'decline', label: 'Let it go', detail: 'Keep every round at home.' },
        ],
        fallback: 'decline',
        data: { line, qty, price, customer, months },
      });
      feed(s, 'info', `The export desk has found a buyer for ${MATERIALS[line].name}. A decision is waiting.`, undefined, true);
      break;
    }
  }
}

export function diplomacyMonth(s: SimState, feed: Feed): void {
  const d = s.diplomacy;
  for (const n of Object.keys(d.nations)) d.nations[n] = clamp(d.nations[n] + (50 - d.nations[n]) * 0.03);
  // Co-production: rounds land at the port, paid for on arrival; deals lapse if the ally turns cold.
  for (const c of [...d.coprod]) {
    if (s.day >= c.until) {
      d.coprod = d.coprod.filter((x) => x.id !== c.id);
      feed(s, 'info', `The ${MATERIALS[c.line].name} co-production deal with the ${ALLY_NAMES[c.ally]} has run its course.`);
      continue;
    }
    if (s.allies[c.ally] < COPROD_LAPSE) {
      d.coprod = d.coprod.filter((x) => x.id !== c.id);
      feed(s, 'bad', `Relations with the ${ALLY_NAMES[c.ally]} have soured: it pulls out of the ${MATERIALS[c.line].name} co-production deal.`, undefined, true);
      continue;
    }
    const cost = c.perMonth * c.price;
    s.treasury -= cost;
    s.month.spend.purchases += cost;
    const path = pathBetween('portLowmouth', 'depotCentral');
    s.shipments.push({
      id: s.nextId++,
      from: 'portLowmouth',
      to: 'depotCentral',
      material: c.line,
      qty: c.perMonth,
      lots: [{ qty: c.perMonth, made: s.day, until: s.day + MATERIALS[c.line].shelfDays }],
      depart: s.day,
      arrive: s.day + 12,
      path: path ? ['portLowmouth', ...path.legs.map((l) => l.to)] : ['portLowmouth', 'depotCentral'],
      modes: path ? path.legs.map((l) => l.mode) : ['rail'],
    });
    s.allies[c.ally] = clamp(s.allies[c.ally] + 0.5);
  }
  // Rounds sold abroad warm the nations you buy from a little: you are a reliable trading partner.
  if ((s.month.exported ?? 0) > 0) for (const n of Object.keys(d.nations)) d.nations[n] = clamp(d.nations[n] + 1);
}

/** Lines a co-production deal can cover: anything you make. */
export const coprodLines = (s: SimState) => (FINISHED as LineId[]).filter((l) => s.lines[l].unlocked);
