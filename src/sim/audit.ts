// Audits and oversight: the Auditor-General reviews your spending every six months. Waste counts against you: premiums
// paid for buying without a contract, lines kept idle, ransoms, penalties, and suppliers quietly overbilling you.
// An internal audit team finds fraud sooner and shows the Auditor-General you are on top of things.
import { clamp, rand } from './rng';
import { troubleScale } from './scale';
import { DAYS_PER_MONTH } from './selectors';
import type { Contract, FeedItem, MonthReport, SimState } from './types';
import { MATERIALS, SITE_BY_ID } from './world';

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

export type WasteKind = 'spot' | 'idle' | 'ransom' | 'penalties' | 'fraud' | 'grey';
export const WASTE_NAME: Record<WasteKind, string> = {
  spot: 'Premiums for buying without a contract',
  idle: 'Running costs of idle lines',
  ransom: 'Ransoms paid',
  penalties: 'Penalties and fees',
  fraud: 'Overbilling by suppliers',
  grey: 'Broker premiums round the bans',
};
export const WASTE_IDS = Object.keys(WASTE_NAME) as WasteKind[];

export interface AuditFinding {
  month: number;
  waste: number;
  spend: number;
  verdict: 'clean' | 'concerns' | 'damning';
  /** The biggest source of waste. */
  worst: WasteKind | null;
}

export interface OversightState {
  /** An internal audit team is on the payroll. */
  team: boolean;
  findings: AuditFinding[];
}

export const AUDITOR = 'Imogen Hale, Auditor-General';
export const newOversight = (): OversightState => ({ team: false, findings: [] });
export const teamCost = (s: SimState) => Math.round(5 * s.priceIndex);
export const teamUpkeep = (s: SimState) => 2 * s.priceIndex;
/** Overbilling by a fraudulent supplier, on top of the contract price. */
export const FRAUD_MARKUP = 0.12;
export const REVIEW_MONTHS = 6;
/** Waste as the Auditor-General counts it: an internal audit team shows you are on top of 30% of it. */
export const counted = (s: SimState, waste: number) => waste * (s.oversight?.team ? 0.7 : 1);
/** Is the review due at the end of this month? */
export const reviewDue = (s: SimState) => (s.history.length + 1) % REVIEW_MONTHS === 0;
/** Waste, as a share of spending, that the Auditor-General tolerates before raising concerns, and before a damning report. */
export const AUDIT_LIMITS = { easy: [0.08, 0.18], normal: [0.05, 0.12], hard: [0.04, 0.1] } as const;
/** Confidence lost when a damning report is accepted, or a rebuttal fails. */
const DAMNING = { easy: [1, 3], normal: [2, 5], hard: [3, 6] } as const;

/** Books waste for this month's report. */
export function addWaste(s: SimState, kind: WasteKind, v: number): void {
  if (v <= 0) return;
  const w = (s.month.waste ??= {});
  w[kind] = (w[kind] ?? 0) + v;
}

export const monthWaste = (m: MonthReport) => Object.values(m.waste ?? {}).reduce((a, b) => a + (b ?? 0), 0);
export const monthSpend = (m: MonthReport) => Object.values(m.spend).reduce((a, b) => a + (b ?? 0), 0);

/** Waste and spending over recent months, by kind. */
export function wasteSince(s: SimState, months: number): { total: number; spend: number; by: Record<WasteKind, number> } {
  const h = [...s.history.slice(-months)];
  const by = Object.fromEntries(WASTE_IDS.map((k) => [k, h.reduce((a, m) => a + (m.waste?.[k] ?? 0), 0)])) as Record<WasteKind, number>;
  return { total: Object.values(by).reduce((a, b) => a + b, 0), spend: h.reduce((a, m) => a + monthSpend(m), 0), by };
}

export function validateOversight(s: SimState, a: { type: string }): string | null {
  if (a.type === 'auditTeam') return s.oversight.team ? 'You already have an internal audit team.' : s.treasury >= teamCost(s) ? null : `Not enough money (needs $${teamCost(s)}M).`;
  if (a.type === 'disbandAuditTeam') return s.oversight.team ? null : 'You have no internal audit team.';
  return null;
}

