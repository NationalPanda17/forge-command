// One simulated day. advanceDays never mutates its input.
import CORE from './tuning/core.json';
import { BASE_LINES, CHEAP, CRISES, LAND_DRAW, LAND_LINES, PREMIUM, THREATS, THREAT_IDS } from './fight';
import { pathBetween } from './graph';
import { clamp, pick, rand, randInt, randRange } from './rng';
import {
  DAYS_PER_MONTH,
  nationalStock,
  reserveTarget,
  baseDailyDraw,
  crewNeed,
  inbound,
  inGrace,
  inputRates,
  isLine,
  lotQty,
  processRate,
  readiness,
  regionBases,
  regionDailyDraw,
} from './selectors';
import { emptyMonth } from './setup';
import { fightScale, mandateConfidence, recordMandateMonth } from './mandate';
import { economyMonth, priceNow } from './economy';
import { legCapFactor, livingDay, livingMonth, plantSeasonFactor } from './living';
import { buildDay } from './build';
import { setNetwork } from './graph';
import { writeEdition } from './news';
import { absorbHires, peopleDay, peopleMonth, skillScrap } from './people';
import { rivalArrivals, rivalDay, rivalLand, rivalMonth, rivalPk, rivalShots } from './rival';
import { hasPolicy, policyMonth, programmeMonth } from './commitments';
import { industryDay, variantOf } from './industry';
import { storyDay } from './story';
import { applyWorld } from './worldgen';
import { threatShare } from './features';
import { pressure, scenarioDay, scenarioMonth } from './scenarios';
import { resolveSecurity, securityMonth } from './security';
import { townsDay, townsMonth } from './towns';
import { accepted, resolveTesting, testingDay, testingMonth } from './testing';
import { hotseatMonth } from './hotseat';
import { banFactor, diplomacyMonth } from './diplomacy';
import { closeStaleHearing, openHearing, promisesMonth } from './hearings';
import { cyberDay, cyberMonth, resolveCyber } from './cyber';
import { unionsMonth, wageOf } from './unions';
import { POWER_SHARE, energyDay, energyMonth, intensityOf, powerFactor, powerPrice, supplierEnergyFactor } from './energy';
import { FRAUD_MARKUP, addWaste, oversightMonth, resolveOversight } from './audit';
import { communitiesMonth, resolveCommunity, type Permit } from './communities';
import { automationDay } from './automation';
import { engineerFactor, engineersMonth } from './engineers';
import { intelDay, intelMonth } from './intelops';
import { doctrineBan, doctrineDay, doctrineFreight, doctrineMonth, doctrinePrice, doctrineRate, doctrineRunning, doctrineScrap, doctrineShelf } from './doctrine';
import { castMonth, managerOutput, managerScrap, resolvePoach } from './cast';
import { foundCost } from './industry';
import { expireDecisions, hasResearch, recipeInputs, recipeScrap, registerResolver, skillOf, strategyDay, strategyMonth } from './strategy';
import type { FeedItem, Lot, MonthReport, SimState, SiteState, ThreatId } from './types';
import { FIGHTING_REGIONS, MATERIALS, RECIPES, REGIONS, SITES, SITE_BY_ID, type LineId, type MaterialId, type RegionId } from './world';

const round3 = (v: number) => Math.round(v * 1000) / 1000;
// Tuning lives in src/sim/tuning/core.json (18.1).
const WAGE_PER_DAY = CORE.economy.wagePerMonth / 30;
const SPOT_PREMIUM = CORE.economy.spotPremium;
const STATE_BUFFER_DAYS = CORE.economy.stateBufferDays;
const PRIVATE_BUFFER_DAYS = CORE.economy.privateBufferDays;
/** Producers stop when this many days of output sit unsold. */
const MAX_OUTPUT_DAYS = CORE.economy.maxOutputDays;
const DEMIL_SITE = 'karrowDemil';
const DEMIL_TPD = CORE.economy.demilTonnesPerDay;
/** How hard the world pushes back, by difficulty. */
export const DIFF: Record<'easy' | 'normal' | 'hard', { events: number; crisis: number; ramp: number }> = CORE.difficulty.world;
/** Minimum ready rounds a base keeps of each type it can fire. */
/** How often things go wrong: difficulty times the sandbox setting. */
export const eventScale = (s: SimState) => DIFF[s.difficulty].events * (s.settings?.events ?? 1);

// Decision cards from modules that strategy itself loads are registered here, once everything has loaded.
registerResolver((s, d, opt, feed) => resolvePoach(s, d, opt, feed) || resolveSecurity(s, d, opt, feed) || resolveTesting(s, d, opt, feed) || resolveCyber(s, d, opt, feed) || resolveOversight(s, d, opt, feed) || resolveCommunity(s, d, opt, feed, (p) => withdrawPermit(s, p)));

/** Withdrawing a project a town objected to: undo it and return 80% of the money. */
function withdrawPermit(s: SimState, p: Permit): number {
  if (p.kind === 'plant') {
    const site = s.sites[p.target];
    const recipe = site.processes[0]?.recipe;
    const back = recipe ? foundCost(s, recipe) * 0.8 : 0;
    site.processes = [];
    site.status = 'closed';
    site.extraCrew = 0;
    site.plantKind = undefined;
    site.plantName = undefined;
    // Anyone hired for it is let go, the spur is never laid, and the credit for founding it goes too.
    site.workers = 0;
    site.trainees = [];
    s.network.built = s.network.built.filter((k) => k !== `plot-${p.target}`);
    setNetwork(s.network.built, s.network.upgrades);
    s.strategy.factions.regions = clamp(s.strategy.factions.regions - 3);
    s.strategy.factions.industry = clamp(s.strategy.factions.industry - 2);
    if (s.story?.counts.founded) s.story.counts.founded--;
    return back;
  }
  const proj = s.network.projects.find((x) => x.id === p.project);
  s.network.projects = s.network.projects.filter((x) => x.id !== p.project);
  s.strategy.factions.regions = clamp(s.strategy.factions.regions - 1.5);
  return proj ? proj.cost * 0.8 : 0;
}

