# Studio review: overhauling the graphics, art and design

**Date:** 28 November 2026.

**Status:** for the owner's decision. Nothing here has been built.

**Who:** the studio head (creative director), with the art director, technical artist, lead game designer, UX lead and
audio director.

**How:** each department reviewed the game read-only, from:
- the art bible;
- the design pass (`docs/design-pass.md`);
- the code;
- current screenshots, including a game three months in at 1100 px (`production/qa/evidence/20.8-playtest-1100.jpg`).

The studio head then set one direction from the five reviews.

---

## The direction

> Forge Command should look like a printed operations chart that comes alive where the industry is under strain.
> When things are fine the chart is quiet. Light, colour and sound go only to what is about to break, what the player
> just fixed, and what the Committee is judging.

**The idea that ties it together: light means strain.**

| Department | What it means |
|---|---|
| Art | Amber and glow mean command or trouble, never freight traffic. |
| Design | Strain, cause and effect, and averted shortages become visible. |
| UX | The map shows where to look; the panel is where you decide. |
| Audio | Sound rises with tension and goes quiet when things are calm. |

**What the review saw**, confirmed by the studio head against the 1100 px screenshot:
- The amber freight lines are the loudest thing on the map.
- Every site wears the same teal glyph.
- Readiness opens at 99% beside a red down-arrow on "+0 pts".
- The side panel takes almost half the window.

## The departments' questions, answered

| Question | Studio head's answer | Whose call |
|---|---|---|
| Is the map the play surface or a backdrop? | The play surface. The panel becomes a narrower inspector and decision desk, because the chain only makes sense on the map. | Creative |
| Is the fantasy holding (start won) or climbing (start short)? | Climbing in year 1, holding after: a game that opens at 99% has nothing to show for good play. Prove it on 40+ harness seeds. | Creative, with the balance harness |
| A two-layer map (Canvas base under SVG) or all SVG? | All SVG through Phase 1. Measure a frame budget, then move only terrain, water, weather and shipments to a Canvas layer; markers, labels and the overlap-free layout stay SVG. The chart look must be kept. | The technical director, from measured data |
| Original recorded audio, or procedural only? | Procedural now; original recorded foley (under 3 MB, procedural fallback) in Phase 3. | **Owner** (cost) |

## The plan

### Phase 1: refresh (about 2 weeks; every item is safe on its own)

**What ships, by department:**
- **Technical art:**
  - shipments drawn without React re-rendering each frame, and capped;
  - a measured frame budget (8× speed, 1100 px, a named low-end machine).
- **Art:**
  - freight flows in a neutral warm grey, so amber is kept for command;
  - sites in three sizes by importance, tinted by days of stock;
  - halos behind map labels;
  - the city name cut at the panel edge fixed;
  - the art bible resynced with the code's colour values.
- **UX:**
  - clearer panel hierarchy and 12.5 px reading text;
  - no duplicate figures on Home;
  - the delta arrow agreeing with the number;
  - one rounded value per fact (a site showed the same stock as 22 and 21 days);
  - plain tab names (Decisions, Newspaper, Situation log).
- **Design:**
  - a "shortages averted" ledger in the term report and the news;
  - the advisor pointing at the Committee's ask.
- **Audio:**
  - an original 3–4 note Forge signature, with a minor form for dismissal;
  - a "commit" sound for decisions;
  - slight pitch and level variation;
  - a generated room reverb;
  - triggers keyed to event types instead of the English feed text.
- **Launch:** retake the store screenshots.

**Protect:** the chart look, the palette and type, the colour-blind twins, the decision card, and keyboard access.

**How we'll know it worked:**
- in a five-second test, players name the struggling site;
- the frame budget holds at 8×;
- harness scores do not move.

### Phase 2: the map becomes the play surface (4–6 weeks)

**What ships:**
- **Map:**
  - a strain lens as the default view;
  - link thickness showing volume;
  - the path lighting up when a fix lands;
  - advice targets as numbered pins on the map;
  - status in place (a red-lit plant in a breakdown, winter ice on the sea lanes).
- **Panel:**
  - about 380 px wide, with a wide drawer on demand;
  - Site, Materials, Logistics, Build, Power and Towns become map lenses with an inspector.
- **Design:** climbing in year 1, with the Committee judging progress toward the goal (C1b from the design pass).
- **Decisions and checks:**
  - the two-layer decision is made here, from measured data;
  - a card sort and tree test with 6–8 players comes before the restructure;
  - every old screen name keeps a command-palette alias.

**Protect:** the overlap-free layout, screen-reader landmarks, and "Why short?" and the trace.

**How we'll know it worked:**
- a human beats the chief of staff's harness score (about 62);
- testers find a shortage without opening the panel.

### Phase 3: moments, sites and sound (3–5 weeks)

**What ships:**
- **Big moments:** portrait plates for Committee members, a ceremonial term report, and one "dossier" frame for every
  big dialog.
- **Sites:** illustrated vignettes per plant kind (stacks, smoke, furnace glow), showing condition.
- **Audio:**
  - adaptive music driven by a 0–1 tension value (readiness gap, front, runway, confidence, crisis);
  - a sound family per plant kind;
  - recorded foley if approved.
- **Design:** progressive disclosure, starting with 3 rounds and unlocking more as the rival fields threats.
- **Accessibility:** reduced motion extended to zoom glides and shipments.