export function applyOversight(s: SimState, a: { type: string }, feed: Feed): void {
  if (a.type === 'auditTeam') {
    s.treasury -= teamCost(s);
    s.month.spend.operations += teamCost(s);
    s.oversight.team = true;
    feed(s, 'info', 'An internal audit team starts work: it will look for overbilling every month.');
  } else if (a.type === 'disbandAuditTeam') {
    s.oversight.team = false;
    feed(s, 'info', 'The internal audit team is disbanded.');
  }
}

function fraudCase(s: SimState, c: Contract, by: 'team' | 'auditor', feed: Feed): void {
  if (s.strategy.decisions.some((d) => d.kind === 'fraud' && d.data?.contract === c.id)) return;
  const name = SITE_BY_ID[c.site].name;
  const lost = Math.round((c.overbilled ?? 0) * 10) / 10;
  s.strategy.decisions.push({
    id: s.nextId++,
    kind: 'fraud',
    title: `Overbilling at ${name}`,
    body: `${by === 'team' ? 'Your internal auditors' : 'The Auditor-General'} found that ${name} has been overbilling its ${MATERIALS[c.material].name.toLowerCase()} contract by ${Math.round(FRAUD_MARKUP * 100)}%: about $${lost}M so far.`,
    options: [
      { id: 'prosecute', label: 'Prosecute and end the contract', detail: 'Recover most of it in time; the supplier may not survive, and you lose the contract.' },
      { id: 'settle', label: 'Settle quietly', detail: 'Recover 40% now; the contract carries on at its honest price.' },
      { id: 'ignore', label: 'Let it go', detail: 'Nothing changes. If it comes out later, it will look worse.' },
    ],
    fallback: by === 'team' ? 'settle' : 'prosecute',
    site: c.site,
    value: lost,
    data: { contract: c.id },
  });
  feed(s, 'bad', `${by === 'team' ? 'Your internal auditors find' : 'The Auditor-General finds'} overbilling at ${name}. A decision is waiting.`, c.site, true);
}

export function oversightMonth(s: SimState, feed: Feed): void {
  const o = s.oversight;
  if (o.team) {
    s.treasury -= teamUpkeep(s);
    s.month.spend.operations += teamUpkeep(s);
  }
  // Suppliers on contract sometimes start overbilling.
  for (const c of s.contracts) {
    if (c.fraud || c.endDay <= s.day || SITE_BY_ID[c.site].owner === 'state') continue;
    if (s.day > (s.scenario === 'tutorial' ? 360 : 90) && rand(s) < 0.006 * troubleScale(s)) c.fraud = true;
  }
  // Your own auditors catch it as it happens.
  if (o.team) for (const c of s.contracts) if (c.fraud && !c.flagged && !c.ignored && c.endDay > s.day + DAYS_PER_MONTH && rand(s) < 0.3) {
    c.flagged = true;
    fraudCase(s, c, 'team', feed);
  }
  // The Auditor-General's review, every six months.
  if (!reviewDue(s)) return;
  const recent = [...s.history.slice(-(REVIEW_MONTHS - 1)), s.month];
  const by = Object.fromEntries(WASTE_IDS.map((k) => [k, recent.reduce((a, m) => a + (m.waste?.[k] ?? 0), 0)])) as Record<WasteKind, number>;
  const waste = counted(s, Object.values(by).reduce((a, b) => a + b, 0));
  const spend = Math.max(1, recent.reduce((a, m) => a + monthSpend(m), 0));
  const ratio = waste / spend;
  const [ok, bad] = AUDIT_LIMITS[s.difficulty];
  const verdict: AuditFinding['verdict'] = ratio < ok ? 'clean' : ratio < bad ? 'concerns' : 'damning';
  const worst = (WASTE_IDS.filter((k) => by[k] > 0).sort((a, b) => by[b] - by[a])[0] ?? null) as WasteKind | null;
  o.findings.push({ month: s.month.month, waste: Math.round(waste * 10) / 10, spend: Math.round(spend), verdict, worst });
  if (o.findings.length > 12) o.findings.shift();
  // Fraud the Auditor-General turns up.
  for (const c of s.contracts) if (c.fraud && !c.flagged && c.endDay > s.day + DAYS_PER_MONTH && rand(s) < 0.7) {
    c.flagged = true;
    if (c.ignored) s.confidence = clamp(s.confidence - 4);
    fraudCase(s, c, 'auditor', feed);
  }
  const pct = Math.round(ratio * 1000) / 10;
  if (verdict === 'clean') {
    s.confidence = clamp(s.confidence + 2);
    s.strategy.factions.treasury = clamp(s.strategy.factions.treasury + 4);
    feed(s, 'good', `The Auditor-General's review is clean: waste of ${pct}% of spending. The treasury bench is pleased.`, undefined, true);
    return;
  }
  const hard = verdict === 'damning';
  s.strategy.decisions.push({
    id: s.nextId++,
    kind: 'audit',
    title: hard ? 'A damning audit' : 'The audit raises concerns',
    body: `The Auditor-General finds waste of $${Math.round(waste)}M, ${pct}% of $${Math.round(spend)}M spent in six months${worst ? `, mostly ${WASTE_NAME[worst].toLowerCase()}` : ''}. The report goes to the Committee.`,
    options: [
      { id: 'accept', label: 'Accept the findings', detail: hard ? `Confidence −${DAMNING[s.difficulty][0]}. The treasury bench approves of the candour.` : 'No harm done, and the treasury bench approves of the candour.' },
      { id: 'contest', label: 'Contest the report', detail: `Even odds it is softened. Otherwise confidence −${hard ? DAMNING[s.difficulty][1] : 3} and the treasury bench turns on you.` },
    ],
    fallback: 'accept',
    value: hard ? 1 : 0,
  });
  feed(s, hard ? 'bad' : 'warn', `The Auditor-General's review finds waste of ${pct}% of spending. A decision is waiting.`, undefined, true);
}

