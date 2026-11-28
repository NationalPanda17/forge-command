// Automation: a chief of staff who runs the areas you hand over, every week, within a money reserve you set and in the
// spirit of a stance you choose. The same rules recommend an answer to every decision card, answer budget hearings, and
// drive the test player used by the balance check.
import { applyInPlace, expandCost, investCost, qualifyCost, refurbishCost, repairCost, validate, type SimAction } from './actions';
import { scoreMonths } from './mandate';
import { replaceCost } from './scenarios';
import DEPTH from './tuning/depth.json';
import { prudentReserve } from './spending';

/** The chief of staff's supply planning (19.0.4). */
const AUTO = DEPTH.autopilot;
/** The autopilot's settings for this game's scenario (some scenarios override a few). */
const planFor = (s: SimState) => ({ ...AUTO, ...((AUTO.byScenario as Record<string, Partial<typeof AUTO>>)[s.scenario] ?? {}) });
/** The chief of staff on the home front (19.1). */
const HFA = HF.autopilot;
import { bottleneck, monthsTo, weakLinks } from './analytics';
import { routeByKey, routeCap } from './build';
import { cyberLevel, hasPlan } from './cyber';
import { HF } from './homefront';
import { COPROD_NEEDS, supplierNations } from './diplomacy';
import { GRID_REGIONS, contractPrice, regionPlants } from './energy';
import { requestOdds } from './hearings';
import { FOUNDABLE } from './industry';
import { DEVELOPMENTS } from './rival';
import { crewNeed, nationalStock, readiness, reserveTarget } from './selectors';
import { RESEARCH_IDS, STAFF_ROLE_IDS, newLineOf, type Decision } from './strategy';
import { hireRoom, townIndex, townOf } from './towns';
import { engineerNeed } from './engineers';
import { FORKS, doctrineCost, doctrineDef, forkOpen, type ForkId, type Side } from './doctrine';
import { MAX_LEVEL, matchCost, promoteCost } from './cast';

/** Which way each stance settles each doctrine. */
const STANCE_DOCTRINE: Record<Stance, Record<ForkId, Side>> = {
  balanced: { production: 'a', supply: 'a', workforce: 'b', reserves: 'a', rival: 'a' },
  stockpile: { production: 'a', supply: 'a', workforce: 'a', reserves: 'a', rival: 'a' },
  thrift: { production: 'a', supply: 'b', workforce: 'a', reserves: 'b', rival: 'b' },
  peace: { production: 'b', supply: 'a', workforce: 'b', reserves: 'a', rival: 'a' },
};
import type { SimState } from './types';
import { unionTowns } from './unions';
import { FINISHED, MATERIALS, RECIPES, SITES, SITE_BY_ID, type LineId } from './world';

export type AutoArea = 'staffing' | 'supply' | 'production' | 'research' | 'logistics' | 'decisions' | 'resilience' | 'community';
export type Stance = 'balanced' | 'stockpile' | 'thrift' | 'peace';

export const AUTO_AREAS: Record<AutoArea, { name: string; blurb: string }> = {
  decisions: { name: 'Decisions and hearings', blurb: 'Answers decision cards and budget hearings the way the advisor recommends.' },
  staffing: { name: 'Staffing and housing', blurb: 'Hires to each plant’s crew, builds homes where a town runs short, keeps apprentices and safety going.' },
  supply: { name: 'Supply contracts', blurb: 'Re-tenders contracts before they lapse, awards the cheapest dependable bid, qualifies second sources.' },
  production: { name: 'Production', blurb: 'Idles lines far above target, restarts them when stocks fall, expands ahead of shortages, funds starved suppliers.' },
  research: { name: 'Research and key staff', blurb: 'Keeps the engineers busy, counters to the rival first, and fills empty posts on the Board.' },
  logistics: { name: 'Depots and disposal', blurb: 'Fills the depot in a crisis region, refurbishes retired rounds, recycles rather than burns.' },
  resilience: { name: 'Power, cyber and security', blurb: 'Generators at the arsenals, cheap power contracts, basic cyber defences and backups, vetting, trade missions, an audit team.' },
  community: { name: 'Unions and towns', blurb: 'Funds towns that turn against you and offers a pay deal when unions grow strong.' },
};
export const AUTO_AREA_IDS = Object.keys(AUTO_AREAS) as AutoArea[];

