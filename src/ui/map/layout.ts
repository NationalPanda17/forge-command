// Collision-free layout for the map: spreads crowded markers apart and places every label so that no text or icon
// overlaps another. All geometry here is in "zoomed" pixels: map km times the zoom S, before the pan offset.

import { CITIES, REGIONS, SITES, SITE_BY_ID, type RegionId, type SiteKind } from '../../sim/world';
import * as G from './geo';
import { KIND_LABEL } from './icons';

export interface Box { x0: number; y0: number; x1: number; y1: number }
export type Anchor = 'start' | 'middle' | 'end';
export interface Placed { x: number; y: number; anchor: Anchor; /** Draw a leader back to the marker. */ lead?: boolean }

export const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';
export const FONT_HEAD = '"Barlow Condensed", "Arial Narrow", system-ui, sans-serif';
/** Site names: a name, not a readout, so the reading face (mono stays for rulers, coordinates and figures). */
export const FONT_BODY = '"Inter", system-ui, sans-serif';

const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const shift = (b: Box, dx: number, dy: number): Box => ({ x0: b.x0 + dx, y0: b.y0 + dy, x1: b.x1 + dx, y1: b.y1 + dy });
const pad = (b: Box, p: number): Box => ({ x0: b.x0 - p, y0: b.y0 - p, x1: b.x1 + p, y1: b.y1 + p });

// ---------- Text measurement ----------

let ctx: CanvasRenderingContext2D | null = null;
const widths = new Map<string, number>();

