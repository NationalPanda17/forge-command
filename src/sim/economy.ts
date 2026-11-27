// The money side of the industry: inflation, tenders with competing bids, supplier finances and supplementary budgets.
import { money } from './money';
import { supplierEnergyFactor } from './energy';
import { clamp, rand, randRange } from './rng';
import { registerResolver } from './strategy';
import { DAYS_PER_MONTH } from './selectors';
import type { Bid, FeedItem, SimState, Tender } from './types';
import { MATERIALS, RECIPES, SITES, SITE_BY_ID, type MaterialId } from './world';

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

/** Longer commitments buy lower prices. */
export const CONTRACT_DISCOUNT = { 12: 0.9, 24: 0.85, 36: 0.8 } as const;
/** About 3% a year in calm times. */
export const BASE_INFLATION = 0.0025;
export const TENDER_COST = 1;
export const TENDER_DAYS = 30;

/** Today's list price of a material, $M per unit. */
export const priceNow = (s: SimState, m: MaterialId) => MATERIALS[m].price * s.priceIndex;

/** Units a day a site can make of a material, at full capacity. */
export function siteCapacity(s: SimState, siteId: string, m: MaterialId): number {
  const site = s.sites[siteId];
  let cap = 0;
  for (const p of site.processes) {
    const rec = RECIPES[p.recipe];
    const total = p.capacity + (p.ramp ?? []).reduce((a, r) => a + r.cap * r.maturity, 0);
    if (rec.output === m) cap += total;
    else if (rec.extra?.[m]) cap += total * (rec.extra[m] ?? 0);
  }
  return cap;
}

/** Suppliers that could bid for a material: qualified, outside your own plants, and still trading. */
export function bidders(s: SimState, m: MaterialId): string[] {
  return SITES.filter((d) => d.owner !== 'state' && s.sites[d.id].qualified && s.sites[d.id].status !== 'closed' && siteCapacity(s, d.id, m) > 0).map((d) => d.id);
}

/** Opens a tender: every eligible supplier bids at once. Competition pushes prices down. */
export function makeTender(s: SimState, material: MaterialId, perDay: number, months: 12 | 24 | 36): Tender {
  const ids = bidders(s, material);
  const competition = Math.max(0.86, 1 - 0.045 * (ids.length - 1));
  const bids: Bid[] = ids.map((id) => {
    const def = SITE_BY_ID[id];
    const site = s.sites[id];
    const cap = siteCapacity(s, id, material);
    // Others' contracts already claim part of the plant.
    const claimed = s.contracts.filter((c) => c.site === id && c.material === material && c.endDay > s.day).reduce((a, c) => a + c.perDay, 0);
    const offer = Math.max(0, Math.min(perDay, cap * 0.9 - claimed));
    const hungry = site.health < 40;
    const foreign = def.owner === 'foreign';
    let price = priceNow(s, material) * CONTRACT_DISCOUNT[months] * competition * randRange(s, 0.95, 1.05) * supplierEnergyFactor(s, id);
    if (hungry) price *= 0.93;
    if (foreign) price *= 0.95;
    const reliability = clamp(0.45 * (site.health / 100) + 0.45 * (site.condition / 100) + (foreign ? -0.12 : 0.08) + (site.embargoDays > 0 ? -0.3 : 0), 0.05, 0.98);
    const notes: string[] = [];
    if (offer < perDay - 1e-6) notes.push(offer <= 0 ? 'no spare capacity' : `can only promise ${round(offer)} a day`);
    if (hungry) notes.push('needs the work; finances weak');
    if (foreign) notes.push(`export licence from the ${def.nation}`);
    if (site.embargoDays > 0) notes.push('under an export ban');
    return { site: id, perDay: round(offer), price: Math.round(price * 1e5) / 1e5, reliability: Math.round(reliability * 100) / 100, note: notes.join('; ') || 'a clean bid' };
  });
  bids.sort((a, b) => a.price - b.price);
  return { id: s.nextId++, material, perDay, months, opened: s.day, expires: s.day + TENDER_DAYS, bids };
}

const round = (v: number) => Math.round(v * 1000) / 1000;