export const STANCES: Record<Stance, { name: string; blurb: string }> = {
  balanced: { name: 'Balanced', blurb: 'A bit of everything.' },
  stockpile: { name: 'Stockpile first', blurb: 'Full racks above all: expands earlier, idles later, spends more freely.' },
  thrift: { name: 'Save money', blurb: 'Spends only when it must, trims overstock sooner, skips nice-to-haves.' },
  peace: { name: 'Keep the peace', blurb: 'Settles with unions and towns, avoids round-the-clock shifts and burning.' },
};

export interface AutomationState {
  areas: Record<AutoArea, boolean>;
  /** Money the staff never spend below, $M. */
  reserve: number;
  stance: Stance;
  /** What the staff did, newest last. */
  log: { day: number; area: AutoArea; text: string }[];
  /** Any area was ever handed over in this game. */
  assisted: boolean;
  /** Regions whose depot target the staff raised for a crisis. */
  raised?: string[];
}

export const newAutomation = (on: AutoArea[] = []): AutomationState => ({
  areas: Object.fromEntries(AUTO_AREA_IDS.map((a) => [a, on.includes(a)])) as Record<AutoArea, boolean>,
  reserve: 300,
  stance: 'balanced',
  log: [],
  assisted: on.length > 0,
});

/** The presets offered on the title screen. */
export const PRESETS = {
  off: [] as AutoArea[],
  assist: ['decisions', 'staffing', 'supply', 'research'] as AutoArea[],
  full: AUTO_AREA_IDS,
};

/** How each stance shifts the staff's thresholds. */
const TUNE: Record<Stance, { idleAt: number; restartAt: number; expandBelow: number; spend: number; peace: boolean }> = {
  balanced: { idleAt: 1.6, restartAt: 1.1, expandBelow: 1.2, spend: 1, peace: false },
  stockpile: { idleAt: 2.0, restartAt: 1.3, expandBelow: 1.5, spend: 0.8, peace: false },
  thrift: { idleAt: 1.3, restartAt: 1.0, expandBelow: 1.0, spend: 1.5, peace: false },
  peace: { idleAt: 1.6, restartAt: 1.1, expandBelow: 1.2, spend: 1, peace: true },
};

/** Money above the reserve, scaled by how freely the stance spends. */
const has = (s: SimState, reserve: number, stance: Stance, amount: number) => s.treasury > reserve + amount * TUNE[stance].spend;

// ---------- Recommendations ----------