export const MIN_BASE_ROUNDS: Partial<Record<LineId, number>> = CORE.baseMinimumRounds;

export function feed(s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert = false): void {
  const item: FeedItem = alert ? { day: s.day, tone, text, site, alert: true } : { day: s.day, tone, text, site };
  s.feed.push(item);
  if (s.feed.length > 300) s.feed.splice(0, s.feed.length - 300);
  if (alert) {
    s.alert = item;
    (s.alerts ??= []).push(item);
    // Remembered for the term report.
    const m = (s.moments ??= []);
    m.push({ day: s.day, tone, text });
    if (m.length > 400) m.splice(0, m.length - 400);
  }
}

// ---------- Lots ----------

// Lots live in their own module so that testing and the world events can use them without loading the tick.
export { addLots, takeLots } from './lots';
import { addLots, takeLots } from './lots';

function stockOf(site: SiteState, m: MaterialId): number {
  return isLine(m) ? lotQty(site.lots[m]) : site.stock[m] ?? 0;
}

// ---------- Production ----------

function produce(s: SimState): void {
  // Your plants' engineers: worked out once a day, not for every line.
  const engineers = engineerFactor(s);
  for (const site of Object.values(s.sites)) {
    const def = SITE_BY_ID[site.id];
    const foreign = def.owner === 'foreign';
    if (foreign && site.embargoDays > 0) {
      for (const p of site.processes) p.lastLimit = 'damaged';
      continue;
    }
    for (const p of site.processes) {
      const rec = RECIPES[p.recipe];
      if (p.run === 'idle') {
        p.lastOutput = 0;
        p.lastLimit = 'idle';
        continue;
      }
      let want = processRate(s, site, p) * plantSeasonFactor(s, p.recipe) * powerFactor(s, site) * (def.owner === 'state' ? engineers * doctrineRate(s, p.recipe) * managerOutput(s, site.id) : 1);
      let limit: typeof p.lastLimit = site.status !== 'active' ? 'damaged' : 'capacity';
      if (def.owner === 'state' && crewNeed(site) > site.workers * 1.02) limit = 'crew';
      // Private producers stop when nobody is buying.
      // Unless a by-product (gallium from the smelter) is still wanted.
      const extraWanted = Object.entries(rec.extra ?? {}).some(([m, q]) => (site.stock[m as MaterialId] ?? 0) < p.capacity * (q ?? 0) * MAX_OUTPUT_DAYS);
      if (def.owner !== 'state' && !isLine(rec.output) && !extraWanted && (site.stock[rec.output] ?? 0) > p.capacity * MAX_OUTPUT_DAYS) {
        want = 0;
        limit = 'demand';
      }
      const scrap = recipeScrap(s, p.recipe, def.owner) * (def.owner === 'state' ? (1 - 0.1 * skillOf(s, 'quality')) * skillScrap(site) * (p.automated ? 0.8 : 1) * doctrineScrap(s, p.recipe, !!p.automated) * managerScrap(s, site.id) : 1);
      const inputs = recipeInputs(s, p.recipe);
      const gross = want / (1 - scrap);
      let frac = 1;
      if (!foreign) {
        for (const [m, q] of Object.entries(inputs) as [MaterialId, number][]) {
          const need = gross * q;
          if (need <= 0) continue;
          const have = site.stock[m] ?? 0;
          if (have < need && have / need < frac) {
            frac = have / need;
            limit = m;
          }
        }
        for (const [m, q] of Object.entries(inputs) as [MaterialId, number][]) site.stock[m] = Math.max(0, (site.stock[m] ?? 0) - gross * frac * q);
      }
      const made = want * frac + p.partial;
      const whole = isLine(rec.output) ? Math.floor(made + 1e-9) : made;
      p.partial = made - whole;
      p.lastOutput = round3(whole);
      p.lastLimit = limit;
      if (whole <= 0) continue;
      if (isLine(rec.output)) addLots(site, rec.output, [{ qty: whole, made: s.day, until: s.day + Math.round(MATERIALS[rec.output].shelfDays * variantOf(s, rec.output).shelf * (def.owner === 'state' ? doctrineShelf(s) : 1)) }]);
      else site.stock[rec.output] = (site.stock[rec.output] ?? 0) + whole;
      for (const [m, q] of Object.entries(rec.extra ?? {}) as [MaterialId, number][]) site.stock[m] = (site.stock[m] ?? 0) + gross * frac * q;
      s.month.made[rec.output] = (s.month.made[rec.output] ?? 0) + whole;
      if (def.owner === 'state') {
        const po = (s.month.plantOutput ??= {});
        po[site.id] = (po[site.id] ?? 0) + whole * MATERIALS[rec.output].price * s.priceIndex;
      }
      // Wear: surging wears plants down; normal running holds steady.
      if (def.owner === 'state') site.condition = clamp(site.condition + (p.run === 'surge' ? -0.12 : p.run === 'single' ? 0.04 : 0.02));
    }
  }
}

// ---------- Logistics ----------

interface Request {
  to: string;
  material: MaterialId;
  qty: number;
  state: boolean;
}

