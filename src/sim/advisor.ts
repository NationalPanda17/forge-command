// The advisor: the next best things to do, ranked, each with the action that does it where there is one.
import { apply, validate, type SimAction } from './actions';
import { AUDIT_LIMITS, REVIEW_MONTHS, counted, wasteSince } from './audit';
import { MOOD_WORD, communityTowns, permitHeld } from './communities';
import { attackOdds } from './cyber';
import { GRID_REGIONS, blackoutOdds, regionPlants } from './energy';
import { unionTowns } from './unions';
import type { Stance } from './automation';
import { balances, bottleneck, forecast, monthsTo } from './analytics';
import { liveRoutes, routeCap } from './build';
import { DEVELOPMENTS, COUNTER_NAMES } from './rival';
import { crewNeed, nationalStock, reserveTarget } from './selectors';
import { RESEARCH, RESEARCH_IDS } from './strategy';
import type { SimState } from './types';
import { controlBlock } from './hotseat';
import { hireRoom, townIndex, townOf } from './towns';
import { academyCost, academyTowns, coverage, engineerNeed } from './engineers';
import { OPS, opCost, opOdds } from './intelops';
import { CITIES, FINISHED, MATERIALS, REGIONS, RECIPES, ROUTE_KEY, SITES, SITE_BY_ID, type LineId, type MaterialId } from './world';

export type AdvicePanel = 'staff' | 'strategy' | 'markets' | 'build' | 'plan' | 'logistics' | 'site' | 'intel' | 'programmes' | 'towns' | 'power' | 'money' | 'allies';

export interface Advice {
  id: string;
  /** Higher first. */
  priority: number;
  tone: 'bad' | 'warn' | 'info';
  title: string;
  why: string;
  action?: SimAction;
  panel?: AdvicePanel;
  site?: string;
  material?: MaterialId;
  /** What doing it costs, and the catch. */
  tradeoff?: string;
}

/** The catch with each kind of action, beyond its price. */
const CATCH: Partial<Record<SimAction['type'], string>> = {
  hire: 'Trainees take about three months to pull their weight.',
  research: 'It ties up your engineers until it is done.',
  invest: 'New capacity ramps up over several months.',
  expand: 'New capacity ramps up over several months, and needs more crew.',
  setPolicy: 'Rounds held in a regional depot are rounds not held elsewhere.',
  openTender: 'Bids take a few weeks to come in.',
  awardTender: 'A contract locks the price, and the supplier, for its term.',
  housing: 'Homes take about five months to build.',
  generator: 'While it runs in a blackout, the plant pays double for power.',
  powerContract: 'It locks today’s price for two years, whether the market falls or rises.',
  payDeal: 'Pay stays 3% higher for good.',
  communityFund: 'Each town can be given one every six months.',
  cyberDefence: 'It does nothing until the hackers come.',
  vet: 'Crews grumble a little at the intrusion.',
  safety: 'It takes money now for fewer accidents later.',
  setRun: 'Fewer shifts mean fewer rounds; more shifts mean tired crews.',
  tradeMission: 'Relations drift back toward neutral over time.',
};

/** How a stance reorders the advice: stockpiling favours rounds, saving money favours cheap fixes, peace favours people. */
function stanceBoost(stance: Stance, a: Advice): number {
  const t = a.action?.type;
  if (stance === 'stockpile') return /^(line-|fund-(?!town)|tender-|award-|depot)/.test(a.id) || t === 'expand' || t === 'invest' ? 8 : 0;
  if (stance === 'thrift') return t === 'expand' || t === 'invest' || t === 'build' || t === 'generator' || t === 'cyberDefence' || t === 'communityFund' ? -10 : /^(over|tender|award|audit)/.test(a.id) ? 6 : 0;
  if (stance === 'peace') return t === 'payDeal' || t === 'communityFund' || t === 'safety' || /^(rest|fund-town|housing)/.test(a.id) ? 10 : 0;
  return 0;
}

/** What an action would cost, found by trying it on a copy. */
function costOf(s: SimState, a: SimAction): number {
  if (validate(s, a)) return 0;
  return Math.max(0, s.treasury - apply(s, a).treasury);
}

