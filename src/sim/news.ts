// The Aldmere Courier: a short edition at the end of each month, written from what happened.
import { REGIONS } from './world';
import type { Headline, MonthReport, SimState } from './types';

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
const pct = (v: number) => `${Math.round(v * 100)}%`;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Cuts a feed line down to a headline: the part before the first colon, or the whole sentence. */
function headlineFrom(text: string): string {
  const head = text.split(/:\s/)[0].replace(/\.$/, '');
  return head.length > 70 ? `${head.slice(0, 67).trim()}…` : head;
}

/** Writes this month's edition. Call at month end, before the report is filed. */
export function writeEdition(s: SimState, m: MonthReport, prev: MonthReport | undefined): Headline[] {
  const out: (Headline & { weight: number })[] = [];
  const from = m.month * 30;
  const items = s.feed.filter((f) => f.day > from && f.day <= from + 30);

  const c = s.crisis;
  if (c?.phase === 'active') {
    const stopped = Math.round(sum(m.stopped));
    const leaked = Math.round(sum(m.leaked));
    out.push({ weight: 100, tone: leaked > 10 ? 'bad' : 'warn', title: `Fighting goes on in the ${REGIONS[c.region].name}`, body: `${stopped} incoming threats were stopped this month and ${leaked} got through. Every launcher in the region is drawing on the depots.` });
  } else if (c?.phase === 'warning') {
    out.push({ weight: 90, tone: 'warn', title: `Tension rises over the ${c.name}`, body: `Officials expect trouble in the ${REGIONS[c.region].name} within weeks. Depots there are said to be filling up.` });
  }
  if (items.some((f) => f.text.includes('has wound down'))) out.push({ weight: 95, tone: 'good', title: 'Guns fall quiet', body: 'The fighting has wound down. The Committee will now ask what it cost, and what is left in the racks.' });

  if (prev) {
    const d = m.readiness - prev.readiness;
    if (Math.abs(d) >= 0.04)
      out.push({
        weight: 70 + Math.abs(d) * 200,
        tone: d > 0 ? 'good' : 'bad',
        title: d > 0 ? `Arsenals catch up: reserve at ${pct(m.readiness)}` : `Stocks slide to ${pct(m.readiness)} of the Committee's goal`,
        body: d > 0 ? 'Lines ran hard this month and more rounds reached the depots than left them.' : 'More rounds were fired or retired than the arsenals could replace.',
      });
    const dc = m.confidence - prev.confidence;
    if (Math.abs(dc) >= 4)
      out.push({ weight: 60 + Math.abs(dc) * 3, tone: dc > 0 ? 'good' : 'bad', title: dc > 0 ? 'Committee warms to the Director' : 'Committee grows uneasy', body: dc > 0 ? 'Members praised the Board in closed session.' : `Confidence in the Board has fallen to ${Math.round(m.confidence)}. Some members are asking for a change.` });
  }

  // The month's big events, as the feed recorded them.
  for (const f of items.filter((x) => x.tone === 'bad' && /Accident|Strike|Explosion|explosion|fire|failure|Flooding|strike|cyber|Export ban|closed|condemned/.test(x.text)).slice(0, 3)) {
    out.push({ weight: 75, tone: 'bad', title: headlineFrom(f.text), body: f.text });
  }
  for (const f of items.filter((x) => x.tone === 'good' && /opens to traffic|enters service|qualified to supply|is delivered in full|grants/.test(x.text)).slice(0, 2)) {
    out.push({ weight: 65, tone: 'good', title: headlineFrom(f.text), body: f.text });
  }

  if (prev?.priceIndex && m.priceIndex && m.priceIndex / prev.priceIndex > 1.004)
    out.push({ weight: 45, tone: 'warn', title: 'Prices up again', body: `Costs are now ${pct(m.priceIndex - 1)} higher than when the Director took office. Suppliers on fixed contracts are feeling it.` });
  if ((m.exported ?? 0) > 0) out.push({ weight: 40, tone: 'info', title: `${Math.round(m.exported!)} rounds shipped abroad`, body: 'Export orders bring money home and keep the lines busy, though some members would rather keep every round here.' });

  const moy = (m.month + 1) % 12;
  const seasonal: Record<number, string> = { 11: 'Winter closes in on the north', 2: 'Thaw floods the low roads', 5: 'Summer heat arrives', 8: 'A calm autumn for the railways' };
  if (seasonal[moy]) out.push({ weight: 30, tone: 'info', title: seasonal[moy], body: `${MONTHS[moy]} begins. Planners say it is time to move stock before the weather turns.` });

  if (!out.length) out.push({ weight: 1, tone: 'info', title: 'A quiet month at the Board', body: `Readiness stands at ${pct(m.readiness)}. The arsenals worked, the trains ran, and nothing exploded.` });
  return out
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map(({ title, body, tone }) => ({ title, body, tone }));
}