function requests(s: SimState): Request[] {
  const out: Request[] = [];
  for (const site of Object.values(s.sites)) {
    const def = SITE_BY_ID[site.id];
    if (def.owner === 'foreign' || site.status === 'closed') continue;
    const state = def.owner === 'state';
    // Production inputs.
    const rates = inputRates(s, site);
    const days = state ? STATE_BUFFER_DAYS : PRIVATE_BUFFER_DAYS;
    for (const [m, rate] of Object.entries(rates) as [MaterialId, number][]) {
      if (rate <= 0) continue;
      const target = rate * days;
      const have = (site.stock[m] ?? 0) + inbound(s, site.id, m);
      if (have < target * 0.7) out.push({ to: site.id, material: m, qty: target - have, state });
    }
    // Finished rounds: bases pull from their regional depot; regional depots from the centre; the centre from the arsenals.
    const lines = BASE_LINES[def.kind];
    if (lines) {
      for (const line of lines) {
        const rate = baseDailyDraw(s, site.id, line);
        if (rate <= 0) continue;
        // Every launcher needs a few ready rounds, however rarely it fires.
        const target = Math.max(rate * s.policy.baseDays, MIN_BASE_ROUNDS[line] ?? 4);
        const have = lotQty(site.lots[line]) + inbound(s, site.id, line);
        if (have < target * 0.6) out.push({ to: site.id, material: line, qty: Math.min(target - have, Math.max(rate * 7, MIN_BASE_ROUNDS[line] ?? 4)), state: true });
      }
    }
    if (def.kind === 'depot' && site.id !== 'depotCentral') {
      const region = def.region as RegionId;
      for (const line of Object.keys(s.lines) as LineId[]) {
        const rate = regionDailyDraw(s, region, line);
        if (rate <= 0) continue;
        const target = Math.max(rate * s.policy.depotDays[region], (MIN_BASE_ROUNDS[line] ?? 4) * 2);
        const have = lotQty(site.lots[line]) + inbound(s, site.id, line);
        // Restock in daily slices so a big target does not jam the railways.
        if (have < target * 0.7) out.push({ to: site.id, material: line, qty: Math.min(target - have, rate * 7), state: true });
      }
    }
    if (site.id === 'depotCentral') {
      for (const a of SITES.filter((x) => x.kind === 'arsenal')) {
        for (const line of Object.keys(s.sites[a.id].lots) as LineId[]) {
          // New rounds stay at the arsenal until they pass their test firings.
          if (!accepted(s, line)) continue;
          const q = lotQty(s.sites[a.id].lots[line]);
          if (q >= 1) out.push({ to: site.id, material: line, qty: q, state: true });
        }
      }
    }
  }
  return out;
}

/** Where a request may be filled from, nearest first. */
function sources(s: SimState, req: Request): string[] {
  const to = SITE_BY_ID[req.to];
  if (isLine(req.material)) {
    if (to.kind === 'depot' && req.to === 'depotCentral') return SITES.filter((x) => x.kind === 'arsenal').map((x) => x.id);
    if (to.kind === 'depot') return ['depotCentral'];
    const regional = REGIONS[to.region].depot;
    return [regional, 'depotCentral'];
  }
  const out: string[] = [];
  for (const def of SITES) {
    if (def.id === req.to) continue;
    const makes = s.sites[def.id].processes.some((p) => RECIPES[p.recipe].output === req.material || RECIPES[p.recipe].extra?.[req.material]);
    if (!makes) continue;
    const st = s.sites[def.id];
    if (def.owner === 'foreign' && st.embargoDays > 0) continue;
    if (req.state && !st.qualified) continue;
    if (req.state && def.owner === 'foreign' && hasPolicy(s, 'buyDomestic')) continue;
    out.push(def.id);
  }
  return out;
}

function dispatch(s: SimState, from: string, to: string, m: MaterialId, qty: number): number {
  const path = pathBetween(from, to);
  if (!path) return 0;
  const w = MATERIALS[m].weight;
  // Route capacity left today.
  let room = Infinity;
  const capMult = 1 + 0.08 * skillOf(s, 'logistics');
  let prev = from;
  for (const leg of path.legs) {
    room = Math.min(room, (leg.cap * capMult * legCapFactor(s, prev, leg.to, leg.mode) - (s.routeLoad[leg.key] ?? 0)) / Math.max(1e-9, w));
    prev = leg.to;
  }
  qty = Math.min(qty, Math.max(0, room));
  if (!isLine(m)) qty = Math.floor(qty * 1000) / 1000;
  else qty = Math.floor(qty);
  if (qty <= 0) return 0;
  for (const leg of path.legs) s.routeLoad[leg.key] = (s.routeLoad[leg.key] ?? 0) + qty * w;
  const src = s.sites[from];
  let lots: Lot[] | undefined;
  if (isLine(m)) lots = takeLots(src, m, qty);
  else src.stock[m] = Math.max(0, (src.stock[m] ?? 0) - qty);
  const congested = path.legs.some((l) => l.mode === 'sea') && s.sites.portHalvard && SITE_BY_ID[from].owner === 'foreign' && s.sites[from].disruptionDays > 0;
  s.shipments.push({
    id: s.nextId++,
    from,
    to,
    material: m,
    qty,
    lots,
    depart: s.day,
    arrive: s.day + path.days + (congested ? 7 : 0),
    path: [from, ...path.legs.map((l) => l.to)],
    modes: path.legs.map((l) => l.mode),
  });
  const toState = SITE_BY_ID[to].owner === 'state';
  // Parts your own plants send to private companies are sold at the list price.
  if (!toState && SITE_BY_ID[from].owner === 'state' && !isLine(m)) {
    const sale = qty * priceNow(s, m);
    s.treasury += sale;
    s.month.income.sales += sale;
  }
  if (toState) {
    const freight = qty * w * path.costPerT * s.priceIndex * (1 - 0.1 * skillOf(s, 'logistics')) * doctrineFreight(s);
    s.month.spend.transport += freight;
    s.treasury -= freight;
    if (SITE_BY_ID[from].owner !== 'state') {
      const k = s.contracts.find((c) => c.site === from && c.material === m && c.endDay > s.day);
      const skill = 1 - 0.04 * skillOf(s, 'procurement');
      // Without a contract you pay the spot premium, and the supplier passes on its power bill.
      const spot = priceNow(s, m) * supplierEnergyFactor(s, from);
      const price = (k ? k.price * (k.fraud ? 1 + FRAUD_MARKUP : 1) : spot * SPOT_PREMIUM) * skill * doctrinePrice(s, SITE_BY_ID[from].owner === 'foreign');
      s.treasury -= qty * price;
      s.month.spend.purchases += qty * price;
      if (SITE_BY_ID[from].owner === 'foreign') s.month.foreign = (s.month.foreign ?? 0) + qty * price;
      if (!k) addWaste(s, 'spot', qty * spot * (SPOT_PREMIUM - 1) * skill);
      else if (k.fraud) {
        const extra = qty * k.price * FRAUD_MARKUP * skill;
        k.overbilled = (k.overbilled ?? 0) + extra;
        addWaste(s, 'fraud', extra);
      }
    }
  }
  return qty;
}

