// The world of Forge Command 2.0: materials, recipes from mine to finished round, the sites of the
// (fictional) Commonwealth of Aldmere, and the transport network linking them.
//
// Designations and makers of finished rounds are real; every site, company, nation and person is fictional.
// Physical figures (launch weights, warhead weights) follow public reference data where it exists and are best
// guesses elsewhere. Map units are kilometres.

// The tables are data (18.1): src/sim/data/*.json, the source for the Unreal DataTables (docs/port/data.md).
import candidateRoutesData from './data/candidateRoutes.json';
import citiesData from './data/cities.json';
import lineRateData from './data/lineRate.json';
import materialsData from './data/materials.json';
import modesData from './data/modes.json';
import publicRateData from './data/publicRate.json';
import recipesData from './data/recipes.json';
import regionsData from './data/regions.json';
import routesData from './data/routes.json';
import sitesData from './data/sites.json';
// ---------- Materials ----------

export type MaterialId =
  // Raw
  | 'ironOre' | 'coal' | 'bauxite' | 'zincOre' | 'copperOre' | 'rareEarthOre' | 'silica' | 'brine' | 'natGas' | 'cellulose'
  // Processed
  | 'steel' | 'aluminium' | 'copper' | 'gallium' | 'germanium' | 'reOxide' | 'polysilicon' | 'ammonia' | 'nitricAcid'
  | 'perchlorate' | 'htpb' | 'nitrocellulose' | 'highExplosive'
  // Intermediate
  | 'propellant' | 'wafers' | 'siChips' | 'ganChips' | 'magnets' | 'geOptics'
  // Components
  | 'rocketMotor' | 'warhead' | 'seekerRF' | 'seekerIR' | 'guidance' | 'actuators' | 'airframe' | 'fuze' | 'shellBody' | 'propCharge'
  // Finished rounds
  | 'pac3' | 'sm6' | 'tamir' | 'irist' | 'stinger' | 'gmlrs' | 'shell155' | 'apkws' | 'coyote' | 'javelin';

export type Tier = 'raw' | 'processed' | 'intermediate' | 'component' | 'finished';

export interface MaterialDef {
  id: MaterialId;
  name: string;
  tier: Tier;
  unit: string;
  /** Tonnes per unit, for transport. */
  weight: number;
  /** $M per unit at list price. */
  price: number;
  /** Days before stock goes off (0 = keeps). */
  shelfDays: number;
  blurb: string;
}


export const MATERIALS: Record<MaterialId, MaterialDef> = materialsData as unknown as Record<MaterialId, MaterialDef>;
export const MATERIAL_IDS = Object.keys(MATERIALS) as MaterialId[];
export const FINISHED: MaterialId[] = ['pac3', 'sm6', 'tamir', 'irist', 'stinger', 'gmlrs', 'shell155', 'apkws', 'coyote', 'javelin'];
export type LineId = 'pac3' | 'sm6' | 'tamir' | 'irist' | 'stinger' | 'gmlrs' | 'shell155' | 'apkws' | 'coyote' | 'javelin';
export const isFinished = (id: MaterialId): id is LineId => FINISHED.includes(id);

// ---------- Recipes ----------

export interface RecipeDef {
  id: string;
  name: string;
  output: MaterialId;
  /** Units of output per batch. */
  yieldQty: number;
  /** By-products per batch. */
  extra?: Partial<Record<MaterialId, number>>;
  inputs: Partial<Record<MaterialId, number>>;
  /** Share of output that fails inspection and is scrapped. */
  scrap: number;
}


export const RECIPES: Record<string, RecipeDef> = recipesData as unknown as Record<string, RecipeDef>;
export const recipeFor = (output: MaterialId) => Object.values(RECIPES).find((x) => x.output === output);

/** Game production rates per day at the start (about a fifth of public reference rates). */
export const LINE_RATE: Record<LineId, number> = lineRateData as unknown as Record<LineId, number>;
export const PUBLIC_RATE: Record<LineId, string> = publicRateData as unknown as Record<LineId, string>;
/** Lines that exist at the start; the rest need research and a new line. */
export const START_LINES: LineId[] = ['pac3', 'sm6', 'tamir', 'irist', 'stinger', 'gmlrs', 'shell155'];

