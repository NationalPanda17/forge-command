// The tutorial coach: one step at a time, each finished by doing it.
import { useEffect } from 'react';
import type { SimState } from '../sim/types';
import CORE from '../sim/tuning/core.json';
import { RECIPES, SITES, type MaterialId } from '../sim/world';
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

const INCIDENT = CORE.opening.incident;

/** The opening incident (20.2), if it has happened: the supplier, and the materials it makes for you. */
export function openingTrouble(s: SimState): { site: string; day: number; materials: MaterialId[] } | null {
  const f = s.feed.find((x) => x.site && x.day <= INCIDENT.dayMax && / at .+: output down to \d+%/.test(x.text));
  if (!f?.site) return null;
  const materials = s.sites[f.site].processes.map((p) => RECIPES[p.recipe].output);
  return { site: f.site, day: f.day, materials };
}

/**
 * Whether the player has answered the opening incident: a tender for what the supplier makes, a contract with someone
 * else for it, or a second maker being qualified. With no incident (it can be absent), there is nothing to answer.
 */
export function answered(s: SimState): boolean {
  const t = openingTrouble(s);
  if (!t) return s.day > INCIDENT.dayMax + 5;
  const makes = (id: string) => s.sites[id].processes.some((p) => t.materials.includes(RECIPES[p.recipe].output));
  return (
    s.tenders.some((x) => t.materials.includes(x.material)) ||
    s.contracts.some((c) => c.site !== t.site && t.materials.includes(c.material)) ||
    SITES.some((d) => d.owner !== 'state' && d.id !== t.site && makes(d.id) && (s.sites[d.id].qualifyingDays !== null || (s.sites[d.id].qualified && !d.qualified)))
  );
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
    title: 'Trouble is coming',
    // The tutorial teaches by solving a real problem (20.7, design pass C7): the opening incident (20.2) gives it one.
    text: 'Speed up the clock (press 3). Before long one of your suppliers will run into trouble, and the game will pause when it does.',
    done: (s) => openingTrouble(s) !== null || s.day > INCIDENT.dayMax + 5,
    ring: ['.fc-clock-pause'],
  },
  {
    title: 'Answer it',
    text: 'A supplier you buy from has broken down. On Home, the advisor’s Next step says what to do about it, and the line marked ↳ says what that will do. Press Do it.',
    done: (s) => answered(s),
    ring: ['[data-panel="home"]', '[data-group="home"]'],
  },
  {
    title: 'Award the contract',
    text: 'Bids for your tender come in within a month, under Supply, Markets. Pick a cheap bid with good reliability and press Award.',
    // Only when a tender was the answer: a second source being qualified needs nothing more now.
    done: (s) => {
      const t = openingTrouble(s);
      return !t || !s.tenders.some((x) => t.materials.includes(x.material));
    },
    ring: ['[data-panel="markets"]', '[data-group="supply"]'],
  },
  {
    title: 'People and projects',
    text: 'Open the Board, under Command. Hire someone for a key post, and start a research project. Both pay off for years. (Your engineers and the towns around your plants are under People; a field note explains each when it matters.)',
    ring: ['[data-panel="strategy"]', '[data-group="home"]'],
    done: (s) => Object.values(s.strategy.staff).some(Boolean) && (s.strategy.research.active !== null || s.strategy.research.done.length > 0),
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
