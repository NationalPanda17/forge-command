# Design pass: findings and plan (Phases 1–3)

**Status:** for review. Nothing below has been built yet.

**Assumptions** (no questions were needed to plan):
- The target player is a strategy or management fan on a desktop browser, as the game is built today.
- The simulation stays. Changes adjust its numbers, what the player sees first, and how it is taught, not its systems.
- "Fun" is judged in this genre's terms: pressure, trade-offs, clear cause and effect, and the satisfaction of a chain
  that works. Screen shake and hit-stop are an action-game vocabulary; their counterpart here is feedback on decisions.

**How this was judged** (Phase 1 was played and measured on 27 November 2026):
- I played a first session in the browser as a new player: the tutorial, the first in-game months at each speed, and
  the first pause.
- I measured pacing for a player who never acts: six seeds, a 48-month Peacetime term on Normal.
- I ran the balance harness on twelve seeds per scenario for three players: one who does nothing, one who takes the
  safe advice every month, and the chief of staff.
- I read the code for the scope: about 26 screens in 6 groups, 49 materials, 66 sites, 66 player actions, 19 kinds of
  Board decision, 18 sounds, 23 achievements, and about 21,000 lines.

---

## Phase 1: Audit

### What the game is

- **Core loop:** watch the reserve of each round against the Committee's goal, find the weakest link in its supply
  chain (a part, a plant, a contract, a rail link, a crew), and spend money, engineers or political capital to fix it
  before it breaks. Meanwhile, answer the Board's decisions and the yearly hearing.
- **Player fantasy:** the quiet competence of the person who keeps a nation supplied: "from the mine to the launcher."
  Its best moments are seeing a shortage coming months ahead and closing it in time.
- **What it is trying to be:** a real-time logistics and production sim (the production side of a grand-strategy game)
  with a political scorekeeper on top.

### The first 30 seconds

- **The first thing on screen is a 90-word paragraph.** It names readiness, the Committee, confidence, dismissal, the
  play button, the speed bars, tab badges and Ctrl K. Players skim walls of text, so most of that will not stick.
- **The opening is already won.** Readiness starts at 97% in the tutorial and Peacetime, against a goal of 100%. Nothing
  is broken, and nothing is urgent.
- **The map is handsome and readable.** The cyan arsenals, the moving shipments and the coast fog make a strong first
  impression. Four "?" markers sit on the map with no explanation.
- **The advisor's first move is abstract:** "Start Laser-guided rockets, $60M". It is research, not a problem the
  player can see.

### The first 5 minutes (about 10 game months at normal speed)

- **The tutorial is a tour of tabs.** Each step says "open X". When the player opens it, the panel they just opened is
  dimmed behind the next instruction, so they never get to read what they were sent to see. The tutorial teaches where
  things are, not why they matter.
- **Doing nothing is rewarded.** In my session, by day 70 readiness was 98%, confidence had risen from 60 to 72, and
  the treasury had grown from $1.14B to $1.42B, all with no input from me.
- **Measured, for a player who never acts:**
  - readiness stays above 90% until month 8 to 17 (about month 10 typically);
  - the first six months bring 0.22 Board decisions a month, about one in total;
  - the first event pause came in month 4: a flood at a foreign supplier.
- **The clock runs during the tutorial.** At 1 day a second, the first five minutes pass with little the player must
  do.

### The first hour

- **The game becomes genuinely good once things start breaking.** From months 12 to 36, a passive player sees two or
  three alerts and up to one decision a month. The chain thins, and the rival's new weapons change what is needed.
  This is where the game's depth shows: the plan's forecast, "Why short?", tenders, second sources and bailouts.
- **Inaction is punished, but about three years late.** On Normal, a player who never acts is dismissed in 12 of 12
  games, around month 35 (month 22 in War footing). They also end with the most unspent money, $1.5–3.2B. The game
  rewards doing nothing early and sends the bill some 17 real minutes later, far too late to teach the lesson.
- **Correction (made while starting C0): the safe advice does not lose games.** The first run said a player who takes
  it monthly is dismissed in 7 of 12 games on Normal. That harness never answered the Board or the hearing, so every
  hearing closed on its fallback answers. An attentive player who also answers each decision and hearing with the
  advised option is dismissed in 0 of 12, with a score of 58 (the chief of staff: 1 of 12, 63).
- **What is left is real but smaller: the advice can overspend slowly.** Each hire, expansion and house looks
  affordable on the day, but each adds to every month after. On seed 1, wages and running costs rose from $60M to
  $139M a month. From month 25 the recurring bill passed the $240M budget, and the treasury drained into debt by
  month 44. The $300M safety margin guards one-off costs only, and nothing in the game warns about the running
  deficit.

