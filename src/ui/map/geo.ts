// Geography for the map. The hand-placed classic country (the Commonwealth of Aldmere) is the template: a generated
// world is the same template seen through a smooth seeded warp, with its own mountains, forests and names.
// Everything is deterministic. Units are km, matching src/sim/world.ts. Rebuilt whenever the world changes.

import { CITIES, ROUTES, ROUTE_KEY, SITES, SITE_BY_ID, type Mode, type RegionId, CANDIDATE_ROUTES } from '../../sim/world';
import { onWorldChange, registerPlaceTexts, tr, unwarp, warp, warpPt, worldSeed } from '../../sim/worldgen';

export type Pt = [number, number];

/** The map sheet. Anything outside is drawn as "off map". */
export const FRAME = { x0: 0, y0: -10, x1: 980, y1: 690 };
export const FRAME_W = FRAME.x1 - FRAME.x0;
export const FRAME_H = FRAME.y1 - FRAME.y0;

// ---------- Random and noise ----------

export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function vnoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, y: number, oct: number, seed: number): number {
  let amp = 0.5;
  let f = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise(x * f, y * f, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

function ridged(x: number, y: number, oct: number, seed: number): number {
  let amp = 0.5;
  let f = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    const n = 1 - Math.abs(2 * vnoise(x * f, y * f, seed + i * 31) - 1);
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5;
    f *= 2.1;
  }
  return sum / norm;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const blob = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return Math.exp(-(dx * dx + dy * dy));
};

function distToPolyline(x: number, y: number, pl: Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < pl.length - 1; i++) {
    const [ax, ay] = pl[i];
    const [bx, by] = pl[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    const d = Math.hypot(x - ax - t * dx, y - ay - t * dy);
    if (d < best) best = d;
  }
  return best;
}

// ---------- Elevation ----------

const KARROW_RIDGE: Pt[] = [[590, 645], [650, 602], [720, 580], [790, 566], [850, 576], [905, 596], [1000, 588]];

/** Mountain ranges this world adds, in classic coordinates. */
let worldRidges: { line: Pt[]; h: number }[] = [];

/** Relative elevation, roughly 0 (coastal plain) to 1.2 (the highest summits), in this world's coordinates. */
export function elev(x: number, y: number): number {
  const [u, v] = unwarp(x, y);
  const seed = worldSeed();
  if (!seed) return elevClassic(u, v);
  let h = elevClassic(u, v) * (0.7 + 0.6 * fbm(u / 170, v / 170, 2, seed % 9973));
  for (const r of worldRidges) {
    const d = distToPolyline(u, v, r.line);
    h += Math.exp(-(d * d) / (38 * 38)) * r.h * (0.35 + 0.65 * ridged(u / 16, v / 16, 4, seed % 7919));
  }
  return Math.max(0, h);
}

function elevClassic(x: number, y: number): number {
  let h = 0.03 + 0.1 * fbm(x / 55, y / 55, 4, 11);
  // Eastern uplands rise toward the border.
  h += smoothstep(520, 900, x) * (0.1 + 0.14 * fbm(x / 35, y / 35, 3, 23));
  // Brennock hills.
  h += blob(x, y, 565, 198, 92, 58) * (0.2 + 0.32 * ridged(x / 22, y / 22, 4, 31));
  // Velm plateau: a flat top behind a scarp.
  const wx = x + (fbm(x / 30, y / 30, 3, 43) - 0.5) * 70;
  const wy = y + (fbm(x / 30 + 9, y / 30, 3, 47) - 0.5) * 70;
  const v = blob(wx, wy, 815, 405, 62, 50);
  h += smoothstep(0.2, 0.6, v) * 0.26 + v * (0.06 + 0.16 * ridged(x / 14, y / 14, 4, 41));
  // Karrow range.
  const d = distToPolyline(x, y, KARROW_RIDGE);
  h += Math.exp(-(d * d) / (44 * 44)) * (0.32 + 0.55 * ridged(x / 16, y / 16, 5, 53));
  // Low ground along the river valleys.
  h -= 0.05 * Math.exp(-(distToPolyline(x, y, VARN_CTRL) ** 2) / 300);
  return Math.max(0, h);
}

// ---------- Coastlines ----------

/** x, y and the roughness of the segment starting at this point. */
type Ctrl = [number, number, number];

function displace(a: Pt, b: Pt, rough: number, rng: () => number, minLen: number, out: Pt[]) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < minLen || rough <= 0) {
    out.push(b);
    return;
  }
  const off = (rng() * 2 - 1) * rough * len;
  const m: Pt = [(a[0] + b[0]) / 2 - (dy / len) * off, (a[1] + b[1]) / 2 + (dx / len) * off];
  displace(a, m, rough, rng, minLen, out);
  displace(m, b, rough, rng, minLen, out);
}

function fractalRing(ctrl: Ctrl[], seed: number, minLen = 2): Pt[] {
  const rng = mulberry32(seed);
  const out: Pt[] = [[ctrl[0][0], ctrl[0][1]]];
  for (let i = 0; i < ctrl.length; i++) {
    const a = ctrl[i];
    const b = ctrl[(i + 1) % ctrl.length];
    displace([a[0], a[1]], [b[0], b[1]], a[2], rng, minLen, out);
  }
  out.pop();
  return out;
}

function fractalLine(ctrl: Pt[], rough: number, seed: number, minLen = 2): Pt[] {
  const rng = mulberry32(seed);
  const out: Pt[] = [ctrl[0]];
  for (let i = 0; i < ctrl.length - 1; i++) displace(ctrl[i], ctrl[i + 1], rough, rng, minLen, out);
  return out;
}

function blobRing(cx: number, cy: number, r: number, seed: number, n = 9, rough = 0.18, minLen = 1): Pt[] {
  const rng = mulberry32(seed);
  const ctrl: Ctrl[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.3;
    const rr = r * (0.72 + rng() * 0.5);
    ctrl.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.85, rough]);
  }
  return fractalRing(ctrl, seed * 7 + 1, minLen);
}