function logistics(s: SimState): void {
  // Arrivals.
  const here = s.shipments.filter((sh) => sh.arrive <= s.day);
  s.shipments = s.shipments.filter((sh) => sh.arrive > s.day);
  for (const sh of here) {
    const site = s.sites[sh.to];
    if (sh.to === DEMIL_SITE && isLine(sh.material)) {
      site.unserviceable[sh.material] = (site.unserviceable[sh.material] ?? 0) + sh.qty;
      continue;
    }
    if (isLine(sh.material)) addLots(site, sh.material, sh.lots ?? [{ qty: sh.qty, made: s.day, until: s.day + MATERIALS[sh.material].shelfDays }]);
    else site.stock[sh.material] = (site.stock[sh.material] ?? 0) + sh.qty;
  }
  // Requests: your arsenals and depots first (contracts give priority), then private industry.
  // Shuffle so no site always gets first pick of scarce parts, then serve your sites before private industry.
  const all = requests(s);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  const reqs = all.sort((a, b) => Number(b.state) - Number(a.state));
  // Contracted supply is reserved for your sites first.
  const reserved: Record<string, number> = {};
  // Live contracts, and each regional depot's draw, worked out once for the day rather than in every comparison (18.2).
  const contracted = new Set<string>();
  for (const c of s.contracts)
    if (c.endDay > s.day) {
      reserved[`${c.site}|${c.material}`] = c.perDay * 3;
      contracted.add(`${c.site}|${c.material}`);
    }
  const draws = new Map<string, number>();
  const drawOf = (region: RegionId, m: LineId) => {
    const k = `${region}|${m}`;
    let v = draws.get(k);
    if (v === undefined) draws.set(k, (v = regionDailyDraw(s, region, m)));
    return v;
  };
  for (const req of reqs) {
    let left = req.qty;
    const cands = sources(s, req)
      .map((id) => ({ id, path: pathBetween(id, req.to), k: contracted.has(`${id}|${req.material}`) ? 0 : 1 }))
      .filter((c) => c.path)
      .sort((a, b) => a.k - b.k || a.path!.days - b.path!.days);
    for (const c of cands) {
      if (left <= 1e-6) break;
      const src = s.sites[c.id];
      let avail = stockOf(src, req.material);
      if (!req.state) avail -= reserved[`${c.id}|${req.material}`] ?? 0;
      if (SITE_BY_ID[c.id].kind === 'depot' && c.id !== 'depotCentral') {
        // Regional depots keep half their target for their own bases.
        const region = SITE_BY_ID[c.id].region as RegionId;
        avail -= drawOf(region, req.material as LineId) * s.policy.depotDays[region] * 0.5;
      }
      if (avail <= 1e-6) continue;
      left -= dispatch(s, c.id, req.to, req.material, Math.min(left, avail));
    }
  }
  // Retired rounds go to the demilitarization facility.
  for (const site of Object.values(s.sites)) {
    if (site.id === DEMIL_SITE) continue;
    for (const [line, q] of Object.entries(site.unserviceable) as [LineId, number][]) {
      if (q < 1) continue;
      const path = pathBetween(site.id, DEMIL_SITE);
      if (!path) continue;
      site.unserviceable[line] = 0;
      s.shipments.push({ id: s.nextId++, from: site.id, to: DEMIL_SITE, material: line, qty: q, lots: [{ qty: q, made: -99999, until: -99999 }], depart: s.day, arrive: s.day + path.days, path: [site.id, ...path.legs.map((l) => l.to)], modes: path.legs.map((l) => l.mode) });
    }
  }
}

// ---------- The fight ----------

const sround = (s: SimState, v: number) => {
  const f = Math.floor(v);
  return f + (rand(s) < v - f ? 1 : 0);
};

function crisisMult(s: SimState, t: ThreatId, region: RegionId): number {
  const c = s.crisis;
  if (!c || c.phase !== 'active' || c.family !== 'air') return 1;
  const e = ((c.mix[t] ?? 1) - 1) * c.intensity;
  return 1 + e * (c.region === region ? 2.5 : 0.3);
}