/** Daily need of every material to run the starting lines at their base rate (walks the recipe tree). */
export function baselineDemand(lines: LineId[] = START_LINES): Record<MaterialId, number> {
  const need = Object.fromEntries(MATERIAL_IDS.map((id) => [id, 0])) as Record<MaterialId, number>;
  const add = (id: MaterialId, qty: number) => {
    need[id] += qty;
    const rec = recipeFor(id);
    if (!rec) return;
    const gross = qty / (1 - rec.scrap) / rec.yieldQty;
    for (const [inp, q] of Object.entries(rec.inputs) as [MaterialId, number][]) add(inp, gross * q);
  };
  for (const l of lines) add(l, LINE_RATE[l]);
  return need;
}
export const BASELINE = baselineDemand();

// ---------- Sites ----------

export type SiteKind =
  | 'mine' | 'quarry' | 'well' | 'forestry'
  | 'steelworks' | 'smelter' | 'refinery' | 'chemical' | 'explosives' | 'fab'
  | 'components' | 'motors' | 'arsenal' | 'testRange' | 'depot' | 'adBase' | 'artillery' | 'airBase'
  | 'port' | 'airfield' | 'demil' | 'foreign' | 'plot';
export type RegionId = 'north' | 'coast' | 'east' | 'isles' | 'central';
export type Owner = 'state' | 'private' | 'foreign';

export interface ProcessDef {
  recipe: string;
  /** Share of the national baseline need this site can cover at full capacity. */
  share: number;
}

export interface SiteDef {
  id: string;
  name: string;
  kind: SiteKind;
  x: number;
  y: number;
  region: RegionId;
  owner: Owner;
  processes: ProcessDef[];
  /** Workers at full capacity. */
  crew: number;
  /** Starts qualified to supply your arsenals. */
  qualified: boolean;
  nation?: string;
  blurb: string;
}


export const SITES: SiteDef[] = sitesData as unknown as SiteDef[];
export const SITE_BY_ID: Record<string, SiteDef> = Object.fromEntries(SITES.map((x) => [x.id, x]));

/** Units of output a process can make per day at full capacity and maturity. */
export function processCapacity(p: ProcessDef): number {
  const out = RECIPES[p.recipe].output;
  return BASELINE[out] * p.share;
}

// ---------- Cities ----------

export interface CityDef {
  name: string;
  x: number;
  y: number;
  /** Thousands. */
  pop: number;
  capital?: boolean;
}

export const CITIES: CityDef[] = citiesData as unknown as CityDef[];

// ---------- Transport network ----------

export type Mode = 'rail' | 'road' | 'sea' | 'air';

export interface RouteDef {
  a: string;
  b: string;
  mode: Mode;
  /** Tonnes per day. */
  cap: number;
}

/** km/day and $M per tonne-km. */
export const MODES: Record<Mode, { name: string; speed: number; cost: number; detour: number }> = modesData as unknown as Record<Mode, { name: string; speed: number; cost: number; detour: number }>;


export const ROUTES: RouteDef[] = routesData as unknown as RouteDef[];

/** Links the player can build. Each is a new route once finished. */
export interface CandidateRoute extends RouteDef {
  id: string;
  name: string;
  blurb: string;
}
export const CANDIDATE_ROUTES: CandidateRoute[] = candidateRoutesData as unknown as CandidateRoute[];
/** Spurs that come with a plot rather than being built on their own. */
export const isPlotSpur = (id: string) => id.startsWith('plot-');
export const CANDIDATE_BY_ID: Record<string, CandidateRoute> = Object.fromEntries(CANDIDATE_ROUTES.map((c) => [c.id, c]));

export const ROUTE_KEY = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
/**
 * Generated worlds scale distances so the whole network is as long as the classic one: which links are long or short
 * changes from world to world, but the country is no harder to supply overall.
 */
let KM_SCALE = 1;
export const setKmScale = (k: number) => {
  KM_SCALE = k;
};

export function routeKm(rt: RouteDef): number {
  const A = SITE_BY_ID[rt.a];
  const B = SITE_BY_ID[rt.b];
  return Math.hypot(A.x - B.x, A.y - B.y) * MODES[rt.mode].detour * KM_SCALE;
}

// ---------- Regions and the fight ----------

export const REGIONS: Record<RegionId, { name: string; threatShare: number; landShare: number; depot: string }> = regionsData as unknown as Record<RegionId, { name: string; threatShare: number; landShare: number; depot: string }>;
export const FIGHTING_REGIONS: RegionId[] = ['north', 'coast', 'east', 'isles'];
