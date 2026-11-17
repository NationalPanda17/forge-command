# Forge Command 3.0: design

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
