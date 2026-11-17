// The advisor: the next best things to do, ranked, each with the action that does it where there is one.
import { validate, type SimAction } from './actions';
import { balances, bottleneck, forecast, monthsTo } from './analytics';
import { liveRoutes, routeCap } from './build';
import { DEVELOPMENTS, COUNTER_NAMES } from './rival';
import { crewNeed, nationalStock, reserveTarget } from './selectors';
import { RESEARCH, RESEARCH_IDS } from './strategy';
import type { SimState } from './types';
import { FINISHED, MATERIALS, REGIONS, RECIPES, ROUTE_KEY, SITES, SITE_BY_ID, type LineId, type MaterialId } from './world';

export type AdvicePanel = 'strategy' | 'markets' | 'build' | 'plan' | 'logistics' | 'site' | 'intel' | 'programmes';

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
}

const ok = (s: SimState, a: SimAction) => validate(s, a) === null;

export function advise(s: SimState, limit = 6): Advice[] {
  if (s.over) return [];
  const out: Advice[] = [];
  const add = (a: Advice) => out.push(a);
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
  for (const def of SITES.filter((d) => d.owner === 'state' && d.crew > 0 && d.processes.length)) {
    const site = s.sites[def.id];
    const training = site.trainees.reduce((a, t) => a + t.count, 0);
    const short = Math.ceil(crewNeed(site) - site.workers - training);
    if (short > 20) {
      const a: SimAction = { type: 'hire', site: def.id, count: Math.ceil(short / 10) * 10 };
      add({ id: `hire-${def.id}`, priority: 72, tone: 'warn', title: `Hire ${a.count} at ${def.name}`, why: `It is ${short} people short, counting those in training. Training takes about three months.`, action: ok(s, a) ? a : undefined, site: def.id });
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

  return out.sort((a, b) => b.priority - a.priority).slice(0, limit);
}