function landMult(s: SimState, region: RegionId): number {
  const c = s.crisis;
  if (!c || c.phase !== 'active' || c.family !== 'land') return 1;
  return 1 + 0.8 * c.intensity * (c.region === region ? 1.6 : 0.3);
}

export interface DayFight {
  leakSeverity: number;
  landShort: number;
}

function fight(s: SimState): DayFight {
  let leakSeverity = 0;
  let landShort = 0;
  for (const region of FIGHTING_REGIONS) {
    const bases = regionBases(region, 'air');
    for (const t of THREAT_IDS) {
      const th = THREATS[t];
      const arriving = sround(s, (th.calmMonthly / DAYS_PER_MONTH) * threatShare(s, region, REGIONS[region].threatShare) * pressure(s, region, 'air') * crisisMult(s, t, region) * rivalArrivals(s, t) * randRange(s, 0.8, 1.2));
      // High-power microwave stops some drones before anything is fired.
      const passive = t === 'drone' && hasResearch(s, 'hpm') ? Math.round(arriving * 0.2) : 0;
      const n = arriving - passive;
      if (passive) {
        s.month.arrived[t] += passive;
        s.month.stopped[t] += passive;
      }
      if (n <= 0 || !bases.length) continue;
      const base = s.sites[pick(s, bases)];
      const kindLines = BASE_LINES[SITE_BY_ID[base.id].kind] ?? [];
      const chain = th.assign.filter((a) => s.lines[a.line].unlocked && kindLines.includes(a.line) && !(s.policy.conserve && CHEAP.includes(t) && PREMIUM.includes(a.line)));
      const weighted = chain.filter((a) => a.weight > 0);
      const wsum = weighted.reduce((a, x) => a + x.weight, 0);
      const perThreat = th.shots * rivalShots(s, t);
      const shotsNeeded = n * perThreat;
      let remaining = shotsNeeded;
      let stopped = 0;
      const fire = (line: LineId, want: number) => {
        const lots = takeLots(base, line, Math.max(0, want));
        const shots = lots.reduce((a, l) => a + l.qty, 0);
        if (shots <= 0) return;
        remaining -= shots;
        const pk = Math.min(0.97, (th.assign.find((a) => a.line === line)?.pk ?? 0.5) * rivalPk(s, t, line) * variantOf(s, line).pk);
        const killed = Math.min(shots / perThreat, (shots / perThreat) * pk * randRange(s, 0.92, 1.06));
        stopped += killed;
        s.month.fired[line] = (s.month.fired[line] ?? 0) + shots;
        s.month.interceptorSpend += shots * MATERIALS[line].price;
        s.month.threatValueStopped += killed * th.estCost;
      };
      for (const a of weighted) fire(a.line, sround(s, (shotsNeeded * a.weight) / wsum));
      for (const a of chain) if (remaining > 0.5) fire(a.line, Math.ceil(remaining - 0.5));
      stopped = Math.min(n, stopped);
      const leaked = n - stopped;
      s.month.arrived[t] += n;
      s.month.stopped[t] += stopped;
      s.month.leaked[t] += leaked;
      leakSeverity += leaked * th.severity;
      if (leaked >= 1 && th.severity >= 1) feed(s, 'bad', `${Math.round(leaked)} ${th.name.toLowerCase()}${Math.round(leaked) > 1 ? 's' : ''} got through over ${REGIONS[region].name}.`, base.id);
    }
    // Land fires. The region's shortfall is the average over the lines it fires, so adding a line never multiplies it.
    const arty = regionBases(region, 'land');
    let shortSum = 0;
    let shortLines = 0;
    for (const line of LAND_LINES) {
      if (!s.lines[line].unlocked || !arty.length) continue;
      const want = sround(s, ((LAND_DRAW[line] ?? 0) / DAYS_PER_MONTH) * REGIONS[region].landShare * pressure(s, region, 'land') * landMult(s, region) * (line === 'shell155' && hasResearch(s, 'smartFuzes') ? 0.85 : 1) * rivalLand(s, line) * randRange(s, 0.85, 1.15));
      if (want <= 0) continue;
      let got = 0;
      for (const b of arty) {
        const lots = takeLots(s.sites[b], line, (want - got) / 1);
        got += lots.reduce((a, l) => a + l.qty, 0);
        if (got >= want) break;
      }
      s.month.fired[line] = (s.month.fired[line] ?? 0) + got;
      if (!inGrace(s, line)) {
        shortSum += Math.max(0, want - got) / want;
        shortLines++;
      }
    }
    if (shortLines) landShort += shortSum / shortLines;
  }
  return { leakSeverity, landShort };
}

// ---------- Lifecycle: ageing, surveillance, demilitarization ----------

