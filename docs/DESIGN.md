# Forge Command 13.0: design

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

## Espionage (`security.ts`)
- **Rival activity:** 0.012 × (1 + known rival weapons) × the events setting, a month per plant.
- **Security:** 0.15 + 0.6 × clearance/3 + 0.25 × (morale − 0.4), between 0 and 0.95. An incident happens with
  probability activity × (1 − security).
- **Detection:** before damage, with probability 0.15 + 0.25 × clearance. A caught ring becomes a `spyRing`
  decision.
- **Incidents:**
  - **Sabotage:** 20–45 days at 40% output, and −10 condition.
  - **Theft:** the rival's next report 75 days sooner, and −2 confidence.
  - **Leak:** −3 confidence, hawks −3, and a live crisis's intensity +0.15.
- **Turned rings:** they add 60 days before the next fielded weapon.

## Towns (`towns.ts`)
- **Towns:** each site belongs to its nearest city. A town's labour pool starts at max(1.12 × current jobs,
  4 × population + 60), and its housing at 1.05 × the pool.
- **Hiring:** a hire is refused beyond pool − employed.
- **Growth and decline:** with jobs above 95% of the pool, the pool grows 3% a month, capped by housing. Below 85%
  for three months, it shrinks 2% a month and regions −0.4.
- **Housing:** projects add 400 homes after 150 days.
- **Mothballing:** idles the lines and lays off the crew. Regions lose up to 12, confidence up to 6. Upkeep falls to 5% of
  the lines' running cost.
- **Apprentices:** local school leavers, so they join even in a fully employed town, which then grows as housing
  allows. A mothballed plant takes none.

## Testing (`testing.ts`)
- **Ranges:** each test range runs one programme at a time, firing three rounds a month.
- **New rounds:** need 4 passes at 80% odds, fired from real production. Unaccepted lines are not pulled to the
  central depot.
- **Designs:** need 3 passes at 85% odds, with test articles costing 1.5× the round price each.
- **Failures:** pause the programme 20–35 days. A design fix costs 20 × the price index, adds 12% odds and one
  firing.

## Diplomacy (`diplomacy.ts`)
- **Relations:** relations with each supplier nation start at 50 (35 in Sanctions) and drift back toward 50 by 3% a
  month. They rise by 1 in any month with exports.
- **Ban odds:** export-ban odds are multiplied by clamp(2 − relations/50, 0.2, 2), or 0 while a guarantee holds.
- **Trade mission:** $15M × price index; +12 relations with a nation, +8 with an ally; once every 90 days.
- **Guarantee:** needs relations of 65; $40M × price index; no bans for 360 days.
- **Co-production:** needs ally relations of 60; $30M × price index up front.
  - **Deliveries:** 15% of a month's national draw, landed at Lowmouth each month at 90% of the round price, for 24
    months.
  - **Factions:** industry −4, regions −2.
  - **Lapse:** below 35 relations.
- **Export desk:** $5M, then 60 days before it can look again. It finds a 6-, 9- or 12-month order at 130% of the
  round price.

## Hearings (`hearings.ts`)
- **When:** every 12th month end opens a hearing with three questions, drawn by weight from those that fit your record.
- **Answers:** each sways factions; promises are judged within 360 days.
  - **Can break any month:** solvent, no exports, no strikes.
  - **Can be kept early:** a new line, a counter researched, cyber level 2 everywhere, vetting everywhere.
  - **Judged on the due date:** average readiness of 80% or better.
- **Promises:** kept: confidence +4, faction +5. Broken: confidence −6, faction −8.
- **Requests:**
  - **Lean:** −5%, treasury +8.
  - **Accept:** the provisional figure.
  - **Modest:** +6% at odds of clamp(1.3v, 0.1, 0.95).
  - **Bold:** +15% at odds of clamp(0.95v − 0.1, 0.05, 0.85).
  - **The value v:** weighted faction support/100 + (readiness over the year − 0.7) × 0.5.
  - **Failure:** −1% (modest) or −3% and −3 confidence (bold).
