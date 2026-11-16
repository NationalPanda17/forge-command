# Forge Command

Run the Munitions Production Board of the Commonwealth of Aldmere, a fictional nation, one month at a time. Keep the
national reserve of interceptors and artillery stocked through fictional crises, keep the books balanced, and keep the
Defence Committee's confidence, for two, four or six years.

**Play:** https://nationalpanda17.github.io/forge-command/ (works offline once loaded, and can be installed as an app)

## What you manage

- **Three campuses, seven production lines:** PAC-3 MSE, SM-6, Tamir, IRIS-T, Stinger, GMLRS and 155mm shells.
  - Floor space comes in bays. Expansions ramp up from about 30%.
  - New buildings take most of a year. Retooling moves a bay between lines on the same campus.
  - Lines can be upgraded with automation and quality systems, and get better with experience (learning curve).
- **Shifts and quality:**
  - Surge shifts build 30% more, but wear the line and its people.
  - Worn lines throw quality faults. Faulty batches go to quarantine, where you rework or scrap them.
  - Thin lot testing lets latent defects into the reserve, which brings recalls.
- **Workforce:**
  - Hires come from a limited local pool and train for months before they count.
  - Morale drives quits and strike votes. Wage policy is your lever.
- **Shared supply chain:** solid rocket motors, RF and IR seekers, energetics, microelectronics, gallium and germanium,
  and forged shell bodies.
  - Each comes with fictional suppliers that have financial health, shocks, export bans, port congestion and bankruptcy.
  - Qualify second sources before you need them.
  - Sign take-or-pay contracts of 12 to 36 months (cheaper the longer they run), or pay 30% more for spot buys.
  - Allow lower-grade substitutes to keep starved lines running, at a performance cost.
- **Demand without a battle map:** five fictional threat classes arrive every month.
  - Doctrine assigns interceptors to them, with fallbacks when a type runs dry. Leakers cost confidence.
  - Conserve doctrine keeps $4M interceptors off $35K drones.
  - The **cost exchange** ledger shows interceptor dollars fired against threat dollars stopped.
- **Intel:** a three-month forecast, and crises with two months of warning. On Hard, an adaptive opponent targets your
  thinnest stocks and intel is sometimes wrong.
- **Partners:** fictional nations post tenders, ask for emergency airlifts, buy from your reserve, share critical
  materials and co-fund bays when goodwill is high.
- **Money and politics:**
  - A monthly appropriation, and fiscal-year reviews that set next year's budget from the Committee's confidence.
  - Supplemental requests during crises.
  - Dismissal if confidence hits zero.
- **Events and decision cards:**
  - supplier distress and bailouts;
  - energetics plant fires;
  - export bans;
  - strikes;
  - price hikes;
  - safety inspections;
  - audits;
  - process breakthroughs;
  - espionage and sabotage on Hard.

## Difficulty and scenarios

| | Easy | Normal | Hard |
|---|---|---|---|
| Component shortages | off | on | tighter |
| Ramp-up, training, construction | fast | normal | slow |
| Events | rare | normal | frequent, plus sabotage |
| Advisor | one-click suggestions | hints | none |
| Opponent | static | static | adaptive, imperfect intel |

Four scenarios:
- **Standing Watch:** a calm start.
- **The Long War:** an air campaign is already under way.
- **Broken Chain:** a critical-materials export ban and a microelectronics shock from day one.
- **Empty Racks:** a near-empty reserve and a big budget.

A guided tutorial runs on your first campaign, and the in-game Guide explains every system.

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
  campaign. [docs/DESIGN.md](docs/DESIGN.md) describes every system.
- `src/ui`: the React interface.
- Saves live in the browser: an autosave, three slots, and export and import to a file.

## About the data

All data comes from public company or government statements, or is made up for the game:
- Weapon designations and manufacturers are real. Production rates are scaled from publicly stated figures where they
  exist; where they don't, they are best guesses.
- Threat costs are rough public estimates.
- Campuses, suppliers, nations, partners, crises and events are fictional.
