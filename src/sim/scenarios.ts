// Release 19.0c: scenario identities (docs/depth.md). Each scenario gets a rule of its own:
//   War footing: a front in the Marches that moves with your artillery stocks, and air surges against the thinnest region.
//   Sanctions: the bans stay until a nation's relations recover (or a long time passes), and a broker sells at a markup.
//   Rebuild: worn-out plants that decay faster, to refurbish or replace.
//   Peacetime: a budget round at the start of each fiscal year, three packages that move the year's goals.
// None of these draw random numbers except the broker's exposure roll, taken only when you buy.
import { money } from './money';
import DEPTH from './tuning/depth.json';
import { addWaste } from './audit';
import { AIR_LINES, LAND_LINES } from './fight';
import { rand } from './rng';
import { lotQty, nationalDailyDraw, nationalStock, regionBases, regionDailyDraw, reserveTarget } from './selectors';
import type { Decision } from './strategy';
import type { FeedItem, SimState } from './types';
import { FIGHTING_REGIONS, MATERIALS, REGIONS, SITES, SITE_BY_ID, type LineId, type RegionId } from './world';
import { mulberry } from './worldgen';

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;
const T = DEPTH.scenarios;

// ---------- War footing ----------

export interface WarState {
  /** −1 (falling back) to 1 (advancing). */
  front: number;
  /** Day the current air surge ends (0 when none). */
  surgeUntil: number;
  surgeRegion: RegionId | null;
  /** Day the next surge begins. */
  nextSurge: number;
}

/** Where the front is. */
export const FRONT_REGION = T.war.frontRegion as RegionId;

export const newWar = (day: number): WarState => ({ front: 0, surgeUntil: 0, surgeRegion: null, nextSurge: day + T.war.surgeGap });

/** How much harder (or easier) a region is pressed today, for air or land, on top of everything else. */
export function pressure(s: SimState, region: RegionId, family: 'air' | 'land'): number {
  const w = s.war;
  if (!w) return 1;
  if (family === 'air') return w.surgeUntil > s.day && w.surgeRegion === region ? T.war.surgeMult : 1;
  if (region !== T.war.frontRegion) return 1;
  return w.front < -T.war.frontEdge ? T.war.frontLossDraw : w.front > T.war.frontEdge ? T.war.frontGainDraw : 1;
}

/** The front's word for the screen. */
export const frontState = (w: WarState) => (w.front < -T.war.frontEdge ? 'falling back' : w.front > T.war.frontEdge ? 'advancing' : 'holding');

const stockAt = (s: SimState, ids: string[], lines: LineId[]) => ids.reduce((a, id) => a + lines.reduce((b, l) => b + lotQty(s.sites[id]?.lots[l]), 0), 0);

/** Days of artillery the front's guns and depot hold, against the days the front wants. Capped. */
export function frontCover(s: SimState): number {
  const r = T.war.frontRegion as RegionId;
  const lines = LAND_LINES.filter((l) => s.lines[l].unlocked);
  // Without the front's own pressure, so a falling front is not judged against its own extra draw.
  const draw = lines.reduce((a, l) => a + regionDailyDraw(s, r, l), 0) / pressure(s, r, 'land');
  if (draw <= 0) return 1;
  const stock = stockAt(s, [...regionBases(r, 'land'), REGIONS[r].depot], lines);
  return Math.min(T.war.coverCap, stock / (draw * T.war.coverDays));
}

/** The region whose air defences hold the fewest days of rounds. */
function thinnestAir(s: SimState): RegionId {
  const lines = AIR_LINES.filter((l) => s.lines[l].unlocked);
  let best: RegionId = FIGHTING_REGIONS[0];
  let low = Infinity;
  for (const r of FIGHTING_REGIONS) {
    const draw = lines.reduce((a, l) => a + regionDailyDraw(s, r, l), 0);
    if (draw <= 0) continue;
    const days = stockAt(s, [...regionBases(r, 'air'), REGIONS[r].depot], lines) / draw;
    if (days < low) [low, best] = [days, r];
  }
  return best;
}