/** Rendered width of a line of SVG text, in pixels. */
export function textWidth(text: string, size: number, family: string, weight = 400, spacingEm = 0, italic = false): number {
  const key = `${text}|${size}|${family}|${weight}|${spacingEm}|${italic}`;
  const cached = widths.get(key);
  if (cached !== undefined) return cached;
  if (!ctx && typeof document !== 'undefined') ctx = document.createElement('canvas').getContext('2d');
  let w: number;
  if (ctx) {
    ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`;
    w = ctx.measureText(text).width;
  } else w = text.length * size * (family === FONT_MONO ? 0.6 : 0.5);
  w += spacingEm * size * text.length;
  widths.set(key, w);
  return w;
}

/** Forget measured widths, once web fonts have arrived. */
export const resetTextWidths = () => widths.clear();

/** The box of one or more lines of text whose first baseline is at (x, y). */
function textBox(x: number, y: number, anchor: Anchor, w: number, size: number, extraLines: { gap: number; size: number }[] = []): Box {
  const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  let bottom = y + size * 0.3;
  let base = y;
  for (const l of extraLines) {
    base += l.gap;
    bottom = base + l.size * 0.3;
  }
  return { x0: x0 - 1.5, y0: y - size * 0.95 - 1.5, x1: x0 + w + 1.5, y1: bottom + 1.5 };
}

/** Axis-aligned box of a rotated, centred line of text drawn at (cx, cy). */
function rotatedBox(cx: number, cy: number, w: number, size: number, deg: number): Box {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const pts = [
    [-w / 2, -size * 0.95],
    [w / 2, -size * 0.95],
    [w / 2, size * 0.3],
    [-w / 2, size * 0.3],
  ].map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return pad({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }, 1.5);
}

// ---------- Sizes shared with the renderer ----------

export const markerPx = (S: number) => Math.max(11, Math.min(28, 18 + 4 * Math.log2(S)));
/** Shrinks text on small maps (phones). */
export const uiScale = (S: number) => Math.max(0.72, Math.min(1, 0.6 + 0.4 * S));
export const cityDot = (pop: number) => 1.8 + Math.sqrt(pop) / 12;
export const citySize = (pop: number) => 10.5 + 4.5 * Math.max(0, Math.min(1, Math.log(pop / 30) / Math.log(1240 / 30)));
/** Smaller towns are unlabelled on very small maps. */
export const cityLabelled = (pop: number, S: number) => S >= 0.5 || pop >= 100;
/** Half the size of a city's dot (and capital ring), in pixels. */
const cityRadius = (pop: number, capital: boolean | undefined, u: number) => (cityDot(pop) + (capital ? 3.2 : 0) + 0.8) * u;

export const SITE_FONT = 10;
export const SITE_SUB_FONT = 8.5;
export const SITE_SUB_GAP = 12;
/** Off-map arrow half-size, and caption line spacing. */
export const EXIT_R = 8.5;
/** The arrow is drawn 14 px long behind the point where the lane leaves the sheet. */
const exitCentre = (e: G.OffMapExit, S: number): [number, number] => {
  const u = uiScale(S);
  return [e.at[0] * S - Math.cos(e.angle) * 7 * u, e.at[1] * S - Math.sin(e.angle) * 7 * u];
};
export const EXIT_FIRST_GAP = 13.5;
export const EXIT_LINE_GAP = 12.5;

// ---------- Markers ----------

/** Badge pill footprint relative to a marker centre, for a marker of half-size h. */
export const badgeBox = (h: number, badge: string): Box => ({ x0: h - 2.5, y0: -h - 10, x1: h - 2 + 8 + badge.length * 5.6 + 0.5, y1: -h + 4 });

/**
 * Screen offsets that pull crowded markers apart so no two icons touch. Cities and the off-map arrows stay put and
 * push markers off them too. Deterministic for a zoom level and set of badges.
 */
export function spreadMarkers(S: number, badges: Record<string, string | undefined> = {}, hidden: ReadonlySet<string> = NO_HIDDEN): Record<string, [number, number]> {
  const m = markerPx(S);
  const u = uiScale(S);
  const e = m / 2 + 3;
  interface Body { id: string | null; x: number; y: number; ox: number; oy: number; ext: Box }
  const bodies: Body[] = SITES.filter((s) => !hidden.has(s.id)).map((s) => {
    const [x, y] = G.SITE_POS[s.id];
    const ext: Box = { x0: -e, y0: -e, x1: e, y1: e };
    const b = badges[s.id];
    if (b) {
      const bb = badgeBox(m / 2, b);
      ext.x1 = Math.max(ext.x1, bb.x1 + 1);
      ext.y0 = Math.min(ext.y0, bb.y0 - 1);
    }
    return { id: s.id, x: x * S, y: y * S, ox: x * S, oy: y * S, ext };
  });
  const fixed: Body[] = [
    ...CITIES.map((c) => {
      const r = cityRadius(c.pop, c.capital, u) + 1;
      return { id: null, x: c.x * S, y: c.y * S, ox: 0, oy: 0, ext: { x0: -r, y0: -r, x1: r, y1: r } };
    }),
    ...G.OFF_MAP_EXITS.map((x) => {
      const [cx, cy] = exitCentre(x, S);
      const r = EXIT_R * u + 1;
      return { id: null, x: cx, y: cy, ox: 0, oy: 0, ext: { x0: -r, y0: -r, x1: r, y1: r } };
    }),
  ];
  for (let iter = 0; iter < 400; iter++) {
    let moved = false;
    // Marker pairs first, then fixed things, so towns and arrows always win the last push.
    const pairs: [number, number][] = [];
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) pairs.push([i, j]);
    for (let i = 0; i < bodies.length; i++) for (let j = 0; j < fixed.length; j++) pairs.push([i, bodies.length + j]);
    for (const [i, j] of pairs) {
      {
        const a = bodies[i];
        const b = j < bodies.length ? bodies[j] : fixed[j - bodies.length];
        const px = Math.min(a.x + a.ext.x1, b.x + b.ext.x1) - Math.max(a.x + a.ext.x0, b.x + b.ext.x0) + 1;
        const py = Math.min(a.y + a.ext.y1, b.y + b.ext.y1) - Math.max(a.y + a.ext.y0, b.y + b.ext.y0) + 1;
        if (px <= 0 || py <= 0) continue;
        moved = true;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        if (dx === 0 && dy === 0) {
          // Identical spots: split along a fixed, index-based direction.
          const t = ((i * 7 + j * 13) % 8) * (Math.PI / 4);
          dx = Math.cos(t);
          dy = Math.sin(t);
        }
        // Push along the cheaper axis, which keeps markers close to home.
        // If markers are wedged between fixed things, slide them sideways instead.
        const alongX = iter < 150 ? px < py : px >= py;
        const amt = (alongX ? px : py) + 0.2;
        const sx = alongX ? Math.sign(dx) || 1 : 0;
        const sy = alongX ? 0 : Math.sign(dy) || 1;
        if (b.id === null) {
          a.x -= sx * amt;
          a.y -= sy * amt;
        } else {
          a.x -= (sx * amt) / 2;
          a.y -= (sy * amt) / 2;
          b.x += (sx * amt) / 2;
          b.y += (sy * amt) / 2;
        }
      }
    }
    if (!moved) break;
  }
  // Anything still wedged moves to the nearest spot that is clear of everything else.
  const touches = (a: Body, x: number, y: number) =>
    [...bodies, ...fixed].some(
      (b) => b !== a && Math.min(x + a.ext.x1, b.x + b.ext.x1) - Math.max(x + a.ext.x0, b.x + b.ext.x0) > -1 && Math.min(y + a.ext.y1, b.y + b.ext.y1) - Math.max(y + a.ext.y0, b.y + b.ext.y0) > -1,
    );
  for (const a of bodies) {
    if (!touches(a, a.x, a.y)) continue;
    search: for (let rad = 2; rad <= 120; rad += 2) {
      for (let k = 0; k < 24; k++) {
        const t = (k / 24) * Math.PI * 2;
        const x = a.x + Math.cos(t) * rad;
        const y = a.y + Math.sin(t) * rad;
        if (!touches(a, x, y)) {
          a.x = x;
          a.y = y;
          break search;
        }
      }
    }
  }
  const out: Record<string, [number, number]> = {};
  for (const b of bodies) out[b.id!] = [b.x - b.ox, b.y - b.oy];
  return out;
}

export const NO_HIDDEN: ReadonlySet<string> = new Set();

/** Where a site's marker centre is drawn, in zoomed pixels. */
export const markerAt = (id: string, S: number, spread: Record<string, [number, number]>): [number, number] => {
  const [x, y] = G.SITE_POS[id];
  const d = spread[id] ?? [0, 0];
  return [x * S + d[0], y * S + d[1]];
};

// ---------- Labels ----------

export interface ExitGroup {
  key: string;
  nation: string;
  arrow: string;
  names: string[];
  /** Where the caption block hangs from, in map km. */
  at: G.Pt;
  /** Caption position in pixels relative to `at`, or null when there is no room. */
  placed: Placed | null;
  showNames: boolean;
}

export interface Layout {
  sites: Record<string, Placed>;
  cities: (Placed | null)[];
  /** Visible geographic labels, with their pixel nudge from the authored spot. */
  geo: (null | [number, number])[];
  regions: Partial<Record<RegionId, [number, number]>>;
  exits: ExitGroup[];
  /** Everything drawn, for the screen furniture to keep clear of. */
  boxes: Box[];
}

export interface LayoutInput {
  S: number;
  lod: number;
  labels: boolean;
  regions: boolean;
  /** Sites to label, most important first. */
  order: string[];
  /** Sites whose label shows a second line (selected, hovered, focused). */
  hot: string[];
  selected: string | null;
  /** Badge text per site, as it affects the marker's footprint. */
  badges: Record<string, string | undefined>;
  spread: Record<string, [number, number]>;
  /** Sites not drawn at all (open plots outside build mode). */
  hidden?: ReadonlySet<string>;
  /** Names and kinds that differ from the defaults (founded plants). */
  names?: Record<string, string>;
  kinds?: Record<string, SiteKind>;
}

export function layoutMap(inp: LayoutInput): Layout {
  const { S, lod, spread } = inp;
  const u = uiScale(S);
  const m = markerPx(S);
  const h = m / 2;
  const taken: Box[] = [];
  const hidden = inp.hidden ?? NO_HIDDEN;
  const free = (b: Box) => !taken.some((t) => hit(b, t));
  const take = (b: Box) => taken.push(b);
  // Text never leaves the map sheet: on a small screen a spot past its edge is cut off.
  const sheet = { x0: G.FRAME.x0 * S, y0: G.FRAME.y0 * S, x1: G.FRAME.x1 * S, y1: G.FRAME.y1 * S };
  const onSheet = (b: Box) => b.x0 >= sheet.x0 && b.x1 <= sheet.x1 && b.y0 >= sheet.y0 && b.y1 <= sheet.y1;

  // Icons first: markers (with their badges and selection brackets), city dots and the off-map arrows.
  for (const s of SITES) {
    if (hidden.has(s.id)) continue;
    const [x, y] = markerAt(s.id, S, spread);
    const e = s.id === inp.selected ? h + 7 : h + 2.5;
    take({ x0: x - e, y0: y - e, x1: x + e, y1: y + e });
    const badge = inp.badges[s.id];
    if (badge) take(shift(badgeBox(h, badge), x, y));
  }
  CITIES.forEach((c) => {
    const r = cityRadius(c.pop, c.capital, u);
    take({ x0: c.x * S - r, y0: c.y * S - r, x1: c.x * S + r, y1: c.y * S + r });
  });
  for (const e of G.OFF_MAP_EXITS) {
    const r = EXIT_R * u;
    const [cx, cy] = exitCentre(e, S);
    take({ x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r });
  }

  /** Tries candidate spots in order and keeps the first that touches nothing. */
  const place = <T,>(cands: { v: T; box: Box }[]): T | null => {
    for (const c of cands) {
      if (free(c.box)) {
        take(c.box);
        return c.v;
      }
    }
    return null;
  };

  // Site labels: eight spots around the marker.
  const sites: Record<string, Placed> = {};
  const placeSite = (id: string) => {
    const s = SITE_BY_ID[id];
    if (!s || hidden.has(id)) return;
    const name = inp.names?.[id] ?? s.name;
    const [x, y] = markerAt(id, S, spread);
    const isHot = inp.hot.includes(id);
    const w0 = textWidth(name, SITE_FONT, FONT_BODY, isHot ? 700 : 500);
    const sub = isHot ? kindLine(id, inp.kinds?.[id]) : '';
    const w = Math.max(w0, sub ? textWidth(sub, SITE_SUB_FONT, FONT_BODY, 500, 0.1) : 0);
    const extra = sub ? [{ gap: SITE_SUB_GAP, size: SITE_SUB_FONT }] : [];
    const tall = sub ? SITE_SUB_GAP : 0;
    const g = (id === inp.selected ? h + 8 : h + 4);
    const base = SITE_FONT * 0.35;
    const spots: [number, number, Anchor][] = [
      [g, base - tall / 2, 'start'],
      [-g, base - tall / 2, 'end'],
      [0, g + SITE_FONT * 0.95, 'middle'],
      [0, -g - SITE_FONT * 0.3 - tall, 'middle'],
      [g * 0.8, -g * 0.55 - tall, 'start'],
      [g * 0.8, g * 0.55 + SITE_FONT * 0.95, 'start'],
      [-g * 0.8, -g * 0.55 - tall, 'end'],
      [-g * 0.8, g * 0.55 + SITE_FONT * 0.95, 'end'],
    ];
    const cands = spots.map(([dx, dy, anchor]) => ({ v: { x: dx, y: dy, anchor } as Placed, box: textBox(x + dx, y + dy, anchor, w, SITE_FONT, extra) }));
    // The site you are looking at always gets a label: search further out, with a leader back to the marker.
    if (isHot)
      for (let r = g + 12; r <= g + 220; r += 10)
        for (let k = 0; k < 16; k++) {
          const t = (k / 16) * Math.PI * 2;
          const cx = Math.cos(t) * r;
          const cy = Math.sin(t) * r;
          const anchor: Anchor = cx > 4 ? 'start' : cx < -4 ? 'end' : 'middle';
          const dy = cy + base - tall / 2;
          cands.push({ v: { x: cx, y: dy, anchor, lead: true }, box: textBox(x + cx, y + dy, anchor, w, SITE_FONT, extra) });
        }
    const inside = cands.filter((c) => onSheet(c.box));
    const p = place(inside.length ? inside : cands);
    if (p) sites[id] = p;
  };

  // 1. The sites you are looking at.
  for (const id of inp.order) if (inp.hot.includes(id)) placeSite(id);

  // 2. Region names, when that overlay is on.
  const regions: Partial<Record<RegionId, [number, number]>> = {};
  if (inp.regions) {
    for (const r of Object.keys(G.REGION_LABEL_AT) as RegionId[]) {
      const [x, y] = G.REGION_LABEL_AT[r];
      const fs = 14 * u;
      const w = textWidth(REGIONS[r].name.toUpperCase(), fs, FONT_HEAD, 700, 0.2);
      const nudges: [number, number][] = [[0, 0], [0, -18], [0, 18], [-40, 0], [40, 0], [0, -36], [0, 36], [-80, 0], [80, 0]];
      const v = place(nudges.map(([dx, dy]) => ({ v: [dx, dy] as [number, number], box: textBox(x * S + dx, y * S + dy, 'middle', w, fs) })));
      if (v) regions[r] = v;
    }
  }

  // 3. Foreign suppliers, one caption per nation and sheet edge.
  const groups = new Map<string, G.OffMapExit[]>();
  for (const e of G.OFF_MAP_EXITS) {
    const side = sideOf(e.at);
    const k = `${e.nation}|${side}`;
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  const exits: ExitGroup[] = [];
  for (const [key, list] of groups) {
    const side = sideOf(list[0].at);
    const at: G.Pt = [list.reduce((a, e) => a + e.at[0], 0) / list.length, list.reduce((a, e) => a + e.at[1], 0) / list.length];
    const nation = list[0].nation.toUpperCase();
    const arrow = side === 'w' ? `← ${nation}` : side === 'e' ? `${nation} →` : side === 'n' ? `↑ ${nation}` : `↓ ${nation}`;
    const names = list.map((e) => e.name);
    const anchor: Anchor = side === 'e' ? 'end' : 'start';
    const fs = 12 * u;
    const ns = 9.5 * u;
    const try1 = (showNames: boolean) => {
      const w = Math.max(textWidth(arrow, fs, FONT_HEAD, 700, 0.12), ...(showNames ? names.map((n) => textWidth(n, ns, FONT_MONO)) : [0]));
      const extra = showNames ? names.map((_, i) => ({ gap: (i === 0 ? EXIT_FIRST_GAP : EXIT_LINE_GAP) * u, size: ns })) : [];
      const tall = showNames ? (EXIT_FIRST_GAP + (names.length - 1) * EXIT_LINE_GAP) * u : 0;
      const base: [number, number] = side === 'w' ? [30, -14] : side === 'e' ? [-30, -14] : side === 'n' ? [22, 22] : [24, -22 - tall / u];
      const along: [number, number] = side === 'n' || side === 's' ? [1, 0] : [0, 1];
      const steps = [0, 30, -30, 60, -60, 100, -100, 150, -150];
      return place(
        steps.map((d) => {
          const dx = (base[0] + along[0] * d) * u;
          const dy = (base[1] + along[1] * d) * u;
          return { v: { x: dx, y: dy, anchor } as Placed, box: textBox(at[0] * S + dx, at[1] * S + dy, anchor, w, fs, extra) };
        })
          // Never past the sheet's left or right edge, where a phone screen cuts it off.
          .filter((c) => c.box.x0 >= sheet.x0 && c.box.x1 <= sheet.x1),
      );
    };
    let showNames = S >= 0.6;
    let placed = try1(showNames);
    if (!placed && showNames) {
      showNames = false;
      placed = try1(false);
    }
    exits.push({ key, nation, arrow, names, at, placed, showNames });
  }

  // 4. Cities, biggest first.
  const cities: (Placed | null)[] = CITIES.map(() => null);
  const placeCity = (i: number) => {
    const c = CITIES[i];
    if (!cityLabelled(c.pop, S)) return;
    const fs = citySize(c.pop) * u;
    const big = c.pop >= 200;
    const text = big ? c.name.toUpperCase() : c.name;
    const w = textWidth(text, fs, FONT_HEAD, big ? 700 : 600, big ? 0.08 : 0.02);
    const r = cityRadius(c.pop, c.capital, u);
    const x = c.x * S;
    const y = c.y * S;
    const spots: [number, number, Anchor][] = [
      [r + 3, fs * 0.33, 'start'],
      [-r - 3, fs * 0.33, 'end'],
      [0, -r - 3 - fs * 0.3, 'middle'],
      [0, r + 2 + fs * 0.95, 'middle'],
      [r + 2, -r - fs * 0.2, 'start'],
      [r + 2, r + fs * 0.9, 'start'],
      [-r - 2, -r - fs * 0.2, 'end'],
      [-r - 2, r + fs * 0.9, 'end'],
    ];
    cities[i] = place(spots.map(([dx, dy, anchor]) => ({ v: { x: dx, y: dy, anchor } as Placed, box: textBox(x + dx, y + dy, anchor, w, fs) })));
  };
  const byPop = CITIES.map((c, i) => ({ c, i })).sort((a, b) => b.c.pop - a.c.pop);
  for (const { c, i } of byPop) if (c.pop >= 200) placeCity(i);

  // 5. Seas, uplands and the neighbour, nudged along their line if something is in the way.
  const geo: (null | [number, number])[] = G.GEO_LABELS.map(() => null);
  const placeGeo = (i: number) => {
    const l = G.GEO_LABELS[i];
    const fs = (l.size + (l.kind === 'sea' || l.kind === 'nation' ? 1 : 0)) * u;
    const mono = l.kind === 'water' || l.kind === 'island';
    const w = textWidth(l.text, fs, mono ? FONT_MONO : FONT_HEAD, mono ? 400 : 600, l.spacing ?? 0, l.kind === 'sea' || l.kind === 'water' || l.kind === 'relief');
    const a = ((l.rot ?? 0) * Math.PI) / 180;
    const t: [number, number] = [Math.cos(a), Math.sin(a)];
    const n: [number, number] = [-Math.sin(a), Math.cos(a)];
    const nudges: [number, number][] = [[0, 0], [24, 0], [-24, 0], [0, -12], [0, 12], [50, 0], [-50, 0], [80, 0], [-80, 0], [0, -24], [0, 24], [120, 0], [-120, 0]];
    // A sea or upland name is scenery: left out rather than cut off at the sheet's edge.
    geo[i] = place(
      nudges
        .map(([along, across]) => {
          const dx = t[0] * along + n[0] * across;
          const dy = t[1] * along + n[1] * across;
          return { v: [dx, dy] as [number, number], box: rotatedBox(l.at[0] * S + dx, l.at[1] * S + dy, w, fs, l.rot ?? 0) };
        })
        .filter((c) => onSheet(c.box)),
    );
  };
  if (inp.labels) G.GEO_LABELS.forEach((l, i) => l.lod === 0 && l.lod <= lod && placeGeo(i));

  // 6. Towns.
  for (const { c, i } of byPop) if (c.pop < 200) placeCity(i);

  // 7. The other site labels, then the small water and island names.
  for (const id of inp.order) if (!inp.hot.includes(id)) placeSite(id);
  if (inp.labels) G.GEO_LABELS.forEach((l, i) => l.lod > 0 && l.lod <= lod && placeGeo(i));

  return { sites, cities, geo, regions, exits, boxes: taken };
}

/** The second line shown under a site you are looking at. */
export function kindLine(id: string, kind?: SiteKind): string {
  const s = SITE_BY_ID[id];
  return s ? `${KIND_LABEL[kind ?? s.kind].toUpperCase()} · ${REGIONS[s.region].name.toUpperCase()}` : '';
}

function sideOf(at: G.Pt): 'n' | 's' | 'w' | 'e' {
  return at[1] <= G.FRAME.y0 + 0.5 ? 'n' : at[1] >= G.FRAME.y1 - 0.5 ? 's' : at[0] <= G.FRAME.x0 + 0.5 ? 'w' : 'e';
}

/** True when a box in screen pixels touches anything the layout drew. */
export function clashes(b: Box, boxes: Box[], tx: number, ty: number): boolean {
  const z = shift(b, -tx, -ty);
  return boxes.some((t) => hit(z, t));
}

/** Box for a short line of furniture text at screen (x, y). */
export function smallTextBox(text: string, x: number, y: number, size: number, anchor: Anchor = 'start'): Box {
  return textBox(x, y, anchor, textWidth(text, size, FONT_MONO), size);
}
