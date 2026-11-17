// The world around the industry: seasons, allies, export customers and events that unfold in stages.
import { DIFF, takeLots } from './tick';
import { pathBetween } from './graph';
import { clamp, pick, rand, randInt } from './rng';
import { registerResolver } from './strategy';
import { DAYS_PER_MONTH, lotQty, nationalDailyDraw, nationalStock, reserveTarget } from './selectors';
import type { AllyId, Chain, FeedItem, SimState } from './types';
import { FINISHED, MATERIALS, RECIPES, SITES, SITE_BY_ID, type LineId, type MaterialId } from './world';

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

// ---------- Seasons ----------

export type Season = 'winter' | 'spring' | 'summer' | 'autumn';
/** 0 = January. */
export const monthOfYear = (day: number) => Math.floor(day / DAYS_PER_MONTH) % 12;
export function seasonOf(day: number): Season {
  const m = monthOfYear(day);
  return m === 11 || m <= 1 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn';
}

export const SEASON_NOTE: Record<Season, string> = {
  winter: 'Sea ice in the north cuts the Meric sea lanes by 40%, and snow slows roads everywhere.',
  spring: 'The thaw floods low roads in March and April; central railways run a little slower.',
  summer: 'Heat limits energetics: propellant, explosive and perchlorate plants lose 5% of output in July and August.',
  autumn: 'Calm weather. A good time to move stock before winter.',
};

const NORTH_SEA = new Set(SITES.filter((d) => d.region === 'north').map((d) => d.id));

/** How much of a route's daily tonnage the weather allows. */
export function legCapFactor(s: SimState, from: string, to: string, mode: string): number {
  const season = seasonOf(s.day);
  const m = monthOfYear(s.day);
  const north = NORTH_SEA.has(from) || NORTH_SEA.has(to);
  if (season === 'winter') {
    if (mode === 'sea' && north) return 0.6;
    if (mode === 'road') return north ? 0.8 : 0.9;
    if (mode === 'rail' && north) return 0.92;
  }
  if (m === 2 || m === 3) {
    if (mode === 'road') return 0.9;
    if (mode === 'rail' && (SITE_BY_ID[from]?.region === 'central' || SITE_BY_ID[to]?.region === 'central')) return 0.95;
  }
  return 1;
}

const HEAT_SENSITIVE = new Set(['propellantMix', 'heSynth', 'nitration', 'apElectrolysis', 'chargeMaking']);
/** Output factor for a recipe in today's weather. */
export const plantSeasonFactor = (s: SimState, recipe: string) => (HEAT_SENSITIVE.has(recipe) && [6, 7].includes(monthOfYear(s.day)) ? 0.95 : 1);

// ---------- Allies and customers ----------

export const ALLIES: Record<AllyId, { name: string; blurb: string }> = {
  merrow: { name: 'Merrow Compact', blurb: 'An old treaty partner across the Lowmouth Bight, with deep stocks and a long memory.' },
  calder: { name: 'Calder League', blurb: 'A rich island federation that buys more than it makes.' },
};
export const ALLY_IDS = Object.keys(ALLIES) as AllyId[];
const CUSTOMERS = ['the Sorrel Republic', 'the Ardent Isles', 'the Hallen Confederation', 'the Duchy of Ostmark'];

const AIR_LINES: LineId[] = ['pac3', 'sm6', 'tamir', 'irist', 'stinger'];
const recipeFor = (line: LineId) => Object.keys(RECIPES).find((k) => RECIPES[k].output === line)!;

function ship(s: SimState, from: string, to: string, line: LineId, qty: number, days: number): void {
  const path = pathBetween(from, to);
  s.shipments.push({
    id: s.nextId++,
    from,
    to,
    material: line,
    qty,
    lots: [{ qty, made: s.day, until: s.day + MATERIALS[line].shelfDays }],
    depart: s.day,
    arrive: s.day + days,
    path: path ? [from, ...path.legs.map((l) => l.to)] : [from, to],
    modes: path ? path.legs.map((l) => l.mode) : ['sea'],
  });
}

// ---------- Daily ----------

