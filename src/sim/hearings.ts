// Budget hearings: once a fiscal year the Defence Committee questions you before it sets your budget. Members ask
// about your record; answers sway their factions or commit you to promises checked a year later. Then you make your
// request, and the Committee votes on it.
import { clamp, rand } from './rng';
import { FACTIONS, FACTION_IDS, hasResearch, type FactionId, type ResearchId } from './strategy';
import { DEVELOPMENTS } from './rival';
import { nationalStock, reserveTarget } from './selectors';
import type { FeedItem, SimState } from './types';
import { FINISHED, MATERIALS, SITES, type LineId } from './world';

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

export type PromiseKind = 'readiness' | 'solvent' | 'noExports' | 'newPlant' | 'counter' | 'peace' | 'cyber' | 'vetting';

export interface CommitteePromise {
  id: number;
  kind: PromiseKind;
  text: string;
  /** Faction that holds you to it. */
  faction: FactionId;
  made: number;
  due: number;
  /** For new plants: how many lines you had when you promised. */
  base?: number;
  research?: ResearchId;
}

export interface HearingOption {
  id: string;
  label: string;
  detail: string;
  /** Faction changes on answering. */
  sway: Partial<Record<FactionId, number>>;
  promise?: { kind: PromiseKind; text: string; faction: FactionId; research?: ResearchId };
}

export interface HearingQuestion {
  id: string;
  member: string;
  faction: FactionId;
  text: string;
  options: HearingOption[];
  /** Answer taken if the hearing closes unattended. */
  fallback: string;
}

export interface HearingState {
  opened: number;
  /** The provisional appropriation, $M a month. */
  provisional: number;
  questions: HearingQuestion[];
  answers: Record<string, string>;
}

export type RequestLevel = 'lean' | 'accept' | 'modest' | 'bold';
export const REQUESTS: Record<RequestLevel, { label: string; change: number; detail: string }> = {
  lean: { label: 'Ask for 5% less', change: -0.05, detail: 'Certain. The treasury bench will remember it.' },
  accept: { label: 'Accept it', change: 0, detail: 'Certain. No fuss.' },
  modest: { label: 'Ask for 6% more', change: 0.06, detail: 'Good odds with a friendly Committee.' },
  bold: { label: 'Ask for 15% more', change: 0.15, detail: 'A gamble: failure costs budget and confidence.' },
};

const MEMBERS: Record<FactionId, string[]> = {
  hawks: ['Gen. (ret.) Ada Morrow', 'Col. (ret.) Pell Hasting'],
  treasury: ['Lionel Crane', 'Margit Sallow'],
  regions: ['Tamsin Rook', 'Owain Dell'],
  industry: ['Harriet Vance', 'Corwin Ashby'],
};

const lastYear = (s: SimState) => s.history.slice(-12);
const ownLines = (s: SimState) => SITES.filter((d) => d.owner === 'state').reduce((a, d) => a + s.sites[d.id].processes.length, 0);
const avgReadiness = (s: SimState) => {
  const h = lastYear(s);
  return h.length ? h.reduce((a, x) => a + x.readiness, 0) / h.length : 0;
};
const worstLine = (s: SimState): LineId | undefined =>
  (FINISHED as LineId[]).filter((l) => s.lines[l].unlocked && reserveTarget(s, l) > 0).sort((a, b) => nationalStock(s, a) / reserveTarget(s, a) - nationalStock(s, b) / reserveTarget(s, b))[0];

