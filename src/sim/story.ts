// The story campaign: four chapters, a year each, with recurring characters and consequences that carry forward.
import { BASE_LINES, CRISES } from './fight';
import { startChain } from './living';
import { clamp } from './rng';
import { baseDailyDraw, lotQty, nationalStock, readiness, reserveTarget } from './selectors';
import type { FeedItem, Headline, SimState } from './types';
import { SITES, SITE_BY_ID, type LineId } from './world';

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

export type CharacterId = 'chair' | 'intel' | 'union' | 'general' | 'industry';
export const CHARACTERS: Record<CharacterId, { name: string; role: string }> = {
  chair: { name: 'Dame Orla Venn', role: 'Chair of the Defence Committee' },
  intel: { name: 'Colonel Sara Imre', role: 'Head of Defence Intelligence' },
  union: { name: 'Ewan Pryce', role: 'General Secretary, Munitions Workers’ Union' },
  general: { name: 'General Tomas Arke', role: 'Chief of the Defence Staff' },
  industry: { name: 'Mira Holt', role: 'Managing Director, Kestrel Propulsion' },
};

export interface StoryState {
  chapter: number;
  /** Day the current chapter began. */
  started: number;
  /** Running counts kept while a chapter is played. */
  counts: Record<string, number>;
  /** What happened in earlier chapters, for the next ones to react to. */
  results: { chapter: number; met: string[]; missed: string[] }[];
  /** A briefing waiting to be read. */
  briefing: number | null;
}

interface Goal {
  id: string;
  text: string;
  check: (s: SimState) => boolean;
}

export interface Chapter {
  title: string;
  speaker: CharacterId;
  briefing: (s: SimState) => string[];
  goals: Goal[];
  /** What changes in the world as the chapter opens. */
  open: (s: SimState, feed: Feed) => void;
}

export const CHAPTER_DAYS = 360;
const AIR: LineId[] = ['tamir', 'irist', 'stinger'];
const met = (s: SimState, chapter: number, goal: string) => !!s.story?.results.find((r) => r.chapter === chapter)?.met.includes(goal);
const arsenals = () => SITES.filter((d) => d.owner === 'state' && d.kind === 'arsenal').map((d) => d.id);

/** Bases in the north with nothing ready to fire. */
export function emptyNorthernBases(s: SimState): string[] {
  const out: string[] = [];
  for (const def of SITES.filter((d) => d.region === 'north' && BASE_LINES[d.kind])) {
    for (const l of BASE_LINES[def.kind]!) if (s.lines[l].unlocked && baseDailyDraw(s, def.id, l) > 0 && lotQty(s.sites[def.id].lots[l]) < 1) out.push(def.id);
  }
  return [...new Set(out)];
}