export function livingDay(s: SimState, feed: Feed): void {
  // Season changes.
  if (s.day % DAYS_PER_MONTH === 1 && [11, 2, 5, 8].includes(monthOfYear(s.day))) {
    const season = seasonOf(s.day);
    feed(s, 'info', `${season[0].toUpperCase() + season.slice(1)}. ${SEASON_NOTE[season]}`);
  }
  // Export deliveries leave the central depot a day at a time, never below the Committee's floor.
  for (const x of s.exports) {
    if (x.delivered >= x.qty || s.day > x.endDay) continue;
    const quota = x.qty / Math.max(1, x.endDay - x.start);
    const floor = reserveTarget(s, x.line) * 0.5;
    const spare = nationalStock(s, x.line) - floor;
    const want = Math.min(x.qty - x.delivered, Math.max(0, Math.floor(quota * (s.day - x.start + 1)) - x.delivered));
    const n = Math.min(want, Math.max(0, Math.floor(spare)), Math.floor(lotQty(s.sites.depotCentral.lots[x.line])));
    if (n <= 0) continue;
    takeLots(s.sites.depotCentral, x.line, n);
    x.delivered += n;
    s.treasury += n * x.price;
    s.month.income.sales += n * x.price;
    s.month.exported = (s.month.exported ?? 0) + n;
  }
  // Export orders that ran out of time.
  for (const x of s.exports.filter((e) => s.day === e.endDay)) {
    const short = x.qty - x.delivered;
    if (short > x.qty * 0.1) {
      const fee = Math.round(short * x.price * 0.15);
      s.treasury -= fee;
      s.month.spend.projects += fee;
      s.confidence = clamp(s.confidence - 2);
      feed(s, 'bad', `The order for ${x.customer} closes ${Math.round(short)} ${MATERIALS[x.line].name} short. Penalty: $${fee}M.`, undefined, true);
    } else feed(s, 'good', `The ${MATERIALS[x.line].name} order for ${x.customer} is delivered in full.`);
  }
  s.exports = s.exports.filter((e) => s.day <= e.endDay);
  // Event chains whose next stage is due.
  for (const c of [...s.chains]) if (c.due <= s.day) advanceChain(s, c, feed);
}

// ---------- Monthly ----------

export function livingMonth(s: SimState, feed: Feed): void {
  const ev = DIFF[s.difficulty].events;
  const calm = s.scenario === 'tutorial' && s.day < 360;
  for (const a of ALLY_IDS) s.allies[a] = clamp(s.allies[a] + (55 - s.allies[a]) * 0.02);
  const open = (k: string) => s.strategy.decisions.some((d) => d.kind === k);

  // An ally asks for help.
  if (!calm && !open('allyRequest') && rand(s) < 0.07) {
    const ally = pick(s, ALLY_IDS);
    const line = pick(s, AIR_LINES.filter((l) => s.lines[l].unlocked));
    const qty = Math.max(10, Math.round(nationalDailyDraw(s, line) * 40));
    const price = Math.round(MATERIALS[line].price * s.priceIndex * 1.1 * 1e4) / 1e4;
    s.strategy.decisions.push({
      id: s.nextId++,
      kind: 'allyRequest',
      title: `The ${ALLIES[ally].name} asks for ${MATERIALS[line].name}`,
      body: `Our ally is under pressure and asks for ${qty} ${MATERIALS[line].name} from the central depot, at $${price.toFixed(3)}M a round. Your reserve is at ${Math.round((nationalStock(s, line) / Math.max(1, reserveTarget(s, line))) * 100)}% of target.`,
      options: [
        { id: 'send', label: `Send ${qty}`, detail: 'Relations improve; your reserve drops.' },
        { id: 'decline', label: 'Decline politely', detail: 'Relations cool.' },
      ],
      fallback: 'decline',
      data: { ally, line, qty, price },
    });
    feed(s, 'info', `The ${ALLIES[ally].name} has asked for help. A decision is waiting.`, undefined, true);
  }
  // An ally offers rounds when you are short or a crisis looms.
  const short = s.crisis !== null || (s.history.at(-1)?.readiness ?? 1) < 0.55;
  if (!calm && short && !open('allyOffer') && rand(s) < 0.18) {
    const ally = [...ALLY_IDS].sort((a, b) => s.allies[b] - s.allies[a])[0];
    if (s.allies[ally] >= 40) {
      const line = [...AIR_LINES]
        .filter((l) => s.lines[l].unlocked && reserveTarget(s, l) > 0)
        .sort((a, b) => nationalStock(s, a) / reserveTarget(s, a) - nationalStock(s, b) / reserveTarget(s, b))[0];
      if (line) {
        const qty = Math.max(10, Math.round(nationalDailyDraw(s, line) * 60));
        const price = Math.round(MATERIALS[line].price * s.priceIndex * (1.5 - s.allies[ally] / 250) * 1e4) / 1e4;
        s.strategy.decisions.push({
          id: s.nextId++,
          kind: 'allyOffer',
          title: `The ${ALLIES[ally].name} offers ${MATERIALS[line].name}`,
          body: `They can release ${qty} rounds from their own stocks at $${price.toFixed(3)}M each ($${Math.round(qty * price)}M), landed at Lowmouth in about five weeks.`,
          options: [
            { id: 'buy', label: `Buy them ($${Math.round(qty * price)}M)`, detail: 'Expensive, but quick.' },
            { id: 'pass', label: 'No, thank you', detail: 'Nothing changes.' },
          ],
          fallback: 'pass',
          data: { ally, line, qty, price },
        });
        feed(s, 'info', `The ${ALLIES[ally].name} offers rounds from its stocks.`, undefined, true);
      }
    }
  }
  // Export customers.
  if (!calm && !open('export') && s.exports.length < 2 && rand(s) < 0.06) {
    const line = pick(s, FINISHED.filter((l) => s.lines[l as LineId].unlocked) as LineId[]);
    const months = pick(s, [6, 9, 12]);
    const qty = Math.max(20, Math.round(nationalDailyDraw(s, line) * DAYS_PER_MONTH * months * 0.25));
    const price = Math.round(MATERIALS[line].price * s.priceIndex * 1.25 * 1e4) / 1e4;
    const customer = pick(s, CUSTOMERS);
    s.strategy.decisions.push({
      id: s.nextId++,
      kind: 'export',
      title: `An export order from ${customer}`,
      body: `${customer[0].toUpperCase() + customer.slice(1)} wants ${qty} ${MATERIALS[line].name} over ${months} months at $${price.toFixed(3)}M a round ($${Math.round(qty * price)}M). Deliveries come from the central depot, and never take the reserve below half its target. Falling more than 10% short costs a penalty.`,
      options: [
        { id: 'accept', label: 'Accept the order', detail: 'Income and goodwill with industry.' },
        { id: 'decline', label: 'Decline', detail: 'Keep every round at home.' },
      ],
      fallback: 'decline',
      data: { line, qty, price, customer, months },
    });
    feed(s, 'info', `${customer[0].toUpperCase() + customer.slice(1)} wants to buy ${MATERIALS[line].name}.`);
  }
  // Event chains start.
  if (!calm && s.day > 120 && rand(s) < 0.05 * ev) startChain(s, 'labour', feed);
  if (!calm && s.day > 120 && rand(s) < 0.04 * ev) startChain(s, 'quality', feed);
  if (!calm && s.day > 120 && rand(s) < 0.03 * ev) startChain(s, 'safety', feed);
}

