// A map of the (fictional) Commonwealth of Aldmere: regions, depots, convoys, allies and the rival.
import { useState } from 'react';
import {
  CAMPUSES,
  DEPOT_TARGETS,
  LINES,
  MAX_TRANSPORT,
  PARTNERS,
  PARTNER_IDS,
  RIVAL_NAME,
  THEATERS,
  THEATER_IDS,
  TRANSPORT_COST,
  TRANSPORT_STEP,
  activeLines,
  depotTotal,
  expectedTheaterDraw,
  inbound,
  loanBlocker,
  loanQty,
  reserveTotal,
  validateAction,
  type Action,
  type GameState,
  type TheaterId,
} from '../../engine';
import { Bar, Btn, Panel, Segmented } from '../kit';
import { money, qty, textToneFor } from '../format';

/** Hand-drawn region shapes (viewBox 0 0 600 420). */
const SHAPES: Record<TheaterId, { path: string; label: [number, number] }> = {
  north: { path: 'M170 40 L360 30 L430 70 L420 150 L300 165 L200 150 L160 100 Z', label: [290, 95] },
  coast: { path: 'M160 100 L200 150 L300 165 L290 270 L220 320 L150 290 L120 200 Z', label: [205, 220] },
  east: { path: 'M300 165 L420 150 L430 70 L500 110 L520 240 L470 330 L360 340 L290 270 Z', label: [405, 240] },
  isles: { path: 'M70 330 L105 315 L120 340 L95 360 Z M130 360 L160 350 L170 372 L140 380 Z M60 375 L85 370 L90 392 L62 395 Z', label: [112, 405] },
};
const CAMPUS_XY: Record<keyof typeof CAMPUSES, [number, number]> = { corran: [270, 205], northgate: [300, 110], ashford: [395, 290] };

function depotCover(state: GameState, th: TheaterId): number {
  const draw = expectedTheaterDraw(state, 1, th);
  const lines = activeLines(state).filter((id) => draw[id] > 0.01);
  if (!lines.length) return 1;
  return lines.reduce((a, id) => a + Math.min(3, (depotTotal(state, th, id) + inbound(state, th, id)) / draw[id]), 0) / lines.length;
}