- **Unanswered hearings:** a hearing still open at the next month end takes default answers and the provisional
  figure.

## Cyber (`cyber.ts`)
- **Attack odds:** a month for each system: 0.012 × (1 + 0.4 × known rival weapons) × trouble scale × (1 − 0.25 ×
  level). Plants are attacked ×1.5 for a year after a ransom is paid.
- **Plants:**
  - **With backups:** 5–10 days at 50% (70% with drills).
  - **Without backups:** 20–35 days at 50% (70% with drills), and a choice to pay $15M × price index to unlock in
    3 days (hawks −4).
- **Rail:** 10–25 days (halved with backups) at 50% rail capacity (80% with drills).
- **Suppliers:** a private plant at 50% for 15–30 days. A (40% − 10% × level) chance of stolen data brings the
  rival's next report 40 days sooner.
- **Costs:**
  - **Defence level:** (25 + 20 × level) × price index.
  - **Backups:** $20M, then $2M a month.
  - **Drills:** $10M, then $1M a month.

## Unions (`unions.ts`)
- **Strength:** each town's union changes each month by (55 − average morale) × 0.06 + max(0, prices − pay) × 6 −
  0.6, between 5 and 95.
- **Wages:** each town's pay multiplies its wages. Morale's price penalty uses prices − pay.
- **Claims:** odds of 5% a month × trouble × max(0.5, strongest union/45). The claim is pay if prices lead pay by 3%,
  else hours where crews are tired, else safety.
- **Settlements:**
  - **Pay:** 4%, union −12.
  - **Counter-offer:** 2% at odds of 1 − strength/130.
  - **Hours:** no surge for 180 days.
  - **Safety:** the next stage now.
- **Unsettled after 30 days:**
  - **Strength under 50:** work to rule, 75% for 30–45 days.
  - **Otherwise:** a strike at 30% for 25–50 days. Each other plant in town joins with odds of strength/150, at 50%
    for half as long.
- **National deal:** 3% pay everywhere, every union −10, morale +5, once a year.

## Energy (`energy.ts`)
- **Grids:** each region's grid has a price (0.7–2.2 against normal) and a reserve (0–0.4). Reserves start at 0.12–0.22
  and thin by 0.001 a month.
- **Price each month:** moves 35% of the way toward 1 + fuel shock + 0.08 in winter (outside the heartland) + (0.18 −
  reserve) × 0.3, with ±2% noise.
- **Fuel shocks:** 1.8% a month × trouble scale; they add 25–60% for 90–210 days.
- **Running cost of a line:** capacity value × (0.09 + 0.03 × intensity × power price) × run factor. At normal prices
  and an arsenal's intensity of 1, that is the old 0.12. Power is booked as its own spending category.
- **Intensity:** smelter 3, steelworks 2.6, chip fab 2.2, refinery and chemical 1.8, explosives 1.4, motors 1.2,
  arsenal and components 1, mines 0.8, quarries 0.6, wells 0.5, forestry 0.3.
- **Supplier prices:** spot prices and bids × (1 + 0.06 × intensity × (grid price − 1)).
- **Blackout odds:** a day: (0.004 + 0.03 × thinness) × 1.5 in winter × 3 in an active crisis region × trouble scale,
  over 30. Thinness is clamp((0.2 − reserve)/0.2).
- **Blackouts:** last 1–4 days. Output is 25% without generators (private plants 30%), and 70% with them, at double
  the power cost.
- **Costs:**
  - **Generators:** (6 + 4 × intensity) × the price index.
  - **Power contract:** fixes the price at 1.05 × today's for 24 months.
  - **Grid upgrade:** $60M × the price index; +0.08 reserve after 180 days.

## Oversight (`audit.ts`)
- **Waste:**
  - spot premiums (30% over list when buying without a contract);
  - 30% running costs of idle lines (mothballed plants excepted);
  - ransoms;
  - export penalties;
  - overbilling.
- **Overbilling:** each contract has a 0.6% chance a month × the trouble scale of turning fraudulent, adding 12% to
  every delivery.
