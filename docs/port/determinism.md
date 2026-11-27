# Determinism

Two implementations agree only if they draw the same random numbers in the same order, round the same way and visit
things in the same order. These are the rules.

## Random numbers: mulberry32 (`src/sim/rng.ts`)

The generator's whole state is one unsigned 32-bit integer, `state.rng`, saved with the game. Each draw:

```
rng  = (rng + 0x6D2B79F5) mod 2^32
t    = rng
t    = imul(t ^ (t >>> 15), t | 1)
t   ^= t + imul(t ^ (t >>> 7), t | 61)
draw = ((t ^ (t >>> 14)) >>> 0) / 4294967296        // in [0, 1)
```

- `imul` is 32-bit multiplication that keeps the low 32 bits. In C++, use `uint32_t` arithmetic.
- `>>>` is a logical (unsigned) right shift.
- `randRange(a, b) = a + draw × (b − a)`.
- `randInt(a, b) = floor(randRange(a, b + 1))`.
- `pick(list) = list[floor(draw × length)]`. It is never called on an empty list (guarded since 16.1).
- **Seeds from text** use FNV-1a, 32-bit: start at `2166136261`, then for each UTF-16 code unit
  `h = imul(h ^ unit, 16777619)`, and finish with `h >>> 0`.
- **Separate streams.** The cast of characters has its own stream (`state.cast.rng`, seeded from
  `"cast|" + seed`), so naming people never shifts the main game's draws.

**Every draw counts.** A port that skips a draw, or makes an extra one, even on a branch whose result is thrown away,
falls out of step from that day on. Where the TypeScript draws before checking a condition (for example
`rand(s) < 0.07 && list.length`), the port must draw first too.

## Rounding

- The simulation calls `Math.round` about 200 times. JavaScript rounds halves toward positive infinity:
  `Math.round(2.5) = 3` and `Math.round(-2.5) = −2`. C++'s `std::round(−2.5)` is −3.
- The port must use one helper that matches JavaScript: `floor(x + 0.5)`.
- Values written as `Math.round(x × 100) / 100` must be computed exactly that way, not with a different decimal
  routine.
- `Math.hypot` (`world.ts`, `towns.ts`) is not guaranteed bit-exact across libraries. Its results feed distances, and
  their small differences sit inside the golden tolerances.

## Iteration order

- Records keyed by string, such as `state.sites`, `state.lines` and `REGIONS`, are visited by JavaScript in insertion
  order: the order of the tables in `src/sim/world.ts`, or of generation for generated maps.
- A C++ `TMap` keeps no order. Wherever the order changes a result, iterate over an array in table order: the site
  list, the finished-goods list `FINISHED`, the region list.
- When in doubt, iterate in table order. It is never wrong.

## The order of a day (`stepDay`, `src/sim/tick.ts`)

1. day + 1, and route loads cleared
2. the world (weather, prices, seasons)
3. strategy (research, staff, decisions)
4. living (events, allies, export offers, event chains)
5. build (network projects)
6. rival
7. industry (open plots, in-house lines, designs)
8. cyber
9. energy
10. intelligence
11. doctrine
12. towns
13. testing
14. people (crews, training, morale)
15. **produce**
16. **logistics** (purchases and shipments)
17. **fight** (threats against air defence, and the land battle)
18. lifecycle (ageing, surveillance, retirement)
19. daily pay
20. **month close**, every 30th day: decisions expire, a stale hearing closes, then
    1. strategy
    2. economy
    3. living
    4. people
    5. programmes
    6. policy
    7. security
    8. towns
    9. testing
    10. diplomacy
    11. cyber
    12. unions
    13. promises
    14. energy
    15. oversight
    16. communities
    17. engineers
    18. doctrine
    19. cast
    20. intelligence
    21. the fiscal year's hearing
    22. the mandate's month figures and confidence
    23. the Courier
    24. history
21. the story (unless the game is over)
22. the chief of staff, for any areas handed over
23. the end of the term

Every system runs every day or month, in this order, even when it does nothing. Some draw random numbers even then.

## The world-state contract (browser version)

- **Shared tables.** A generated country changes the site, city, region and candidate-route tables, the kilometre
  scale and the route graph in place (`worldgen.ts`, `world.ts`, `graph.ts`). These are module state, not part of
  `SimState`.
- **Entry points that step or change a game** (`advanceDays`, `apply`, `migrate`, `newSim`) first make that game's
  world current (`applyWorld`), then rebuild its network (`setNetwork`).
- **Functions that only read** (`validate`, the advisor, the selectors and the UI) use whichever world was made
  current last. In the browser that is always the one game on screen.
- **Proof.** `tests/sim/world-contract.test.ts` plays a classic and a generated game turn about, and each ends exactly
  as it does alone. The golden masters, run in shuffled order, show the same.
- **In Unreal,** make this explicit: a `WorldInstance` (sites, cities, regions, routes, scale, graph) built from the
  seed and passed through the simulation, with no global tables. That is the cleaner design. The browser version keeps
  the contract above, because rewriting every system to pass the world through would change nearly every file for no
  gain in play.

## Copying the state (18.2)

`advanceDays` copies the live state but shares the entries of the four lists that only ever grow: the history, the
log, the Courier and the term's moments. A filed entry is never changed in place: `compactHistory` replaces old months
with rounded copies. The C++ simulation should do better still: change the state in place on the fixed tick, and take
a snapshot only for saves and the UI.
