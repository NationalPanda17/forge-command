# Release 19.0 "Depth"

Release 19.0 makes each campaign play differently, in three parts:

- **19.0a:** an adaptive rival.
- **19.0b:** map variety from the seed.
- **19.0c:** scenario identities.

All the tuning is in `src/sim/tuning/depth.json`.

## 19.0a: the adaptive rival

The Vardan Directorate used to field its six developments in a fixed order, shuffled once by the seed. Now it studies your stockpile and develops what you are least ready for.

### What it watches

Each month (`rivalMonth`, at month close), the rival updates a reading for each unlocked line that is past its grace period. The reading is an exponential moving average of `min(1, stock / target)`, with `watchAlpha` set to 0.4. Because the reading is smoothed, topping a line up the week before intel reports does not fool it.

### How it chooses

When intel is due (`announceNext`), the rival scores each development it has not yet fielded, using `chooseNext`:

```
exposure(line) = the line's share of the fire against the threats the development changes
                 (1 for a line whose kill chance or land demand it changes)
stockGap       = Σ exposure(line) · (1 − watch[line]) / Σ exposure(line)
score          = (aim · stockGap + doctrineBias·[it targets a doctrine you chose] + seedLean·rank)
                 × (counterPenalty if you already hold its counter)
```

| Term | Value | Meaning |
|---|---|---|
| `aim` | `aimByScenario` | How hard it aims at your stockpile. Standard and Sanctions 1; War footing and Rebuild 0.5; the tutorial 0. |
| `doctrineBias` | 0.15 | A pull towards developments that exploit the doctrine you picked (`doctrineTargets`). |
| `seedLean` | 0.04 | A small lean towards the seed's original order, which breaks ties and keeps campaigns distinct. |
| `counterPenalty` | 0.5 | It is half as keen on a development you already hold the counter to. |

The development with the highest score moves to the front of the rival's order. The choice draws no random numbers, so the rest of the game's random stream is unchanged.

### Telling the player

The intel report and the Intel panel give the reason, for example: "Why this: they are aiming at your Interceptor missiles at 42% of target." The reason names the two thinnest exposed lines, and any doctrine gap it read. If the rival chose a development despite your counter, the report says so.

### Pacing

These values were constants before and are now tuning. The behaviour is unchanged except where noted:

- `firstDay`: 120 to 180.
- `gap`: 180 to 270, adjusted by `gapByDifficulty`, with `gapJitter`.
- The term speed-up (`termSpeedup`).
- `warningDays`: 90.
- `strength`: Hard is now 1.25, up from 1.0.
- Rebuild's first report comes 120 days later (`firstDelayByScenario`).

### Deviations from the design spec

- **Omitted: region bias.** The spec had the rival favour developments that hit the region with your thinnest stock. Stock is national in the sim, so that term had nothing to read.
- **Added: per-scenario `aim`.** At full aim, War footing (already under pressure) and Rebuild (a thin start) were dismissed too often. The rival aims at half strength there.
- **Added: Rebuild's first-report delay**, for the same reason.
- **Added: `confidence.fightScale`** in `mandate.json`. The Committee weighs leaks and land shortfalls at 0.7 in Rebuild, since it knows the reserve starts thin.

### Balance (autopilot, normal unless noted; `scratchpad/economy/audit2.ts`)

| Case | Dismissed | Note |
|---|---|---|
| Standard | 0/10 | Score −3 against 18.3, inside the spec's −2 to −6. |
| Hard | 3/10 | Gap to normal at least 15. |
| War footing | 3/21 | |
| Sanctions | 1/10 | |
| Rebuild | 7/21 | 6/21 before 19.0. Rebuild's losses come from leaks and the land war, not the rival. 19.0c reworks this scenario. |

### Decisions taken (the designer's defaults)

- A counter halves the rival's interest. It does not rule the development out.
- The story campaign keeps the adaptive rival, since no beat names a specific development.
- The tutorial keeps the scripted order.

## 19.0b: map variety from the seed

A generated country gets two or three features. They come from the world seed on their own stream (`makeFeatures(seed)`, `mulberry(seed ^ 0xfea7)`), so they never use the game's random numbers. They are stored as `s.features` when the game starts. The classic map, the story and the tutorial have none, and an older save of a generated country keeps none, so it plays exactly as before. Tuning: `depth.json` → `map`.

| Feature | Odds | Effect |
|---|---|---|
| **Chokepoint** | always (when a candidate exists) | One part from `chokepointMaterials` (magnets, rocket motors) has a single home maker. The others close, the survivor takes their whole share and starts qualified, and sabotage there does `chokepointDamage` ×2 condition damage. The map marks it **CP**. |
| **Foreign reliance** | `foreignOdds` 0.7, never under Sanctions | One part your arsenals buy directly (`foreignMaterials`: RF seekers, rocket motors). Home makers run at `domesticCut` 0.4; foreign makers grow until the total share is at least `minTotal` 1.1, and start qualified. Supply independence joins the mandate at weight `independenceWeight` 0.10, and the weights are renormalised. |
| **Coast** | long 0.3, short 0.3; re-rolled until the map has two features | **Long:** more of the air threat comes in over the coast (coast 0.38, east 0.22), and sea legs carry ×1.2. **Short:** the threat shifts inland (coast 0.22, east 0.38), and sea legs carry ×0.85. The shares still sum to 1. |

**Starting contracts.** On a feature map, the starting contract for each arsenal input goes to the qualified maker with the most capacity. For the relied-on part, foreign makers count too. The classic map keeps its first private supplier, so its golden masters are unchanged.