/** The option the advisor recommends for a decision card, and why. */
export function recommend(s: SimState, d: Decision, stance: Stance = s.automation?.stance ?? 'balanced', reserve = s.automation?.reserve ?? 0): { option: string; why: string } {
  if (s.probation) reserve = 0;
  const ready = readiness(s);
  const rich = s.treasury > 400 + reserve;
  /** Can a paid option be afforded while keeping the reserve? */
  const afford = (cost: number) => s.treasury - cost >= reserve;
  const peace = TUNE[stance].peace;
  const hasOpt = (o: string) => d.options.some((x) => x.id === o);
  const pick = (option: string, why: string) => (hasOpt(option) ? { option, why } : { option: d.fallback, why: 'The default is the safest choice here.' });
  switch (d.kind) {
    case 'bailout': {
      // A supplier that is the country's only home source of something is saved whenever it can be (19.2): its loss
      // stops every line downstream for good.
      const sole = !!d.site && s.sites[d.site].processes.some((p) => {
        const out = RECIPES[p.recipe].output;
        return SITES.filter((x) => x.owner !== 'foreign' && x.id !== d.site && s.sites[x.id].status === 'active' && s.sites[x.id].processes.some((q) => RECIPES[q.recipe].output === out)).length === 0;
      });
      if (sole && afford(d.value ?? 0)) return pick('bail', 'It is the only home source of what it makes: losing it would stop every line downstream.');
      return rich && afford(d.value ?? 0) ? pick('bail', 'You can afford it, and losing a supplier hurts everything downstream.') : pick('let', 'Money is tight; a bailout would leave you short.');
    }
    case 'budget':
      return pick('push', 'The Committee often grants a firm request.');
    case 'reprice':
      return pick('accept', 'A supplier that fails costs you far more than a fair price.');
    case 'supplement':
      return pick('ask', 'A crisis is the best time to ask, and the hawks will back you.');
    case 'allyRequest':
      return ready > 0.85 ? pick('send', 'Your racks are full enough to help, and allies remember.') : pick('decline', 'Your own reserve is too thin to share.');
    case 'broker':
      // Grey-market rounds only when the racks are nearly empty: the premium and the risk are high.
      return ready < DEPTH.scenarios.sanctions.autoBrokerBelow && afford((d.data?.qty ?? 0) * (d.data?.price ?? 0) + 300) ? pick('buy', 'The racks are nearly empty; the risk is worth it.') : pick('pass', 'Not worth the premium or the risk while the racks hold.');
    case 'budgetRound': {
      // Take the package that eases the weakest goal of the year just gone.
      const last = s.history.slice(-12);
      const goals = last.length ? scoreMonths(s, last, Math.max(0, (d.value ?? 1) - 1)).goals : [];
      const weakest = [...goals].sort((a, b) => a.score - b.score)[0]?.id;
      // The Treasury's budget is a real cut: the chief of staff leaves that gamble to you.
      // The hawks' money comes with fuller racks expected: only worth it when readiness is comfortably met.
      const ready = goals.find((g) => g.id === 'readiness')?.score ?? 0;
      if (weakest === 'value' && ready >= 0.95) return pick('hawks', 'Value for money was the weakest goal, and the racks are full enough for the hawks’ terms.');
      if (weakest === 'stewardship') return pick('regions', 'Stewardship was the weakest goal: this budget weighs it less.');
      return pick('none', 'No package helps the weakest goal.');
    }
    case 'allyOffer':
      return ready < 0.7 && afford((d.data?.qty ?? 0) * (d.data?.price ?? 0) + 300) ? pick('buy', 'Readiness is low and you can afford quick rounds.') : pick('pass', ready < 0.7 ? 'You cannot afford them without eating into your reserve.' : 'You do not need them badly enough at that price.');
    case 'export':
      return ready > (stance === 'stockpile' ? 0.95 : 0.9) ? pick('accept', 'Your reserve can spare them, and the money is good.') : pick('decline', 'Every round is needed at home for now.');
    case 'labour':
      if (hasOpt('pay')) return (rich || peace) && afford(d.value ?? 0) ? pick('pay', 'Settling keeps the plant working and cools the union.') : pick('talk', 'A counter-offer may settle it for less.');
      if (hasOpt('agree')) return pick('agree', 'Rested crews are safer; a strike would cost more.');
      if (hasOpt('fund')) return (rich || peace) && afford(d.value ?? 0) ? pick('fund', 'Safer work and better morale, and no strike.') : { option: d.fallback, why: 'Money is tight; risk the dispute.' };
      return { option: d.fallback, why: 'The default.' };
    case 'recall':
      return afford(d.value ?? 0) ? pick('recall', 'Bad parts in the field are worse than the cost of a recall.') : pick('accept', 'Money is tight; accept the risk.');
    case 'inspection':
      return afford(d.value ?? 0) ? pick('fund', 'Back to work quickly, and the regions approve.') : pick('leave', 'Money is tight.');
    case 'ransom':
      return pick('rebuild', 'Paying invites the hackers back, and the hawks would hear of it.');
    case 'audit':
      return pick('accept', 'Candour costs less than a failed rebuttal.');
    case 'fraud':
      return pick('settle', 'Settling keeps the supplier, and the contract, going.');
    case 'permit':
      return afford(d.value ?? 0) ? pick('package', 'Winning the town over keeps it on side for years, and costs little.') : pick('override', 'You cannot spare even the package without eating into your reserve.');
    case 'spyRing':
      return pick('turn', 'Double agents buy you time against the rival.');
    case 'testFailure':
      return rich ? pick('fix', 'A fixed design passes sooner and is better in the field.') : { option: d.fallback, why: 'Money is tight; press on.' };
    case 'poach': {
      const m = d.site ? s.cast?.managers[d.site] : undefined;
      if (m && m.level < MAX_LEVEL && afford(promoteCost(s, m))) return pick('promote', 'A promotion keeps them and makes them better at the job.');
      if (m && afford(matchCost(s, m))) return pick('match', 'Experienced managers are hard to replace; matching is cheap.');
      return pick('release', 'Money is tight; the best candidate on the list can take over.');
    }
    default:
      return { option: d.fallback, why: 'The default.' };
  }
}

