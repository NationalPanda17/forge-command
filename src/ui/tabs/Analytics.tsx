import { useState } from 'react';
import { COMPONENTS, COMPONENT_IDS, LINES, activeLines, reserveTarget, type GameState, type LineId } from '../../engine';
import { COLORS, Empty, LineChart, Panel } from '../kit';
import { money, shortMonth } from '../format';

export default function Analytics({ state }: { state: GameState }) {
  const lines = activeLines(state);
  const [line, setLine] = useState<LineId>(lines[0] ?? 'pac3');
  const h = state.history;
  const x = h.map((m) => shortMonth(m.month));
  if (h.length < 2) return <Panel title="Analytics"><Empty>Charts appear after a couple of months.</Empty></Panel>;
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <Panel
        title="Line by line"
        right={
          <select className="input py-0.5" value={line} onChange={(e) => setLine(e.target.value as LineId)} aria-label="Line to chart">
            {lines.map((id) => (
              <option key={id} value={id}>
                {LINES[id].name}
              </option>
            ))}
          </select>
        }
      >
        <div className="space-y-4 p-3">
          <div>
            <div className="label mb-1">Built vs drawn each month</div>
            <LineChart
              min={0}
              xLabels={x}
              series={[
                { label: 'Built', values: h.map((m) => m.output[line] ?? 0), color: COLORS.green },
                { label: 'Drawn', values: h.map((m) => m.draw[line] ?? 0), color: COLORS.red },
              ]}
            />
          </div>
          <div>
            <div className="label mb-1">National stock vs goal</div>
            <LineChart
              min={0}
              xLabels={x}
              series={[
                { label: 'Stock', values: h.map((m) => m.national?.[line] ?? 0), color: COLORS.cyan },
                { label: 'Goal', values: h.map(() => reserveTarget(state, line)), color: COLORS.dim, dashed: true },
              ]}
            />
          </div>
        </div>
      </Panel>

      <Panel title="Money">
        <div className="space-y-4 p-3">
          <div>
            <div className="label mb-1">Where the money went</div>
            <LineChart
              min={0}
              xLabels={x}
              format={money}
              series={[
                { label: 'Wages', values: h.map((m) => m.ledger.wages), color: COLORS.violet },
                { label: 'Overhead', values: h.map((m) => m.ledger.overhead), color: COLORS.blue },
                { label: 'Parts', values: h.map((m) => m.ledger.components), color: COLORS.amber },
                { label: 'Projects', values: h.map((m) => m.ledger.projects), color: COLORS.green },
                { label: 'Logistics', values: h.map((m) => m.ledger.logistics ?? 0), color: COLORS.cyan },
              ]}
            />
          </div>
          <div>
            <div className="label mb-1">Interceptors fired vs threat value stopped</div>
            <LineChart
              min={0}
              xLabels={x}
              format={money}
              series={[
                { label: 'Fired', values: h.map((m) => m.interceptorSpend), color: COLORS.red },
                { label: 'Stopped', values: h.map((m) => m.threatValueStopped), color: COLORS.green },
              ]}
            />
          </div>
        </div>
      </Panel>

      <Panel title="Component stock" right="month-end">
        <div className="grid gap-4 p-3 md:grid-cols-2">
          {COMPONENT_IDS.map((c) => (
            <div key={c}>
              <div className="label mb-1">{COMPONENTS[c].name}</div>
              <LineChart min={0} height={70} xLabels={x} series={[{ label: COMPONENTS[c].unit, values: h.map((m) => m.stocks?.[c] ?? 0), color: COLORS.amber }]} />
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Committee and treasury">
        <div className="space-y-4 p-3">
          <LineChart min={0} max={100} xLabels={x} series={[{ label: 'Confidence', values: h.map((m) => m.confidence), color: COLORS.amber }, { label: 'Readiness %', values: h.map((m) => m.readiness * 100), color: COLORS.cyan }]} />
          <LineChart xLabels={x} format={money} series={[{ label: 'Treasury', values: h.map((m) => m.treasury), color: COLORS.green }]} />
        </div>
      </Panel>
    </div>
  );
}
