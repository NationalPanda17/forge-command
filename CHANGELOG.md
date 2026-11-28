# Changelog

## 20.7.1: design pass results

- **The design pass is complete.** `docs/design-pass.md` now ends with Phase 5:
  - the opening before and after (the first trouble moves from day 100 to day 55, and a passive player's confidence
    rises 10 points less by month 3);
  - the whole pass's balance on 40 seeds, within noise and with fewer games in debt;
  - War footing rechecked on 80 seeds;
  - the regressions found and fixed;
  - the known issues;
  - the recommended next sprint.
- **No game changes.** A tuning change for War footing was tested, made no difference, and was not kept.

## 20.7.0: a tutorial that solves a real problem (design pass C7)

- **The tutorial now teaches the game by playing it.** It used to be ten steps, most of them "open this tab". It is now
  eight:
  1. the goal and the clock;
  2. your arsenal;
  3. the year ahead;
  4. **trouble is coming:** speed up, and a supplier breaks down;
  5. **answer it:** the advisor's next step on Home says what to do and what that does;
  6. award the contract, if your answer was a tender;
  7. people and projects;
  8. keep watch.
- **Steps 4 to 6 use the first-month breakdown from 20.2.** In the tutorial on the classic map, it is a supplier of
  rocket motors or RF seekers, and the answer is to start qualifying a second source.
- **Dropped:** the tours of the Materials, Staff and Towns tabs. The field notes explain engineers, strikes, permits
  and the hearing when they first come up. The "People and projects" step now says where engineers and towns live.
- **Fix:** once a second source is being qualified, the advisor stopped asking for the breakdown to be answered. It
  had gone on to suggest qualifying a third maker.

## 20.6.0: what each move does (design pass C6)

- **Advice cards now say what a move does, in the game's own numbers.** Examples:
  - "Adds 4.6 a day of silicon chip sets: about a tenth at once, all of it in about 11 months."
  - a shift change gives the line's output before and after, a day;
  - a tender says how much it asks for, for how long, and that bids come within a month;
  - "Vantor Motor Works can supply your arsenals in about 8 months."

  Hiring, housing and research say how soon they pay off. A card whose move is already fully explained shows no
  extra line.
- **Why not a forecast number:** the design pass planned to show each move's effect on the 12-month forecast. Measured,
  that was unreliable. The quick forecast cannot see new capacity, because it is capped at last month's output and
  capacity ramps up over months. Playing the game forward with and without the move was mostly noise: research
  "raised" readiness 7 points within six months, before it could finish. A wrong number teaches players to distrust
  the cards, so the cards state facts instead.
- **The catch lines are shorter** where the new line now gives the exact timing.
- **Fix:** "for about 1 weeks" on the breakdown advice now reads "1 week".
- **No rule changes.** The ramp-up rate is now one shared function (`rampStep`), so the cards and the rules use the
  same sum. The golden masters are unchanged.

## 20.5.1: no overview map

- **The small overview map in the map's bottom-right corner is gone.** At the normal zoom, the main map already shows
  the whole country, so the overview only repeated it, and it showed no sites, alerts or shipments. The zoom buttons
  and Reset view (0) still cover moving around the map.

## 20.5.0: the big moments (design pass C5)

- **The peaks of a term now feel different from routine news.** They are:
  - a promise kept;
  - an objective or a Committee ask met;
  - the Committee granting a budget request;
  - a crisis winding down;
  - an operation succeeding;
  - a new plant opening;
  - a round climbing back to the Committee's goal at a month's close.

  Each gets a short motif of its own (three rising bell notes over a soft brass swell), a gold banner with a star in
  the status bar for a few seconds, and a larger bronze ripple on the map where it happened. Routine good news stays a
  line in the log.
- **A peak that pauses the game** shows the same star and gold in the pause banner, with Resume beside it.
- **The motif follows the sound switch**, and the ripple follows the reduced-motion setting. The moment is also
  announced to screen readers.
- **Display only:** the simulation and the golden masters are unchanged.

## 20.4.0: the Committee asks (design pass C4)

- **A short goal between the long ones.** From month 2, every three months, the Committee asks for one concrete thing
  within 90 days. It takes the ask from where your game stands: raise your thinnest round by a tenth of its goal, or
  start qualifying a second maker for a part only one supplier makes. It shows on Home under "The Committee asks",
  with the time left, a progress bar and what it is worth.
- **Small stakes, both ways.** Meeting it releases $40M and +2 confidence. Missing it costs 1 confidence. A director
  who does nothing misses almost every ask, so inaction shows months sooner than before.
- **The advisor points at a second source** while the Committee is asking for one.
- **In scored games only:** Peacetime, War footing, Sanctions, Rebuild and the tutorial. Not the sandbox, the story or
  two-player games.
- **Balance** (40 seeds, before → after): the advice player was dismissed in 0 → 1 games on Easy, 8 → 7 on Normal,
  13 → 10 on Hard, 1 → 4 in War footing, 3 → 5 in Rebuild and 4 → 2 in Sanctions. Mostly within noise. War footing
  is the one to watch: it rose the same way with an early version of 20.3.
- **Tried and dropped: an ask to bring running costs inside the budget.** No player met it (0 of 5): a three-month
  average cannot be turned round in 90 days, and an ask no one can meet only discourages. The 20.1 warning covers
  running costs.
- **Golden masters re-recorded on purpose** for the scored games: peacetime-normal, peacetime-hard, war-footing,
  sanctions, generated-map and hands-off. The story and the sandbox are unchanged.

## 20.3.0: praise is earned (design pass C3)

- **A new director earns the Committee's praise slowly.** In a first term in Peacetime or the tutorial, the
  Committee's praise starts at a quarter of its full weight and reaches all of it after six months. Criticism counts in
  full from the first day. The reserve you inherit no longer lifts your confidence on its own: for a director who does
  nothing, confidence after three months is 65 instead of 76, and after six months 76 instead of 86.
- **Unchanged elsewhere.** War footing, Sanctions and Rebuild open under pressure, so early praise there is earned and
  they are unchanged. So are second and later terms of a career.
