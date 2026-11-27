# Release 19.2: Career

A career is a campaign in one country, played term after term. It is open-ended: it ends with dismissal, with a term that fails the Committee's bar, or when you retire. It reuses the second-term machinery: `startSecondTerm` carries the industry over, and boons and grudges come from `legacy.ts`.

| Part | Where |
|---|---|
| Rules | `src/sim/career.ts` |
| Tuning | `src/sim/tuning/career.json` |
| Record kept in this browser | `src/game/career.ts` |
| New-game panel | `src/game/CareerRecord.tsx` |
| The Committee's letter | `src/game/TermReport.tsx` |

## The user's choices (2026-11-26)

1. **Every term is in the same country.**
2. **Unlocks apply in Career mode only.** Campaign and sandbox stay fully open.
3. **Reappointment needs a D (score 42) or better.**
4. **Careers are open-ended.** There is no final term.
5. **Designer defaults:**
   - the readiness mark is capped at 100%, in every mode;
   - an "open every posting" option, with ranks still awarded;
   - the autopilot takes the first boon offered.

## Rules

- **Starting a career.** A career is a four-year campaign with a `careerId` (the only new save field).
- **The letter.** At each term's end the Committee's letter shows:
  - whether you are reappointed;
  - your rank and points, and the grade next term that reaches the next rank;
  - the next unlock;
  - your unfinished business.
- **Serve or retire.** Serve on (`secondTerm`), or retire. Retiring after 3 or more terms earns +40 points.
- **Points:**

  ```
  termPoints = round(score × (1 + 0.15 × (term − 1)) × diffMult × postingMult × (abroad ? 1.05 : 1))   (× 0.5 if dismissed)
  ```

- **Ranks** (`ranks`):

  | Rank | Points |
  |---|---|
  | Acting Director | 0 |
  | Director | 60 |
  | Senior Director | 150 |
  | Director-General | 260 |
  | Permanent Director | 400 |
  | Architect of the Arsenal | 560 |

- **Unlocks** (`unlocks`):

  | Unlock | Needs |
  |---|---|
  | War footing | 1 term completed |
  | Postings abroad and Sanctions | Reaching term 3 |
  | Rebuild and Hard | Director-General, or reaching term 4 |

- **Goals tighten** by one ratchet step a term, as before, up to `termRatchetMax` (3).
- **Readiness ceiling.** The readiness mark is capped at 1.0. Readiness itself is capped at 100% per line, so a higher mark could never be met.

## The late game (why careers needed it)

Measured first: the full autopilot on Normal served three terms in 2% of careers. Term 2 started in decline. Five causes were found and fixed:

1. **A new budget settlement at reappointment** (`budgetRebase`). The Committee funds at least 1.05 × the last three months' running costs, then scales by reputation. Before this, the industry a good first term built cost more than the old budget. The base budget is kept in starting money, and the share of inflation passed on to budgets is now a tuning value (`mandate.json` → `budget.inflationPass`, still 0.7).
2. **Supply planning looks first at what starves the worst lines.** Any line below 30% of target is traced to its tightest part, ahead of the general weak links. A home maker the arsenals can't buy from is qualified before it is grown.
3. **New lines only when they can be supplied.** The autopilot opens a new line (APKWS, Coyote, Javelin) only when no line is starving and the new line's tightest part is at least 70% supplied. Under Sanctions this gate is off, since every part looks short while the bans hold.
4. **Lines far below target expand at their real price,** with a margin, below 30% of target.
5. **Sole sources are saved.** A supplier that is the country's only home source of something is bailed out whenever it can be afforded. The worst collapses traced back to the one iron mine closing: no ore meant no steel, no warheads and no shell bodies.

## Balance (full autopilot)

**Careers, Normal Peacetime, classic map:** 47 of 80 careers served three terms (59%), against 2% before. The spec's target was 70%. The remaining failures are spread across terms 2 and 3, with no single cause.

**Single terms, 40 seeds, against 19.1:**

| Case | 19.1 | 19.2 |
|---|---|---|
| Classic, normal | 62.6, 2/40 dismissed | 63.2, 2/40 |
| Generated maps | 64.5, 2/40 | 66.6, 0/40 |
| War footing | 54.1, 2/41 | 58.0, 1/41 |
| Rebuild | 56.1, 3/41 | 60.1, 2/41 |
| Sanctions | 57.8, 5/41 | 53.2, 5/41 |
| Hard | 45.2, 8/41 | 48.2, 5/41 |
| Easy | 69.8, 0/41 | 70.5, 0/41 |

Sanctions is 4.6 points lower with the same dismissals. Every other case is the same or better.
