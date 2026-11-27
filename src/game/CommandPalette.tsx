// The command palette: type to jump to any tab, site, material or town, or to run a common command.
// Opens with Ctrl+K or Cmd+K, the / key, or the Search button.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SimState } from '../sim/types';
import { CITIES, MATERIALS, SITES, type MaterialId } from '../sim/world';
import { tr } from '../sim/worldgen';
import { KIND_LABEL } from '../ui/map/icons';
import { PANEL_BLURB, PANEL_LABEL, allPanels, type PanelId } from './nav';

/** The height of one result, in pixels. */
const ROW = 40;

export interface Command {
  id: string;
  /** What kind of thing it is, shown on the right. */
  group: 'Tab' | 'Command' | 'Site' | 'Material' | 'Town';
  label: string;
  hint?: string;
  /** A reason it cannot run now. */
  why?: string | null;
  run: () => void;
}

/** Words to search on: lower case, without accents. */
const norm = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** How well a command matches: higher is better, 0 is no match. Every word typed must start a word in the label (or appear in the hint). */
export function score(c: Pick<Command, 'label' | 'hint' | 'group'>, query: string): number {
  const q = norm(query).trim();
  if (!q) return 1;
  const label = norm(c.label);
  const words = label.split(/[^a-z0-9]+/).filter(Boolean);
  const hint = norm(c.hint ?? '');
  let total = 0;
  for (const part of q.split(/\s+/)) {
    if (words.some((w) => w === part)) total += 4;
    else if (words.some((w) => w.startsWith(part))) total += 3;
    else if (label.includes(part)) total += 2;
    else if (hint.includes(part)) total += 1;
    else return 0;
  }
  if (label.startsWith(q)) total += 3;
  return total + (c.group === 'Tab' ? 0.5 : c.group === 'Command' ? 0.4 : 0);
}

export function search(commands: Command[], query: string, limit = 12): Command[] {
  return commands
    .map((c, i) => ({ c, i, s: score(c, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.c);
}

/** The places to go: tabs, sites, materials and towns. */
export function placeCommands(s: SimState, go: { panel: (p: PanelId) => void; site: (id: string) => void; material: (m: MaterialId) => void }): Command[] {
  const out: Command[] = allPanels(s).map((p) => ({ id: `tab-${p}`, group: 'Tab', label: PANEL_LABEL[p], hint: PANEL_BLURB[p], run: () => go.panel(p) }));
  for (const d of SITES) {
    const site = s.sites[d.id];
    if (!site) continue;
    if (d.kind === 'plot' && !site.plantName) continue;
    out.push({ id: `site-${d.id}`, group: 'Site', label: tr(site.plantName ?? d.name), hint: `${KIND_LABEL[site.plantKind ?? d.kind]}${d.nation ? ` ${d.nation}` : ''}`, run: () => go.site(d.id) });
  }
  for (const m of Object.values(MATERIALS)) out.push({ id: `mat-${m.id}`, group: 'Material', label: m.name, hint: m.blurb, run: () => go.material(m.id) });
  CITIES.forEach((c, i) => out.push({ id: `town-${i}`, group: 'Town', label: tr(c.name), hint: 'town mood housing union', run: () => go.panel('towns') }));
  return out;
}

export default function CommandPalette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  // As many results as fit on the screen, whole rows only, so nothing is ever cut in half.
  const fit = typeof window === 'undefined' ? 10 : Math.max(3, Math.min(10, Math.floor((window.innerHeight * 0.86 - 130) / ROW)));
  const results = useMemo(() => search(commands, q, fit), [commands, q, fit]);
  // Focus the box, and give focus back to whatever had it when the palette closes.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => before?.focus?.();
  }, []);
  useEffect(() => setAt(0), [q]);
  // The list can shrink while open: never point past its end.
  const cur = Math.max(0, Math.min(at, results.length - 1));
  const run = (c?: Command) => {
    if (!c || c.why) return;
    onClose();
    c.run();
  };
  return (
    <div role="dialog" aria-modal="true" aria-label="Search and commands" className="fixed inset-0 z-50 flex items-start justify-center bg-ops-bg/90 px-4 pt-[8vh]" onClick={onClose}>
      <div
        className="panel w-full max-w-lg overflow-hidden"
        onClick={(e) => {
          e.stopPropagation();
          input.current?.focus();
        }}
        onKeyDown={(e) => {
          // Escape closes from anywhere in the palette; Tab stays in the search box.
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          } else if (e.key === 'Tab') {
            e.preventDefault();
            input.current?.focus();
          }
        }}
      >
        <input
          ref={input}
          className="input w-full rounded-none border-0 border-b border-ops-line/60 px-3 py-2.5 text-[13px]"
          placeholder="Go to a tab, site, material or town, or run a command…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search"
          role="combobox"
          aria-expanded="true"
          aria-autocomplete="list"
          aria-controls="palette-results"
          aria-activedescendant={results[cur] ? `palette-${results[cur].id}` : undefined}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setAt((a) => Math.min(results.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setAt((a) => Math.max(0, a - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              run(results[cur]);
            }
          }}
        />
        <ul id="palette-results" role="listbox" aria-label="Results" className="py-1 text-[12px]">
          {results.length === 0 && <li className="px-3 py-2 text-ops-dim">Nothing matches “{q}”.</li>}
          {results.map((c, i) => (
            <li
              key={c.id}
              id={`palette-${c.id}`}
              role="option"
              aria-selected={i === cur}
              aria-disabled={!!c.why}
              onMouseEnter={() => setAt(i)}
              onClick={() => run(c)}
              style={{ height: ROW }}
              className={`grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden px-3 ${i === cur ? 'bg-ops-cyan/10' : ''} ${c.why ? 'opacity-60' : ''}`}
            >
              <span className="min-w-0">
                <span className={`block truncate ${i === cur ? 'text-white' : 'text-ops-text'}`}>{c.label}</span>
                {(c.why || c.hint) && <span className={`block truncate text-[10px] ${c.why ? 'text-ops-amber' : 'text-ops-dim'}`}>{c.why ?? c.hint}</span>}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-ops-dim">{c.group}</span>
            </li>
          ))}
        </ul>
        <div className="hidden flex-wrap justify-between gap-2 border-t border-ops-line/60 px-3 py-1.5 text-[10px] text-ops-dim sm:flex">
          <span>↑ ↓ to move · Enter to go · Esc to close</span>
          <span>Ctrl K or / opens this</span>
        </div>
      </div>
    </div>
  );
}