- **Balance** (40 seeds, Peacetime, before → after): the advice player was dismissed in 1 → 0 games on Easy, 8 → 8 on
  Normal and 12 → 13 on Hard; the chief of staff in 0 → 0, 1 → 2 and 6 → 4. Scores fall by 1 to 3 points, from the
  lower confidence early in the term.
- **Fix: the confidence explanation now includes the mandate.** Pressing Confidence in the top bar showed "Last month:
  +0.0" while confidence was rising. It left out the Committee's judgement of your mandate, the largest part, which has
  been missing since 17.0. It now shows that line, with a note while a new director's praise is still ramping up. The
  line once called "Readiness against expectation" is now "Readiness below the Committee's floor", which is what it
  measures.
- **Fix: long lines in the explanations wrap.** They inherited no-wrap from the top bar, so a long line ran out of its
  box and under the side panel.
- **Golden masters re-recorded on purpose:** peacetime-normal, peacetime-hard, generated-map, story, sandbox-endless and
  hands-off (the Peacetime-based games). War footing and Sanctions are unchanged.

## 20.2.0: trouble in the first month (design pass C2)

- **A Peacetime campaign and the tutorial now open with a problem.** Between day 25 and day 50, one of the suppliers
  you hold a contract with breaks down: a fire, a breakdown, a flood or a strike takes its output down to 30–50% for 6
  to 10 weeks. The game pauses for it. Before, nothing went wrong for months: ordinary breakdowns cannot happen before
  day 60, and readiness stayed above 90% until about month 10.
- **The advisor answers it at once.** Its next step is either a tender sized to what the supplier cannot send, or, if
  no other qualified maker exists, qualifying a second source. In that case it says plainly that qualifying takes about
  8 months: too late for this breakdown, in time for the next.
- **The incident varies.** The supplier, the day, the damage and the length come from the game's seed, so a replay
  meets a different problem. It never touches the game's own random sequence, so every other event is unchanged.
- **The sandbox, the story and the scenarios with their own pressure** (War footing, Sanctions, Rebuild) are unchanged.
- **Balance** (40 seeds each, before → after): the advice player was dismissed in 1 → 1 games on Easy, 6 → 8 on Normal
  and 11 → 12 on Hard; the chief of staff in 0 → 0, 2 → 1 and 6 → 6. All are within noise.
- **Golden masters re-recorded on purpose:** peacetime-normal, peacetime-hard, generated-map and hands-off. These are
  the standard scored games the incident now reaches. The story and the sandbox records are unchanged.
- **Not shipped: opening short of the goal (C1).** Measured, it broke games. With the reserve at 65% and no incident, the
  advice player was dismissed in 15 of 20 games on Normal (3 of 20 before), and the chief of staff in 8 of 20. The
  Committee counts a short reserve as failure from the first day, and plants are sized to hold the reserve, not
  rebuild it. See the design pass for what it would take.

## 20.1.1: a shorter welcome, and the "?" explained (design pass quick wins)

- **The tutorial's first step is three short sentences:** the goal, the threat, and the one thing to do (start the
  clock). It was a 90-word paragraph. The speed bars, tab badges and Search move to the last step, "Keep watch",
  where they are used.
- **The "?" on a supplier is explained where you point at it.** Hovering a site that is not qualified now says so,
  and that you cannot buy from it until it is (right-click to qualify). Before, only the map key said what "?" meant.

## 20.1.0: the running deficit is visible (design pass C0)

- **A new warning on Home: "Running costs exceed your budget by $X a month".** It appears when wages, contracts,
  power, freight and disposal together cost more each month than the budget brings in, and the treasury would run out
  within 18 months at that rate. It says how many months are left and what to do: put over-target lines on one shift,
  let surplus contracts lapse, or ask for more at the hearing. Before this, the game slid into debt with no warning.
- **The chief of staff and the safe advice keep more in hand when the budget is short.** Their $300M safety margin now
  also covers a year of any running gap, so they stop taking on costs the budget cannot carry. Over 160 games each
  (four scenarios, 40 seeds), the chief of staff's games that went into debt fell from 25 to 17. For the safe advice
  the count was unchanged (21 and 21), because by the time a gap appears the costs behind it are already committed;
  the warning is what helps there. Scores and dismissals did not change.
- **The design pass** (`docs/design-pass.md`): an audit of the game, a diagnosis, and a plan, with the measurements
  behind them. It corrects one of its own first findings: the safe advice does not lose games when the player answers
  the Board and the hearing.
- New tuning: `depth.json` → `spending`.

## 20.0.1: the header fits the window

- **The top bar no longer runs off the right edge.** A leftover style moved it 8 pixels right instead of insetting it,
  so its right end and border were cut off at every window size. It now sits 8 pixels in from both edges and lines up
  with the panels below it.

## 20.0.0: ready for itch.io

The game is ready to put on itch.io. Nothing has been uploaded: that is the owner's call.

- **An itch.io build.** `npm run build:itch` makes `release/forge-command-<version>-itch.zip`. It uses relative paths
  and has no offline service worker, since itch serves each upload from its own folder. Before zipping, the script
  checks the paths, the file count and the file sizes against itch's limits. It was checked from a nested folder: the
  game loads, nothing fails to load and the console is clean. The GitHub Pages site is unchanged.
- **The store page, written:** the tagline, description, genre and tags, embed size, controls, and a checklist for
  upload day (`docs/launch/itch.md`).
- **Store images:** a 630×500 cover and six 1920×1080 screenshots, in `production/launch/itch/`.
  `scripts/store-shots.ts` takes them again from the running game, so they can be redone after any change.
- **Fix:** the advisor said "in 1 months"; it now says "in 1 month".
- **The in-game feedback form from 19.3.5 is removed.** The playtest brief keeps its questions; testers answer them
  in writing.

## 19.3.5: ready for playtesters

- **A feedback form in the game.** The speech-bubble button at the top right, or "Tell us how this term went" on the
  end-of-term report, opens seven short questions: how clear and how fair the game felt, the pace, whether you would
  play again, and what confused you, what you enjoyed and what looked broken.
