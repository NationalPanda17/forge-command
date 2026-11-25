# Changelog

## 12.0.0: a chief of staff, and a far better advisor

### Automation for a more casual game
- **A chief of staff:** hand any of eight areas to your staff on the new Staff tab:
  - decisions and hearings;
  - staffing and housing;
  - supply contracts;
  - production;
  - research and key staff;
  - depots and disposal;
  - power, cyber and security;
  - unions and towns.
- **How they work:** they act every week, and answer decisions and budget hearings as soon as they come up, so a
  hearing never holds the clock.
- **Reserve:** a money reserve they never spend below.
- **Stance:** balanced, stockpile first, save money or keep the peace. It shapes when they expand, idle, settle and
  spend.
- **A log** of everything they did.
- **Autopilot** on the title screen:
  - **Off.**
  - **Assist:** decisions, staffing, supply and research.
  - **Full:** everything.
- **Records:** assisted games are scored as usual and marked as assisted in the record book and on the term report.
  Automation is off in two-player games and the tutorial.

### The advisor
- **Decision cards:** every one shows the advised option and why.
- **Take the safe advice:** carries out every suggestion that fits within your reserve, in one click.
- **Why short?:** traces each round that is short, or will be within six months, to its root cause. That may be a
  round still in testing, an idle or under-crewed line, a mothballed or damaged arsenal, or the tightest part and what
  is wrong with its supplier (a ban, a disruption, a blackout or a closure).
- **Stances:** the stance also reorders the advisor's suggestions.

### Under the hood
- **The test player** used by the balance check is now the chief of staff with everything handed over, so every
  balance run also tests the automation players use.

## 11.0.0: communities, permits and a smarter advisor

### Communities and permits
- **Moods:** every town has a mood toward you.
  - **Lifting it:** jobs, new homes, open days and community funds.
  - **Souring it:** smoke from open burning at the demilitarization site, test firings at the ranges, round-the-clock
    shifts, and lay-offs when a plant is mothballed.
- **Permits:** founding a plant or laying a new rail link needs a permit from the town. A content town never objects;
  an unhappy one may, and the work waits until you decide: win it over with a community package, override it (the town
  and the regional members resent it), or withdraw and recover 80% of the money.
- **Protests:** below 30, people protest at your gates, cutting a plant's output for a week or two. The town beside the
  burning pit can win a court order banning open burning for six months.
- **Politics:** the towns' average mood nudges the regional members each month.
- **Where to see it:** the Towns tab shows each town's mood, with open days and community funds; each plant view shows
  its town's mood.

### Advisor upgrade
- **Trade-offs:** every suggestion with a button now shows what it costs, worked out by trying it on a copy, and the
  catch.
- **New warnings:**
  - budget hearings and promises falling due;
  - blackout risk at arsenals without generators, and cheap power worth locking in;
  - waste before an audit;
  - strong unions;
  - unguarded plant control systems;
  - recent spy incidents;
  - angry towns.
- **Three-month plan:** what is coming, month by month: rounds running low, contracts and orders ending, research,
  building and new plants finishing, the rival's next weapon, the hearing, the audit, promises and any crisis.

## 10.1.0: an in-depth review

Three independent reviews of the whole game (the simulation core, the feature systems and the interface) found these,
now fixed with regression tests.

### Simulation
- **Threats that got through could be forgiven:** any action taken late in a month made the Committee forget that
  month's threats, and land-war shortfalls likewise. The month's totals are now kept in the month itself.
- **Stock counts:** retired rounds on their way to be destroyed no longer count as stock.
- **Refurbishing:** it is limited to depots, arsenals and bases. At the demilitarization site it made stock that could
  never be used.
- **Prices and rules:**
  - Expansions are priced on capacity still ramping up, as they are built.
  - A mothballed plant can't be set running.
  - A hire is whole people.
  - Closed suppliers take no contracts, investment or qualification.
  - An expired tender can't be awarded.
- **Sales:** parts your own plants send to private companies are now paid for.
- **Hearings:** a budget hearing no longer throws away a budget change made while it sits, from a story chapter or
  the stockpile law.
