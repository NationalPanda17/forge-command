# Forge Command 5.0: design

A real-time management game about a nation's munitions industry, from the mine to the launcher to the demilitarization
pit. You are Director of the Munitions Production Board of the Commonwealth of Aldmere, a fictional country.

Designations and makers of the finished rounds are real. Every site, company, nation, person and event is fictional.
Physical figures follow public reference data where it exists, and are best guesses elsewhere.

## Time
- Pausable real time: 1, 2, 4 or 8 days a second, or step a day or a week.
- The engine (`src/sim/tick.ts`) simulates one day at a time and is pure and deterministic for a seed.
- Months are 30 days, years 360.
- The clock pauses itself on important events (crises, disruptions, export bans, decisions, failed surveillance).

## The world (`src/sim/world.ts`)
- **Materials (49):**
  - raw: ore, coal, bauxite, zinc, copper, rare earths, quartz, brine, gas, pulp;
  - processed: steel, aluminium, gallium, germanium, copper, rare-earth oxide, polysilicon, ammonia, nitric acid,
    perchlorate, binder, nitrocellulose, high explosive;
  - intermediates: propellant, wafers, silicon and GaN chips, magnets, germanium optics;
  - components: motors, warheads, radar and IR seekers, guidance, actuators, airframes, fuzes, shell bodies, charges;
  - ten finished rounds.
- **Recipes** give every material's inputs and scrap rate. Finished rounds have bills of materials scaled from public
  launch and warhead weights.
- **Sites (65):**
  - mines, quarries and wells;
  - steelworks, smelters, refineries and chemical plants;
  - a fab;
  - component makers;
  - three state arsenals;
  - test ranges, depots, air-defense sectors, air bases and artillery formations;
  - ports, an air hub and a demilitarization facility;
  - four foreign suppliers reached by sea.

  Each site is owned by the state (yours), a private company, or a foreign one.
- **Capacities** are derived from the starting lines' daily need (`baselineDemand`), times each site's share. That keeps
  the chain consistent: a few links are deliberately thin, such as perchlorate, germanium and rare earths.
- **Routes** are rail, road, sea and air, each with a daily tonnage limit. Paths are the fastest surface route; air is
  used only for places nothing else reaches.

## A day (`tick.ts`)
1. **World:**
   - crises brew and break, each focused on one region;
   - disruptions and export bans hit sites;
   - qualifications complete;
   - new capacity ramps up;
   - trainees qualify.
2. **Strategy:** research progresses.
3. **Production:** each process makes what capacity, crew, condition and disruption allow, limited by the input stock
   on site. Private producers stop when 20 days of output sit unsold.
4. **Logistics:**
   - Shipments arrive.
   - Sites request what they need:
     - plants keep 8 (private) or 12 (yours) days of inputs;
     - bases keep ready rounds;
     - regional depots keep days of their region's draw;
     - the centre takes everything the arsenals finish.
   - Requests are filled from the nearest source with stock: contracted suppliers first, and only qualified ones for
     your sites. Each fill is limited by the route's tonnage left that day.
   - You pay for deliveries to your sites (contract price, or spot plus 30%) and their freight.
5. **The fight:**
   - Five threat classes arrive in each region, more where a crisis is active.
   - The region's bases fire from their own racks, oldest lots first, by doctrine weights with fallbacks.
   - Leakers are counted.
   - Artillery fires land rounds.
6. **Lifecycle:**
   - The war reserve starts old.
   - Lots past their certified life retire and move to Karrow.
   - Surveillance firings can extend a lot, a year at a time and twice at most, with falling pass rates.
   - Karrow processes 40 tonnes a day, by open burning or recycling.
7. **Money:** wages and plant running costs are paid daily. At month end the appropriation arrives and confidence
   moves.

## Economy (`economy.ts`)
- **Price index:** starts at 1.0 and rises about 0.25% a month, more in an active crisis. It scales spot prices, new
  contracts, wages, running costs, freight, expansion, hiring and repairs. The fiscal review passes on 70% of it.
- **Tenders:**
  - Each qualified supplier offers up to 90% of its spare capacity.
  - Price is list × length discount × a competition factor (−4.5% per extra bidder, down to −14%). Weak and foreign
    firms bid lower.
  - Reliability comes from health, condition, nationality and any export ban.
