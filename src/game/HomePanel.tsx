// Home: the whole game on one screen. The key numbers and their trend, what needs you now, what is coming, and what
// changed since you last looked.
import { useMemo } from 'react';
import { validate, type SimAction } from '../sim/actions';
import { advise, threeMonthPlan } from '../sim/advisor';
import { GOALS, projectMandate, type GoalId } from '../sim/mandate';
import { nationalStock, readiness, reserveTarget } from '../sim/selectors';
import type { SimState } from '../sim/types';
import { FINISHED, MATERIALS, type LineId } from '../sim/world';
import { Btn, COLORS, Sparkline } from '../ui/kit';
import { money, pct, textToneFor } from '../ui/format';
import { eventKind, EVENT_KINDS, type EventKind } from './events';
import { feedKey } from './inbox';
import type { PanelId } from './nav';
import { dateLabel } from './useSim';

/** What the player saw last time they were on Home. */
export interface Snapshot {
  day: number;
  treasury: number;
  readiness: number;
  confidence: number;
  stock: Partial<Record<LineId, number>>;
  feedKey: string;
}

export function snapshot(s: SimState): Snapshot {
  const stock: Partial<Record<LineId, number>> = {};
  for (const l of FINISHED as LineId[]) if (s.lines[l].unlocked) stock[l] = nationalStock(s, l);
  return { day: s.day, treasury: s.treasury, readiness: readiness(s), confidence: s.confidence, stock, feedKey: feedKey(s.feed.at(-1)) };
}

/** What changed since a snapshot: the numbers, the rounds that moved most, and the important events by kind. */
export function changesSince(s: SimState, snap: Snapshot) {
  let from = -1;
  for (let i = s.feed.length - 1; i >= 0; i--)
    if (feedKey(s.feed[i]) === snap.feedKey) {
      from = i;
      break;
    }
  const events: Partial<Record<EventKind, number>> = {};
  for (let i = from + 1; i < s.feed.length; i++) {
    const f = s.feed[i];
    if (!f.alert && f.tone !== 'bad') continue;
    const k = eventKind(f.text, f.tone);
    events[k] = (events[k] ?? 0) + 1;
  }
  const rounds = (FINISHED as LineId[])
    .filter((l) => s.lines[l].unlocked && snap.stock[l] !== undefined)
    .map((l) => {
      const before = snap.stock[l]!;
      const now = nationalStock(s, l);
      return { line: l, change: before > 0 ? (now - before) / before : now > 0 ? 1 : 0 };
    })
    .filter((r) => Math.abs(r.change) >= 0.05)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 4);
  return { days: s.day - snap.day, treasury: s.treasury - snap.treasury, readiness: readiness(s) - snap.readiness, confidence: s.confidence - snap.confidence, events, rounds };
}