/** Every question the Committee could ask now, most pressing first. */
function candidates(s: SimState): { weight: number; q: Omit<HearingQuestion, 'member'> }[] {
  const out: { weight: number; q: Omit<HearingQuestion, 'member'> }[] = [];
  const h = lastYear(s);
  const ready = avgReadiness(s);
  out.push({
    weight: ready < 0.75 ? 10 : 3,
    q: {
      id: 'readiness',
      faction: 'hawks',
      text:
        ready >= 0.8
          ? `Readiness averaged ${Math.round(ready * 100)}% this year. Can you hold it there, or should we expect the bill to keep growing?`
          : `Readiness averaged ${Math.round(ready * 100)}% this year${worstLine(s) ? `, and the reserve is thinnest in ${MATERIALS[worstLine(s)!].name}` : ''}. Why should this Committee give you a single dollar more?`,
      options: [
        { id: 'promise', label: 'Promise 80% within a year', detail: 'The hawks warm to you now, and will check.', sway: { hawks: 6 }, promise: { kind: 'readiness', text: 'Average readiness of 80% or better over the next year.', faction: 'hawks' } },
        { id: 'suppliers', label: 'Blame the suppliers', detail: 'The hawks nod; industry bristles.', sway: { hawks: 2, industry: -6 } },
        { id: 'money', label: 'Say it comes down to money', detail: 'Hawks agree; the treasury bench does not.', sway: { hawks: 3, treasury: -5 } },
      ],
      fallback: 'money',
    },
  });
  const overspent = s.treasury < 150 || h.some((x) => x.treasury < 0);
  out.push({
    weight: overspent ? 9 : 2,
    q: {
      id: 'solvent',
      faction: 'treasury',
      text: overspent ? `Your accounts went ${h.some((x) => x.treasury < 0) ? 'into the red' : 'close to empty'} this year. What assurance can you give this Committee?` : 'Every department says it needs more. What makes yours different?',
      options: [
        { id: 'promise', label: 'Promise to stay in the black', detail: 'The treasury bench is pleased. Any month in the red next year breaks it.', sway: { treasury: 6 }, promise: { kind: 'solvent', text: 'No month ends in the red over the next year.', faction: 'treasury' } },
        { id: 'defend', label: 'Defend the spending', detail: 'Hawks like it; the treasury bench does not.', sway: { treasury: -4, hawks: 3 } },
        { id: 'value', label: 'Point to value for money', detail: 'A little goodwill all round.', sway: { treasury: 2 } },
      ],
      fallback: 'value',
    },
  });
  const exported = h.reduce((a, x) => a + (x.exported ?? 0), 0);
  if (exported > 0)
    out.push({
      weight: 7,
      q: {
        id: 'exports',
        faction: 'hawks',
        text: `You sent ${Math.round(exported)} rounds abroad this year while our own racks were short. Explain yourself.`,
        options: [
          { id: 'pay', label: 'Exports pay for our lines', detail: 'Industry approves; the hawks do not.', sway: { industry: 4, hawks: -3 } },
          { id: 'promise', label: 'Promise no exports next year', detail: 'Hawks pleased; industry not. Any export next year breaks it.', sway: { hawks: 5, industry: -3 }, promise: { kind: 'noExports', text: 'No rounds exported over the next year.', faction: 'hawks' } },
        ],
        fallback: 'pay',
      },
    });
  out.push({
    weight: s.strategy.factions.regions < 50 ? 8 : 3,
    q: {
      id: 'jobs',
      faction: 'regions',
      text: SITES.some((d) => s.sites[d.id].mothballed) || s.diplomacy.coprod.length
        ? `My constituents see ${SITES.some((d) => s.sites[d.id].mothballed) ? 'plants mothballed' : 'work going abroad'}. What will you build in the regions?`
        : 'My constituents want munitions jobs close to home. What will you build in the regions?',
      options: [
        { id: 'promise', label: 'Promise a new line within a year', detail: 'The regions cheer. Found a plant or fit an in-house line to keep it.', sway: { regions: 7 }, promise: { kind: 'newPlant', text: 'A new production line at one of your plants within a year.', faction: 'regions' } },
        { id: 'efficiency', label: 'Efficiency comes first', detail: 'The treasury likes it; the regions do not.', sway: { regions: -5, treasury: 3 } },
        { id: 'towns', label: 'Point to the jobs you support', detail: 'A little goodwill.', sway: { regions: 2 } },
      ],
      fallback: 'towns',
    },
  });
  const fresh = s.rival.known.filter((k) => k.fielded <= s.day + 120 && !hasResearch(s, DEVELOPMENTS[k.id].counter));
  if (fresh.length) {
    const k = fresh[fresh.length - 1];
    const dev = DEVELOPMENTS[k.id];
    out.push({
      weight: 9,
      q: {
        id: 'rival',
        faction: 'hawks',
        text: `The rival has ${k.fielded <= s.day ? 'fielded' : 'nearly fielded'} ${dev.name.toLowerCase()}. Where is our answer?`,
        options: [
          { id: 'promise', label: 'Promise the counter within a year', detail: 'Hawks reassured. Finish the counter research to keep it.', sway: { hawks: 5 }, promise: { kind: 'counter', text: `Research the counter to ${dev.name.toLowerCase()} within a year.`, faction: 'hawks', research: dev.counter } },
          { id: 'money', label: 'It needs money we lack', detail: 'Hawks sympathise; the treasury bench does not.', sway: { hawks: 3, treasury: -3 } },
        ],
        fallback: 'money',
      },
    });
  }
  const strikes = h.reduce((a, x) => a + (x.strikes ?? 0), 0);
  if (strikes > 0)
    out.push({
      weight: 8,
      q: {
        id: 'strikes',
        faction: 'regions',
        text: `There were ${strikes} strike${strikes > 1 ? 's' : ''} at your plants this year. Is industrial peace beyond you?`,
        options: [
          { id: 'promise', label: 'Promise a year without strikes', detail: 'The regions approve. Any strike next year breaks it.', sway: { regions: 4 }, promise: { kind: 'peace', text: 'No strikes at your plants over the next year.', faction: 'regions' } },
          { id: 'unions', label: 'The unions are unreasonable', detail: 'The treasury nods; the regions bristle.', sway: { regions: -4, treasury: 3 } },
        ],
        fallback: 'unions',
      },
    });
  const cyber = h.reduce((a, x) => a + (x.cyber ?? 0), 0);
  if (cyber > 0)
    out.push({
      weight: 7,
      q: {
        id: 'cyber',
        faction: 'hawks',
        text: `Hackers got into our systems ${cyber} time${cyber > 1 ? 's' : ''} this year. What are you doing about it?`,
        options: [
          { id: 'promise', label: 'Promise stronger cyber defences', detail: 'Hawks reassured. Raise every cyber defence to level 2 within a year.', sway: { hawks: 4 }, promise: { kind: 'cyber', text: 'Every cyber defence at level 2 or better within a year.', faction: 'hawks' } },
          { id: 'happens', label: 'These things happen', detail: 'The hawks are not impressed.', sway: { hawks: -3 } },
        ],
        fallback: 'happens',
      },
    });
  const spies = h.reduce((a, x) => a + (x.incidents ?? 0), 0);
  if (spies > 0)
    out.push({
      weight: 6,
      q: {
        id: 'spies',
        faction: 'hawks',
        text: `Foreign agents struck your plants ${spies} time${spies > 1 ? 's' : ''} this year. Who is minding the gates?`,
        options: [
          { id: 'promise', label: 'Promise vetting at every plant', detail: 'Hawks reassured. Vet every plant to level 1 or better within a year.', sway: { hawks: 4 }, promise: { kind: 'vetting', text: 'Security vetting at every one of your plants within a year.', faction: 'hawks' } },
          { id: 'cost', label: 'Vetting costs money and morale', detail: 'The treasury bench nods.', sway: { hawks: -2, treasury: 2 } },
        ],
        fallback: 'cost',
      },
    });
  out.push({
    weight: 1,
    q: {
      id: 'plans',
      faction: 'industry',
      text: 'Tell us plainly: what is your priority for the coming year?',
      options: [
        { id: 'stock', label: 'Filling the racks', detail: 'The hawks approve.', sway: { hawks: 3 } },
        { id: 'industry', label: 'Building our own industry', detail: 'The industry caucus approves.', sway: { industry: 3 } },
        { id: 'jobs', label: 'Good jobs in the regions', detail: 'The regional members approve.', sway: { regions: 3 } },
      ],
      fallback: 'stock',
    },
  });
  return out;
}