- **Supplier finances:** each live contract adds to a private firm's health every month. A weak firm whose
  contract price is under 90% of today's list may ask to reprice.
- **Supplementary budget:** offered once per active crisis. The odds follow the hawks.

## Living world (`living.ts`)
- **Seasons** scale a route's daily tonnage:
  - winter: northern sea 60%, roads 80 to 90%, northern rail 92%;
  - March and April: roads 90%, central rail 95%.

  In July and August, heat trims energetics recipes to 95%.
- **Allies** have relations from 0 to 100.
  - Requests take rounds from the central depot for payment and goodwill.
  - Offers (only when you are short or in a crisis, and relations are 40 or more) land rounds at Lowmouth in five
    weeks.
- **Export orders** deliver daily on schedule from the central depot, never taking national stock below half of
  target. Missing more than 10% costs a 15% penalty and some confidence.
- **Chains:** multi-stage events.
  - **Labour:** pay, or offer half (even odds), or refuse; a strike follows in a month.
  - **Quality:** recall (lose half the parts on hand), or accept the risk; later, 60% odds that 12% of a central
    depot line is condemned.
  - **Safety:** an accident, then an inspection decision: co-fund the upgrade, or two months at 25%.

## Building (`build.ts`)
- **Links:** six candidate links in `world.ts`.
  - Rail costs 0.3 $M a km and takes 270 days; road costs 0.1 $M a km and takes 150 days, both scaled by prices.
  - When a link finishes, `graph.setNetwork` rebuilds the routing graph and clears the path cache.
- **Upgrades:** each level adds 50% to a route's daily tonnage, two levels at most.
  - Rail costs 0.12 $M a km per level and road 0.05; port works cost 30 a level.
  - Air routes cannot be upgraded.
- **Icebreaker:** in winter the northern sea factor goes from 0.6 to 0.9.
- **Resilience grant:** at that site, disruptions are 0.4× as likely, last 0.6× as long, and keep 50–80% of output.
- **Automation:** a line needs 0.7× the crew and has 0.8× the scrap. It takes 180 days.

## People (`people.ts`)
- **Skill** (0–100):
  - output × (0.9 + 0.2 × skill), and scrap × (1.15 − 0.3 × skill);
  - grows towards 88 (95 with apprentices) while lines run;
  - new hires join at 40 and apprentices at 55.
- **Morale** drifts to 62 + 6 × safety − 0.35 × fatigue − 60 × (price index − 1), plus 3 with apprentices.
  - Below 50 it costs up to 15% of output.
  - Pay deals add 7 to 15; refusals take away 10.
- **Fatigue:** +0.35 a day on round-the-clock shifts, −0.25 on two shifts, and −0.4 on one shift or idle.
- **Accidents:** daily odds of 0.00025 × events × (1 + fatigue/35) × (1.6 − condition) × (1 − 0.25 × safety).

## The rival (`rival.ts`)
- **Order:** six developments are drawn into a seed-dependent order at the start. Intel reports one every 180–270
  days, from day 120–180 (sooner on Hard, later on Easy). Each is fielded 90 days after it is announced.
- **Effects:** each development multiplies some of:
  - threat arrivals;
  - interceptors per threat;
  - kill odds for named lines;
  - land fires.
- **Counters:** a research counter applies its own multipliers on top.
- **Strength:** multipliers are scaled by difficulty: 0.5× on Easy, 1× on Normal and Hard.
- **Draw:** `regionDailyDraw` includes the rival, so forecasts, depot targets and reserve targets all move with it.

## Commitments (`commitments.ts`)
- **Programmes:**
  - Rounds promised a month: 70% (3 years) or 80% (5 years) of arsenal capacity.
  - Funding a month: that many rounds × price × 0.6 (3 years) or 0.75 (5 years).
  - Paid each month at least 90% is made. Three misses cancel it (−6 confidence); completing it earns +3 and
    industry +4.
- **Policies:** at most 3; revoking costs 4 confidence.
  - Buy Aldmeran: no foreign sources for your sites.
  - Stockpile law: 450-day target, +10% budget.
  - Open books: treasury +1 a month, hawks −0.4.
  - Warm base: ramp ×1.5, running costs +6%.
  - Clean disposal pledge: recycling only, regions +0.8.
  - Export drive: export offers ×2 at +10%, hawks −0.5.
