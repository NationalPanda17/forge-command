# Forge Command

A real-time management game about a nation's munitions industry, from the mine to the launcher to the
demilitarization pit. You are Director of the Munitions Production Board of the Commonwealth of Aldmere, a fictional
country.

**Play:** https://nationalpanda17.github.io/forge-command/ It works offline once loaded, and can be installed as an app.

## Cradle to grave

Every round you build is the end of a long chain, and the game simulates all of it, day by day, across 65 fictional
sites on a detailed map:

1. **Extraction:** iron pits, collieries, bauxite and zinc mines, copper, rare-earth sands, quartz, brine wells,
   offshore gas and pulp.
2. **Processing:** steelworks and smelters (with gallium and germanium as by-products), refineries, and chemical plants
   making ammonia, nitric acid, perchlorate, binder, nitrocellulose and high explosive.
3. **Intermediates:** propellant, wafers, silicon and GaN chips, magnets and infrared optics.
4. **Components:** rocket motors, warheads, radar and IR seekers, guidance, actuators, airframes, fuzes, shell bodies
   and charges.
5. **Your arsenals:** integration and acceptance of PAC-3 MSE, SM-6, Tamir, IRIS-T, Stinger, GMLRS and 155mm shells.
   Research adds APKWS, Coyote and Javelin.
6. **Storage and issue:** central and regional depots, then air-defense sectors, air bases and artillery formations.
7. **Service life:** rounds age. Surveillance firings recertify old lots. Retired rounds are refurbished, or shipped to
   Karrow and burned or recycled.

Everything moves on a rail, road, sea and air network where each route carries only so many tonnes a day.
- Private suppliers sell to whoever pays. Contract with them, qualify new ones, fund their growth, or bail them out.
- Foreign suppliers are a sea voyage and an export ban away.
- Fires, failures, floods and strikes ripple down the chain.
- Fictional crises hit one region at a time, with two months' warning.

## Plan, buy and adapt

- **Plan:** each round's stock a year ahead, and the weakest link under it, traced down to the mine.
- **Markets:** prices rise, contracts lock them, and tenders make suppliers bid against each other.
- **The world:** seasons close sea lanes and slow roads. Allies ask for help or sell you rounds, foreign customers
  place export orders, and disputes, recalls and accidents unfold in stages.
- **Scenarios:** Peacetime, War footing, Sanctions and Rebuild, plus a guided tutorial. Achievements and an
  end-of-term report.

## Build and staff it

- **Build:** new rail and road links, route upgrades, an icebreaker for the northern winter, and resilience grants
  for key suppliers.
- **Your plants:** a live floor plan. Choose shifts, watch skill, morale and fatigue, and invest in safety,
  apprentices and automation.
- **Modes:** a scored campaign, a free-play sandbox whose rules you can change as you go, and a guided tutorial.
- **Replay:** a monthly newspaper, generated music, achievements and your best campaigns.

## A rival that keeps moving

The Vardan Directorate fields new weapons through your term: drone swarms, supersonic cruise missiles,
manoeuvring warheads, decoys, heavier barrages and armour. Intel warns you, and every one has a counter to
research. Multi-year programmes, standing policies and a second term make choices last. An advisor suggests the next
best move, and most numbers explain themselves.

## Spies, towns and test ranges

The rival's agents sabotage, steal and leak; vet your staff. Plants draw their people from nearby towns, and housing
limits how fast you can hire. New rounds and designs are fired at the test ranges before they are accepted. Two
players can share one device, each running half the country.

## Allies, hearings, hackers and unions

Keep the nations you buy from friendly, co-produce rounds with allies and sell abroad. Face the Defence Committee at a
budget hearing every year, and keep your promises. Defend your plants, railways and suppliers against hackers, and keep
the unions on side. Serve term after term, keep a record book, and build your own scenarios to share as codes.

## Power, audits and statistics

Every region runs on its own grid: power prices swing, fuel shocks bite, and blackouts stop lines unless your plants
have generators. The Auditor-General reviews your spending twice a year, and suppliers sometimes overbill. A
statistics room charts where the money went, what every plant made, and where your confidence came from.

## Towns that answer back

Every town has a mood toward you. New plants and rail lines need permits, angry towns protest at your gates, and the
town beside the burning pit can take you to court. The advisor shows what each suggestion costs, and plans three months
ahead.

## Play it your way

Hand any part of the job to a chief of staff, from decision cards to production, and set a reserve and a stance. Or
take the advisor's advice: every decision card shows the advised option, one click takes all the safe suggestions, and
it can trace any shortage to its root cause.

## A new country every game

Campaigns and sandboxes are played in a country generated from the seed: its own coastline, mountains, rivers,
cities and names, with the same supply chain underneath. The hand-made Commonwealth of Aldmere is still there for
anyone who wants it, and the story is set there.

## Your own industry, and a story

Found plants on open plots, bring parts in-house at your arsenals, and choose each round's design. Play the
four-chapter story with the people around you, or a scored campaign, a sandbox or the tutorial. A colour-blind-safe
palette, larger text, keyboard shortcuts and named saves come as standard.

## Real time

The clock runs at 1 to 8 days a second, or you can step a day or a week. It pauses itself when something important
happens. Use **Space** to pause and **1** to **4** to set the speed.

## Panels
- **Watch:** what needs you, most urgent first.
- **Site:** the inspector for any site, with your controls on your own plants.
- **Plan:** forecasts and the weakest links in the chain.
- **Materials:** any material traced from finished round down to the mine.
- **Markets:** prices, tenders and bids, contracts, exports, allies and developing situations.
- **Build:** links, upgrades, the icebreaker and resilience grants.
- **Intel:** the rival's weapons, warnings and counters, spies and cyber defence.
- **Policy:** multi-year programmes and standing policies.
- **Industry:** open plots, in-house lines and round designs.
- **Story:** the chapter's goals and how earlier chapters went (story games only).
- **Testing:** the test ranges, the queue and what awaits acceptance.
- **Towns:** moods, open days and community funds, housing, jobs, mothballing and the unions.
- **Allies:** allies and co-production, supplier nations, guarantees and the export desk.
- **Power:** grids, prices, blackouts, power contracts, grid upgrades and generators.
- **Courier:** the monthly newspaper.
- **Stockpile:** age profiles, surveillance and demilitarization.
- **Logistics:** depot targets, traffic and busy routes.
- **Fight:** threats, leakers, doctrine.
- **Board:** research, staff, the Committee, your promises, decisions and objectives.
- **Money:** income and spending, and oversight: waste, audits and the internal audit team.
- **Stats:** spending, output by round and plant, losses by threat, confidence and decisions over time.
- **Staff:** the areas handed to your chief of staff, the reserve, the stance and what they did.
- **Feed** and **Guide.**

## Develop

```bash
npm install
npm run dev       # http://localhost:5174
npm test          # engine tests (vitest)
npm run build     # typecheck + production build
npm run balance   # play hands-off campaigns on every difficulty
```

- `src/sim`: the engine. It is pure TypeScript and deterministic for a seed. See [docs/DESIGN.md](docs/DESIGN.md).
- `src/ui/map`: the map and icons.
- `src/game`: the game screens.

## About the data

Designations and makers of the finished rounds are real. Weights and production rates follow public reference figures
where they exist, and are best guesses elsewhere. Every site, company, nation, person and event is fictional. Nothing
uses classified or leaked information.

No accounts, no tracking, no analytics.
