// Feedstock markets: what your suppliers depend on.
import { COMPONENTS, DIFFICULTY, TIER2, TIER2_IDS, type GameState } from '../engine';
import { Bar, Chip, Panel } from './kit';

export default function Markets({ state }: { state: GameState }) {
  const steady = !DIFFICULTY[state.difficulty].shortages;
  return (
    <Panel title="Feedstock markets" right={steady ? 'steady on easy' : 'your suppliers’ suppliers'}>
      <div className="grid gap-x-6 gap-y-3 p-3 md:grid-cols-2 xl:grid-cols-3">
        {TIER2_IDS.map((t) => {
          const def = TIER2[t];
          const m = state.tier2[t];
          const price = m.priceIndex;
          return (
            <div key={t} className="text-[11px]">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-sans text-[13px] font-semibold text-white" title={def.blurb}>
                  {def.name}
                </span>
                <span className={price > 1.15 ? 'text-ops-red' : price < 0.9 ? 'text-ops-green' : 'text-ops-text'} title="Market price index: spot buys and new contracts pay it">
                  price ×{price.toFixed(2)}
                </span>
              </div>
              <Bar ratio={m.availability} className="my-1" title={`Availability ${Math.round(m.availability * 100)}%`} />
              <div className="flex flex-wrap items-center gap-1 text-[10px] text-ops-dim">
                <span>
                  {Math.round(m.availability * 100)}% available · feeds {def.feeds.map((c) => COMPONENTS[c].name.toLowerCase()).join(', ')}
                </span>
                {m.disruptionMonths > 0 && <Chip tone="border-ops-red/60 text-ops-red">disrupted · {m.disruptionMonths} mo</Chip>}
              </div>
              <div className="text-[10px] text-ops-dim">{def.source}</div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
