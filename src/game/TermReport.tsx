// The end-of-term report: a grade, how the term went month by month, and what was achieved.
import { DialogFocus } from '../ui/DialogFocus';
import { termReport } from '../sim/analytics';
import { SCENARIOS } from '../sim/setup';
import type { SimState } from '../sim/types';
import { MATERIALS } from '../sim/world';
import { Btn, COLORS, LineChart } from '../ui/kit';
import { int, money, pct, qty } from '../ui/format';
import { ACHIEVEMENTS, loadAchievements } from './achievements';
import { entryKey, recordScore } from './scores';
import { useMemo } from 'react';
import { CAREER, canReappoint, gradeForNextRank, rankOf, unfinishedBusiness } from '../sim/career';
import { nextUnlock, recordCareerTerm } from './career';
import { epilogue } from '../sim/story';
import { winner } from '../sim/hotseat';
import { dateLabel, monthLabel2 } from './useSim';
import { BOONS, boonsFor, keyMoments, legacyOf, type BoonId } from '../sim/legacy';
import { tr } from '../sim/worldgen';
import { useState } from 'react';

const GRADE_TONE = { A: 'text-ops-green', B: 'text-ops-cyan', C: 'text-ops-amber', D: 'text-ops-amber', F: 'text-ops-red' } as const;