// Mainland (Aldmere plus the Vardan sliver), clockwise from the north-west.
const MAINLAND: Ctrl[] = [
  [122, 82, 0.2], [134, 58, 0.2], [160, 44, 0.22], [200, 40, 0.22], [240, 37, 0.22], [285, 40, 0.2], [325, 37, 0.15], [348, 40, 0.06],
  // Riverline estuary between the Port of Meric and the air defense sector
  [362, 40, 0.04], [372, 43, 0.04], [379, 50, 0.03], [385, 55, 0.03], [391, 50, 0.04], [399, 47, 0.05], [410, 50, 0.08], [424, 46, 0.2],
  [460, 43, 0.22], [505, 46, 0.22], [545, 38, 0.22], [585, 44, 0.22], [625, 36, 0.22], [665, 43, 0.22], [705, 37, 0.22], [745, 45, 0.22],
  [790, 39, 0.22], [835, 46, 0.22], [880, 38, 0.22], [925, 43, 0.22], [965, 38, 0.2], [1010, 44, 0],
  [1010, 662, 0],
  [965, 660, 0.22], [925, 665, 0.22], [885, 652, 0.22], [845, 661, 0.22], [805, 650, 0.22], [765, 657, 0.22], [725, 646, 0.22],
  [685, 654, 0.22], [645, 644, 0.22], [605, 656, 0.22], [565, 647, 0.22], [525, 656, 0.22], [485, 646, 0.22], [445, 653, 0.2], [405, 642, 0.15],
  // Lowmouth: the Varn mouth and the port
  [372, 643, 0.06], [358, 638, 0.04], [350, 635, 0.03], [342, 631, 0.03], [332, 631, 0.04], [318, 628, 0.1],
  [298, 622, 0.18], [280, 616, 0.2], [262, 606, 0.2], [246, 588, 0.18], [226, 573, 0.12], [206, 568, 0.15], [186, 560, 0.2],
  [168, 550, 0.2], [150, 534, 0.2], [135, 515, 0.2], [121, 492, 0.2], [108, 470, 0.18], [102, 450, 0.15], [104, 430, 0.12],
  [107, 412, 0.15], [112, 395, 0.12], [116, 378, 0.12], [120, 362, 0.15], [125, 345, 0.15], [129, 328, 0.12], [133, 312, 0.08],
  // Halvard bay
  [140, 303, 0.05], [148, 297, 0.04], [154, 291, 0.03], [158, 284, 0.03], [154, 276, 0.04], [146, 268, 0.05], [136, 260, 0.08],
  [127, 248, 0.12], [123, 232, 0.15], [121, 214, 0.18], [117, 195, 0.2], [114, 175, 0.2], [112, 150, 0.2], [114, 125, 0.2], [118, 103, 0.2],
];

// Skerry Isles: Holm (harbour), Great Skerry (town and depot), Fennick (air base).
const HOLM: Ctrl[] = [[112, 600, 0.12], [114, 591, 0.12], [124, 585, 0.14], [137, 586, 0.14], [146, 594, 0.12], [141, 602, 0.06], [131, 603.5, 0.05], [120, 604, 0.06]];
const GREAT_SKERRY: Ctrl[] = [[93, 628, 0.12], [96, 621, 0.12], [101, 614, 0.08], [109, 610, 0.05], [118, 609.5, 0.05], [126, 611, 0.12], [129, 618, 0.14], [123, 624, 0.14], [113, 628, 0.12], [105, 633, 0.1], [97, 634, 0.1]];
const FENNICK: Ctrl[] = [[70, 646, 0.12], [73, 640, 0.1], [80, 636, 0.06], [89, 637, 0.06], [96, 641, 0.1], [97, 647, 0.12], [90, 652, 0.12], [79, 653, 0.12]];

const ISLETS: [number, number, number][] = [
  [152, 628, 4], [58, 622, 3], [140, 652, 3.5], [76, 602, 2.5], [60, 668, 3], [168, 646, 2.2], [44, 640, 2],
  [620, 24, 4], [250, 22, 3], [268, 16, 1.8], [470, 672, 4], [560, 676, 3], [820, 674, 3.5], [60, 250, 3.5], [70, 420, 3],
  [45, 520, 4], [890, 22, 3], [700, 18, 2.2], [80, 120, 2.5],
];

const wc = (c: Ctrl): Ctrl => {
  const [x, y] = warp(c[0], c[1]);
  return [x, y, c[2]];
};
/** Mixes the world seed into a fixed detail seed, so each world has its own coastline wiggles. */
const mix = (n: number) => (worldSeed() ? (n * 31 + (worldSeed() % 99991)) | 0 : n);

export let MAINLAND_RING: Pt[] = [];
export let ISLAND_RINGS: Pt[][] = [];
export let LAND_RINGS: Pt[][] = [];

// ---------- Path helpers ----------

const f1 = (n: number) => (Math.round(n * 10) / 10).toString();

export function ringPath(r: Pt[]): string {
  let s = `M${f1(r[0][0])} ${f1(r[0][1])}`;
  for (let i = 1; i < r.length; i++) s += `L${f1(r[i][0])} ${f1(r[i][1])}`;
  return s + 'Z';
}
export function linePath(r: Pt[]): string {
  let s = `M${f1(r[0][0])} ${f1(r[0][1])}`;
  for (let i = 1; i < r.length; i++) s += `L${f1(r[i][0])} ${f1(r[i][1])}`;
  return s;
}

/** Catmull-Rom through the points, sampled densely. */
export function smoothLine(p: Pt[], samples = 6): Pt[] {
  if (p.length < 3) return p.slice();
  const out: Pt[] = [];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[Math.min(p.length - 1, i + 2)];
    for (let k = 0; k < samples; k++) {
      const t = k / samples;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(p[p.length - 1]);
  return out;
}

export function polyLen(p: Pt[]): number {
  let s = 0;
  for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return s;
}

export function pointInRing(x: number, y: number, r: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i];
    const [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Fast inside test for many points: crossing lists per scan row. */
function scanMask(rings: Pt[][], step: number): (x: number, y: number) => boolean {
  const y0 = FRAME.y0 - 20;
  const rows = Math.ceil((FRAME_H + 40) / step);
  const xs: number[][] = [];
  for (let k = 0; k <= rows; k++) {
    const y = y0 + k * step + 1e-4;
    const row: number[] = [];
    for (const r of rings) {
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i];
        const [xj, yj] = r[j];
        if (yi > y !== yj > y) row.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
      }
    }
    row.sort((a, b) => a - b);
    xs.push(row);
  }
  return (x, y) => {
    const k = Math.round((y - y0) / step);
    const row = xs[k];
    if (!row) return false;
    let n = 0;
    for (const v of row) {
      if (v > x) break;
      n++;
    }
    return n % 2 === 1;
  };
}

