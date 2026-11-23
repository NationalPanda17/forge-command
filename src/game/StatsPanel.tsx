// The statistics room: where the money went, what each plant made, what got through, and where confidence came from.
import { useState } from 'react';
import { THREATS, THREAT_IDS } from '../sim/fight';
import type { MonthReport, SimState } from '../sim/types';
import { FINISHED, MATERIALS, SITE_BY_ID, type LineId } from '../sim/world';
import { Bar, COLORS, LineChart, Segmented } from '../ui/kit';
import { int, money } from '../ui/format';
import { monthLabel2 } from './useSim';

type Range = 'year' | 'term' | 'all';
const SPEND: { key: keyof MonthReport['spend']; label: string; color: string }[] = [
  { key: 'purchases', label: 'Purchases', color: COLORS.cyan },
  { key: 'operations', label: 'Operations', color: COLORS.amber },
  { key: 'energy', label: 'Power', color: COLORS.violet },
  { key: 'transport', label: 'Transport', color: COLORS.blue },
  { key: 'projects', label: 'Projects', color: COLORS.green },
  { key: 'demil', label: 'Demil', color: COLORS.dim },
];
const LINE_COLORS = [COLORS.cyan, COLORS.amber, COLORS.green, COLORS.violet, COLORS.blue, COLORS.red, COLORS.dim];
const WHY: { key: 'readiness' | 'leaks' | 'land' | 'debt' | 'other'; label: string }[] = [
  { key: 'readiness', label: 'Readiness against what the Committee expects' },
  { key: 'leaks', label: 'Threats that got through' },
  { key: 'land', label: 'Shortfalls in the land war' },
  { key: 'debt', label: 'Being in the red' },
  { key: 'other', label: 'Everything else: factions, decisions, events, promises, audits' },
];