/** Answers for an open budget hearing, and the request to make. */
export function hearingPlan(s: SimState): SimAction[] {
  if (!s.hearing) return [];
  const ready = readiness(s);
  const out: SimAction[] = [];
  for (const q of s.hearing.questions) {
    if (s.hearing.answers[q.id]) continue;
    const safe = (o: (typeof q.options)[number]) => !o.promise || (o.promise.kind === 'readiness' && ready > 0.88) || (o.promise.kind === 'solvent' && s.treasury > 600) || (o.promise.kind === 'vetting' && s.treasury > 900);
    const best = [...q.options].filter(safe).sort((a, b) => Object.values(b.sway).reduce((x, y) => x + y, 0) - Object.values(a.sway).reduce((x, y) => x + y, 0))[0] ?? q.options.find((o) => o.id === q.fallback)!;
    out.push({ type: 'hearingAnswer', question: q.id, option: best.id });
  }
  out.push({ type: 'hearingRequest', level: requestOdds(s, 'bold') >= 0.45 ? 'bold' : 'modest' });
  return out;
}

// ---------- What each area would do ----------

/** The actions an area would take today, in order. */
export function proposals(s: SimState, area: AutoArea, reserve = s.automation?.reserve ?? 0, stance: Stance = s.automation?.stance ?? 'balanced'): SimAction[] {
  const acts: SimAction[] = [];
  const t = TUNE[stance];
  // On probation (19.1) the chief of staff spends the reserve: there is no later to save it for.
  if (s.probation) reserve = 0;
  const money = (amount: number) => has(s, reserve, stance, amount);
  const arsenals = SITES.filter((x) => x.kind === 'arsenal' && s.sites[x.id].processes.length && !s.sites[x.id].mothballed);
  switch (area) {
    case 'decisions':
      for (const d of s.strategy.decisions) acts.push({ type: 'decide', decision: d.id, option: recommend(s, d, stance, reserve).option });
      acts.push(...hearingPlan(s));
      break;
    case 'staffing':
      for (const def of arsenals) {
        const site = s.sites[def.id];
        const training = site.trainees.reduce((x, tr) => x + tr.count, 0);
        const short = Math.ceil(crewNeed(site) * 1.03 - site.workers - training);
        if (short > 0) {
          const room = hireRoom(s, townOf(def.id));
          if (room > 0) acts.push({ type: 'hire', site: def.id, count: Math.min(room, Math.ceil(short / 10) * 10) });
          if (room < short && !s.towns[townIndex(townOf(def.id))].building.length && money(50)) acts.push({ type: 'housing', town: townIndex(townOf(def.id)) });
        }
        if (site.safety < 2 && money(700)) acts.push({ type: 'safety', site: def.id });
        if (site.apprentices === 0) acts.push({ type: 'apprentices', site: def.id, perMonth: 10 });
        if (site.fatigue >= 50 || (t.peace && site.fatigue >= 30)) site.processes.forEach((p, i) => p.run === 'surge' && acts.push({ type: 'setRun', site: def.id, process: i, run: 'normal' }));
      }
      // Keep experienced managers who are restless: a promotion before a private firm calls.
      for (const [site, m] of Object.entries(s.cast?.managers ?? {})) if (m.level >= 2 && m.level < MAX_LEVEL && m.loyalty < 50 && money(promoteCost(s, m) + 100)) acts.push({ type: 'promoteManager', site });
      // Engineers: hire to the need, from whoever is looking; found an academy when the market runs dry.
      if (s.engineers) {
        // A buffer, so a new line or a research project does not leave the plants short.
        const gap = Math.ceil(engineerNeed(s).total * 1.05 + 6 - s.engineers.staff);
        const count = Math.min(gap, Math.floor(s.engineers.market));
        if (count >= 1 && money(count * 0.1)) acts.push({ type: 'hireEngineers', count });
        if (gap > s.engineers.market && s.engineers.academies.length < 2 && money(900)) {
          const town = arsenals.map((d) => townIndex(townOf(d.id))).find((x) => !s.engineers.academies.some((a) => a.town === x));
          if (town !== undefined) acts.push({ type: 'academy', town });
        }
      }
      break;
    case 'supply':
      for (const c of s.contracts) {
        if (c.endDay - s.day > 45 || s.tenders.some((x) => x.material === c.material)) continue;
        if (s.contracts.some((k) => k !== c && k.material === c.material && k.endDay - s.day > 45)) continue;
        acts.push({ type: 'openTender', material: c.material, perDay: c.perDay, months: 24 });
      }
      for (const tn of s.tenders) {
        const best = tn.bids.filter((b) => b.perDay > 0 && b.reliability >= 0.5).sort((a, b) => a.price - b.price)[0];
        if (best) acts.push({ type: 'awardTender', tender: tn.id, site: best.site });
      }
      if (money(400)) for (const def of SITES) if (def.owner === 'private' && !s.sites[def.id].qualified && s.sites[def.id].status !== 'closed') acts.push({ type: 'qualify', site: def.id });
      break;
    case 'production':
      for (const def of arsenals) {
        const site = s.sites[def.id];
        site.processes.forEach((p, i) => {
          const line = RECIPES[p.recipe].output as LineId;
          if (!FINISHED.includes(line)) return;
          const level = nationalStock(s, line) / Math.max(1, reserveTarget(s, line));
          if (level > t.idleAt && p.run !== 'idle') acts.push({ type: 'setRun', site: def.id, process: i, run: 'idle' });
          else if (level < t.restartAt && p.run === 'idle' && s.lines[line].unlocked) acts.push({ type: 'setRun', site: def.id, process: i, run: 'normal' });
          if (level < 0.6 && s.lines[line].unlocked && money(1500)) {
            const b = bottleneck(s, line);
            const recipe = b ? Object.keys(FOUNDABLE).find((r) => RECIPES[r].output === b.material) : undefined;
            if (recipe && SITES.filter((d) => d.owner !== 'state' && s.sites[d.id].processes.some((q) => q.recipe === recipe)).length <= 1) acts.push({ type: 'inhouse', site: def.id, recipe });
          }
          if (level < 0.6 && s.lines[line].unlocked && money(600)) {
            const b = bottleneck(s, line);
            const top = b?.top;
            if (top && SITE_BY_ID[top].owner === 'private') {
              const k = s.sites[top].processes.findIndex((q) => RECIPES[q.recipe].output === b!.material);
              if (k >= 0) acts.push({ type: 'invest', site: top, process: k });
            }
          }
          if (level > t.expandBelow) return;
          const soon = monthsTo(s, line, 0.85, 12) !== null || nationalStock(s, line) < reserveTarget(s, line) * 0.8;
          if (soon && money(500)) acts.push({ type: 'expand', site: def.id, process: i });
          // A line far below target expands at its real price with a margin (19.2): in later terms the chief of staff
          // rarely holds the fixed sum above, while land demand keeps growing with the rival's weapons.
          else if (level < AUTO.criticalBelow && money(expandCost(s, def.id, i) * AUTO.costMargin)) acts.push({ type: 'expand', site: def.id, process: i });
        });
        if (stance !== 'thrift' && money(1500)) site.processes.forEach((p, i) => !p.automated && p.run !== 'idle' && acts.push({ type: 'build', kind: 'automate', target: def.id, process: i }));
      }
      if (stance !== 'thrift' && money(1200))
        for (const [key, load] of Object.entries(s.routeLoad)) {
          const r = routeByKey(s, key);
          if (r && r.mode !== 'air' && load / routeCap(s, r) > 0.85) acts.push({ type: 'build', kind: 'upgrade', target: key });
        }
      // Supply planning (19.0.4): the materials the country cannot make enough of get more capacity at home, at their
      // biggest domestic maker, before the lines that need them run dry. A foreign maker may be the largest source, but
      // it can be banned and cannot be invested in, so the money goes to the home plant.
      // Under sanctions many links look short at once; the chief of staff concentrates on the worst.
      const plan = planFor(s);
      // What starves the worst lines comes first (19.2): a line far below target is traced to its tightest part.
      const starved = (Object.keys(s.lines) as LineId[])
        .filter((l) => s.lines[l].unlocked && reserveTarget(s, l) > 0 && nationalStock(s, l) < reserveTarget(s, l) * AUTO.criticalBelow)
        .map((l) => bottleneck(s, l)?.material)
        .filter((m): m is NonNullable<typeof m> => !!m && !FINISHED.includes(m));
      const weak = weakLinks(s).filter((x) => x.ratio < plan.investRatio).map((x) => x.material);
      for (const material of [...new Set([...starved, ...weak])].slice(0, plan.links)) {
        const home = SITES.filter((d) => d.owner !== 'foreign' && s.sites[d.id].status === 'active' && !s.sites[d.id].mothballed)
          .flatMap((d) => s.sites[d.id].processes.map((p, k) => ({ d, p, k })))
          .filter(({ p }) => RECIPES[p.recipe].output === material && p.expansions < AUTO.maxExpansions)
          .sort((a, b) => b.p.capacity - a.p.capacity)[0];
        if (!home) continue;
        // A maker your arsenals cannot buy from is qualified before it is grown.
        if (home.d.owner === 'private' && !s.sites[home.d.id].qualified) {
          if (!s.sites[home.d.id].qualifyingDays && money(qualifyCost(home.d.id) * AUTO.costMargin)) acts.push({ type: 'qualify', site: home.d.id });
          continue;
        }
        const type = home.d.owner === 'state' ? ('expand' as const) : ('invest' as const);
        const cost = type === 'expand' ? expandCost(s, home.d.id, home.k) : investCost(s, home.d.id, home.k);
        if (money(cost * AUTO.costMargin)) acts.push({ type, site: home.d.id, process: home.k });
      }
      break;
    case 'research':
      for (const role of STAFF_ROLE_IDS) {
        if (s.strategy.staff[role]) continue;
        const best = s.strategy.candidates.filter((c) => c.role === role).sort((a, b) => b.skill - a.skill)[0];
        if (best && money(best.salary * 3)) acts.push({ type: 'hireStaff', candidate: best.id });
      }
      // Doctrine: settle the next open fork the way the stance leans.
      if (s.doctrine && !s.doctrine.active) {
        const fork = FORKS.find((f) => !s.doctrine.chosen[f.id] && forkOpen(s, f.id));
        if (fork && money(doctrineCost(s, fork.id) + 250)) acts.push({ type: 'adoptDoctrine', fork: fork.id, side: STANCE_DOCTRINE[stance][fork.id] });
      }
      if (!s.strategy.research.active && money(300)) {
        const counter = s.rival.known.map((k) => DEVELOPMENTS[k.id].counter).find((r) => validate(s, { type: 'research', research: r }) === null);
        // A new line is opened only when the lines you have are not starving and its parts can be had (19.2):
        // a line nobody can supply sits far below target and drags readiness down for a whole term.
        const lineLevels = (Object.keys(s.lines) as LineId[]).filter((l) => s.lines[l].unlocked && reserveTarget(s, l) > 0).map((l) => nationalStock(s, l) / reserveTarget(s, l));
        const starving = lineLevels.some((v) => v < AUTO.criticalBelow);
        const supplied = (l: LineId) => (bottleneck(s, l)?.ratio ?? Infinity) >= planFor(s).newLineSupply;
        const next =
          counter ??
          RESEARCH_IDS.find((r) => {
            if (validate(s, { type: 'research', research: r }) !== null) return false;
            const line = newLineOf(r);
            return !line || (!starving && supplied(line));
          });
        if (next) acts.push({ type: 'research', research: next });
      }
      break;
    case 'logistics':
      if (s.policy.demilMethod !== 'recycle') acts.push({ type: 'setPolicy', policy: { demilMethod: 'recycle' } });
      for (const site of Object.values(s.sites)) for (const [l, q] of Object.entries(site.unserviceable)) if ((q ?? 0) >= 1 && l !== 'shell155' && site.id !== 'karrowDemil' && money(refurbishCost(l as LineId, q ?? 0))) acts.push({ type: 'refurbish', site: site.id, line: l as LineId });
      if (s.crisis && s.policy.depotDays[s.crisis.region] < 60) acts.push({ type: 'setPolicy', policy: { depotDays: { ...s.policy.depotDays, [s.crisis.region]: 60 } } });
      // Once a crisis is over, the depot the staff raised for it comes back down.
      for (const r of Object.keys(s.policy.depotDays) as (keyof typeof s.policy.depotDays)[])
        if (r !== 'central' && s.crisis?.region !== r && s.policy.depotDays[r] === 60 && s.automation?.raised?.includes(r)) acts.push({ type: 'setPolicy', policy: { depotDays: { ...s.policy.depotDays, [r]: r === 'isles' ? 45 : 30 } } });
      break;
    case 'resilience':
      // One national cyber level and one recovery plan (19.1).
      if (cyberLevel(s) < (money(1400) ? 2 : 1) && money(800)) acts.push({ type: 'cyberDefence', area: 'plants' });
      if (!hasPlan(s) && money(1000)) acts.push({ type: 'cyberBackups' });
      // A small intelligence service also hunts spies at home (19.1); the chief of staff runs no operations abroad.
      if (stance !== 'thrift' && (s.intel?.agency ?? 0) < HFA.agencyMax && (s.rival?.known.length ?? 0) >= HFA.agencyMinDevelopments && money(HFA.agencyMoney)) acts.push({ type: 'intelAgency' });
      if (money(700)) for (const def of arsenals) if (!s.energy.generators.includes(def.id)) acts.push({ type: 'generator', site: def.id });
      for (const r of GRID_REGIONS) if (regionPlants(s, r).length && contractPrice(s, r) < 1 && !s.energy.shock) acts.push({ type: 'powerContract', region: r });
      if (stance !== 'thrift' && !s.oversight.team && money(900)) acts.push({ type: 'auditTeam' });
      // Under sanctions (19.0c), missions win the bans off; otherwise they keep relations from sliding.
      for (const n of supplierNations()) {
        const banned = s.scenario === 'sanctions' && SITES.some((d) => d.nation === n && s.sites[d.id].embargoDays > 0);
        if (banned ? money(300) && s.diplomacy.nations[n] < 60 : money(900) && s.diplomacy.nations[n] < 45) acts.push({ type: 'tradeMission', who: n });
      }
      // On probation (19.1): rounds from allies are the quickest way back, so court them and co-produce the scarcest lines.
      if (s.probation) {
        const best = (['merrow', 'calder'] as const).slice().sort((a, b) => s.allies[b] - s.allies[a])[0];
        const low = (Object.keys(s.lines) as LineId[])
          .filter((l) => s.lines[l].unlocked && reserveTarget(s, l) > 0 && nationalStock(s, l) < reserveTarget(s, l) * 0.8 && !s.diplomacy.coprod.some((c) => c.line === l))
          .sort((a, b) => nationalStock(s, a) / reserveTarget(s, a) - nationalStock(s, b) / reserveTarget(s, b));
        if (s.allies[best] >= COPROD_NEEDS) for (const line of low.slice(0, 2)) acts.push({ type: 'coproduce', ally: best, line });
        else if (low.length) acts.push({ type: 'tradeMission', who: best });
      }
      // Rebuild (19.0c): replace the worst plants, refurbish the rest.
      if (s.rebuild)
        for (const d of SITES) {
          const site = s.sites[d.id];
          if (d.owner !== 'state' || !site.processes.length || site.status !== 'active' || s.rebuild.replacing[d.id]) continue;
          if (site.condition < DEPTH.scenarios.rebuild.autoReplaceBelow && !s.rebuild.replaced.includes(d.id) && money(replaceCost(repairCost(s, d.id)) + 200)) acts.push({ type: 'replacePlant', site: d.id });
          else if (site.condition < DEPTH.scenarios.rebuild.autoRepairBelow && money(repairCost(s, d.id) + 200)) acts.push({ type: 'repair', site: d.id });
        }
      if (money(900)) for (const def of arsenals) if ((s.sites[def.id].clearance ?? 0) < 2) acts.push({ type: 'vet', site: def.id });
      break;
    case 'community':
      // A resentful town hires less and hardens its union (19.1): the fund now reaches towns sooner.
      if (money(t.peace ? 400 : 800)) s.communities.mood.forEach((m, town) => m < HFA.fundBelow[stance] && acts.push({ type: 'communityFund', town }));
      if (money(400) && unionTowns(s).some((i) => s.unions.towns[i].strength >= (t.peace ? 55 : 70))) acts.push({ type: 'payDeal' });
      break;
  }
  return acts;
}

