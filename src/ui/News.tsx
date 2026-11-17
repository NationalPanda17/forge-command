// A news ticker: last month's events plus colour from around the (fictional) world.
import { FACTIONS, FACTION_IDS, PARTNERS, PARTNER_IDS, RIVAL_NAME, type GameState } from '../engine';

function headlines(s: GameState): string[] {
  const out: string[] = [];
  const last = s.history.at(-1);
  for (const m of last?.messages ?? []) if (m.tone !== 'info' || m.text.startsWith('Tender')) out.push(m.text);
  const low = FACTION_IDS.filter((f) => s.factions[f] < 40);
  if (low.length) out.push(`Westminster Row: ${FACTIONS[low[0]].name} grumble about the Munitions Board.`);
  const fond = PARTNER_IDS.filter((p) => s.partners[p].goodwill >= 75);
  if (fond.length) out.push(`${PARTNERS[fond[0]].name} press praises Aldmere as a dependable ally.`);
  if (s.rival > 115) out.push(`Analysts: the ${RIVAL_NAME} has added new missile plants for the third year running.`);
  if (s.publicSupport > 70) out.push('Poll: most Aldmerians back more spending on air defense.');
  if (s.publicSupport < 40) out.push('Poll: confidence in national air defense falls to a record low.');
  if (!out.length) out.push('A quiet month in Aldmere.');
  return out.slice(0, 8);
}

export default function News({ state }: { state: GameState }) {
  const items = headlines(state);
  const text = items.join('   ◆   ');
  return (
    <div className="panel overflow-hidden px-3 py-1.5 text-[11px] text-ops-dim" role="marquee" aria-label="News">
      <div className="flex items-center gap-3">
        <span className="shrink-0 font-sans text-[11px] font-semibold uppercase tracking-widest text-ops-amber">Aldmere Wire</span>
        <div className="relative min-w-0 flex-1 overflow-hidden whitespace-nowrap">
          <span className="ticker inline-block" style={{ animationDuration: `${Math.max(20, text.length / 6)}s` }}>
            {text}
          </span>
        </div>
      </div>
    </div>
  );
}