/** Month end: prices drift up, contracts keep suppliers afloat, and weak suppliers ask for more money. */
export function economyMonth(s: SimState, feed: Feed): void {
  let r = BASE_INFLATION + (rand(s) - 0.5) * 0.002;
  if (s.crisis?.phase === 'active') r += 0.004;
  if (s.scenario === 'sanctions' && s.day < 360) r += 0.002;
  if (s.settings?.inflation === false) r = 0;
  s.priceIndex = Math.round(s.priceIndex * (1 + r) * 10000) / 10000;

  for (const def of SITES) {
    if (def.owner !== 'private') continue;
    const site = s.sites[def.id];
    if (site.status === 'closed') continue;
    const live = s.contracts.filter((c) => c.site === def.id && c.endDay > s.day);
    // Steady orders steady the books.
    site.health = clamp(site.health + Math.min(2, live.length) * 0.8);
    // Fixed-price work loses money as costs rise: a weak supplier asks to reprice.
    for (const c of live) {
      const fair = priceNow(s, c.material);
      if (site.health < 45 && c.price < fair * 0.9 && rand(s) < 0.25 && !s.strategy.decisions.some((d) => d.kind === 'reprice' && d.data?.contract === c.id)) {
        const ask = Math.round(fair * 0.97 * 1e5) / 1e5;
        s.strategy.decisions.push({
          id: s.nextId++,
          kind: 'reprice',
          title: `${def.name} asks to reprice`,
          body: `Costs have risen ${Math.round((s.priceIndex - 1) * 100)}% since you started. ${def.name} says it is losing money on your ${MATERIALS[c.material].name.toLowerCase()} contract and wants ${money(ask)} a unit instead of ${money(c.price)}.`,
          options: [
            { id: 'accept', label: 'Agree the new price', detail: 'Its finances recover a little.' },
            { id: 'refuse', label: 'Hold them to the contract', detail: 'It weakens further, and may fail.' },
          ],
          fallback: 'refuse',
          site: def.id,
          data: { contract: c.id, price: ask },
        });
        feed(s, 'warn', `${def.name} wants to reprice its contract.`, def.id);
        break;
      }
    }
  }
  s.tenders = s.tenders.filter((t) => t.expires > s.day);

  // In an active crisis, one chance to ask for supplementary money.
  const c = s.crisis;
  if (c?.phase === 'active' && !s.supplemented.includes(c.id) && !s.strategy.decisions.some((d) => d.kind === 'supplement')) {
    s.supplemented.push(c.id);
    const amount = Math.round(s.appropriation * 1.5);
    const odds = Math.round(clamp(s.strategy.factions.hawks * 0.8 + 15, 10, 90));
    s.strategy.decisions.push({
      id: s.nextId++,
      kind: 'supplement',
      title: 'A supplementary budget?',
      body: `With the ${c.name} under way, you could ask the Committee for an emergency supplement of $${amount}M. The hawks will back you; the treasury bench will not like it.`,
      options: [
        { id: 'ask', label: `Ask for $${amount}M`, detail: `About ${odds}% odds. A refusal costs some confidence.` },
        { id: 'skip', label: 'Manage within budget', detail: 'The treasury bench approves.' },
      ],
      fallback: 'skip',
      value: amount,
      data: { qty: odds },
    });
    feed(s, 'info', 'You may ask for a supplementary budget. A decision is waiting.', undefined, true);
  }
}

/** Handles the economy's decision cards. Returns true when it handled one. */
export function resolveEconomy(s: SimState, kind: string, opt: string, d: { site?: string; value?: number; data?: { contract?: number; price?: number; qty?: number } }, feed: Feed): boolean {
  if (kind === 'reprice') {
    const c = s.contracts.find((x) => x.id === d.data?.contract);
    if (!c || !d.site) return true;
    const site = s.sites[d.site];
    if (opt === 'accept') {
      c.price = d.data?.price ?? c.price;
      site.health = clamp(site.health + 12);
      s.strategy.factions.industry = clamp(s.strategy.factions.industry + 2);
      feed(s, 'info', `New price agreed with ${SITE_BY_ID[d.site].name}.`, d.site);
    } else {
      site.health = clamp(site.health - 8);
      s.strategy.factions.treasury = clamp(s.strategy.factions.treasury + 1);
      feed(s, 'warn', `${SITE_BY_ID[d.site].name} is held to its contract price.`, d.site);
    }
    return true;
  }
  if (kind === 'supplement') {
    if (opt === 'ask') {
      if (rand(s) * 100 < (d.data?.qty ?? 50)) {
        s.treasury += d.value ?? 0;
        s.month.income.appropriation += d.value ?? 0;
        s.strategy.factions.treasury = clamp(s.strategy.factions.treasury - 4);
        feed(s, 'good', `The Committee grants a supplementary $${d.value}M.`, undefined, true);
      } else {
        s.confidence = clamp(s.confidence - 3);
        s.strategy.factions.treasury = clamp(s.strategy.factions.treasury - 2);
        feed(s, 'bad', 'The Committee turns down your supplementary request.', undefined, true);
      }
    } else s.strategy.factions.treasury = clamp(s.strategy.factions.treasury + 3);
    return true;
  }
  return false;
}

export const tenderDays = (months: 12 | 24 | 36) => months * DAYS_PER_MONTH;

registerResolver((s, d, opt, feed) => resolveEconomy(s, d.kind, opt, d, feed));