**The balance run** (12 seeds, 48-month terms, Normal unless noted):

| Scenario | Does nothing: dismissed · score | Safe advice monthly: dismissed · score · end treasury | Chief of staff: dismissed · score |
|---|---|---|---|
| Peacetime, Easy | 4/12 · 37 | 1/12 · 57 · $741M | 0/12 · 69 |
| Peacetime | 12/12 · 9 | 7/12 · 30 · $67M | 1/12 · 63 |
| Peacetime, Hard | 12/12 · 4 | 10/12 · 14 · −$24M | 2/12 · 46 |
| War footing | 12/12 · −4 | 8/12 · 17 · $230M | 0/12 · 56 |
| Rebuild | 12/12 · 2 | 7/12 · 25 · −$40M | 1/12 · 58 |
| Sanctions | 12/12 · 7 | 7/12 · 27 · −$136M | 1/12 · 54 |

*Caveat:* the "Safe advice monthly" column is from the first harness, which left hearings and decisions unanswered
(see the correction above). It overstates the advice's failures; the "Does nothing" and "Chief of staff" columns stand.

### Game feel and feedback

- **Strengths:**
  - every action gets a result: a note at the pointer and a "Done" in the status bar, with the cost;
  - buttons tick;
  - an achievement plays a fanfare;
  - the clock's sounds thin out at high speed;
  - there is generated music.
- **Weak spots:**
  - The big moments land quietly: a line starving, a plant reopening, a front collapsing, a promise kept. They are
    lines in the log and a ripple on the map, with no change in tone. Players remember peaks (the peak-end rule), and
    the game has few.
  - A fix to the chain pays off weeks later, so the cause and the effect are rarely seen together. The forecast exists,
    but nothing shows "this fix moved the 12-month curve by X" at the moment of the decision.

### Difficulty, pacing and onboarding

- **The curve is backwards at the start.** Easy and Normal open at full strength and decline. The best of the genre
  opens with a problem and lets the player build towards strength.
- **There is enough depth for 20 hours.** The scenarios, the generated countries, the rival and the career all add
  variety. But a newcomer has to sit through a quiet first year to find it.

### Progression and rewards

- **Within a term:**
  - the grade and the mandate's four bands;
  - the hearing every 12 months;
  - research;
  - doctrines;
  - managers who level up.
- **Across terms:**
  - the career, with ranks and unlocked postings;
  - legacies;
  - 23 achievements;
  - the record book.
- **This is a solid structure.** The weak point is the short term: within a single session there are few goals of
  minutes to an hour beyond the Committee's year-long target.

### UI and UX

- **The UI is much clearer after five UX rounds.** There is one card for every choice, a featured next step, money in
  one format, and a status bar for results.
- **It is still dense.** About 26 screens, 49 materials and jargon like "unit-eq", "intermediate" and "processed" put
  a high learning load on the player. The Materials list shows all 49 materials at once.
- **Accessibility:** text size, colour options, keyboard shortcuts for everything, and live regions for notices.
  Tooltips explain most numbers.

### Visual identity and audio

- **Visuals:** a coherent identity of dark navy, bronze and amber with an "operations room" look. The map and the
  arsenal markers are the strongest assets.
- **Audio:** functional, with no recurring motif tied to success or danger.

### Technical

- **No errors or failed loads.** I checked the dev build and the itch.io build.
- **The header ran off the right edge at every width.** It was fixed today in PR #50.
- **Desktop only, from 1100 pixels wide**, as intended. It runs smoothly at 8× speed.
- **Two small rough edges** from this session:
  - the tutorial's step advance lags behind the click by a moment;
  - the four "?" markers on the map are unexplained.

---

## Phase 2: Diagnosis

### Problems ranked by player impact

1. **A quiet, already-won opening.** Readiness is 97% with nothing broken, about one decision in the first six months,
   and confidence rises for doing nothing. Players form their view of a game in its first minutes, and there is no
   tension to hook them. *Principle:* a goal the player can see they are short of pulls them forward (the
   goal-gradient effect); a goal already met does not.
2. **A tutorial that tours rather than teaches, and hides its own answers.** Each step dims the panel the player was
   just sent to. *Principle:* people learn by doing with a purpose (Mini Metro and Factorio teach through the first
   problem, not through a menu tour).
