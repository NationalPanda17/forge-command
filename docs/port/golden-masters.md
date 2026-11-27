# Golden masters

Eight fixed games, each played for two years by a fixed policy, with their results recorded in
`tests/golden/records/`. They pin the simulation's behaviour. A refactor of the browser version must leave them
unchanged, and the Unreal port is checked against them.

## The cases (`tests/golden/cases.ts`)

| Case | Seed | What it covers |
|---|---|---|
| peacetime-normal | 101 | the standard game, run by the chief of staff |
| peacetime-hard | 202 | Hard difficulty and its stricter mandate |
| war-footing | 303 | an active crisis from day one, and the shield goal |
| sanctions | 404 | foreign suppliers banned |
| generated-map | 505 | a generated country: world generation, renamed sites, its own network |
| story | 606 | the story: chapters, briefings and goals |
| sandbox-endless | 707 | a sandbox with no end and no dismissal |
| hands-off | 808 | nobody at the desk: defaults, decay and dismissal |

Every case except hands-off runs with the chief of staff in charge of every area, so the actions are exercised too.
Each case runs `openCampaign(newSim(…))`, then `advanceDays(s, 30)` for 24 months.

## What is recorded

- **Each month:** the month number, day, treasury and confidence (to 2 decimals), readiness (to 2 decimals), the
  national stock of every unlocked line summed, the number of log lines, the random-number state, and whether the game
  is over.
- **At the end:** a SHA-256 of the whole final state, with keys sorted (`canonical()` in `cases.ts`). It catches any
  change at all in the TypeScript simulation.

## Running them

- `npx vitest run tests/golden` compares. It also runs as part of the full suite and in CI.
- `npm run golden:update` re-records. Only do this when a change to the game's behaviour is intended, and say so in
  the commit. A pure refactor must never need it.
- A failure names the first month that differs. If every month matches but the final hash differs, something that is
  not in the digest has changed.

## Tolerances for the Unreal port

The port must reproduce the **monthly digests**. The final hash is TypeScript-only, because a C++ state has a
different shape.

| Figure | Tolerance |
|---|---|
| day, month, feed count, over | exact |
| rng | exact. If it drifts, a draw was skipped or added (see `determinism.md`) |
| readiness | ±0.01 |
| confidence | ±0.05 |
| treasury | ±0.05 $M, or 0.01%, whichever is larger |
| stock | ±0.1% |

Report the first month and the first field outside its tolerance, then compare the two states field by field from
that day.
