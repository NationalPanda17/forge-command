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
- **Intel:** the rival's weapons, warnings and counters.
- **Policy:** multi-year programmes and standing policies.
- **Industry:** open plots, in-house lines and round designs.
- **Story:** the chapter's goals and how earlier chapters went (story games only).
- **Courier:** the monthly newspaper.
- **Stockpile:** age profiles, surveillance and demilitarization.
- **Logistics:** depot targets, traffic and busy routes.
- **Fight:** threats, leakers, doctrine.
- **Board:** research, staff, the Committee, decisions and objectives.
- **Money**, **Feed** and **Guide.**

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
