import { useState, type ReactNode } from 'react';
import {
  CAMPUSES,
  CAMPUS_IDS,
  COMPONENTS,
  COMPONENT_IDS,
  DIFFICULTY,
  LINES,
  LINE_IDS,
  NATIONS,
  SCENARIOS,
  SUPPLIERS,
  THREATS,
  THREAT_IDS,
  suppliersOf,
} from '../../engine';
import { money } from '../format';

const P = ({ children }: { children: ReactNode }) => <p className="mb-2 text-[12px] leading-relaxed text-ops-text">{children}</p>;
const H = ({ children }: { children: ReactNode }) => <h3 className="mb-1 mt-4 font-sans text-[15px] font-semibold text-white first:mt-0">{children}</h3>;
const Li = ({ children }: { children: ReactNode }) => <li className="mb-1 text-[12px] leading-relaxed text-ops-text">{children}</li>;

const SECTIONS: { id: string; title: string; body: () => ReactNode }[] = [
  {
    id: 'start',
    title: 'Getting started',
    body: () => (
      <>
        <P>
          You run the Munitions Production Board of the Commonwealth of Aldmere, a fictional nation. Each turn is one month. Your job: keep the national reserve of
          interceptors and artillery stocked, the books balanced, and the Defence Committee confident.
        </P>
        <H>Your first few months</H>
        <ol className="list-decimal pl-5">
          <Li>Open <b>Supply chain</b>. Your starting contracts run out in 9 months and only cover 85% of what the lines need. Sign longer contracts.</Li>
          <Li>Qualify at least one second source for the components that come from abroad: gallium and germanium, IR seekers, microelectronics.</Li>
          <Li>Check <b>Intel</b>. If a crisis is brewing, surge the lines it will hit and think about expanding.</Li>
          <Li>Watch <b>Workforce</b>. Every expansion needs more crew, and new hires train for months before they count.</Li>
          <Li>Press <b>End month</b>, read the report, adjust. Repeat for four years.</Li>
        </ol>
      </>
    ),
  },
  {
    id: 'month',
    title: 'How a month resolves',
    body: () => (
      <ol className="list-decimal pl-5">
        <Li>Unanswered decision cards take their default.</Li>
        <Li>Crises advance, the opponent adapts (hard), and random events roll.</Li>
        <Li>Projects finish: buildings, retooled bays, upgrades, trainees, supplier qualifications.</Li>
        <Li>Suppliers deliver: contracts first, then spot buys, limited by what each can ship.</Li>
        <Li>Lines build in priority order, limited by capacity, crew and components. Output goes to testing, then partners, then the reserve.</Li>
        <Li>Threats arrive. Interceptors are drawn by doctrine, and land fires by fire missions.</Li>
        <Li>Wages, overhead, components and storage are paid. The appropriation comes in. Confidence moves.</Li>
        <Li>Every 12 months the Committee reviews you and resets the appropriation.</Li>
      </ol>
    ),
  },
  {
    id: 'plants',
    title: 'Plants, bays and lines',
    body: () => (
      <>
        <P>Each campus has a fixed number of bays. A line's original floor uses 4 bays. Each expansion adds +25% capacity in one more bay.</P>
        <ul className="list-disc pl-5">
          <Li><b>Ramp-up:</b> new capacity starts at about 30% and climbs each month. Faster on easy, slower on hard.</Li>
          <Li><b>New buildings</b> add 4 bays but take 6 to 12 months. <b>Retooling</b> moves an expansion bay to another line on the same campus in 2 months.</Li>
          <Li><b>Shifts:</b> surge builds 30% more but wears the line and morale. Worn lines throw quality faults, and faulty batches go to quarantine.</Li>
          <Li><b>Quarantine:</b> pay to rework (80% recovered) or the batch is scrapped after 3 months.</Li>
          <Li><b>Upgrades:</b> automation cuts crew needs; quality systems cut faults and wear. Each installs over a few months at 85% capacity.</Li>
          <Li><b>Learning curve:</b> every round built makes the next a little cheaper in crew and overhead, up to +30% productivity.</Li>
          <Li><b>Test share:</b> rounds fired in lot-acceptance tests. Below 3%, latent defects can force a recall from the reserve.</Li>
        </ul>
      </>
    ),
  },
  {
    id: 'floor',
    title: 'The factory floor',
    body: () => (
      <>
        <P>
          Every line is a chain of stages. Missiles go through motor & airframe, then guidance integration, then final assembly, then acceptance test. Shells go
          through body machining, then fill & pack, then lot acceptance. Units wait in buffers between stages.
        </P>
        <ul className="list-disc pl-5">
          <Li><b>Bottlenecks:</b> the slowest stage sets the pace. The stage after it sits <i>waiting for work</i>. Widen a single stage by 20% (twice at most) without buying a whole bay.</Li>
          <Li><b>Buffers</b> soak up hiccups: when a part runs short, units already in the buffers keep moving for a while. When a buffer fills, the stage before it stops.</Li>
          <Li><b>Parts are used where they are needed:</b> motors and energetics at the first stage, seekers and electronics at guidance.</Li>
          <Li><b>Yields:</b> every stage scraps a little. Experience on the line removes up to 40% of that scrap.</Li>
          <Li><b>Test cells:</b> acceptance testing on each campus shares a pool of test cells, 200 hours each a month. A PAC-3 needs 30 hours, a Tamir 1.5. Surge every line and testing becomes the bottleneck. Build more cells.</Li>
          <Li><b>First-article inspection:</b> new bays (and new plants) sit idle for {`0 to 2`} months while the first units are inspected, then ramp up from about 30%.</Li>
          <Li><b>In-house plants</b> (in Supply chain): build your own motor works, shell forge or optics lab. They are slow and costly to build, need crew from their campus, and make parts far cheaper than the market. No one can embargo them.</Li>
        </ul>
      </>
    ),
  },
  {
    id: 'research',
    title: 'Research and new lines',
    body: () => (
      <>
        <P>
          Your engineers run one project at a time, paid up front. Projects license new products, redesign rounds to need fewer scarce parts, speed up the
          factory, or change the fight itself.
        </P>
        <ul className="list-disc pl-5">
          <Li><b>New lines:</b> APKWS (laser-guided rockets, about $30K a round), Coyote Block 2 interceptor drones and Javelin. Research licenses the design. Then you set up the line in 4 free bays, inspect the first units, ramp up, and hire crew for it.</Li>
          <Li><b>The cost exchange:</b> once APKWS and Coyote are running, doctrine sends them at drones first. Shooting a $35K drone with a $30K rocket instead of a $480K Stinger is how you win the cost exchange.</Li>
          <Li><b>Design changes</b> cut gallium, motor, energetics and seeker use on every line, and stretch whatever supply you have.</Li>
          <Li><b>Process projects</b> cut test-cell hours, speed up final assembly, cut scrap, unlock a third automation level, and halve supplier qualification time.</Li>
          <Li><b>High-power microwave</b> stops one drone in five before any interceptor fires.</Li>
        </ul>
      </>
    ),
  },
  {
    id: 'map',
    title: 'Regions, depots and convoys',
    body: () => (
      <>
        <P>
          Aldmere has four regions: the Northern Ports, the Halvard Coast, the Eastern Marches and the Skerry Isles. Each has a depot. Threats and fire missions
          arrive by region, and a crisis hits its own region hardest. Intel tells you which one, two months ahead.
        </P>
        <ul className="list-disc pl-5">
          <Li><b>Depots first:</b> rounds are fired from the regional depot. If it runs dry, only part of the gap (60% for interceptors, 35% for land rounds) can be airlifted from the central reserve in time, at a price.</Li>
          <Li><b>Convoys</b> leave every month and arrive the next, topping each depot up toward its stock target. Raise the target where a crisis is coming, and lower it where things are quiet.</Li>
          <Li><b>Transport</b> is limited by tonnage. Shells are heavy and take most of it. Buy more wagons and trucks if convoys run full.</Li>
          <Li><b>Allies</b> with goodwill of 55 or more will lend you rounds in an emergency, repaid from your production over 8 months.</Li>
          <Li><b>The {`Vardan Directorate`}</b>, a rival power, keeps building its arms industry, so every new crisis gets a little fiercer. Keep readiness above 85% and its growth slows.</Li>
        </ul>
      </>
    ),
  },
  {
    id: 'politics',
    title: 'People and politics',
    body: () => (
      <>
        <ul className="list-disc pl-5">
          <Li><b>Key staff:</b> five posts (procurement, quality, logistics, research, labour relations). Each hire brings a skill from 1 to 3 that improves their area, and often a quirk, good or bad. Hiring costs three months' salary, and letting someone go costs the same in severance. Good people get poached: match the offer or lose them. New candidates appear every six months.</Li>
          <Li><b>The Committee</b> is five factions. The hawks want full racks, the treasury bench wants you within budget, the regional members want jobs at the campuses, the industry caucus wants you to buy at home, and the alliance group wants good partner relations. Their average pulls your confidence up or down every month.</Li>
          <Li><b>Public support</b> rises in a crisis and falls when threats get through. It moves the hawks.</Li>
          <Li><b>Budget requests:</b> at the end of each fiscal year, accept the Committee's figure, ask for less to please the treasury bench, or push for 12% more and risk a cut.</Li>
          <Li><b>Export policy:</b> open brings more and better-paid tenders but worries the hawks. Restrictive does the opposite.</Li>
        </ul>
      </>
    ),
  },
  {
    id: 'workforce',
    title: 'Workforce',
    body: () => (
      <ul className="list-disc pl-5">
        <Li>Lines need crew in proportion to installed capacity and shift. Understaffed campuses build less, across every line.</Li>
        <Li>Hires come from a local pool and train for {DIFFICULTY.easy.trainingMonths} to {DIFFICULTY.hard.trainingMonths} months (by difficulty). They cost wages before they count.</Li>
        <Li>Morale drifts toward a target. Surge shifts and understaffing pull it down; premium wages push it up. Low morale means people quit, and below about 30, strike votes.</Li>
      </ul>
    ),
  },
  {
    id: 'supply',
    title: 'Supply chain',
    body: () => (
      <ul className="list-disc pl-5">
        <Li>Seven shared components. When one runs short, every line that uses it slows. Line priority decides who gets scarce parts first.</Li>
        <Li>Each component has one qualified supplier at the start and one or two candidates. Qualifying a second source takes months and money, so do it before you need it.</Li>
        <Li>Contracts are signed with one supplier for 12, 24 or 36 months: 10%, 15% or 20% off list. They are take-or-pay, so you pay every month whether or not you need the parts, and undelivered units are owed to you. Cancelling costs 30% of what is left.</Li>
        <Li>Spot buys fill after contracts at a 30% premium, from the cheapest supplier with room.</Li>
        <Li>Suppliers have financial health. Distressed ones ask for bailouts, and bankrupt ones take their contracts with them. Foreign suppliers can be hit by export bans and port congestion.</Li>
        <Li>Substitutes keep starved lines running with lower-grade parts. Degraded interceptors are about 15% less likely to stop their target.</Li>
        <Li>Stock costs 0.5% of its value a month to store. Rocket motors and energetics beyond six months of need slowly age out.</Li>
        <Li><b>Feedstock markets:</b> your suppliers depend on ammonium perchlorate, nitrocellulose, billet steel, wafers, gallium concentrates and optical crystals. A disruption there cuts what every supplier of the affected parts can ship, and drives prices up.</Li>
        <Li><b>Prices:</b> spot buys pay today's market price. Contracts lock the price on the day you sign, so long contracts are also a hedge.</Li>
        <Li><b>Shipping:</b> parts from the Corvane Union take a month to arrive, from Ostrel and Karsk two. Port congestion adds a month, and now and then a shipment is lost at sea, more often during air campaigns over the strait.</Li>
        <Li><b>Supplier investment:</b> pay for a qualified supplier to expand by 30% (twice at most). It takes eight months and steadies the supplier's finances.</Li>
      </ul>
    ),
  },
  {
    id: 'demand',
    title: 'Threats, doctrine and the cost exchange',
    body: () => (
      <>
        <P>
          There is no battle map. Each month, fictional threats arrive. Each class is assigned to interceptor types by doctrine weights, and falls back down a list
          when a type runs dry. Threats not engaged, or engaged but missed, get through: they cost confidence, the dangerous ones most of all.
        </P>
        <P>
          <b>Conserve doctrine</b> keeps PAC-3 and SM-6 off drones and rockets. More cheap threats get through, but you stop firing $4M missiles at $35K drones.
        </P>
        <P>
          The <b>cost exchange</b> in the Ledger compares interceptor dollars fired with the estimated value of the threats stopped. Defending against cheap drones
          is a losing trade on paper. Winning it means building enough cheap interceptors.
        </P>
        <P>Land fires (GMLRS, 155mm) are drawn by fire-mission demand, which jumps during land crises.</P>
      </>
    ),
  },
  {
    id: 'money',
    title: 'Money, confidence and partners',
    body: () => (
      <ul className="list-disc pl-5">
        <Li>The appropriation arrives monthly. Costs: wages, plant overhead, components, storage, and the projects and hires you order.</Li>
        <Li>The Committee's confidence rises with a stocked reserve and falls with leakers beyond the usual, unmet fire missions, recalls and overspending. At zero, you are dismissed.</Li>
        <Li>Fiscal-year reviews reset the appropriation from confidence. During crises, a supplemental request has better odds.</Li>
        <Li>Partner nations post tenders. Accepted contracts take fresh output before the reserve does, pay above cost, and build goodwill if delivered on time. Friendly partners share critical materials and co-fund bays.</Li>
        <Li>Emergency airlift requests during crises trade reserve rounds for money and goodwill.</Li>
      </ul>
    ),
  },
  {
    id: 'difficulty',
    title: 'Difficulty and scenarios',
    body: () => (
      <>
        <ul className="list-disc pl-5">
          {(Object.keys(DIFFICULTY) as (keyof typeof DIFFICULTY)[]).map((d) => (
            <Li key={d}>
              <b>{DIFFICULTY[d].label}:</b> {DIFFICULTY[d].blurb}
            </Li>
          ))}
        </ul>
        <H>Scenarios</H>
        <ul className="list-disc pl-5">
          {Object.values(SCENARIOS).map((s) => (
            <Li key={s.id}>
              <b>{s.name}:</b> {s.blurb}
            </Li>
          ))}
        </ul>
      </>
    ),
  },
  {
    id: 'lines',
    title: 'Encyclopedia: lines',
    body: () => (
      <div className="space-y-3">
        {LINE_IDS.map((id) => {
          const d = LINES[id];
          return (
            <div key={id}>
              <H>{d.name}</H>
              <P>
                {d.maker} · {CAMPUSES[d.campus].name} · {d.role}. {d.blurb}
              </P>
              <p className="text-[11px] text-ops-dim">
                Public reference rate: {d.publicRate}. Game rate: {d.baseCapacity.toLocaleString('en-US')} a month. Unit cost about {money(d.unitCost)}. Crew {d.baseCrew}. Parts per round:{' '}
                {Object.entries(d.bom)
                  .map(([c, q]) => `${q} ${COMPONENTS[c as keyof typeof COMPONENTS].unit} ${COMPONENTS[c as keyof typeof COMPONENTS].name.toLowerCase()}`)
                  .join(', ')}
                .
              </p>
            </div>
          );
        })}
      </div>
    ),
  },
  {
    id: 'components',
    title: 'Encyclopedia: components and suppliers',
    body: () => (
      <div className="space-y-3">
        {COMPONENT_IDS.map((c) => (
          <div key={c}>
            <H>{COMPONENTS[c].name}</H>
            <P>{COMPONENTS[c].blurb}</P>
            <ul className="list-disc pl-5">
              {suppliersOf(c).map((sid) => (
                <Li key={sid}>
                  <b>{SUPPLIERS[sid].name}</b> ({NATIONS[SUPPLIERS[sid].nation].name}): {SUPPLIERS[sid].blurb}
                </Li>
              ))}
              <Li>
                Substitute: <b>{COMPONENTS[c].substitute.name}</b>. {COMPONENTS[c].substitute.blurb}
              </Li>
            </ul>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'world',
    title: 'Encyclopedia: the world',
    body: () => (
      <>
        <H>Campuses</H>
        <ul className="list-disc pl-5">
          {CAMPUS_IDS.map((c) => (
            <Li key={c}>
              <b>{CAMPUSES[c].name}:</b> {CAMPUSES[c].blurb}
            </Li>
          ))}
        </ul>
        <H>Nations</H>
        <ul className="list-disc pl-5">
          {Object.values(NATIONS).map((n) => (
            <Li key={n.id}>
              <b>{n.name}:</b> {n.blurb}
            </Li>
          ))}
        </ul>
        <H>Threat classes</H>
        <ul className="list-disc pl-5">
          {THREAT_IDS.map((t) => (
            <Li key={t}>
              <b>{THREATS[t].name}</b> (≈ {money(THREATS[t].estCost)}): {THREATS[t].blurb}
            </Li>
          ))}
        </ul>
      </>
    ),
  },
  {
    id: 'about',
    title: 'About the data',
    body: () => (
      <>
        <P>
          Forge Command is a game. Weapon designations and manufacturers are real. Production rates are scaled from public statements by companies and governments
          where they exist, and are best guesses where they don't. Threat costs are rough estimates from public reporting.
        </P>
        <P>Campuses, suppliers, nations, partners, crises and events are fictional. Nothing in the game uses classified or leaked information.</P>
      </>
    ),
  },
];

export default function Guide() {
  const [open, setOpen] = useState('start');
  const section = SECTIONS.find((s) => s.id === open) ?? SECTIONS[0];
  return (
    <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
      <nav className="panel h-max p-2" aria-label="Guide sections">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`block w-full rounded px-2 py-1.5 text-left text-[12px] ${s.id === open ? 'bg-ops-cyan/15 text-white' : 'text-ops-dim hover:text-ops-text'}`}
            aria-current={s.id === open}
            onClick={() => setOpen(s.id)}
          >
            {s.title}
          </button>
        ))}
      </nav>
      <article className="panel p-4">
        <h2 className="mb-3 font-sans text-[20px] font-semibold text-ops-cyan">{section.title}</h2>
        {section.body()}
      </article>
    </div>
  );
}