- **Promises:** the "no exports" promise now covers new orders only, and strikes earlier in the month no longer break a
  "no strikes" promise.
- **Mothballed plants:** a plant mothballed since its union's claim doesn't strike, and a new research line at a
  mothballed plant starts idle.
- **Smaller fixes:**
  - A quality scandal can't start at a closed supplier.
  - The "Full racks" objective uses this month's readiness.
  - A sandbox that stops being endless keeps the term you chose.
  - The turned spy ring's option text matches what it does.

### Story and two players
- **Story goals:** three of them could never be met. A tender awarded, a plant founded and a line brought in-house now
  count.
- **Two players:** neither director can automate the other's plants or answer decisions about them. A director can sign
  for the grid that powers their own plants.

### Interface
- **Dialogs:** keyboard shortcuts no longer fire behind a dialog, and Space presses the focused button instead of the
  clock. A story briefing and a budget hearing never open at once, and keyboard help shows above the term report.
- **The clock:** it stops when a hearing, a handover or a briefing begins, and the +1d and +7d buttons wait for them.
- **Fixed controls:**
  - The Save button in the save form works.
  - A closed term report can be reopened.
  - Two-player games have a term picker.
- **Costs shown:**
  - Contract prices include inflation.
  - Hiring and letting go of key staff show their cost, and severance needs the money.
- **Smaller fixes:**
  - Research progress uses the real duration.
  - Small cyber odds show a decimal.
  - The tender picker can't go stale.
  - Explained numbers are read out by screen readers.
  - Skipping the tutorial no longer earns "Quick study".
  - Several labels are corrected.

### Tests
- **New coverage:** every panel, site view, material view and dialog renders without crashing and without NaN or
  undefined; every player action and decision type is tested; and the Courier, lots, determinism, named saves (including
  saves from before the newer systems), the record book and achievements have tests.

## 10.0.0: power, audits and the statistics room

### Energy and the grid
- **Grids:** every region has its own grid, with a power price and a reserve margin.
- **Power bills:** your plants pay for power by how hungry they are: a smelter uses three times what an arsenal does.
  Private suppliers pass part of their power bills on in their prices and bids.
- **Prices:** they rise in winter, when reserves thin, and in a fuel shock (a pipeline outage, a cold snap abroad),
  which lasts for months.
- **Blackouts:** thin reserves, winter and the rival's strikes on the grid during a crisis bring blackouts. A plant
  without its own generators falls to a quarter of its output.
- **Your tools:**
  - **Backup generators:** keep a plant at 70% through a blackout.
  - **Power contracts:** fix a region's price for two years.
  - **Grid upgrades:** add reserve after about six months.
- **New Power tab;** each plant view shows its power and generators.

### Audits and oversight
- **The review:** every six months the Auditor-General reviews your waste: premiums paid for buying without a
  contract, running costs of idle lines, ransoms, penalties, and suppliers quietly overbilling their contracts.
- **The verdict:** a clean review earns confidence. A critical one comes to you to accept or contest. The thresholds
  are gentler on Easy and stricter on Hard.
- **Overbilling:** when it is found, prosecute (recover most of it, lose the contract), settle quietly, or let it go
  and hope it never comes out.
- **Internal audit team:** catches overbilling within months and softens the Auditor-General's findings.
- **Where to see it:** waste so far and the last review are in the Money tab. A critical audit can come up at the next
  budget hearing, where you can promise a clean one.

### Statistics room
- **New Stats tab,** covering the last year, this term, or the whole game:
  - spending by category, power included;
  - rounds made each month, and output by plant;
  - what got through, threat by threat;
  - where your confidence came from;
  - every decision and what it did to confidence and the treasury.

### Balance
- **Running costs:** a quarter of a line's running cost is now its power bill, the same as before at normal prices.
- **The test player** buys generators for its arsenals, signs power contracts while power is cheap, hires an audit
  team once money allows, accepts audits and settles overbilling quietly.