function lifecycle(s: SimState): void {
  const ranges = SITES.filter((x) => x.kind === 'testRange').length;
  let testsLeft = ranges * 2;
  for (const site of Object.values(s.sites)) {
    for (const line of Object.keys(site.lots) as LineId[]) {
      const lots = site.lots[line]!;
      for (const lot of lots) {
        // Surveillance: sample lots nearing the end of their certified life.
        if (s.policy.surveillance && testsLeft > 0 && (lot.ext ?? 0) < 2 && lot.until - s.day < 120 && lot.until > s.day && lot.qty >= 3) {
          testsLeft--;
          const sample = Math.max(1, Math.round(lot.qty * 0.01));
          lot.qty -= sample;
          s.month.spend.operations += sample * MATERIALS[line].price * 0.08;
          s.treasury -= sample * MATERIALS[line].price * 0.08;
          // Older lots fail more often; a lot can be extended twice at most.
          if (rand(s) < 0.9 - 0.15 * (lot.ext ?? 0)) {
            lot.until += 365;
            lot.ext = (lot.ext ?? 0) + 1;
            if (lot.qty > 20) feed(s, 'good', `Surveillance firings pass: ${Math.round(lot.qty)} ${MATERIALS[line].name} at ${SITE_BY_ID[site.id].name} certified for another year.`, site.id);
          } else {
            lot.until = s.day;
            feed(s, 'warn', `Surveillance firings fail: a lot of ${Math.round(lot.qty)} ${MATERIALS[line].name} at ${SITE_BY_ID[site.id].name} is condemned.`, site.id, lot.qty > 50);
          }
        }
      }
      const expired = lots.filter((l) => l.until <= s.day);
      if (expired.length) {
        const q = expired.reduce((a, l) => a + l.qty, 0);
        site.lots[line] = lots.filter((l) => l.until > s.day);
        site.unserviceable[line] = (site.unserviceable[line] ?? 0) + q;
        s.month.retired += q;
      }
    }
  }
  // Demilitarization: burn or recycle what has arrived at Karrow.
  const demil = s.sites[DEMIL_SITE];
  let tonnes = DEMIL_TPD * (demil.status === 'active' ? 1 : 0);
  for (const line of Object.keys(demil.unserviceable) as LineId[]) {
    if (tonnes <= 0) break;
    const w = MATERIALS[line].weight;
    const q = Math.min(demil.unserviceable[line] ?? 0, tonnes / w);
    if (q <= 0) continue;
    demil.unserviceable[line] = (demil.unserviceable[line] ?? 0) - q;
    tonnes -= q * w;
    s.month.demilled += q;
    const t = q * w;
    if (s.policy.demilMethod === 'recycle' || hasPolicy(s, 'greenDemil')) {
      const clean = hasResearch(s, 'cleanDemil');
      const cost = t * 0.006 * (clean ? 0.67 : 1);
      const back = t * 0.0025 * (clean ? 2 : 1);
      s.treasury += back - cost;
      s.month.spend.demil += cost;
      s.month.income.sales += back;
    } else {
      s.treasury -= t * 0.0015;
      s.month.spend.demil += t * 0.0015;
    }
  }
}

// ---------- World events and the calendar ----------

function world(s: SimState): void {
  // Crises.
  if (!s.crisis) {
    if (s.settings.crises && s.day > (s.scenario === 'tutorial' ? 420 : 90) && rand(s) < (0.08 * DIFF[s.difficulty].crisis) / DAYS_PER_MONTH) {
      const c = pick(s, CRISES);
      s.crisis = { id: c.id, name: c.name, region: c.region, family: c.family, phase: 'warning', days: 60, intensity: Math.round(randRange(s, 0.8, 1.3) * 100) / 100, mix: { ...c.mix } };
      feed(s, 'warn', `Intel: tension rising over the ${c.name} (${REGIONS[c.region].name}). Expect heavy fighting there in about two months. Stock the depot now.`, REGIONS[c.region].depot, true);
    }
  } else {
    s.crisis.days--;
    if (s.crisis.days <= 0) {
      if (s.crisis.phase === 'warning') {
        s.crisis.phase = 'active';
        s.crisis.days = randInt(s, 120, 300);
        feed(s, 'bad', `Crisis: the ${s.crisis.name} has begun.`, REGIONS[s.crisis.region].depot, true);
      } else {
        feed(s, 'good', `The ${s.crisis.name} has wound down.`);
        s.supplemented = s.supplemented.filter((x) => x !== s.crisis!.id);
        s.crisis = null;
      }
    }
  }
  // Disruptions anywhere in the chain.
  for (const site of Object.values(s.sites)) {
    const def = SITE_BY_ID[site.id];
    if (site.disruptionDays > 0) {
      site.disruptionDays--;
      if (site.disruptionDays === 0) {
        site.disruptionFactor = 1;
        feed(s, 'good', `${def.name} is back to normal output.`, site.id);
      }
    }
    if (site.embargoDays > 0) {
      site.embargoDays--;
      if (site.embargoDays === 0) feed(s, 'good', `Export ban on ${def.name} lifted.`, site.id);
    }
    if (site.qualifyingDays !== null) {
      site.qualifyingDays--;
      if (site.qualifyingDays <= 0) {
        site.qualifyingDays = null;
        site.qualified = true;
        feed(s, 'good', `${def.name} is qualified to supply your arsenals.`, site.id, true);
      }
    }
    for (const p of site.processes) {
      const step = ((0.08 * DIFF[s.difficulty].ramp) / DAYS_PER_MONTH) * (hasPolicy(s, 'warmBase') ? 1.5 : 1);
      if (p.maturity < 1) p.maturity = Math.min(1, p.maturity + step);
      if (p.ramp?.length) {
        for (const r of p.ramp) r.maturity = Math.min(1, r.maturity + step);
        for (const r of p.ramp.filter((x) => x.maturity >= 1)) p.capacity += r.cap;
        p.ramp = p.ramp.filter((x) => x.maturity < 1);
      }
    }
    if (site.trainees.length) {
      for (const t of site.trainees) t.days -= 1 / (1 - 0.15 * skillOf(s, 'labor'));
      const finished = site.trainees.filter((t) => t.days <= 0);
      const done = finished.reduce((a, t) => a + t.count, 0);
      site.trainees = site.trainees.filter((t) => t.days > 0);
      if (done) {
        absorbHires(site, done, finished.filter((t) => t.apprentice).reduce((a, t) => a + t.count, 0));
        site.workers += done;
        feed(s, 'good', `${done} trainees qualify at ${def.name}.`, site.id);
      }
    }
    if (s.day < 60 || !site.processes.length) continue;
    const hardened = s.network.hardened.includes(site.id);
    if (def.owner !== 'state' && site.disruptionDays === 0 && rand(s) < (0.025 * eventScale(s) * (hardened ? 0.4 : 1)) / DAYS_PER_MONTH) {
      site.disruptionDays = Math.round(randInt(s, 20, 90) * (hardened ? 0.6 : 1));
      site.disruptionFactor = Math.round(randRange(s, hardened ? 0.5 : 0.2, hardened ? 0.8 : 0.6) * 100) / 100;
      const kinds = ['An explosion and fire', 'A major equipment failure', 'Flooding', 'A strike'];
      feed(s, 'bad', `${pick(s, kinds)} at ${def.name}: output down to ${Math.round(site.disruptionFactor * 100)}% for about ${Math.round(site.disruptionDays / 7)} weeks.`, site.id, true);
    }
    if (def.owner === 'foreign' && site.embargoDays === 0 && rand(s) < (0.015 * eventScale(s) * banFactor(s, def.nation) * doctrineBan(s)) / DAYS_PER_MONTH) {
      site.embargoDays = randInt(s, 90, 300);
      feed(s, 'bad', `Export ban: the ${def.nation} halts shipments from ${def.name}.`, site.id, true);
    }
  }
}