/** Opens the year's hearing with three questions. */
export function openHearing(s: SimState, provisional: number, feed: Feed): void {
  const pool = candidates(s);
  const chosen: HearingQuestion[] = [];
  while (chosen.length < 3 && pool.length) {
    const total = pool.reduce((a, c) => a + c.weight, 0);
    let r = rand(s) * total;
    const i = Math.max(0, pool.findIndex((c) => (r -= c.weight) < 0));
    const { q } = pool.splice(i, 1)[0];
    const names = MEMBERS[q.faction];
    chosen.push({ ...q, member: names[chosen.filter((c) => c.faction === q.faction).length % names.length] });
  }
  s.hearing = { opened: s.day, provisional, questions: chosen, answers: {} };
  feed(s, 'info', `Budget hearing: the Defence Committee wants answers before it sets next year's budget. The provisional figure is $${provisional}M a month.`, undefined, true);
}

/** Weighted Committee support for a bigger budget, 0..1. */
export function support(s: SimState): number {
  return FACTION_IDS.reduce((a, f) => a + FACTIONS[f].weight * s.strategy.factions[f], 0) / 100;
}

export function requestOdds(s: SimState, level: RequestLevel): number {
  const v = support(s) + (avgReadiness(s) - 0.7) * 0.5;
  if (level === 'modest') return clamp(v * 1.3, 0.1, 0.95);
  if (level === 'bold') return clamp(v * 0.95 - 0.1, 0.05, 0.85);
  return 1;
}

export function validateHearing(s: SimState, a: { type: string; question?: string; option?: string; level?: RequestLevel }): string | null {
  const h = s.hearing;
  if (!h) return 'No hearing is sitting.';
  if (a.type === 'hearingAnswer') {
    const q = h.questions.find((x) => x.id === a.question);
    if (!q) return 'No such question.';
    if (h.answers[q.id]) return 'Already answered.';
    return q.options.some((o) => o.id === a.option) ? null : 'No such answer.';
  }
  if (a.type === 'hearingRequest') {
    if (!(a.level! in REQUESTS)) return 'No such request.';
    return h.questions.every((q) => h.answers[q.id]) ? null : 'Answer every question first.';
  }
  return null;
}

