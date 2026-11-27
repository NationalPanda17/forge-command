// The career record on the new-game screen (19.2): the career in progress, your rank, what is open, and past careers.
import { useState } from 'react';
import { CAREER } from '../sim/career';
import type { SimState } from '../sim/types';
import { Btn } from '../ui/kit';
import { careerBests, openPostings, postingName, setOpenPostings, unlocked, unlockText, type CareerRecord, type UnlockId } from './career';

const STATUS: Record<CareerRecord['status'], string> = {
  active: 'serving',
  retired: 'retired',
  dismissed: 'dismissed',
  notReappointed: 'not reappointed',
  abandoned: 'abandoned',
};

export function CareerRecordView({ careers, active, onResume }: { careers: CareerRecord[]; active: SimState | null; onResume: () => void }) {
  const [openAll, setOpenAll] = useState(openPostings);
  const best = careerBests(careers);
  const current = active ? careers.find((c) => c.id === active.careerId) : null;
  return (
    <div className="space-y-3 rounded border border-ops-line/60 p-3">
      {active && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded border border-ops-amber/50 p-2">
          <div className="min-w-0">
            <div className="label !text-ops-amber">Career in progress</div>
            <div className="truncate text-white">
              {current?.country ?? 'Your country'} · term {active.term ?? 1} · {CAREER.ranks[current?.rank ?? 0].name}
            </div>
            <div className="text-[11px] text-ops-dim">
              {postingName(active.scenario)} · {active.difficulty}
              {current?.terms.length ? ` · last term ${current.terms.at(-1)!.grade}` : ''}
            </div>
          </div>
          <Btn kind="primary" onClick={onResume}>
            Resume
          </Btn>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="min-w-0">
          <div className="label">Best rank</div>
          <div className="truncate text-white">{CAREER.ranks[best.rank].name}</div>
        </div>
        <div className="min-w-0">
          <div className="label">Most terms served</div>
          <div className="text-white">{best.terms}</div>
        </div>
        <div className="min-w-0">
          <div className="label">Careers</div>
          <div className="text-white">{best.careers}</div>
        </div>
      </div>
      <div>
        <div className="label mb-1">Postings and options</div>
        <ul className="space-y-0.5 text-[11px]">
          {(Object.keys(CAREER.unlocks) as UnlockId[]).map((u) => {
            const ok = unlocked(u, careers);
            return (
              <li key={u} className="grid grid-cols-[16px_minmax(0,1fr)] gap-1">
                <span className={ok ? 'text-ops-green' : 'text-ops-dim'} aria-hidden="true">
                  {ok ? '✓' : '·'}
                </span>
                <span className={ok ? 'text-ops-text' : 'text-ops-dim'}>
                  {CAREER.unlocks[u].name}
                  {!ok && ` · ${unlockText(u)}`}
                </span>
              </li>
            );
          })}
        </ul>
        <label className="mt-1 flex items-center gap-2 text-[11px] text-ops-dim">
          <input
            type="checkbox"
            checked={openAll}
            onChange={(e) => {
              setOpenAll(e.target.checked);
              setOpenPostings(e.target.checked);
            }}
          />
          Open every posting now (ranks are still awarded)
        </label>
      </div>
      {careers.length > 0 && (
        <div>
          <div className="label mb-1">Your careers</div>
          <ul className="space-y-1 text-[11px]">
            {careers.slice(0, 10).map((c) => (
              <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <span className="min-w-0 truncate text-ops-text">
                  {c.country} · {postingName(c.scenario)} · {c.difficulty}
                  <span className="text-ops-dim"> · {c.terms.map((t) => t.grade).join(' ') || 'no term yet'}</span>
                </span>
                <span className="whitespace-nowrap text-ops-dim">
                  {CAREER.ranks[c.rank].name} · {c.points} pts · {STATUS[c.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