3. **Feedback on inaction comes three years late.** Confidence climbs and money piles up without input, then the
   passive player is dismissed around month 35. *Principle:* a consequence teaches only when it is close to its
   cause; rewards that do not depend on the player's choices teach the player that choices do not matter.
4. **Payoffs land quietly and late.** There are few peaks, and causes are far from their effects. *Principles:* the
   peak-end rule, and tight feedback loops.
5. **Heavy learning load.** 49 materials, jargon, and 26 screens are shown at once rather than as they become
   relevant. *Principle:* progressive disclosure, a small working memory.
6. **Few short-term goals.** The Committee's target is a year long. *Principle:* nested goal loops (moment, session,
   term) keep players engaged at every timescale.
7. **A silent running deficit.** Running costs can outgrow the budget with no warning, whether the player or the advice
   did the spending. *Principle:* a slow, invisible decline feels unfair when it surfaces; a visible trend is a problem
   the player can solve.

### Strengths to protect

1. **The supply-chain simulation and its legibility tools:** the plan's forecast, "Why short?", and the materials
   trace from round to mine. This is the game's identity, and few games do it.
2. **The political layer:** the Committee, the hearing with promises that come due, Board decisions, and the
   mandate's four bands. It turns logistics into stakes and story.
3. **The look and the clarity work:** the full-screen map, the consistent cards, and feedback on every action.

### Weaknesses to fix

1. The opening: no problem and no tension, with inaction rewarded early and punished years later.
2. Onboarding: a tab tour that dims its own answers.
3. Missing peaks: the big moments in the chain go unmarked.

### Comparison with the genre

| Game | What it does better | What to borrow (not copy) |
|---|---|---|
| **Hearts of Iron IV** (production and logistics) | Production lines build efficiency over time, so keeping a line running feels like an investment; the supply map shows strain at a glance. | Make a running line's growing efficiency visible, and show strain on the map as one heat layer. |
| **Frostpunk** | Pressure from minute one; laws are irreversible trade-offs; a central gauge (hope and discontent) moves every day. | Open with a crisis; make the first Board decisions lasting forks; let confidence move with the player's choices, not drift up. |
| **Democracy 4** | A web of cause and effect you can hover; every policy shows who likes it and by how much. | On any decision, show its effect on the four mandate bands before the player commits. |
| **Factorio** | Teaches through the first problem; bottlenecks are physically visible; the satisfaction of a fixed chain is immediate. | Have the tutorial fix a real shortage; show the before and after of the chain on the map the moment a fix lands. |
| **Mini Metro** | Almost no text; teaches by doing; each week brings a small new goal. | Short, concrete goals every few minutes ("fill SM-6 to 6 months by June"). |

---

## Phase 3: Design plan

Effort: **S** is under an hour, **M** is a few hours, **L** is a day or more.

### Tier 1: quick wins (under an hour each)

| # | Problem | Change | Expected impact | Effort |
|---|---|---|---|---|
| Q1 | The tutorial dims the panel it just sent the player to. | Leave the panel lit and move the instruction above it; the step advances when the player has looked (a short delay or a "Next" button), not on the click. | Players can read what each step shows; fewer "what was that?" moments. | S |
| Q2 | The first screen is a 90-word paragraph. | Split it into three short lines: the goal (a year of every round in reserve), the threat (confidence at zero ends the term), and the one action (press Space). The rest moves to later steps. | The opening instruction is read, not skimmed. | S |
| Q3 | Four unexplained "?" markers on the map. | Give them a tooltip and a key entry, or hide them until they matter. | Removes a moment of confusion in the first 30 seconds. | S |
| Q4 | The clock runs at full speed during the first tutorial steps. | Hold the clock until the player presses Space for the first time after step 1 (it already pauses on events). | The first steps are read without time passing. | S |
| Q5 | The advisor's first move is abstract research. | In the first month, rank the most concrete move first: one the map can show (a contract ending, a short part). | The first suggestion connects to something visible. | S |

### Tier 2: core improvements (a few hours each)