const signed = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 10) / 10}`;

export default function StatsPanel({ state, onSite }: { state: SimState; onSite: (id: string) => void }) {
  const [range, setRange] = useState<Range>('year');
  const all = state.history;
  const h = range === 'all' ? all : range === 'term' ? all.slice(state.termMonth ?? 0) : all.slice(-12);
  const x = h.length ? [monthLabel2(h[0].month), monthLabel2(h.at(-1)!.month)] : [];
  if (!h.length) return <p className="p-3 text-[11px] text-ops-dim">The statistics fill in at the end of your first month.</p>;
  const sum = (f: (m: MonthReport) => number) => h.reduce((a, m) => a + f(m), 0);
  // Shells are made by the tens of thousands: they get their own line of text so the missiles stay readable.
  const lines = (FINISHED as LineId[]).filter((l) => l !== 'shell155' && h.some((m) => (m.made[l] ?? 0) > 0));
  const shells = sum((m) => m.made.shell155 ?? 0);
  const plants: Record<string, number> = {};
  for (const m of h) for (const [id, v] of Object.entries(m.plantOutput ?? {})) plants[id] = (plants[id] ?? 0) + v;
  const topPlants = Object.entries(plants).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxPlant = Math.max(1e-9, topPlants[0]?.[1] ?? 1);
  const why = WHY.map((w) => ({ ...w, v: sum((m) => m.why?.[w.key] ?? 0) }));
  const maxWhy = Math.max(1, ...why.map((w) => Math.abs(w.v)));
  const decisions = h.flatMap((m) => (m.decisions ?? []).map((d) => ({ ...d, month: m.month }))).filter((d) => d.confidence !== 0 || Math.abs(d.treasury) >= 1);
  const arrived = sum((m) => Object.values(m.arrived).reduce((a, b) => a + b, 0));
  const leaked = sum((m) => Object.values(m.leaked).reduce((a, b) => a + b, 0));
  return (
    <div className="space-y-5 p-3 text-[11px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-ops-dim">
          {h.length} month{h.length === 1 ? '' : 's'} · spent {money(sum((m) => Object.values(m.spend).reduce((a, b) => a + (b ?? 0), 0)))}
        </span>
        <Segmented<Range>
          label="Range"
          value={range}
          onChange={setRange}
          options={[
            { id: 'year', label: 'Last year' },
            { id: 'term', label: 'This term' },
            { id: 'all', label: 'Whole game' },
          ]}
        />
      </div>

      <section>
        <h3 className="label mb-1">Spending by category</h3>
        <LineChart xLabels={x} format={money} min={0} series={SPEND.map((c) => ({ label: c.label, values: h.map((m) => m.spend[c.key] ?? 0), color: c.color }))} />
        <table className="mt-2 w-full">
          <tbody>
            {SPEND.map((c) => (
              <tr key={c.key}>
                <td className="text-ops-dim">{c.label}</td>
                <td className="text-right text-ops-text">{money(sum((m) => m.spend[c.key] ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="label mb-1">Missiles and rockets made each month</h3>
        <LineChart xLabels={x} format={int} min={0} series={lines.map((l, i) => ({ label: MATERIALS[l].name, values: h.map((m) => m.made[l] ?? 0), color: LINE_COLORS[i % LINE_COLORS.length] }))} />
        {shells > 0 && <p className="mt-1 text-ops-dim">And {int(shells)} 155mm shells.</p>}
      </section>

      <section>
        <h3 className="label mb-1">Output by plant</h3>
        {topPlants.length ? (
          <ul className="space-y-1">
            {topPlants.map(([id, v]) => (
              <li key={id}>
                <div className="flex justify-between gap-2">
                  <button type="button" className="min-w-0 truncate text-left text-ops-text hover:underline" onClick={() => onSite(id)}>
                    {state.sites[id]?.plantName ?? SITE_BY_ID[id]?.name ?? id}
                  </button>
                  <span className="shrink-0 text-ops-dim">{money(v)}</span>
                </div>
                <Bar ratio={v / maxPlant} tone="bg-ops-cyan" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ops-dim">Output by plant is recorded from version 10 on.</p>
        )}
      </section>

      <section>
        <h3 className="label mb-1">What got through</h3>
        <p className="mb-1 text-ops-dim">
          {int(leaked)} of {int(arrived)} threats got through ({arrived ? Math.round((leaked / arrived) * 1000) / 10 : 0}%).
        </p>
        <LineChart xLabels={x} format={int} min={0} series={THREAT_IDS.map((t, i) => ({ label: THREATS[t].name, values: h.map((m) => m.leaked[t]), color: LINE_COLORS[i % LINE_COLORS.length] }))} />
      </section>

      <section>
        <h3 className="label mb-1">Where confidence came from</h3>
        <ul className="space-y-1.5">
          {why.map((w) => (
            <li key={w.key}>
              <div className="flex justify-between gap-2">
                <span className="text-ops-text">{w.label}</span>
                <span className={`shrink-0 ${w.v >= 0 ? 'text-ops-green' : 'text-ops-red'}`}>{signed(w.v)}</span>
              </div>
              <Bar ratio={Math.abs(w.v) / maxWhy} tone={w.v >= 0 ? 'bg-ops-green' : 'bg-ops-red'} />
            </li>
          ))}
        </ul>
        <LineChart xLabels={x} min={0} max={100} series={[{ label: 'Confidence', values: h.map((m) => m.confidence), color: COLORS.amber }]} />
      </section>

      <section>
        <h3 className="label mb-1">Decisions and what they did</h3>
        {decisions.length ? (
          <ul className="space-y-1">
            {decisions
              .slice(-15)
              .reverse()
              .map((d, i) => (
                <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <span className="min-w-0 break-words">
                    <span className="text-ops-text">{d.title}</span> <span className="text-ops-dim">· {d.option} · {monthLabel2(d.month)}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    {d.confidence !== 0 && <span className={d.confidence > 0 ? 'text-ops-green' : 'text-ops-red'}>{signed(d.confidence)} conf.</span>}
                    {d.confidence !== 0 && Math.abs(d.treasury) >= 1 && ' · '}
                    {Math.abs(d.treasury) >= 1 && <span className={d.treasury > 0 ? 'text-ops-green' : 'text-ops-text'}>{money(d.treasury)}</span>}
                  </span>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-ops-dim">No decisions with a direct effect in this period.</p>
        )}
      </section>
    </div>
  );
}
