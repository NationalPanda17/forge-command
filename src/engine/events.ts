// Random events and decision cards. Everything here is fictional.
import {
  CAMPUSES,
  CAMPUS_IDS,
  COMPONENTS,
  COMPONENT_IDS,
  DIFFICULTY,
  EXPAND_STEP,
  GRACE_MONTHS,
  LINES,
  NATIONS,
  PARTNERS,
  PARTNER_IDS,
  SUPPLIERS,
  SUPPLIER_IDS,
  linesAt,
} from './data';
import { clamp, pick, rand, randInt, randRange } from './rng';
import { freeBays, newTranche, reserveTarget, reserveTotal } from './selectors';
import type { CampusId, Decision, GameState, LineId, MonthReport, PartnerId } from './types';

type Messages = MonthReport['messages'];

const hasDecision = (state: GameState, kind: string, key?: string | number) =>
  state.decisions.some((d) => d.kind === kind && (key === undefined || Object.values(d.data).includes(key)));

function addDecision(state: GameState, d: Omit<Decision, 'id'>): void {
  state.decisions.push({ ...d, id: state.nextId++ });
}

const fmtMoney = (m: number) => (m >= 1000 ? `$${(m / 1000).toFixed(1)}B` : `$${Math.round(m)}M`);

/** Rolls this month's random events. */
export function rollEvents(state: GameState, messages: Messages): void {
  if (state.month < GRACE_MONTHS) return;
  const rules = DIFFICULTY[state.difficulty];
  const r = rules.eventRate;
  const chance = (p: number) => rand(state) < p * r;
  const qualified = SUPPLIER_IDS.filter((s) => state.suppliers[s].qualified && !state.suppliers[s].bankrupt);

  // Supplier in distress: a bailout decision.
  for (const sid of qualified) {
    const st = state.suppliers[sid];
    if (st.health < 30 && !hasDecision(state, 'bailout', sid) && rand(state) < 0.5) {
      const cost = Math.round(20 + SUPPLIERS[sid].baseCap * COMPONENTS[SUPPLIERS[sid].component].price * 4);
      addDecision(state, {
        kind: 'bailout',
        title: `${SUPPLIERS[sid].name} is near collapse`,
        body: `${SUPPLIERS[sid].name} (${NATIONS[SUPPLIERS[sid].nation].name}) has missed payroll and its lenders are circling. If it fails, every contract with it ends and anything it owes you is lost.`,
        options: [
          { id: 'bail', label: `Bail it out (${fmtMoney(cost)})`, detail: 'Its finances recover. Deliveries continue.' },
          { id: 'let', label: 'Let the market decide', detail: 'About even odds it goes under this month.' },
        ],
        fallback: 'let',
        data: { supplier: sid, cost },
      });
      break;
    }
  }

  // Fire at an energetics site.
  if (chance(0.012)) {
    const sites = qualified.filter((s) => SUPPLIERS[s].component === 'energetics');
    if (sites.length) {
      const sid = pick(state, sites);
      const st = state.suppliers[sid];
      st.capFactor = 0.1;
      st.shockMonths = randInt(state, 2, 4);
      messages.push({ tone: 'bad', text: `Fire at ${SUPPLIERS[sid].name}: a nitration building is destroyed. Energetics deliveries collapse for ${st.shockMonths} months.` });
    }
  }

  // Export restrictions on foreign suppliers.
  if (chance(0.02)) {
    const foreign = qualified.filter((s) => SUPPLIERS[s].nation !== 'aldmere' && state.suppliers[s].embargoMonths === 0);
    const weighted = foreign.flatMap((s) => Array(SUPPLIERS[s].nation === 'karsk' ? 4 : SUPPLIERS[s].nation === 'ostrel' ? 2 : 1).fill(s));
    if (weighted.length) {
      const sid = pick(state, weighted);
      const months = randInt(state, 4, 10);
      state.suppliers[sid].embargoMonths = months;
      messages.push({ tone: 'bad', text: `Export restriction: ${NATIONS[SUPPLIERS[sid].nation].name} blocks ${COMPONENTS[SUPPLIERS[sid].component].name.toLowerCase()} shipments from ${SUPPLIERS[sid].name} for about ${months} months.` });
    }
  }

  // Port congestion across the strait.
  if (chance(0.025)) {
    const months = randInt(state, 2, 3);
    let hit = 0;
    for (const sid of qualified) {
      if (SUPPLIERS[sid].nation === 'corvane' || SUPPLIERS[sid].nation === 'ostrel') {
        state.suppliers[sid].congestionMonths = Math.max(state.suppliers[sid].congestionMonths, months);
        hit++;
      }
    }
    if (hit) messages.push({ tone: 'warn', text: `Port congestion at Halvard Docks: shipments from abroad take an extra month for the next ${months} months.` });
  }

  // A defective lot of components is quarantined.
  if (chance(0.025)) {
    const stocked = COMPONENT_IDS.filter((c) => state.components[c].stock > 1);
    if (stocked.length) {
      const c = pick(state, stocked);
      const lost = state.components[c].stock * randRange(state, 0.2, 0.4);
      state.components[c].stock -= lost;
      messages.push({ tone: 'bad', text: `Bad lot: incoming inspection rejects ${Math.round(lost).toLocaleString('en-US')} ${COMPONENTS[c].unit} of ${COMPONENTS[c].name.toLowerCase()}.` });
    }
  }

  // Energy price spike.
  if (state.mods.energyMonths === 0 && chance(0.015)) {
    state.mods.energyMonths = 3;
    messages.push({ tone: 'warn', text: 'Energy prices spike: plant overhead is up 25% for 3 months.' });
  }

  // Audit.
  if (!hasDecision(state, 'audit') && chance(0.015)) {
    const cost = Math.round(randRange(state, 10, 25));
    addDecision(state, {
      kind: 'audit',
      title: 'Audit office findings',
      body: 'The National Audit Office reports weak cost controls on two production programs. The Defence Committee wants to know what you will do about it.',
      options: [
        { id: 'fix', label: `Commission fixes (${fmtMoney(cost)})`, detail: 'Costs money, keeps the Committee on side.' },
        { id: 'contest', label: 'Contest the findings', detail: 'Free, but confidence drops.' },
      ],
      fallback: 'contest',
      data: { cost },
    });
  }

  // A supplier wants more money.
  if (!hasDecision(state, 'priceHike') && chance(0.025)) {
    const withDeals = qualified.filter((sid) => state.components[SUPPLIERS[sid].component].contracts.some((k) => k.supplier === sid && k.monthsLeft > 0));
    if (withDeals.length) {
      const sid = pick(state, withDeals);
      const pctUp = randInt(state, 8, 18);
      addDecision(state, {
        kind: 'priceHike',
        title: `${SUPPLIERS[sid].name} demands a price rise`,
        body: `${SUPPLIERS[sid].name} says its costs have soared. It wants ${pctUp}% more on every contract with you, or it will "prioritise other customers" for a while.`,
        options: [
          { id: 'accept', label: `Pay ${pctUp}% more`, detail: 'Every live contract with this supplier gets dearer.' },
          { id: 'refuse', label: 'Refuse', detail: 'Its deliveries to you drop to about 60% for 3 months.' },
        ],
        fallback: 'refuse',
        data: { supplier: sid, pct: pctUp },
      });
    }
  }

  // A partner wants to buy from the reserve in calm times.
  if (!state.crisis && !hasDecision(state, 'armsSale') && chance(0.03)) {
    const p = pick(state, PARTNER_IDS);
    const line = pick(state, PARTNERS[p].wants);
    const stock = reserveTotal(state.reserves[line]);
    if (stock > reserveTarget(state, line) * 0.8) {
      const qty = Math.max(1, Math.round(stock * randRange(state, 0.1, 0.2)));
      const price = Math.round(LINES[line].unitCost * randRange(state, 1.25, 1.6) * 10000) / 10000;
      addDecision(state, {
        kind: 'armsSale',
        title: `${PARTNERS[p].name} asks to buy ${LINES[line].name}`,
        body: `${PARTNERS[p].name} wants ${qty.toLocaleString('en-US')} ${LINES[line].name} from your reserve to rebuild its own stocks, and will pay well above cost.`,
        options: [
          { id: 'sell', label: `Sell for ${fmtMoney(qty * price)}`, detail: 'Money and goodwill now. A thinner reserve if trouble comes.' },
          { id: 'decline', label: 'Decline', detail: 'Keep the rounds. A little goodwill lost.' },
        ],
        fallback: 'decline',
        data: { partner: p, line, qty, price },
      });
    }
  }

  // Safety inspection.
  if (!hasDecision(state, 'inspection') && chance(0.02)) {
    const c = pick(state, CAMPUS_IDS);
    const cost = Math.round(randRange(state, 6, 14));
    addDecision(state, {
      kind: 'inspection',
      title: `Safety inspectors at ${CAMPUSES[c].name}`,
      body: 'The explosives safety inspectorate found storage distances out of date and a fire-suppression system overdue for service.',
      options: [
        { id: 'fix', label: `Fix it now (${fmtMoney(cost)})`, detail: 'Done properly, no fuss.' },
        { id: 'defer', label: 'Defer the work', detail: 'Free today. About even odds of a fine and an unhappy Committee.' },
      ],
      fallback: 'defer',
      data: { campus: c, cost },
    });
  }

  // Strikes when morale is low.
  for (const c of CAMPUS_IDS) {
    const cs = state.campuses[c];
    if (cs.strikeMonths === 0 && cs.morale < 32 && !hasDecision(state, 'strike', c) && rand(state) < ((32 - cs.morale) / 40) * r) {
      addDecision(state, {
        kind: 'strike',
        title: `Strike vote at ${CAMPUSES[c].name}`,
        body: `Workers at ${CAMPUSES[c].name} vote to strike over overtime and pay. Output there would fall to about a third.`,
        options: [
          { id: 'meet', label: 'Meet their demands', detail: 'Premium wages from now on (+15% payroll). Morale recovers.' },
          { id: 'firm', label: 'Hold firm', detail: 'A strike of 1 to 3 months.' },
        ],
        fallback: 'firm',
        data: { campus: c },
      });
    }
  }

  // Good news.
  if (chance(0.015)) {
    const id = pick(state, Object.keys(state.lines) as LineId[]);
    state.lines[id].experience += LINES[id].baseCapacity * 24;
    messages.push({ tone: 'good', text: `Process breakthrough on the ${LINES[id].name} line: a new fixture cuts assembly time.` });
  }
  if (chance(0.02)) {
    const c = pick(state, CAMPUS_IDS);
    const extra = randInt(state, 120, 260);
    state.campuses[c].pool += extra;
    messages.push({ tone: 'good', text: `A car plant near ${CAMPUSES[c].region} closes: ${extra} skilled workers join the hiring pool.` });
  }

  // Grateful partners help with critical materials.
  const friends = PARTNER_IDS.filter((p) => state.partners[p].goodwill >= 70);
  if (friends.length && chance(0.04)) {
    const p = pick(state, friends);
    const qty = Math.round(randRange(state, 25, 50));
    state.components.criticalMaterials.stock += qty;
    messages.push({ tone: 'good', text: `${PARTNERS[p].name} ships ${qty} lots of gallium and germanium from its own stockpile, as thanks.` });
  }

  // Co-funded expansion from a friendly partner.
  if (friends.length && !hasDecision(state, 'cofund') && chance(0.025)) {
    const p = pick(state, friends);
    const line = pick(state, PARTNERS[p].wants);
    addDecision(state, {
      kind: 'cofund',
      title: `${PARTNERS[p].name} offers to co-fund ${LINES[line].name} capacity`,
      body: `${PARTNERS[p].name} will pay for a new ${LINES[line].name} bay if it gets a share of the output: a 12-month contract at cost.`,
      options: [
        { id: 'accept', label: 'Accept', detail: 'A free expansion (needs a free bay) plus a delivery commitment.' },
        { id: 'decline', label: 'Decline', detail: 'No change.' },
      ],
      fallback: 'decline',
      data: { partner: p, line },
    });
  }

  // Emergency airlift during crises.
  if (state.crisis?.phase === 'active' && !hasDecision(state, 'airlift') && chance(0.12)) {
    const p = pick(state, PARTNER_IDS);
    const line = pick(state, PARTNERS[p].wants);
    const qty = Math.max(1, Math.round(LINES[line].baseCapacity * randRange(state, 0.3, 0.8)));
    const price = Math.round(LINES[line].unitCost * 1.4 * 10000) / 10000;
    addDecision(state, {
      kind: 'airlift',
      title: `Emergency request from ${PARTNERS[p].name}`,
      body: `${PARTNERS[p].name} is under heavy attack and asks for ${qty.toLocaleString('en-US')} ${LINES[line].name} from your reserve, flown out this week.`,
      options: [
        { id: 'send', label: `Send ${qty.toLocaleString('en-US')}`, detail: `Paid at ${fmtMoney(price * qty)}, big goodwill. Your reserve shrinks.` },
        { id: 'decline', label: 'Decline', detail: 'Keep the rounds. Goodwill drops.' },
      ],
      fallback: 'decline',
      data: { partner: p, line, qty, price },
    });
  }

  // Espionage and sabotage (hard).
  if (rules.sabotage) {
    const exposed = CAMPUS_IDS.filter((c) => state.campuses[c].securityMonths === 0);
    if (exposed.length && !hasDecision(state, 'espionage') && chance(0.03)) {
      const c = pick(state, exposed);
      const cost = 8;
      addDecision(state, {
        kind: 'espionage',
        title: `Counter-intelligence alert at ${CAMPUSES[c].name}`,
        body: 'A contractor badge was cloned and someone photographed the integration hall. It could be nothing.',
        options: [
          { id: 'sweep', label: `Security sweep (${fmtMoney(cost)})`, detail: 'Protects the campus for 8 months.' },
          { id: 'ignore', label: 'Log it and move on', detail: 'Free. Risky.' },
        ],
        fallback: 'ignore',
        data: { campus: c, cost },
      });
    }
    for (const c of exposed) if (chance(0.012)) sabotage(state, c, messages);
  }
}

