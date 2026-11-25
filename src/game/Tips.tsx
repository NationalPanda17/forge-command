// Field notes: a short tip the first time each system shows up in a game, with a button to the tab that handles it.
// Shown once per game (remembered in the save), and can be turned off for every game in this browser.
import type { SimState } from '../sim/types';
import { coverage } from '../sim/engineers';
import { Btn } from '../ui/kit';
import type { PanelId } from './Shell';

export interface Tip {
  id: string;
  title: string;
  text: string;
  panel: PanelId;
  when: (s: SimState, recent: string[]) => boolean;
}

const seen = (recent: string[], re: RegExp) => recent.some((t) => re.test(t));

export const TIPS: Tip[] = [
  { id: 'hearing', title: 'The budget hearing', text: 'The Committee is sitting and the clock is held. Answer each question: readiness and a clean record win money, and promises you make are checked a year from now.', panel: 'strategy', when: (s) => !!s.hearing },
  { id: 'claim', title: 'A union claim', text: 'A union wants more pay, shorter hours or safer work. Refuse and you risk a strike that can spread to other plants in the town; a deal costs money but cools things down.', panel: 'strategy', when: (_s, r) => seen(r, /claim (in|at) .*A decision is waiting/) },
  { id: 'strike', title: 'A strike', text: 'Strikes cut a plant to 30% for weeks. A strong union in the same town makes the next one likelier. Pay deals and housing lower union strength (Towns tab).', panel: 'towns', when: (_s, r) => seen(r, /^Strike at/) },
  { id: 'blackout', title: 'A blackout', text: 'The grid in a region has failed and its plants are running down. Backup generators keep a plant at 70%; new generating capacity makes blackouts rarer.', panel: 'power', when: (s) => !!s.energy && Object.values(s.energy.grids).some((g) => g.outage > 0) },
  { id: 'audit', title: 'The Auditor-General', text: 'Twice a year the Auditor-General reviews your spending. Buying on contract instead of the open market and keeping idle lines down keep waste low.', panel: 'money', when: (_s, r) => seen(r, /Auditor-General's review/) },
  { id: 'cyber', title: 'Hackers', text: 'The rival’s hackers hit control systems, the rail booking system or the grid. Each level of cyber defence makes an attack a quarter less likely; backups bring systems back far sooner.', panel: 'intel', when: (_s, r) => seen(r, /Ransomware|[Hh]ackers|cyber attack/) },
  { id: 'permit', title: 'A permit objection', text: 'A town objects to your new plant or rail link, and the work waits. Win the town over with jobs, housing or a community fund, override it, or withdraw.', panel: 'towns', when: (_s, r) => seen(r, /objects to .*A decision is waiting/) },
  { id: 'spy', title: 'Spies', text: 'The rival’s agents target your plants more often as its programmes grow. Vetting the staff at a plant stops sabotage and leaks.', panel: 'intel', when: (_s, r) => seen(r, /spy ring|[Ss]abotage at/) },
  { id: 'test', title: 'A failed test firing', text: 'A new round must pass its test firings before it is issued. A failure costs time; you choose whether to fix the design, retest at once or press on.', panel: 'testing', when: (_s, r) => seen(r, /fails a test firing/) },
  { id: 'embargo', title: 'An export ban', text: 'A foreign government has halted shipments from one of your suppliers. Find a second source on the Markets tab, or mend relations with a trade mission.', panel: 'markets', when: (_s, r) => seen(r, /^Export ban: /) },
  { id: 'crisis', title: 'A crisis is coming', text: 'Intel warns of a crisis in one region. Raise that region’s depot target and get rounds moving before it starts: how well you hold decides your score.', panel: 'logistics', when: (s) => s.crisis?.phase === 'warning' },
  { id: 'engineers', title: 'Too few engineers', text: 'Your plants, research and design need more engineers than you have. Hire from the market on the Staff tab, pay a premium so fewer leave, or found an academy.', panel: 'staff', when: (s) => !!s.engineers && coverage(s) < 0.9 },
  { id: 'rival', title: 'A new rival weapon', text: 'Intel has spotted a rival weapon in development. Each one changes which rounds you need once it reaches the field. Research its counter on the Intel tab before then, and consider an operation to delay it.', panel: 'intel', when: (s) => (s.rival?.known.length ?? 0) > 0 },
  { id: 'ops', title: 'Intelligence operations', text: 'Your service is ready. Steal the rival’s plans, sabotage a programme or disrupt its supply. Each may fail or be exposed, so weigh the odds.', panel: 'intel', when: (s) => s.day >= 180 && !!s.intel && s.intel.record.length === 0 && !s.intel.active },
];

const KEY = 'forge-command-tips';
export function tipsEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}
export function setTipsEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* storage may be unavailable */
  }
}

/** The first tip that applies now and has not been shown in this game. */
export function nextTip(s: SimState): Tip | null {
  if (s.over || (s.tutorial && s.tutorial.step < 99)) return null;
  const done = s.tipsSeen ?? [];
  const recent = s.feed.slice(-40).map((f) => f.text);
  return TIPS.find((t) => !done.includes(t.id) && t.when(s, recent)) ?? null;
}

export function TipCard({ tip, onShow, onDismiss, onOff }: { tip: Tip; onShow: () => void; onDismiss: () => void; onOff: () => void }) {
  return (
    <section className="border-b border-ops-amber/40 bg-ops-amber/5 px-3 py-2 text-[11px]" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label text-ops-amber">Field notes</span>
        <span className="flex flex-wrap gap-1">
          <Btn onClick={onShow}>Show me</Btn>
          <Btn onClick={onDismiss}>Got it</Btn>
          <Btn onClick={onOff} title="Turn off field notes in every game">
            No more tips
          </Btn>
        </span>
      </div>
      <h3 className="mt-1 font-sans text-[14px] font-semibold text-white">{tip.title}</h3>
      <p className="text-ops-text">{tip.text}</p>
    </section>
  );
}
