# Data and tuning

Where the game's tables and tuning values live, and what each one becomes in Unreal. The next step of the port
baseline (18.1) moves the tables still written as TypeScript into data files with a schema, plus a test that the
loaded tables match.

## Tables

| Table | Where | Becomes |
|---|---|---|
| Materials (name, kind, unit, price, mass, shelf life, blurb) | `MATERIALS`, `src/sim/world.ts` | DataTable `DT_Materials` |
| Recipes (inputs per unit, scrap) | `RECIPES`, `world.ts` | DataTable `DT_Recipes` |
| Sites (classic map: position, region, owner, processes, crew) | `SITES`, `world.ts` | DataTable `DT_Sites` |
| Cities and routes | `CITIES`, `ROUTES`, `world.ts` | DataTables |
| Line rates | `LINE_RATE`, `world.ts` | DataTable |
| Threats and their interceptors | `THREATS`, `src/sim/fight.ts` | DataTable `DT_Threats` |
| Difficulty | `DIFF` (`tick.ts`), `DIFFICULTY_MONEY` (`setup.ts`) | PrimaryDataAsset `PDA_Difficulty` |
| Scenarios | `SCENARIOS`, `setup.ts`; `docs/mandate.md` | PrimaryDataAsset per scenario |
| Research, doctrine forks, policies, operations | `strategy.ts`, `doctrine.ts`, `commitments.ts`, `intelops.ts` | DataTables |
| **The mandate** | **`src/sim/tuning/mandate.json`** (already data) | PrimaryDataAsset `PDA_Mandate` |

## Tuning written into the logic

These are named constants or bare numbers inside the systems. They move to tuning files in 18.1, starting with:
- `tick.ts`: wages, the spot premium, buffer days, `MIN_BASE_ROUNDS`, the 80% refund, scrap factors, reorder
  thresholds, the random spreads in the fight, the 0.97 kill-probability cap, wear for each run level;
- `strategy.ts`: the budget formula's inflation share and the objective rewards;
- `hearings.ts`: requests and their odds;
- `automation.ts`: the chief of staff's thresholds and money gates;
- `selectors.ts`: reserve days and the 450-day stockpile law;
- `setup.ts`: legacy stock and starting contracts.

Count of decimal numbers written into each file, as a rough guide to the work: world 134, tick 49, strategy 31,
fight 28.

## Text

Story chapters, news headlines, the guide, the tips and every log line are written inline in TypeScript. For Unreal
they become string tables, ready for localisation. Log lines should also carry an event id and a kind, so that sound,
pausing and the log no longer classify them by matching their English text (noted by the audio and UX reviews).