function warDay(s: SimState, feed: Feed): void {
  const w = s.war!;
  if (w.surgeUntil && w.surgeUntil <= s.day) {
    feed(s, 'info', `The surge over ${REGIONS[w.surgeRegion!].name} has eased.`);
    w.surgeUntil = 0;
    w.surgeRegion = null;
  }
  if (s.day >= w.nextSurge) {
    w.surgeRegion = thinnestAir(s);
    w.surgeUntil = s.day + T.war.surgeDays;
    w.nextSurge = s.day + T.war.surgeGap;
    feed(s, 'warn', `Surge: heavy raids expected over ${REGIONS[w.surgeRegion].name} for two weeks. They found your thinnest air defences.`, undefined, true);
  }
}

function warMonth(s: SimState, feed: Feed): void {
  const w = s.war!;
  const before = frontState(w);
  w.front = Math.max(-1, Math.min(1, w.front + T.war.frontStep * (frontCover(s) - 1)));
  const now = frontState(w);
  const name = REGIONS[T.war.frontRegion as RegionId].name;
  if (now !== before) feed(s, now === 'falling back' ? 'bad' : now === 'advancing' ? 'good' : 'info', `${name} front: ${now}.`, undefined, now === 'falling back');
  if (now === 'falling back') {
    s.confidence = Math.max(0, s.confidence - T.war.frontLossConfidence);
    // The fighting reaches the plants behind the line.
    for (const d of SITES) {
      if (d.region !== T.war.frontRegion || d.owner === 'foreign' || !s.sites[d.id].processes.length) continue;
      const site = s.sites[d.id];
      site.disruptionDays = Math.max(site.disruptionDays, T.war.frontDisruptionDays);
      site.disruptionFactor = Math.min(site.disruptionFactor, T.war.frontDisruptionFactor);
    }
  }
}

// ---------- Sanctions ----------

/** A small hash, so a starting value can depend on the seed without drawing from the game's stream. */
const hash = (seed: number, salt: string) => {
  let h = seed ^ 0x5a17;
  for (const c of salt) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193);
  return mulberry(h)();
};

/** Starting relations under sanctions: the nations take the values in an order set by the seed. */
export function sanctionRelations(seed: number, nations: string[]): Record<string, number> {
  const order = [...nations].sort((a, b) => hash(seed, a) - hash(seed, b));
  return Object.fromEntries(order.map((n, i) => [n, T.sanctions.startRelations[Math.min(i, T.sanctions.startRelations.length - 1)]]));
}

function sanctionsMonth(s: SimState, feed: Feed, open: (k: Decision['kind']) => boolean): void {
  // A ban lifts the month a nation's relations reach the mark.
  const lifted = new Set<string>();
  for (const d of SITES) {
    const site = s.sites[d.id];
    if (d.owner !== 'foreign' || !d.nation || site.embargoDays <= 0) continue;
    if ((s.diplomacy.nations[d.nation] ?? 0) >= T.sanctions.liftAt) {
      site.embargoDays = 0;
      lifted.add(d.nation);
    }
  }
  for (const n of lifted) feed(s, 'good', `${n} lifts its export ban: relations are good enough now.`, undefined, true);
  // While any ban holds, a broker offers what you are shortest of.
  const banned = SITES.some((d) => d.owner === 'foreign' && s.sites[d.id].embargoDays > 0);
  if (!banned || open('broker')) return;
  const line = (Object.keys(s.lines) as LineId[])
    .filter((l) => s.lines[l].unlocked && reserveTarget(s, l) > 0)
    .sort((a, b) => nationalStock(s, a) / reserveTarget(s, a) - nationalStock(s, b) / reserveTarget(s, b))[0];
  if (!line) return;
  const qty = Math.max(5, Math.round(nationalDailyDraw(s, line) * T.sanctions.brokerDays));
  const price = Math.round(MATERIALS[line].price * s.priceIndex * T.sanctions.brokerPrice * 1e4) / 1e4;
  const total = Math.round(qty * price);
  s.strategy.decisions.push({
    id: s.nextId++,
    kind: 'broker',
    title: `A broker offers ${MATERIALS[line].name}`,
    body: `A broker can land ${qty} ${MATERIALS[line].name} round the bans, no questions asked, at ${money(price)} each (${money(total)}), about ${Math.round((T.sanctions.brokerPrice - 1) * 100)}% over the list price. If it comes out, the Committee will not like it.`,
    options: [
      { id: 'buy', label: `Buy them ($${total}M)`, detail: `Quick rounds; a ${Math.round(T.sanctions.exposeOdds * 100)}% chance it comes out.` },
      { id: 'pass', label: 'No', detail: 'Nothing changes.' },
    ],
    fallback: 'pass',
    data: { line, qty, price },
  });
  feed(s, 'info', 'A broker has made an offer. A decision is waiting.', undefined, true);
}

