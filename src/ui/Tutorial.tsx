import type { TabId } from './App';
import { Btn } from './kit';

interface Step {
  tab: TabId;
  title: string;
  text: string;
}

export const STEPS: Step[] = [
  {
    tab: 'overview',
    title: 'Welcome, Director',
    text: 'You run the munitions production board of a fictional nation. Keep the national reserve stocked, the money flowing and the Defence Committee confident, for four years. The bar at the top shows the essentials: treasury, budget, readiness and confidence.',
  },
  {
    tab: 'overview',
    title: 'The reserve',
    text: 'On the right: each interceptor and artillery type, against a goal of 6 months of calm-time draw. Every month, threats arrive and rounds leave the reserve. When a type runs dry, threats get through.',
  },
  {
    tab: 'supply',
    title: 'Supply chain',
    text: 'Seven shared components feed every line. Your starting contracts run out in 9 months and only cover 85% of what the lines need, so sign new ones here. Then look at the suppliers that are not qualified yet: qualifying a second source takes months, so start before trouble hits.',
  },
  {
    tab: 'plants',
    title: 'Plants and lines',
    text: 'Three campuses, seven lines. Each line is a chain of stages, from motors through guidance and assembly to acceptance test: watch for the bottleneck and widen it. Acceptance shares each campus\'s test cells. Surge for 30% more output, expand into free bays (new capacity is inspected, then ramps up from 30%), retool, and upgrade.',
  },
  {
    tab: 'workforce',
    title: 'Workforce',
    text: 'Every bay needs crew. New hires train for months before they count, and the local hiring pool is limited. Keep morale up, or face strike votes.',
  },
  {
    tab: 'intel',
    title: 'Intel and doctrine',
    text: 'The forecast shows the next three months of draw. Crises give about two months of warning. Doctrine decides whether $4M missiles may be fired at $35K drones.',
  },
  {
    tab: 'partners',
    title: 'Partners',
    text: 'Partner nations post tenders. Accepting earns money and goodwill, but partners are served before your own reserve. Deliver late and you pay penalties.',
  },
  {
    tab: 'ledger',
    title: 'The ledger',
    text: 'Where the money goes, and the cost exchange: interceptor dollars fired against threat dollars stopped. Every year the Committee reviews you and sets your next budget.',
  },
  {
    tab: 'overview',
    title: 'Your move',
    text: 'The advisor panel suggests moves (one click on Easy, hints on Normal, silence on Hard). Decision cards appear here too. When you are ready, press End month. The Guide tab explains everything in detail.',
  },
];

export default function Tutorial({ step, onStep, onDone }: { step: number; onStep: (n: number) => void; onDone: () => void }) {
  const s = STEPS[step];
  if (!s) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 p-3" role="dialog" aria-label="Tutorial">
      <div className="panel mx-auto max-w-3xl border-ops-cyan/60 p-4 shadow-2xl">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-sans text-[17px] font-semibold text-ops-cyan">{s.title}</h2>
          <span className="text-[10px] text-ops-dim">
            {step + 1} / {STEPS.length}
          </span>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-ops-text">{s.text}</p>
        <div className="mt-3 flex justify-between gap-2">
          <Btn onClick={onDone}>Skip tutorial</Btn>
          <div className="flex gap-2">
            {step > 0 && <Btn onClick={() => onStep(step - 1)}>Back</Btn>}
            {step < STEPS.length - 1 ? (
              <Btn kind="primary" onClick={() => onStep(step + 1)}>
                Next
              </Btn>
            ) : (
              <Btn kind="primary" onClick={onDone}>
                Start playing
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
