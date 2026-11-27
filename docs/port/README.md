# Port contract: from the browser to Unreal Engine

The browser version of Forge Command is the reference for the Unreal Engine rebuild. This folder says what the Unreal
simulation must reproduce, and how we prove that it does. Recommended target: **Unreal Engine 5.8**, with the
simulation in plain C++ (no UObject inside it), so a later move to UE6 touches the UI, not the game.

| Page | What it fixes |
|---|---|
| [`determinism.md`](determinism.md) | The random numbers, rounding, iteration order and the order of each day and month: the rules that make two implementations agree |
| [`golden-masters.md`](golden-masters.md) | The recorded games the port is checked against, and the tolerances |
| [`saves.md`](saves.md) | The save format, its schema numbers, and reading browser saves in Unreal |
| [`data.md`](data.md) | Where every table and tuning value lives, and what becomes a DataTable |

Related:
- `../DESIGN.md`: every system, rule by rule.
- `../mandate.md`: the win condition and its balance.
- `../art-bible.md`: the look, the sound and the asset list.

## The shape of the simulation

- **`src/sim`** is a pure TypeScript core. It imports nothing from the UI, and never calls `Math.random`, `Date`,
  `performance`, `localStorage` or `window`.
- **The whole game is one serialisable value, `SimState`.** Its random-number state is part of it, so a save replays
  exactly.
- **Time moves by `advanceDays(state, n)`,** which copies the state and steps it one day at a time. It never changes
  its input.
- **The player and the chief of staff act through one API.** `validate(state, action)` says whether an action is
  allowed and, if not, why. `apply(state, action)` carries it out. The autopilot and the advisor use the same pair.

**In Unreal:**
- **Simulation:** a `ForgeSim` C++ module holding plain structs, owned by a `UGameInstanceSubsystem` that runs the
  fixed one-day tick and dispatches actions.
- **Data:** DataTables and PrimaryDataAssets, from the files in [`data.md`](data.md).
- **UI:** CommonUI with MVVM bindings to snapshots of the state.

## Milestones (from the technical director's plan)

| | Weeks | Done when |
|---|---|---|
| **M0** | 2–3 | Project, CI, the RNG and data import in place |
| **M1** | 6–8 | A headless C++ simulation passes the golden masters for a full campaign |
| **M2** | 4–6 | The map and the core panels (Home, Site, Build, Markets) |
| **M3** | 6–8 | The remaining panels, story, advisor, hot-seat and saves |
| **M4** | — | Polish, performance, a Steam desktop build |

Freeze the browser version at a tagged **port baseline** before M1 starts, so the target does not move.