/** Buying from the broker: the rounds, the premium as waste, and a chance the Committee hears of it. */
export function brokerBuy(s: SimState, d: Decision, feed: Feed, pay: (v: number) => void, ship: (line: LineId, qty: number) => void): void {
  const { line, qty = 0, price = 0 } = d.data ?? {};
  if (!line) return;
  pay(qty * price);
  ship(line, qty);
  addWaste(s, 'grey', qty * price * (1 - 1 / T.sanctions.brokerPrice));
  if (rand(s) < T.sanctions.exposeOdds) {
    s.confidence = Math.max(0, s.confidence - T.sanctions.exposeConfidence);
    feed(s, 'bad', `The broker deal leaks. The Committee is not pleased.`, undefined, true);
  } else feed(s, 'good', `${qty} ${MATERIALS[line].name} bought from a broker, due in about five weeks.`);
}

// ---------- Rebuild ----------

export interface RebuildState {
  /** Plants being replaced: site id to days left. */
  replacing: Record<string, number>;
  /** Plants already replaced: built to last, they wear no faster than normal. */
  replaced: string[];
}

/** Starting condition of a state plant in a rebuild, from the seed and the site. */
export const rebuildCondition = (seed: number, site: string) => Math.round(T.rebuild.startCondition[0] + hash(seed, site) * (T.rebuild.startCondition[1] - T.rebuild.startCondition[0]));

export const replaceCost = (repair: number) => Math.round(repair * T.rebuild.replaceCost);
export const REPLACE_DAYS = T.rebuild.replaceDays;
export const REPLACE_GAIN = T.rebuild.replaceCapacity;

function rebuildDay(s: SimState, feed: Feed): void {
  const r = s.rebuild!;
  for (const d of SITES) {
    if (d.owner !== 'state') continue;
    const site = s.sites[d.id];
    if (site.condition < T.rebuild.wornBelow && !r.replaced.includes(d.id)) site.condition = Math.max(0, site.condition - T.rebuild.decay);
  }
  for (const [id, days] of Object.entries(r.replacing)) {
    if (days > 1) {
      r.replacing[id] = days - 1;
      continue;
    }
    delete r.replacing[id];
    const site = s.sites[id];
    site.status = 'active';
    site.condition = 100;
    for (const p of site.processes) p.capacity *= 1 + REPLACE_GAIN;
    r.replaced.push(id);
    feed(s, 'good', `${SITE_BY_ID[id].name} reopens, rebuilt: ${Math.round(REPLACE_GAIN * 100)}% more capacity, built to last.`, id, true);
  }
}

// ---------- Peacetime ----------

export type BudgetDeal = 'hawks' | 'treasury' | 'regions' | 'none';