export default function TermReport({ state, onClose, onMenu, onSecondTerm }: { state: SimState; onClose: () => void; onMenu: () => void; onSecondTerm?: (boon?: BoonId) => void }) {
  const legacy = useMemo(() => legacyOf(state), [state]);
  const moments = useMemo(() => keyMoments(state), [state]);
  // A career's Committee may decline to reappoint you (19.2).
  const why = canReappoint(state);
  const canGoOn = !!onSecondTerm && why === null;
  // The career record takes this term at once, so closing the tab loses nothing.
  const career = useMemo(() => (state.careerId ? recordCareerTerm(state, { notReappointed: state.outcome === 'complete' && why !== null }) : null), [state, why]);
  const ahead = career ? gradeForNextRank(state, career.points) : null;
  const teaser = useMemo(() => (career ? nextUnlock() : null), [career]);
  const business = useMemo(() => (career && canGoOn ? unfinishedBusiness(state) : []), [state, career, canGoOn]);
  const boons = useMemo(() => (canGoOn ? boonsFor(state) : []), [state, canGoOn]);
  const [boon, setBoon] = useState<BoonId | undefined>(undefined);
  const [allMoments, setAllMoments] = useState(false);
  const chosen = boon ?? boons[0];
  const r = termReport(state);
  const board = useMemo(() => recordScore(state), [state]);
  const rank = board.findIndex((e) => e.key === entryKey(state)) + 1;
  const h = state.history.slice(state.termMonth ?? 0);
  const x = h.length ? [monthLabel2(h[0].month), monthLabel2(h.at(-1)!.month)] : [];
  const earned = loadAchievements();
  const stat = (label: string, value: string, tone = 'text-white') => (
    <div className="min-w-0">
      <div className="label truncate">{label}</div>
      <div className={`truncate text-[15px] ${tone}`}>{value}</div>
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ops-bg/90 p-3" role="dialog" aria-modal="true" aria-labelledby="term-title">
      <DialogFocus labelledBy="term-title" />
      <div className="fc-zoom panel mx-auto max-w-3xl space-y-4 p-4 text-[12px]">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="label !text-ops-amber">{state.mode === 'sandbox' ? 'Sandbox · ' : ''}{SCENARIOS[state.scenario].name} · {state.difficulty}</div>
            <h2 id="term-title" className="fc-dialog-title">
              {state.outcome === 'dismissed' ? 'Dismissed' : (state.term ?? 1) > 1 ? `Term ${state.term} complete` : 'Term complete'}
            </h2>
            <p className="text-ops-dim">{state.outcome === 'dismissed' ? 'The Defence Committee lost confidence in you.' : 'Your term as Director of the Munitions Production Board is over.'}</p>
          </div>
          <div className="text-center">
            <div className="label">Grade</div>
            <div className={`font-sans text-5xl font-bold leading-tight ${GRADE_TONE[r.grade]}`}>{r.grade}</div>
            <div className="text-ops-dim">score {r.score}</div>
            <div className="text-[10px] text-ops-dim" title="How well you met the Committee's mandate, and its average confidence in you over the term">
              mandate {Math.round(r.mandate * 100)}% · confidence {Math.round(r.avgConfidence)}
            </div>
            {rank > 0 && <div className="text-[10px] text-ops-dim">#{rank} of your scored games</div>}
            {state.mode === 'sandbox' && <div className="text-[10px] text-ops-amber">sandbox · not scored</div>}
            {state.mode !== 'sandbox' && state.automation?.assisted && <div className="text-[10px] text-ops-dim">assisted by your staff</div>}
          </div>
        </header>

        {state.hotseat && (
          <section className="rounded border border-ops-cyan/40 bg-ops-cyan/5 p-3">
            <div className="label mb-1 text-ops-cyan">{winner(state.hotseat)}</div>
            <ul className="grid grid-cols-2 gap-2">
              {state.hotseat.players.map((p, i) => (
                <li key={i} className="min-w-0">
                  <span className="block truncate text-white">{p.name}</span>
                  <span className="block truncate text-ops-dim">{p.command}</span>
                  <span className="font-sans text-xl font-bold text-white">{p.score.toFixed(1)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {(state.career?.length ?? 0) > 0 && (
          <section>
            <h3 className="label mb-1">Your career</h3>
            <ol className="space-y-0.5">
              {[...state.career, { term: state.term, score: r.score, grade: r.grade, outcome: state.outcome, months: h.length, avgReadiness: r.avgReadiness }].map((t) => (
                <li key={t.term} className="grid grid-cols-[64px_minmax(0,1fr)_auto] gap-2">
                  <span className="text-ops-dim">Term {t.term}</span>
                  <span className="min-w-0 text-ops-text">
                    {Math.round((t.months / 12) * 10) / 10} year{Math.round((t.months / 12) * 10) / 10 === 1 ? '' : 's'} · readiness {pct(t.avgReadiness)}
                    {t.outcome === 'dismissed' ? <span className="text-ops-red"> · dismissed</span> : ''}
                  </span>
                  <span className={GRADE_TONE[t.grade as keyof typeof GRADE_TONE] ?? 'text-white'}>
                    {t.grade} · {t.score}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
        {state.story && <p className="rounded border border-ops-amber/40 bg-ops-amber/5 p-3 leading-relaxed text-ops-text">{epilogue(state)}</p>}
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

        <section aria-labelledby="legacy-title">
          <h3 id="legacy-title" className="label mb-1">
            Your legacy
          </h3>
          <div className="rounded border border-ops-amber/50 bg-ops-amber/5 p-3">
            <div className="font-sans text-[18px] font-semibold text-ops-amber">{legacy.title}</div>
            <p className="text-ops-text">{legacy.why}</p>
            <p className="mt-1 text-ops-dim">
              You built <span className="text-white">{legacy.industry}</span>
              {legacy.doctrines.length ? `: ${legacy.doctrines.join(', ').toLowerCase()}.` : '.'}
            </p>
            {legacy.people && <p className="text-ops-dim">Your best manager: <span className="text-white">{legacy.people}</span>.</p>}
          </div>
        </section>


        {career && (
          <section className="rounded border border-ops-amber/50 p-3" aria-label="The Committee's letter">
            <h3 className="label mb-2 !text-ops-amber">The Committee's letter</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <p className={canGoOn ? 'text-ops-green' : 'text-ops-red'}>
                  {state.outcome === 'dismissed' ? 'Your career ends here: the Committee dismissed you.' : canGoOn ? `The Committee will reappoint you for term ${(state.term ?? 1) + 1}.` : why}
                </p>
                <div>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-white">{CAREER.ranks[career.rank].name}</span>
                    <span className="text-ops-dim">{career.points} points</span>
                  </div>
                  {ahead && (
                    <>
                      <div className="mt-1 h-1.5 rounded-sm bg-ops-line/40" aria-hidden="true">
                        <div className="h-full rounded-sm bg-ops-amber/80" style={{ width: `${Math.min(100, (100 * (career.points - CAREER.ranks[career.rank].points)) / Math.max(1, CAREER.ranks[rankOf(career.points) + 1].points - CAREER.ranks[career.rank].points))}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-ops-dim">
                        {ahead.need} points to {ahead.rank}.{canGoOn && ahead.grade ? ` ${ahead.grade === 'A' ? 'An' : 'A'} ${ahead.grade} next term gets you there.` : ''}
                      </p>
                    </>
                  )}
                </div>
                {teaser && (
                  <p className="text-[11px] text-ops-text">
                    Next to open: <span className="text-white">{teaser.name}</span>. <span className="text-ops-dim">{teaser.how}</span>
                  </p>
                )}
              </div>
              {business.length > 0 && (
                <div className="min-w-0">
                  <div className="label mb-1">Unfinished business</div>
                  <ul className="space-y-0.5 text-ops-text">
                    {business.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {canGoOn && (
          <section>
            <h3 className="label mb-1">What you carry into term {(state.term ?? 1) + 1}</h3>
            <ul className="mb-2 space-y-0.5">
              {legacy.carry.map((c, i) => (
                <li key={i} className={c.tone === 'bad' ? 'text-ops-red' : c.tone === 'good' ? 'text-ops-green' : 'text-ops-text'}>
                  {c.text}
                </li>
              ))}
            </ul>
            <div className="label mb-1">Choose one legacy to build on</div>
            <ul className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Legacy for the next term">
              {boons.map((b) => (
                <li key={b}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={chosen === b}
                    onClick={() => setBoon(b)}
                    className={`h-full w-full rounded border p-2 text-left ${chosen === b ? 'border-ops-cyan bg-ops-cyan/10' : 'border-ops-line/60 hover:border-ops-dim'}`}
                  >
                    <span className={`block ${chosen === b ? 'text-ops-cyan' : 'text-white'}`}>{BOONS[b].name}</span>
                    <span className="block text-[10px] text-ops-dim">{BOONS[b].blurb}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {moments.length > 0 && (
          <section>
            <h3 className="label mb-1">The moments that defined the term</h3>
            <ol className="space-y-0.5">
              {(allMoments ? moments : moments.slice(0, 5)).map((m, i) => (
                <li key={`${m.day}-${i}`} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2">
                  <span className="text-ops-dim">{dateLabel(m.day)}</span>
                  <span className={`min-w-0 break-words ${m.tone === 'bad' ? 'text-ops-red' : m.tone === 'good' ? 'text-ops-green' : m.tone === 'warn' ? 'text-ops-amber' : 'text-ops-text'}`}>{tr(m.text)}</span>
                </li>
              ))}
            </ol>
            {moments.length > 5 && (
              <button type="button" className="mt-1 text-[11px] text-ops-cyan hover:underline" onClick={() => setAllMoments(!allMoments)}>
                {allMoments ? 'Show fewer' : `Show all ${moments.length}`}
              </button>
            )}
          </section>
        )}

        <section>
          <h3 className="label mb-1">Achievements</h3>
          <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {ACHIEVEMENTS.filter((a) => earned[a.id]).map((a) => (
              <li key={a.id} className="text-ops-green">
                ★ {a.title} <span className="text-[10px] text-ops-dim">· {a.text}</span>
              </li>
            ))}
          </ul>
          {ACHIEVEMENTS.some((a) => !earned[a.id]) && (
            <details className="mt-1">
              <summary className="cursor-pointer text-[11px] text-ops-cyan">{ACHIEVEMENTS.filter((a) => !earned[a.id]).length} more to earn</summary>
              <ul className="mt-1 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                {ACHIEVEMENTS.filter((a) => !earned[a.id]).map((a) => (
                  <li key={a.id} className="text-ops-dim">
                    ☆ {a.title} <span className="text-[10px]">· {a.text}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <div className="flex flex-wrap justify-end gap-2">
          <Btn onClick={onClose}>Look at the map</Btn>
          {canGoOn && (
            <Btn kind="warn" onClick={() => onSecondTerm!(chosen)} title="Carry on with everything you built and every round you leave in the depots">
              Serve term {(state.term ?? 1) + 1}
            </Btn>
          )}
          {career && canGoOn && career.terms.length >= 1 && (
            <Btn
              onClick={() => {
                recordCareerTerm(state, { retire: true });
                onMenu();
              }}
              title={career.terms.length >= CAREER.retireBonusFrom ? `Retire with honour: +${CAREER.retireBonus} career points` : 'End your career here'}
            >
              Retire{career.terms.length >= CAREER.retireBonusFrom ? ` (+${CAREER.retireBonus} points)` : ''}
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