// ---------- Event chains ----------

function startChain(s: SimState, kind: Chain['kind'], feed: Feed): void {
  if (s.chains.some((c) => c.kind === kind)) return;
  if (kind === 'labour') {
    const def = pick(s, SITES.filter((d) => d.owner === 'state' && d.kind === 'arsenal'));
    const cost = Math.round(def.crew * 0.0095 * 6 * s.priceIndex);
    const c: Chain = { id: s.nextId++, kind, site: def.id, stage: 0, due: s.day + 30 };
    s.chains.push(c);
    s.strategy.decisions.push({
      id: s.nextId++,
      kind: 'labour',
      title: `Pay dispute at ${def.name}`,
      body: `The union at ${def.name} wants a rise to keep up with prices, up ${Math.round((s.priceIndex - 1) * 100)}% since you started. They will strike in a month if nothing is offered.`,
      options: [
        { id: 'pay', label: `Meet the claim ($${cost}M)`, detail: 'The dispute ends. The regions approve.' },
        { id: 'talk', label: `Offer half ($${Math.round(cost / 2)}M)`, detail: 'Even odds they accept.' },
        { id: 'refuse', label: 'Refuse', detail: 'A strike is likely.' },
      ],
      fallback: 'refuse',
      site: def.id,
      value: cost,
      data: { chain: c.id },
    });
    feed(s, 'warn', `Pay dispute at ${def.name}. A decision is waiting.`, def.id, true);
  }
  if (kind === 'quality') {
    const def = pick(s, SITES.filter((d) => d.owner === 'private' && d.kind === 'components' && s.sites[d.id].qualified));
    const m = RECIPES[def.processes[0].recipe].output;
    const c: Chain = { id: s.nextId++, kind, site: def.id, stage: 0, due: s.day + 45, material: m };
    s.chains.push(c);
    const cost = Math.round(10 + MATERIALS[m].price * 40);
    s.strategy.decisions.push({
      id: s.nextId++,
      kind: 'recall',
      title: `Quality escape at ${def.name}`,
      body: `Inspectors found that some ${MATERIALS[m].name.toLowerCase()} from ${def.name} failed acceptance tests that were signed off anyway. Some of it is already in your arsenals.`,
      options: [
        { id: 'recall', label: `Recall and retest ($${cost}M)`, detail: 'You lose half the parts on hand; nothing bad reaches the field.' },
        { id: 'accept', label: 'Accept the risk', detail: 'Rounds built with them may fail surveillance later.' },
      ],
      fallback: 'accept',
      site: def.id,
      value: cost,
      data: { chain: c.id, material: m },
    });
    feed(s, 'warn', `Quality escape at ${def.name}. A decision is waiting.`, def.id, true);
  }
  if (kind === 'safety') {
    const def = pick(s, SITES.filter((d) => d.owner === 'private' && ['mine', 'quarry', 'well'].includes(d.kind) && s.sites[d.id].status === 'active'));
    const site = s.sites[def.id];
    site.disruptionDays = Math.max(site.disruptionDays, 21);
    site.disruptionFactor = Math.min(site.disruptionFactor, 0.4);
    s.chains.push({ id: s.nextId++, kind, site: def.id, stage: 0, due: s.day + 20 });
    feed(s, 'bad', `Accident at ${def.name}: work is suspended while the inspectors look into it.`, def.id, true);
  }
}