- **Nothing is sent.** The form makes a short report to copy or save as a file. If you agree, it adds where you are in
  the game: the version, mode, date, headline numbers and window size, and nothing personal. If your browser will not
  copy, the report appears in a box to copy by hand. Your answers stay in this browser until you clear them.
- **The clock pauses** while the form is open.
- **A playtest brief** (`docs/playtest.md`) for whoever runs the sessions: who to invite, three sessions (a cold
  start, one term, a career), what to watch, the same seven questions, and how to read the answers.

## 19.3.4: one card for every choice

- **The Board's decisions, the budget hearing's questions and the advisor's next step now share one card.** Each card
  has an amber edge, a small label above (such as "The Board · decide by month end" or "Question 2 of 3"), an icon and
  a title, then its options. Once you have read one card, you can read them all.
- **Options look the same everywhere.** Each option shows its name and what it does. The advised option has an amber
  edge and an "Advised" chip, and a promise carries an "A promise" chip. Your pick turns cyan and shows its effect.
- **A hearing question you have answered goes quiet,** so the ones still open stand out.
- **Decisions carry an icon for their kind:** money, people, production, security or paperwork.

## 19.3.3: clearer screens, part four

- **What you just did stays in view.** After each action the status bar shows "Done" (or "Not done" and why), with the
  cost, for about nine seconds, and a link to the log. The note beside the pointer still appears as before.
- **Icons on the advice.** Each suggestion carries a small drawn icon for its kind: money, power, people, housing,
  research, threats, logistics, security or production. The words still say the same thing.
- **The term report's moments are a timeline:** a line down the left, a marker in each moment's colour with an icon
  for its kind, and the date above each entry.

## 19.3.2: clearer screens, part three

- **The map reads from the important sites down.** Arsenals are full size with a bronze ring. Plants, depots and bases
  are a step smaller, and mines, wells, ranges and ports smaller still. A site you select or point at shows at full
  size.
- **A clear next step on Home.** The advisor's top move is a featured card with an amber edge, its reason and its
  button. The next three moves follow as a short list, with more on request. "Show" is now a light link, so the only
  button is the one that acts. The advice no longer repeats the decisions button.
- **Production inputs at a glance.** Each line lists its parts in a grid, with the days of stock at the plant, shortest
  first, and a ✓, ! or ✕ beside the colour.

## 19.3.1: clearer screens, part two

- **Money reads the same everywhere:** "$128K" and "$12.8M", not "$0.1280M". This covers prices in the panels, offers,
  the broker, export orders and contract awards.
- **Contracts are a table,** with item and supplier, per day, price, how far under the list price (with an arrow) and
  the month it ends, all in aligned columns.
- **The Board marks its advice clearly.** The advised option has an amber edge and an "Advised" chip.
- **Buttons that spend money name the spend.** Research buttons are amber and read "Research · $70M · 3 mo", and say
  how much more you need when you can't afford one.
- **The new-game screen:**
  - the Begin button stays in view at the foot of the screen, with a one-line summary of your choices;
  - locked postings are dashed and carry a lock;
  - the six modes sit in a tidy three-by-two grid.
- **The end-of-term report puts the decision first.** The Committee's letter and your legacy choice come before the
  history. The term's moments show the first five, with "Show all", and achievements you have not earned fold away.

## 19.3.0: the world fills the screen

- **The map is the world, edge to edge,** as in the grand strategy games. The framed map sheet, its corner brackets
  and the rulers are gone. The country fills the screen behind the bars and panels, and the world fades into fog at
  its edges, with no hard border.
- **Panels that read more easily:**
  - text is a step larger, and dim text is brighter;
  - section headings are bronze, with a rule line;
  - the panel casts a shadow over the map, and long panels fade at the bottom to show they scroll.
- **Home puts what to do first.** "Needs you now" now comes straight after the key numbers, ahead of the Committee's
  mandate. The key numbers are larger, and their monthly changes carry ▲ ▼ arrows as well as colour.
- **You can't miss a paused clock.** While time is stopped, the play button glows and pulses, and the clock reads
  "Paused · Space to run". With reduced motion on, the glow stays still.
- **Charts are shaded** under their main line.
- **The tab row always fits.** All six panel groups fit even when several carry a count, so "Rival" is no longer cut
  off.

## 19.2.0: Career

- **Career mode.** Serve term after term in one country, with the plants, people and reserve you built. A career lasts
  until you are dismissed, the Committee declines to reappoint you after a failing term, or you retire.
- **The Committee's letter.** At the end of each term it tells you:
  - whether you are reappointed;
  - your rank and the grade next term that would reach the next one;
  - what opens next;
  - the work you would leave unfinished.

  Then you serve on, or retire with honour.
- **Ranks and unlocks.** Six ranks, from Acting Director to Architect of the Arsenal. Postings open as your career
  record grows: War footing, postings abroad in a new country, Sanctions, Rebuild and Hard. Prefer not to wait? Open
  them all; ranks are still awarded.
- **A career record** in this browser, listing every career you have served.
- **A sounder late game, for every mode:**
  - when you are reappointed, the new budget covers the industry you hand on;
  - the chief of staff saves a supplier that is the country's only home source of a part, feeds the lines that are
    starving first, and opens a new line only when it can be supplied;
  - the readiness mark never rises above 100%.

  On autopilot, careers now reach a third term about 6 times in 10, up from almost never, and most single-term
  scenarios score higher.
## 19.1.1: the map fits smaller windows

- **The game now fits windows down to 1100 pixels wide,** down from 1280. On a narrower window the map still fills the
  screen, with nothing cut off at the edge.
- **Room for the map on narrower screens:** below 1200 pixels the season readout steps out of the top bar (the
  weather layer and the alerts still show it), and below 1280 the map's layer bar drops its two headings.

## 19.1.0: the home front

Cyber, spies, unions, towns and the audit now work as one system. Every town has a level of **discontent**, made up of
how strong its union is and how much its people resent you, and it reaches into everything.