## 9.0.0: allies, hearings, hackers, unions, careers and your own scenarios

### Allies and exports
- **Relations with the nations that sell you parts:** the colder they are, the likelier an export ban. Selling rounds
  abroad warms them a little.
- **Trade missions:** warm a nation or an ally.
- **Supply guarantees:** at relations of 65 or more, a nation promises no export bans for a year.
- **Co-production:** at relations of 60 or more, an ally lands a share of a round every month for two years, at 90%
  of the price. The work goes abroad, so industry and the regions grumble, and the deal lapses if relations fall
  below 35.
- **Export desk:** goes looking for buyers, who pay better than the ones who come to you.
- **New Allies tab.**

### Budget hearings
- **The hearing:** the fiscal-year budget is now set at a hearing before the Defence Committee. Three members ask
  about your record: readiness, overspending, exports, jobs, the rival, strikes, hackers or spies.
- **Answers:** each sways the factions, and some are promises, checked a year later. A kept promise earns
  confidence; a broken one costs more.
- **Your request:** ask for less, accept the figure, or ask for 6% or 15% more, with the odds shown.
- **Where to see it:** the clock stops for the hearing, and the Board tab lists your open promises.

### Cyber and IT attacks
- **Targets:** the rival's hackers go after plant control systems (ransomware: rebuild, or pay and invite them back),
  the rail booking system (trains run at half capacity), and suppliers' networks (output halved, and design data
  stolen).
- **Defences:** three levels for each system, offline backups, and manual fallback drills. They are in the Intel tab.

### Unions and strikes
- **Unions:** each town's union grows stronger when pay trails prices and morale sags.
- **Claims:** for pay, hours (no round-the-clock shifts for six months) or safety.
- **Industrial action:** a refused claim ends in a strike where the union is strong, which can spread to the town's
  other plants, or a work-to-rule where it is weak.
- **National pay deal:** once a year, it cools every union.
- **Where to see it:** union strength and pay against prices are in the Towns tab.

### Career and records
- **Terms:** each term is now graded on its own months. Your record sets the next term's budget, the Committee expects
  a little more each term, and the rival moves faster. The term report lists your whole career.
- **Record book:** on the title screen, your best run for each kind of game and difficulty, plus lifetime totals.
- **Eight new achievements.**

### Scenario editor
- **Settings:** a Custom scenario sets starting money and budget, the war reserve, Committee confidence, prices, a
  crisis on day one, the rival's pace, export bans on each supplier nation, how often trouble comes, and relations
  with allies.
- **Sharing:** share it as a short code; paste a code to play someone else's.

### Balance
- **Private suppliers:** their random disruptions no longer include cyber attacks; those are the new cyber system now.
- **Pay disputes** became union claims.
- **The test player** answers hearings, buys basic cyber defences and backups, sends trade missions to cold nations, and
  settles claims when it can afford to.

## 8.0.1: display fixes
- **Generated worlds:** ordinary words that begin a sentence in a site's description (such as "Short", "Open" or
  "Over") were mistaken for place names and renamed, garbling messages like "Short of infrared seekers". Only
  capitalised place words are renamed now, and "Test" and "Coastal" stay as they are.
- **Map:** the salt pans were drawn as broken shapes on generated worlds (and logged an error), because moving a
  path dropped its relative commands. Relative commands now move with their path.
- **Guide:** "Your own industry" opened the wrong section; the two sections shared an id.
- **Layout:** supplier names on the Plan tab and plant names on the Towns and Build tabs wrap instead of being cut off; the
  game-mode cards on the title screen line up; the title's tagline breaks evenly; and the new-game text names the
  generated country instead of Aldmere.
- **Phones:** the map layer toggles, the round chips and small option buttons are now at least 24px to tap.

## 8.0.0: spies, towns, test ranges and two players

### Espionage and security
- **Spies:** the rival's intelligence service targets your plants, more often as its weapons programmes grow.
- **Incidents:** sabotage (a fire that halves output for weeks), stolen designs (the rival's next weapon comes
  sooner), and leaked stock figures (the Committee is angry, and a crisis bites harder).
