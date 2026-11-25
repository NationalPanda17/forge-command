// Your chief of staff: the areas you hand over, the money they must leave alone, the stance they take, and what they did.
import { validate, type SimAction } from '../sim/actions';
import { AUTO_AREAS, AUTO_AREA_IDS, STANCES, type AutoArea, type Stance } from '../sim/automation';
import type { SimState } from '../sim/types';
import { Btn, NumberInput, Segmented } from '../ui/kit';
import { money } from '../ui/format';
import { dateLabel } from './useSim';

export default function StaffPanel({ state, act }: { state: SimState; act: (a: SimAction) => void }) {
  const au = state.automation;
  const blocked = validate(state, { type: 'automate', area: 'staffing', on: true });
  const set = (area: AutoArea, on: boolean) => act({ type: 'automate', area, on });
  const all = (on: boolean) => AUTO_AREA_IDS.forEach((a) => au.areas[a] !== on && set(a, on));
  const onCount = AUTO_AREA_IDS.filter((a) => au.areas[a]).length;
  return (
    <div className="space-y-4 p-3 text-[11px]">
      <p className="text-ops-text">
        Hand any part of the job to your chief of staff. Each week they act on the areas you give them, never spending below your reserve, and in the spirit of the stance you choose. Decisions and hearings are answered as soon as they come up. You can still act yourself at any time.
      </p>
      {blocked ? (
        <p className="text-ops-amber">{blocked}</p>
      ) : (
        <>
          {state.mode === 'campaign' && au.assisted && <p className="text-[10px] text-ops-dim">This game is marked as assisted in your record book.</p>}
          <section>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h3 className="label">Handed over · {onCount} of {AUTO_AREA_IDS.length}</h3>
              <span className="flex gap-1">
                <Btn onClick={() => all(true)} why={onCount === AUTO_AREA_IDS.length ? 'Everything is handed over.' : null}>
                  Hand over everything
                </Btn>
                <Btn onClick={() => all(false)} why={onCount === 0 ? 'Nothing is handed over.' : null}>
                  Take it all back
                </Btn>
              </span>
            </div>
            <ul className="space-y-1.5">
              {AUTO_AREA_IDS.map((a) => (
                <li key={a} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded border border-ops-line/60 p-2">
                  <span className="min-w-0">
                    <span className={au.areas[a] ? 'text-ops-cyan' : 'text-white'}>{AUTO_AREAS[a].name}</span>
                    <span className="block text-[10px] text-ops-dim">{AUTO_AREAS[a].blurb}</span>
                  </span>
                  <Btn pressed={au.areas[a]} onClick={() => set(a, !au.areas[a])}>
                    {au.areas[a] ? 'Staff' : 'You'}
                  </Btn>
                </li>
              ))}
            </ul>
          </section>
          <section className="grid gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="label mb-1 block">Reserve: never spend below</span>
              <span className="flex items-center gap-2">
                <NumberInput value={au.reserve} onChange={(v) => act({ type: 'automationReserve', reserve: Math.max(0, Math.min(5000, v)) })} step={50} label="Reserve in $M" className="w-24" />
                <span className="text-ops-dim">{money(au.reserve)}</span>
              </span>
            </label>
            <div className="min-w-0">
              <div className="label mb-1">Stance</div>
              <Segmented<Stance> label="Stance" value={au.stance} onChange={(v) => act({ type: 'automationStance', stance: v })} options={(Object.keys(STANCES) as Stance[]).map((k) => ({ id: k, label: STANCES[k].name }))} />
              <p className="mt-1 text-[10px] text-ops-dim">{STANCES[au.stance].blurb} The advisor ranks its suggestions the same way.</p>
            </div>
          </section>
        </>
      )}
      <section>
        <h3 className="label mb-1">What your staff did</h3>
        {au.log.length ? (
          <ol className="space-y-0.5">
            {[...au.log]
              .reverse()
              .slice(0, 30)
              .map((l, i) => (
                <li key={`${l.day}-${i}`} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
                  <span className="text-ops-dim">{dateLabel(l.day)}</span>
                  <span className="min-w-0 break-words text-ops-text">
                    <span className="text-ops-dim">{AUTO_AREAS[l.area].name}: </span>
                    {l.text}
                  </span>
                </li>
              ))}
          </ol>
        ) : (
          <p className="text-ops-dim">Nothing yet.</p>
        )}
      </section>
    </div>
  );
}