- **Internal team:** $5M, then $2M a month. It finds each fraud with 30% odds a month and counts waste at 70%.
- **Review:** every six months, at the end of the 6th and 12th month of each fiscal year. Waste over those six months
  against spending: clean below 5% (Easy 8%,
  Hard 4%), damning from 12% (Easy 18%, Hard 10%).
  - **Clean:** confidence +2, treasury bench +4.
  - **Concerns or damning:** a decision to accept (damning: confidence −1/−2/−3 by difficulty) or contest (even odds;
    otherwise −3, or −3/−5/−6 if damning).
  - **Fraud:** the Auditor-General finds each remaining case with 70% odds. A case you let go costs confidence −4 when
    found again.
- **Fraud decisions:**
  - **Prosecute:** recover 80%, end the contract, supplier health −30.
  - **Settle:** recover 40%, and billing turns honest.

## Statistics (`StatsPanel.tsx`)
- **Records:** each month records the value of every one of your plants' output, every decision taken, and its
  immediate effect on confidence and the treasury.
- **Display:** the panel charts these, with the existing spending, output, threat and confidence-driver records, over
  a year, the term, or the whole game.

## Communities (`communities.ts`)
- **Mood:** each town's mood is 0–100, starting at 55. Each month it drifts 5% of the way back to 55, then:
  - **Open burning:** −demilled/1000, at most −4, at the pit's town.
  - **Test firings:** −0.8 for each programme firing at a range's town.
  - **Plants:** +0.4 for each of your plants with over 200 workers, and −0.6 for each running a surge shift.
- **One-off changes:**
  - **Mothballing:** −10.
  - **Housing:** +3.
  - **Open day:** +4 ($1M × the price index, every 60 days).
  - **Community fund:** +12 ($8M × the price index, every 180 days).