- **Unrest reaches your security.** Spies find recruits, and insiders open the door to ransomware, where the towns are
  discontented. A calm town makes its plants a little safer.
- **Towns and unions move together.**
  - A resentful town hardens its union and sends fewer people to your lines.
  - Settled claims and community funds calm a town. Refusals, strikes, mothballing and deep vetting stir it up.
  - A damning audit angers the unions ("money for waste, none for us"). Prosecuting a fraudulent supplier frightens its
    town.
- **Fewer, more meaningful knobs.**
  - One national cyber defence level covers plants, rail and suppliers.
  - One recovery plan replaces backups and drills.
  - The open day is gone; the community fund also cools a town's union now.
  - Your intelligence service also catches spies at home.
- **One card per town.** The Towns tab shows each town's discontent, work, mood and union together. The Intel tab has
  a single Home security section.
- **The chief of staff plays it too.** It funds restless towns sooner, keeps the cyber level and recovery plan, and
  grows a small intelligence service to hunt spies.

## 19.0.4: a smarter chief of staff

- **The chief of staff plans the supply chain.** It watches the whole chain for the parts the country cannot make
  enough of, chips and seekers as well as finished rounds, and puts money into the home plants that make them before
  the lines that need them run dry. It invests at home even when a foreign supplier is the bigger source, since a
  foreign supplier can be banned.
- **Fewer lost games on autopilot.**
  - On a generated country, 2 games in 40 now end in dismissal instead of 8, and scores rise by about 10 points.
  - War footing and Rebuild score about 5 points higher.

## 19.0.3: the Committee's warning

- **Probation before dismissal.** The first time in a term that the Committee's confidence falls to 25, you are put on
  probation instead of drifting to dismissal. The Committee sets a readiness target and gives you six months to reach
  it, and holds its judgment while you work. Reach the target and probation ends; miss it and you are dismissed. After
  that, the old rule applies for the rest of the term.
- **Home shows the target.** A probation card shows the target, where readiness stands and how many months are left.
- **The chief of staff fights for the job.** On probation it spends its reserve, courts your allies, and arranges
  co-production for the scarcest rounds.

## 19.0.2: Depth, part three, every scenario plays its own way

- **War footing: a front and air surges.**
  - The front in the Marches moves with the artillery its guns and depot hold.
  - Let it fall back, and the fighting there grows heavier, the Committee loses patience, and the plants behind the
    line are disrupted. Keep it stocked, and it advances.
  - Every four months, a two-week surge of raids hits whichever region has the thinnest air defences.
  - Home shows where the front stands.
- **Sanctions: the bans come off one nation at a time.** A nation lifts its export ban once relations reach 60, so
  trade missions are now how you end the embargo. In the meantime a broker offers rounds round the bans, at 80% over
  the list price, with a chance the Committee hears of it.
- **Rebuild: worn-out plants.**
  - Your plants start run down, and a plant below 50% condition wears fast.
  - **Refurbish** it as before, or **replace** it: it closes for about six weeks, then comes back with 10% more output,
    built to last.
- **Peacetime: the budget round.** Each fiscal year the Committee funds one of three budgets, each with its own terms:
  - the hawks' budget gives more money, and fuller racks are expected;
  - the Treasury's gives less money, and value for money counts for more;
  - the regions' makes jobs count for more.
- **The chief of staff** answers the broker and the budget round, sends trade missions to banned nations, and
  refurbishes or replaces worn plants.

## 19.0.1: Depth, part two, every country is different

A generated country now has a character of its own: two or three features, drawn from its seed, that change how you
run it.

- **A chokepoint.** One plant makes all of a part every arsenal needs, such as rocket motors or magnets. The map marks
  it **CP**, and sabotage there does double damage.
- **Foreign reliance**, on most maps. Your own plants make only 40% of your radar seekers or rocket motors, and foreign
  makers supply the rest. The Committee now also judges your supply independence.
- **A long or a short coast.**
  - On a long coast, more raids come in from the sea, and your sea lanes carry more.
  - On a short coast, the threat shifts inland, and your sea lanes carry less.
- **You see them before you start.** The new-game screen lists the country's features, and a country brief opens the
  game.
- **Unchanged:** the classic Commonwealth of Aldmere, the story and the tutorial. A saved game keeps the country it was
  made with.

## 19.0.0: Depth, part one, the adaptive rival

The Vardan Directorate now studies you. It no longer follows a fixed order: it develops the weapon your stockpile is
least ready for.

- **It watches your reserves.** Each month the rival reads how full each line is against its target. It smooths the
  reading over months, so a last-minute top-up does not fool it.
- **It aims at your weak spots.** When intel reports, the rival picks the development that hits your thinnest lines
  hardest. It also leans towards weapons that exploit the doctrine you chose, and is half as keen on any you already
  hold the counter to.
- **Intel tells you why.** The report and the Intel panel name the lines it is aiming at, for example "your
  Interceptor missiles at 42% of target".
- **Hard bites harder.** The rival's weapons hit at 125% strength on Hard.
- **Scenario tuning.**
  - War footing and Rebuild get a rival that aims at half strength.
  - Rebuild's first intel report comes four months later.
  - In Rebuild, the Committee judges leaks and land shortfalls more leniently.
- **Unchanged:** the tutorial keeps its scripted rival. Old saves load as before.

## 18.3.0: the map fills the window

The map is now the whole screen, in the tradition of the grand strategy games, with the command bar, the status bar
and the panels floating over it.

- **A full-window map.** The country runs to the edges of the window. The command bar, the status bar, the map's
  layer bar and the panels are plates over it.
- **The map keeps clear of them.** It fits itself, and places its rulers, title, zoom buttons, minimap and scale, in
  the part of the window the overlays leave free. You can pan any corner of the country into view.
- **Fold the panels away.** Press P, or use the tab on the panels' edge, and the map takes the room. The game
  remembers your choice. **Press F** for the map alone, without the layer bar or the outliner; press it again for
  everything back.