- **Security clearance:** three vetting levels at each plant raise its security. Unhappy crews lower it.
- **Spy rings:** good security catches a ring before it acts. Then you choose: expose it publicly, turn it into
  double agents (more warning of the rival's next weapon), or dismiss it quietly.
- **Where to see it:** the Intel tab shows each plant's security and its monthly risk.

### Workforce towns
- **Towns:** every plant draws its people from the nearest town, and a town can supply only as many as it has
  homes for.
- **Hiring:** hiring beyond that is refused. Build housing (400 homes, about five months) where you need people.
- **Growth and decline:** towns grow with jobs, and lose people after months without enough work.
- **Mothballing:** lay off a plant's crew and idle it to save wages, at a cost to the regions and the Committee.
  Reopen it later.
- **New Towns tab.**

### Testing and qualification
- **What gets tested:** new rounds from research and new round designs.
- **Firings:** each is fired at the two test ranges, one programme per range, three firings a month, before it is
  accepted. Until then a new round's production waits at its arsenal.
- **Failures:** a failed firing stops the programme for an investigation. Then fix the design (better odds, one
  more firing) or press on.
- **New Testing tab:** the ranges, the queue (which you can reorder) and what awaits acceptance.

### Hot-seat two-player
- **Two directors, one device:**
  - **Western Command:** the north, the coast, the isles and Corran's arsenal.
  - **Eastern Command:** the east and the heartland.
- **Shared and separate:** the treasury, railways, research and policy are shared, but each player can act only on
  their own plants.
- **Turns:** control changes every month, with a handover screen.
- **Scoring:** each director is scored on their own bases, their own plants' output, and their share of the
  spending. The end-of-term report names the winner.

### Refinements
- **Towns:** a mothballed plant now costs only a caretaker's upkeep and takes no apprentices, and a plant still
  being built cannot be mothballed. When a town has no one left, the advisor suggests housing instead
  of a hire it cannot fill.
- **Spies** leave mothballed plants alone.
- **Testing:** a new round with nothing at its arsenal to fire now says it is waiting for rounds. A round's next
  design must wait until the last one leaves the test schedule.
- **Two players:** the clock cannot be restarted behind the handover screen or a story briefing. The advisor only
  advises on your own plants, and each site says who runs it.

### Balance
- **Hard:** the Committee now expects 72% readiness, down from 76%, and the monthly budget rises from $195M to
  $205M, to make room for the new pressures.
- **The test player** now hires to the full crew requirement, builds housing when a town runs short, and vets its
  plants.

## 7.0.0: a new country every game

- **Procedural worlds:** campaigns and sandboxes now start, by default, in a new country drawn from the game seed.
  - Its own coastline, with bays and headlands of its own.
  - Islands, rivers and lakes moved with the land.
  - New mountain ranges, forests and farmland.
  - Cities, regions and every site placed to fit the land.
  - New names for the country, cities, companies, seas, hills and rivers.
- **What stays the same:** every site keeps its role, owner, recipes and links, so the supply chain, the rival and
  every rule play the same.
- **Choosing a map:** pick "A new country" or "Classic Aldmere" on the title screen. "Another" draws a different
  country, and the same seed always draws the same one.
- **Story and tutorial** stay on the classic map, because their text names its places.
- **Saves** remember their world.
- **Checked:** 300 generated worlds were tested. Every site lands on land and inside the map, and everything stays
  reachable. A warp that would fold the map over itself is weakened until it cannot.
- **Balance:** each world's distances are scaled so its whole rail and road network is as long as the classic one.
  Which links are long changes, but supplying the country is about as hard overall. In testing, a competent
  director finished every Easy and Normal campaign on generated worlds. Hard is tighter there, and was already close
  on the classic map.

## 6.0.0: your own industry, a story, and comfort

### Build your own industry
- **Five open plots** across the map, shown in the Build and Industry tabs.
  - Found a plant on one to make any of eleven parts, from perchlorate and propellant to rocket motors, seekers,
    chips and magnets.
  - Each plant takes about a year to build, comes with its own rail spur, needs a crew, and then ramps up.
- **Bring parts in-house:** fit a new line into one of your arsenals in about eight months. Parts with a single
  outside supplier today are marked.
- **Round designs:** each round can be built as Standard, Extended-range (better odds of a kill, more motor), Lean
  build (cheaper in every input, worse odds) or Long-life (lasts half as long again, costs a little more). A new design
  takes about four months.

### Story campaign
- **Four chapters, a year each:**
  - Inheritance;
  - Shadows in the East;
  - Hands on the Line;
  - The Long Winter.
- **The people:** each chapter is briefed by a recurring character (the Committee chair, the head of intelligence,
  the union leader, the defence chief) and sets three goals.
- **Consequences** carry forward: your budget, the rival's timing, the regions' mood, crew morale and how the final
  winter war opens all depend on what came before.
- **Special Courier editions** close each chapter; an epilogue closes the story.

### Accessibility and comfort
- **Display:**
  - A colour-blind-safe palette (Okabe–Ito).
  - Large and larger text for panels, headers and dialogs; the map keeps its own collision-free sizing.
  - Reduced motion.
- **Keyboard:**
  - `[` and `]` switch tabs; `M` jumps to the map.
  - `?` shows every shortcut and the display options.
  - A skip link jumps to the panels.
- **Named saves:** up to eight, kept side by side in your browser, saved from the game and loaded from the title.

### Balance
- The test player now also founds plants and brings parts in-house for starved rounds.

## 5.0.0: the rival, lasting choices and a clearer map

### The rival
- **A rival that evolves:** the Vardan Directorate fields six new weapons over the term, in an order that changes
  with the seed:
  - drone swarms;
  - supersonic cruise missiles;
  - manoeuvring ballistic warheads;
  - decoys and jammers;
  - heavier rocket barrages;
  - new armoured divisions.
- **Effects:** each one changes how many threats arrive, how many interceptors each takes, which rounds hit, or how
  much land fighting needs, so your production mix has to change too.
- **Warning and counters:** intel warns about three months ahead, and each weapon has a counter-research project.
- **Intel tab:** what has been fielded, what is coming, the counters, and the threat load now against the start of
  your term.
- **By difficulty:** the rival is half as strong on Easy, and moves faster on Hard.

### Choices that last
- **Multi-year programmes:** promise a monthly output of one round for three or five years. The Committee adds money
  every month you deliver; three misses cancel the programme, and keeping it to the end earns a bonus.
- **Standing policies:** three at a time, from six (Buy Aldmeran, a strategic stockpile law, open books, a warm
  industrial base, a clean disposal pledge, an export drive). Each has a gain and a cost, and revoking one costs
  confidence.
- **A second term:** after a completed term, carry on with every plant, link and round you built.

### Guidance
- **The advisor** on the Watch tab ranks the next best moves from the forecast, the bottleneck tracer, the rival,
  contracts, crews and crises, with a "Do it" button for most.
- **Watch warnings** jump straight to the tab where the fix lives.
- **Explain this number:** readiness, confidence, the treasury, the season and prices, stock and flows on the
  Plan tab, each line's daily rate, the price index and threat loads open a short breakdown on hover, focus or tap.
  Confidence shows where last month's change came from.

### The map
- **Weather:** snow in the north and sea ice along its coast in winter, flooded rivers in March and April, and a
  heat tint in July and August.
- **Vehicles:** trains, ships (with wakes), trucks and aircraft, each facing the way it travels.
- **A minimap** for jumping around the map.
- **A night look** with lit cities.

### Performance
- **Flow view:** on small screens, or zoomed out, shipments become moving flow lines per route, sized by traffic.
- **Lighter movement:** labels rest while you zoom and reappear, collision-free, once it settles. Moving vehicles
  pause while you drag the map.

## 4.1.0: smooth, and a real sandbox

- **Fluid movement:**
  - The clock runs continuously between simulated days, and shipments glide along their routes every frame instead of
    hopping a day at a time.
  - Mouse-wheel zoom eases to its target.
  - Bars and gauges slide to new values.
- **Sandbox is its own game mode:**
  - The title now offers Campaign, Sandbox and Tutorial.
  - A sandbox has no end date and no dismissal by default, and isn't scored or counted for achievements.
  - The new Sandbox tab changes the rules mid-game, adds money, starts or ends crises, disrupts a site, lifts every
    disruption and finishes research.
- **The weekly challenge is gone.** Your best campaigns are still listed on the title.

## 4.0.0: build, crew and replay

### Build the network
- **Build tab:** six new rail and road links to build, shown on the map as amber plans. Construction moves on the
  map, and finished links join the network and change routing.
- **Route upgrades:** the busiest routes can carry half as much again, twice over. Sea upgrades are port works.
- **An icebreaker** keeps the northern sea lanes at 90% through the winter.
- **Resilience grants** make disruptions at a supplier rarer, shorter and milder. Sole sources are listed first.
- Hover a project to pick it out on the map.

### Plants and people
- **Plant view:** every line in your arsenals, with input days on hand, a moving belt, shift and output.
- **Shifts:** idle, one shift, two shifts or round the clock.
- **Crew:**
  - **Skill** grows with work; new hires dilute it.
  - **Morale** follows safety, fatigue and whether wages keep up with prices.
  - **Fatigue** builds on round-the-clock shifts.
  - **Accidents** at your own plants grow likelier with fatigue, wear and weak safety.
  - Disputes start where morale is lowest.
- **Safety programmes**, **apprenticeships** and **automation** (30% less crew, 20% less scrap).

### Presentation and replay
- **The Aldmere Courier:** a short edition every month, with its lead story under the header.
- **Generated music** that turns tense in a crisis, and sound effects. Both can be switched on and off by the clock.
- **Ripples on the map** where things just happened.
- **Sandbox rules:** switch inflation, seasons and crises off, change how often things go wrong, add money, or play
  with no end date.
- **Weekly challenge:** the same two-year campaign for everyone that week, with local best scores and a scoreboard.

### Balance
- **Land shortfalls** are averaged across a region's lines and capped at 8 confidence a month, so adding a line
  never multiplies the penalty.
- **The test player** now hires with trainees counted and runs safety and apprenticeships. It funds the supplier
  behind a starved round's bottleneck and upgrades congested routes. It finishes every Easy, Normal and Hard
  campaign; hands-off play still loses most Hard runs.

## 3.0.0: depth

### Planning and analytics
- **Plan tab:**
  - Each round's stock against target for up to two years, plus a 12-month forecast. The forecast counts output,
    expected firing (crises included), exports and lots reaching the end of their life.
  - **What limits it:** follows a round's bill of materials down to the mine, showing supply against demand at
    each level.
  - The weakest links in the whole chain, and a warning when overstocked lines eat parts other rounds need.
- **Watch list:** forecast warnings, contracts about to lapse, bids waiting and export orders falling behind.
- **End-of-term report:** a grade, readiness, confidence and treasury over the term, and the reserve you leave
  behind.

### A deeper economy
- **Inflation:** prices rise about 3% a year, faster in a crisis. Wages, running costs, freight, spot buying and
  expansion all follow. Budgets keep up with most, but not all, of it.
- **Tenders:** every qualified supplier bids at once.
  - More bidders mean sharper prices.
  - Weak firms bid low and are less reliable.
  - Contracts lock today's price.
- **Supplier finances:** steady contracts keep firms healthy. Weak firms on old fixed-price contracts ask to
  reprice.
- **Supplementary budgets:** one request per crisis.

### A living world
- **Seasons:**
  - Winter sea ice in the north and snow on the roads.
  - Spring floods.
  - Summer heat trimming energetics output.
- **Allies** (the Merrow Compact and the Calder League) ask for rounds, and sell you theirs when you are short.
- **Export orders** from foreign customers, delivered from the central depot without breaching half of target.
- **Developing situations** that unfold in stages: pay disputes and strikes, suspect parts and recalls, mine
  accidents and inspections.

### The first hour
- **Scenarios:**
  - Peacetime.
  - War footing (a crisis from day one).
  - Sanctions (every foreign supplier banned for most of a year).
  - Rebuild (half the reserve, more money).
- **A guided tutorial:** two years on Easy, eight steps, no crisis in the first year.
- **Fifteen achievements,** remembered in your browser.
- **Rebalanced difficulty:** a competent director now finishes Easy and Normal, and most Hard campaigns.
  Hands-off play still loses on Hard.
- **Older saves still load.**

## 2.0.0: the network

A full rebuild: from a monthly turn game to a real-time management game.

### Cradle to grave
- **The whole chain is simulated:** extraction, processing, chips and optics, components, integration, acceptance,
  storage, issue to bases, firing, ageing, surveillance testing, refurbishment, and demilitarization by burning or
  recycling.
- **Size:** 49 materials and 65 fictional sites, with recipes and bills of materials scaled from public reference
  figures.

### Logistics
- **Transport network:** rail, road, sea and air links, each with a daily tonnage limit and transit time.
- **Pull-based resupply** through central and regional depots to the bases, with targets you set.

### Play
- **Pausable real time:** 1× to 8×, step a day or a week, and auto-pause on important events.
- **A detailed vector map** with an icon for every kind of site, pan and zoom, and layers.
- **Panels:** watch list, site inspector, materials explorer, stockpile lifecycle, logistics, fight, Board (research,
  staff, Committee, decisions, objectives), money, feed and guide.
- **An aging war reserve:** much of it retires during your term.

## 1.0.0: the full game

### Factory floor
- **Stages:** every line is a chain of stages with partly-finished units waiting between them.
  - Each stage has its own yield, and experience cuts scrap.
  - You can widen any one stage.
- **Test cells:** each campus has a shared pool of test cells for acceptance testing.
- **First-article inspection:** new capacity is inspected before it ramps up.
- **In-house plants:** a motor works, a shell forge and an optics lab.

### Deep supply chain
- **Feedstock markets:** your suppliers' own suppliers, with disruptions and price swings.
- **Shipping:** lead times and losses at sea.
- **Contracts:** they lock today's price.
- **Shelf life:** stock held far beyond need ages out.
- **Supplier investment:** pay a supplier to expand.

### Research and new products
- **Engineering program:** 14 projects.
- **New lines:** APKWS, Coyote Block 2 and Javelin.
- **Design changes** that cut scarce parts.
- **Process gains.**
- **High-power microwave defense.**

### World and logistics
- **Regions:** four regions with depots. Crises hit their own region hardest.
- **Convoys:** limited by tonnage. Emergency airlifts cover only part of a shortfall.
- **Allied loans.**
- **A rival power** whose growing arms industry sharpens new crises.

### People and politics
- **Key staff:** five posts, filled by fictional candidates with skills and quirks.
- **Committee factions:** five factions that pull confidence each month.
- **Public support.**
- **A budget request** at the end of each year.
- **Export policy.**

### Story and replay
- **Scenarios:** each has a briefing, chapter beats and four objectives.
- **Challenge modifiers:** ironman, austerity, embargo world, endless.
- **A daily challenge.**
- **A sandbox** with custom rules.
- **17 achievements.**
- **A news ticker.**

### Presentation and launch
- **New views:** campus floor drawings, an Analytics tab and a map of Aldmere.
- **Sound:** synthesized effects you can switch off.
- **Settings:** text size, reduced motion and high contrast.
- **Keyboard shortcuts:** E ends the month, number keys switch tabs.
- **Error recovery** that offers to download your save.
- **An About page** with data and privacy notes.
- **Social-share preview** image and tags.
- **Saves** from earlier versions upgrade automatically.

## 0.2.0
- Campuses, workforce, second sources, threats and the cost exchange, partners, events and decisions.
- Committee confidence, the advisor, four scenarios, tutorial, guide, and offline play.

## 0.1.0
- Production lines, shared components, contracts and the monthly loop.