export const CHAPTERS: Chapter[] = [
  {
    title: 'Inheritance',
    speaker: 'chair',
    briefing: () => [
      'Director, welcome. You have inherited a reserve that looks large on paper and is old in the depots. Much of it retires within two years.',
      'The Committee wants three things from your first year: a second source for something we buy from a single supplier, a contract won in open competition, and readiness of at least seventy per cent when we meet again.',
      'Do this, and I can defend your budget. Fail, and I cannot promise anything.',
    ],
    goals: [
      { id: 'secondSource', text: 'Qualify a supplier that was not qualified at the start', check: (s) => (s.story?.counts.qualified ?? 0) > 0 },
      { id: 'tender', text: 'Award a contract through a tender', check: (s) => (s.story?.counts.awarded ?? 0) > 0 },
      { id: 'ready70', text: 'Readiness of 70% or more at the end of the year', check: (s) => readiness(s) >= 0.7 },
    ],
    open: () => {},
  },
  {
    title: 'Shadows in the East',
    speaker: 'intel',
    briefing: (s) => [
      met(s, 0, 'ready70') ? 'The Chair tells me your first year went well. Good, because I bring bad news.' : 'The Chair is not happy with your first year, and has trimmed your budget. I am afraid I bring worse news.',
      'The Vardan Directorate has started work on something new. You will have my report within days. Whatever it is, I want a counter in production before it is in the field.',
      'And Director: our short-range air defence is thin. Tamir, IRIS-T and Stinger must all be at eighty per cent of target by the end of the year. If our own industry cannot keep up, build some of it yourself.',
    ],
    goals: [
      { id: 'counter', text: 'Finish the counter to the Directorate’s first new weapon', check: (s) => !!s.rival.known[0] && s.strategy.research.done.some((r) => r === counterOf(s, 0)) },
      { id: 'air80', text: 'Tamir, IRIS-T and Stinger each at 80% of target at the end of the year', check: (s) => AIR.every((l) => nationalStock(s, l) >= reserveTarget(s, l) * 0.8) },
      { id: 'plant', text: 'Found a plant or bring a part in-house', check: (s) => (s.story?.counts.founded ?? 0) > 0 },
    ],
    open: (s, feed) => {
      // The rival moves early in this chapter.
      s.rival.next = Math.min(s.rival.next, s.day + 10);
      if (met(s, 0, 'ready70')) {
        s.appropriation = Math.round(s.appropriation * 1.05);
        s.strategy.baseBudget = Math.round(s.strategy.baseBudget * 1.05);
        feed(s, 'good', 'Dame Orla Venn wins you a 5% larger budget for the year ahead.');
      } else {
        s.appropriation = Math.round(s.appropriation * 0.95);
        s.strategy.baseBudget = Math.round(s.strategy.baseBudget * 0.95);
        feed(s, 'bad', 'The Committee trims your budget by 5%.');
      }
    },
  },
  {
    title: 'Hands on the Line',
    speaker: 'union',
    briefing: (s) => [
      'Director. My members build every round you count. Prices have gone up and their pay has not, and some of your plants are not safe places to work.',
      'There is a claim on your desk. Settle it fairly and there will be no strike this year. Show me safety programmes at two of your arsenals, and keep morale where people can be proud of the work.',
      met(s, 1, 'plant') ? 'I hear you have opened new works. That was well received on the shop floors.' : 'I will say this plainly: we have seen no new jobs from you yet.',
    ],
    goals: [
      { id: 'noStrike', text: 'No strike at your plants this year', check: (s) => (s.story?.counts.strikes ?? 0) === 0 },
      { id: 'safety', text: 'A safety programme at two arsenals', check: (s) => arsenals().filter((id) => s.sites[id].safety >= 1).length >= 2 },
      { id: 'morale', text: 'Average arsenal morale of 55 or more at the end of the year', check: (s) => arsenals().reduce((a, id) => a + s.sites[id].morale, 0) / arsenals().length >= 55 },
    ],
    open: (s, feed) => {
      if (met(s, 1, 'plant')) s.strategy.factions.regions = clamp(s.strategy.factions.regions + 5);
      startChain(s, 'labour', feed);
    },
  },
  {
    title: 'The Long Winter',
    speaker: 'general',
    briefing: (s) => [
      'Director, the north is under attack, and winter is coming. Meric and the Riverline will need every round you can get to them, with the sea lanes freezing and the roads under snow.',
      'No northern base runs dry. Readiness at eighty per cent when the year is out. And keep the Committee with you: confidence of fifty or more.',
      met(s, 2, 'morale') ? 'Your plants are in good heart. That will matter.' : 'I am told your plants are tired and unhappy. That worries me more than the Directorate does.',
    ],
    goals: [
      { id: 'north', text: 'No northern base empty at the end of the year', check: (s) => emptyNorthernBases(s).length === 0 },
      { id: 'ready80', text: 'Readiness of 80% or more at the end of the year', check: (s) => readiness(s) >= 0.8 },
      { id: 'conf50', text: 'Confidence of 50 or more at the end of the year', check: (s) => s.confidence >= 50 },
    ],
    open: (s, feed) => {
      if (!met(s, 2, 'morale')) for (const id of arsenals()) s.sites[id].morale = clamp(s.sites[id].morale - 10);
      const c = CRISES.find((x) => x.id === 'meric') ?? CRISES[0];
      s.crisis = { id: c.id, name: c.name, region: c.region, family: c.family, phase: 'warning', days: 75, intensity: 1.2, mix: { ...c.mix } };
      feed(s, 'warn', `Intel: the ${c.name} is coming, with winter. Stock the north now.`, SITE_BY_ID.depotNorth ? 'depotNorth' : undefined, true);
    },
  },
];

