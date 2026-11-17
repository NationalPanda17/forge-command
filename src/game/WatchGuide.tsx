// The watch list (what needs attention now) and the in-game guide.
import { useState, type ReactNode } from 'react';
import { BASE_LINES } from '../sim/fight';
import { baseDailyDraw, inputRates, lotQty, nationalStock, reserveTarget } from '../sim/selectors';
import type { SimState } from '../sim/types';
import { monthsTo } from '../sim/analytics';
import { FINISHED, MATERIALS, REGIONS, SITES, SITE_BY_ID, type LineId, type MaterialId } from '../sim/world';

interface Watch {
  tone: 'bad' | 'warn' | 'info';
  text: string;
  site?: string;
  material?: MaterialId;
}

export function watchList(s: SimState): Watch[] {
  const out: Watch[] = [];
  if (s.strategy.decisions.length) out.push({ tone: 'warn', text: `${s.strategy.decisions.length} decision${s.strategy.decisions.length > 1 ? 's' : ''} waiting on the Board tab.` });
  if (s.crisis) out.push({ tone: s.crisis.phase === 'active' ? 'bad' : 'warn', text: `${s.crisis.name}: ${s.crisis.phase === 'warning' ? 'raise the depot target in' : 'keep feeding'} ${REGIONS[s.crisis.region].name}.`, site: REGIONS[s.crisis.region].depot });
  // Your plants: what is holding them back.
  for (const def of SITES.filter((x) => x.owner === 'state' && x.processes.length)) {
    const site = s.sites[def.id];
    for (const p of site.processes) {
      if (p.run === 'idle' || !p.lastLimit || ['capacity', 'idle', 'demand'].includes(p.lastLimit)) continue;
      const what = p.lastLimit === 'crew' ? 'short of crew' : p.lastLimit === 'damaged' ? 'stopped' : `short of ${MATERIALS[p.lastLimit as MaterialId]?.name.toLowerCase()}`;
      out.push({ tone: 'bad', text: `${def.name}: ${what}.`, site: def.id, material: MATERIALS[p.lastLimit as MaterialId] ? (p.lastLimit as MaterialId) : undefined });
    }
    const rates = inputRates(s, site);
    for (const [m, r] of Object.entries(rates) as [MaterialId, number][]) {
      if (r > 0 && (site.stock[m] ?? 0) / r < 3) out.push({ tone: 'warn', text: `${def.name} has under three days of ${MATERIALS[m].name.toLowerCase()}.`, site: def.id, material: m });
    }
  }
  // The supply chain upstream.
  for (const def of SITES) {
    const site = s.sites[def.id];
    if (site.embargoDays > 0) out.push({ tone: 'bad', text: `Export ban on ${def.name} (${def.nation}), ${site.embargoDays} days left.`, site: def.id });
    else if (site.disruptionDays > 0) out.push({ tone: 'warn', text: `${def.name} disrupted: ${Math.round(site.disruptionFactor * 100)}% output for ${site.disruptionDays} more days.`, site: def.id });
    if (site.status === 'closed') out.push({ tone: 'bad', text: `${def.name} has closed.`, site: def.id });
  }
  // Bases with empty racks.
  for (const def of SITES.filter((x) => BASE_LINES[x.kind])) {
    for (const l of BASE_LINES[def.kind]!) {
      if (!s.lines[l].unlocked || baseDailyDraw(s, def.id, l) <= 0) continue;
      if (lotQty(s.sites[def.id].lots[l]) < 1) out.push({ tone: 'bad', text: `${def.name} has no ${MATERIALS[l].name} ready.`, site: def.id, material: l });
    }
  }
  // National reserve.
  for (const l of FINISHED as LineId[]) {
    if (!s.lines[l].unlocked) continue;
    const r = nationalStock(s, l) / Math.max(1, reserveTarget(s, l));
    if (r < 0.5) out.push({ tone: 'warn', text: `${MATERIALS[l].name} reserve at ${Math.round(r * 100)}% of the one-year goal.`, material: l });
  }
  // A year ahead: rounds that will run low before you can react.
  for (const l of FINISHED as LineId[]) {
    if (!s.lines[l].unlocked || reserveTarget(s, l) <= 0) continue;
    if (nationalStock(s, l) / reserveTarget(s, l) < 0.5) continue;
    const m = monthsTo(s, l, 0.5, 9);
    if (m !== null) out.push({ tone: 'warn', text: `Forecast: ${MATERIALS[l].name} falls below half of target in ${m} month${m > 1 ? 's' : ''} (Plan tab).`, material: l });
  }
  // Markets.
  for (const c of s.contracts) {
    const left = c.endDay - s.day;
    if (left <= 45 && !s.contracts.some((k) => k !== c && k.material === c.material && k.endDay > c.endDay)) out.push({ tone: 'warn', text: `Contract for ${MATERIALS[c.material].name.toLowerCase()} with ${SITE_BY_ID[c.site].name} ends in ${left} days. Tender for a new one (Markets tab).`, site: c.site, material: c.material });
  }
  for (const t of s.tenders) out.push({ tone: 'info', text: `Bids for ${MATERIALS[t.material].name.toLowerCase()} are waiting to be awarded (Markets tab).`, material: t.material });
  for (const x of s.exports) {
    const due = (x.qty * (s.day - x.start)) / Math.max(1, x.endDay - x.start);
    if (x.delivered < due * 0.8 && s.day - x.start > 30) out.push({ tone: 'warn', text: `Export order for ${x.customer} is behind: ${Math.round(x.delivered)} of ${Math.round(x.qty)} delivered.`, material: x.line });
  }
  const retired = Object.values(s.sites).reduce((a, x) => a + Object.entries(x.unserviceable).reduce((b, [, q]) => b + (q ?? 0), 0), 0) - Object.values(s.sites.karrowDemil.unserviceable).reduce((a, q) => a + (q ?? 0), 0);
  if (retired >= 1) out.push({ tone: 'info', text: `${Math.round(retired)} retired rounds are waiting to move to Karrow or be refurbished.` });
  if (!s.strategy.research.active) out.push({ tone: 'info', text: 'Your engineers are idle (Board tab).' });
  const rank = { bad: 0, warn: 1, info: 2 } as const;
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, 30);
}

