// The tutorial coach: one step at a time, each finished by doing it.
import { useEffect } from 'react';
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
  /** What to ring on screen, first match that is showing: e.g. the tab itself, or its group until that is open. */
  ring?: string[];
}

export const TUTORIAL_DONE = 99;
/** Skipped rather than finished: no achievement. */
export const TUTORIAL_SKIPPED = 100;

export const STEPS: Step[] = [
  {
    title: 'Welcome, Director',
    // Three things only (20.1.1): the goal, the threat, and the one action. The rest is taught where it is used.
    text: 'You run the munitions industry of Aldmere. Your goal: a year’s supply of every round in reserve. If the Committee’s confidence (top bar) falls to zero, you are dismissed. Press Space or the play button to start the clock.',
    done: (_s, ui) => ui.speed > 0,
    ring: ['.fc-clock-pause'],
  },
  {
    title: 'Your arsenals',
    text: 'The square cyan markers are yours. Click Corran Valley Works, just west of Corran, to inspect it: what it makes, what limits it, and its crew.',
    done: (_s, ui) => ui.selected === 'corranWorks' && ui.panel === 'site',
  },
  {
    title: 'Look a year ahead',
    text: 'Open the Plan tab, under Production. It shows each round’s stock, the Committee’s target, and a forecast for the next twelve months.',
    done: (_s, ui) => ui.panel === 'plan',
    ring: ['[data-panel="plan"]', '[data-group="production"]'],
  },
  {
    title: 'Find the weak link',
    text: 'Under “What limits it”, click any material. The Materials tab traces it from round to mine, with every site that makes it.',
    done: (_s, ui) => ui.panel === 'material',
  },
  {
    title: 'Buy at a better price',
    text: 'The starting contracts end after nine months; after that you pay 30% over list. Open Markets, under Supply, and open a tender for something your arsenals use.',
    ring: ['[data-panel="markets"]', '[data-group="supply"]'],
    done: (s) => s.tenders.length > 0 || s.feed.some((f) => f.text.startsWith('Contract awarded')),
  },
  {
    title: 'Award the contract',
    text: 'Suppliers bid at once. Pick a cheap bid with good reliability and press Award.',
    done: (s) => s.feed.some((f) => f.text.startsWith('Contract awarded')),
  },
  {
    title: 'People and projects',
    text: 'Open the Board, under Command. Hire someone for a key post, and start a research project. Both pay off for years.',
    ring: ['[data-panel="strategy"]', '[data-group="home"]'],
    done: (s) => Object.values(s.strategy.staff).some(Boolean) && (s.strategy.research.active !== null || s.strategy.research.done.length > 0),
  },
  {
    title: 'Your engineers',
    text: 'Open the Staff tab, under People. Your research project and every plant line need engineers. Too few and plants lose output and research slows. Hire from the market, or found an academy for the long run.',
    done: (_s, ui) => ui.panel === 'staff',
    ring: ['[data-panel="staff"]', '[data-group="people"]'],
  },
  {
    title: 'The towns around you',
    text: 'Open the Towns tab, under People. Every town has a mood toward you. Jobs and housing lift it; an unhappy town strikes, protests and objects to new plants.',
    done: (_s, ui) => ui.panel === 'towns',
    ring: ['[data-panel="towns"]', '[data-group="people"]'],
  },
  {
    title: 'Keep watch',
    text: 'The Home tab shows what needs you now and the advisor’s next best moves; “Take the safe advice” does what your chief of staff would, within your reserve, and “Why short?” traces a struggling round to its root cause. The clock pauses itself when something big happens; the bars beside the play button set the speed, a number on a tab shows how many things there need you, and Search (Ctrl K) finds any tab, site or command. Let three months pass.',
    done: (s, _ui, start) => s.history.length >= start.history.length + 3 || s.history.length >= 3,
    ring: ['[data-panel="home"]', '[data-group="home"]'],
  },
];

export function TutorialCard({ state, onStep }: { state: SimState; onStep: (step: number) => void }) {
  const step = state.tutorial?.step ?? TUTORIAL_DONE;
  const finished = step >= STEPS.length;
  const st = STEPS[Math.min(step, STEPS.length - 1)];
  // The ring is set before any early return, so the hooks run in the same order every time.
  useCoachRing(finished || step >= TUTORIAL_DONE ? undefined : st.ring);
  if (step >= TUTORIAL_DONE) return null;
  return (
    <section className="fc-coach-card px-3 py-2 text-[11px]" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label !text-ops-amber">{finished ? 'Tutorial complete' : `Tutorial · step ${step + 1} of ${STEPS.length}`}</span>
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

/** Rings the first showing element of a step's targets, following it as tabs change; removes the ring when done. */
function useCoachRing(targets: string[] | undefined): void {
  const key = targets?.join('|') ?? '';
  useEffect(() => {
    if (!targets?.length) return;
    let ringed: Element | null = null;
    const place = () => {
      const next = targets.map((t) => document.querySelector(t)).find((el) => el && (el as HTMLElement).offsetParent !== null) ?? null;
      // React may rewrite the element's classes when it redraws: put the ring back if it was wiped.
      if (next === ringed) {
        if (next && !next.classList.contains('fc-coach')) next.classList.add('fc-coach');
        return;
      }
      ringed?.classList.remove('fc-coach');
      next?.classList.add('fc-coach');
      ringed = next;
    };
    place();
    const t = window.setInterval(place, 500);
    return () => {
      window.clearInterval(t);
      ringed?.classList.remove('fc-coach');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
