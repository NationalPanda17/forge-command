# Data and tuning

Where the game's tables and tuning values live, and what each one becomes in Unreal. Since 18.1 the tables are data
files: TypeScript loads them, `tests/sim/data.test.ts` checks every key and reference in them, and the golden masters
prove that moving them changed nothing.

## Tables (`src/sim/data/`)

| File | What | Becomes |
|---|---|---|
| `materials.json` | id, name, tier, unit, weight (t a unit), price ($M), shelf life (days), blurb | DataTable `DT_Materials` |
| `recipes.json` | id, name, output, yield, inputs per unit, scrap, extra outputs | DataTable `DT_Recipes` |
| `sites.json` | the classic map's sites: position, region, owner, processes and shares, crew, qualification, nation, blurb | DataTable `DT_Sites` |
| `cities.json`, `regions.json` | cities, and regions with their threat and land shares and depots | DataTables |
| `routes.json`, `candidateRoutes.json`, `modes.json` | the network, the links you can build, and each mode's speed, cost and detour | DataTables |
| `lineRate.json`, `publicRate.json` | each line's starting rate a day, and the public reference figure it is scaled from | DataTable `DT_Lines` |
| `threats.json` | each threat: cost, shots, severity, calm-month arrivals, and the interceptors that answer it with their kill probabilities | DataTable `DT_Threats` |

Generated maps (`src/sim/worldgen.ts`) start from these tables and rename, move and connect the sites by seed.

## Tuning (`src/sim/tuning/`)

| File | What | Becomes |
|---|---|---|
| `core.json` | wages, spot premium, stock buffers, output cap, demil rate; difficulty (events, crises, ramp-up, starting money); base minimum rounds; reserve days, the stockpile law, grace for new lines | PrimaryDataAsset `PDA_Core` |
| `mandate.json` | the Committee's mandate: goals, thresholds, scenario weights, confidence, score, grade bands (`docs/mandate.md`) | PrimaryDataAsset `PDA_Mandate` |

## Tuning still written into the logic

Bare numbers inside the systems, left for the port, where each becomes a named field as its system is rewritten:
- `tick.ts`: the 80% refund, scrap factors, reorder thresholds, the random spreads in the fight, the 0.97
  kill-probability cap, wear for each run level;
- `strategy.ts`: the budget formula's inflation share and the objective rewards;
- `hearings.ts`: requests and their odds;
- `automation.ts`: the chief of staff's thresholds and money gates;
- `setup.ts`: legacy stock and starting contracts.

Count of decimal numbers still written into each file, as a rough guide to the work: tick about 45, strategy 31,
fight about 10 (the threat table itself is now data).

## Text

Story chapters, news headlines, the guide, the tips and every log line are written inline in TypeScript. For Unreal
they become string tables, ready for localisation. Log lines should also carry an event id and a kind, so that sound,
pausing and the log no longer classify them by matching their English text (noted by the audio and UX reviews).