export function WatchPanel({ state, onSite, onMaterial }: { state: SimState; onSite: (id: string) => void; onMaterial: (m: MaterialId) => void }) {
  const items = watchList(state);
  return (
    <ul className="divide-y divide-ops-line/40 text-[11px]">
      {items.length === 0 && <li className="p-3 text-ops-dim">Nothing needs you right now.</li>}
      {items.map((w, i) => (
        <li key={i} className="flex items-start justify-between gap-2 px-3 py-1.5">
          <span className={w.tone === 'bad' ? 'text-ops-red' : w.tone === 'warn' ? 'text-ops-amber' : 'text-ops-text'}>{w.text}</span>
          <span className="flex shrink-0 gap-2">
            {w.site && (
              <button type="button" className="text-ops-cyan hover:underline" onClick={() => onSite(w.site!)}>
                site
              </button>
            )}
            {w.material && (
              <button type="button" className="text-ops-cyan hover:underline" onClick={() => onMaterial(w.material!)}>
                chain
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

const P = ({ children }: { children: ReactNode }) => <p className="mb-2 leading-relaxed text-ops-text">{children}</p>;
const Li = ({ children }: { children: ReactNode }) => <li className="mb-1 leading-relaxed text-ops-text">{children}</li>;

const SECTIONS: { id: string; title: string; body: ReactNode }[] = [
  {
    id: 'start',
    title: 'First steps',
    body: (
      <>
        <P>You run the munitions industry of a fictional country, in real time. The clock is paused: press 1× (or space) to start it.</P>
        <ol className="list-decimal pl-5">
          <Li>Open <b>Watch</b>. It lists what needs you, most urgent first, with links to the site or the supply chain behind it.</Li>
          <Li>Click your arsenals (the square cyan markers on the map) to see their lines, what limits them, and their stock of parts.</Li>
          <Li>Open <b>Plan</b> to see each round a year ahead, and the weakest link under it.</Li>
          <Li>Open <b>Markets</b> before the starting contracts end after nine months, and tender for new ones.</Li>
          <Li>Use <b>Materials</b> to follow any part down to the mine, and see who makes it and where it is.</Li>
          <Li>Watch the <b>Stockpile</b>: much of the war reserve is old and will retire unless you test, refurbish or replace it.</Li>
          <Li>Open the <b>Board</b> to start research, hire staff and answer decisions.</Li>
        </ol>
      </>
    ),
  },
  {
    id: 'chain',
    title: 'Cradle to grave',
    body: (
      <ul className="list-disc pl-5">
        <Li><b>Extraction:</b> mines, quarries, wells and forests produce iron ore, coal, bauxite, zinc, copper, rare earths, quartz, brine, gas and pulp.</Li>
        <Li><b>Processing:</b> steelworks, smelters, refineries and chemical plants turn them into steel, aluminium (with gallium as a by-product), germanium, copper, rare-earth oxide, polysilicon, ammonia, nitric acid, perchlorate, binder, nitrocellulose and high explosive.</Li>
        <Li><b>Intermediates:</b> propellant, wafers, chips, magnets and optics.</Li>
        <Li><b>Components:</b> motors, warheads, seekers, guidance, actuators, airframes, fuzes, shell bodies and charges.</Li>
        <Li><b>Your arsenals:</b> they integrate and accept finished rounds, which go to the central depot, then to regional depots, then to the bases.</Li>
        <Li><b>Service life:</b> every round ages. Surveillance firings can extend a lot twice, a year at a time. Retired rounds are refurbished at a depot or shipped to Karrow, where they are burned (cheap, unpopular) or recycled (costly, and recovers value).</Li>
      </ul>
    ),
  },
  {
    id: 'logistics',
    title: 'Logistics',
    body: (
      <ul className="list-disc pl-5">
        <Li>Everything moves on the network: rail (cheap, big), road (everywhere, smaller), sea (cheap, slow, to islands and abroad) and air (fast, tiny, expensive). Each route carries only so many tonnes a day.</Li>
        <Li>Sites pull what they need: plants keep days of inputs, bases keep ready rounds, depots keep days of their region's draw. Set depot targets on the Logistics tab, and raise the one a crisis is heading for.</Li>
        <Li>Foreign suppliers are reached by sea and can be hit by export bans.</Li>
      </ul>
    ),
  },
  {
    id: 'industry',
    title: 'Your plants and your suppliers',
    body: (
      <ul className="list-disc pl-5">
        <Li><b>Your arsenals:</b> set shifts, expand, hire (training takes about three months) and overhaul worn plants.</Li>
        <Li><b>Private companies:</b> they sell to anyone. Contracts reserve their output for you at a discount; without one you pay 30% more. Fund their expansion, qualify new suppliers (about eight months), and bail them out if they falter, or watch them close.</Li>
        <Li><b>Disruptions:</b> fires, failures, floods and strikes cut a site's output for weeks. Everything downstream feels it.</Li>
      </ul>
    ),
  },
  {
    id: 'plan',
    title: 'Planning',
    body: (
      <ul className="list-disc pl-5">
        <Li><b>Forecast:</b> the Plan tab projects each round's national stock for twelve months from today's output, expected firing (crises included), exports and lots reaching the end of their life.</Li>
        <Li><b>What limits it:</b> it follows the round's bill of materials down to the mine, taking the tightest input at each level, and shows supply against demand for each.</Li>
        <Li><b>Overstock hurts:</b> a line far above target still eats motors, warheads and seekers that other rounds need. Idle it at its arsenal until it comes back down.</Li>
      </ul>
    ),
  },
  {
    id: 'markets',
    title: 'Markets and the world',
    body: (
      <ul className="list-disc pl-5">
        <Li><b>Prices</b> rise about 3% a year, faster in a crisis. Wages, running costs, freight and spot purchases all follow. Contracts lock a price, which is worth more every year. Budgets keep up with most, but not all, of it.</Li>
        <Li><b>Tenders:</b> every qualified supplier bids at once. More bidders mean sharper prices, which is one more reason to qualify second sources. Weak firms bid low but are less reliable, and may later ask to reprice.</Li>
        <Li><b>Seasons:</b> winter ice cuts the northern sea lanes and snow slows roads; the spring thaw floods low roads; summer heat trims energetics output. Stock the north before winter.</Li>
        <Li><b>Allies</b> sometimes ask for rounds, and when you are short they may sell you some at a premium. Helping them raises relations.</Li>
        <Li><b>Export orders</b> bring money and please industry, but are delivered from the central depot and never below half of target. Falling short costs a penalty.</Li>
        <Li><b>Developing situations:</b> pay disputes, suspect parts and mine accidents unfold in stages. What you decide at the first stage shapes the next.</Li>
        <Li><b>In a crisis</b> you get one chance to ask for a supplementary budget.</Li>
      </ul>
    ),
  },
  {
    id: 'board',
    title: 'The Board and the Committee',
    body: (
      <ul className="list-disc pl-5">
        <Li><b>Research:</b> new lines (APKWS, Coyote, Javelin), designs that need less of the scarce parts, process gains, a germanium recovery circuit, contained demilitarization and a microwave drone shield.</Li>
        <Li><b>Key staff:</b> five posts whose skill cuts prices, scrap, freight, research time and training time.</Li>
        <Li><b>The Committee:</b> four factions judge readiness, spending, jobs and domestic investment. Confidence at zero means dismissal. Each year brings a budget review and a request.</Li>
      </ul>
    ),
  },
  {
    id: 'data',
    title: 'About the data',
    body: (
      <>
        <P>Designations and makers of the finished rounds are real. Weights and rates follow public reference figures where they exist, and are best guesses elsewhere.</P>
        <P>Every site, company, nation, person and event is fictional. Nothing uses classified or leaked information.</P>
      </>
    ),
  },
];

export function GuidePanel() {
  const [open, setOpen] = useState('start');
  const sec = SECTIONS.find((x) => x.id === open)!;
  return (
    <div className="p-3 text-[11px]">
      <div className="mb-2 flex flex-wrap gap-1">
        {SECTIONS.map((x) => (
          <button key={x.id} type="button" className={`rounded px-2 py-0.5 ${x.id === open ? 'bg-ops-cyan/15 text-ops-cyan' : 'text-ops-dim hover:text-ops-text'}`} onClick={() => setOpen(x.id)}>
            {x.title}
          </button>
        ))}
      </div>
      <h2 className="mb-2 font-sans text-[16px] font-semibold text-white">{sec.title}</h2>
      {sec.body}
    </div>
  );
}

export const _site = SITE_BY_ID;