function peacetimeMonth(s: SimState, feed: Feed, open: (k: Decision['kind']) => boolean): void {
  const year = Math.floor(s.history.slice(s.termMonth ?? 0).length / 12);
  if (year < 1 || s.hearing || open('budgetRound') || (s.budgetDeals ?? {})[year]) return;
  const P = T.peacetime;
  s.strategy.decisions.push({
    id: s.nextId++,
    kind: 'budgetRound',
    title: 'The budget round',
    body: 'The Committee will fund one of three budgets this year. Each changes what it will judge you on.',
    options: [
      { id: 'hawks', label: 'The hawks’ budget', detail: `${Math.round(P.hawksMoney * 100)}% more money; the Committee expects fuller racks.` },
      { id: 'treasury', label: 'The Treasury’s budget', detail: `${Math.round(-P.treasuryMoney * 100)}% less money; value for money counts for more, readiness for less.` },
      { id: 'regions', label: 'The regions’ budget', detail: 'Regional jobs count for more, stewardship for less.' },
      { id: 'none', label: 'Leave the budget as it is', detail: 'No change.' },
    ],
    fallback: 'none',
    value: year,
  });
  feed(s, 'info', 'The Committee will fund one of three budgets this year. A decision is waiting.', undefined, true);
}

/** Takes a budget package for this fiscal year. */
export function budgetDeal(s: SimState, year: number, deal: BudgetDeal, feed: Feed): void {
  (s.budgetDeals ??= {})[year] = deal;
  const P = T.peacetime;
  if (deal === 'hawks') s.appropriation = Math.round(s.appropriation * (1 + P.hawksMoney));
  if (deal === 'treasury') s.appropriation = Math.round(s.appropriation * (1 + P.treasuryMoney));
  if (deal !== 'none') feed(s, 'info', `The ${deal === 'hawks' ? 'hawks’' : deal === 'treasury' ? 'Treasury’s' : 'regions’'} budget is agreed for this year.`);
}

/** How a year's budget deal moves the mandate's weights (before they are renormalised). */
export function dealWeights(s: SimState, year: number, w: Record<string, number>): Record<string, number> {
  const deal = s.budgetDeals?.[year];
  if (!deal || deal === 'none' || deal === 'hawks') return w;
  const out = { ...w };
  const move = (from: string, to: string, v: number) => {
    if (!(from in out) || !(to in out)) return;
    const m = Math.min(v, out[from]);
    out[from] -= m;
    out[to] += m;
  };
  if (deal === 'treasury') move('readiness', 'value', T.peacetime.treasuryShift);
  if (deal === 'regions') move('stewardship', 'jobs', T.peacetime.regionsShift);
  return out;
}

/** The hawks' budget raises the readiness the Committee expects this year. */
export const dealReadiness = (s: SimState, year: number) => (s.budgetDeals?.[year] === 'hawks' ? T.peacetime.hawksReadiness : 0);

// ---------- The hooks ----------

/** Each day: surges, wear and replacements. */
export function scenarioDay(s: SimState, feed: Feed): void {
  if (s.war) warDay(s, feed);
  if (s.rebuild) rebuildDay(s, feed);
}

/** At each month's close. */
export function scenarioMonth(s: SimState, feed: Feed): void {
  const open = (k: Decision['kind']) => s.strategy.decisions.some((d) => d.kind === k);
  if (s.war) warMonth(s, feed);
  if (s.scenario === 'sanctions' && s.diplomacy) sanctionsMonth(s, feed, open);
  if (s.scenario === 'standard' && !s.story && s.mode !== 'sandbox' && !s.hotseat) peacetimeMonth(s, feed, open);
}

/** The scenario rules a new game starts with. */
export function scenarioStart(s: SimState): void {
  if (s.scenario === 'warFooting') s.war = newWar(s.day);
  if (s.scenario === 'rebuild') {
    s.rebuild = { replacing: {}, replaced: [] };
    for (const d of SITES) if (d.owner === 'state' && s.sites[d.id].processes.length && d.kind !== 'plot') s.sites[d.id].condition = rebuildCondition(s.seed, d.id);
  }
  if (s.scenario === 'sanctions') {
    for (const d of SITES) if (d.owner === 'foreign') s.sites[d.id].embargoDays = T.sanctions.maxBan;
    if (s.diplomacy) Object.assign(s.diplomacy.nations, sanctionRelations(s.seed, Object.keys(s.diplomacy.nations)));
  }
}
