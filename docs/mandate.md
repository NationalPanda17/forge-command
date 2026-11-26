# The Committee's mandate

Design document for the win condition introduced in 17.0. Written by the game design lead, tuned against headless
balance runs, implemented in `src/sim/mandate.ts`, with every number in `src/sim/tuning/mandate.json` (the source for
the Unreal DataTable).

## 1. Overview

Each term the Defence Committee sets a mandate: 3 or 4 weighted goals that pull against each other. Each goal is
measured from the monthly reports and scored from 0 to 1 for each fiscal year. The weighted sum, **M**, replaces readiness
as the main part of the grade and of the Committee's monthly confidence. A projected grade is always on Home. The
mandate tightens each fiscal year.

**Player fantasy.** You answer to politicians who want everything at once. Full racks are expected, but the job is to
fill them cheaply, spread the work fairly across the regions and not waste money. When you can't keep every promise,
you choose which one to bend.

## 2. The goals

Each goal is scored as `lin(x, zero, full) = clamp((x − zero) / (full − zero), 0, 1)` over the fiscal year's monthly
reports. The thresholds for each difficulty are in the tuning file.

| Goal | Measured as | Pulls against |
|---|---|---|
| Readiness | mean month-end readiness | value, stewardship: full racks cost money |
| Value for money | running costs (purchases, operations, transport, energy) at constant prices ÷ (months × base budget × max(0.3, readiness)) | readiness, jobs: overstock and spot buying cost without adding readiness |
| Regional jobs | 0.6 × balance + 0.4 × town mood. Balance is 1 − ½ Σ \|share of work − fair share\| over regions; work is your plants' crews plus contracted suppliers' crews; the fair share is each region's domestic crew in the site table | value: the cheapest supplier is rarely in the right region |
| Stewardship | 0.5 × waste ratio (the Auditor-General's waste ÷ spend) + 0.5 × months of appropriation in hand at year end | readiness: money kept is money not spent on racks |
| Shield | share of incoming threats that got through | value, stewardship: interceptors cost money |
| Supply independence | foreign purchases ÷ all purchases | value. **Defined, but in no mandate yet** (see §11) |

**Readiness gate.** The goals other than readiness and shield are multiplied by
`lin(readiness, zero − 0.15, zero)`. A player who does nothing therefore gets no credit for thrift or tidiness. A
player who is struggling but active, with readiness a little under target, keeps most of it.

**Month-end data.** Four fields are filed with each `MonthReport`: `foreign` (counted inside purchases, so never
double-counted), `jobsBalance`, `townMood` and `cover`.

## 3. Mandates by scenario

| Scenario | Goals (weight) | Readiness ease |
|---|---|---|
| Peacetime, Custom | readiness 40, value 25, jobs 20, stewardship 15 | — |
| War footing | readiness 35, shield 30, value 20, stewardship 15 | −0.05 |
| Sanctions | readiness 35, value 25, jobs 20, stewardship 20 | −0.10 |
| Rebuild | readiness 45, jobs 25, value 15, stewardship 15 | −0.08, plus −0.10 in year 1 and −0.05 in year 2 |
| Tutorial | readiness 50, value 25, jobs 25; stewardship 15 is added from year 2 | no tightening |

The story mode keeps its chapter goals as the narrative layer, and is graded on the Peacetime mandate. If a map has no
community towns, the jobs goal is dropped and the remaining weights are renormalised.

## 4. Score and grade

`score = multiplier × (55·M + 20·trust + 15·interception + min(5, 2·objectives)) − 30 if dismissed`

- **M** is each fiscal year's weighted score, averaged by months. A partial year counts.
- **trust** is `clamp((average confidence over the term − 50) / 50, 0, 1)`. Final confidence no longer counts, and a
  Committee that merely tolerates you earns nothing.
- **Multiplier:** Easy 0.85, Normal and Hard 1.
- **Bands:** A ≥ 80, B ≥ 68, C ≥ 55, D ≥ 42, otherwise F.

## 5. Confidence and budget

Each month (`tick.ts`, `mandateConfidence`):

- `mandate = (M over the last 3 months − expectation − scenario offset − 0.02 per later term) × 12`. Until three
  months are on file, only readiness is judged.
- **Expectation:** Easy 0.45, Normal 0.40, Hard 0.22. Hard is harder through its thresholds.
- **Scenario offset:** War footing −0.03, Sanctions −0.12, Rebuild −0.15.
- **Saturation:** gains are multiplied by `clamp((100 − confidence) / 40, 0.15, 1)`, so confidence stops racing to 100.
- **Readiness floor:** `−max(0, floor − readiness) × 10`, with floors of 0.55 / 0.62 / 0.64 (shifted by the same
  offsets). Empty racks stay dangerous whatever else is going well.
- **Budget:** next year's provisional budget is scaled by `0.92 + confidence / 625`, a range of 0.92 to 1.08. It was
  0.85 to 1.15, which ran away with the leader.

## 6. Yearly tightening

Each fiscal year of a term, every threshold moves one step harder: readiness +0.02, value −0.03, balance +0.01,
mood +2, waste −0.005, cover +0.25, shield −0.01. The tightening stops at 3 steps. Each later term starts one step
tighter per earlier term, up to 3 more. The steps are worked out from the term's age, so no state is saved for them.

## 7. Home

The Mandate card lists, for each goal, its name, weight, the figure it is judged on and a 0–1 bar. Beside them it shows
the **projected grade and score**:

- Closed years count at their actual scores.
- The current year counts once it has 3 months on file. Before that the closed years stand alone, and in a term's
  first quarter each goal is assumed at 0.5.
- Confidence is projected flat from now.
- Below 20 confidence the card warns of dismissal. The term report shows the mandate percentage and the average
  confidence.

## 8. Balance results

Measured with 5 seeds over 48-month terms. "Advice" means the safe advice taken weekly.

| | Do nothing | Safe advice | Full autopilot |
|---|---|---|---|
| Easy | D (46), 1/5 dismissed | 68 | 72 |
| Normal | 5/5 dismissed | 57, 1/5 dismissed | **65, 0/5 dismissed** |
| Hard | 5/5 dismissed | 46, 1/5 dismissed | 38, 2/5 dismissed |
| War footing | 5/5 dismissed | 50, 1/5 dismissed | 56, 0/5 dismissed |
| Rebuild | 5/5 dismissed | 57, 0/5 dismissed | 54, 1/5 dismissed |
| Sanctions | 5/5 dismissed | 48, 1/5 dismissed | 49, 1/5 dismissed |

Targets:

- Easy, doing nothing earns a D at best. **Met.**
- The autopilot averages a C on Normal and is not dismissed. **Met.** Before the mandate it averaged an A (89).
- The autopilot drops at least 15 points from Normal to Hard. **Met** (27 points).
- The autopilot survives each scenario at least 4 times in 5. **Met.**
- A skilled player can reach an A. **Not yet verified.** The autopilot reaches about M 0.6, so the room above it is
  in value, jobs and stewardship. This needs a playtest.

## 9. Tuning knobs

Every value is in `src/sim/tuning/mandate.json`: score weights, the Easy multiplier, the grade bands, the gate width,
confidence gain, window, expectations, offsets, saturation and floor, the budget band, the tightening steps and cap,
each goal's thresholds by difficulty, each scenario's weights and readiness ease. If a balance target misses:

- **Normal autopilot out of band:** the Normal readiness and value full thresholds, then the expectation.
- **Too many dismissals:** the expectation and the scenario offsets.
- **Easy too generous:** the Easy multiplier and the gate width.

## 10. Edge cases

- **Endless sandbox:** tightening stops at 3 steps. With dismissal off there is no penalty, and the grade is
  informational.
- **Second terms:** start tighter (§6), plus 0.02 on the expectation for each later term, up to 3.
- **Hot-seat:** one shared mandate, scored on the shared state.
- **Generated maps:** the fair shares come from the map's own site table.
- **No purchases:** independence counts as met.
- **No spend:** waste counts as 0.
- **Old saves:** need no migration. Months filed before 17.0 lack the jobs and cover fields, and use neutral values
  (balance 0.6, mood 55, cover 0).

## 11. Not yet built

- **Supply independence in play.** Foreign suppliers make up only about 2% of purchases, so the goal would score
  itself. It returns once foreign supply is a real temptation.
- **The goal swap.** At a hearing, a goal scored at 0.9 or better could be traded for an unused one.
- **Separate tallies for each director** in hot-seat games.
- **Sanctions counting independence** only in months with no ban in force.

## 12. Acceptance criteria (tests in `tests/sim/mandate.test.ts`)

1. Goals score 0 at zero and 1 at full, in either direction.
2. Thresholds tighten each year up to the cap; the tutorial never tightens.
3. Empty racks give no credit for the other goals.
4. Each scenario's weights sum to 1.
5. The score formula matches §4.
6. Foreign purchases never exceed purchases, and the term's spend is unchanged.
7. Home's projection equals the term report's mandate score at the end of a full term.
8. A screenshot of Home at 1280 wide shows the Mandate card with no overlapping text.
