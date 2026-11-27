# itch.io: ready to upload (20.0)

Everything needed to put Forge Command on itch.io, prepared but **not uploaded**. Whether and when it goes up is the
owner's decision; nothing in this repository uploads or publishes it.

## The build

```bash
npm run build:itch
```

This writes `release/forge-command-<version>-itch.zip`. The zip has `index.html` at its top, relative paths only (itch
serves each upload from a folder of its own) and no offline service worker. The script checks those three things, and
itch's limits (1,000 files, 200 MB a file), before it zips. The 20.0.0 build is 42 files and 0.7 MB. `dist-itch/` and
`release/` are not committed.

The GitHub Pages site (`npm run build`, base `/forge-command/`) is unchanged and keeps its offline support.

## Images

In `production/launch/itch/`, made by `scripts/store-shots.ts` from the running game (see the script's header to make
them again after a change). Like the rest of `production/`, they stay on the machine that made them and are not
committed; the script makes the same scenes from the same seeds every time.

| File | Size | Use |
|---|---|---|
| `cover.png` | 630×500 | Cover image |
| `1-home-and-map.png` | 1920×1080 | Screenshot: war footing, Home, the advisor and the front |
| `2-arsenal.png` | 1920×1080 | Screenshot: an arsenal's production lines and their parts |
| `3-supply.png` | 1920×1080 | Screenshot: contracts and tenders |
| `4-hearing.png` | 1920×1080 | Screenshot: the budget hearing |
| `5-new-game.png` | 1920×1080 | Screenshot: modes and postings |
| `6-term-report.png` | 1920×1080 | Screenshot: the end-of-term report |

## The page

**Title:** Forge Command

**Short description (the tagline under the title):**
Run a nation's munitions industry, from the mine to the launcher, in real time.

**Classification:** Game · Kind of project: HTML · Release status: Released (or "In development" for a playtest
upload) · Pricing: the owner's choice.

**Genre:** Strategy. **Tags:** strategy, simulation, management, economy, logistics, real-time, singleplayer,
local-multiplayer.

**Embed options:**
- Embed in page, viewport **1280 × 800**. The game needs a window at least 1100 pixels wide.
- Fullscreen button: on. Mobile friendly: off (it is built for a desktop browser with a mouse and keyboard).
- Automatically start on page load: off. Scrollbars: off.

**Description:**

> You are the Director of the Munitions Production Board. The Committee wants a war reserve, the treasury wants value
> for money, the towns want jobs, and the rival across the border is fielding new weapons. Between them stand your
> mines, refineries, plants and arsenals, and the rail, road, sea and air links that join them.
>
> **Build the chain.** Every round is made from parts, and every part from materials. Find the weakest link, fund
> it, open a tender for it, or build a second source before it breaks.
>
> **Answer to the Committee.** Make promises at the budget hearing and keep them. Decide what the Board puts in front
> of you. A bad term ends in a dismissal.
>
> **Read the rival.** It watches what you are short of and builds to exploit it. Research the counter before its
> weapons reach the field.
>
> **Modes:**
> - A guided tutorial.
> - A four-chapter story.
> - Scored campaigns on four scenarios: Peacetime, War footing, Sanctions and Rebuild.
> - A career across terms, on the classic map or a generated country.
> - A sandbox.
> - Two players on one computer.
>
> **A chief of staff** can take any area off your hands, and an advisor always has a next step.
>
> Saves stay in your browser. There is no account and no tracking. To keep a copy, export your save as a file from the
> Load screen.
>
> *A game. The weapon designations and makers are real; every site, company, nation and person is fictional.*

**Controls (for the page's "more information" section):** mouse; Space pauses and runs; 1–4 set the speed; Ctrl K or
/ searches; ? shows every shortcut.

## Before uploading (checklist)

- [ ] `npm run build:itch` passes on the release commit, and the version on the title screen is the one intended.
- [ ] Unzip the zip into a nested folder, serve it, and play a few minutes. Check the title, a new game, a save, and
      that the console shows no errors. (This was done for 20.0.0's build at `/html/1234567/index.html`.)
- [ ] The screenshots match the release. Run `scripts/store-shots.ts` again if the screens have changed.
- [ ] Decide where playtest feedback goes (`docs/playtest.md`). The title screen's "Report a problem" link points at
      the GitHub issues page.
- [ ] Decide on price, release status and visibility on itch.io (draft, restricted or public).
- [ ] Upload the zip as an HTML file marked "This file will be played in the browser", set the embed options above,
      and look at the page in a private window before making it public.