function advanceChain(s: SimState, c: Chain, feed: Feed): void {
  const def = SITE_BY_ID[c.site];
  const site = s.sites[c.site];
  const done = () => (s.chains = s.chains.filter((x) => x.id !== c.id));
  if (c.kind === 'labour') {
    // Reached only if the dispute was not settled: the strike begins.
    site.disruptionDays = randInt(s, 25, 50);
    site.disruptionFactor = 0.3;
    s.strategy.factions.regions = clamp(s.strategy.factions.regions - 3);
    feed(s, 'bad', `Strike at ${def.name}: production down to 30% for about ${Math.round(site.disruptionDays / 7)} weeks.`, c.site, true);
    done();
  } else if (c.kind === 'quality') {
    // Reached only if the risk was accepted: suspect rounds fail surveillance.
    const line = (FINISHED as LineId[]).find((l) => s.lines[l].unlocked && (RECIPES[recipeFor(l)]?.inputs?.[c.material!] ?? 0) > 0);
    if (line && rand(s) < 0.6) {
      const n = Math.floor(lotQty(s.sites.depotCentral.lots[line]) * 0.12);
      if (n > 0) {
        takeLots(s.sites.depotCentral, line, n);
        s.sites.depotCentral.unserviceable[line] = (s.sites.depotCentral.unserviceable[line] ?? 0) + n;
        s.month.retired += n;
      }
      s.confidence = clamp(s.confidence - 4);
      feed(s, 'bad', `Suspect parts from ${def.name}: ${n} ${MATERIALS[line].name} at the central depot fail surveillance and are condemned.`, 'depotCentral', true);
    } else feed(s, 'good', `The suspect parts from ${def.name} turn out to be sound.`);
    done();
  } else if (c.kind === 'safety') {
    if (c.stage === 0) {
      const cost = Math.round(8 + def.crew * 0.05);
      c.stage = 1;
      c.due = s.day + 60;
      s.strategy.decisions.push({
        id: s.nextId++,
        kind: 'inspection',
        title: `Inspectors report on ${def.name}`,
        body: `The accident report on ${def.name} calls for new ventilation and ground support. The owners cannot afford it alone. Without it the regulator will keep the site at a fraction of output for two months.`,
        options: [
          { id: 'fund', label: `Co-fund the upgrade ($${cost}M)`, detail: 'Back to work quickly; the regions approve.' },
          { id: 'leave', label: 'Leave it to the owners', detail: 'Output stays low for two months.' },
        ],
        fallback: 'leave',
        site: def.id,
        value: cost,
        data: { chain: c.id },
      });
      feed(s, 'warn', `Inspectors report on ${def.name}. A decision is waiting.`, c.site, true);
    } else done();
  }
}

// ---------- Decisions ----------

type Dec = { kind: string; site?: string; value?: number; data?: { line?: LineId; material?: MaterialId; qty?: number; price?: number; ally?: AllyId; customer?: string; chain?: number; months?: number } };

