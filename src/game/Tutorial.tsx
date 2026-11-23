// The tutorial coach: one step at a time, each finished by doing it.
import type { SimState } from '../sim/types';
import { Btn } from '../ui/kit';

export interface TutorialUi {
  panel: string;
  selected: string | null;
  speed: number;
}

interface Step {
  title: string;
  text: string;
  done: (s: SimState, ui: TutorialUi, start: SimState) => boolean;
}

export const TUTORIAL_DONE = 99;
/** Skipped rather than finished: no achievement. */
export const TUTORIAL_SKIPPED = 100;

export const STEPS: Step[] = [
  {
    title: 'Welcome, Director',
    text: 'You run the munitions industry of Aldmere, from the mines to the launchers. Time is paused. Press the 1× button at the top, or Space, to start the clock.',
    done: (_s, ui) => ui.speed > 0,
  },
  {
    title: 'Your arsenals',
    text: 'The square cyan markers are yours. Click Corran Valley Works, just west of Corran, to inspect it: what it makes, what limits it, and its crew.',
    done: (_s, ui) => ui.selected === 'corranWorks' && ui.panel === 'site',
  },
  {
    title: 'Look a year ahead',
    text: 'Open the Plan tab. It shows each round’s stock, the Committee’s target, and a forecast for the next twelve months.',
    done: (_s, ui) => ui.panel === 'plan',
  },
  {
    title: 'Find the weak link',
    text: 'Under “What limits it”, click any material. The Materials tab traces it from round to mine, with every site that makes it.',
    done: (_s, ui) => ui.panel === 'material',
  },
  {
    title: 'Buy at a better price',
    text: 'The starting contracts end after nine months; after that you pay 30% over list. Open Markets and open a tender for something your arsenals use.',
    done: (s) => s.tenders.length > 0 || s.feed.some((f) => f.text.startsWith('Contract awarded')),
  },
  {
    title: 'Award the contract',
    text: 'Suppliers bid at once. Pick a cheap bid with good reliability and press Award.',
    done: (s) => s.feed.some((f) => f.text.startsWith('Contract awarded')),
  },
  {
    title: 'People and projects',
    text: 'Open the Board. Hire someone for a key post, and start a research project. Both pay off for years.',
    done: (s) => Object.values(s.strategy.staff).some(Boolean) && (s.strategy.research.active !== null || s.strategy.research.done.length > 0),
  },
  {
    title: 'Keep watch',
    text: 'The Watch tab lists what needs you, most urgent first, and the clock pauses itself when something big happens. Let three months pass.',
    done: (s, _ui, start) => s.history.length >= start.history.length + 3 || s.history.length >= 3,
  },
];

export function TutorialCard({ state, onStep }: { state: SimState; onStep: (step: number) => void }) {
  const step = state.tutorial?.step ?? TUTORIAL_DONE;
  if (step >= TUTORIAL_DONE) return null;
  const finished = step >= STEPS.length;
  const st = STEPS[Math.min(step, STEPS.length - 1)];
  return (
    <section className="border-b border-ops-cyan/40 bg-ops-cyan/5 px-3 py-2 text-[11px]" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label text-ops-cyan">{finished ? 'Tutorial complete' : `Tutorial · step ${step + 1} of ${STEPS.length}`}</span>
        <Btn onClick={() => onStep(finished ? TUTORIAL_DONE : TUTORIAL_SKIPPED)}>{finished ? 'Close' : 'Skip tutorial'}</Btn>
      </div>
      {finished ? (
        <p className="mt-1 text-ops-text">That is the job. The first crisis can come any time after the first year. The Guide tab has the rest. Good luck.</p>
      ) : (
        <>
          <h3 className="mt-1 font-sans text-[14px] font-semibold text-white">{st.title}</h3>
          <p className="text-ops-text">{st.text}</p>
        </>
      )}
    </section>
  );
}