export let onLand: (x: number, y: number) => boolean = () => false;

// ---------- Rivers and lakes ----------

const VARN_CTRL: Pt[] = [
  [776, 366], [742, 362], [706, 377], [668, 372], [632, 388], [598, 379], [560, 368], [528, 373], [492, 366], [458, 376],
  [432, 374], [418, 372], [404, 382], [394, 404], [374, 426], [367, 446], [372, 472], [362, 500], [366, 530], [353, 560], [357, 590], [351, 614], [354, 637],
];

interface RiverDef { name?: string; order: 1 | 2 | 3; ctrl: Pt[] }

const RIVER_DEFS: RiverDef[] = [
  { name: 'Varn', order: 1, ctrl: VARN_CTRL },
  {
    name: 'Riverline', order: 1,
    ctrl: [[728, 136], [692, 122], [652, 112], [612, 104], [578, 110], [542, 100], [506, 105], [478, 103], [450, 97], [424, 92], [406, 80], [396, 67], [388, 60], [385, 55]],
  },
  { name: 'Corran Water', order: 2, ctrl: [[528, 232], [496, 247], [462, 254], [440, 262], [428, 290], [421, 322], [426, 352], [432, 374]] },
  { order: 2, ctrl: [[588, 166], [576, 140], [561, 120], [548, 102]] },
  { name: 'Hollin Burn', order: 2, ctrl: [[652, 258], [642, 298], [632, 338], [628, 362], [632, 388]] },
  { name: 'Tarn Beck', order: 2, ctrl: [[722, 540], [706, 500], [693, 466], [688, 428], [676, 396], [668, 372]] },
  { name: 'Hal', order: 2, ctrl: [[302, 342], [270, 318], [236, 304], [196, 292], [158, 284]] },
  { order: 2, ctrl: [[268, 452], [236, 470], [196, 478], [156, 492], [121, 493]] },
  { order: 3, ctrl: [[302, 175], [288, 128], [281, 84], [290, 40]] },
  { order: 3, ctrl: [[300, 402], [336, 418], [372, 428]] },
  { order: 3, ctrl: [[640, 600], [633, 625], [630, 646]] },
  { order: 3, ctrl: [[762, 598], [768, 628], [772, 656]] },
  { order: 3, ctrl: [[834, 608], [836, 632], [838, 660]] },
  { order: 3, ctrl: [[780, 430], [756, 400], [742, 362]] },
  { order: 3, ctrl: [[700, 170], [668, 150], [652, 112]] },
  { order: 3, ctrl: [[220, 230], [196, 210], [168, 188], [121, 186]] },
  { order: 3, ctrl: [[520, 300], [496, 340], [492, 366]] },
  { order: 3, ctrl: [[862, 250], [846, 300], [830, 340], [800, 362], [776, 366]] },
];

export interface River { name?: string; order: 1 | 2 | 3; pts: Pt[]; d: string }
export let RIVERS: River[] = [];

const LAKE_DEFS: [number, number, number, string?][] = [
  [250, 350, 11, 'Corrmere'], [330, 372, 6.5, 'Lake Ennis'], [606, 166, 4.5], [842, 444, 6, 'Velm Water'], [562, 300, 5], [132, 456, 5.5],
  [200, 150, 5], [728, 515, 3.5], [480, 330, 3],
];
export let LAKES: { x: number; y: number; r: number; name?: string; d: string }[] = [];

// ---------- Vardan border ----------

const BORDER_CTRL: Pt[] = [[903, 28], [899, 80], [907, 140], [896, 210], [904, 290], [911, 370], [901, 450], [907, 520], [897, 590], [905, 676]];
export let BORDER: Pt[] = [];
export let VARDAN_RING: Pt[] = [];

// ---------- Regions ----------

const BORDER_COARSE: Pt[] = [[903, -30], [903, 28], [899, 80], [907, 140], [896, 210], [904, 290], [911, 370], [901, 450], [907, 520], [897, 590], [905, 676], [905, 720]];

const CLASSIC_REGION_RINGS: Record<RegionId, Pt[]> = {
  north: [[228, -30], [720, -30], [705, 140], [690, 250], [640, 266], [560, 248], [480, 226], [380, 204], [232, 194]],
  east: [[720, -30], ...BORDER_COARSE, [560, 720], [588, 560], [582, 470], [566, 420], [570, 362], [582, 292], [640, 266], [690, 250], [705, 140]],
  coast: [[-60, -30], [228, -30], [232, 194], [242, 262], [228, 340], [218, 420], [262, 470], [270, 508], [300, 560], [380, 590], [420, 720], [200, 720], [170, 577], [-60, 568]],
  isles: [[-60, 568], [170, 577], [200, 720], [-60, 720]],
  central: [[232, 194], [380, 204], [480, 226], [560, 248], [640, 266], [582, 292], [570, 362], [566, 420], [582, 470], [588, 560], [560, 720], [420, 720], [380, 590], [300, 560], [270, 508], [262, 470], [218, 420], [228, 340], [242, 262]],
};

export let REGION_RINGS: Record<RegionId, Pt[]> = { ...CLASSIC_REGION_RINGS };

const CLASSIC_REGION_LABEL_AT: Record<RegionId, Pt> = {
  north: [300, 120],
  coast: [180, 470],
  east: [728, 515],
  isles: [70, 586],
  central: [330, 330],
};

// ---------- Cities ----------

export const cityRadius = (pop: number) => 1.2 + Math.sqrt(pop) * 0.22;
export let REGION_LABEL_AT: Record<RegionId, Pt> = { ...CLASSIC_REGION_LABEL_AT };
export let URBAN: { name: string; d: string }[] = [];

