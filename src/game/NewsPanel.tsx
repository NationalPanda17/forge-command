// The Courier: the month's news, as the country's papers saw it.
import { useState } from 'react';
import type { SimState } from '../sim/types';
import { countryName, tr } from '../sim/worldgen';
import { Btn } from '../ui/kit';
import { monthLabel2 } from './useSim';

const TONE = { good: 'text-ops-green', bad: 'text-ops-red', warn: 'text-ops-amber', info: 'text-ops-text' } as const;

export default function NewsPanel({ state }: { state: SimState }) {
  const editions = state.news;
  const [pick, setPick] = useState<number | null>(null);
  if (!editions.length) return <p className="p-3 text-[11px] text-ops-dim">The first edition of the Courier comes out at the end of the month.</p>;
  const i = pick === null ? editions.length - 1 : Math.min(pick, editions.length - 1);
  const ed = editions[i];
  const [lead, ...rest] = ed.headlines;
  return (
    <article className="p-3 text-[12px]">
      <header className="border-b-2 border-double border-ops-line pb-2 text-center">
        <div className="font-sans text-[22px] font-bold uppercase tracking-[0.18em] text-white">The {countryName()} Courier</div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-ops-dim">
          <Btn why={i === 0 ? 'No older edition' : null} onClick={() => setPick(i - 1)}>
            ← Older
          </Btn>
          <span>{monthLabel2(ed.month)} edition</span>
          <Btn why={i === editions.length - 1 ? 'This is the latest' : null} onClick={() => setPick(i + 1)}>
            Newer →
          </Btn>
        </div>
      </header>
      {lead && (
        <section className="border-b border-ops-line py-3">
          <h2 className={`font-sans text-[20px] font-bold leading-snug ${TONE[lead.tone]}`}>{tr(lead.title)}</h2>
          <p className="mt-1 leading-relaxed text-ops-text">{tr(lead.body)}</p>
        </section>
      )}
      <div className="grid gap-x-4 sm:grid-cols-2">
        {rest.map((h, k) => (
          <section key={k} className="border-b border-ops-line/60 py-2">
            <h3 className={`font-sans text-[14px] font-semibold leading-snug ${TONE[h.tone]}`}>{tr(h.title)}</h3>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ops-dim">{tr(h.body)}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
