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