const money = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}B` : v >= 1 ? `$${Math.round(v)}M` : `$${Math.round(v * 1000)}K`);

const ok = (s: SimState, a: SimAction) => validate(s, a) === null;

export function advise(s: SimState, limit = 6): Advice[] {
  if (s.over) return [];
  const out: Advice[] = [];
  // In a two-player game, advice about the other director's plants is theirs to act on.
  const stance: Stance = s.automation?.stance ?? 'balanced';
  const add = (a: Advice) => {
    const site = a.site ?? (a.action && 'site' in a.action ? (a.action.site as string) : undefined);
    if (controlBlock(s, site)) return;
    a.priority += stanceBoost(stance, a);
    out.push(a);
  };
  const bal = balances(s);

  if (s.strategy.decisions.length) add({ id: 'decisions', priority: 95, tone: 'warn', title: `Answer ${s.strategy.decisions.length} decision${s.strategy.decisions.length > 1 ? 's' : ''}`, why: 'Unanswered cards take their default at month end, and the default is rarely the best.', panel: 'strategy' });

  // The rival: counter what is coming before it arrives.
  for (const k of s.rival?.known ?? []) {
    const d = DEVELOPMENTS[k.id];
    if (s.strategy.research.done.includes(d.counter) || s.strategy.research.active?.id === d.counter) continue;
    const a: SimAction = { type: 'research', research: d.counter };
    const soon = k.fielded - s.day;
    add({ id: `counter-${k.id}`, priority: soon <= 0 ? 90 : 80, tone: soon <= 0 ? 'bad' : 'warn', title: `Research ${COUNTER_NAMES[d.counter]}`, why: `${d.name} ${soon <= 0 ? 'are in the field' : `arrive in about ${Math.ceil(soon / 30)} month${soon > 30 ? 's' : ''}`}. ${d.effect}`, action: ok(s, a) ? a : undefined, panel: 'intel' });
  }

  // Rounds heading for trouble: fix the tightest link under them.
  for (const line of FINISHED as LineId[]) {
    if (!s.lines[line].unlocked || reserveTarget(s, line) <= 0) continue;
    const when = monthsTo(s, line, 0.5, 9);
    const level = nationalStock(s, line) / reserveTarget(s, line);
    if (when === null && level >= 0.5) continue;
    const b = bottleneck(s, line, bal);
    const name = MATERIALS[line].name;
    const urgency = when === null ? 70 : 88 - when * 2;
    if (b && b.material !== line && b.top && SITE_BY_ID[b.top].owner === 'private') {
      const k = s.sites[b.top].processes.findIndex((p) => RECIPES[p.recipe].output === b.material);
      const a: SimAction = { type: 'invest', site: b.top, process: k };
      add({ id: `fund-${line}`, priority: urgency, tone: 'bad', title: `Fund ${SITE_BY_ID[b.top].name}`, why: `${name} ${when ? `falls below half of target in ${when} months` : 'is below half of target'}, and ${MATERIALS[b.material].name.toLowerCase()} is the tightest link under it (${Math.round(b.ratio * 100)}% of demand).`, action: k >= 0 && ok(s, a) ? a : undefined, site: b.top, material: b.material });
    } else {
      const arsenal = SITES.find((d) => d.owner === 'state' && d.processes.some((p) => p.recipe === line));
      const idx = arsenal ? s.sites[arsenal.id].processes.findIndex((p) => p.recipe === line) : -1;
      const p = arsenal ? s.sites[arsenal.id].processes[idx] : undefined;
      const a: SimAction | undefined = arsenal && p ? (p.run === 'idle' || p.run === 'single' ? { type: 'setRun', site: arsenal.id, process: idx, run: 'normal' } : { type: 'expand', site: arsenal.id, process: idx }) : undefined;
      add({ id: `line-${line}`, priority: urgency, tone: 'bad', title: arsenal && p && (p.run === 'idle' || p.run === 'single') ? `Put ${name} back on two shifts` : `Expand the ${name} line`, why: `${name} ${when ? `falls below half of target in ${when} months` : 'is below half of target'}, and the arsenal line itself is the limit.`, action: a && ok(s, a) ? a : undefined, site: arsenal?.id, material: line });
    }
  }

  // Overstock eats shared parts.
  for (const line of FINISHED as LineId[]) {
    if (!s.lines[line].unlocked || reserveTarget(s, line) <= 0) continue;
    if (nationalStock(s, line) < reserveTarget(s, line) * 2) continue;
    const f = forecast(s, line, 6);
    if (f[6].stock < f[6].target * 1.6) continue;
    const arsenal = SITES.find((d) => d.owner === 'state' && d.processes.some((p) => p.recipe === line));
    if (!arsenal) continue;
    const idx = s.sites[arsenal.id].processes.findIndex((p) => p.recipe === line);
    if (s.sites[arsenal.id].processes[idx].run === 'idle') continue;
    const a: SimAction = { type: 'setRun', site: arsenal.id, process: idx, run: 'single' };
    add({ id: `over-${line}`, priority: 55, tone: 'info', title: `Drop ${MATERIALS[line].name} to one shift`, why: `It is above twice target and still rising, eating motors, warheads and seekers other rounds need.`, action: ok(s, a) ? a : undefined, site: arsenal.id, material: line });
  }

  // Contracts about to lapse; bids waiting.
  for (const c of s.contracts) {
    const left = c.endDay - s.day;
    if (left > 45 || s.contracts.some((k) => k !== c && k.material === c.material && k.endDay > c.endDay) || s.tenders.some((t) => t.material === c.material)) continue;
    const a: SimAction = { type: 'openTender', material: c.material, perDay: c.perDay, months: 24 };
    add({ id: `tender-${c.id}`, priority: 75 - left / 3, tone: 'warn', title: `Tender for ${MATERIALS[c.material].name.toLowerCase()}`, why: `The contract with ${SITE_BY_ID[c.site].name} ends in ${left} days. After that you pay 30% over list.`, action: ok(s, a) ? a : undefined, panel: 'markets', material: c.material });
  }
  for (const t of s.tenders) {
    const best = t.bids.filter((b) => b.perDay > 0 && b.reliability >= 0.5).sort((a, b) => a.price - b.price)[0];
    if (!best) continue;
    const a: SimAction = { type: 'awardTender', tender: t.id, site: best.site };
    add({ id: `award-${t.id}`, priority: 78, tone: 'warn', title: `Award ${MATERIALS[t.material].name.toLowerCase()} to ${SITE_BY_ID[best.site].name}`, why: `The cheapest dependable bid: $${best.price.toFixed(4)}M a unit, ${Math.round(best.reliability * 100)}% reliability.`, action: a, panel: 'markets' });
  }

  // Your plants and people.
  for (const def of SITES.filter((d) => d.owner === 'state' && (d.crew > 0 || s.sites[d.id].extraCrew > 0) && s.sites[d.id].processes.length && s.sites[d.id].status !== 'closed')) {
    const site = s.sites[def.id];
    const training = site.trainees.reduce((a, t) => a + t.count, 0);
    const short = Math.ceil(crewNeed(site) - site.workers - training);
    if (short > 20 && !site.mothballed) {
      const town = townOf(def.id);
      const room = hireRoom(s, town);
      const count = Math.min(Math.ceil(short / 10) * 10, room);
      if (count >= 10) {
        const a: SimAction = { type: 'hire', site: def.id, count };
        const capped = count < short ? ` ${town} can supply only ${room} more; build housing there for the rest.` : '';
        add({ id: `hire-${def.id}`, priority: 72, tone: 'warn', title: `Hire ${a.count} at ${def.name}`, why: `It is ${short} people short, counting those in training. Training takes about three months.${capped}`, action: ok(s, a) ? a : undefined, site: def.id });
      } else if (!s.towns[townIndex(town)]?.building.length && !out.some((o) => o.id === `housing-${town}`)) {
        const a: SimAction = { type: 'housing', town: townIndex(town) };
        add({ id: `housing-${town}`, priority: 70, tone: 'warn', title: `Build housing in ${town}`, why: `${def.name} is ${short} people short, and ${town} has no one left to hire. New homes take about five months.`, action: ok(s, a) ? a : undefined, site: def.id });
      }
    }
    if (site.fatigue >= 50) {
      const i = site.processes.findIndex((p) => p.run === 'surge');
      if (i >= 0) add({ id: `rest-${def.id}`, priority: 68, tone: 'warn', title: `Rest the crews at ${def.name}`, why: `Fatigue is ${Math.round(site.fatigue)}. Tired crews have accidents.`, action: { type: 'setRun', site: def.id, process: i, run: 'normal' }, site: def.id });
    }
    if (site.morale < 45 && site.safety < 3) {
      const a: SimAction = { type: 'safety', site: def.id };
      add({ id: `safety-${def.id}`, priority: 60, tone: 'warn', title: `Safety programme at ${def.name}`, why: `Morale is ${Math.round(site.morale)}. Below 50 it slows work, and unhappy plants are where disputes start.`, action: ok(s, a) ? a : undefined, site: def.id });
    }
  }

  // A crisis on the way: fill the depot.
  if (s.crisis) {
    const r = s.crisis.region;
    if (s.policy.depotDays[r] < 60) add({ id: 'depot', priority: 85, tone: 'warn', title: `Raise the ${REGIONS[r].name} depot target`, why: `The ${s.crisis.name} ${s.crisis.phase === 'warning' ? 'is coming' : 'is under way'}. Sixty days of stock keeps the bases fed.`, action: { type: 'setPolicy', policy: { depotDays: { ...s.policy.depotDays, [r]: 60 } } }, panel: 'logistics' });
  }

  // Idle engineers.
  if (!s.strategy.research.active) {
    const counter = (s.rival?.known ?? []).map((k) => DEVELOPMENTS[k.id].counter).find((r) => ok(s, { type: 'research', research: r }));
    const next = counter ?? RESEARCH_IDS.find((r) => ok(s, { type: 'research', research: r }));
    if (next) add({ id: 'research', priority: 50, tone: 'info', title: `Start ${RESEARCH[next].name}`, why: `Your engineers are idle. ${RESEARCH[next].effect}`, action: { type: 'research', research: next }, panel: 'strategy' });
  }

  // Money in the bank and a jammed route.
  if (s.treasury > s.appropriation * 6) {
    const jam = liveRoutes(s)
      .filter((r) => r.mode !== 'air')
      .map((r) => ({ r, key: ROUTE_KEY(r.a, r.b), use: (s.routeLoad[ROUTE_KEY(r.a, r.b)] ?? 0) / routeCap(s, r) }))
      .sort((a, b) => b.use - a.use)[0];
    if (jam && jam.use > 0.85) {
      const a: SimAction = { type: 'build', kind: 'upgrade', target: jam.key };
      if (ok(s, a)) add({ id: 'upgrade', priority: 45, tone: 'info', title: `Upgrade ${SITE_BY_ID[jam.r.a].name} – ${SITE_BY_ID[jam.r.b].name}`, why: `It ran at ${Math.round(jam.use * 100)}% yesterday, and you have money to spare.`, action: a, panel: 'build' });
    }
  }

  newSystems(s, add);

  const top = out.sort((a, b) => b.priority - a.priority).slice(0, limit);
  // The trade-off for each piece of advice that comes with an action.
  for (const a of top) {
    if (!a.action) continue;
    const cost = costOf(s, a.action);
    const parts = [cost >= 0.05 ? `Costs ${money(cost)}.` : '', CATCH[a.action.type] ?? ''].filter(Boolean);
    if (parts.length) a.tradeoff = parts.join(' ');
  }
  return top;
}

/** Advice about the newer systems: hearings, promises, power, audits, unions, cyber, spies and towns. */
function newSystems(s: SimState, add: (a: Advice) => void): void {
  if (s.hearing) add({ id: 'hearing', priority: 97, tone: 'warn', title: 'Answer the budget hearing', why: 'The clock is held until you do. Promises you make will be checked a year from now.', panel: 'strategy' });
  for (const p of s.promises ?? []) {
    const left = p.due - s.day;
    if (left > 90) continue;
    const months = Math.max(1, Math.round(left / 30));
    add({ id: `promise-${p.id}`, priority: 74, tone: 'warn', title: `Keep your promise: ${p.text.replace(/\.$/, '').toLowerCase()}`, why: `It falls due in about ${months} month${months > 1 ? 's' : ''}. Breaking it costs 6 confidence and angers the members who heard it.`, panel: 'strategy' });
  }
  // Power: arsenals on grids with a real blackout risk and no generators.
  if (s.energy) {
    for (const r of GRID_REGIONS) {
      const risk = blackoutOdds(s, r) * 30;
      if (risk < 0.02) continue;
      for (const d of regionPlants(s, r).filter((x) => x.kind === 'arsenal' && !s.energy.generators.includes(x.id))) {
        const a: SimAction = { type: 'generator', site: d.id };
        add({ id: `gen-${d.id}`, priority: 58 + risk * 100, tone: 'warn', title: `Generators at ${d.name}`, why: `Its grid has about a ${Math.round(risk * 100)}% chance of a blackout each month. Without generators the plant falls to a quarter of its output.`, action: ok(s, a) ? a : undefined, site: d.id, panel: 'power' });
      }
      const price = s.energy.grids[r].price;
      const covered = s.energy.contracts.some((c) => c.region === r && c.until > s.day);
      if (!covered && !s.energy.shock && price <= 0.97 && regionPlants(s, r).length) {
        const a: SimAction = { type: 'powerContract', region: r };
        add({ id: `pc-${r}`, priority: 40, tone: 'info', title: `Lock in cheap power for ${REGIONS[r].name}`, why: `Power there is ${Math.round(price * 100)}% of normal. A contract holds it for two years.`, action: ok(s, a) ? a : undefined, panel: 'power' });
      }
    }
  }
  // Audits: waste running high with a review coming.
  if (s.oversight) {
    const monthsLeft = REVIEW_MONTHS - 1 - (s.history.length % REVIEW_MONTHS);
    const w = wasteSince(s, (s.history.length % REVIEW_MONTHS) || REVIEW_MONTHS);
    const ratio = counted(s, w.total) / Math.max(1, w.spend);
    if (monthsLeft <= 1 && ratio >= AUDIT_LIMITS[s.difficulty][0] * 0.8) {
      const worst = Object.entries(w.by).sort((a, b) => b[1] - a[1])[0];
      add({ id: 'audit', priority: 66, tone: 'warn', title: 'Cut waste before the audit', why: `The Auditor-General reviews your spending ${monthsLeft ? 'next month' : 'at the end of this month'}, and waste is running at ${Math.round(ratio * 100)}%${worst?.[0] === 'spot' ? ', mostly from buying without contracts: tender for what you buy on the spot' : worst?.[0] === 'idle' ? ', mostly from idle lines: mothball or run them' : ''}.`, panel: 'money' });
    }
  }
  // Unions: a strong one is a strike waiting to happen.
  if (s.unions) {
    const strong = unionTowns(s).filter((i) => s.unions.towns[i].strength >= 70);
    if (strong.length) {
      const a: SimAction = { type: 'payDeal' };
      add({ id: 'payDeal', priority: 62, tone: 'warn', title: 'Offer a national pay deal', why: `The union${strong.length > 1 ? 's' : ''} in ${strong.map((i) => CITIES[i].name).join(' and ')} ${strong.length > 1 ? 'are' : 'is'} strong: a refused claim there means a strike that can spread.`, action: ok(s, a) ? a : undefined, panel: 'towns' });
    }
  }
  // Cyber: the rival is busy and the plants are unguarded.
  if (s.cyber && (s.rival?.known.length ?? 0) >= 2 && s.cyber.levels.plants === 0) {
    const a: SimAction = { type: 'cyberDefence', area: 'plants' };
    add({ id: 'cyber', priority: 54, tone: 'warn', title: 'Defend the plant control systems', why: `With ${s.rival.known.length} rival weapons programmes, its hackers are busy: about ${(attackOdds(s, 'plants') * 100).toFixed(1)}% a month of ransomware at one of your plants.`, action: ok(s, a) ? a : undefined, panel: 'intel' });
  }
  // Spies: a plant hit recently with no vetting.
  if ((s.history.slice(-3).reduce((a, h) => a + (h.incidents ?? 0), 0) ?? 0) > 0) {
    const bare = SITES.find((d) => d.owner === 'state' && d.kind === 'arsenal' && (s.sites[d.id].clearance ?? 0) === 0);
    if (bare) {
      const a: SimAction = { type: 'vet', site: bare.id };
      add({ id: `vet-${bare.id}`, priority: 52, tone: 'warn', title: `Vet the staff at ${bare.name}`, why: 'The rival’s agents struck your plants recently. Vetting makes incidents rarer and catches rings before they act.', action: ok(s, a) ? a : undefined, site: bare.id });
    }
  }
  // Towns: an angry town with your plants in it.
  if (s.communities) {
    const angry = communityTowns(s).filter((t) => s.communities.mood[t] < 35);
    for (const t of angry.slice(0, 2)) {
      const a: SimAction = { type: 'communityFund', town: t };
      add({ id: `fund-town-${t}`, priority: 56 + (35 - s.communities.mood[t]), tone: s.communities.mood[t] < 30 ? 'bad' : 'warn', title: `Win back ${CITIES[t].name}`, why: `The town is ${MOOD_WORD(s.communities.mood[t])} with you (${Math.round(s.communities.mood[t])}). Below 30 people protest at your gates, and unhappy towns object to new plants and lines.`, action: ok(s, a) ? a : undefined, panel: 'towns' });
    }
  }
  // Engineers: too few for the work.
  if (s.engineers) {
    const need = engineerNeed(s).total;
    const gap = Math.ceil(need - s.engineers.staff);
    if (gap > 0) {
      const count = Math.min(gap, Math.floor(s.engineers.market));
      const cov = coverage(s);
      if (count >= 1) {
        const a: SimAction = { type: 'hireEngineers', count };
        add({ id: 'engineers', priority: cov < 0.9 ? 72 : 58, tone: cov < 0.9 ? 'bad' : 'warn', title: `Hire ${count} engineers`, why: `You have ${s.engineers.staff} for work that needs ${need}. Short-handed plants lose output, research and design slow down, and overworked engineers leave.`, action: ok(s, a) ? a : undefined, panel: 'staff' });
      } else if (s.engineers.academies.length === 0) {
        const town = academyTowns(s)[0];
        const a: SimAction | undefined = town !== undefined ? { type: 'academy', town } : undefined;
        add({ id: 'academy', priority: 60, tone: 'warn', title: 'Found an engineering academy', why: `No engineers are looking for work and you are ${gap} short. An academy costs ${money(academyCost(s))} and adds graduates every month once it opens.`, action: a && ok(s, a) ? a : undefined, panel: 'staff' });
      }
    }
  }
  // Intelligence: steal the plans for the next weapon when the service is idle and the odds are decent.
  if (s.intel && !s.intel.active && s.day >= 60 && s.rival.known.length < s.rival.order.length && opOdds(s, 'learn') >= 0.6) {
    const a: SimAction = { type: 'intelOp', kind: 'learn' };
    if (ok(s, a)) add({ id: 'intel-learn', priority: 30, tone: 'info', title: OPS.learn.name, why: `Your service is idle. A ${Math.round(opOdds(s, 'learn') * 100)}% chance of early warning of the rival’s next weapon, for ${money(opCost(s, 'learn'))}; there is a small risk of exposure.`, action: a, panel: 'intel' });
  }
}

/** Advice you can take in one go: actions that pass, in order, without taking the treasury below the reserve. */
export function safeAdvice(s: SimState, reserve = s.automation?.reserve ?? 0): SimAction[] {
  let t = s;
  const out: SimAction[] = [];
  // The top suggestions only: this runs every game day while the advisor is on screen.
  for (const a of advise(s, 8)) {
    // Operations can be exposed: never "safe", always your own call.
    if (!a.action || a.action.type === 'intelOp' || validate(t, a.action)) continue;
    const next = apply(t, a.action);
    if (next.treasury < reserve && next.treasury < t.treasury) continue;
    out.push(a.action);
    t = next;
  }
  return out;
}

export interface Diagnosis {
  line: LineId;
  /** Stock against target, now. */
  level: number;
  /** Months until below half of target, if within six. */
  months: number | null;
  cause: string;
  site?: string;
}

/** Why each struggling round is short: traced from the arsenal line down to the root cause. */
export function diagnose(s: SimState): Diagnosis[] {
  const out: Diagnosis[] = [];
  const bal = balances(s);
  for (const line of FINISHED as LineId[]) {
    if (!s.lines[line].unlocked || reserveTarget(s, line) <= 0) continue;
    const level = nationalStock(s, line) / reserveTarget(s, line);
    const months = monthsTo(s, line, 0.5, 6);
    if (level >= 0.8 && months === null) continue;
    const name = MATERIALS[line].name;
    const arsenal = SITES.find((d) => d.owner === 'state' && s.sites[d.id].processes.some((p) => p.recipe === line));
    const p = arsenal ? s.sites[arsenal.id].processes.find((q) => q.recipe === line) : undefined;
    let cause = '';
    let site = arsenal?.id;
    if (s.lines[line].accepted === false) cause = `${name} is still being tested at the ranges: nothing is issued until it passes.`;
    else if (!p) cause = `No arsenal makes ${name}.`;
    else if (arsenal && s.sites[arsenal.id].mothballed) cause = `${arsenal.name} is mothballed.`;
    else if (p.run === 'idle') cause = `The ${name} line at ${arsenal!.name} is idle.`;
    else if (p.lastLimit === 'crew') cause = `${arsenal!.name} is short of crew (Towns tab for housing).`;
    else if (p.lastLimit === 'damaged') cause = `${arsenal!.name} is damaged or under repair.`;
    else {
      const b = bottleneck(s, line, bal);
      if (b && b.material !== line && b.top) {
        const def = SITE_BY_ID[b.top];
        const st = s.sites[b.top];
        site = b.top;
        const part = MATERIALS[b.material].name.toLowerCase();
        const why =
          st.status === 'closed' ? 'has closed for good'
          : st.embargoDays > 0 ? `is under an export ban from the ${def.nation} for ${Math.ceil(st.embargoDays / 7)} more weeks`
          : st.disruptionDays > 0 ? `is down to ${Math.round(st.disruptionFactor * 100)}% for ${Math.ceil(st.disruptionDays / 7)} more weeks`
          : s.energy?.grids[def.region]?.outage > 0 ? 'is in a blackout'
          : 'is running flat out and cannot make more';
        cause = `${part[0].toUpperCase() + part.slice(1)} is the tightest part (${Math.round(b.ratio * 100)}% of what is needed): ${def.name} ${why}.`;
      } else cause = `The ${name} line itself is the limit: expand it, or add shifts.`;
    }
    out.push({ line, level, months, cause, site });
  }
  return out.sort((a, b) => a.level - b.level);
}

export interface PlanItem {
  /** 0 is this month, 1 next month, 2 the month after. */
  month: number;
  tone: 'bad' | 'warn' | 'info' | 'good';
  text: string;
}

/** A plan for the next three months: what is coming, month by month, and what to do about it. */
export function threeMonthPlan(s: SimState): PlanItem[] {
  if (s.over) return [];
  const out: PlanItem[] = [];
  // Months from the one in progress (history.length): days 1-30 are month 0, and a month-end day already belongs to the next.
  const at = (days: number) => Math.floor(Math.max(0, s.day + days - 1) / 30) - s.history.length;
  const push = (days: number, tone: PlanItem['tone'], text: string) => {
    const m = at(days);
    if (m >= 0 && m <= 2) out.push({ month: m, tone, text });
  };
  const monthIdx = s.history.length;
  // Rounds running low.
  for (const line of FINISHED as LineId[]) {
    if (!s.lines[line].unlocked || reserveTarget(s, line) <= 0) continue;
    const m = monthsTo(s, line, 0.5, 3);
    if (m !== null) push(m * 30 - 15, 'bad', `${MATERIALS[line].name} falls below half of target: fund its tightest supplier or add capacity now.`);
  }
  // Contracts and orders ending.
  for (const c of s.contracts) {
    const left = c.endDay - s.day;
    if (left > 0 && left <= 90 && !s.contracts.some((k) => k !== c && k.material === c.material && k.endDay > c.endDay)) push(left, 'warn', `The ${MATERIALS[c.material].name.toLowerCase()} contract with ${SITE_BY_ID[c.site].name} ends: tender a month before.`);
  }
  for (const x of s.exports) if (x.endDay - s.day <= 90 && x.endDay > s.day) push(x.endDay - s.day, x.delivered < x.qty * 0.9 ? 'warn' : 'info', `The ${MATERIALS[x.line].name} order for ${x.customer} closes${x.delivered < x.qty * 0.9 ? `: ${Math.round(x.qty - x.delivered)} still to deliver` : ''}.`);
  for (const c of s.diplomacy?.coprod ?? []) if (c.until - s.day <= 90 && c.until > s.day) push(c.until - s.day, 'info', `Co-production of ${MATERIALS[c.line].name} ends.`);
  for (const c of s.energy?.contracts ?? []) if (c.until - s.day <= 90 && c.until > s.day) push(c.until - s.day, 'info', `Your power contract for ${REGIONS[c.region].name} ends: renew it if power is cheap.`);
  // Work finishing.
  const r = s.strategy.research.active;
  if (r && r.days <= 90) push(r.days, 'good', `Research finishes: ${RESEARCH[r.id].name}. Start the next one straight away.`);
  for (const p of s.network.projects) if (p.days <= 90 && !permitHeld(s, String(p.id))) push(p.days, 'good', 'A building project finishes.');
  for (const j of s.inhouse) if (j.days <= 90) push(j.days, 'good', `The in-house line at ${SITE_BY_ID[j.site].name} is fitted out: hire its crew in good time.`);
  for (const d of SITES) {
    const site = s.sites[d.id];
    if (site.status === 'building' && site.repairDays <= 90 && site.plantName && !permitHeld(s, d.id)) push(site.repairDays, 'good', `${site.plantName} opens: hire its crew in good time.`);
  }
  // The rival.
  for (const k of s.rival?.known ?? []) {
    const d = DEVELOPMENTS[k.id];
    if (k.fielded > s.day && k.fielded - s.day <= 90 && !s.strategy.research.done.includes(d.counter)) push(k.fielded - s.day, 'bad', `${d.name} enter the field: research ${COUNTER_NAMES[d.counter]} before then.`);
  }
  // The Committee and the Auditor-General.
  const toHearing = 11 - (monthIdx % 12);
  // No hearing sits in a term's last month.
  if (toHearing <= 2 && (monthIdx + toHearing + 1) * 30 < s.days) out.push({ month: toHearing, tone: 'info', text: 'The budget hearing sits at the end of the month: readiness and a clean record win you money.' });
  const toReview = REVIEW_MONTHS - 1 - (monthIdx % REVIEW_MONTHS);
  if (toReview <= 2) out.push({ month: toReview, tone: 'info', text: 'The Auditor-General reviews your spending at the end of the month: buy on contract and keep idle lines down.' });
  for (const p of s.promises ?? []) if (p.due - s.day <= 90) push(p.due - s.day, 'warn', `Your promise falls due: ${p.text}`);
  if (s.crisis) out.push({ month: 0, tone: 'bad', text: `The ${s.crisis.name} ${s.crisis.phase === 'warning' ? 'is coming' : 'is under way'}: keep ${REGIONS[s.crisis.region].name}'s depot at 60 days.` });
  const rank = { bad: 0, warn: 1, good: 2, info: 3 } as const;
  return out.sort((a, b) => a.month - b.month || rank[a.tone] - rank[b.tone]);
}