function counterOf(s: SimState, i: number) {
  const k = s.rival.known[i];
  return k ? COUNTERS[k.id] : undefined;
}
const COUNTERS: Record<string, string> = { swarms: 'swarmControl', fastCruise: 'networkedFire', manoeuvring: 'seekerSoftware', decoys: 'discrimination', barrages: 'tamirSecondLine', armour: 'precisionKits' };

export const newStory = (day: number): StoryState => ({ chapter: 0, started: day, counts: {}, results: [], briefing: 0 });

/** Counts today's events that goals depend on, and closes chapters at the end of each year. */
export function storyDay(s: SimState, feed: Feed): void {
  const st = s.story;
  if (!st) return;
  for (const f of s.feed) {
    if (f.day !== s.day) continue;
    if (f.text.includes('is qualified to supply')) st.counts.qualified = (st.counts.qualified ?? 0) + 1;
    if (f.text.startsWith('Strike at')) st.counts.strikes = (st.counts.strikes ?? 0) + 1;
  }
  if (s.day < st.started + CHAPTER_DAYS || st.chapter >= CHAPTERS.length) return;
  const ch = CHAPTERS[st.chapter];
  const results = { chapter: st.chapter, met: ch.goals.filter((g) => g.check(s)).map((g) => g.id), missed: ch.goals.filter((g) => !g.check(s)).map((g) => g.id) };
  st.results.push(results);
  const who = CHARACTERS[ch.speaker];
  s.confidence = clamp(s.confidence + (results.met.length - 1.5) * 3);
  feed(s, results.met.length >= 2 ? 'good' : 'bad', `Chapter ${st.chapter + 1}, “${ch.title}”, ends: ${results.met.length} of ${ch.goals.length} goals met.`, undefined, true);
  s.news.push({ month: Math.floor((s.day - 1) / 30), special: `${ch.title}: the year in review`, headlines: chapterHeadlines(s, st.chapter, results.met.length, who.name) });
  st.chapter++;
  st.started = s.day;
  st.counts = {};
  if (st.chapter < CHAPTERS.length) {
    CHAPTERS[st.chapter].open(s, feed);
    st.briefing = st.chapter;
  }
}

function chapterHeadlines(s: SimState, chapter: number, metCount: number, speaker: string): Headline[] {
  const ch = CHAPTERS[chapter];
  const r = s.story!.results.find((x) => x.chapter === chapter)!;
  return [
    { tone: metCount >= 2 ? 'good' : 'bad', title: metCount === 3 ? `A triumphant year: ${speaker} is delighted` : metCount === 2 ? `A solid year, says ${speaker}` : `A difficult year for the Board`, body: `The Board met ${metCount} of the ${ch.goals.length} goals set for “${ch.title}”.` },
    ...ch.goals.map((g) => ({ tone: (r.met.includes(g.id) ? 'good' : 'warn') as Headline['tone'], title: `${r.met.includes(g.id) ? 'Done' : 'Missed'}: ${g.text}`, body: r.met.includes(g.id) ? 'The Committee notes it.' : 'The Committee will remember.' })),
  ];
}

export function chapterGoals(s: SimState) {
  const st = s.story;
  if (!st || st.chapter >= CHAPTERS.length) return [];
  return CHAPTERS[st.chapter].goals.map((g) => ({ id: g.id, text: g.text, ok: g.check(s) }));
}

/** The closing words, from how many goals were met in all. */
export function epilogue(s: SimState): string {
  const total = s.story?.results.reduce((a, r) => a + r.met.length, 0) ?? 0;
  if (total >= 10) return 'Four years on, the Commonwealth has the strongest munitions industry in its history. Dame Orla Venn calls it the finest stewardship she has seen. Your portrait will hang at the Board.';
  if (total >= 7) return 'You leave the Board in better shape than you found it. There were hard years, but the racks are fuller and the industry stronger. The Committee thanks you.';
  if (total >= 4) return 'You held things together, mostly. Your successor inherits real problems, and some real foundations too.';
  return 'It was a difficult four years. The Committee’s report is polite, and brief.';
}
