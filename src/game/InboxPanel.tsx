// The inbox: one list of what needs you or happened to you, newest first, with filters and unread marks.
import { useState } from 'react';
import type { SimState } from '../sim/types';
import { Btn, Segmented } from '../ui/kit';
import { inboxItems, type InboxItem, type InboxKind } from './inbox';
import type { PanelId } from './nav';
import type { Tip } from './Tips';
import { dateLabel } from './useSim';
import { tr } from '../sim/worldgen';

type Filter = 'all' | InboxKind;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'decision', label: 'Decisions' },
  { id: 'alert', label: 'Alerts' },
  { id: 'warning', label: 'Bad news' },
  { id: 'note', label: 'Notes' },
];

const TONE_DOT: Record<InboxItem['tone'], string> = { bad: 'bg-ops-red', warn: 'bg-ops-amber', good: 'bg-ops-green', info: 'bg-ops-cyan' };

export default function InboxPanel({
  state,
  readKey,
  tip,
  onMarkRead,
  onPanel,
  onSite,
}: {
  state: SimState;
  readKey: string;
  tip: Tip | null;
  onMarkRead: () => void;
  onPanel: (p: PanelId) => void;
  onSite: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const all = inboxItems(state, readKey, tip);
  const items = filter === 'all' ? all : all.filter((i) => i.kind === filter);
  const unread = all.filter((i) => i.unread && i.kind !== 'decision' && i.kind !== 'note').length;
  const open = (i: InboxItem) => (i.site && i.kind !== 'decision' ? onSite(i.site) : onPanel(i.panel));
  return (
    <div className="space-y-3 p-3 text-[11px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented<Filter> label="Show" value={filter} onChange={setFilter} options={FILTERS} />
        <Btn onClick={onMarkRead} why={unread ? null : 'Nothing unread.'}>
          Mark all read
        </Btn>
      </div>
      {items.length === 0 ? (
        <p className="text-ops-dim">{filter === 'all' ? 'Your inbox is empty.' : 'Nothing here.'}</p>
      ) : (
        <ol className="space-y-1">
          {items.map((i) => (
            <li key={i.key}>
              <button
                type="button"
                onClick={() => open(i)}
                className={`grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-2 rounded border p-2 text-left hover:border-ops-dim ${i.unread ? 'border-ops-cyan/40 bg-ops-cyan/5' : 'border-ops-line/60'}`}
              >
                <span className={`mt-1 inline-block h-2 w-2 rounded-full ${TONE_DOT[i.tone]}`} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="flex flex-wrap justify-between gap-x-2 text-[10px] text-ops-dim">
                    <span>
                      {i.about}
                      {i.unread && <span className="text-ops-cyan"> · new</span>}
                    </span>
                    {i.day >= 0 && <span>{dateLabel(i.day)}</span>}
                  </span>
                  <span className={`block break-words ${i.unread ? 'text-white' : 'text-ops-text'}`}>{tr(i.text)}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