| # | Problem | Change | Expected impact | Effort |
|---|---|---|---|---|
| C0 | Running costs can outgrow the budget unseen; the advice and the chief of staff keep adding to them. | Measure the running gap (recurring costs against regular income). Keep a year of any gap in hand before new spending, in both the safe advice and the chief of staff. Warn on Home when the treasury would run out within 18 months. | No silent slide into debt; a slow problem becomes a visible one. | M |
| C1 | The opening is already won. | Open Peacetime and the tutorial short: a reserve of about 80–85% (older lots, some unserviceable), so the first goal is concrete. War footing and Rebuild already open under pressure. | A visible gap to close from minute one (the goal-gradient effect). | M |
| C2 | Nothing happens for months. | An opening incident in month 1 or 2, chosen by seed from the existing events (a supplier failure, a strike, a contract lapse), with the advisor pointing at it. | The first five minutes contain a real problem and a real fix. | M |
| C3 | Confidence rises for doing nothing. | Confidence rises with progress the player made (reserve gained against the goal, promises kept, decisions taken) and holds steady otherwise. | Choices matter from the start; passive play no longer drifts upward. | M |
| C4 | Short-term goals are missing. | Monthly or quarterly Committee "asks" built from the existing objectives: one concrete target with a deadline and a small reward. | A goal every few minutes; nested goal loops. | M |
| C5 | Big moments land quietly. | A small "moment" treatment for peaks: a line back to full, a shortage closed, a promise kept, a front gained. Use a distinct sound, a brief banner in the status bar, and a pulse on the site. | More peaks, so the run is remembered better (the peak-end rule). | M |
| C6 | Causes are far from effects. | On a decision or advice card, show the forecast effect ("SM-6 at 12 months: 64% → 81%") before the player commits. | Players see why a choice matters at the moment they make it. | M |
| C7 | The tutorial tours tabs. | Rebuild it around the opening incident from C2: see the shortage, trace it, fix it with a tender, watch the forecast recover. It keeps 6 steps, all with a purpose. | Teaches the core loop by doing it once. | L (after C2) |

### Tier 3: big bets

| # | Problem | Change | Expected impact | Effort |
|---|---|---|---|---|
| B1 | A line that runs well earns nothing beyond its output. | Line efficiency that grows while a line runs and drops when it stops or changes (as in Hearts of Iron). | Gives continuity a value, and gives retooling a real cost. | L |
| B2 | Heavy learning load. | Progressive disclosure: start with 3 rounds and their chains, and unlock more rounds as the term goes on (or in the tutorial only). | A gentler first hour, and depth revealed when the player is ready. | L |
| B3 | Strain is spread across many panels. | One "strain" map layer: each site and link coloured by how close it is to failing in the next 90 days. | The weakest link is visible at a glance on the map, the game's best asset. | L |
| B4 | Peaks lack a sound identity. | A short audio motif for success and one for danger, woven into the generated music. | The game's moments get a recognisable voice. | M–L |

### Balance proposals

The genre's levers are reserve, money, timing and confidence, not damage and spawn rates. These numbers are starting
points to test on 40 or more seeds, since balance runs are noisy.

| Knob | Now | Proposed | Why |
|---|---|---|---|
| Opening reserve, Peacetime and tutorial | about 97% readiness | 80–85% | A concrete gap on day one; the year's goal becomes a climb, not a hold. |
| First incident | about month 4 (first event pause in my session) | month 1–2, guaranteed | The first five minutes at normal speed contain a problem. |
| Board decisions, first 6 months | 0.22 a month | about 1 a month | Choices from the start; matches the 0.5–1 a month later in the term. |
| Confidence drift with no player progress | rises (60 → 72 by day 70) | about 0 | Rewards follow choices. |
| Safe advice, monthly, for an attentive player (Peacetime Normal, 12 seeds) | 0/12 dismissed · score 58 · treasury below $0 in 3/12 | keep the score; treasury below $0 in as few games as possible | The advice already plays well; the fix is the running deficit. |
| When a passive player is dismissed | month 35 (month 22 in War footing) | earlier warning, not an earlier dismissal: probation, the advisor and the forecast flag the decline by month 6–8 | The lesson lands near its cause without making the game harsher. |
| Starting treasury | unchanged | unchanged | The run shows money piles up for passive players and runs out for the advice; the problem is how it is spent, not how much there is. |
| Tutorial clock | runs from the first Space | held until step 2 is done | Reading time without losing days. |

### Progress

- **C0 (done, 20.1.0):** the running gap is measured; the safe advice and the chief of staff keep a year of it in hand;
  Home warns when the money would run out within 18 months. Measured on 160 games per player: the chief of staff's
  games in debt fell from 25 to 17; the safe advice's stayed at 21, so the warning is the main gain for players. A
  deeper fix (planning recurring costs before committing them) is possible later if playtests show players still
  slide into debt.

### What this plan does not change

The simulation's systems, the map, the scenarios, the career, the hearing and the save format all stay as they are.
C1, C3 and the balance table change numbers in `src/sim/tuning/`. Any change to the golden masters will be named and
re-recorded on purpose.
