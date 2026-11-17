// A drawing of one campus floor: every bay, what it builds, and what is under construction.
import { BASE_BAYS_PER_LINE, LINES, linesAt, type CampusId, type GameState, type LineId } from '../engine';

const PALETTE = ['var(--ops-cyan)', 'var(--ops-amber)', 'var(--ops-violet)', 'var(--ops-green)', 'var(--ops-blue)'];

export default function CampusFloor({ state, campus }: { state: GameState; campus: CampusId }) {
  const cs = state.campuses[campus];
  const ids = linesAt(campus);
  const color = (id: LineId) => PALETTE[ids.indexOf(id) % PALETTE.length];
  type Bay = { kind: 'line'; id: LineId; base: boolean; ramp: number; fai: boolean } | { kind: 'retool'; id: LineId } | { kind: 'free' } | { kind: 'building' };
  const bays: Bay[] = [];
  for (const id of ids) {
    const line = state.lines[id];
    if (!line.tranches.length) continue;
    const base = line.tranches[0];
    for (let i = 0; i < BASE_BAYS_PER_LINE; i++) bays.push({ kind: 'line', id, base: true, ramp: base.maturity, fai: base.faiMonths > 0 });
    for (const t of line.tranches.slice(1)) bays.push({ kind: 'line', id, base: false, ramp: t.maturity, fai: t.faiMonths > 0 });
  }
  for (const r of cs.retooling) bays.push({ kind: 'retool', id: r.to });
  while (bays.length < cs.bays) bays.push({ kind: 'free' });
  for (const b of cs.construction) for (let i = 0; i < b.bays; i++) bays.push({ kind: 'building' });
  const cols = 10;
  const size = 26;
  const gap = 4;
  const rows = Math.ceil(bays.length / cols);
  const w = cols * (size + gap);
  const h = rows * (size + gap) + 30;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[420px]" role="img" aria-label={`${cs.bays} bays, ${bays.filter((b) => b.kind === 'free').length} free`}>
        {bays.map((b, i) => {
          const x = (i % cols) * (size + gap);
          const y = Math.floor(i / cols) * (size + gap);
          if (b.kind === 'free') return <rect key={i} x={x} y={y} width={size} height={size} rx="3" fill="none" stroke="rgb(var(--ops-line))" strokeDasharray="3 2" />;
          if (b.kind === 'building')
            return (
              <g key={i}>
                <rect x={x} y={y} width={size} height={size} rx="3" fill="rgb(var(--ops-dim) / 0.15)" stroke="rgb(var(--ops-dim))" />
                <path d={`M${x + 4} ${y + size - 4} L${x + size - 4} ${y + 4}`} stroke="rgb(var(--ops-dim))" />
              </g>
            );
          if (b.kind === 'retool') return <rect key={i} x={x} y={y} width={size} height={size} rx="3" fill="none" stroke={`rgb(${color(b.id)})`} strokeDasharray="2 2" />;
          return (
            <g key={i}>
              <rect x={x} y={y} width={size} height={size} rx="3" fill={`rgb(${color(b.id)} / ${b.fai ? 0.15 : 0.25 + 0.55 * b.ramp})`} stroke={`rgb(${color(b.id)})`} strokeWidth={b.base ? 1 : 2} />
              {b.fai && (
                <text x={x + size / 2} y={y + size / 2 + 4} textAnchor="middle" fontSize="10" className="fill-ops-text">
                  ?
                </text>
              )}
            </g>
          );
        })}
        {Array.from({ length: cs.testCells }).map((_, i) => (
          <g key={`t${i}`} transform={`translate(${i * 22}, ${rows * (size + gap) + 8})`}>
            <circle cx="8" cy="8" r="7" fill="none" stroke="rgb(var(--ops-text))" />
            <path d="M5 8 L7.5 10.5 L11.5 5.5" fill="none" stroke="rgb(var(--ops-text))" />
          </g>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-ops-dim">
        {ids
          .filter((id) => state.lines[id].tranches.length > 0)
          .map((id) => (
            <span key={id} className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2" style={{ background: `rgb(${color(id)})` }} />
              {LINES[id].name}
            </span>
          ))}
        <span>dashed: free · ? inspecting · ✓ test cells</span>
      </div>
    </div>
  );
}