export default function World({ state, act }: { state: GameState; act: (a: Action) => void }) {
  const [sel, setSel] = useState<TheaterId>(state.crisis?.theater ?? 'coast');
  const c = state.crisis;
  const draw = expectedTheaterDraw(state, 1, sel);
  const t = state.theaters[sel];
  const buy: Action = { type: 'buyTransport' };
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_440px]">
      <Panel title="Commonwealth of Aldmere" right="click a region">
        <div className="p-3">
          <svg viewBox="0 0 600 420" className="w-full" role="img" aria-label="Map of Aldmere's regions and depots">
            <defs>
              <pattern id="sea" width="12" height="12" patternUnits="userSpaceOnUse">
                <path d="M0 6 Q3 3 6 6 T12 6" fill="none" stroke="rgb(var(--ops-line))" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect x="0" y="0" width="600" height="420" fill="url(#sea)" opacity="0.6" />
            <text x="30" y="160" className="fill-ops-dim" fontSize="11">Halvard Strait</text>
            <text x="20" y="60" className="fill-ops-dim" fontSize="10">Corvane Union ←</text>
            <path d="M500 110 L560 90 L590 200 L560 330 L520 240 Z" fill="rgb(var(--ops-red) / 0.08)" stroke="rgb(var(--ops-red) / 0.5)" strokeDasharray="4 3" />
            <text x="528" y="215" className="fill-ops-red" fontSize="10" transform="rotate(80 528 215)">{RIVAL_NAME}</text>
            {THEATER_IDS.map((th) => {
              const cover = depotCover(state, th);
              const target = state.theaters[th].targetMonths || 1;
              const ratio = Math.min(1, cover / target);
              const hot = c?.theater === th;
              const fill = ratio >= 0.9 ? 'var(--ops-green)' : ratio >= 0.5 ? 'var(--ops-amber)' : 'var(--ops-red)';
              return (
                <g key={th} onClick={() => setSel(th)} className="cursor-pointer" role="button" aria-label={`${THEATERS[th].name}: depot ${Math.round(ratio * 100)}% of target`}>
                  <path
                    d={SHAPES[th].path}
                    fill={`rgb(${fill} / ${sel === th ? 0.32 : 0.18})`}
                    stroke={hot ? 'rgb(var(--ops-red))' : sel === th ? 'rgb(var(--ops-cyan))' : 'rgb(var(--ops-line))'}
                    strokeWidth={hot || sel === th ? 2.5 : 1.2}
                  >
                    {hot && c?.phase === 'active' && <animate attributeName="stroke-opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />}
                  </path>
                  <text x={SHAPES[th].label[0]} y={SHAPES[th].label[1]} textAnchor="middle" className="fill-ops-text" fontSize="12" fontWeight="600">
                    {THEATERS[th].name}
                  </text>
                  <text x={SHAPES[th].label[0]} y={SHAPES[th].label[1] + 14} textAnchor="middle" className="fill-ops-dim" fontSize="10">
                    depot {cover.toFixed(1)} / {target} mo{state.theaters[th].lastLeaked >= 0.5 ? ` · ${Math.round(state.theaters[th].lastLeaked)} through` : ''}
                  </text>
                </g>
              );
            })}
            {(Object.keys(CAMPUS_XY) as (keyof typeof CAMPUSES)[]).map((k) => (
              <g key={k}>
                <rect x={CAMPUS_XY[k][0] - 6} y={CAMPUS_XY[k][1] - 6} width="12" height="12" fill="rgb(var(--ops-amber))" />
                <text x={CAMPUS_XY[k][0] + 10} y={CAMPUS_XY[k][1] + 4} className="fill-ops-amber" fontSize="10">
                  {CAMPUSES[k].name.split(' ')[0]}
                </text>
              </g>
            ))}
            <circle cx={CAMPUS_XY.corran[0]} cy={CAMPUS_XY.corran[1] + 22} r="5" fill="rgb(var(--ops-cyan))" />
            <text x={CAMPUS_XY.corran[0] + 10} y={CAMPUS_XY.corran[1] + 26} className="fill-ops-cyan" fontSize="10">
              Central reserve
            </text>
            {state.convoys.map((cv, i) => {
              const [x1, y1] = [CAMPUS_XY.corran[0], CAMPUS_XY.corran[1] + 22];
              const [x2, y2] = SHAPES[cv.theater].label;
              return i < 40 ? <line key={cv.id} x1={x1} y1={y1} x2={x2} y2={y2 - 18} stroke="rgb(var(--ops-cyan) / 0.25)" strokeDasharray="3 4" /> : null;
            })}
          </svg>
          <p className="text-[10px] text-ops-dim">
            Rounds are fired from the regional depot first. If a depot runs dry, only part of the gap can be airlifted from the central reserve in time, and airlifts
            cost money. Convoys leave every month and arrive the next.
          </p>
        </div>
      </Panel>

      <div className="space-y-3">
        <Panel title={THEATERS[sel].name} right={THEATERS[sel].blurb}>
          <div className="space-y-2 p-3 text-[11px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="label">Stock target</span>
              <Segmented
                label="Depot stock target in months"
                value={String(t.targetMonths)}
                onChange={(v) => act({ type: 'setDepotTarget', theater: sel, months: Number(v) })}
                options={DEPOT_TARGETS.map((m) => ({ id: String(m), label: `${m} mo` }))}
              />
            </div>
            {t.lastAirlift > 0 && <p className="text-ops-amber">{qty(t.lastAirlift)} rounds were airlifted here last month.</p>}
            <table className="w-full">
              <thead>
                <tr className="text-ops-dim">
                  <th className="text-left font-normal">Line</th>
                  <th className="text-right font-normal">Depot</th>
                  <th className="text-right font-normal">On the road</th>
                  <th className="text-right font-normal">Draw/mo</th>
                  <th className="text-right font-normal">Cover</th>
                </tr>
              </thead>
              <tbody>
                {activeLines(state)
                  .filter((id) => draw[id] > 0.01 || depotTotal(state, sel, id) > 0)
                  .map((id) => {
                    const cover = draw[id] > 0 ? (depotTotal(state, sel, id) + inbound(state, sel, id)) / draw[id] : 9;
                    return (
                      <tr key={id}>
                        <td className="text-white">{LINES[id].name}</td>
                        <td className="text-right">{qty(depotTotal(state, sel, id))}</td>
                        <td className="text-right text-ops-dim">{qty(inbound(state, sel, id))}</td>
                        <td className="text-right">{qty(draw[id])}</td>
                        <td className={`text-right ${textToneFor(Math.min(1, cover / Math.max(1, t.targetMonths)))}`}>{cover > 8 ? '8+' : cover.toFixed(1)} mo</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Transport" right={`${qty(state.transport)} t a month`}>
          <div className="space-y-2 p-3 text-[11px]">
            <p className="text-ops-dim">
              Convoys carry up to {qty(state.transport)} tonnes a month. Shells are heavy: they take most of it. Upkeep {money(state.transport * 0.004)}/mo.
            </p>
            <Bar ratio={state.transport / MAX_TRANSPORT} tone="bg-ops-cyan" />
            <Btn why={validateAction(state, buy)} onClick={() => act(buy)}>
              More wagons and trucks +{TRANSPORT_STEP} t · {money(TRANSPORT_COST)}
            </Btn>
            <p className="text-ops-dim">Central reserve: {activeLines(state).map((id) => `${LINES[id].name} ${qty(reserveTotal(state.reserves[id]))}`).join(' · ')}</p>
          </div>
        </Panel>

        <Panel title="Allies" right="emergency loans">
          <ul className="divide-y divide-ops-line/50 text-[11px]">
            {PARTNER_IDS.map((p) => (
              <li key={p} className="px-3 py-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-white">{PARTNERS[p].name}</span>
                  <span className="text-ops-dim">goodwill {Math.round(state.partners[p].goodwill)}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {PARTNERS[p].wants.map((id) => {
                    const why = loanBlocker(state, p, id);
                    return (
                      <Btn key={id} why={why} title={`Borrow ${loanQty(id)} now, repay from production over 8 months.`} onClick={() => act({ type: 'requestLoan', partner: p, line: id })}>
                        Borrow {qty(loanQty(id))} {LINES[id].name}
                      </Btn>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={RIVAL_NAME} right="the rival power">
          <div className="p-3 text-[11px]">
            <div className="flex items-baseline justify-between">
              <span className="text-ops-dim">Arms industry index</span>
              <span className={state.rival > 115 ? 'text-ops-red' : 'text-ops-text'}>{state.rival.toFixed(1)}</span>
            </div>
            <Bar ratio={(state.rival - 80) / 80} tone="bg-ops-red" className="my-1" />
            <p className="text-ops-dim">
              The rival keeps building. Every new crisis is fought at {state.rival.toFixed(0)}% of the original intensity. A well-stocked reserve (readiness above 85%)
              slows its growth: deterrence works.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