- **Your selection stays in sight.** If the site you have selected would end up under the panels when they open, the
  map glides to bring it back into view.
- **The map key** opens from a Key button on the layer bar, and the strip of recent events along the bottom is gone:
  the Log has every line.

## 18.2.0: port baseline, part three

The last of the groundwork before the Unreal port: a faster simulation late in long games, a warning before saves
fill the browser, and the rules for the game's world written down and tested. Nothing changes in play: the golden
masters are exactly as they were.

- **Long games stay fast.** Each day used to copy the whole history of the game. Now past months, the log, the
  Courier and the term's moments are shared from one day to the next, and only the live state is copied. A day in year
  6 now takes about 1.2 ms (was 2.2), and in year 15 about 0.6 ms (was 2.4). The cost no longer grows with the length
  of the game.
- **Supply is worked out once a day.** Contracts and depot draws are no longer recomputed for every comparison while
  shipments are chosen.
- **A warning before saves run out of room.** When this game's saves pass about three million characters of the
  browser's storage, saving says so, and suggests deleting old saves or exporting them to files.
- **The world-state contract** is written down (`docs/port/determinism.md`) and tested. A classic game and a
  generated country played turn about each end exactly as they do alone. The Unreal version will make the world an
  explicit object instead of shared tables.

## 18.1.0: port baseline, part two

The game's tables and core tuning now live in data files instead of in the code. Nothing changes in play: the golden
masters, every month and every final state, are exactly as they were.

- **Tables as data (`src/sim/data/`).** Materials, recipes, sites, cities, regions, routes, links you can build,
  transport modes, line rates and threats. These become the Unreal DataTables.
- **Core tuning as data (`src/sim/tuning/core.json`).** Wages, the premium for buying without a contract, stock
  buffers, the output cap, the demilitarization rate, difficulty (events, crises, ramp-up, starting money), each
  base's minimum rounds, reserve days, the stockpile law and the grace given to new lines. It sits beside the mandate's
  tuning.
- **A check on the data.** Since the tables are no longer TypeScript, a test checks every key and reference in them:
  recipes use only known materials, sites run only known recipes, routes join only known sites, and threats are
  answered only by rounds that exist.

## 18.0.0: port baseline, part one

The groundwork for rebuilding Forge Command in Unreal Engine. Nothing changes in play; this release makes sure that
stays true, and writes down what the new version must reproduce.

- **Golden masters.** Eight fixed games covering peacetime, Hard, War footing, Sanctions, a generated country, the
  story, an endless sandbox and an empty desk. Each is played for two years, and every month's figures and the final
  state are recorded. They run with the tests, and every later change to the code must leave them as they are. The
  Unreal version is checked against the same records.
- **Versioned saves.** Every save now carries a schema number. Loading fills in anything a save lacks, from any
  earlier version, and repairs a damaged one. Numbered steps convert older saves when the format changes. Saves made
  before this release load as before.
- **The port contract (`docs/port/`):**
  - the random numbers, rounding and order of play the new version must match;
  - the golden masters and their tolerances;
  - the save format;
  - where every table and tuning value lives, and what each becomes in Unreal.

  The design document opens with what changed since 15.0.

## 17.2.0: Industrial Command II

The art and sound pass from the art and audio directors' review: the look finished, the map dressed, and a sound that
belongs to a forge.

### Look
- **Plated site counters.** Every site on the map is a little steel piece now: a shadow beneath, a face lit from
  above, the owner's rim and a bevel inside it.
- **A framed map.** A bronze double neatline with brackets at the corners and a bronze north arrow, in place of the
  cyan box. The map's title card, minimap, readouts, hover cards, menus and the "why" popovers are all small plates
  with a bronze top edge, and the zoom buttons have proper icons.
- **Colours keep to their roles.** Amber is command: titles, the advisor, the tutorial and field notes, the selection
  on the map. Cyan is state. Regions have muted hues of their own instead of the status colours, and the story's
  characters sit in a bronze hexagon like the Board's insignia.
- **Site names** are set in the reading face, easier to read at map size; the monospace is kept for rulers and
  coordinates.
- **One shape language.** Corners are 2–3px everywhere, count badges are square, every progress bar is the same bar,
  every dialog heading is the same size and style, and tooltips are in the reading face with a bronze edge.

### Sound
- **An industrial palette.** Struck bronze for news, a relay click for every control, a teleprinter for decisions and
  spies, low brass when the rival fields a weapon, and a klaxon only when a crisis begins.
- **Music that does not loop.** Chords wander, each mood has several phrases, the music breathes now and then, and the
  distant roar of furnaces and a drop forge across the valley sit underneath. A short cue marks every change of mood,
  and the new mood starts at once. The tension pulse is now audible on laptop speakers.
- **A proper mix.** One mixer for everything, with a master volume and a compressor; the music steps back under
  anything important.
- **Music is on by default** for new players, at 35%.
- **The silent moments have sounds:** a crisis starting and ending, a budget refused or granted, a promise kept or
  broken, a build finished, going into debt.
- **Settings, Sound:** a master volume, and "Quieter at 4× and 8×", which leaves routine news to the log.

### For the port
- **`docs/art-bible.md`**: the palette and its roles, type, materials, iconography, motion, sound and the asset list
  for the Unreal version.

## 17.1.0: command clarity

The game now tells you what needs you in one place, answers every action where you clicked, and keeps the map still.

### Know what needs you
- **Alerts.** A row of icons in the new status bar, one for each tab where something needs fixing, red or amber, with
  every item in its tooltip. They clear themselves once the problem is dealt with. Press `.` to step through them.
- **One status bar under the command bar** holds one notice at a time, the most important first: the save box, a save
  that failed, the pause and what caused it, an achievement, then the Courier's headline. It never moves the map.
- **The Log** brings the inbox and the feed together: decisions, alerts, bad news and notes, or "Everything" for the
  full record.

### See what is under way
- **The outliner** down the left of the map: the crisis, research, building and upgrade projects, plants being built
  or repaired, suppliers being qualified, intelligence operations and doctrines bedding in, each with the time left and
  a bar. Click one to go to it; fold it away to a heading.

