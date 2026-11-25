// Build your own industry: found plants on open plots, bring parts in-house at your arsenals, and design round variants.
import { setNetwork } from './graph';
import { queueTest } from './testing';
import { storyCount } from './storyCount';
import { workPace } from './engineers';
import { permitHeld, seekPermit } from './communities';
import { clamp } from './rng';
import type { FeedItem, SimState } from './types';
import { MATERIALS, RECIPES, SITES, SITE_BY_ID, processCapacity, type LineId, type MaterialId, type SiteKind } from './world';

type Feed = (s: SimState, tone: FeedItem['tone'], text: string, site?: string, alert?: boolean) => void;

/** Recipes you can found a plant for, with the kind of plant and the crew it needs. */
export const FOUNDABLE: Record<string, { kind: SiteKind; crew: number }> = {
  apElectrolysis: { kind: 'chemical', crew: 160 },
  propellantMix: { kind: 'explosives', crew: 240 },
  motorCasting: { kind: 'motors', crew: 300 },
  warheadLoading: { kind: 'explosives', crew: 260 },
  seekerRFAssembly: { kind: 'components', crew: 220 },
  seekerIRAssembly: { kind: 'components', crew: 200 },
  opticsGrinding: { kind: 'components', crew: 140 },
  ganChipFab: { kind: 'fab', crew: 280 },
  guidanceAssembly: { kind: 'components', crew: 220 },
  magnetMaking: { kind: 'components', crew: 150 },
  reSeparation: { kind: 'refinery', crew: 140 },
};
export const FOUNDABLE_IDS = Object.keys(FOUNDABLE);

export const PLOT_IDS = SITES.filter((d) => d.kind === 'plot').map((d) => d.id);
export const FOUND_DAYS = 360;
export const INHOUSE_DAYS = 240;
/** A new plant is sized at half of what today's lines need of its output. */
const NEW_SHARE = 0.5;

const capacityFor = (recipe: string) => processCapacity({ recipe, share: NEW_SHARE });

/** $M to found a plant: about two-thirds of a year of what it would make, at today's prices. */
export function foundCost(s: SimState, recipe: string): number {
  const out = RECIPES[recipe].output;
  return Math.max(60, Math.round(capacityFor(recipe) * MATERIALS[out].price * 360 * 0.65 * s.priceIndex));
}
export const inhouseCost = (s: SimState, recipe: string) => Math.round(foundCost(s, recipe) * 0.8);

export const isFounded = (s: SimState, plot: string) => s.sites[plot]?.processes.length > 0;

/** Why a plant cannot be founded, or null. */
export function foundBlock(s: SimState, plot: string, recipe: string): string | null {
  const def = SITE_BY_ID[plot];
  if (!def || def.kind !== 'plot') return 'Not an open plot.';
  if (isFounded(s, plot)) return 'A plant already stands here.';
  if (!FOUNDABLE[recipe]) return 'You cannot found a plant for that.';
  const cost = foundCost(s, recipe);
  return s.treasury >= cost ? null : `Not enough money (needs $${cost}M).`;
}

/** Why a line cannot be added at one of your arsenals, or null. */
export function inhouseBlock(s: SimState, site: string, recipe: string): string | null {
  const def = SITE_BY_ID[site];
  if (!def || def.owner !== 'state' || def.kind !== 'arsenal') return 'Only at your arsenals.';
  if (!FOUNDABLE[recipe]) return 'That cannot be made in-house.';
  if (s.sites[site].processes.some((p) => p.recipe === recipe)) return 'Already made here.';
  if (s.sites[site].processes.length >= 6) return 'No room for another line here.';
  const cost = inhouseCost(s, recipe);
  return s.treasury >= cost ? null : `Not enough money (needs $${cost}M).`;
}

function newProcess(recipe: string) {
  return { recipe, capacity: capacityFor(recipe), maturity: 0.15, run: 'normal' as const, partial: 0, lastOutput: 0, lastLimit: null, expansions: 0 };
}

export function foundPlant(s: SimState, plot: string, recipe: string, feed: Feed): void {
  const cost = foundCost(s, recipe);
  s.treasury -= cost;
  s.month.spend.projects += cost;
  const site = s.sites[plot];
  site.processes = [newProcess(recipe)];
  site.status = 'building';
  site.repairDays = FOUND_DAYS;
  site.condition = 100;
  site.extraCrew = FOUNDABLE[recipe].crew;
  site.plantKind = FOUNDABLE[recipe].kind;
  site.plantName = `${SITE_BY_ID[plot].name.replace(/ plot$/, '')} ${RECIPES[recipe].name.split(' ')[0]} Works`;
  site.qualified = true;
  // The spur is laid with the plant.
  if (!s.network.built.includes(`plot-${plot}`)) s.network.built.push(`plot-${plot}`);
  setNetwork(s.network.built, s.network.upgrades);
  s.strategy.factions.regions = clamp(s.strategy.factions.regions + 3);
  s.strategy.factions.industry = clamp(s.strategy.factions.industry + 2);
  storyCount(s, 'founded');
  seekPermit(s, 'plant', plot, plot, feed);
  feed(s, 'good', `Ground is broken at ${SITE_BY_ID[plot].name}: a new ${MATERIALS[RECIPES[recipe].output].name.toLowerCase()} plant, ready in about a year. Hire ${FOUNDABLE[recipe].crew} people to run it.`, plot, true);
}