function payDaily(s: SimState): void {
  let ops = 0;
  let power = 0;
  let idleCost = 0;
  for (const site of Object.values(s.sites)) {
    const def = SITE_BY_ID[site.id];
    if (def.owner !== 'state' || site.status === 'closed') continue;
    ops += (site.workers + site.trainees.reduce((a, t) => a + t.count, 0)) * WAGE_PER_DAY * wageOf(s, site.id);
    // A mothballed plant keeps only a caretaker's upkeep; an idle line still pays for power and maintenance.
    const idle = site.mothballed ? 0.05 : 0.3;
    // A line's running cost: maintenance and materials, plus power by how hungry the plant is, at its grid's price.
    const kw = POWER_SHARE * intensityOf(site) * powerPrice(s, def.region) * (s.energy?.grids[def.region].outage > 0 && s.energy.generators.includes(site.id) ? 2 : 1);
    for (const p of site.processes) {
      const value = p.capacity * MATERIALS[RECIPES[p.recipe].output].price;
      const run = p.run === 'idle' ? idle : p.run === 'surge' ? 1.35 : 1;
      ops += value * (0.12 - POWER_SHARE) * run;
      power += value * kw * run;
      if (p.run === 'idle' && !site.mothballed) idleCost += value * (0.12 - POWER_SHARE + kw) * run;
    }
  }
  const scale = s.priceIndex * (hasPolicy(s, 'warmBase') ? 1.06 : 1) * doctrineRunning(s);
  ops *= scale;
  power *= scale;
  s.treasury -= ops + power;
  s.month.spend.operations += ops;
  s.month.spend.energy = (s.month.spend.energy ?? 0) + power;
  addWaste(s, 'idle', idleCost * scale);
}

function closeMonth(s: SimState, fightTotals: { leakSeverity: number; landShort: number }): void {
  const ready = readiness(s);
  // This month's readiness, for checks that run before the month is filed (the 'Full racks' objective).
  s.month.readiness = Math.round(ready * 100) / 100;
  const before = s.confidence;
  expireDecisions(s, feed);
  closeStaleHearing(s, feed);
  strategyMonth(s, feed, { readiness: ready, excessLeaks: Math.max(0, fightTotals.leakSeverity - 2.5), burned: s.policy.demilMethod === 'burn' ? s.month.demilled : 0 });
  economyMonth(s, feed);
  livingMonth(s, feed);
  peopleMonth(s, feed);
  programmeMonth(s, feed);
  policyMonth(s);
  securityMonth(s, feed);
  townsMonth(s, feed);
  testingMonth(s, feed);
  diplomacyMonth(s, feed);
  cyberMonth(s, feed);
  unionsMonth(s);
  promisesMonth(s, feed);
  energyMonth(s, feed);
  oversightMonth(s, feed);
  communitiesMonth(s, feed);
  engineersMonth(s, feed);
  doctrineMonth(s);
  castMonth(s, feed);
  intelMonth(s);
  rivalMonth(s);
  scenarioMonth(s, feed);
  // The fiscal year ends in a hearing before the Committee.
  // No hearing in the term's last month: the Committee will judge you at the end instead.
  // An endless sandbox has no last month, so it never skips a hearing (its nominal end date is only a placeholder).
  if ((s.history.length + 1) % 12 === 0 && (s.settings.endless || s.day < s.days)) openHearing(s, s.appropriation, feed);
  // The Committee expects three-quarters of a year's reserve, and judges leakers beyond the usual handful.
  // Each later term, the Committee expects a little more.
  // The Committee judges the whole mandate now, not readiness alone (docs/mandate.md §5); empty racks still cost
  // confidence on their own, through the readiness floor.
  recordMandateMonth(s);
  const judged = mandateConfidence(s, ready);
  const parts = {
    readiness: judged.floor,
    mandate: judged.mandate,
    // A scenario can judge the fighting more leniently (Rebuild: a thin reserve the Committee knows about).
    leaks: -Math.min(10, Math.max(0, fightTotals.leakSeverity - 2) * 0.5) * fightScale(s),
    // landShort sums each day's shortfall fraction: average it over the month.
    land: -Math.min(8, (fightTotals.landShort / DAYS_PER_MONTH) * 4) * fightScale(s),
    debt: s.treasury < 0 ? -(1 + -s.treasury / 400) : 0,
    other: 0,
  };
  const dc = parts.readiness + parts.mandate + parts.leaks + parts.land + parts.debt;
  // Everything else this month: factions, objectives, decisions, events.
  parts.other = s.confidence - before;
  s.confidence = clamp(s.confidence + dc);
  s.month.why = Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, Math.round(v * 10) / 10])) as typeof parts;
  s.month.readiness = Math.round(ready * 100) / 100;
  s.month.confidence = Math.round(s.confidence * 10) / 10;
  s.month.treasury = Math.round(s.treasury * 100) / 100;
  s.month.priceIndex = s.priceIndex;
  s.month.stock = {};
  s.month.target = {};
  for (const l of Object.keys(s.lines) as LineId[]) {
    if (!s.lines[l].unlocked) continue;
    s.month.stock[l] = Math.round(nationalStock(s, l));
    s.month.target[l] = Math.round(reserveTarget(s, l));
  }
  s.news.push({ month: s.month.month, headlines: writeEdition(s, s.month, s.history.at(-1)) });
  if (s.news.length > 24) s.news.splice(0, s.news.length - 24);
  s.history.push(s.month);
  compactHistory(s.history);
  hotseatMonth(s, feed);
  s.month = emptyMonth(s.history.length);
  s.treasury += s.appropriation;
  s.month.income.appropriation = s.appropriation;
  s.contracts = s.contracts.filter((c) => c.endDay > s.day);
  if (s.confidence <= 0 && s.settings.dismissal) {
    s.over = true;
    s.outcome = 'dismissed';
    feed(s, 'bad', 'The Defence Committee has lost confidence in you. You are dismissed.', undefined, true);
  }
}