const signed = (v: number, f: (x: number) => string) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${f(Math.abs(v))}`;
const deltaTone = (v: number) => (v > 0 ? 'text-ops-green' : v < 0 ? 'text-ops-red' : 'text-ops-dim');

export default function HomePanel({
  state,
  act,
  seen,
  unread,
  onPanel,
  onSite,
  onLine,
}: {
  state: SimState;
  act: (a: SimAction) => void;
  seen: Snapshot;
  unread: number;
  onPanel: (p: PanelId) => void;
  onSite: (id: string) => void;
  onLine: (l: LineId) => void;
}) {
  const h = state.history.slice(-12);
  const ready = readiness(state);
  const last = state.history.at(-1);
  const kpis = [
    { label: 'Readiness', value: pct(ready), tone: textToneFor(ready), series: h.map((x) => x.readiness), delta: last ? signed(Math.round((ready - last.readiness) * 100), (x) => `${x} pts`) : null, d: last ? ready - last.readiness : 0, color: COLORS.cyan },
    { label: 'Treasury', value: money(state.treasury), tone: state.treasury < 0 ? 'text-ops-red' : 'text-white', series: h.map((x) => x.treasury), delta: last ? signed(state.treasury - last.treasury, money) : null, d: last ? state.treasury - last.treasury : 0, color: COLORS.amber },
    { label: 'Confidence', value: String(Math.round(state.confidence)), tone: textToneFor(state.confidence / 70), series: h.map((x) => x.confidence), delta: last ? signed(Math.round(state.confidence - last.confidence), String) : null, d: last ? state.confidence - last.confidence : 0, color: COLORS.green },
  ];
  const lines = (FINISHED as LineId[])
    .filter((l) => state.lines[l].unlocked && reserveTarget(state, l) > 0)
    .map((l) => ({ line: l, level: nationalStock(state, l) / reserveTarget(state, l) }))
    .sort((a, b) => a.level - b.level);
  // The advice and the plan try actions on copies of the game, so they are worked out only when the (once-a-second)
  // state Home is given changes, not on every redraw of the game screen.
  const advice = useMemo(() => advise(state, 3), [state]);
  const plan = useMemo(() => threeMonthPlan(state).slice(0, 4), [state]);
  const ch = useMemo(() => changesSince(state, seen), [state, seen]);
  const mandate = useMemo(() => projectMandate(state), [state]);
  const evKinds = Object.entries(ch.events) as [EventKind, number][];
  return (
    <div className="space-y-4 p-3 text-[11px]">
      <section className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Key numbers">
        {kpis.map((k) => (
          <div key={k.label} className="min-w-0 rounded border border-ops-line/60 p-2">
            <div className="label">{k.label}</div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className={`font-sans text-[18px] font-semibold ${k.tone}`}>{k.value}</span>
              {k.delta && <span className={`text-[10px] ${deltaTone(k.d)}`}>{k.delta} this month</span>}
            </div>
            <div className="mt-1">
              <Sparkline values={k.series} color={k.color} label={`${k.label} trend`} />
            </div>
          </div>
        ))}
      </section>

      <MandateCard m={mandate} />

      <section>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 className="label">Needs you now</h3>
          <span className="flex flex-wrap gap-1">
            {state.strategy.decisions.length > 0 && (
              <Btn kind="warn" onClick={() => onPanel('strategy')}>
                {state.strategy.decisions.length} decision{state.strategy.decisions.length > 1 ? 's' : ''}
              </Btn>
            )}
            <Btn onClick={() => onPanel('inbox')}>{unread ? `Inbox · ${unread} new` : 'Inbox'}</Btn>
          </span>
        </div>
        {advice.length === 0 ? (
          <p className="text-ops-dim">Nothing urgent. The advisor has no suggestions right now.</p>
        ) : (
          <ol className="space-y-1.5">
            {advice.map((a) => {
              const why = a.action ? validate(state, a.action) : null;
              return (
                <li key={a.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded border p-2 ${a.tone === 'bad' ? 'border-ops-red/50' : a.tone === 'warn' ? 'border-ops-amber/40' : 'border-ops-line/60'}`}>
                  <span className="min-w-0">
                    <span className="text-white">{a.title}</span>
                    <span className="block text-[10px] text-ops-dim">{a.why}</span>
                  </span>
                  {a.action ? (
                    <Btn kind="primary" why={why} onClick={() => act(a.action!)}>
                      Do it
                    </Btn>
                  ) : a.panel || a.site ? (
                    <Btn onClick={() => (a.panel ? onPanel(a.panel === 'programmes' ? 'policy' : (a.panel as PanelId)) : onSite(a.site!))}>Show me</Btn>
                  ) : (
                    <span />
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section>
        <h3 className="label mb-1">Rounds against the one-year goal</h3>
        <ul className="space-y-1">
          {lines.map(({ line, level }) => (
            <li key={line}>
              <button type="button" className="grid w-full grid-cols-[minmax(0,7rem)_minmax(0,1fr)_3rem] items-center gap-2 text-left hover:text-white" onClick={() => onLine(line)}>
                <span className="truncate text-ops-text">{MATERIALS[line].name}</span>
                <span className="h-1.5 overflow-hidden rounded bg-ops-line/60">
                  <span className={`block h-full ${level < 0.5 ? 'bg-ops-red' : level < 0.85 ? 'bg-ops-amber' : 'bg-ops-green'}`} style={{ width: `${Math.min(100, Math.round(level * 100))}%` }} />
                </span>
                <span className={`text-right ${textToneFor(level)}`}>{pct(level)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="label mb-1">Since you last looked{ch.days > 0 ? ` · ${ch.days} day${ch.days > 1 ? 's' : ''} ago` : ''}</h3>
        {ch.days <= 0 ? (
          <p className="text-ops-dim">You are up to date.</p>
        ) : (
          <div className="space-y-1">
            <p className="flex flex-wrap gap-x-4 gap-y-0.5">
              <span>
                Treasury <span className={deltaTone(ch.treasury)}>{signed(Math.round(ch.treasury), money)}</span>
              </span>
              <span>
                Readiness <span className={deltaTone(ch.readiness)}>{signed(Math.round(ch.readiness * 100), (x) => `${x} pts`)}</span>
              </span>
              <span>
                Confidence <span className={deltaTone(ch.confidence)}>{signed(Math.round(ch.confidence), String)}</span>
              </span>
            </p>
            {ch.rounds.length > 0 && (
              <p className="flex flex-wrap gap-x-4 gap-y-0.5">
                {ch.rounds.map((r) => (
                  <span key={r.line}>
                    {MATERIALS[r.line].name} <span className={deltaTone(r.change)}>{signed(Math.round(r.change * 100), (x) => `${x}%`)}</span>
                  </span>
                ))}
              </p>
            )}
            {evKinds.length > 0 ? (
              <ul className="flex flex-wrap gap-1">
                {evKinds.map(([k, n]) => (
                  <li key={k}>
                    <Btn onClick={() => onPanel(EVENT_KINDS[k].panel)}>
                      {EVENT_KINDS[k].label} · {n}
                    </Btn>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ops-dim">No important events.</p>
            )}
          </div>
        )}
      </section>

      {plan.length > 0 && (
        <section>
          <h3 className="label mb-1">Coming up</h3>
          <ul className="space-y-0.5">
            {plan.map((p, i) => (
              <li key={i} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                <span className="text-ops-dim">{p.month === 0 ? 'This month' : p.month === 1 ? 'Next month' : 'In two months'}</span>
                <span className={p.tone === 'bad' ? 'text-ops-red' : p.tone === 'warn' ? 'text-ops-amber' : 'text-ops-text'}>{p.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-[10px] text-ops-dim">{dateLabel(state.day)}</p>
    </div>
  );
}

const GRADE_TONE = { A: 'text-ops-green', B: 'text-ops-green', C: 'text-ops-amber', D: 'text-ops-amber', F: 'text-ops-red' } as const;

/** The figure each goal is judged on, as a player would say it. */
function goalFigure(id: GoalId, raw: number): string {
  if (!Number.isFinite(raw)) return 'too early';
  if (id === 'readiness') return `${Math.round(raw * 100)}% ready`;
  if (id === 'value') return `${raw.toFixed(2)}× budget`;
  if (id === 'jobs') return `${Math.round(raw * 100)}% spread`;
  if (id === 'independence') return `${Math.round(raw * 100)}% foreign`;
  if (id === 'stewardship') return `${(raw * 100).toFixed(1)}% waste`;
  return `${Math.round(raw * 100)}% got through`;
}

/** The Committee's mandate: this fiscal year's goals, how each is going, and the term's projected grade. */
function MandateCard({ m }: { m: ReturnType<typeof projectMandate> }) {
  return (
    <section className="rounded-[2px] border border-ops-line/60 p-2" aria-label="The Committee’s mandate">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h3 className="label">The Committee’s mandate · year {m.year + 1}</h3>
        {m.early ? (
          <span className="label whitespace-nowrap" title="The Committee first takes stock after three months">
            Projected grade from month 3
          </span>
        ) : (
          <span className="whitespace-nowrap" title="If the rest of the term goes as it is going now">
            <span className="label">Projected </span>
            <span className={`font-sans text-[18px] font-bold ${GRADE_TONE[m.parts.grade]}`}>{m.parts.grade}</span>
            <span className="ml-1 text-ops-dim">{m.parts.score}</span>
          </span>
        )}
      </div>
      <ul className="space-y-1">
        {m.goals.map((g) => (
          <li key={g.id} className="grid grid-cols-[minmax(0,1fr)_2.5rem_7.5rem_4.5rem] items-center gap-2" title={GOALS[g.id].blurb}>
            <span className="min-w-0 truncate text-ops-text">{g.name}</span>
            <span className="text-right text-ops-dim">{Math.round(g.weight * 100)}%</span>
            <span className="truncate text-right text-ops-dim">{goalFigure(g.id, g.raw)}</span>
            <span className="bar" role="meter" aria-label={`${g.name}: ${Math.round(g.score * 100)} of 100`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(g.score * 100)}>
              <span className={g.score >= 0.75 ? 'bg-ops-green' : g.score >= 0.4 ? 'bg-ops-amber' : 'bg-ops-red'} style={{ width: `${Math.max(2, g.score * 100)}%` }} />
            </span>
          </li>
        ))}
      </ul>
      {m.risk && <p className="mt-1.5 text-ops-red">Dismissal risk: the Committee’s confidence is below 20.</p>}
    </section>
  );
}