**How we'll know it worked:**
- playtesters name the hearing and the term report as high points;
- the game feels as warm as its cover.

**Carries over to Unreal:** the plant art, the heightmap and masks, and the tension value (it maps to MetaSounds).

## What we will not do now

| Idea | Why not now |
|---|---|
| A WebGL or 3D diorama map | It would mean rebuilding the overlap-free labels and accessibility, and it builds a renderer Unreal would replace. |
| A map-only table with no panel, or dockable desk folders | Best designed once, as the Unreal UI. |
| A composed score | Best done once, for both versions. |
| Threat seasons (the rival announces capabilities months ahead) | A change to the core loop, not to presentation. Revisit it after Phase 2's data. |
| Anything that assumes the Unreal port is active again | It is on hold. |

## Risks and guardrails

- **No text or icon overlaps:** every new label, pin and vignette goes through the collision layout (`src/ui/map/layout.ts`),
  with 1100 px screenshots kept as evidence in each phase.
- **Accessibility:** colour is never the only signal; every new glow has a reduced-motion version; keyboard and
  screen-reader checks run on each restructure.
- **Performance:** no phase merges if it breaks the 8× frame budget. Blur and night filters are capped.
- **Balance:** C1b, line efficiency and progressive disclosure each run on 40 or more harness seeds. Judge
  distributions, not single runs.
- **Scope:** every new feature must make strain, cause or prevention visible. If it does not, it is cut.

## Decisions needed from the owner

1. **Approve "light means strain" as the guiding idea?** Recommended: yes.
2. **Ship Phase 1 now, then Phases 2 and 3 in order?** Recommended: yes. That is about 2 + 5 + 4 weeks, and the scope is
   yours to set.
3. **Year 1 as climbing (opening short, judged on progress), holding after?** Recommended: yes, if the harness
   confirms it.
4. **Original recorded foley, under 3 MB, from Phase 3?** Recommended: yes, with a procedural fallback. This is your
   budget call.
5. **Let the technical director decide two-layer versus all-SVG in Phase 2, from the measured budget?** Recommended:
   yes.
6. **Recruit 6–8 players for a card sort and tree test before the Phase 2 restructure?** Recommended: yes.

---

## Appendix: what each department found

### Art director

- **Protect:**
  - the map as a printed operations chart;
  - the disciplined palette and type;
  - the cover's furnace-lit warmth.
- **Problems, by impact:**
  1. the map reads as a diagram, not an industry (about 80 near-identical glyphs);
  2. amber has lost its meaning (freight is amber);
  3. the panel is a wall of same-weight text;
  4. the emotional peaks look like forms;
  5. crowding at 1100 px;
  6. the art bible has drifted from the code.
- **Question raised:** map or panel first?

### Technical artist

- **Keep:**
  - level of detail through CSS;
  - the renderer-independent, collision-checked label layout;
  - memoised static layers;
  - the reduced-motion switches.
- **Limits:**
  - shipments redraw through React every frame with no cap (fix this first whatever is chosen);
  - every pan or zoom frame redraws the whole SVG;
  - blur and night filters are the expensive part;
  - the relief image goes soft at high zoom;
  - reduced motion misses the zoom glides;
  - there is no frame budget.
- **Options:** stay SVG (1–2 weeks), two layers (3–6 weeks, good carry-over to Unreal), or full WebGL (2–4 months, weak
  carry-over).

### Lead game designer

- **Protect:**
  - the chain-legibility tools;
  - politics with consequences;
  - the calm, coherent look.
- **Problems:**
  1. winning looks like nothing happening, because prevention is invisible;
  2. the chain lives in side panels, not on the map;
  3. the advice and the autopilot do much of the deciding (the advice player scores about 54 and the chief of staff
     about 62 with no human input), so player skill is unproven;
  4. the learning load is front-loaded;
  5. cause and effect are far apart.
- **Proposals:**
  - a strain layer;
  - a "shortages averted" ledger;
  - progressive disclosure;
  - line efficiency;
  - C1b;
  - later, threat seasons.
- **What the art must make legible:** strain, throughput, cause and effect, time, which items matter most, and prevention.

### UX lead

- **Protect:**
  - the decision card;
  - the staged big moments;
  - the accessibility base.
- **Problems:**
  1. at 1100 px the fixed 470 px panel leaves the map about 55% of the width;
  2. 26 screens are filed where players won't look, under internal names;
  3. Home is a long list whose top tiles repeat the header, and its text is 11 px;
  4. numbers disagree (a red down-arrow on "+0 pts"; one stock shown as 22d and 21d);
  5. amber flows and look-alike glyphs.
- **Proposals:**
  - a task-based structure (Today, Network, Committee and money, Rival, Reference);
  - a narrower panel with a drawer;
  - pins on the map.

### Audio director

- **Keep:**
  - the bronze, relay and teleprinter palette;
  - the mixing rules (priority, cooldown, hold, quiet at speed, ducking);
  - the generated music with moods and stingers.
- **Problems:**
  - no recurring motif (the new moment cue reuses the success notes);
  - dry, roomless synthesis;
  - no variation between plays of a sound;
  - the player's own decisions get only a click;
  - the music ignores readiness, runway and the front;
  - triggers match English feed text.
- **Proposals:**
  - a signature motif;
  - a commit sound;
  - reverb;
  - adaptive music driven by a tension value;
  - a sound family per plant kind;
  - optionally, original recorded foley.