- **Permits:** founding a plant (the plot's town) or starting a rail link (the town at its first end) draws an
  objection with odds clamp((50 − mood)/50, 0, 0.8) × min(1, trouble scale). A content town draws no random number.
  Construction waits on the decision.
  - **Package:** $10M × the price index, mood +15.
  - **Override:** mood −20, regions −3. This is the default.
  - **Withdraw:** 80% back, mood +5. The plot or project is undone: crew let go, spur removed, and the faction
    credit taken back.
- **Protests:** from day 120, each town with your plants and mood below 30 has odds of 25% × the trouble scale a
  month. A protest puts one plant at 70% for 5–12 days, and regions −1.
- **The court:** with burning on and the pit's town below 25, there are odds of 30% × the trouble scale a month of a
  180-day ban on burning. It switches disposal to recycling, without counting as your choice for the 'Clean hands'
  objective.
- **Regions:** they move by (average mood of your towns, the pit's town included − 55) × 0.02 each month.

## The advisor (`advisor.ts`)
- **Trade-offs:** each piece of advice with an action shows the action's cost, found by applying it to a copy, and a
  fixed note on its catch.
- **Newer systems:** hearings, promises, blackout risk at arsenals, cheap power, waste before an audit, unions of 70 or
  more, unguarded plant systems with two or more rival weapons, spy incidents in the last three months, and towns below
  35.
- **The three-month plan:** gathers dated events (forecast shortfalls, contract, order, co-production and power
  contract ends, research, building, plants opening, rival weapons, the hearing, the audit, promises, crises) and
  sorts them by month and urgency.

## Automation (`automation.ts`)
- **When it acts:** automationDay runs at the end of every day's step.
  - **Decisions and hearings:** answered at once, whenever any are open.
  - **Every other area:** acts on days divisible by 7.
  - **Never:** in a two-player game, in the tutorial, or once the game is over.
- **What it does:** each area's proposals() is a list of actions, applied in place through applyInPlace (the in-place
  core of apply) when they validate. Each one's feed line, or a short description, goes to a 60-line log.
- **Reserve:** money gates compare the treasury with reserve + threshold × the stance's spending factor. The
  thresholds are those of the old test player (for example expansion at $500M, generators at $700M, cyber at $800M).
  In the game, every action that might cost money is also tried on a copy first, and skipped if it would take the
  treasury below the reserve. Paid decision options (an ally's rounds, a bailout, a recall, a permit package) are
  advised only when their cost leaves the reserve intact.
- **Stances:** each sets an idle point, a restart point and an expand-below point (stock against target), a spending
  factor, and a peace flag.
  - **Balanced:** 1.6, 1.1, 1.2, ×1.
  - **Stockpile:** 2.0, 1.3, 1.5, ×0.8.
  - **Thrift:** 1.3, 1.0, 1.0, ×1.5, with no automation, route upgrades or audit team.
  - **Peace:** settles claims, funds towns below 45, offers pay deals from union strength 55, and rests crews from
    fatigue 30.
- **recommend():** the advised option for each decision kind; the decisions area uses it. hearingPlan() answers
  hearings, promising only what is in hand.
- **The test player:** the balance check plays proposals() for every area, with no reserve and a balanced stance.
- **The advisor:**
  - **safeAdvice():** applies the top eight suggestions in order on copies, skipping any that would take the treasury
    below the reserve.
  - **diagnose():** follows each round below 80% of target, or forecast below half within six months, from its arsenal
    line to the tightest input and that supplier's state.

## Engineers (`engineers.ts`)

- **Chief of staff:** hires up to need × 1.05 + 6 when money allows, and founds up to two academies.
- **Need:** at each active state plant, 3 engineers per running line, plus 1 per expansion and 2 if automated; 10 per
  plant being built, 8 per in-house job, 4 per automation project, 25 for active research and 15 for a design.
- **Coverage** is staff over need, capped at 1. Plant output is multiplied by `0.85 + 0.15 × coverage` (state plants
  only), and research and design advance `max(0.3, coverage)` days per day.
- **Start:** need × 1.1 + 30 on staff, 60 on the market, so a new game is fully covered.
- **Costs:** signing 0.03 × price index each; salary 0.012 × price index a month for each engineer beyond the starting
  establishment (which the Board's budget already pays for), plus 30% on every salary on premium; academy 40 × price
  index.
- **Monthly:** the market becomes `market × 0.9 + 6 + 4 × open academies`. Quits are 0.8% of staff, +0.6% on standard
  pay, +2% below 75% coverage; half of them return to the market. Academies open after 540 days.

## Intelligence operations (`intelops.ts`)

- **Operations:** steal plans ($25M, 45 days, 70% odds, 15% exposure), sabotage ($40M, 75 days, 55%, 25%), disrupt
  supply ($50M, 90 days, 50%, 30%).
- **Odds** gain 0.08 per agency level and lose 0.06 per point of rival alert, clamped to 10–90%. **Exposure** loses
  0.05 per level and gains 0.03 per point of alert, clamped to 3–60%.
- **Effects:** sabotage moves the next fielding (or the next report) 75 days later; stolen plans bring the next report
  within 15 days and cut active counter research by 30%; disrupted supply multiplies rival arrivals by 0.85 for 120
  days.
- **Exposure:** −4 confidence, −8 with each ally, +2 hawks, and the next rival report 20–40 days sooner.
- **Alert:** +1 on success, +0.5 on failure, −0.1 a month. One operation at a time, from day 60.

## Sound, music and field notes (`ui/sound.ts`, `ui/music.ts`, `game/Tips.tsx`)

- All audio is synthesized with the Web Audio API; there are no audio files. The music mood comes from `moodFor`; one
  sound at most plays per update, chosen from new feed lines by `soundFor`.
- Field notes are checked against the state and the last 40 feed lines; each is shown once per game (`tipsSeen` in the
  save) and the switch is kept in this browser.

## Careers and custom scenarios (`commitments.ts`, `custom.ts`)
- **Each new term:**
  - **Score:** the term report scores only the term's own months.
  - **Budget:** × clamp(1 + (score − 60)/400, 0.92, 1.08).
  - **Expectations:** the Committee expects 2 points more readiness per earlier term (at most 6).
  - **The rival:** reports come 10% sooner per term (at most 20%).
- **Custom scenarios:** every field is clamped on reading. Codes are `FC1-` + base64url JSON.
- **Rival pace:** slow, normal or fast multiplies the rival's report intervals by 1.5, 1 or 0.6.

## Hot-seat (`hotseat.ts`)
- **Control:** sites are controlled by region (Corran's arsenal goes west). Actions on the other player's sites
  are refused, and each action's cost is booked to whoever took it.
- **Scoring each month:** + 10 × own-base stock against need, + own plants' output value / 40 (at most 10),
  − 10 × (spending share above 60%). Then the turn passes.

## Procedural worlds (`worldgen.ts`, `ui/map/geo.ts`)
- **The template:** the classic map. A world is a seeded, smooth displacement field: two octaves of value noise,
  amplitude 75–115 km and wavelength 230–380 km. It fades out over the last 110 km to the edge of the sheet, so the
  land border and the off-map suppliers stay put.
- **No folding:** the warp's Jacobian is checked on a 20 km grid. If any cell is squeezed below 35% of its area or
  flipped, the amplitude is cut by 15% and checked again. A non-folding warp keeps every site on the same side of
  every coast and river.
- **What moves:** sites, cities, the coastline, islands, rivers, lakes, the border, region outlines, sea-lane
  waypoints, labels and map details all go through the same warp.
  - Coast control points more than 45 km from any site or town also get their own push in or out, making new bays
    and headlands.
  - Elevation is the classic relief, read back through the inverse warp (fixed-point iteration), scaled by a broad
    noise, plus two or three new ridges. Forest patches are moved, and farmland and coastline details reseeded.
- **Distances:** `routeKm` is scaled by `KM_SCALE`, so a world's surface network has the classic total length.
- **Names:** capitalised words in the classic names, blurbs, regions, links and map labels that are not generic
  ("Steelworks", "Depot") are mapped to syllable-built names. The off-map nations and allies keep theirs.
- **Text:** `tr()` rewrites classic place words in event text, decisions, the Courier, warnings and descriptions at
  display time.
- **Rebuilding:** `applyWorld(seed | null)` changes the shared world data in place and tells the map and the
  routing graph to rebuild. Site ids, kinds, regions, owners and recipes never change, so everything that refers to
  them keeps working. The game state records `world`, and `advanceDays` and `apply` re-apply it, so saves load into
  the right country.

## Your own industry (`industry.ts`)
- **Open plots:** five `kind: 'plot'` sites, closed and hidden until founded.
  - Founding sets the plot's single line from eleven `FOUNDABLE` recipes, at half of today's need for its output.
  - Building takes 360 days. It costs about 0.65 of a year's output value at today's prices.
  - It lays the plot's rail spur (`plot-<id>` in `CANDIDATE_ROUTES`) and adds the crew it needs.
- **In-house lines:** an arsenal gains the same kind of line for 0.8 of the cost. It sits at zero for 240 days while
  being fitted out, then ramps up.
- **Variants:** Extended-range, Lean build and Long-life change a round's bill of materials (`recipeInputs`), kill
  odds (in the fight) and shelf life (new lots). A new design takes 120 days, one at a time.

## Story (`story.ts`)
- **Structure:** four 360-day chapters, each with a speaker, a briefing written from earlier results, three goals
  checked on its last day, and an `open` step.
- **What the `open` steps do:**
  - budget ±5% after chapter one;
  - the rival is brought forward in chapter two;
  - a pay dispute and regional goodwill in chapter three;
  - a northern crisis, with lower morale if chapter three missed its morale goal, in chapter four.
- **Counting:** qualifications, awards, strikes and new plants are counted from each day's feed.
- **Records:** each chapter's result is kept, confidence moves ±3 per goal against the middle, and a special Courier
  edition is printed. The epilogue depends on the total goals met.

## Accessibility
- **Display:** preferences set `data-palette`, `data-text` and the `rm` class on `<html>`.
  - The colour-blind palette redefines the status colour variables (Okabe–Ito).
  - Text size uses `zoom` on `.fc-zoom` containers, never on the map.
- **Named saves** live under `forge-command-slot:<name>`, with an index in `forge-command-slots`.

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