function sabotage(state: GameState, campus: CampusId, messages: Messages): void {
  const id = pick(state, linesAt(campus));
  const line = state.lines[id];
  line.wear = clamp(line.wear + 35);
  for (const t of line.tranches) t.maturity = Math.max(0.3, t.maturity * 0.6);
  messages.push({ tone: 'bad', text: `Sabotage at ${CAMPUSES[campus].name}: tooling on the ${LINES[id].name} line was damaged. Output is down while it is repaired.` });
}

/** Applies a decision option. Returns $M spent and confidence change. */
export function resolveDecision(state: GameState, decisionId: number, optionId: string, messages: Messages): void {
  const d = state.decisions.find((x) => x.id === decisionId);
  if (!d) return;
  state.decisions = state.decisions.filter((x) => x.id !== decisionId);
  const opt = d.options.some((o) => o.id === optionId) ? optionId : d.fallback;
  switch (d.kind) {
    case 'bailout': {
      const sid = String(d.data.supplier);
      const st = state.suppliers[sid];
      if (opt === 'bail') {
        spend(state, Number(d.data.cost));
        st.health = clamp(st.health + 40);
        messages.push({ tone: 'info', text: `${SUPPLIERS[sid].name} is bailed out and back on its feet.` });
      } else if (rand(state) < 0.5) {
        goBankrupt(state, sid, messages);
      } else {
        st.health = Math.max(st.health, 25);
        messages.push({ tone: 'warn', text: `${SUPPLIERS[sid].name} scrapes through, for now.` });
      }
      break;
    }
    case 'strike': {
      const c = d.data.campus as CampusId;
      const cs = state.campuses[c];
      if (opt === 'meet') {
        cs.wage = 'premium';
        cs.morale = clamp(cs.morale + 25);
        messages.push({ tone: 'info', text: `Deal reached at ${CAMPUSES[c].name}: premium wages, no strike.` });
      } else {
        cs.strikeMonths = randInt(state, 1, 3);
        cs.morale = clamp(cs.morale - 5);
        messages.push({ tone: 'bad', text: `Strike at ${CAMPUSES[c].name} for about ${cs.strikeMonths} month${cs.strikeMonths > 1 ? 's' : ''}.` });
      }
      break;
    }
    case 'priceHike': {
      const sid = String(d.data.supplier);
      if (opt === 'accept') {
        const c = SUPPLIERS[sid].component;
        for (const k of state.components[c].contracts) if (k.supplier === sid) k.unitPrice *= 1 + Number(d.data.pct) / 100;
        messages.push({ tone: 'info', text: `New prices agreed with ${SUPPLIERS[sid].name}.` });
      } else {
        const st = state.suppliers[sid];
        st.capFactor = Math.min(st.capFactor, 0.6);
        st.shockMonths = Math.max(st.shockMonths, 3);
        messages.push({ tone: 'warn', text: `${SUPPLIERS[sid].name} cuts your allocation after the price dispute.` });
      }
      break;
    }
    case 'armsSale': {
      const p = d.data.partner as PartnerId;
      const line = d.data.line as LineId;
      if (opt === 'sell') {
        const r = state.reserves[line];
        const sold = Math.min(Number(d.data.qty), reserveTotal(r));
        const full = Math.min(r.stock, sold);
        r.stock -= full;
        r.degraded -= sold - full;
        const cash = sold * Number(d.data.price);
        state.treasury += cash;
        state.pending.revenue += cash;
        state.partners[p].goodwill = clamp(state.partners[p].goodwill + 6);
        messages.push({ tone: 'good', text: `Sold ${sold.toLocaleString('en-US')} ${LINES[line].name} to ${PARTNERS[p].name} for ${fmtMoney(cash)}.` });
      } else {
        state.partners[p].goodwill = clamp(state.partners[p].goodwill - 2);
      }
      break;
    }
    case 'inspection':
      if (opt === 'fix') spend(state, Number(d.data.cost));
      else if (rand(state) < 0.5) {
        spend(state, 25);
        state.confidence = clamp(state.confidence - 3);
        messages.push({ tone: 'bad', text: `The inspectorate fines the Board $25M over safety work at ${CAMPUSES[d.data.campus as CampusId].name}.` });
      }
      break;
    case 'audit':
      if (opt === 'fix') spend(state, Number(d.data.cost));
      else {
        state.confidence = clamp(state.confidence - 6);
        messages.push({ tone: 'bad', text: 'The Committee is not impressed by your response to the audit.' });
      }
      break;
    case 'airlift': {
      const p = d.data.partner as PartnerId;
      const line = d.data.line as LineId;
      if (opt === 'send') {
        const r = state.reserves[line];
        const want = Number(d.data.qty);
        const sent = Math.min(want, reserveTotal(r));
        const full = Math.min(r.stock, sent);
        r.stock -= full;
        r.degraded -= sent - full;
        state.pending.revenue += sent * Number(d.data.price);
        state.treasury += sent * Number(d.data.price);
        state.partners[p].goodwill = clamp(state.partners[p].goodwill + (sent >= want ? 15 : 6));
        state.confidence = clamp(state.confidence + 1);
        messages.push({ tone: 'good', text: `Airlift: ${sent.toLocaleString('en-US')} ${LINES[line].name} flown to ${PARTNERS[p].name}.` });
      } else {
        state.partners[p].goodwill = clamp(state.partners[p].goodwill - 8);
      }
      break;
    }
    case 'espionage': {
      const c = d.data.campus as CampusId;
      if (opt === 'sweep') {
        spend(state, Number(d.data.cost));
        state.campuses[c].securityMonths = 8;
      } else if (rand(state) < 0.35) {
        sabotage(state, c, messages);
      }
      break;
    }
    case 'cofund': {
      const p = d.data.partner as PartnerId;
      const line = d.data.line as LineId;
      if (opt === 'accept') {
        if (freeBays(state, LINES[line].campus) < 1) {
          messages.push({ tone: 'warn', text: `No free bay at ${CAMPUSES[LINES[line].campus].name}: ${PARTNERS[p].name}'s offer lapses.` });
          break;
        }
        state.lines[line].tranches.push(newTranche(state, LINES[line].baseCapacity * EXPAND_STEP));
        state.partnerContracts.push({
          id: state.nextId++,
          partner: p,
          line,
          qtyPerMonth: Math.max(1, Math.round(LINES[line].baseCapacity * 0.08)),
          monthsLeft: 12,
          unitPrice: LINES[line].unitCost,
          owed: 0,
          delivered: 0,
        });
        state.partners[p].goodwill = clamp(state.partners[p].goodwill + 5);
        messages.push({ tone: 'good', text: `${PARTNERS[p].name} funds a new ${LINES[line].name} bay.` });
      }
      break;
    }
  }
}

function spend(state: GameState, cost: number): void {
  state.treasury -= cost;
  state.pending.projects += cost;
}

export function goBankrupt(state: GameState, sid: string, messages: Messages): void {
  const st = state.suppliers[sid];
  st.bankrupt = true;
  st.qualified = false;
  const c = SUPPLIERS[sid].component;
  const lost = state.components[c].contracts.filter((k) => k.supplier === sid);
  state.components[c].contracts = state.components[c].contracts.filter((k) => k.supplier !== sid);
  const owed = lost.reduce((s, k) => s + k.backlog, 0);
  messages.push({
    tone: 'bad',
    text: `${SUPPLIERS[sid].name} has gone bankrupt.${lost.length ? ` ${lost.length} contract${lost.length > 1 ? 's' : ''} void${owed > 0 ? `, ${Math.round(owed).toLocaleString('en-US')} ${COMPONENTS[c].unit} owed are lost` : ''}.` : ''}`,
  });
}

/** Unanswered decisions take their fallback when the month ends. */
export function applyFallbacks(state: GameState, messages: Messages): void {
  for (const d of [...state.decisions]) resolveDecision(state, d.id, d.fallback, messages);
}