- **Second term:** a completed campaign can continue for another 48 months, with confidence reset to
  45 + 0.4 × (score − 50), between 30 and 75.

## The advisor (`advisor.ts`)
- **Candidates:** decisions, counters to known weapons, rounds heading below half of target, overstock, lapsing
  contracts, waiting bids, crew shortfalls, fatigue, morale, crisis depot targets, idle research, and congested
  routes when money allows.
- **The fix for a round heading below half of target:**
  - fund the private supplier behind the tightest link;
  - or put the line back on two shifts;
  - or expand it.
- **Ranking:** suggestions are ranked by priority. Every suggested action passes `validate`.

## Map performance
- **Flow view:** shipments draw as per-route flow lines when the map is under 640 px wide and zoomed out, or when
  the zoom is under 0.9.
- **Labels while zooming:** label layout uses a settled zoom, updated 140 ms after zooming stops. While zooming,
  labels and grid numbers rest.
- **Dragging:** the shipment animation pauses while you drag.

## Modes
- **Campaign:** scored, with achievements; the Committee can dismiss you.
- **Sandbox** (`mode: 'sandbox'`):
  - Starts with no end date and no dismissal, and is never scored.
  - **Settings:** inflation, seasons and crises on or off; an events multiplier (0, 0.5, 1 or 2) that scales
    disruptions, bans, chains and accidents; endless; dismissal.
  - The `sandbox` action changes them in play, and also adds money, starts or ends a crisis, disrupts a site, lifts
    every disruption and ban, and finishes research.
- **Tutorial:** a scenario on Easy with a coach card.

## Smooth time
- The UI clock (`useSim`) advances continuous time with `requestAnimationFrame` at the chosen speed. Whenever it
  passes a whole day, it asks the engine for that day.
- Drawing uses `min(time, last drawn day + 0.999)`, so motion never runs backwards while the engine catches up.
- Shipments are placed from their depart and arrive days at that fractional time.

## News (`news.ts`)
- Each month's edition is written from the month report, the previous one and the month's feed:
  - crises;
  - readiness and confidence swings;
  - accidents, strikes, bans and closures;
  - openings and qualifications;
  - prices;
  - exports;
  - the season ahead.

## Analytics (`analytics.ts`)
- **Forecast:** stock + monthly output (planned, capped by last month's actual) − expected draw × crisis factor −
  exports − retirements (half saved by surveillance while lots are still eligible).
- **Balances:** national supply of every material (active, unbanned sites) against the demand of today's plan.
- **Trace:** from a round down its recipe, taking the input with the lowest supply ratio at each level.
- **Term report:** score = average readiness × 50 + confidence × 25 + interception rate × 15 + objectives × 2, less
  30 if dismissed.

## Scenarios (`setup.ts`)
- **Peacetime:** the standard start.
- **War footing:** an active northern crisis, +15% budget, confidence 55, hawks 65.
- **Sanctions:** every foreign site banned for 270 days, prices start at 1.12.
- **Rebuild:** the war reserve is halved, +$500M and +10% budget.
- **Tutorial:** Easy, 24 months, no crisis before day 420, and none of the world events in the first year.
- **Migration:** `migrate()` fills in new fields for 2.0 saves.

## Strategy (`strategy.ts`)
- **Research:** 14 projects:
  - new lines installed at arsenals (they need hiring);
  - recipe changes (gallium-light chips, common motor cases, design-to-cost seekers, insensitive fills);
  - process gains;
  - germanium recovery;
  - contained demilitarization;
  - a microwave drone shield.
- **Key staff:** five posts. Skill cuts prices, scrap, freight and route limits, research time and training time.
- **Committee factions:** four factions:
  - hawks (readiness, leakers);
  - treasury (budget);
  - regions (jobs, burning pits);
  - industry (domestic investment).

  Their weighted average nudges confidence.
- **Decisions:** supplier bailouts, repricing, the yearly budget request, supplementary budgets, allied requests and offers, export orders, pay disputes, recalls and inspections. Unanswered cards take their default at month end.
- **Objectives** with deadlines and cash rewards.

## Map (`src/ui/map`)
A hand-authored vector map of Aldmere:
- coastlines, relief, rivers, forests and cities;
- every route by mode;
- a distinct icon per site kind;
- pan and zoom, layers, shipments in motion and region overlays.
