# Forge Command

A strategy game about the factories, supply chains and hard choices behind national defense. You run the Munitions
Production Board of the Commonwealth of Aldmere, a fictional nation, one month at a time.

Your job is to keep the regional depots stocked through fictional crises while doing four other things:
- keeping the factories flowing;
- keeping the suppliers alive;
- keeping the books balanced;
- keeping the Defence Committee on side.

**Play:** https://nationalpanda17.github.io/forge-command/ It works offline once loaded, and can be installed as an app.

## What you manage

- **Factory floor:** three campuses and ten production lines:
  - PAC-3 MSE, SM-6, Tamir, IRIS-T, Stinger;
  - GMLRS, 155mm shells;
  - APKWS, Coyote Block 2 and Javelin, which you unlock through research.

  Each line is a chain of stages with partly-finished units waiting between them. Stages have yields, and you can widen
  the bottleneck. Acceptance testing shares each campus's test cells, and new capacity is inspected before it ramps up.
- **Expansion:** add bays, put up new buildings, retool, and install automation and quality upgrades. Lines get better
  with experience.
- **Workforce:** a limited hiring pool, months of training, morale, quits and strikes.
- **Supply chain:** seven shared components from fictional suppliers.
  - Each supplier depends on feedstock markets of its own.
  - Suppliers have financial health, shocks, export bans, shipping lead times, losses at sea and bankruptcy.
  - You can qualify second sources and fund a supplier's expansion.
  - Take-or-pay contracts lock today's price; spot buys pay the market.
  - Substitutes keep starved lines running, and old stock ages out.
  - You can build your own motor works, shell forge and optics lab.
- **Research:** 14 projects, covering new products, designs that need less of the scarce parts, faster processes, and a
  high-power microwave defense.
- **The map:** four regions, each with a depot. Rounds are fired from the local depot first. Convoys are limited by
  tonnage, and emergency airlifts cover only part of a shortfall. Allies lend in a pinch, and a rival power keeps arming.
- **Demand without a battle map:** five fictional threat classes arrive every month and are met by doctrine, with
  fallbacks and leakers. The **cost exchange** shows interceptor dollars fired against threat dollars stopped.
- **People and politics:**
  - five key staff posts with fictional candidates;
  - five Committee factions;
  - public support;
  - a budget request at the end of each year;
  - export policy;
  - partner tenders, airlifts and arms sales;
  - decision cards.
- **Story and replay:**
  - four scenarios, each with a briefing, chapter beats and objectives;
  - challenge modifiers: ironman, austerity, embargo world and endless;
  - a daily challenge;
  - a sandbox with custom rules;
  - 17 achievements;
  - a news ticker.

## Difficulty

| | Easy | Normal | Hard |
|---|---|---|---|
| Component shortages | off | on | tighter |
| Ramp-up, training, construction, inspection | fast | normal | slow |
| Events | rare | normal | frequent, plus sabotage |
| Advisor | one-click suggestions | hints | none |
| Opponent | static | static | adaptive, imperfect intel |

A guided tutorial runs on your first campaign, and the in-game Guide explains every system. Keyboard: **E** ends the
month, **1–0** switch tabs, **?** opens settings.

## Play on your computer

Double-click **Start Forge Command (Mac).command** or **Start Forge Command (Windows).bat**. You need
[Node.js](https://nodejs.org) 20 or newer.

## Develop

```bash
npm install
npm run dev       # http://localhost:5174
npm test          # engine tests (vitest)
npm run build     # typecheck + production build
npm run balance   # play scripted campaigns on every difficulty and scenario, print the grades
```

- `src/engine`: pure TypeScript with a seeded RNG, so the same seed and the same actions always replay the same
  campaign. [docs/DESIGN.md](docs/DESIGN.md) describes the systems, and [CHANGELOG.md](CHANGELOG.md) the releases.
- `src/ui`: the React interface.
- Saves live in the browser (an autosave, three slots, and file export and import). Older saves upgrade automatically.

## About the data

All data comes from public company or government statements, or is made up for the game:
- Weapon designations and manufacturers are real. Production rates are scaled from publicly stated figures where they
  exist; where they don't, they are best guesses.
- Threat costs are rough public estimates.
- Aldmere, its campuses, suppliers, partners, the rival power, crises, people and events are fictional.

No accounts, no tracking, no analytics.
