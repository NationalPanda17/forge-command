// Hot-seat two-player: the handover screen and the scoreboard chip.
import type { SimAction } from '../sim/actions';
import type { SimState } from '../sim/types';
import { Btn } from '../ui/kit';

export function Handover({ state, act }: { state: SimState; act: (a: SimAction) => void }) {
  const h = state.hotseat;
  if (!h?.handover || state.over) return null;
  const next = h.players[h.active];
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ops-bg p-3" role="dialog" aria-modal="true" aria-labelledby="handover-title">
      <div className="fc-zoom panel mx-auto mt-[12vh] max-w-md space-y-4 p-5 text-center text-[12px]">
        <div className="label">{state.history.length === 0 ? 'Two directors, one country' : 'Month over'}</div>
        <h2 id="handover-title" className="font-sans text-2xl font-bold tracking-[0.1em] text-white">
          Pass to {next.name}
        </h2>
        <p className="text-ops-text">
          {next.command}: the {next.regions.join(', ')}. You share the treasury, the railways, research and policy with the other director. Your score comes from your own bases, your own
          plants and how much of the money you spend.
        </p>
        <dl className="grid grid-cols-2 gap-2">
          {h.players.map((p, i) => (
            <div key={i} className={`rounded border p-2 ${i === h.active ? 'border-ops-cyan/60' : 'border-ops-line/60'}`}>
              <dt className="truncate text-ops-dim">{p.name}</dt>
              <dd className="font-sans text-xl font-bold text-white">{p.score.toFixed(1)}</dd>
            </div>
          ))}
        </dl>
        <Btn kind="primary" className="px-5 py-2" onClick={() => act({ type: 'handover' })}>
          I am {next.name}: start my month
        </Btn>
      </div>
    </div>
  );
}

export function HotseatChip({ state }: { state: SimState }) {
  const h = state.hotseat;
  if (!h) return null;
  const p = h.players[h.active];
  return (
    <div className="min-w-0">
      <div className="label">Directing</div>
      <div className="truncate text-ops-cyan" title={`${h.players[0].name} ${h.players[0].score.toFixed(1)} · ${h.players[1].name} ${h.players[1].score.toFixed(1)}`}>
        {p.name} <span className="text-ops-dim">· {h.players[0].score.toFixed(0)}–{h.players[1].score.toFixed(0)}</span>
      </div>
    </div>
  );
}
