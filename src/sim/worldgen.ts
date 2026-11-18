// Procedural worlds: a new country for every game. The classic map is the template: a seeded, smooth warp moves the
// whole country (coast, rivers, regions, sea lanes and every site together, so ports stay on the coast and links stay
// sensible), and every place, company, sea and hill gets a new name. Site roles, owners, recipes and links never
// change, so every rule of the game still holds.
import { CANDIDATE_ROUTES, CITIES, REGIONS, ROUTES, SITES, routeKm, setKmScale, type RegionId } from './world';

export type Pt = [number, number];

export interface WorldSpec {
  seed: number;
  /** Short name, e.g. "Varnholt". */
  name: string;
  /** Full name, e.g. "Republic of Varnholt". */
  title: string;
  /** e.g. "Varnholtan". */
  demonym: string;
}

// ---------- Seeded noise (self-contained, so the engine never depends on the map module) ----------

function mulberry(seed: number): () => number {
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
function fbm2(x: number, y: number, seed: number): number {
  return 0.65 * vnoise(x, y, seed) + 0.35 * vnoise(x * 2.1, y * 2.1, seed + 7);
}

// ---------- The warp ----------

/** The sheet the country is drawn on (km), matching the map frame. */
const FRAME = { x0: 0, y0: -10, x1: 980, y1: 690 };
const EDGE = 110;

interface Warp {
  seed: number;
  amp: number;
  len: number;
}
let current: Warp | null = null;
let spec: WorldSpec | null = null;

/** Displacement at a classic point: smooth, and fading to nothing at the edges of the sheet. */
function displacement(w: Warp, x: number, y: number): Pt {
  const ex = Math.min(x - FRAME.x0, FRAME.x1 - x);
  const ey = Math.min(y - FRAME.y0, FRAME.y1 - y);
  const e = Math.max(0, Math.min(1, Math.min(ex, ey) / EDGE));
  const taper = e * e * (3 - 2 * e);
  if (taper <= 0) return [0, 0];
  const dx = (fbm2(x / w.len, y / w.len, w.seed) - 0.5) * 2 * w.amp * taper;
  const dy = (fbm2(x / w.len + 31.7, y / w.len - 12.3, w.seed + 101) - 0.5) * 2 * w.amp * taper;
  return [dx, dy];
}

/** True if the warp squeezes any part of the sheet below 35% of its area, or turns it inside out. */
function folds(w: Warp): boolean {
  const h = 2;
  for (let x = FRAME.x0; x <= FRAME.x1; x += 20) {
    for (let y = FRAME.y0; y <= FRAME.y1; y += 20) {
      const [ax, ay] = displacement(w, x - h, y);
      const [bx, by] = displacement(w, x + h, y);
      const [cx, cy] = displacement(w, x, y - h);
      const [dx, dy] = displacement(w, x, y + h);
      const jxx = 1 + (bx - ax) / (2 * h);
      const jyx = (by - ay) / (2 * h);
      const jxy = (dx - cx) / (2 * h);
      const jyy = 1 + (dy - cy) / (2 * h);
      if (jxx * jyy - jxy * jyx < 0.35) return true;
    }
  }
  return false;
}

/** Classic coordinates to this world's. Identity on the classic map. */
export function warp(x: number, y: number): Pt {
  if (!current) return [x, y];
  const [dx, dy] = displacement(current, x, y);
  return [x + dx, y + dy];
}
export const warpPt = (p: Pt): Pt => warp(p[0], p[1]);

/** This world's coordinates back to classic ones (fixed-point iteration: the warp is smooth and gentle). */
export function unwarp(x: number, y: number): Pt {
  if (!current) return [x, y];
  let u = x;
  let v = y;
  for (let i = 0; i < 6; i++) {
    const [dx, dy] = displacement(current, u, v);
    u = x - dx;
    v = y - dy;
  }
  return [u, v];
}

/** A small seeded random source for map details in this world (or the classic seed when there is none). */
export const worldSeed = () => current?.seed ?? 0;
export const currentWorld = () => spec;

// ---------- Names ----------

const ONSETS = ['B', 'C', 'D', 'F', 'G', 'H', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V', 'W', 'Br', 'Cr', 'Dr', 'Gr', 'Tr', 'St', 'Th', 'Sk', 'Fr', 'Gl', 'Pr', 'Wh', 'Al', 'El', 'Or', 'Ar'];
const VOWELS = ['a', 'e', 'i', 'o', 'u', 'ae', 'ea', 'ou', 'ay', 'ow', 'ei'];
const CODAS = ['n', 'r', 'l', 'm', 's', 'th', 'ck', 'rd', 'ld', 'nt', 'st', 'x', 'ff', 'ng', 'sh', 'rn', 'lm', 'rk', ''];
const ENDINGS = ['ford', 'by', 'ton', 'mouth', 'gate', 'wick', 'holm', 'mere', 'stead', 'well', 'bridge', 'dale', 'field', 'burn', 'ham', 'ley', 'more', 'crest', 'haven', 'thorpe', 'shaw', 'ness'];
const COUNTRY_FORMS = ['Republic of', 'Commonwealth of', 'Federation of', 'United Provinces of', 'Kingdom of', 'Union of'];

function makeNamer(rng: () => number, taken: Set<string>) {
  const pick = <T,>(a: T[]) => a[Math.floor(rng() * a.length)];
  return (ending = rng() < 0.55): string => {
    for (let tries = 0; tries < 200; tries++) {
      let n = pick(ONSETS) + pick(VOWELS) + pick(CODAS);
      if (rng() < 0.35) n += pick(VOWELS) + pick(CODAS);
      if (ending) n += pick(ENDINGS);
      n = n.replace(/(.)\1\1/g, '$1$1');
      if (n.length < 4 || n.length > 11 || taken.has(n.toLowerCase())) continue;
      taken.add(n.toLowerCase());
      return n;
    }
    return `Place${taken.size}`;
  };
}

/** Words in the classic map that are place names, not descriptions. Everything else in a name is kept. */
const GENERIC = new Set(
  'Iron Pits Colliery Bauxite Zinc Mine Copper Mineral Sands Quarry Saltworks Offshore Gas River Pulp Steelworks Aluminium Smelter Refinery Separation Plant Silicon Ammonia Nitric Polymers Chemical Cellulose Energetics Microwave Imaging Trusted Foundry Aerostructures Controls Magnetics Propellant Charges Forge Propulsion Motor Works Fuze Valley Integration Center Munitions Complex Depot Air Defense Sector Base Isles Artillery Brigade Corps Proving Ground Range Demilitarization Facility Port Harbour Logistics Hub Central Docks Town State Metals Circuit Sensors Optics Aerojet Plateau Hills Head Top Height Water Burn Beck Lake Flats Strait Reach Bight Directorate Union Republic Federation Great Of Of The A An And Commonwealth Northern Southern Eastern Western Coast Heartland Ports Marches 3rd Rocket Line Main Southern Direct Link Spur Cut-off Military Road Fields Vale Heath Downs Ridge Plot Westline Gap Fell'
    .split(' ')
    .map((w) => w.toLowerCase()),
);
/** Off-map nations keep their names: they are the wider world, not this country. */
const KEEP = new Set(['karsk', 'ostrel', 'corvane', 'vardan', 'sable', 'brightwater', 'lyre', 'northwind', 'merrow', 'calder']);

// ---------- Applying a world ----------

interface Snapshot {
  sites: Record<string, { x: number; y: number; name: string; blurb: string }>;
  cities: { name: string; x: number; y: number; pop: number; capital?: boolean }[];
  regions: Record<RegionId, string>;
  candidates: Record<string, { name: string; blurb: string }>;
}
const CLASSIC: Snapshot = {
  sites: Object.fromEntries(SITES.map((s) => [s.id, { x: s.x, y: s.y, name: s.name, blurb: s.blurb }])),
  cities: CITIES.map((c) => ({ ...c })),
  regions: Object.fromEntries((Object.keys(REGIONS) as RegionId[]).map((r) => [r, REGIONS[r].name])) as Record<RegionId, string>,
  candidates: Object.fromEntries(CANDIDATE_ROUTES.map((c) => [c.id, { name: c.name, blurb: c.blurb }])),
};

/** Classic place word (lower case) to this world's name. Empty on the classic map. */
let dictionary = new Map<string, string>();

/** Rewrites classic place names in any text for this world. */
export function tr(text: string): string {
  if (!dictionary.size || !text) return text;
  return text.replace(/[A-Za-z][A-Za-z'’]*/g, (w) => {
    const base = w.replace(/['’]s$/, '');
    const hit = dictionary.get(base.toLowerCase());
    if (!hit) return w;
    const out = base === base.toUpperCase() && base.length > 1 ? hit.toUpperCase() : hit;
    return out + w.slice(base.length);
  });
}

function collectPlaceWords(texts: string[]): string[] {
  const words = new Set<string>();
  for (const t of texts) for (const w of t.match(/[A-Za-z][A-Za-z]*/g) ?? []) {
    const l = w.toLowerCase();
    if (w[0] !== w[0].toUpperCase() || GENERIC.has(l) || KEEP.has(l) || l.length < 3) continue;
    words.add(l);
  }
  return [...words].sort();
}

/** Extra texts on the map that carry place names (sea, hill and river labels), registered by the map module. */
const extraTexts: string[] = [];
export const registerPlaceTexts = (t: string[]) => extraTexts.push(...t);

const listeners: (() => void)[] = [];
/** The map registers here to rebuild its geography when the world changes. */
export const onWorldChange = (f: () => void) => listeners.push(f);

export function makeSpec(seed: number): WorldSpec {
  const rng = mulberry(seed ^ 0x5eed);
  const namer = makeNamer(rng, new Set());
  const name = namer(rng() < 0.4);
  const title = `${COUNTRY_FORMS[Math.floor(rng() * COUNTRY_FORMS.length)]} ${name}`;
  const demonym = /[aeiou]$/.test(name) ? `${name}n` : /y$/.test(name) ? `${name.slice(0, -1)}ian` : `${name}ian`;
  return { seed, name, title, demonym };
}

/** Makes this the world the game runs on. null brings back the classic Commonwealth of Aldmere. */
export function applyWorld(seed: number | null): void {
  if ((seed ?? null) === (spec?.seed ?? null)) return;
  // Restore the classic first, so every world starts from the same template.
  for (const s of SITES) Object.assign(s, CLASSIC.sites[s.id]);
  CITIES.forEach((c, i) => Object.assign(c, CLASSIC.cities[i]));
  for (const r of Object.keys(REGIONS) as RegionId[]) REGIONS[r].name = CLASSIC.regions[r];
  for (const c of CANDIDATE_ROUTES) Object.assign(c, CLASSIC.candidates[c.id]);
  dictionary = new Map();
  current = null;
  spec = null;
  setKmScale(1);
  const classicKm = ROUTES.filter((r) => r.mode !== 'air').reduce((a, r) => a + routeKm(r), 0);
  if (seed !== null) {
    const rng = mulberry(seed);
    current = { seed: seed >>> 0, amp: 75 + rng() * 40, len: 230 + rng() * 150 };
    // A warp must never fold the map over itself, or a site could slip across a coast: weaken it until it cannot.
    while (folds(current) && current.amp > 15) current.amp *= 0.85;
    spec = makeSpec(seed);
    // New names for every place word.
    const namer = makeNamer(mulberry(seed ^ 0x9a3e), new Set(collectPlaceWords([...SITES.map((s) => `${s.name} ${s.blurb}`), ...CITIES.map((c) => c.name), ...Object.values(CLASSIC.regions), ...extraTexts]).concat([spec.name.toLowerCase()])));
    for (const w of collectPlaceWords([...SITES.map((s) => `${s.name} ${s.blurb}`), ...CITIES.map((c) => c.name), ...Object.values(CLASSIC.regions), ...CANDIDATE_ROUTES.map((c) => `${c.name} ${c.blurb}`), ...extraTexts])) {
      dictionary.set(w, namer());
    }
    dictionary.set('aldmere', spec.name);
    dictionary.set('aldmeran', spec.demonym);
    // Move and rename everything on the sheet.
    for (const s of SITES) {
      const onSheet = s.x >= FRAME.x0 && s.x <= FRAME.x1 && s.y >= FRAME.y0 && s.y <= FRAME.y1;
      if (onSheet) [s.x, s.y] = warp(s.x, s.y).map((v) => Math.round(v)) as Pt;
      s.name = tr(s.name);
      s.blurb = tr(s.blurb);
    }
    for (const c of CITIES) {
      [c.x, c.y] = warp(c.x, c.y).map((v) => Math.round(v)) as Pt;
      c.name = tr(c.name);
    }
    for (const r of Object.keys(REGIONS) as RegionId[]) REGIONS[r].name = tr(REGIONS[r].name);
    for (const c of CANDIDATE_ROUTES) {
      c.name = tr(c.name);
      c.blurb = tr(c.blurb);
    }
    // Keep the whole surface network as long as the classic one.
    const worldKm = ROUTES.filter((r) => r.mode !== 'air').reduce((a, r) => a + routeKm(r), 0);
    setKmScale(classicKm / Math.max(1, worldKm));
  }
  for (const f of listeners) f();
}

/** The country's names, for the screen: the classic ones when there is no generated world. */
export const countryName = () => spec?.name ?? 'Aldmere';
export const countryTitle = () => spec?.title ?? 'Commonwealth of Aldmere';
export const demonym = () => spec?.demonym ?? 'Aldmeran';
