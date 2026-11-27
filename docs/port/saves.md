# Saves

## Format

- **A save is the whole `SimState` as JSON** (`src/sim/types.ts`). The game writes the current game to `localStorage`
  under `forge-command-save`, named saves under their own keys with an index, and a file on export.
- **Save size:** about 330,000 characters after 6 years and about 680,000 after 20. Most of it is the monthly
  `history`. Month reports older than two years are rounded, and those older than ten lose their plant breakdown
  (`compactHistory`, `tick.ts`).

## Schema numbers (18.0)

- **`version: 1`** marks a Forge Command save and has never changed.
- **`schema`** numbers the shape of the save. New games carry the current `SAVE_SCHEMA` (`src/sim/setup.ts`). Saves
  from before 18.0 have no `schema` and count as 1.
- **`migrate(save)`** brings a save of any earlier schema up to date and attaches its map, in two parts:
  - **`fillDefaults`** runs on every load. It fills any field a save lacks with its default: tests, tenders, exports,
    the network, the rival, programmes, policies, the story, the towns, diplomacy, hearings, promises, cyber, unions,
    the career, energy, oversight, communities, automation, engineers, intelligence, doctrine, moments and the cast.
    It also adds the open plots, fills the people fields of each site and shifts an old tutorial's step. It changes
    nothing in a complete save, so it also mends a damaged one.
  - **Numbered conversion steps** come after it, for changes that cannot be expressed as a default (a renamed field,
    a unit change). There are none yet, because schema 2 is the defaults alone.

## Changing the format

1. Raise `SAVE_SCHEMA` by one.
2. Write the change in one of two ways:
   - A new field with a default goes in `fillDefaults`.
   - A conversion goes in a new `toSchemaN(s)`, added as `if (from < N) toSchemaN(s)` in `migrate()`.
3. Add a test that migrates a save from the schema before (`tests/sim/saves.test.ts` shows how).
4. If the game's behaviour changes, re-record the golden masters.

## In Unreal

- A `USaveGame` holds the same JSON.
- A browser-save importer runs the same numbered steps, then converts the JSON into the C++ structs.
- Importing browser saves is also a parity test: load a save, step it 30 days in both versions, and compare the
  digests (`golden-masters.md`).