// ---------- Forests and farmland ----------

const FOREST_PATCHES: [number, number, number, number][] = [
  [415, 336, 62, 42], [592, 246, 58, 38], [700, 540, 92, 46], [842, 342, 42, 44], [206, 118, 58, 42], [760, 470, 36, 28],
  [300, 236, 36, 30], [540, 452, 40, 28], [860, 480, 30, 40], [640, 175, 30, 25],
];

/** Forest patches for this world, in classic coordinates. */
let forestPatches: [number, number, number, number][] = FOREST_PATCHES;

function forestDensity(x: number, y: number): number {
  const [u, v] = unwarp(x, y);
  let m = 0;
  for (const [cx, cy, rx, ry] of forestPatches) m = Math.max(m, blob(u, v, cx, cy, rx, ry));
  return m * (0.4 + 0.9 * fbm(u / 22, v / 22, 3, mix(77)));
}

function clearOf(x: number, y: number, siteGap: number, cityGap: number): boolean {
  for (const s of SITES) if (Math.abs(s.x - x) < siteGap && Math.abs(s.y - y) < siteGap) return false;
  for (const c of CITIES) {
    const r = cityRadius(c.pop) + cityGap;
    if (Math.abs(c.x - x) < r && Math.abs(c.y - y) < r) return false;
  }
  for (const l of LAKES) if (Math.hypot(l.x - x, l.y - y) < l.r + 1.5) return false;
  return true;
}

function buildTrees(): { canopy: string; shade: string; count: number } {
  const rng = mulberry32(mix(4242));
  const step = 3.1;
  let canopy = '';
  let shade = '';
  let count = 0;
  for (let y = FRAME.y0; y < FRAME.y1; y += step) {
    for (let x = FRAME.x0; x < 905; x += step) {
      const jx = x + (rng() - 0.5) * step * 0.9;
      const jy = y + (rng() - 0.5) * step * 0.9;
      const d = forestDensity(jx, jy);
      const r = rng();
      if (d < 0.5 || r > (d - 0.45) * 2.2) continue;
      if (!onLand(jx, jy) || elev(jx, jy) > 0.82 || !clearOf(jx, jy, 5, 1.5)) continue;
      const rr = 1.05 + rng() * 0.5;
      canopy += `M${f1(jx - rr)} ${f1(jy)}a${f1(rr)} ${f1(rr)} 0 1 0 ${f1(rr * 2)} 0a${f1(rr)} ${f1(rr)} 0 1 0 ${f1(-rr * 2)} 0`;
      shade += `M${f1(jx + 0.25)} ${f1(jy + rr * 0.9)}h${f1(rr * 0.9)}`;
      count++;
    }
  }
  return { canopy, shade, count };
}

function buildFields(): string[] {
  const rng = mulberry32(mix(9191));
  const out = ['', '', ''];
  const cell = 8.5;
  const th = 0.21;
  const cs = Math.cos(th);
  const sn = Math.sin(th);
  const rot = (u: number, v: number): Pt => [u * cs - v * sn, u * sn + v * cs];
  for (let v = -120; v < 760; v += cell) {
    for (let u = 0; u < 1000; u += cell) {
      const [cx, cy] = rot(u + cell / 2, v + cell / 2);
      const [ux, uy] = unwarp(cx, cy);
      if (ux < 150 || ux > 640 || uy < 60 || uy > 630) continue;
      if (!onLand(cx, cy) || elev(cx, cy) > 0.24 || forestDensity(cx, cy) > 0.42 || !clearOf(cx, cy, 3, 2.5)) continue;
      if (fbm(cx / 40, cy / 40, 2, 5) < 0.36) continue;
      const split = 1 + Math.floor(rng() * 3);
      const vertical = rng() < 0.5;
      for (let k = 0; k < split; k++) {
        if (rng() < 0.22) continue;
        const cls = Math.floor(rng() * 3);
        const g = 0.55;
        let u0 = u + g;
        let u1 = u + cell - g;
        let v0 = v + g;
        let v1 = v + cell - g;
        if (vertical) {
          u0 = u + (cell * k) / split + g;
          u1 = u + (cell * (k + 1)) / split - g;
        } else {
          v0 = v + (cell * k) / split + g;
          v1 = v + (cell * (k + 1)) / split - g;
        }
        const a = rot(u0, v0);
        const b = rot(u1, v0);
        const c = rot(u1, v1);
        const d = rot(u0, v1);
        out[cls] += `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}L${f1(c[0])} ${f1(c[1])}L${f1(d[0])} ${f1(d[1])}Z`;
      }
    }
  }
  return out;
}

// ---------- Contours ----------

export const CONTOUR_LEVELS = [0.2, 0.28, 0.36, 0.44, 0.52, 0.62, 0.72, 0.82, 0.92, 1.02];

function buildContours(step = 3): string[] {
  const x0 = FRAME.x0 - step;
  const y0 = FRAME.y0 - step;
  const nx = Math.ceil((FRAME_W + 30) / step);
  const ny = Math.ceil((FRAME_H + 6) / step);
  const h = new Float32Array((nx + 1) * (ny + 1));
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) h[j * (nx + 1) + i] = elev(x0 + i * step, y0 + j * step);
  return CONTOUR_LEVELS.map((lv) => {
    let s = '';
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const a = h[j * (nx + 1) + i];
        const b = h[j * (nx + 1) + i + 1];
        const c = h[(j + 1) * (nx + 1) + i + 1];
        const d = h[(j + 1) * (nx + 1) + i];
        const idx = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (c > lv ? 2 : 0) | (d > lv ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const X = x0 + i * step;
        const Y = y0 + j * step;
        const top: Pt = [X + step * ((lv - a) / (b - a)), Y];
        const right: Pt = [X + step, Y + step * ((lv - b) / (c - b))];
        const bottom: Pt = [X + step * ((lv - d) / (c - d)), Y + step];
        const left: Pt = [X, Y + step * ((lv - a) / (d - a))];
        const seg = (p: Pt, q: Pt) => {
          s += `M${f1(p[0])} ${f1(p[1])}L${f1(q[0])} ${f1(q[1])}`;
        };
        switch (idx) {
          case 1: case 14: seg(left, bottom); break;
          case 2: case 13: seg(bottom, right); break;
          case 3: case 12: seg(left, right); break;
          case 4: case 11: seg(top, right); break;
          case 5: seg(left, top); seg(bottom, right); break;
          case 6: case 9: seg(top, bottom); break;
          case 7: case 8: seg(left, top); break;
          case 10: seg(left, bottom); seg(top, right); break;
        }
      }
    }
    return s;
  });
}