export function addInhouseLine(s: SimState, site: string, recipe: string, feed: Feed): void {
  const cost = inhouseCost(s, recipe);
  s.treasury -= cost;
  s.month.spend.projects += cost;
  const st = s.sites[site];
  const p = newProcess(recipe);
  // The line is fitted out first: it ramps from nothing over the build.
  p.maturity = 0;
  st.processes.push(p);
  st.extraCrew += FOUNDABLE[recipe].crew;
  s.inhouse.push({ site, recipe, days: INHOUSE_DAYS });
  storyCount(s, 'founded');
  feed(s, 'info', `A ${RECIPES[recipe].name.toLowerCase()} line is going in at ${SITE_BY_ID[site].name}: about eight months to fit out. Hire ${FOUNDABLE[recipe].crew} more people there.`, site);
}

/** Construction counts down; finished plants open. */
export function industryDay(s: SimState, feed: Feed): void {
  for (const id of PLOT_IDS) {
    const site = s.sites[id];
    if (site.status !== 'building') continue;
    // Nothing is built while the town's objection stands.
    if (permitHeld(s, id)) continue;
    site.repairDays--;
    if (site.repairDays <= 0) {
      site.status = 'active';
      feed(s, 'good', `${site.plantName ?? SITE_BY_ID[id].name} opens and starts to ramp up.`, id, true);
    }
  }
  for (const job of s.inhouse) {
    job.days--;
    const p = s.sites[job.site].processes.find((x) => x.recipe === job.recipe);
    // Held at zero until fitted out, then ramps like any new line.
    if (p && job.days > 0) p.maturity = 0;
    if (p && job.days === 0) {
      p.maturity = 0.15;
      feed(s, 'good', `The in-house ${RECIPES[job.recipe].name.toLowerCase()} line at ${SITE_BY_ID[job.site].name} is fitted out and starts to ramp up.`, job.site);
    }
  }
  s.inhouse = s.inhouse.filter((j) => j.days > 0);
  // Variant design work.
  const d = s.design;
  if (d) {
    d.days -= workPace(s);
    if (d.days <= 0) {
      s.design = null;
      feed(s, 'good', `Design complete: ${VARIANTS[d.variant].name} ${MATERIALS[d.line].name}. It goes into service once it passes its test firings.`, undefined, true);
      queueTest(s, d.line, d.variant, feed);
    }
  }
}

// ---------- Round variants ----------

export type VariantId = 'standard' | 'extended' | 'lean' | 'longLife';
export interface VariantDef {
  id: VariantId;
  name: string;
  effect: string;
  /** Multipliers on the bill of materials; '*' applies to every input. */
  inputs: Partial<Record<MaterialId | '*', number>>;
  pk: number;
  shelf: number;
}
export const VARIANTS: Record<VariantId, VariantDef> = {
  standard: { id: 'standard', name: 'Standard', effect: 'The baseline design.', inputs: {}, pk: 1, shelf: 1 },
  extended: { id: 'extended', name: 'Extended-range', effect: 'A bigger motor: 8% better odds of a kill, but 30% more rocket motor per round.', inputs: { rocketMotor: 1.3 }, pk: 1.08, shelf: 1 },
  lean: { id: 'lean', name: 'Lean-build', effect: 'Simpler parts throughout: 20% less of every input, but 8% worse odds of a kill.', inputs: { '*': 0.8 }, pk: 0.92, shelf: 1 },
  longLife: { id: 'longLife', name: 'Long-life', effect: 'Sealed canisters and better fills: rounds last 50% longer, for 10% more of every input.', inputs: { '*': 1.1 }, pk: 1, shelf: 1.5 },
};
export const VARIANT_IDS = Object.keys(VARIANTS) as VariantId[];
export const DESIGN_DAYS = 120;
export const designCost = (s: SimState) => Math.round(40 * s.priceIndex);

export const variantOf = (s: SimState, line: LineId): VariantDef => VARIANTS[s.variants?.[line] ?? 'standard'];

/** Input multiplier for a line's recipe under its variant. */
export function variantInput(s: SimState, recipe: string, m: MaterialId): number {
  const out = RECIPES[recipe]?.output as LineId;
  const v = s.variants?.[out];
  if (!v) return 1;
  const def = VARIANTS[v];
  return (def.inputs[m] ?? 1) * (def.inputs['*'] ?? 1);
}

export function designBlock(s: SimState, line: LineId, variant: VariantId): string | null {
  if (!s.lines[line]?.unlocked) return 'That round is not in production.';
  if (s.design) return 'Your designers are busy with another variant.';
  if (s.tests?.some((t) => t.line === line && t.variant)) return 'A design for this round is still on the test schedule.';
  if ((s.variants[line] ?? 'standard') === variant) return 'Already in production.';
  return s.treasury >= designCost(s) ? null : `Not enough money (needs $${designCost(s)}M).`;
}

/** Plants you founded, for lists and the map. */
export const foundedPlots = (s: SimState) => PLOT_IDS.filter((id) => isFounded(s, id));