**What the player sees:**
- **The new-game screen:** a line under the country, for example "Chokepoint: Rocket motors (one plant) · Relies on foreign radar seekers · Short coast".
- **A country brief** before the clock first runs.
- **The CP badge** on the map, which the map key explains.

### Deviations from the spec

- **Chokepoint candidates** are only magnets and rocket motors. They are the only parts with two home makers.
- **Foreign reliance** is only for parts the arsenals buy. Foreign purchases count only when your own plants buy, so a part bought by a private maker would not have moved independence at all. Even so, foreign purchases come to 8–14% on these maps, short of the spec's 15–35%.
- **Under Sanctions** there is no foreign reliance, since the bans already supply that pressure.
- **Sea freight cost is unchanged**, because the path cache prices legs once. Only sea capacity changes.
- **Sea capacity** is ×1.2 on a long coast and ×0.85 on a short one, milder than the spec's ×1.3 / ×0.7. It made no measurable difference.

### Balance (autopilot, normal, generated maps, 21 seeds; `scratchpad/economy/maps.ts`)

| Case | With features | Same worlds without |
|---|---|---|
| Standard | 56.6, 4/21 dismissed | 55.1, 5/21 |
| Sanctions | 47.2, 5/21 | 51.3, 3/21 |
| War footing (11 seeds) | 55.1, 1/11 | 57.6, 0/11 |
| Rebuild (11 seeds) | 51.5, 2/11 | 46.7, 3/11 |

On the classic map, Standard is 62.4 with none dismissed. Generated maps were already harsher before 19.0b: about 1 game in 4 is dismissed even without features. That is a separate issue, left for a follow-up.

## 19.0c: scenario identities

Each scenario now has a rule of its own, in `src/sim/scenarios.ts`, with tuning in `depth.json` under `scenarios`. Only one of these rules draws random numbers: the roll for whether a broker purchase leaks, made only when you buy.

### War footing: a moving front, and air surges

- **The front.** `s.war.front` runs from −1 to 1. Each month it moves by `frontStep` 0.25 × (c − 1).
  - **c:** the artillery lots at the Marches' guns and depot, divided by `coverDays` 30 days of their draw, capped at 1.5.
  - **Below −0.5 (falling back):**
    - Marches land draw ×1.3;
    - confidence −2 a month;
    - the Marches' plants are disrupted (10 days, output ×0.8).
  - **Above 0.5 (advancing):** Marches land draw ×0.8.
- **Surges.** Every `surgeGap` 120 days, raids ×1.8 hit the region whose air defences hold the fewest days of rounds, for 14 days.
- **`pressure(s, region, family)`** multiplies the arrivals and draws in the daily fight and in `regionDailyDraw`. Reserve targets therefore follow the front and the surges.
- **Home** shows a front card: a bar for the front, the cover, and any surge under way.
- **Deviation:** `coverDays` is 30, not the spec's 60. The game's own depot and base stocks hold about 30 days, and at 60 the front fell back in every game.

### Sanctions: bans that lift, and a broker

- **Starting relations.** The supplier nations start at 35, 27 and 20, in an order set by a hash of the seed. The spec's 40/32/25 made Sanctions easier than Peacetime.
- **The bans** start at `maxBan` 540 days. A nation's ban lifts the month its relations reach 60. Trade missions are how you bring a nation round, and the autopilot sends them to banned nations.
- **The broker.** While any ban holds, a monthly decision offers 60 days of draw of your scarcest line at ×1.8 the list price.
  - Buying draws one random number: a 12% chance that it leaks, costing −6 confidence.
  - The premium is booked as `grey` waste.
  - The autopilot buys only below 50% readiness.

### Rebuild: worn plants, refurbish or replace

- **Worn start.** State plants start at condition 35–70, from a hash of the seed and the site.
- **Fast wear.** Below 50 they lose an extra 0.05 a day.
- **Output.** The existing condition factor (0.6 + 0.4 × condition) already cuts the output of a worn plant, so the spec's second factor was not added.
- **Refurbish** is the existing overhaul: back to 100, but the plant goes on wearing.
- **Replace** (`replacePlant`) costs 2.5 × the overhaul and closes the plant for 45 days. It comes back at 100 with +10% capacity, and never wears faster than normal again.
- **The autopilot** replaces plants below 30 and refurbishes those below 50.
- **Deviation:** the spec's −15% energy for a replaced plant is left out.

### Peacetime: the budget round

At the start of each fiscal year after the first, once the hearing is over, the Committee offers three packages. They are stored in `s.budgetDeals[year]`.

| Package | Effect |
|---|---|
| **Hawks** | Appropriation +8%. The readiness full mark rises by 0.03 for the year. |
| **Treasury** | Appropriation −5%. 0.10 of weight moves from readiness to value. |
| **Regions** | 0.10 of weight moves from stewardship to jobs. |

You can also leave the budget as it is. The weights are renormalised and still sum to 1.

**The autopilot** takes the hawks only when value is the weakest goal and readiness is fully met. It takes the regions when stewardship is the weakest. It never takes the Treasury package: in testing, the cut lost a game.

**Deviation:** the spec's export credit against value for money is left out.

### Balance (full autopilot, 21 seeds; `audit2.ts`)

| Case | 19.0c | Before (19.0b) |
|---|---|---|
| Peacetime, normal | 57.0, 3/21 dismissed | 57.5, 3/21 |
| Peacetime, hard | 39.3, 7/21 | 39.1, 7/21 |
| War footing | 46.2, 3/21 | 51.4, 3/21 |
| Sanctions | 52.2, 3/21 | 51.5, 2/21 |
| Rebuild | 49.7, 5/21 | 44.8, 7/21 |

These runs are noisy. Small changes to a setting moved War footing by ±5 points in both directions, so differences of a few points are within that noise.
