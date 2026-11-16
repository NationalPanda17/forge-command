import { LINES, LINE_IDS, reserveTarget, type GameState } from '../engine';
import { qty, toneFor } from './format';

export default function ReservePanel({ state }: { state: GameState }) {
  const last = state.history.at(-1);
  return (
    <section className="panel">
      <div className="panel-title">
        <span>National reserve</span>
        <span className="label normal-case tracking-normal">goal: 6 months of calm draw</span>
      </div>
      <ul className="divide-y divide-ops-line/50">
        {LINE_IDS.map((id) => {
          const r = state.reserves[id];
          const target = reserveTarget(id);
          const ratio = r.stock / target;
          const draw = last?.draw[id];
          const made = last?.output[id];
          return (
            <li key={id} className="px-3 py-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-sans text-[13px] font-semibold text-white">{LINES[id].name}</span>
                <span>
                  <span className="text-white">{qty(r.stock)}</span>
                  <span className="text-ops-dim"> / {qty(target)}</span>
                </span>
              </div>
              <div className="bar my-1">
                <span className={toneFor(ratio)} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-ops-dim">
                <span>{draw === undefined ? `calm draw ≈ ${qty(LINES[id].baseDraw)}/mo` : `last mo: +${qty(made ?? 0)} made, −${qty(draw)} drawn`}</span>
                {r.unmet > 0 && <span className="text-ops-red">unmet {qty(r.unmet)}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