// ---------- The weekly round ----------

const LOG_MAX = 60;
/** Actions that never cost money up front: no need to try them on a copy. */
const FREE = new Set<SimAction['type']>(['setRun', 'apprentices', 'setPolicy', 'openTender', 'awardTender', 'hearingAnswer', 'hearingRequest', 'powerContract']);

/** A short line for the log when an action leaves nothing in the feed. */
function describe(s: SimState, a: SimAction): string {
  switch (a.type) {
    case 'setRun':
      return `${MATERIALS[RECIPES[s.sites[a.site].processes[a.process].recipe].output].name} at ${SITE_BY_ID[a.site].name}: ${a.run === 'idle' ? 'idled' : a.run === 'normal' ? 'back on two shifts' : a.run}.`;
    case 'hire':
      return `Hired ${a.count} at ${SITE_BY_ID[a.site].name}.`;
    case 'apprentices':
      return `Apprentices at ${SITE_BY_ID[a.site].name}: ${a.perMonth} a month.`;
    case 'setPolicy':
      return a.policy.demilMethod ? `Old rounds will be ${a.policy.demilMethod === 'recycle' ? 'recycled' : 'burned'}.` : 'Depot targets changed for the crisis.';
    case 'decide':
      return 'Answered a decision.';
    case 'hearingAnswer':
      return 'Answered a question at the budget hearing.';
    case 'hearingRequest':
      return `Made the budget request: ${a.level === 'bold' ? '15% more' : a.level === 'modest' ? '6% more' : a.level === 'lean' ? '5% less' : 'the provisional figure'}.`;
    case 'openTender':
      return `Opened a tender for ${MATERIALS[a.material].name.toLowerCase()}.`;
    case 'awardTender':
      return `Awarded a contract to ${SITE_BY_ID[a.site].name}.`;
    case 'research':
      return 'Started a research project.';
    case 'expand':
    case 'invest':
      return `Ordered new capacity at ${SITE_BY_ID[a.site].name}.`;
    case 'adoptDoctrine':
      return `Committed to a doctrine: ${doctrineDef(a.fork, a.side).name.toLowerCase()}.`;
    case 'promoteManager':
      return `Promoted ${s.cast.managers[a.site]?.name ?? 'the manager'} at ${SITE_BY_ID[a.site].name}.`;
    default:
      return 'Done.';
  }
}