export function answer(s: SimState, question: string, option: string, feed: Feed): void {
  const h = s.hearing!;
  const q = h.questions.find((x) => x.id === question)!;
  const o = q.options.find((x) => x.id === option)!;
  h.answers[q.id] = o.id;
  for (const [f, v] of Object.entries(o.sway) as [FactionId, number][]) s.strategy.factions[f] = clamp(s.strategy.factions[f] + v);
  if (o.promise) {
    s.promises.push({ id: s.nextId++, kind: o.promise.kind, text: o.promise.text, faction: o.promise.faction, made: s.day, due: s.day + 360, base: ownLines(s), research: o.promise.research });
    feed(s, 'info', `You promise the Committee: ${o.promise.text}`);
  }
}

export function request(s: SimState, level: RequestLevel, feed: Feed): void {
  const h = s.hearing!;
  const f = s.strategy.factions;
  let budget = h.provisional;
  if (level === 'lean') {
    budget = Math.round(budget * 0.95);
    f.treasury = clamp(f.treasury + 8);
    feed(s, 'info', `You ask for less. The Committee sets your budget at $${budget}M a month.`, undefined, true);
  } else if (level === 'accept') {
    feed(s, 'info', `The Committee sets your budget at $${budget}M a month.`, undefined, true);
  } else {
    const r = REQUESTS[level];
    if (rand(s) < requestOdds(s, level)) {
      budget = Math.round(budget * (1 + r.change));
      s.month.won = true;
      feed(s, 'good', `The Committee grants your request: $${budget}M a month.`, undefined, true);
    } else {
      budget = Math.round(budget * (level === 'bold' ? 0.97 : 0.99));
      s.confidence = clamp(s.confidence - (level === 'bold' ? 3 : 1));
      feed(s, 'bad', `The Committee votes your request down and sets the budget at $${budget}M a month.`, undefined, true);
    }
  }
  s.appropriation = budget;
  s.hearing = null;
}

/** A hearing left open past its month closes with the default answers and the provisional budget. */
export function closeStaleHearing(s: SimState, feed: Feed): void {
  const h = s.hearing;
  if (!h || s.day <= h.opened) return;
  for (const q of h.questions) if (!h.answers[q.id]) answer(s, q.id, q.fallback, feed);
  request(s, 'accept', feed);
}

/** Checks promises: some can break at any month's end, all are judged when due. */
export function promisesMonth(s: SimState, feed: Feed): void {
  for (const p of [...s.promises]) {
    let verdict: 'kept' | 'broken' | null = null;
    const since = s.history.filter((h) => h.month * 30 >= p.made);
    switch (p.kind) {
      case 'solvent':
        if (s.treasury < 0) verdict = 'broken';
        break;
      case 'noExports':
        if ((s.month.exported ?? 0) > 0) verdict = 'broken';
        break;
      case 'peace':
        if ((s.month.strikes ?? 0) > 0) verdict = 'broken';
        break;
      case 'newPlant':
        if (ownLines(s) > (p.base ?? 0)) verdict = 'kept';
        break;
      case 'counter':
        if (p.research && hasResearch(s, p.research)) verdict = 'kept';
        break;
      case 'cyber':
        if (s.cyber && Object.values(s.cyber.levels).every((v) => v >= 2)) verdict = 'kept';
        break;
      case 'vetting':
        if (SITES.filter((d) => d.owner === 'state' && s.sites[d.id].processes.length && !s.sites[d.id].mothballed).every((d) => (s.sites[d.id].clearance ?? 0) >= 1)) verdict = 'kept';
        break;
    }
    if (!verdict && s.day >= p.due) {
      if (p.kind === 'readiness') verdict = (since.length ? since.reduce((a, h) => a + h.readiness, 0) / since.length : 0) >= 0.8 ? 'kept' : 'broken';
      else if (p.kind === 'solvent' || p.kind === 'noExports' || p.kind === 'peace') verdict = 'kept';
      else verdict = 'broken';
    }
    if (!verdict) continue;
    s.promises = s.promises.filter((x) => x.id !== p.id);
    if (verdict === 'kept') {
      s.confidence = clamp(s.confidence + 4);
      s.strategy.factions[p.faction] = clamp(s.strategy.factions[p.faction] + 5);
      s.promisesKept = (s.promisesKept ?? 0) + 1;
      feed(s, 'good', `Promise kept: ${p.text} The ${FACTIONS[p.faction].name.toLowerCase()} take note.`, undefined, true);
    } else {
      s.confidence = clamp(s.confidence - 6);
      s.strategy.factions[p.faction] = clamp(s.strategy.factions[p.faction] - 8);
      feed(s, 'bad', `Promise broken: ${p.text} The ${FACTIONS[p.faction].name.toLowerCase()} will not forget it.`, undefined, true);
    }
  }
}