### Feedback where you click
- **Every action answers beside the pointer**: what it did and what it cost (or brought in), or, in red, why it could
  not be done. Taking the safe advice sums its steps into one note.

### Tabs that make sense
- **Six groups:** Command (Home, Log, Board, Story, Sandbox, Guide), Production, Supply, People (Staff, Towns,
  Allies), Treasury (Money, Policy, Doctrine, Stats, Courier) and Rival. The Board moves to Command; Money and the
  Courier to Treasury.
- **Watch is part of Home:** the advisor, "Take the safe advice", "Why short?" and the three-month plan now sit under
  "Needs you now".
- **Keyboard:** Shift 1–6 opens a group, H goes Home, `.` jumps to the next alert.

### A tutorial that points
- **Each step rings the control it is about** (the pause button, then the tab, or its group until that is open), and
  the step text follows the new tabs. The tutorial and the field notes no longer stack: one coach at a time.

## 17.0.0: the Committee's mandate

A new way to win. Every term the Defence Committee sets a mandate: three or four goals that pull against each other,
weighted for the scenario you are playing. Full racks are still expected, but now you are judged on how you fill them.

### The mandate
- **Readiness, value for money, regional jobs, stewardship and the shield.** Peacetime weighs readiness 40%, value
  25%, jobs 20% and stewardship 15%. War footing puts the shield first after readiness; Sanctions and Rebuild weigh
  value, jobs and stewardship their own way, and expect less on the racks. Each goal is measured from your monthly
  reports. Overstock and spot buying now cost you on value, idle money and waste count on stewardship, and the cheapest
  supplier in the wrong region costs you on jobs.
- **It tightens every year.** At each fiscal year the bar on every goal rises a step (three at most), and a second term
  starts tighter.
- **Empty racks earn nothing.** Thrift and tidiness only count while readiness is near its target.

### Judged on it
- **On Home, the Committee's mandate card** shows this year's goals, the figure each is judged on, how well it is going,
  and your projected grade for the term (from the third month).
- **The grade** now weighs the mandate (55), the Committee's trust over the whole term (20: average confidence above
  50, not the last month's), the shield (15) and objectives (up to 5). The term report shows the mandate met and the
  average confidence.
- **Confidence follows the mandate,** not readiness alone, and gains slow as it nears the top. Empty racks still cost
  confidence on their own.
- **The budget moves less with confidence** (±8%, was ±15%), so a good start no longer snowballs and a bad one no
  longer spirals.

### Balance (5 seeds, four-year terms)
- **The autopilot no longer wins it for you:** on Normal it averages a C (65), down from an A (89), and is never
  dismissed; on Hard it drops to 38.
- **Doing nothing earns a D at best** on Easy (it used to score 77).
- **Every scenario is now winnable:** the autopilot survives War footing, Rebuild and Sanctions at least four times in
  five (it used to be dismissed in two of five).
- The full rules, every number and the balance results are in `docs/mandate.md`; every tuning value is in
  `src/sim/tuning/mandate.json`.

## 16.1.0: fix and stabilise

The first release from the studio-wide review: the bugs and traps it found, fixed before the bigger work begins.

### Fixed
- **A long endless sandbox no longer crashes for good.** Once every private mine, quarry and well had closed (around
  year 20), the monthly events crashed on every tick, and reloading crashed again. Accidents and quality escapes now
  simply do not happen when there is no site left for them; the same guard covers allies' requests and export offers.
- **"Take the safe advice" is now safe.** It used to leave the budget hearing and the Board's cards to their defaults
  and run up monthly bills, so a player who followed it on Normal was dismissed in three games of five, and in debt.
  It is now what your chief of staff would do right now in every area, within a $300M reserve. In balance runs a
  player who takes it each week finishes every Normal term (score 86, up from 41) and four Hard terms in five.
- **Endless sandboxes keep their yearly budget hearing** past year 100.
- **The tutorial** now says what the job is and how it is lost, starts the clock with the new pause button and speed
  bars (it still told you to press "1×"), and ends on Home, where "Needs you now" lives.
- **Malformed actions are turned down**: unknown shift patterns, contract lengths and programme lengths, sandbox money
  that is not a number, and a story briefing with no story. These could only come from an edited save or a script.

### Smoother
- **Home no longer re-runs the advisor on every redraw.** Its advice, plan and changes are worked out once a second,
  which was about half of the game screen's work on each tick.
- **Fewer interruptions.** "Everything else" no longer pauses the clock by default, and the pause banner says how many
  other events arrived at the same moment, with a link to the inbox.
- **Sound that keeps up with the clock.** The month chime plays at most every twenty seconds, events have a cooldown,
  and a lesser sound never cuts across a weightier one. Buttons tick quietly, pausing and resuming have a tape-stop
  sound, and changing speed ratchets.

## 16.0.0: Industrial Command

A new look, in the tradition of the great strategy games: steel, bronze and amber, a command bar across the top, and
key art on the title screen. Forge Command is now made for desktop and laptop screens.

### A new look
- **Typography.** Barlow Condensed for headings, buttons and tabs, and Inter for reading, in place of the
  all-monospace text. Numbers line up in columns.
- **Steel plates.** Every panel is a lit steel plate with a bevel and bronze corner brackets, under a heading plate
  with an amber mark. Command buttons are gilded, toggles light up cyan, and a fine grain sits under it all.
- **The command bar.** The Board's insignia and your country's name, then treasury, readiness, confidence and the
  season as readouts with icons. On the right, a clock plate holds the date, a round pause button, four speed pips
  and the day and week steps.
- **Tabs** are plates with an amber underline, and the map sits in a recessed bezel.
- **Title screen key art:** an industrial skyline at dusk, with saw-tooth halls, stacks trailing smoke, cranes,
  warning beacons and a launcher, lit by the forge. The Board's insignia sits over the title.

### Desktop only
- **The game is built for screens at least 1280 pixels wide.** It always fills the window exactly. On a smaller
  window it scrolls sideways, and the title screen says so.