/**
 * Keeps a long game's save small. Two years back, a month's figures are rounded to two decimals (charts cannot show
 * more); ten years back, the per-plant breakdown goes. The list keeps one entry per month, since its length is the
 * month count.
 */
export function compactHistory(h: MonthReport[]): void {
  // Past months are shared between successive states (see advanceDays), so they are replaced, never changed in place.
  const round = (v: unknown): unknown => {
    if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
    if (v && typeof v === 'object' && !Array.isArray(v)) return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, round(x)]));
    return v;
  };
  const i = h.length - 25;
  if (h[i]) h[i] = round(h[i]) as MonthReport;
  const j = h.length - 121;
  if (h[j]?.plantOutput) {
    const { plantOutput: _drop, ...rest } = h[j];
    void _drop;
    h[j] = rest as MonthReport;
  }
}

function stepDay(s: SimState): void {
  s.day++;
  s.routeLoad = {};
  world(s);
  strategyDay(s, feed);
  livingDay(s, feed);
  buildDay(s, feed);
  rivalDay(s, feed);
  industryDay(s, feed);
  scenarioDay(s, feed);
  cyberDay(s, feed);
  energyDay(s, feed);
  intelDay(s, feed);
  doctrineDay(s, feed);
  townsDay(s, feed);
  testingDay(s, feed);
  peopleDay(s, feed, eventScale(s));
  produce(s);
  logistics(s);
  const f = fight(s);
  // The month's fighting is kept in the month itself, so it survives actions, saves and repeated steps.
  s.month.fightLeak = (s.month.fightLeak ?? 0) + f.leakSeverity;
  s.month.fightLand = (s.month.fightLand ?? 0) + f.landShort;
  lifecycle(s);
  payDaily(s);
  if (s.day % DAYS_PER_MONTH === 0) closeMonth(s, { leakSeverity: s.month.fightLeak ?? 0, landShort: s.month.fightLand ?? 0 });
  // A dismissed director gets no new chapter: its briefing would open over the term report with nothing to answer.
  if (!s.over) storyDay(s, feed);
  // The chief of staff's round, for any areas handed over.
  automationDay(s);
  if (!s.over && !s.settings.endless && s.day >= s.days) {
    s.over = true;
    s.outcome = 'complete';
    feed(s, 'info', 'Your term as Director is over.', undefined, true);
  }
}

/** Something the player must deal with before time moves on: a budget hearing, a hot-seat handover or a story briefing. */
export const onHold = (s: SimState) => !!s.hearing || !!s.hotseat?.handover || (s.story?.briefing !== null && s.story?.briefing !== undefined);

/** Advances the simulation by n days. Never mutates its input. Stops early on game over, and (for the live clock) when a hold begins. */
export function advanceDays(prev: SimState, n = 1, opts?: { stopOnHold?: boolean }): SimState {
  if (prev.over || (opts?.stopOnHold && onHold(prev))) return prev;
  applyWorld(prev.world ?? null);
  // The history, the log, the Courier and the term's moments only ever grow, and a filed entry is never changed (it is
  // replaced when compacted), so the new state shares their entries and copies only the list. Everything else is
  // copied whole. This was most of the cost of a day in a long game (18.2).
  const { history, feed: log, news, moments, ...live } = prev;
  const s = structuredClone(live) as SimState;
  s.history = history.slice();
  s.feed = log.slice();
  s.news = news.slice();
  if (moments) s.moments = moments.slice();
  s.alert = null;
  s.alerts = [];
  setNetwork(s.network.built, s.network.upgrades);
  for (let i = 0; i < n && !s.over; i++) {
    stepDay(s);
    if (opts?.stopOnHold && onHold(s)) break;
  }
  return s;
}

/** Credits the first month's appropriation (call once on a new game). */
export function openCampaign(s: SimState): SimState {
  const c = structuredClone(s);
  c.treasury += c.appropriation;
  c.month.income.appropriation = c.appropriation;
  feed(c, 'info', 'Day one. The national reserve is old and thin, and the Committee is watching.');
  return c;
}
