// Release 19.0b: map variety from the seed (docs/depth.md). A generated country has two or three features drawn from
// its world seed: a chokepoint (one plant makes a part the whole arsenal needs), a reliance on foreign suppliers for
// one material, and a long or short coast. They are drawn from their own seeded stream, never the game's, and stored
// on the game state when it starts, so a save keeps the shape it was made with.
import DEPTH from './tuning/depth.json';
import type { SimState } from './types';
import { MATERIALS, RECIPES, REGIONS, SITES, SITE_BY_ID, type MaterialId, type RegionId } from './world';
import { mulberry } from './worldgen';

const F = DEPTH.map;

export interface MapFeatures {
  /** The only plant left making a part: its rivals' lines are closed. Sabotage there does double damage. */
  chokepoint?: { material: MaterialId; site: string; closed: string[] };
  /** Home plants make only a fraction of this material: foreign suppliers make up the rest. */
  foreign?: { material: MaterialId };
  /** A long coast draws more of the air threat to the sea; a short one pushes it to the Marches. */
  coast?: 'long' | 'short';
}

/** Producers of each material, from the site table (classic shares: worlds never change them). */
function producers(m: MaterialId): { site: string; owner: string; share: number }[] {
  const out: { site: string; owner: string; share: number }[] = [];
  for (const d of SITES) for (const p of d.processes) if (RECIPES[p.recipe].output === m) out.push({ site: d.id, owner: d.owner, share: p.share });
  return out;
}

/** The features of a generated world. Same seed, same features. Under sanctions the foreign bans are reliance enough. */
export function makeFeatures(seed: number, scenario?: string): MapFeatures {
  const rng = mulberry(seed ^ 0xfea7);
  const pick = <T,>(a: T[]): T | undefined => (a.length ? a[Math.floor(rng() * a.length)] : undefined);
  const f: MapFeatures = {};
  const mats = Object.keys(MATERIALS) as MaterialId[];
  // Chokepoint: a part with two or more home makers, consolidated into one.
  const choke = pick(mats.filter((m) => F.chokepointMaterials.includes(m) && MATERIALS[m].tier !== 'finished' && producers(m).filter((p) => p.owner !== 'foreign').length >= 2));
  if (choke) {
    const home = producers(choke).filter((p) => p.owner !== 'foreign');
    const keep = home[Math.floor(rng() * home.length)];
    // (setup.ts qualifies the survivor, so the arsenals can buy from it.)
    f.chokepoint = { material: choke, site: keep.site, closed: home.filter((p) => p !== keep).map((p) => p.site) };
  }
  // Foreign reliance, on most maps: a material a foreign maker also supplies.
  const r = rng();
  if (r < F.foreignOdds) {
    const m = pick(F.foreignMaterials.filter((x) => x !== f.chokepoint?.material && producers(x as MaterialId).some((p) => p.owner === 'foreign')) as MaterialId[]);
    if (m && scenario !== 'sanctions') f.foreign = { material: m };
  }
  // Coast: long, short or ordinary; re-rolled until the map has at least two features.
  for (let i = 0; i < 20; i++) {
    const c = rng();
    f.coast = c < F.longCoastOdds ? 'long' : c < F.longCoastOdds + F.shortCoastOdds ? 'short' : undefined;
    if (!f.coast) delete f.coast;
    if (Object.keys(f).length >= 2) break;
  }
  return f;
}

/** A site process's share of national need on this map. */
export function featureShare(f: MapFeatures | null | undefined, site: string, recipe: string, share: number): number {
  if (!f) return share;
  const out = RECIPES[recipe].output;
  const c = f.chokepoint;
  if (c && out === c.material) {
    if (c.closed.includes(site)) return 0;
    if (site === c.site) return producers(out).filter((p) => p.owner !== 'foreign').reduce((a, p) => a + p.share, 0);
  }
  if (f.foreign && out === f.foreign.material) {
    const all = producers(out);
    const home = all.filter((p) => p.owner !== 'foreign').reduce((a, p) => a + p.share, 0) * F.domesticCut;
    const abroad = all.filter((p) => p.owner === 'foreign');
    const foreignTotal = abroad.reduce((a, p) => a + p.share, 0);
    if (SITE_BY_ID[site].owner !== 'foreign') return share * F.domesticCut;
    // Foreign makers grow so the country can still meet its need.
    const need = Math.max(foreignTotal, F.minTotal - home);
    return foreignTotal > 0 ? share * (need / foreignTotal) : share;
  }
  return share;
}

/** A region's share of the air threat on this map. */
export function threatShare(s: SimState, r: RegionId, base: number): number {
  const c = s.features?.coast;
  if (!c) return base;
  return (F.coastThreat as Record<string, Partial<Record<RegionId, number>>>)[c][r] ?? base;
}

/** Sea legs carry more on a long coast (more harbours and lanes), and less on a short one. */
export function seaFactor(s: SimState): number {
  const c = s.features?.coast;
  return c === 'long' ? F.seaCap.long : c === 'short' ? F.seaCap.short : 1;
}

/** Sabotage damage is multiplied at the chokepoint plant. */
export const sabotageMult = (s: SimState, site: string) => (s.features?.chokepoint?.site === site ? F.chokepointDamage : 1);

/** Independence joins the mandate on maps that rely on a foreign supplier. */
export const independenceWeight = (s: SimState) => (s.features?.foreign ? F.independenceWeight : 0);

/** One line per feature, for the new-game screen (short) and the country brief (long). */
export function featureLines(f: MapFeatures | null | undefined): { short: string; long: string }[] {
  if (!f) return [];
  const out: { short: string; long: string }[] = [];
  if (f.chokepoint) {
    const m = MATERIALS[f.chokepoint.material].name;
    const site = SITE_BY_ID[f.chokepoint.site].name;
    out.push({
      short: `Chokepoint: ${m} (one plant)`,
      long: `Chokepoint. Only ${site} makes ${m.toLowerCase()}. Guard it: sabotage there does double damage, and every line that needs it stops if it does.`,
    });
  }
  if (f.foreign) {
    const m = MATERIALS[f.foreign.material].name;
    out.push({
      short: `Relies on foreign ${m.toLowerCase()}`,
      long: `Foreign reliance. Your own plants make only ${Math.round(F.domesticCut * 100)}% of the ${m.toLowerCase()} you need; foreign makers supply the rest. The Committee now also judges your supply independence.`,
    });
  }
  if (f.coast) {
    out.push(
      f.coast === 'long'
        ? { short: 'Long coast', long: `A long coast. More of the air threat comes in from the sea over ${REGIONS.coast.name}; your sea lanes carry more.` }
        : { short: 'Short coast', long: `A short coast. The air threat shifts inland towards ${REGIONS.east.name}, and your sea lanes carry less.` },
    );
  }
  return out;
}