- **One finger pans the map again** on a touchscreen laptop: the game screen no longer scrolls, so the map has
  nothing to share the gesture with.

## 15.3.0: finish

A second pass on the details that make the game feel made rather than assembled.

- **Tooltips in the game's own style,** in place of the browser's yellow box, everywhere a control explains itself.
- **Checkboxes, radio buttons, sliders and drop-downs** are drawn in the game's colours instead of the browser's.
- **Dialogs** fade in and rise into place, with an amber top edge, and Settings has a close button.
- **The map's layer bar** is split into two compact groups, Map and Networks. On a phone it scrolls sideways.
- **The event log** reads like a log: a date column and a coloured marker for good, bad and warning news.
- **Header readouts** are separated by hairlines, and panel headings carry an accent mark.

## 15.2.0: look and feel

The game now looks and handles like a finished product, from the first frame to the map.

### Title screen
- **A real main menu.** A forge glow, drifting embers and faint contour lines behind a menu with Continue, New game,
  Load, Records and Settings. Each entry opens its own page, and Esc or Back returns.
- **New players** see "Play the tutorial" first. Everyone else sees Continue, with the game and its date.
- **Loading** shows a branded screen from the very first moment, before the game's code has arrived.

### In the game
- **The window is the game.** On a wide screen the layout fits the window exactly: no page scroll, and the map takes
  all the height that is left. The map key starts closed.
- **A cleaner top bar.** Joined speed, step and game controls with icons, and readiness and confidence glow green or
  red for a moment when they move.
- **Panels ease in** when you change tabs, notices slide into place, and buttons press down under the pointer.
- **Themed scrollbars, focus rings and text selection** throughout.
- **On a phone,** one finger scrolls the page past the map, and two fingers move it.

### Under the hood
- **Fonts ship with the game.** Nothing is fetched from Google any more, so "no tracking" holds completely, and the
  fonts work offline.

## 15.1.0: ready for players

A release about polish, not new systems: a smoother first visit, a game that plays properly on a phone, and saves
that cannot be lost by accident.

### A better first visit
- **New players are pointed at the tutorial.** On a first visit the title screen opens on the tutorial, with a short
  note and a way to skip straight to a campaign.
- **Version, privacy and feedback** at the foot of the title screen: no account and no tracking, games saved in this
  browser only, and a link to report a problem.
- **A finished term can be reopened** from the title screen, so its report and the offer of a second term are never
  lost to a reload.
- **The Continue button names the game** it continues: story, tutorial, two-player game, sandbox or campaign.

### Phones and small screens
- **A compact top bar:** the season and the sound and music switches (also in Settings) step aside on a phone, so
  the map starts much higher up the screen.
- **The map fits the screen:** its frame is sized to the country, and the map key folds away on narrow screens.
- **No text is cut off at the map's edge:** site labels, sea and upland names and foreign suppliers stay on the
  sheet, the zoom buttons sit in a row clear of the country, and the scale bar is shorter.
- **Bigger touch targets:** every button and tab is at least 44 pixels tall on a touch screen.

### Saves you can trust
- **Saved the moment you start, and whenever the page is hidden or closed,** not only at the end of each month: a
  decision made mid-month is no longer lost to a closed tab or a phone that drops the page.
- **A warning when the browser will not save,** with a button to download the game as a file.
- **Long games stay small:** months more than two years back are stored rounded, and the per-plant detail of months
  more than ten years back is dropped.
- **A failed named save no longer leaves an invisible file** taking up space.
- **If a tab breaks,** the rest of the game keeps running, with a way back to Home. If the whole screen breaks, the
  game is saved as it stood a moment before.
- **The offline copy** of the game is only ever replaced by a good page.

### Fixes
- **Story mode:** a director dismissed on the last day of a chapter no longer gets a briefing that cannot be closed.
- **The watch list** no longer reports the open building plots as "closed" from the first day.
- **Number boxes** no longer accept an infinite quantity.

### Faster and kinder to batteries
- **The game screen and rarely opened tabs load when needed,** so the title screen appears sooner: the largest
  file is now about 310 kB, down from 620 kB.
- **The map no longer redraws every marker and label on every tick,** and pinch or wheel zooming reuses its
  spacing instead of working it out again on every frame.
- **The map's moving lines stop while the clock is stopped,** and panels no longer use a background blur.

### Accessibility
- **Dialogs** (hearings, briefings, the term report, handovers and Settings) take the focus when they open, keep Tab
  inside, and hand the focus back when they close; the game behind them is set aside for screen readers.
- **Announcements:** what paused the clock, a crisis and achievements are read out by screen readers.
- **The pause button has a name** for screen readers, and the map's zoom readout is easier to read.

## 15.0.0: doctrine, the people who run your plants, and a legacy

### Doctrine
- **Five forks** in how you run the industry, on the new Doctrine tab (under People). Each has two answers, and the one
  you choose closes the other for good:
  - **Production:** mass production or precision first.
  - **Supply:** home-grown supply or allied supply chains.
  - **Workforce:** lights-out factories or master craftsmen.
  - **Reserves:** deep reserves or lean logistics.
  - **The rival:** visible deterrence or a shadow war.
- **Each answer changes real numbers:** output and scrap by kind of round, part prices at home and abroad, export
  bans, automation costs, morale and accidents, shelf life, freight, the rival's attacks and your operations' odds. The
  Committee's factions and the allies react every month.
- **Tiers:** settle one doctrine to open the second tier, and two to open the third. Each takes money and a few months
  to bed in, one at a time.
- **Every game builds a different industry.** The term report names the one you built.
- **Your chief of staff** settles forks the way your stance leans. The advisor tells you when one is open.

### The people who run things
- **A named manager at every plant,** with a trait:
  - Driver, Safety first, Popular, Meticulous, Mentor or Corner-cutter;
  - each shapes the plant's output, accidents, morale, scrap or skill.
- **Promote them** to strengthen the trait and win their loyalty, or **replace them** from a list of candidates that
  changes every quarter.