// ---------- Static geography bundle (built once, on first use) ----------

export interface Geography {
  land: string;
  mainland: string;
  vardan: string;
  border: string;
  contours: string[];
  trees: { canopy: string; shade: string; count: number };
  fields: string[];
  graticule: string;
}

let geoCache: Geography | null = null;
export function geography(): Geography {
  if (geoCache) return geoCache;
  let grat = '';
  for (let x = 100; x < FRAME.x1; x += 100) grat += `M${x} ${FRAME.y0}V${FRAME.y1}`;
  for (let y = 0; y < FRAME.y1; y += 100) grat += `M${FRAME.x0} ${y}H${FRAME.x1}`;
  geoCache = {
    land: LAND_RINGS.map(ringPath).join(''),
    mainland: ringPath(MAINLAND_RING),
    vardan: ringPath(VARDAN_RING),
    border: linePath(BORDER),
    contours: buildContours(),
    trees: buildTrees(),
    fields: buildFields(),
    graticule: grat,
  };
  return geoCache;
}

/** Hillshaded, tinted relief as a PNG data URL, 1 px per km over the frame. Built in slices so it never blocks for long. */
let reliefCache: string | null = null;
let reliefJob: Promise<string | null> | null = null;
export const cachedRelief = () => reliefCache;

export function reliefImage(): Promise<string | null> {
  if (reliefCache) return Promise.resolve(reliefCache);
  if (reliefJob) return reliefJob;
  if (typeof document === 'undefined') return Promise.resolve(null);
  reliefJob = buildRelief().then((url) => (reliefCache = url));
  return reliefJob;
}