export function resolveOversight(s: SimState, d: { kind: string; site?: string; value?: number; data?: { contract?: number } }, opt: string, feed: Feed): boolean {
  const f = s.strategy.factions;
  if (d.kind === 'audit') {
    const hard = d.value === 1;
    if (opt === 'contest') {
      if (rand(s) < 0.5) {
        // The softened report is one grade kinder on the record.
        const last = s.oversight.findings.at(-1);
        if (last) last.verdict = last.verdict === 'damning' ? 'concerns' : 'clean';
        feed(s, 'info', 'Your rebuttal lands: the Auditor-General softens the report.');
      }
      else {
        s.confidence = clamp(s.confidence - (hard ? DAMNING[s.difficulty][1] : 3));
        f.treasury = clamp(f.treasury - 5);
        feed(s, 'bad', 'Your rebuttal falls flat. The report is published in full, and the Committee is not amused.', undefined, true);
      }
    } else {
      if (hard) s.confidence = clamp(s.confidence - DAMNING[s.difficulty][0]);
      f.treasury = clamp(f.treasury + 3);
      feed(s, 'info', 'You accept the audit and promise better housekeeping.');
    }
    return true;
  }
  if (d.kind === 'fraud') {
    const c = s.contracts.find((x) => x.id === d.data?.contract);
    const lost = d.value ?? 0;
    if (opt === 'prosecute') {
      s.contracts = s.contracts.filter((x) => x.id !== d.data?.contract);
      s.treasury += lost * 0.8;
      s.month.income.sales += lost * 0.8;
      // A supplier whose contract has already ended is chased for the money, not ruined.
      if (d.site && c) s.sites[d.site].health = clamp(s.sites[d.site].health - 30);
      f.treasury = clamp(f.treasury + 4);
      s.fraudsCaught = (s.fraudsCaught ?? 0) + 1;
      feed(s, 'good', `Prosecution begins: $${Math.round(lost * 0.8)}M recovered, and the contract is ended.`, d.site);
    } else if (opt === 'settle') {
      if (c) {
        c.fraud = false;
        c.overbilled = 0;
        c.flagged = false;
        c.ignored = false;
      }
      s.treasury += lost * 0.4;
      s.month.income.sales += lost * 0.4;
      s.fraudsCaught = (s.fraudsCaught ?? 0) + 1;
      feed(s, 'info', `A quiet settlement: $${Math.round(lost * 0.4)}M back, and honest bills from now on.`, d.site);
    } else if (c) {
      c.ignored = true;
      c.flagged = false;
      feed(s, 'warn', `You let the overbilling at ${SITE_BY_ID[c.site].name} go.`, d.site);
    }
    return true;
  }
  return false;
}