export const automationOn = (s: SimState) => !!s.automation && !s.hotseat && AUTO_AREA_IDS.some((a) => s.automation.areas[a]);

/** The chief of staff's round: each area handed over acts, within the reserve. Runs weekly, and at once for hearings. */
export function automationDay(s: SimState): void {
  if (!automationOn(s) || s.over || s.tutorial) return;
  // A story briefing is read before anything is done.
  if (s.story?.briefing !== null && s.story?.briefing !== undefined) return;
  const weekly = s.day % 7 === 0;
  for (const area of AUTO_AREA_IDS) {
    if (!s.automation.areas[area]) continue;
    // Decisions and hearings are answered as soon as they appear; everything else once a week.
    if (!weekly && !(area === 'decisions' && (s.hearing || s.strategy.decisions.length))) continue;
    for (const a of proposals(s, area)) {
      if (validate(s, a)) continue;
      // Anything that might cost money is tried on a copy first: the staff never take the treasury below the reserve.
      if (!FREE.has(a.type)) {
        const trial = structuredClone(s);
        applyInPlace(trial, a);
        // The reserve grows with the running gap (20.1), so the staff do not take on costs the budget cannot carry.
        if (trial.treasury < s.treasury && trial.treasury < prudentReserve(s, s.automation.reserve)) continue;
      }
      const lastBefore = s.feed[s.feed.length - 1];
      if (!applyInPlace(s, a)) continue;
      if (a.type === 'setPolicy' && a.policy.depotDays && s.crisis && a.policy.depotDays[s.crisis.region] === 60) s.automation.raised = [...new Set([...(s.automation.raised ?? []), s.crisis.region])];
      const last = s.feed[s.feed.length - 1];
      s.automation.log.push({ day: s.day, area, text: last !== lastBefore && last ? last.text : describe(s, a) });
    }
  }
  if (s.automation.log.length > LOG_MAX) s.automation.log.splice(0, s.automation.log.length - LOG_MAX);
}

export function validateAutomation(s: SimState, a: { type: string; area?: AutoArea; on?: boolean; reserve?: number; stance?: Stance }): string | null {
  if (s.hotseat) return 'Not in a two-player game: each director runs their own half.';
  if (s.tutorial) return 'Not in the tutorial: it is there to teach you the job.';
  if (a.type === 'automate') return a.area! in AUTO_AREAS ? null : 'No such area.';
  if (a.type === 'automationReserve') return Number.isFinite(a.reserve) && a.reserve! >= 0 && a.reserve! <= 5000 ? null : 'Between $0 and $5,000M.';
  if (a.type === 'automationStance') return a.stance! in STANCES ? null : 'No such stance.';
  return null;
}

export function applyAutomation(s: SimState, a: { type: string; area?: AutoArea; on?: boolean; reserve?: number; stance?: Stance }): void {
  if (a.type === 'automate') {
    s.automation.areas[a.area!] = !!a.on;
    if (a.on && s.mode === 'campaign') s.automation.assisted = true;
  } else if (a.type === 'automationReserve') s.automation.reserve = Math.round(a.reserve!);
  else if (a.type === 'automationStance') s.automation.stance = a.stance!;
}