export function resolveLiving(s: SimState, d: Dec, opt: string, feed: Feed): boolean {
  const data = d.data ?? {};
  const chain = s.chains.find((c) => c.id === data.chain);
  const pay = (v: number) => {
    s.treasury -= v;
    s.month.spend.projects += v;
  };
  switch (d.kind) {
    case 'allyRequest': {
      const ally = data.ally!;
      if (opt === 'send') {
        const line = data.line!;
        const got = takeLots(s.sites.depotCentral, line, Math.min(data.qty ?? 0, Math.floor(lotQty(s.sites.depotCentral.lots[line])))).reduce((a, l) => a + l.qty, 0);
        s.treasury += got * (data.price ?? 0);
        s.month.income.sales += got * (data.price ?? 0);
        s.allies[ally] = clamp(s.allies[ally] + 14);
        s.strategy.factions.hawks = clamp(s.strategy.factions.hawks - 1);
        feed(s, 'good', `${got} ${MATERIALS[line].name} sent to the ${ALLIES[ally].name}.`);
      } else {
        s.allies[ally] = clamp(s.allies[ally] - 8);
        feed(s, 'info', `You decline the ${ALLIES[ally].name}'s request.`);
      }
      return true;
    }
    case 'allyOffer': {
      if (opt === 'buy') {
        const qty = data.qty ?? 0;
        pay(qty * (data.price ?? 0));
        ship(s, 'portLowmouth', 'depotCentral', data.line!, qty, 35);
        s.allies[data.ally!] = clamp(s.allies[data.ally!] + 4);
        feed(s, 'good', `${qty} ${MATERIALS[data.line!].name} bought from the ${ALLIES[data.ally!].name}, due in about five weeks.`);
      }
      return true;
    }
    case 'export': {
      if (opt === 'accept') {
        const months = data.months ?? 6;
        s.exports.push({ id: s.nextId++, customer: data.customer!, line: data.line!, qty: data.qty!, delivered: 0, price: data.price!, start: s.day, endDay: s.day + months * DAYS_PER_MONTH });
        s.strategy.factions.industry = clamp(s.strategy.factions.industry + 3);
        feed(s, 'good', `Export order accepted: ${data.qty} ${MATERIALS[data.line!].name} for ${data.customer}.`);
      } else s.strategy.factions.industry = clamp(s.strategy.factions.industry - 1);
      return true;
    }
    case 'labour': {
      if (!chain) return true;
      const settle = () => {
        s.chains = s.chains.filter((c) => c.id !== chain.id);
        s.strategy.factions.regions = clamp(s.strategy.factions.regions + 2);
      };
      if (opt === 'pay') {
        pay(d.value ?? 0);
        settle();
        feed(s, 'good', `Pay deal agreed at ${SITE_BY_ID[chain.site].name}.`, chain.site);
      } else if (opt === 'talk') {
        pay(Math.round((d.value ?? 0) / 2));
        if (rand(s) < 0.5) {
          settle();
          feed(s, 'good', `The union at ${SITE_BY_ID[chain.site].name} accepts half.`, chain.site);
        } else feed(s, 'warn', `The union at ${SITE_BY_ID[chain.site].name} rejects the offer. A strike is coming.`, chain.site);
      } else feed(s, 'warn', `You refuse the claim at ${SITE_BY_ID[chain.site].name}. A strike is coming.`, chain.site);
      return true;
    }
    case 'recall': {
      if (!chain) return true;
      if (opt === 'recall') {
        pay(d.value ?? 0);
        const m = data.material!;
        for (const def of SITES.filter((x) => x.owner === 'state')) {
          const st = s.sites[def.id].stock;
          if (st[m]) st[m] = st[m]! * 0.5;
        }
        s.chains = s.chains.filter((c) => c.id !== chain.id);
        s.sites[chain.site].health = clamp(s.sites[chain.site].health - 10);
        feed(s, 'info', `Recall under way: suspect ${MATERIALS[m].name.toLowerCase()} pulled from your arsenals.`, chain.site);
      }
      return true;
    }
    case 'inspection': {
      if (!chain) return true;
      const site = s.sites[chain.site];
      if (opt === 'fund') {
        pay(d.value ?? 0);
        site.disruptionDays = 0;
        site.disruptionFactor = 1;
        site.health = clamp(site.health + 10);
        s.strategy.factions.regions = clamp(s.strategy.factions.regions + 3);
        feed(s, 'good', `${SITE_BY_ID[chain.site].name} is back at work with its safety upgrade.`, chain.site);
      } else {
        site.disruptionDays = 60;
        site.disruptionFactor = 0.25;
        feed(s, 'warn', `The regulator holds ${SITE_BY_ID[chain.site].name} to a quarter of its output for two months.`, chain.site);
      }
      s.chains = s.chains.filter((c) => c.id !== chain.id);
      return true;
    }
  }
  return false;
}


registerResolver((s, d, opt, feed) => resolveLiving(s, d, opt, feed));
