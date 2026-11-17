// The supply chain each month: feedstock markets move, suppliers drift and stumble, shipments sail,
// contracts and spot orders fill, and old stock ages out.
import {
  COMPONENTS,
  COMPONENT_IDS,
  DIFFICULTY,
  GRACE_MONTHS,
  INVEST_STEP,
  LEAD_TIME,
  NATIONS,
  SHELF_LIFE,
  SPOT_PREMIUM,
  SUPPLIERS,
  TIER2,
  TIER2_IDS,
  suppliersOf,
  tier2For,
} from './data';
import { goBankrupt } from './events';
import { clamp, pick, rand, randInt, randRange } from './rng';
import { supplierCap } from './selectors';
import { baselineNeed } from './setup';
import type { ComponentId, GameState, MonthReport } from './types';

type Messages = MonthReport['messages'];
const round2 = (v: number) => Math.round(v * 100) / 100;
const fmt = (v: number) => Math.round(v).toLocaleString('en-US');

/** Feedstock markets: disruptions, recovery and prices. */
export function runMarkets(s: GameState, messages: Messages): void {
  const rules = DIFFICULTY[s.difficulty];
  for (const t of TIER2_IDS) {
    const m = s.tier2[t];
    if (!rules.shortages) {
      m.availability = 1;
      m.priceIndex = 1;
      m.disruptionMonths = 0;
      continue;
    }
    if (m.disruptionMonths > 0) {
      m.disruptionMonths--;
      if (m.disruptionMonths === 0) messages.push({ tone: 'good', text: `${TIER2[t].name} supplies are recovering.` });
    } else {
      m.availability = clamp(m.availability + (1 - m.availability) * 0.3 + randRange(s, -0.03, 0.03), 0.3, 1.05);
    }
    const crisis = s.crisis?.phase === 'active' ? 0.012 : 0;
    m.priceIndex = clamp(m.priceIndex + (1 - m.priceIndex) * 0.08 + randRange(s, -0.03, 0.035) + crisis, 0.7, 2);
  }
  if (rules.shortages && s.month >= GRACE_MONTHS && rand(s) < 0.018 * rules.eventRate) {
    const t = pick(s, TIER2_IDS);
    const m = s.tier2[t];
    m.availability = round2(randRange(s, 0.45, 0.7));
    m.disruptionMonths = randInt(s, 2, 5);
    m.priceIndex = clamp(m.priceIndex + 0.3, 0.7, 2);
    const what: Record<string, string> = {
      perchlorate: 'An explosion shuts a reactor line at Cinder Flats Chemical.',
      nitro: 'Floods on the Varn River halt nitrocellulose production.',
      steel: 'A furnace failure at the main billet mill cuts forging steel.',
      wafers: 'A world wafer shortage: foundries ration their customers.',
      ore: 'Smelter cutbacks abroad squeeze gallium and germanium recovery.',
      optics: 'A fire at a Corvane glassworks delays IR crystal shipments.',
    };
    messages.push({ tone: 'bad', text: `${what[t]} ${TIER2[t].feeds.map((c) => COMPONENTS[c].name).join(' and ')} suppliers will deliver less for a while, and prices jump.` });
  }
  for (const c of COMPONENT_IDS) {
    const t = tier2For(c);
    s.components[c].priceIndex = round2(t ? s.tier2[t].priceIndex : 1);
  }
}

/** Suppliers drift and deliver. Returns component spend. */
export function runSupply(s: GameState, messages: Messages): number {
  const rules = DIFFICULTY[s.difficulty];
  let spend = 0;

  // Shipments that arrive this month.
  const arriving = s.shipments.filter((sh) => sh.arrive <= s.month);
  s.shipments = s.shipments.filter((sh) => sh.arrive > s.month);
  for (const c of COMPONENT_IDS) {
    s.components[c].lastLost = 0;
    s.components[c].lastAged = 0;
  }
  for (const sh of arriving) {
    const nation = SUPPLIERS[sh.supplier].nation;
    const risk = 0.005 + (nation === 'karsk' ? 0.01 : 0) + (s.crisis?.phase === 'active' && s.crisis.family === 'air' && nation === 'corvane' ? 0.04 : 0);
    if (rules.shortages && rand(s) < risk) {
      s.components[sh.component].lastLost += sh.qty;
      messages.push({ tone: 'bad', text: `A shipment of ${fmt(sh.qty)} ${COMPONENTS[sh.component].unit} of ${COMPONENTS[sh.component].name.toLowerCase()} from ${NATIONS[nation].name} was lost at sea.` });
      continue;
    }
    s.components[sh.component].stock += sh.qty;
  }

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
      if (st.investingMonths !== null && !st.bankrupt) {
        st.investingMonths--;
        if (st.investingMonths <= 0) {
          st.investingMonths = null;
          st.capBonus++;
          messages.push({ tone: 'good', text: `${def.name} opens the capacity you paid for: +${Math.round(INVEST_STEP * 100)}%.` });
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

    // Deliveries: contracts first, then standing spot orders from the cheapest supplier with room.
    const capLeft: Record<string, number> = Object.fromEntries(sids.map((sid) => [sid, supplierCap(s, sid)]));
    const ship = (sid: string, qty: number) => {
      if (qty <= 0) return 0;
      s.suppliers[sid].lastDelivered += qty;
      const lead = LEAD_TIME[SUPPLIERS[sid].nation] + (s.suppliers[sid].congestionMonths > 0 ? 1 : 0);
      if (lead <= 0) return qty;
      s.shipments.push({ id: s.nextId++, component: c, supplier: sid, qty: round2(qty), arrive: s.month + lead });
      return 0;
    };
    let toStock = 0;
    for (const k of cs.contracts) {
      if (k.monthsLeft > 0) {
        spend += k.qtyPerMonth * k.unitPrice;
        k.backlog += k.qtyPerMonth;
        k.monthsLeft--;
      }
      const d = Math.min(k.backlog, capLeft[k.supplier] ?? 0);
      k.backlog = round2(k.backlog - d);
      capLeft[k.supplier] -= d;
      toStock += ship(k.supplier, d);
    }
    cs.contracts = cs.contracts.filter((k) => k.monthsLeft > 0 || k.backlog > 0.01);
    let spot = cs.spotOrder;
    for (const sid of [...sids].sort((a, b) => SUPPLIERS[a].priceMult - SUPPLIERS[b].priceMult)) {
      if (spot <= 0) break;
      const d = Math.min(spot, capLeft[sid]);
      if (d <= 0) continue;
      spot -= d;
      capLeft[sid] -= d;
      spend += d * COMPONENTS[c].price * SUPPLIERS[sid].priceMult * SPOT_PREMIUM * cs.priceIndex;
      toStock += ship(sid, d);
    }
    cs.stock += toStock;
    cs.lastDelivered = round2(sids.reduce((a, sid) => a + s.suppliers[sid].lastDelivered, 0));
    cs.lastUsed = 0;
    cs.lastShort = 0;
    cs.lastSubstituted = 0;

    // Shelf life: stock far beyond need ages out.
    const shelf = SHELF_LIFE[c];
    if (shelf) {
      const keep = baselineNeed(c) * shelf.months;
      if (cs.stock > keep) {
        const aged = (cs.stock - keep) * shelf.loss;
        cs.stock -= aged;
        cs.lastAged = round2(aged);
      }
    }
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

/** Units of a component already on the water. */
export const inTransit = (s: GameState, c: ComponentId) => s.shipments.filter((sh) => sh.component === c).reduce((a, sh) => a + sh.qty, 0);
