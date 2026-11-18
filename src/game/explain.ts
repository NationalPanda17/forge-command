// What lies behind the numbers on screen, in plain words, from the live state.
import { forecast } from '../sim/analytics';
import { reserveDays } from '../sim/commitments';
import { DIFF } from '../sim/tick';
import { tr } from '../sim/worldgen';
import { SEASON_NOTE, seasonOf } from '../sim/living';
import { peopleFactor } from '../sim/people';
import { RIVAL_NAME, rivalArrivals, rivalShots } from '../sim/rival';
import { DAYS_PER_MONTH, RUN_FACTOR, crewNeed, inGrace, nationalDailyDraw, nationalStock, reserveTarget } from '../sim/selectors';
import type { ProcessState, SimState, ThreatId } from '../sim/types';
import { FINISHED, MATERIALS, type LineId } from '../sim/world';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const m = (v: number) => `$${Math.round(v).toLocaleString('en-US')}M`;
const sign = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`;
const EXPECT = { easy: 0.62, normal: 0.7, hard: 0.76 } as const;

export function readinessWhy(s: SimState): string[] {
  const lines = (FINISHED as LineId[]).filter((l) => s.lines[l].unlocked && nationalDailyDraw(s, l) > 0);
  const out = [`The average, over every round in service, of national stock against ${Math.round(reserveDays(s) / 30)} months of expected use (each capped at 100%).`];
  for (const l of lines) {
    const r = nationalStock(s, l) / Math.max(1, reserveTarget(s, l));
    out.push(`${MATERIALS[l].name}: ${pct(Math.min(1, r))}${inGrace(s, l) ? ' (new line, not counted yet)' : ''}`);
  }
  out.push(`The Committee expects ${pct(EXPECT[s.difficulty])} on ${s.difficulty}.`);
  return out;
}

export function confidenceWhy(s: SimState): string[] {
  const w = s.history.at(-1)?.why;
  if (!w) return ['The Committee’s trust in you, from 0 to 100. At zero you are dismissed.', 'A breakdown appears after the first month.'];
  const total = w.readiness + w.leaks + w.land + w.debt + w.other;
  return [
    'The Committee’s trust in you, from 0 to 100. At zero you are dismissed.',
    `Last month: ${sign(total)}`,
    `• Readiness against expectation: ${sign(w.readiness)}`,
    `• Threats that got through: ${sign(w.leaks)}`,
    `• Land fire missions short: ${sign(w.land)}`,
    `• Overdrawn treasury: ${sign(w.debt)}`,
    `• Factions, objectives, decisions and events: ${sign(w.other)}`,
  ];
}

export function treasuryWhy(s: SimState): string[] {
  const h = s.history.at(-1);
  const cur = s.month;
  const spend = (x: typeof cur) => Object.values(x.spend).reduce((a, b) => a + b, 0);
  const out = [`Cash on hand. This month so far: ${m(cur.income.appropriation + cur.income.sales)} in, ${m(spend(cur))} out.`];
  if (h) {
    out.push(`Last month in: budget ${m(h.income.appropriation)}, sales and refunds ${m(h.income.sales)}.`);
    out.push(`Last month out: purchases ${m(h.spend.purchases)}, wages and running costs ${m(h.spend.operations)}, freight ${m(h.spend.transport)}, projects ${m(h.spend.projects)}, disposal ${m(h.spend.demil)}.`);
  }
  out.push(`Your budget is ${m(s.appropriation)} a month. Going below zero costs confidence.`);
  return out;
}

export function seasonWhy(s: SimState): string[] {
  const season = seasonOf(s.day);
  return [tr(SEASON_NOTE[season]), `Prices are ${pct(s.priceIndex - 1)} above the start of your term: wages, running costs, freight, spot buying and new contracts all follow them.`];
}

export function stockWhy(s: SimState, line: LineId): string[] {
  const daily = nationalDailyDraw(s, line);
  return [
    `${Math.round(nationalStock(s, line)).toLocaleString('en-US')} serviceable rounds in depots, bases and on the move.`,
    `Target: ${Math.round(reserveDays(s) / 30)} months of expected use, ${daily.toFixed(2)} a day = ${Math.round(reserveTarget(s, line)).toLocaleString('en-US')}.`,
    'Expected use counts every region’s threats and how your doctrine splits them between rounds, but not crises.',
  ];
}

export function flowWhy(s: SimState, line: LineId): string[] {
  const f = forecast(s, line, 12).at(-1)!;
  return [
    `Made: what your arsenals can turn out a month as things stand, held to what they actually managed last month if inputs ran short.`,
    `Fired: ${(nationalDailyDraw(s, line) * DAYS_PER_MONTH).toFixed(1)} a month in calm times${s.crisis ? ', more while the crisis lasts' : ''}, plus any export deliveries.`,
    `Retiring: lots reaching the end of their certified life; surveillance testing saves about half of those still eligible.`,
    `At month 12: ${Math.round(f.stock).toLocaleString('en-US')} against a target of ${Math.round(f.target).toLocaleString('en-US')}.`,
  ];
}

const RUN_TEXT = { idle: 'idle', single: 'one shift', normal: 'two shifts', surge: 'round the clock' } as const;

export function rateWhy(s: SimState, siteId: string, p: ProcessState): string[] {
  const site = s.sites[siteId];
  const ramping = (p.ramp ?? []).reduce((a, r) => a + r.cap * r.maturity, 0);
  const crew = Math.min(1, site.workers / Math.max(1, crewNeed(site)));
  const out = [
    `Capacity ${(p.capacity * p.maturity).toFixed(3)} a day${ramping > 0 ? ` + ${ramping.toFixed(3)} still ramping up` : ''}.`,
    `× ${RUN_FACTOR[p.run]} for ${RUN_TEXT[p.run]}.`,
  ];
  if (site.skill !== undefined && crewNeed(site) > 0) {
    out.push(`× ${crew.toFixed(2)} crew (${Math.round(site.workers)} of ${Math.round(crewNeed(site))} posts filled).`);
    out.push(`× ${peopleFactor(site).toFixed(2)} skill ${Math.round(site.skill)} and morale ${Math.round(site.morale)}.`);
  }
  if (site.disruptionDays > 0) out.push(`× ${site.disruptionFactor} disruption, ${site.disruptionDays} more days.`);
  out.push(`× ${(0.6 + 0.4 * (site.condition / 100)).toFixed(2)} plant condition ${Math.round(site.condition)}.`);
  out.push('Then limited by the parts on site: the line stops when any input runs out.');
  return out;
}

export function threatWhy(s: SimState, t: ThreatId): string[] {
  return [
    `Arrivals × ${rivalArrivals(s, t).toFixed(2)} and interceptors per threat × ${rivalShots(s, t).toFixed(2)} from what ${RIVAL_NAME} has fielded so far, after your counters.`,
    `Disruptions and events run at ×${DIFF[s.difficulty].events} on ${s.difficulty}.`,
  ];
}