async function buildRelief(): Promise<string | null> {
  const w = Math.round(FRAME_W);
  const hgt = Math.round(FRAME_H);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = hgt;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  const pad = 1;
  const W = w + 2 * pad;
  const H = hgt + 2 * pad;
  const z = new Float32Array(W * H);
  let t = performance.now();
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) z[j * W + i] = elev(FRAME.x0 + i - pad, FRAME.y0 + j - pad);
    if (performance.now() - t > 12) {
      await new Promise((r) => setTimeout(r, 0));
      t = performance.now();
    }
  }
  const img = ctx.createImageData(w, hgt);
  const L = [-0.55, -0.6, 0.58];
  const ln = Math.hypot(L[0], L[1], L[2]);
  const lx = L[0] / ln;
  const ly = L[1] / ln;
  const lz = L[2] / ln;
  const zf = 26;
  const stops: [number, number, number, number][] = [
    [0, 17, 33, 36], [0.18, 21, 38, 40], [0.32, 28, 42, 44], [0.5, 40, 50, 52], [0.75, 56, 62, 66], [1.1, 82, 86, 92],
  ];
  for (let j = 0; j < hgt; j++) {
    for (let i = 0; i < w; i++) {
      const k = (j + pad) * W + (i + pad);
      const hv = z[k];
      const dx = (z[k + 1] - z[k - 1]) * 0.5 * zf;
      const dy = (z[k + W] - z[k - W]) * 0.5 * zf;
      const nl = Math.hypot(dx, dy, 1);
      const shade = (-dx * lx - dy * ly + lz) / nl;
      const f = Math.max(0.45, Math.min(1.7, 1 + 1.6 * (shade - lz)));
      let s = 0;
      while (s < stops.length - 2 && hv > stops[s + 1][0]) s++;
      const [h0, r0, g0, b0] = stops[s];
      const [h1, r1, g1, b1] = stops[s + 1];
      const q = Math.max(0, Math.min(1, (hv - h0) / (h1 - h0)));
      const o = (j * w + i) * 4;
      img.data[o] = Math.min(255, (r0 + (r1 - r0) * q) * f);
      img.data[o + 1] = Math.min(255, (g0 + (g1 - g0) * q) * f);
      img.data[o + 2] = Math.min(255, (b0 + (b1 - b0) * q) * f);
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL('image/png');
}

// ---------- Transport geometry ----------

// Waypoints for sea lanes, from the first site to the second.
const SEA_LANES: [string, string, Pt[]][] = [
  ['portHalvard', 'portSkerry', [[140, 297], [110, 314], [88, 360], [82, 440], [88, 520], [112, 560], [150, 578], [152, 598], [134, 606]]],
  ['portLowmouth', 'portSkerry', [[334, 641], [314, 646], [262, 642], [200, 626], [158, 612], [134, 606]]],
  ['portSkerry', 'depotIsles', [[124, 606.5], [116, 607]]],
  ['depotIsles', 'skerryBase', [[110, 607], [97, 610], [89, 620], [90, 634.5]]],
  ['portMeric', 'karskMetals', [[366, 30], [420, 16], [520, 0], [650, -24]]],
  ['portLowmouth', 'sableCircuits', [[334, 642], [324, 670], [310, 705]]],
  ['portHalvard', 'brightwater', [[140, 298], [104, 316], [40, 342]]],
  ['portHalvard', 'northwind', [[140, 293], [104, 282], [40, 232]]],
  ['portHalvard', 'halvardGas', [[140, 299], [114, 301]]],
  ['portMeric', 'portHalvard', [[352, 30], [250, 12], [150, 24], [96, 62], [86, 150], [94, 238], [118, 270], [140, 291]]],
  ['portHalvard', 'portLowmouth', [[140, 298], [100, 330], [84, 400], [80, 470], [98, 530], [150, 572], [215, 604], [290, 642], [318, 647], [334, 641]]],
];

export interface RouteGeom {
  key: string;
  mode: Mode;
  a: string;
  b: string;
  pts: Pt[];
  cum: number[];
  len: number;
  d: string;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function buildRoute(a: string, b: string, mode: Mode): Pt[] {
  const A = SITE_BY_ID[a];
  const B = SITE_BY_ID[b];
  const pa: Pt = [A.x, A.y];
  const pb: Pt = [B.x, B.y];
  const dx = pb[0] - pa[0];
  const dy = pb[1] - pa[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  if (mode === 'sea') {
    const lane = SEA_LANES.find(([p, q]) => (p === a && q === b) || (p === b && q === a));
    if (lane) {
      const wp = (lane[0] === a ? lane[2] : lane[2].slice().reverse()).map(warpPt);
      return smoothLine([pa, ...wp, pb], 8);
    }
    return smoothLine([pa, [pa[0] + dx / 2 + nx * len * 0.12, pa[1] + dy / 2 + ny * len * 0.12], pb], 12);
  }
  if (mode === 'air') {
    const out: Pt[] = [];
    // Bulge consistently to one side of the sorted pair so both directions match.
    const sgn = a < b ? 1 : -1;
    const cx = pa[0] + dx / 2 + nx * len * 0.16 * sgn;
    const cy = pa[1] + dy / 2 + ny * len * 0.16 * sgn;
    for (let i = 0; i <= 28; i++) {
      const t = i / 28;
      out.push([(1 - t) * (1 - t) * pa[0] + 2 * (1 - t) * t * cx + t * t * pb[0], (1 - t) * (1 - t) * pa[1] + 2 * (1 - t) * t * cy + t * t * pb[1]]);
    }
    return out;
  }
  const rng = mulberry32(hashStr(ROUTE_KEY(a, b) + mode));
  const amp = Math.min(14, len * (mode === 'rail' ? 0.07 : 0.1));
  const n = len > 90 ? 3 : 2;
  const ctrl: Pt[] = [pa];
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const o = (rng() * 2 - 1) * amp;
    ctrl.push([pa[0] + dx * t + nx * o, pa[1] + dy * t + ny * o]);
  }
  ctrl.push(pb);
  return smoothLine(ctrl, 8);
}

function cumLen(p: Pt[]): number[] {
  const c = [0];
  for (let i = 1; i < p.length; i++) c.push(c[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  return c;
}

export let ROUTE_GEOMS: RouteGeom[] = [];
/** Links the player may build, drawn as plans until they open. */
export let CANDIDATE_GEOMS: (RouteGeom & { id: string })[] = [];
export const GEOMS_BY_KEY: Map<string, RouteGeom[]> = new Map();

function buildTransport(): void {
  ROUTE_GEOMS = ROUTES.map((r) => {
    const pts = buildRoute(r.a, r.b, r.mode);
    const cum = cumLen(pts);
    return { key: ROUTE_KEY(r.a, r.b), mode: r.mode, a: r.a, b: r.b, pts, cum, len: cum[cum.length - 1], d: linePath(pts) };
  });
  CANDIDATE_GEOMS = CANDIDATE_ROUTES.map((r) => {
    const pts = buildRoute(r.a, r.b, r.mode);
    const cum = cumLen(pts);
    return { id: r.id, key: ROUTE_KEY(r.a, r.b), mode: r.mode, a: r.a, b: r.b, pts, cum, len: cum[cum.length - 1], d: linePath(pts) };
  });
  GEOMS_BY_KEY.clear();
  for (const g of [...ROUTE_GEOMS, ...CANDIDATE_GEOMS]) {
    const l = GEOMS_BY_KEY.get(g.key) ?? [];
    l.push(g);
    GEOMS_BY_KEY.set(g.key, l);
  }
}

export function pointAt(g: { pts: Pt[]; cum: number[] }, s: number): Pt {
  const { pts, cum } = g;
  if (s <= 0) return pts[0];
  const total = cum[cum.length - 1];
  if (s >= total) return pts[pts.length - 1];
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid;
    else hi = mid;
  }
  const t = (s - cum[lo]) / (cum[hi] - cum[lo] || 1);
  return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * t, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * t];
}

export const inFrame = (x: number, y: number) => x >= FRAME.x0 && x <= FRAME.x1 && y >= FRAME.y0 && y <= FRAME.y1;

export function clampToFrame(p: Pt, inset = 0): Pt {
  return [
    Math.max(FRAME.x0 + inset, Math.min(FRAME.x1 - inset, p[0])),
    Math.max(FRAME.y0 + inset, Math.min(FRAME.y1 - inset, p[1])),
  ];
}

/** Where each foreign supplier's lane leaves the sheet. */
export interface OffMapExit { siteId: string; nation: string; name: string; at: Pt; angle: number; marker: Pt }
export let OFF_MAP_EXITS: OffMapExit[] = [];
const buildExits = (): OffMapExit[] => SITES.filter((s) => !inFrame(s.x, s.y)).map((s) => {
  const g = ROUTE_GEOMS.find((r) => r.a === s.id || r.b === s.id);
  const pts = g ? (g.b === s.id ? g.pts : g.pts.slice().reverse()) : ([[s.x, s.y]] as Pt[]);
  let at: Pt = clampToFrame([s.x, s.y]);
  let angle = Math.atan2(s.y - at[1], s.x - at[0]);
  for (let i = 1; i < pts.length; i++) {
    if (inFrame(pts[i - 1][0], pts[i - 1][1]) && !inFrame(pts[i][0], pts[i][1])) {
      at = clampToFrame(pts[i]);
      angle = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
      break;
    }
  }
  const marker: Pt = [at[0] - Math.cos(angle) * 22, at[1] - Math.sin(angle) * 22];
  return { siteId: s.id, nation: s.nation ?? 'Foreign', name: s.name, at, angle, marker };
});

/** Where a site's marker is drawn: its own position, or the sheet edge for foreign suppliers. */
export const SITE_POS: Record<string, Pt> = {};
function buildSitePos(): void {
  for (const s of SITES) {
    const ex = OFF_MAP_EXITS.find((e) => e.siteId === s.id);
    SITE_POS[s.id] = ex ? ex.marker : ([s.x, s.y] as Pt);
  }
}

// ---------- Small cartographic details ----------

/** Breakwaters and quays, drawn at close zoom. */
const CLASSIC_HARBOURS: [Pt, string][] = [
  // Port of Meric
  [[360, 38], 'M351 41Q350 35 355 31M369 42Q371 36 366 31M356 41V37M360 41V36M364 41V37'],
  // Halvard Docks
  [[150, 286], 'M152 293Q146 293 143 288M155 278Q149 276 145 280M155 289H151M156 285H151M156 281H152'],
  // Lowmouth
  [[335, 634], 'M327 631Q326 637 330 641M343 632Q345 638 341 641M331 631V635M335 631V636M339 631V635'],
  // Skerry Harbour
  [[125, 606], 'M121 604Q120 608 123 610M130 604Q132 608 129 610M124 604V607M127 604V607'],
];
export let HARBOURS = '';

/** Moves an absolute SVG path (M L Q C H V A Z) by dx, dy. */
export function shiftPath(d: string, dx: number, dy: number): string {
  if (!dx && !dy) return d;
  return d.replace(/([MLQCTSHVAZ])([^MLQCTSHVAZ]*)/g, (_m, cmd: string, args: string) => {
    const n = (args.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
    if (cmd === 'Z') return 'Z';
    if (cmd === 'H') return `H${n.map((v) => f1(v + dx)).join(' ')}`;
    if (cmd === 'V') return `V${n.map((v) => f1(v + dy)).join(' ')}`;
    if (cmd === 'A') {
      const out: number[] = [];
      for (let i = 0; i + 6 < n.length + 1; i += 7) out.push(n[i], n[i + 1], n[i + 2], n[i + 3], n[i + 4], n[i + 5] + dx, n[i + 6] + dy);
      return `A${out.map((v, i) => (i % 7 >= 5 ? f1(v) : String(v))).join(' ')}`;
    }
    return cmd + n.map((v, i) => f1(v + (i % 2 === 0 ? dx : dy))).join(' ');
  });
}
/** How far the land moved under a classic point. */
const moved = (p: Pt): Pt => {
  const [x, y] = warp(p[0], p[1]);
  return [x - p[0], y - p[1]];
};

/** Runways at the air bases, drawn at close zoom. */
const CLASSIC_RUNWAYS = [
  { x: 150, y: 225, a: -28, l: 4.2 },
  { x: 85, y: 640, a: -12, l: 3.4 },
  { x: 470, y: 265, a: 18, l: 3.8 },
];
export let RUNWAYS = CLASSIC_RUNWAYS;

/** Open pits drawn as nested rings. */
const CLASSIC_PITS: [number, number, number][] = [[520, 175, 3.2], [760, 300, 4.5], [285, 470, 2.6], [215, 560, 2.2], [675, 410, 2.2], [830, 530, 2.4]];
export let PITS = CLASSIC_PITS;

/** Range danger areas. */
const CLASSIC_DANGER = [
  { id: 'D-114', label: 'D-114 SALTMERE', d: 'M108 430L60 380A70 70 0 0 0 52 482Z', at: [62, 432] as Pt },
  { id: 'D-209', label: 'D-209 KARROW', d: ringPath(blobRing(705, 590, 22, 77, 8, 0.05, 2)), at: [705, 566] as Pt },
];
export let DANGER_AREAS = CLASSIC_DANGER;

/** Salt pans on the Meric flats. */
const CLASSIC_SALT_PANS = (() => {
  let s = '';
  const rng = mulberry32(31);
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 6; i++) {
      if (rng() < 0.2) continue;
      const x = 446 + i * 6.4 + j * 1.5;
      const y = 56 + j * 5.4;
      s += `M${f1(x)} ${f1(y)}h5.2v4.4h-5.2Z`;
    }
  }
  return s;
})();

export let SALT_PANS = CLASSIC_SALT_PANS;
const CLASSIC_PIPELINE = 'M95 300L118 303L138 306L152 314L165 320';
export let PIPELINE = CLASSIC_PIPELINE;

export interface GeoLabel { text: string; at: Pt; size: number; rot?: number; kind: 'sea' | 'relief' | 'water' | 'island' | 'nation'; lod: number; spacing?: number }
const CLASSIC_LABELS: GeoLabel[] = [
  { text: 'HALVARD STRAIT', at: [52, 330], size: 12, rot: -90, kind: 'sea', lod: 0, spacing: 0.5 },
  { text: 'NORTHERN REACH', at: [620, 10], size: 12, kind: 'sea', lod: 0, spacing: 0.6 },
  { text: 'LOWMOUTH BIGHT', at: [520, 676], size: 11, kind: 'sea', lod: 0, spacing: 0.5 },
  { text: 'BRENNOCK HILLS', at: [610, 160], size: 11, rot: -8, kind: 'relief', lod: 0, spacing: 0.4 },
  { text: 'VELM PLATEAU', at: [826, 452], size: 10.5, kind: 'relief', lod: 0, spacing: 0.4 },
  { text: 'KARROW RANGE', at: [770, 618], size: 12, rot: -6, kind: 'relief', lod: 0, spacing: 0.6 },
  { text: 'VARDAN DIRECTORATE', at: [944, 330], size: 12, rot: 90, kind: 'nation', lod: 0, spacing: 0.6 },
  { text: 'Varn', at: [516, 366], size: 10, rot: -3, kind: 'water', lod: 1 },
  { text: 'Varn', at: [372, 515], size: 10, rot: -82, kind: 'water', lod: 1 },
  { text: 'Riverline', at: [640, 104], size: 10, rot: 6, kind: 'water', lod: 1 },
  { text: 'Corran Water', at: [430, 316], size: 9, rot: -82, kind: 'water', lod: 2 },
  { text: 'Hollin Burn', at: [646, 300], size: 9, rot: -78, kind: 'water', lod: 2 },
  { text: 'Tarn Beck', at: [700, 490], size: 9, rot: -70, kind: 'water', lod: 2 },
  { text: 'Hal', at: [232, 300], size: 9, rot: 18, kind: 'water', lod: 2 },
  { text: 'Corrmere', at: [250, 366], size: 9, kind: 'water', lod: 1 },
  { text: 'Lake Ennis', at: [330, 384], size: 9, kind: 'water', lod: 2 },
  { text: 'Velm Water', at: [842, 456], size: 9, kind: 'water', lod: 2 },
  { text: 'Meric Flats', at: [470, 82], size: 9, kind: 'relief', lod: 2 },
  { text: 'Holm', at: [130, 581], size: 9, kind: 'island', lod: 1 },
  { text: 'Great Skerry', at: [112, 640], size: 9, kind: 'island', lod: 1 },
  { text: 'Fennick', at: [80, 660], size: 9, kind: 'island', lod: 1 },
  { text: '▲ Karrow Head 2,140', at: [742, 576], size: 9, kind: 'relief', lod: 2 },
  { text: '▲ Brennock Top 910', at: [575, 186], size: 9, kind: 'relief', lod: 2 },
  { text: '▲ Velm Height 1,310', at: [818, 392], size: 9, kind: 'relief', lod: 2 },
];

// ---------- Building the geography for the current world ----------

export let GEO_LABELS: GeoLabel[] = CLASSIC_LABELS;

// The map's own place names, so a generated world renames them too.
registerPlaceTexts([...CLASSIC_LABELS.map((l) => l.text), ...RIVER_DEFS.map((r) => r.name ?? ''), ...LAKE_DEFS.map((l) => l[3] ?? ''), ...CLASSIC_DANGER.map((d) => d.label)]);

function rebuildGeography(): void {
  const seed = worldSeed();
  // This world's own mountains and forests (in classic coordinates).
  const rng = mulberry32(seed || 1);
  worldRidges = seed
    ? Array.from({ length: 2 + Math.floor(rng() * 2) }, () => {
        const x = 220 + rng() * 600;
        const y = 120 + rng() * 440;
        const a = rng() * Math.PI;
        const l = 70 + rng() * 120;
        const line: Pt[] = [0, 0.33, 0.66, 1].map((t) => [x + Math.cos(a) * l * (t - 0.5) + (rng() - 0.5) * 30, y + Math.sin(a) * l * (t - 0.5) + (rng() - 0.5) * 30]);
        return { line, h: 0.25 + rng() * 0.35 };
      })
    : [];
  forestPatches = seed ? FOREST_PATCHES.map(([x, y, rx, ry]) => [x + (rng() - 0.5) * 140, y + (rng() - 0.5) * 120, rx * (0.7 + rng() * 0.7), ry * (0.7 + rng() * 0.7)]) : FOREST_PATCHES;

  MAINLAND_RING = fractalRing(MAINLAND.map(wc), mix(1701), 2);
  ISLAND_RINGS = [
    fractalRing(HOLM.map(wc), mix(211), 0.8),
    fractalRing(GREAT_SKERRY.map(wc), mix(223), 0.8),
    fractalRing(FENNICK.map(wc), mix(227), 0.8),
    ...ISLETS.map(([x, y, r], i) => {
      const [wx, wy] = warp(x, y);
      return blobRing(wx, wy, r, mix(300 + i), 8, 0.2, 0.6);
    }),
  ];
  LAND_RINGS = [MAINLAND_RING, ...ISLAND_RINGS];
  onLand = scanMask(LAND_RINGS, 0.5);
  RIVERS = RIVER_DEFS.map((r, i) => {
    const rough = fractalLine(r.ctrl.map(warpPt), r.order === 1 ? 0.12 : 0.16, mix(900 + i), 1.5);
    const pts = smoothLine(rough, 2);
    return { name: r.name ? tr(r.name) : undefined, order: r.order, pts, d: linePath(pts) };
  });
  LAKES = LAKE_DEFS.map(([x, y, r, name], i) => {
    const [wx, wy] = warp(x, y);
    return { x: wx, y: wy, r, name: name ? tr(name) : undefined, d: ringPath(blobRing(wx, wy, r, mix(500 + i), 10, 0.16, 0.6)) };
  });
  BORDER = smoothLine(fractalLine(BORDER_CTRL.map(warpPt), 0.1, mix(77), 3), 2);
  VARDAN_RING = [...BORDER, [1030, 690], [1030, 20]];
  REGION_RINGS = Object.fromEntries((Object.keys(CLASSIC_REGION_RINGS) as RegionId[]).map((r) => [r, CLASSIC_REGION_RINGS[r].map(warpPt)])) as Record<RegionId, Pt[]>;
  REGION_LABEL_AT = Object.fromEntries((Object.keys(CLASSIC_REGION_LABEL_AT) as RegionId[]).map((r) => [r, warpPt(CLASSIC_REGION_LABEL_AT[r])])) as Record<RegionId, Pt>;
  URBAN = CITIES.map((c, i) => ({ name: c.name, d: ringPath(blobRing(c.x, c.y, cityRadius(c.pop), mix(700 + i), 11, 0.2, 0.5)) }));

  buildTransport();
  OFF_MAP_EXITS = buildExits();
  buildSitePos();

  HARBOURS = CLASSIC_HARBOURS.map(([at, d]) => shiftPath(d, ...moved(at))).join('');
  RUNWAYS = CLASSIC_RUNWAYS.map((r) => {
    const [x, y] = warp(r.x, r.y);
    return { ...r, x, y };
  });
  PITS = CLASSIC_PITS.map(([x, y, r]) => {
    const [wx, wy] = warp(x, y);
    return [wx, wy, r];
  });
  DANGER_AREAS = CLASSIC_DANGER.map((d) => ({ ...d, label: tr(d.label), d: shiftPath(d.d, ...moved(d.at)), at: warpPt(d.at) }));
  SALT_PANS = shiftPath(CLASSIC_SALT_PANS, ...moved([462, 62]));
  PIPELINE = shiftPath(CLASSIC_PIPELINE, ...moved([130, 308]));
  GEO_LABELS = CLASSIC_LABELS.map((l) => ({ ...l, text: tr(l.text), at: l.kind === 'nation' ? l.at : warpPt(l.at) }));

  geoCache = null;
  reliefCache = null;
  reliefJob = null;
}

rebuildGeography();
onWorldChange(rebuildGeography);
