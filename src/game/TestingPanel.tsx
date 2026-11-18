// Testing: what each range is firing, the queue behind it, and what has been accepted.
import { validate, type SimAction } from '../sim/actions';
import { FIRINGS_PER_MONTH, RANGES, programmeName } from '../sim/testing';
import type { SimState } from '../sim/types';
import { FINISHED, MATERIALS, SITE_BY_ID, type LineId } from '../sim/world';
import { Bar, Btn } from '../ui/kit';
import { pct } from '../ui/format';

export default function TestingPanel({ state, act, onSite }: { state: SimState; act: (a: SimAction) => void; onSite: (id: string) => void }) {
  const running = state.tests.filter((t) => t.range);
  const queued = state.tests.filter((t) => !t.range);
  const waiting = (FINISHED as LineId[]).filter((l) => state.lines[l].unlocked && state.lines[l].accepted === false);
  return (
    <div className="space-y-4 p-3 text-[11px]">
      <p className="text-ops-dim">
        New rounds and new designs are fired at the test ranges before they are accepted. Each range fires one programme at a time, {FIRINGS_PER_MONTH} rounds a month. Until a new round passes, its
        production waits at the arsenal.
      </p>

      <section>
        <h3 className="label mb-1">The ranges</h3>
        <ul className="space-y-2">
          {RANGES().map((r) => {
            const t = running.find((x) => x.range === r);
            return (
              <li key={r} className="rounded border border-ops-line/60 p-2">
                <button type="button" className="text-white hover:underline" onClick={() => onSite(r)}>
                  {SITE_BY_ID[r].name}
                </button>
                {t ? (
                  <div className="mt-1">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-ops-text">{programmeName(t)}</span>
                      <span className={t.investigating ? 'text-ops-amber' : 'text-ops-dim'}>
                        {t.investigating ? `investigating a failure · ${t.investigating} days` : `${t.passed} of ${t.needed} firings passed · ${t.failed} failed · ${pct(t.odds)} odds`}
                      </span>
                    </div>
                    <Bar ratio={t.passed / t.needed} tone={t.investigating ? 'bg-ops-amber' : 'bg-ops-green'} />
                  </div>
                ) : (
                  <p className="text-ops-dim">Idle.</p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3 className="label mb-1">Queue</h3>
        {queued.length ? (
          <ol className="space-y-1">
            {queued.map((t, i) => {
              const a: SimAction = { type: 'prioritiseTest', test: t.id };
              return (
                <li key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <span className="min-w-0 truncate text-ops-text">
                    {i + 1}. {programmeName(t)} <span className="text-ops-dim">· {t.needed} firings</span>
                  </span>
                  {i > 0 && (
                    <Btn why={validate(state, a)} onClick={() => act(a)} title="Move up the queue">
                      Move up
                    </Btn>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-ops-dim">Nothing waiting.</p>
        )}
      </section>

      {waiting.length > 0 && (
        <section className="rounded border border-ops-amber/40 bg-ops-amber/5 p-2">
          <h3 className="label mb-1 text-ops-amber">Awaiting acceptance</h3>
          <p className="text-ops-text">{waiting.map((l) => MATERIALS[l].name).join(', ')}: made, but not issued until accepted.</p>
        </section>
      )}
    </div>
  );
}
