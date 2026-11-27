// The playtest feedback form (19.3.5): the questions, and the plain-text report they make. The game has no server, so
// nothing is sent anywhere: the player copies the report or saves it as a file and passes it on themselves. The
// questions match the playtest brief (docs/playtest.md), so answers from every tester line up.
import { readiness } from '../sim/selectors';
import { SCENARIOS } from '../sim/setup';
import type { SimState } from '../sim/types';
import { dateLabel } from './useSim';
import { money } from '../sim/money';

/** A question with a scale from 1 to 5, its two ends named. */
export interface ScaleQuestion {
  id: string;
  kind: 'scale';
  text: string;
  low: string;
  high: string;
}
/** A question with a few fixed answers. */
export interface PickQuestion {
  id: string;
  kind: 'pick';
  text: string;
  options: string[];
}
/** A question answered in the player's own words. */
export interface TextQuestion {
  id: string;
  kind: 'text';
  text: string;
  hint: string;
}
export type Question = ScaleQuestion | PickQuestion | TextQuestion;

export const QUESTIONS: Question[] = [
  { id: 'clear', kind: 'scale', text: 'How clear was it what to do next?', low: 'Lost', high: 'Always clear' },
  { id: 'fair', kind: 'scale', text: 'How fair did the game feel?', low: 'Unfair', high: 'Fair' },
  { id: 'pace', kind: 'pick', text: 'How was the pace?', options: ['Too slow', 'About right', 'Too fast'] },
  { id: 'again', kind: 'pick', text: 'Would you play another term?', options: ['Yes', 'Maybe', 'No'] },
  { id: 'confused', kind: 'text', text: 'What confused you, and where?', hint: 'A screen, a number, a word you did not follow.' },
  { id: 'enjoyed', kind: 'text', text: 'What did you enjoy most?', hint: 'A moment, a choice, a screen.' },
  { id: 'broken', kind: 'text', text: 'Did anything look broken or wrong?', hint: 'Text over text, a button that did nothing, a number that made no sense.' },
];

export type Answers = Record<string, string | number | undefined>;

/** What the report says about the game, so a reader knows where the player was. No personal details. */
export function gameContext(s: SimState, version: string, viewport: { w: number; h: number }): string[] {
  const mode = s.careerId ? 'career' : s.tutorial ? 'tutorial' : s.story ? 'story' : 'single term';
  return [
    `Version: ${version}`,
    `Mode: ${mode} · ${SCENARIOS[s.scenario].name} · ${s.difficulty}`,
    `Map: ${s.world !== null ? `generated, seed ${s.world}` : 'Classic Aldmere'}`,
    `Date: ${dateLabel(s.day)} (day ${s.day} of ${s.days})${s.over ? ' · term over' : ''}`,
    `Readiness ${Math.round(readiness(s) * 100)}% · confidence ${Math.round(s.confidence)} · treasury ${money(s.treasury)}`,
    `Window: ${viewport.w}×${viewport.h}`,
  ];
}

/** The report as plain text: the answers, then (if the player keeps it) where they were in the game. */
export function feedbackReport(answers: Answers, context: string[] | null): string {
  const lines = ['Forge Command playtest feedback', ''];
  for (const q of QUESTIONS) {
    const a = answers[q.id];
    const shown = a === undefined || a === '' ? '(no answer)' : q.kind === 'scale' ? `${a} of 5` : String(a).trim();
    lines.push(q.text, `  ${shown.replace(/\n/g, '\n  ')}`, '');
  }
  if (context) lines.push('About this game', ...context.map((c) => `  ${c}`), '');
  return lines.join('\n');
}

/** True once at least one question has an answer, so the buttons do not hand on an empty form. */
export const hasAnswer = (answers: Answers) => QUESTIONS.some((q) => answers[q.id] !== undefined && String(answers[q.id]).trim() !== '');
