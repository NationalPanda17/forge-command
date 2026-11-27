// The alerts row (17.1): what needs you now, as one chip for each tab where a fix lives. The list is worked out from
// the game's state (the watch list), so an alert clears itself once the problem is dealt with.
import { Icon, type IconName } from '../ui/icons';
import { tr } from '../sim/worldgen';
import type { PanelId } from './nav';
import { PANEL_LABEL } from './nav';
import type { watchList } from './WatchGuide';

type Watch = ReturnType<typeof watchList>[number];

/** The icon for each tab an alert can point to. */
const ICON: Partial<Record<PanelId, IconName>> = {
  strategy: 'report',
  logistics: 'truck',
  intel: 'crosshair',
  markets: 'coin',
  build: 'truck',
  plan: 'factory',
  stockpile: 'factory',
  staff: 'people',
  towns: 'people',
  allies: 'people',
  power: 'bolt',
  policy: 'report',
  testing: 'flask',
  money: 'coin',
};

export interface AlertGroup {
  panel: PanelId;
  tone: 'bad' | 'warn';
  texts: string[];
}

/** The alerts that need you (warnings and worse), grouped by the tab that fixes them, worst first. */
export function alertGroups(items: Watch[]): AlertGroup[] {
  const by = new Map<PanelId, AlertGroup>();
  for (const w of items) {
    if (w.tone === 'info' || !w.panel) continue;
    const p = w.panel as PanelId;
    const g = by.get(p) ?? { panel: p, tone: 'warn' as const, texts: [] };
    if (w.tone === 'bad') g.tone = 'bad';
    g.texts.push(tr(w.text));
    by.set(p, g);
  }
  return [...by.values()].sort((a, b) => (a.tone === b.tone ? b.texts.length - a.texts.length : a.tone === 'bad' ? -1 : 1));
}

export function AlertChips({ items, onPanel }: { items: Watch[]; onPanel: (p: PanelId) => void }) {
  const groups = alertGroups(items);
  if (!groups.length) return null;
  return (
    <ul className="flex shrink-0 items-center gap-1" aria-label="Alerts">
      {groups.slice(0, 8).map((g) => (
        <li key={g.panel}>
          <button
            type="button"
            data-alert={g.panel}
            className={`fc-alert ${g.tone === 'bad' ? 'is-bad' : ''}`}
            onClick={() => onPanel(g.panel)}
            title={`${PANEL_LABEL[g.panel]}:\n${g.texts.join('\n')}`}
            aria-label={`${g.texts.length} alert${g.texts.length > 1 ? 's' : ''} on the ${PANEL_LABEL[g.panel]} tab: ${g.texts.join('; ')}`}
          >
            <Icon name={ICON[g.panel] ?? 'alert'} size={14} />
            {g.texts.length > 1 && <span className="font-sans text-[12px] font-bold leading-none">{g.texts.length}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
