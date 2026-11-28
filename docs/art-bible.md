# Art bible: Industrial Command

The visual and audio direction for Forge Command, set in 16.0 and finished in 17.2. It is the reference for the browser
version and for the Unreal Engine rebuild. Tokens live in `src/index.css` and `tailwind.config.js`.

## Palette and roles

| Token | Value | Role |
|---|---|---|
| bg | `#070A10` | the page |
| panel / panel2 | `#0D131D` / `#151D2A` | plates, lit from above |
| line | `#28364A` | keylines and borders |
| dim | `#7C8EA8` | secondary text (AA contrast on every panel) |
| text | `#D6DFEB` | reading text |
| **amber** | `#F5B13D` | **command**: titles, primary actions, active tabs, the clock, advice, selection on the map |
| **cyan** | `#38D6F5` | **state**: toggles, live data, your sites' markers. Never used for a title |
| green / red | `#34D399` / `#F2545B` | status: good, bad. Amber doubles as a warning |
| bronze | `#B08448` | trim only: corner brackets, frames, dividers, the insignia, the map's neatline |
| violet | `#A78BFA` | air routes, foreign sites |
| region hues | muted blue, teal, sand, lavender, grey | territory. Status colours never colour territory |

Every colour has an Okabe–Ito twin for the colour-blind palette (Settings, Display).

## Type

- **Display:** Barlow Condensed, uppercase, tracked.

  | Use | Size / tracking |
  |---|---|
  | title | 72px / 0.16em |
  | dialog heading | 26px / 0.12em |
  | panel heading | 15px / 0.12em |
  | group tab | 14px / 0.10em |
  | button | 13px / 0.08em |
  | label | 11px / 0.12em |

- **Reading:** Inter 12.5px, with tabular figures. Map site names are also in Inter.
- **Readouts:** JetBrains Mono, only for map rulers, coordinates and the zoom factor.

## Materials and frames

- **Steel plate:** a top-lit gradient, a white inset highlight, a black keyline, 10px bronze corner brackets and a 2–3px
  radius. Corners are never rounder than 3px; full circles are only for the pause dial and slider thumbs.
- **Heading plate:** an amber left mark and a fading amber wash.
- **Wells** (readouts, inputs, the clock, the status bar) are recessed, with an inner shadow.
- **Map overlays** (`.fc-hud`: the title card, readouts, hover cards, menus, popovers) are small plates with a
  bronze top edge.
- **Dialogs** fade in and rise, with an amber top edge, and an amber kicker over a 26px heading.
- **Site counters** are plated: a shadow under them, a steel face, the owner's rim and a bevel inside it. Squares are
  your sites, circles private firms, diamonds foreign ones.
- **The map** sits in a bronze double neatline with brackets at the corners, and has a bronze north arrow.
- A fine grain at about 5% lies over everything.

## Iconography

- **Grid and stroke:** a 16 grid, 1.5 stroke, round caps.
- **Glyphs:** one idea per glyph, readable at 14px.
- **Text, not symbols:** real weapon designations are always written out, never drawn as invented symbols.
- **Where they live:** `src/ui/icons.tsx` and the site glyphs in `src/ui/map`. They become one family in the Unreal
  port, at a 24 grid.

## Motion

- **Timing:** 120ms for hover and press, 180–220ms for entrances on ease-out (0.2, 0.7, 0.2, 1), 900ms for value glows.
- **Loops:** only for alarms, smoke, beacons, embers and the tutorial's ring. Nothing loops behind text.
- **Accessibility:** all motion stops under reduced motion and the game's own setting.

## Sound

- **Palette:** struck bronze and steel (inharmonic partials) for news, relay clicks and teleprinters for controls and
  intelligence, low brass for the rival, and a klaxon only for a real emergency. The bed is the distant roar of
  furnaces and a drop forge across the valley.
- **Mix:** one context with music and effect buses into a master compressor. Music dips 4–7 dB under important
  sounds. At 4× and 8× routine news is left to the log.
- **Music:** six moods (calm, uneasy, tense, hearing, triumph, sombre). Chords wander rather than loop, there are three
  phrases per mood, it breathes now and then, and there is a stinger on every change of mood.
- **Every sound** also has its line in the log, so nothing is told by sound alone.

## Do and don't

- **Do:** keep amber and cyan to their roles; put every overlay on a plate; collision-check every label.
- **Don't:**
  - no raw colour values in components;
  - nothing rounder than 3px;
  - no bare boxes with heavy shadows;
  - no monospace in prose;
  - no status colours on territory;
  - nothing overlapping.

## For the Unreal port

- **UI materials:** 9-slice textures and a bracket atlas for the plate, the HUD plate, the well, the button (four
  states), the clock plate and the dialog edge.
- **Fonts:** Barlow Condensed (600, 700), Inter (400, 500, 600) and JetBrains Mono (400), as SDF font assets.
- **Icons:** the unified icon set as SVG, then as SDF textures.
- **Map pieces:** site counter meshes or materials (owner frames × kind glyphs × tone rims) and the insignia, plus a
  heightmap, land, water and coast masks, and route line textures.
- **Key art:** the skyline as parallax layers, with smoke, embers and beacons as VFX, plus a matte painting.
- **Look:** a grain overlay, a vignette and a LUT (default and colour-blind), and a palette data table matching the
  tokens above.
- **Audio:** MetaSounds for the procedural layer, music in horizontal sections with intensity layers, and 60–90
  minutes of original score. Assets are named `sfx_ui_speed_up_01` / `mus_crisis_tense_l2_loop`.
