// The outliner (17.1): everything under way, with how long is left, down the left edge of the map. Click an entry to
// go to it. Folds away to a single heading.
import { useState } from 'react';
import { projectName } from '../sim/build';
import { FORKS } from '../sim/doctrine';
import { OPS } from '../sim/intelops';
import { RESEARCH } from '../sim/strategy';
import type { SimState } from '../sim/types';
import { tr } from '../sim/worldgen';
import { REGIONS, SITE_BY_ID } from '../sim/world';
import { Icon, type IconName } from '../ui/icons';
import type { PanelId } from './nav';

export interface UnderWay {
  key: string;
  icon: IconName;
  label: string;
  /** Days left, and the share done (0–1) when the total is known. */
  days: number;
  done: number | null;
  tone: 'bad' | 'warn' | 'info';
  panel?: PanelId;
  site?: string;
}

/** Everything under way, soonest to finish first; a crisis always leads. */
export function underWay(s: SimState): UnderWay[] {
  const out: UnderWay[] = [];
  if (s.crisis)
    out.push({ key: 'crisis', icon: 'alert', label: `${s.crisis.name} · ${s.crisis.phase === 'warning' ? 'coming' : REGIONS[s.crisis.region].name}`, days: s.crisis.days, done: null, tone: s.crisis.phase === 'active' ? 'bad' : 'warn', panel: 'logistics' });
  const r = s.strategy.research.active;
  if (r) out.push({ key: 'research', icon: 'flask', label: RESEARCH[r.id].name, days: r.days, done: r.total ? 1 - r.days / r.total : null, tone: 'info', panel: 'strategy' });
  for (const p of s.network.projects) out.push({ key: `p${p.id}`, icon: 'truck', label: tr(projectName(s, p)), days: p.days, done: p.total ? 1 - p.days / p.total : null, tone: 'info', panel: 'build' });
  for (const site of Object.values(s.sites)) {
    const def = SITE_BY_ID[site.id];
    if (!def) continue;
    if (site.status === 'building') out.push({ key: `b${site.id}`, icon: 'factory', label: `Building ${tr(def.name)}`, days: site.repairDays, done: null, tone: 'info', site: site.id });
    else if (site.status === 'damaged') out.push({ key: `d${site.id}`, icon: 'factory', label: `Repairs at ${tr(def.name)}`, days: site.repairDays, done: null, tone: 'warn', site: site.id });
    if (site.qualifyingDays !== null && site.qualifyingDays > 0) out.push({ key: `q${site.id}`, icon: 'report', label: `Qualifying ${tr(def.name)}`, days: site.qualifyingDays, done: null, tone: 'info', site: site.id });
  }
  const op = s.intel?.active;
  if (op) out.push({ key: 'intel', icon: 'crosshair', label: OPS[op.kind].name, days: op.days, done: op.total ? 1 - op.days / op.total : null, tone: 'info', panel: 'intel' });
  const d = s.doctrine?.active;
  if (d) {
    const fork = FORKS.find((f) => f.id === d.fork);
    out.push({ key: 'doctrine', icon: 'star', label: fork ? fork[d.side].name : 'Doctrine', days: d.days, done: d.total ? 1 - d.days / d.total : null, tone: 'info', panel: 'doctrine' });
  }
  const [lead, rest] = [out.filter((x) => x.key === 'crisis'), out.filter((x) => x.key !== 'crisis')];
  return [...lead, ...rest.sort((a, b) => a.days - b.days)];
}

const timeLeft = (days: number) => (days >= 60 ? `${Math.round(days / 30)} mo` : `${Math.max(0, Math.ceil(days))} d`);

export function Outliner({ state, onPanel, onSite, top, left }: { state: SimState; onPanel: (p: PanelId) => void; onSite: (id: string) => void; top: number; left: number }) {
  const [open, setOpen] = useState(true);
  const items = underWay(state);
  if (!items.length) return null;
  return (
    <section className="fc-zoom fc-outliner" style={{ top, left, maxHeight: `calc(100% - ${top + 96}px)` }} aria-label="Under way">
      <button type="button" className="fc-outliner-head" aria-expanded={open} onClick={() => setOpen(!open)} title={open ? 'Fold away' : 'Show everything under way'}>
        <span>Under way</span>
        <span className="text-ops-dim">{items.length}</span>
      </button>
      {open && (
        <ul className="fc-outliner-list">
          {items.map((x) => (
            <li key={x.key}>
              <button type="button" className="fc-outliner-row" onClick={() => (x.site ? onSite(x.site) : x.panel && onPanel(x.panel))} title={`${x.label}: ${timeLeft(x.days)} left`}>
                <span className={x.tone === 'bad' ? 'text-ops-red' : x.tone === 'warn' ? 'text-ops-amber' : 'text-ops-cyan'}>
                  <Icon name={x.icon} size={13} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{x.label}</span>
                  {x.done !== null && (
                    <span className="fc-outliner-bar">
                      <span style={{ width: `${Math.round(Math.max(0, Math.min(1, x.done)) * 100)}%` }} />
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-ops-dim">{timeLeft(x.days)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
