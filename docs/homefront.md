# Release 19.1 "The home front"

Before 19.1, the home-front systems were separate: cyber, spies, intelligence, unions, towns, communities and the audit. Each mostly ended at the Committee's confidence, and only three links ran between them. 19.1 joins them through one reading, **discontent**, and folds the busywork away.

- **Code:** `src/sim/homefront.ts`.
- **Tuning:** `src/sim/tuning/homefront.json`.
- **Spec:** written by the game designer, with the user's choices recorded below.

## Discontent

```
D(town) = 0.5 · unionStrength/100 + 0.5 · (100 − mood)/100        (0..1; baseline 0.425 at strength 40, mood 55)
```

Discontent is worked out on the spot and never saved. Every link below is centred on the baseline, so a calm game plays as before.

## Workforce and towns

| Link | Rule |
|---|---|
| Town mood → union | Union strength moves each month by an extra `kMoodToUnion` (0.04) × (55 − mood). |
| Town mood → hiring | The room to hire is multiplied by `clamp((mood − 15)/30, 0.4, 1)`. |
| Claims → mood | A settled claim gives mood +2. A refused one gives −3. A strike gives a further −3. |
| Community fund | Costs $10M. Mood +12, as before, and union strength −5. It now replaces the open day. |
| Mothballing | Union strength +10, on top of the existing mood −10. |

## Security

| Link | Rule |
|---|---|
| Discontent → spies | A plant's security falls by `kSecD` (0.3) × (D − baseline). A calm town makes it a little safer. |
| Discontent → ransomware | Plant attack odds × (1 + `kInsider` (1.0) × max(0, mean D − baseline)). |
| One cyber level | One national level, 0–3, covers plants, rail and suppliers. Each level costs (60 + 45 × level) × the price index. |
| Recovery plan | One purchase ($30M, $3M a month) with the effects of both the old backups and drills. |
| Agency | Your intelligence service also catches spy rings: +5% per agency level. |
| Vetting | Raising a plant to clearance 2 or 3 gives its town's union +2. |
| Exposing a ring | The town's mood −4 (neighbours are arrested). |

## Oversight

| Link | Rule |
|---|---|
| The audit → unions | A "concerns" review gives union strength +3 in every town; a "damning" one gives +5. |
| Prosecuting fraud | The supplier's town's mood −6 (jobs at risk). Settling now carries no such cost. |

## What the player sees

- **People → Towns:** one card per town, showing discontent, work and room to hire (with "mood slows hiring"), mood, and union with its leader. Each card has Build housing and Community fund buttons. The separate Communities and Unions lists and the open day are gone.
- **Rival → Intel:** a Home security section with one cyber row (the odds for plants, rail and suppliers), the recovery plan, and vetting per plant with the town's mood word.

## The autopilot

- **Cyber:** it raises the one cyber level and buys the recovery plan, using the old thresholds.
- **Intelligence:** it grows the agency to level 1 once the rival has two known developments. It never runs operations, as the user chose.
- **Towns:** it funds a town below mood 45 (50 when keeping the peace, 40 on thrift).

## Save compatibility

`fillDefaults` sets every cyber area to the rounded mean of the old three. If a save had backups or drills, it gets the full recovery plan. Running it twice changes nothing. Discontent is never stored, so the save schema is unchanged.

## The user's choices (2026-11-26)

1. One national cyber level, not three areas.
2. The open day is removed.
3. A bad audit stirs the unions.
4. The chief of staff grows the agency to level 1 and runs no operations.
5. **Designer defaults, also taken:**
   - the mood penalty on hiring applies at once, to the room to hire;
   - home security is a section of the Intel tab, not a new tab.

## Deviations from the spec

- The separate cyber and spies hearing questions are kept. Merging them is left for a later pass.
- A cyber promise is still judged by every area at level 2 or more, which is the same as the one national level at 2.

## Balance (full autopilot, 40 seeds)

| Case | 19.0.4 | 19.1 |
|---|---|---|
| Classic, normal | 61.0, 3/40 dismissed | 62.6, 2/40 |
| Generated maps | 64.4, 2/40 | 64.5, 2/40 |
| War footing | 53.1, 3/41 | 54.1, 2/41 |
| Rebuild | 55.7, 3/41 | 56.1, 3/41 |
| Sanctions | 59.0, 3/41 | 57.8, 5/41 |
| Hard | 45.7, 8/41 | 45.2, 8/41 |
| Easy | 69.2, 0/41 | 69.8, 0/41 |

Every case is within the ±3 band.
