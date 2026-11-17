// The end-of-term report: a grade, how the term went month by month, and what was achieved.
import { termReport } from '../sim/analytics';
import { SCENARIOS } from '../sim/setup';
import type { SimState } from '../sim/types';
import { MATERIALS } from '../sim/world';
import { Btn, COLORS, LineChart } from '../ui/kit';
import { int, money, pct, qty } from '../ui/format';
import { ACHIEVEMENTS, loadAchievements } from './achievements';
import { recordScore } from './scores';
import { useMemo } from 'react';
import { canSecondTerm } from '../sim/commitments';
import { monthLabel2 } from './useSim';

const GRADE_TONE = { A: 'text-ops-green', B: 'text-ops-cyan', C: 'text-ops-amber', D: 'text-ops-amber', F: 'text-ops-red' } as const;

export default function TermReport({ state, onClose, onMenu, onSecondTerm }: { state: SimState; onClose: () => void; onMenu: () => void; onSecondTerm?: () => void }) {
  const r = termReport(state);
  const board = useMemo(() => recordScore(state), [state]);
  const rank = board.findIndex((e) => e.key.startsWith(`${state.seed}-${state.scenario}-${state.difficulty}-${state.day}-`)) + 1;
  const h = state.history;
  const x = h.length ? [monthLabel2(h[0].month), monthLabel2(h.at(-1)!.month)] : [];
  const earned = loadAchievements();
  const stat = (label: string, value: string, tone = 'text-white') => (
    <div className="min-w-0">
      <div className="label truncate">{label}</div>
      <div className={`truncate text-[15px] ${tone}`}>{value}</div>
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ops-bg/90 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="term-title">
      <div className="panel mx-auto max-w-3xl space-y-4 p-4 text-[12px]">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="label">{state.mode === 'sandbox' ? 'Sandbox · ' : ''}{SCENARIOS[state.scenario].name} · {state.difficulty}</div>
            <h2 id="term-title" className="font-sans text-2xl font-bold tracking-[0.12em] text-white">
              {state.outcome === 'dismissed' ? 'Dismissed' : (state.term ?? 1) > 1 ? `Term ${state.term} complete` : 'Term complete'}
            </h2>
            <p className="text-ops-dim">{state.outcome === 'dismissed' ? 'The Defence Committee lost confidence in you.' : 'Your term as Director of the Munitions Production Board is over.'}</p>
          </div>
          <div className="text-center">
            <div className="label">Grade</div>
            <div className={`font-sans text-5xl font-bold leading-tight ${GRADE_TONE[r.grade]}`}>{r.grade}</div>
            <div className="text-ops-dim">score {r.score}</div>
            {rank > 0 && <div className="text-[10px] text-ops-dim">#{rank} of your campaigns</div>}
            {state.mode === 'sandbox' && <div className="text-[10px] text-ops-amber">sandbox · not scored</div>}
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stat('Average readiness', pct(r.avgReadiness))}
          {stat('Lowest readiness', pct(r.minReadiness), r.minReadiness < 0.5 ? 'text-ops-red' : 'text-white')}
          {stat('Final confidence', String(Math.round(r.finalConfidence)))}
          {stat('Threats stopped', `${pct(r.stopped / Math.max(1, r.stopped + r.leaked))}`)}
          {stat('Rounds made', int(r.made))}
          {stat('Rounds exported', int(r.exported))}
          {stat('Spent', money(r.spend))}
          {stat('Research done', String(r.research))}
        </div>

        <section>
          <h3 className="label mb-1">Readiness and confidence</h3>
          <LineChart
            xLabels={x}
            min={0}
            max={100}
            format={(v) => String(Math.round(v))}
            series={[
              { label: 'Readiness %', values: h.map((m) => m.readiness * 100), color: COLORS.cyan },
              { label: 'Confidence', values: h.map((m) => m.confidence), color: COLORS.amber },
            ]}
          />
        </section>
        <section>
          <h3 className="label mb-1">Treasury</h3>
          <LineChart xLabels={x} format={money} series={[{ label: 'Treasury', values: h.map((m) => m.treasury), color: COLORS.green }]} />
        </section>

        <section>
          <h3 className="label mb-1">The reserve you leave behind</h3>
          <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {r.lines.map((l) => (
              <li key={l.line} className="flex justify-between gap-2">
                <span className="truncate">{MATERIALS[l.line].name}</span>
                <span className={l.stock >= l.target ? 'text-ops-green' : l.stock >= l.target * 0.6 ? 'text-ops-amber' : 'text-ops-red'}>
                  {qty(l.stock)} <span className="text-ops-dim">/ {qty(l.target)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="label mb-1">Achievements</h3>
          <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {ACHIEVEMENTS.map((a) => (
              <li key={a.id} className={earned[a.id] ? 'text-ops-green' : 'text-ops-dim'}>
                {earned[a.id] ? '★' : '☆'} {a.title} <span className="text-[10px] text-ops-dim">· {a.text}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-wrap justify-end gap-2">
          <Btn onClick={onClose}>Look at the map</Btn>
          {onSecondTerm && canSecondTerm(state) === null && (
            <Btn kind="warn" onClick={onSecondTerm} title="Carry on with everything you built and every round you leave in the depots">
              Serve a second term
            </Btn>
          )}
          <Btn kind="primary" onClick={onMenu}>
            Main menu
          </Btn>
        </div>
      </div>
    </div>
  );
}