- **Restless, experienced managers get offers** from private firms: match the offer, promote them, or let them go.
- **Every town's union has a leader:** a firebrand (more claims, strikes that spread), a pragmatist (open to a
  counter-offer) or a moderate (a union that slowly cools). Leaders change at union elections.
- **Where to find them:** managers on the Staff tab, the Site tab and the map's hover card; leaders on the Towns tab.

### A richer endgame
- **Your legacy:** the term report gives you a title for how you served, such as The Builder, The Spymaster, The
  Quartermaster, The Workers' Director or The Survivor. It also names the industry you built and your best manager.
- **The moments that defined the term:** crises, new rival weapons, doctrines, kept and broken promises, operations,
  strikes and more, in order.
- **What carries into the next term:**
  - a legacy you choose from up to three you earned: the Committee's trust, a loyal workforce, friends abroad, a full
    arsenal, a school of engineers, deep cover, or a fresh start;
  - the grudges you made: broken promises cool the Committee, and exposed operations bring the rival on sooner.

## 14.0.0: a game that is easier to find your way around

### Grouped tabs
- **Six groups** replace the row of 25 tabs: Home, Production, Supply, People, Rival and Records, each with its own tabs.
- **Badges** on each group and tab count what needs you there: decision cards, unread mail, and the watch list's
  items, placed on the tab where each fix lives. Red means something is going badly.
- **Each group remembers** the tab you last used in it.

### Home
- **The key numbers:** readiness, treasury and confidence, with their change this month and a trend line for the
  last year.
- **Needs you now:** the advisor's top three suggestions, each with a "Do it" or "Show me" button, plus your decisions
  and your inbox.
- **Rounds against the one-year goal,** worst first; click one to trace it.
- **Since you last looked:** the change in money, readiness, confidence and the rounds that moved most, and the
  important events by kind, each a button to the tab that handles them.
- **Coming up:** the advisor's plan for the next three months.

### Search and commands
- **Ctrl K, Cmd K, / or the Search button** opens a search box. Type to jump to any tab, site, material or town.
- **Commands:**
  - pause, the speeds, or a week ahead;
  - take the safe advice, or hire engineers to the need;
  - save, open settings, the pause rules or the keyboard shortcuts;
  - turn music or sounds on and off, or go back to the main menu.

### The inbox
- **One list,** newest first: decision cards, alerts, bad news and field notes. Unread items are marked, and Home's
  group shows how many.
- **Filters** for decisions, alerts, bad news and notes, and **Mark all read**. Leaving the inbox marks it read.
- **Click any item** to go to the site or the tab that deals with it.

### The map
- **Hover cards:** rest the pointer on any site to see what it is, how it is doing, what its lines make each day and
  what limits them, and its crew's morale and fatigue.
- **Quick actions:** right-click, long-press or press the menu key on a site to inspect it, trace what it makes, or:
  - at your plants: expand or restart a line, vet the staff, or fit backup generators;
  - at suppliers: qualify them or invest in them.
- **Supply chains:** the selected site is linked to its suppliers (amber) and its customers (cyan).

### Pause rules and Settings
- **Choose what pauses the clock,** by kind of event:
  - decisions and hearings, crises, the rival;
  - spies, hackers and sabotage; strikes and towns; power;
  - accidents and disruptions, money and the Committee;
  - good news, and everything else.
- **Pause at the end of every month** is also an option.
- **Good news** no longer pauses the clock by default.
- **One Settings dialog** gathers the pause rules, field notes, sound, display and the keyboard shortcuts. Press
  Settings or "?".

## 13.0.0: engineers, operations against the rival, music that follows the game, and field notes

### Engineers and academies
- **A scarce resource:** plant lines, automation, new plants, in-house lines, research and design all need engineers.
  The Staff tab shows how many each part of the work needs against how many you have.
- **Short-handed:** plants lose up to 15% of their output, and research and design slow to as little as a third of
  their pace.
- **The market:** you hire from a national pool that private firms also drain, for a signing fee. The engineers you
  inherit are paid from the Board's budget; you pay a salary for each one beyond them.
- **Leavers:** some engineers always leave. More go when they are overworked or on standard pay; a 30% premium keeps
  more of them.
- **Academies:** found one in a plant town. It opens after about eighteen months and adds graduates to the market every
  month. The town is grateful.
- **Your chief of staff** hires to the need and founds an academy when the market runs dry.

### Operations against the rival
- **Three operations** on the Intel tab:
  - **Steal their plans:** early warning of the rival's next weapon, and a head start on the counter you are
    researching.
  - **Sabotage a weapons programme:** its next weapon comes about two and a half months late.
  - **Disrupt their supply:** fewer attacks of every kind for four months.
- **Risk:** each takes months and may fail. An exposed operation costs confidence and the allies' goodwill, and the
  rival hurries its own work.
- **Your service:** grow it from a small desk to a formidable service for better odds and less risk. Every success
  puts the rival more on guard, which fades over time.
- **The advisor** suggests an operation when your service is idle, but never counts one as safe advice.

### Sound and music
- **Music that follows the game:** calm, uneasy when a crisis is coming, tense with a heartbeat during one, stately at
  a hearing, triumphant or sombre at the end of a term. Each mood has its own chords, melody and pace.
- **A sound for each kind of event:** strikes and protests, blackouts, hackers, spies, the rival fielding a weapon,
  operations, finished research and building, and a knock for a new decision.
- **Volume sliders** for music and sounds in the "?" dialog. Music and sounds go quiet while the tab is hidden.

### New-player onboarding
- **Tutorial:** two new steps, for your engineers on the Staff tab and the towns around you, and the advisor's "Why
  short?" in the last step.
- **Field notes:** a short tip the first time each system shows up in a game: the budget hearing, union claims,
  strikes, blackouts, the Auditor-General, hackers, permit objections, spies, failed test firings, export bans, a
  coming crisis, an engineer shortage, the rival's first weapon and your first operation. Each has a "Show me" button
  to the tab that handles it.
- **On or off:** "No more tips" on any card, or the Field notes switch on the new-game screen.

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
