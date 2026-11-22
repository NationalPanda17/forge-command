// The scenario editor: your own starting situation, and a code to share it.
import { useState } from 'react';
import { CRISES } from '../sim/fight';
import { supplierNations } from '../sim/diplomacy';
import { decodeCustom, encodeCustom, tidy, type CustomScenario, type RivalPace } from '../sim/custom';
import { tr } from '../sim/worldgen';
import { Btn, NumberInput, Segmented } from '../ui/kit';

const steps = (lo: number, hi: number, step: number) => Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => Math.round((lo + i * step) * 100) / 100);

function Pick({ label, value, options, onChange, format }: { label: string; value: number; options: number[]; onChange: (v: number) => void; format: (v: number) => string }) {
  return (
    <label className="block min-w-0">
      <span className="label mb-1 block">{label}</span>
      <select className="input w-full py-0.5" value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label}>
        {options.map((o) => (
          <option key={o} value={o}>
            {format(o)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CustomEditor({ value, onChange }: { value: CustomScenario; onChange: (c: CustomScenario) => void }) {
  const [paste, setPaste] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const set = (patch: Partial<CustomScenario>) => onChange(tidy({ ...value, ...patch }));
  const code = encodeCustom(value);
  return (
    <div className="space-y-3 rounded border border-ops-cyan/40 p-3">
      <div className="label text-ops-cyan">Your scenario</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block min-w-0">
          <span className="label mb-1 block">Name</span>
          <input className="input w-full" value={value.name} maxLength={30} onChange={(e) => onChange({ ...value, name: e.target.value })} onBlur={() => set({})} />
        </label>
        <label className="block min-w-0">
          <span className="label mb-1 block">Crisis on day one</span>
          <select className="input w-full py-0.5" value={value.crisis ?? ''} onChange={(e) => set({ crisis: e.target.value || null })} aria-label="Crisis on day one">
            <option value="">None</option>
            {CRISES.map((c) => (
              <option key={c.id} value={c.id}>
                {tr(c.name)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="block min-w-0">
          <span className="label mb-1 block">Starting money $M</span>
          <NumberInput value={value.treasury} onChange={(v) => set({ treasury: v })} step={50} label="Starting money" className="w-full" />
        </label>
        <label className="block min-w-0">
          <span className="label mb-1 block">Budget $M a month</span>
          <NumberInput value={value.appropriation} onChange={(v) => set({ appropriation: v })} min={100} step={5} label="Monthly budget" className="w-full" />
        </label>
        <Pick label="War reserve" value={value.reserve} options={steps(0.25, 1.5, 0.25)} onChange={(v) => set({ reserve: v })} format={(v) => `${Math.round(v * 100)}% of usual`} />
        <Pick label="Committee confidence" value={value.confidence} options={steps(20, 90, 5)} onChange={(v) => set({ confidence: v })} format={(v) => String(v)} />
        <Pick label="Prices" value={value.prices} options={steps(1, 1.4, 0.05)} onChange={(v) => set({ prices: v })} format={(v) => (v === 1 ? 'Normal' : `+${Math.round((v - 1) * 100)}%`)} />
        <Pick label="Relations with allies" value={value.allies} options={steps(10, 90, 5)} onChange={(v) => set({ allies: v })} format={(v) => String(v)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <div className="label mb-1">The rival's pace</div>
          <Segmented<RivalPace>
            label="The rival's pace"
            value={value.rivalPace}
            onChange={(v) => set({ rivalPace: v })}
            options={[
              { id: 'slow', label: 'Slow' },
              { id: 'normal', label: 'Normal' },
              { id: 'fast', label: 'Fast' },
            ]}
          />
        </div>
        <div className="min-w-0">
          <div className="label mb-1">Disruptions and events</div>
          <Segmented<string>
            label="Disruptions and events"
            value={String(value.events)}
            onChange={(v) => set({ events: Number(v) })}
            options={[
              { id: '0', label: 'None' },
              { id: '0.5', label: 'Rare' },
              { id: '1', label: 'Normal' },
              { id: '2', label: 'Often' },
            ]}
          />
        </div>
      </div>
      <div>
        <div className="label mb-1">Export bans at the start</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {supplierNations().map((n) => (
            <Pick key={n} label={n} value={value.bans[n] ?? 0} options={[0, 3, 6, 9, 12, 18, 24]} onChange={(v) => set({ bans: { ...value.bans, [n]: v } })} format={(v) => (v ? `${v} months` : 'None')} />
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="label">Share it</div>
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 break-all rounded border border-ops-line/60 px-2 py-1 text-[10px] text-ops-text">{code}</code>
          <Btn
            onClick={() => {
              navigator.clipboard?.writeText(code).then(
                () => setNote('Code copied.'),
                () => setNote('Copy the code by hand.'),
              );
            }}
          >
            Copy
          </Btn>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input className="input min-w-0 flex-1" placeholder="Paste a scenario code" value={paste} onChange={(e) => setPaste(e.target.value)} aria-label="Scenario code" />
          <Btn
            onClick={() => {
              const c = decodeCustom(paste);
              if (c) {
                onChange(c);
                setNote(`Loaded “${c.name}”.`);
                setPaste('');
              } else setNote('That is not a scenario code.');
            }}
          >
            Load code
          </Btn>
        </div>
        {note && <p className="text-[10px] text-ops-dim">{note}</p>}
      </div>
    </div>
  );
}
