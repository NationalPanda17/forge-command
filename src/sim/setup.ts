// A new campaign: every site, its stock, legacy rounds of mixed ages in the depots and bases, and the starting contracts.
import CORE from './tuning/core.json';
import { BASE_LINES, CRISES } from './fight';
import { MIN_BASE_ROUNDS } from './tick';
import { OBJECTIVES, makeCandidates } from './strategy';
import { rand, randInt } from './rng';
import { DAYS_PER_MONTH, baseDailyDraw, inputRates, nationalDailyDraw, regionDailyDraw } from './selectors';
import type { Difficulty, Lot, MonthReport, ScenarioId, Settings, SimState, SiteState } from './types';
import { PEOPLE_START } from './people';
import { setNetwork } from './graph';
import { newRival } from './rival';
import { newStory } from './story';
import { applyWorld } from './worldgen';
import { featureShare, makeFeatures } from './features';
import { scenarioStart } from './scenarios';
import { newTowns } from './towns';
import { newHotseat } from './hotseat';
import { newDiplomacy } from './diplomacy';
import { newCyber } from './cyber';
import { newUnions } from './unions';
import { RIVAL_PACE, tidy, type CustomScenario } from './custom';
import { newEnergy } from './energy';
import { newOversight } from './audit';
import { newCommunities } from './communities';
import { newAutomation, type AutoArea } from './automation';
import { newEngineers } from './engineers';
import { newIntel } from './intelops';
import { newDoctrine } from './doctrine';
import { newCast } from './cast';
import { seedFrom } from './rng';
import { FIGHTING_REGIONS, FINISHED, MATERIALS, RECIPES, REGIONS, SITES, SITE_BY_ID, START_LINES, processCapacity, type LineId, type RegionId } from './world';

export interface SimOptions {
  seed: number;
  difficulty?: Difficulty;
  scenario?: ScenarioId;
  months?: number;
  /** Sandbox rules; the standard game uses DEFAULT_SETTINGS. */
  settings?: Partial<Settings>;
  /** Extra starting money and monthly budget, for the sandbox ($M). */
  money?: { treasury?: number; appropriation?: number };
  /** Campaign (scored) or sandbox (free play). */
  mode?: 'campaign' | 'sandbox';
  /** Play the four-chapter story. */
  story?: boolean;
  /** Seed of a generated world; null or missing plays on the classic map. */
  world?: number | null;
  /** Two players' names, for a hot-seat game. */
  hotseat?: [string, string];
  /** Your own starting situation. */
  custom?: CustomScenario;
  /** Areas handed to your chief of staff from the start. */
  automation?: AutoArea[];
}

export const DEFAULT_SETTINGS: Settings = { inflation: true, seasons: true, crises: true, events: 1, endless: false, dismissal: true };
/** A sandbox starts with no end date and no dismissal; everything else as normal. */
export const SANDBOX_SETTINGS: Settings = { ...DEFAULT_SETTINGS, endless: true, dismissal: false };
/** Endless campaigns still need a number: a century. */
const ENDLESS_DAYS = 100 * 360;

export interface ScenarioDef {
  name: string;
  blurb: string;
}
export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  standard: { name: 'Peacetime', blurb: 'An old, thin reserve and four years to fix it. The standard game.' },
  warFooting: { name: 'War footing', blurb: 'A crisis is already under way in the north. More money, and no time to learn.' },
  sanctions: { name: 'Sanctions', blurb: 'Every foreign supplier is under an export ban for most of a year, and prices are already up.' },
  rebuild: { name: 'Rebuild', blurb: 'Years of neglect: the war reserve is half the usual size, but the Committee has opened its purse.' },
  tutorial: { name: 'Tutorial', blurb: 'A guided first two years on Easy, with no crisis for the first year.' },
  custom: { name: 'Custom', blurb: 'Your own starting situation: money, reserve, prices, crises, the rival, bans. Share it as a code.' },
};

/**
 * The current save schema. Raise it by one, and add a step to migrate(), whenever the shape of a save changes; the
 * Unreal port reads browser saves through the same numbered steps (docs/port/saves.md).
 */
export const SAVE_SCHEMA = 2;

/**
 * Brings a save of any earlier schema up to SAVE_SCHEMA and attaches its map. First every missing field is filled with
 * its default (this changes nothing in a complete save, so it runs on every load and also mends a damaged one); then
 * the numbered conversion steps run for anything older than they are.
 */
export function migrate(s: SimState): SimState {
  const from = s.schema ?? 1;
  fillDefaults(s);
  // Numbered conversions go here, oldest first, e.g. if (from < 3) toSchema3(s);
  void from;
  s.schema = SAVE_SCHEMA;
  return s;
}

/** Fills in every field added since 2.0 that a save lacks (schema 2 = everything up to 18.0). */
function fillDefaults(s: SimState): void {
  s.world ??= null;
  applyWorld(s.world);
  s.tests ??= [];
  s.hotseat ??= null;
  s.priceIndex ??= 1;
  s.tenders ??= [];
  s.exports ??= [];
  s.allies ??= { merrow: 55, calder: 55 };
  s.chains ??= [];
  s.tutorial ??= null;
  s.supplemented ??= [];
  s.network ??= { built: [], upgrades: {}, projects: [], icebreaker: false, hardened: [] };
  s.settings = { ...DEFAULT_SETTINGS, ...(s.settings ?? {}) };
  s.news ??= [];
  s.mode ??= 'campaign';
  s.rival ??= newRival(s);
  s.programmes ??= [];
  s.policies ??= [];
  s.term ??= 1;
  s.inhouse ??= [];
  s.variants ??= {};
  s.design ??= null;
  s.story ??= null;
  for (const def of SITES) {
    // Saves from before plots existed: add the new open plots, closed until founded.
    if (!s.sites[def.id]) s.sites[def.id] = blankSite(def.id);
  }
  delete (s as { challenge?: unknown }).challenge;
  for (const site of Object.values(s.sites)) {
    site.skill ??= PEOPLE_START.skill;
    site.morale ??= PEOPLE_START.morale;
    site.fatigue ??= PEOPLE_START.fatigue;
    site.safety ??= PEOPLE_START.safety;
    site.apprentices ??= PEOPLE_START.apprentices;
  }
  setNetwork(s.network.built, s.network.upgrades);
  if (!(s.scenario in SCENARIOS)) s.scenario = 'standard';
  s.towns ??= newTowns(s);
  s.diplomacy ??= newDiplomacy(s);
  s.hearing ??= null;
  s.promises ??= [];
  s.cyber ??= newCyber();
  s.unions ??= newUnions();
  s.career ??= [];
  s.custom ??= null;
  s.termMonth ??= 0;
  s.energy ??= newEnergy();
  s.oversight ??= newOversight();
  s.communities ??= newCommunities();
  s.automation ??= newAutomation();
  // Two tutorial steps were added before "Keep watch" in 13.0.
  if (!s.engineers && s.tutorial && s.tutorial.step >= 7 && s.tutorial.step < 99) s.tutorial.step += 2;
  s.engineers ??= newEngineers(s);
  s.engineers.funded ??= s.engineers.staff;
  s.intel ??= newIntel();
  s.doctrine ??= newDoctrine();
  s.moments ??= s.feed.filter((f) => f.alert).map((f) => ({ day: f.day, tone: f.tone, text: f.text }));
  if (!s.cast) s.cast = newCast(s);
  s.cast.rng ??= seedFrom(`cast|${s.seed}`);
  s.month.spend.energy ??= 0;
}

export const DIFFICULTY_MONEY: Record<Difficulty, { treasury: number; appropriation: number }> = CORE.difficulty.money;

export const emptyMonth = (month: number): MonthReport => ({
  month,
  made: {},
  fired: {},
  arrived: { drone: 0, rocket: 0, cruise: 0, ballistic: 0, aircraft: 0 },
  stopped: { drone: 0, rocket: 0, cruise: 0, ballistic: 0, aircraft: 0 },
  leaked: { drone: 0, rocket: 0, cruise: 0, ballistic: 0, aircraft: 0 },
  spend: { purchases: 0, operations: 0, transport: 0, projects: 0, demil: 0, energy: 0 },
  income: { appropriation: 0, sales: 0 },
  interceptorSpend: 0,
  threatValueStopped: 0,
  readiness: 0,
  confidence: 0,
  treasury: 0,
  retired: 0,
  demilled: 0,
});

/** Legacy stock: lots made between 1 and 9 years ago. */
function legacyLots(s: { rng: number }, line: LineId, qty: number, old = false): Lot[] {
  if (qty <= 0) return [];
  const shelf = MATERIALS[line].shelfDays;
  const lots: Lot[] = [];
  const n = old ? 8 : 4;
  let left = Math.round(qty);
  for (let i = 0; i < n; i++) {
    const q = i === n - 1 ? left : Math.round(qty / n);
    if (q <= 0) continue;
    left -= q;
    // The war reserve is old: most of it was made in the last decade's buying spree.
    const made = old && i < n * 0.6 ? -randInt(s, shelf - 700, shelf - 20) : -randInt(s, 360, shelf - 20);
    lots.push({ qty: q, made, until: made + shelf });
  }
  return lots.sort((a, b) => a.made - b.made);
}

/** A site with nothing on it: used for open plots in older saves. */
function blankSite(id: string): SiteState {
  return { id, status: 'closed', condition: 100, repairDays: 0, processes: [], stock: {}, lots: {}, unserviceable: {}, workers: 0, trainees: [], extraCrew: 0, health: 100, qualified: true, qualifyingDays: null, embargoDays: 0, disruptionDays: 0, disruptionFactor: 1, ...PEOPLE_START };
}

export function newSim({ seed, difficulty = 'normal', scenario = 'standard', months = 48, settings, money: extra, mode = 'campaign', story = false, world = null, hotseat, custom: customIn, automation }: SimOptions): SimState {
  // The story and the tutorial are written for the classic map.
  if (story || scenario === 'tutorial') world = null;
  applyWorld(world);
  if (story) {
    scenario = 'standard';
    months = 48;
    mode = 'campaign';
  }
  const custom = customIn && !story ? tidy(customIn) : null;
  if (custom) scenario = 'custom';
  else if (scenario === 'custom') scenario = 'standard';
  const rules: Settings = { ...(mode === 'sandbox' ? SANDBOX_SETTINGS : DEFAULT_SETTINGS), ...(settings ?? {}), ...(custom ? { events: custom.events } : {}) };
  if (scenario === 'tutorial') {
    difficulty = 'easy';
    months = Math.min(months, 24);
  }
  const money = DIFFICULTY_MONEY[difficulty];
  const state: SimState = {
    version: 1,
    schema: SAVE_SCHEMA,
    seed: seed >>> 0,
    rng: seed >>> 0,
    day: 0,
    days: rules.endless ? ENDLESS_DAYS : months * DAYS_PER_MONTH,
    plannedDays: months * DAYS_PER_MONTH,
    difficulty,
    scenario,
    treasury: money.treasury + (extra?.treasury ?? 0),
    appropriation: money.appropriation + (extra?.appropriation ?? 0),
    confidence: 60,
    sites: {},
    shipments: [],
    contracts: [],
    routeLoad: {},
    crisis: null,
    policy: {
      depotDays: { north: 30, coast: 30, east: 30, isles: 45, central: 0 },
      baseDays: 10,
      surveillance: true,
      demilMethod: 'burn',
      conserve: false,
    },
    lines: Object.fromEntries(FINISHED.map((l) => [l, { unlocked: START_LINES.includes(l as LineId) }])) as SimState['lines'],
    feed: [],
    month: emptyMonth(0),
    history: [],
    nextId: 1,
    over: false,
    outcome: 'running',
    alert: null,
    priceIndex: scenario === 'sanctions' ? 1.12 : 1,
    tenders: [],
    exports: [],
    allies: { merrow: 55, calder: 55 },
    chains: [],
    tutorial: scenario === 'tutorial' ? { step: 0 } : null,
    supplemented: [],
    network: { built: [], upgrades: {}, projects: [], icebreaker: false, hardened: [] },
    settings: rules,
    news: [],
    mode,
    rival: { order: [], known: [], next: 0 },
    programmes: [],
    policies: [],
    term: 1,
    inhouse: [],
    variants: {},
    design: null,
    story: null,
    world,
    ...(world !== null && world !== undefined ? { features: makeFeatures(world, scenario) } : {}),
    towns: [],
    tests: [],
    hotseat: hotseat ? newHotseat(hotseat) : null,
    diplomacy: { nations: {}, guarantees: {}, missions: {}, coprod: [], deskReady: 0 },
    hearing: null,
    promises: [],
    cyber: newCyber(),
    unions: newUnions(),
    termMonth: 0,
    career: [],
    custom,
    energy: newEnergy(),
    oversight: newOversight(),
    communities: newCommunities(),
    automation: newAutomation(hotseat || scenario === 'tutorial' ? [] : automation ?? []),
    engineers: { staff: 0, market: 0, academies: [], pay: 'standard', funded: 0, short: 0 },
    intel: newIntel(),
    doctrine: newDoctrine(),
    cast: { rng: 0, managers: {}, leaders: {}, pool: [], poolDay: 0 },
    moments: [],
    strategy: {
      research: { done: [], active: null },
      staff: { procurement: null, quality: null, logistics: null, research: null, labor: null },
      candidates: [],
      factions: { hawks: 55, treasury: 55, regions: 55, industry: 55 },
      decisions: [],
      objectives: OBJECTIVES.map((o) => ({ id: o.id, status: 'open' as const })),
      baseBudget: money.appropriation + (extra?.appropriation ?? 0),
      startWorkers: 0,
      investedThisMonth: 0,
    },
  };

  for (const def of SITES) {
    const site: SiteState = {
      id: def.id,
      status: def.kind === 'plot' ? 'closed' : 'active',
      condition: def.owner === 'state' ? 85 : Math.round(70 + rand(state) * 25),
      repairDays: 0,
      processes: def.processes.map((p) => ({
        recipe: p.recipe,
        capacity: processCapacity({ ...p, share: featureShare(state.features, def.id, p.recipe, p.share) }),
        maturity: 1,
        run: START_LINES.includes(RECIPES[p.recipe].output as LineId) || def.owner !== 'state' || !FINISHED.includes(RECIPES[p.recipe].output) ? 'normal' : 'idle',
        partial: 0,
        lastOutput: 0,
        lastLimit: null,
        expansions: 0,
      })),
      stock: {},
      lots: {},
      unserviceable: {},
      workers: def.crew,
      trainees: [],
      extraCrew: 0,
      health: def.owner === 'state' ? 100 : Math.round(55 + rand(state) * 30),
      qualified: def.qualified,
      qualifyingDays: null,
      embargoDays: 0,
      disruptionDays: 0,
      disruptionFactor: 1,
      ...PEOPLE_START,
    };
    state.sites[def.id] = site;
  }

  // Input buffers and a few days of output at every producing site.
  for (const site of Object.values(state.sites)) {
    const rates = inputRates(state, site);
    for (const [mat, rate] of Object.entries(rates)) site.stock[mat as keyof typeof rates] = Math.round(rate! * 12 * 100) / 100;
    for (const p of site.processes) {
      const out = RECIPES[p.recipe].output;
      if (!FINISHED.includes(out)) site.stock[out] = (site.stock[out] ?? 0) + p.capacity * 4;
    }
  }

  // Legacy rounds: the central depot, regional depots and bases.
  for (const line of START_LINES) {
    const daily = nationalDailyDraw(state, line);
    state.sites.depotCentral.lots[line] = legacyLots(state, line, daily * (['gmlrs', 'shell155'].includes(line) ? 300 : 240) * (scenario === 'rebuild' ? 0.5 : custom ? custom.reserve : 1), true);
    for (const region of FIGHTING_REGIONS) {
      const depot = REGIONS[region].depot;
      const rd = regionDailyDraw(state, region as RegionId, line);
      if (rd > 0) state.sites[depot].lots[line] = legacyLots(state, line, rd * 20);
    }
    for (const def of SITES) {
      if (!(BASE_LINES[def.kind] ?? []).includes(line)) continue;
      const bd = baseDailyDraw(state, def.id, line);
      if (bd > 0) state.sites[def.id].lots[line] = legacyLots(state, line, Math.max(bd * state.policy.baseDays, MIN_BASE_ROUNDS[line] ?? 4));
    }
  }

  // A generated map's features (19.0b): the chokepoint plant and the foreign makers you rely on start qualified.
  const feat = state.features;
  if (feat?.chokepoint) state.sites[feat.chokepoint.site].qualified = true;
  if (feat?.foreign) for (const d of SITES) if (d.owner === 'foreign' && d.processes.some((p) => RECIPES[p.recipe].output === feat.foreign!.material)) state.sites[d.id].qualified = true;

  // Starting contracts: the arsenals' main suppliers, 85% of need, nine months.
  const arsenals = SITES.filter((x) => x.owner === 'state' && x.kind === 'arsenal');
  const needs: Record<string, number> = {};
  for (const a of arsenals) for (const [mat, rate] of Object.entries(inputRates(state, state.sites[a.id]))) needs[mat] = (needs[mat] ?? 0) + rate!;
  for (const [mat, need] of Object.entries(needs)) {
    // On a feature map the contract goes to the qualified maker with the most capacity, foreign ones included for the
    // material you rely on abroad; the classic map keeps its first private supplier.
    const src = feat
      ? SITES.filter((x) => (x.owner === 'private' || (x.owner === 'foreign' && feat.foreign?.material === mat)) && state.sites[x.id].qualified)
          .map((x) => ({ x, cap: state.sites[x.id].processes.filter((p) => RECIPES[p.recipe].output === mat).reduce((a, p) => a + p.capacity, 0) }))
          .filter((c) => c.cap > 0)
          .sort((a, b) => b.cap - a.cap)[0]?.x
      : SITES.find((x) => x.owner === 'private' && x.qualified && x.processes.some((p) => RECIPES[p.recipe].output === mat));
    if (!src) continue;
    state.contracts.push({ id: state.nextId++, site: src.id, material: mat as LineId, perDay: Math.round(need * 0.85 * 1000) / 1000, price: MATERIALS[mat as LineId].price * 0.88, endDay: 9 * DAYS_PER_MONTH });
  }
  // Scenario starts.
  if (scenario === 'warFooting') {
    const c = CRISES.find((x) => x.region === 'north') ?? CRISES[0];
    state.crisis = { id: c.id, name: c.name, region: c.region, family: c.family, phase: 'active', days: 240, intensity: 1.1, mix: { ...c.mix } };
    state.appropriation = Math.round(state.appropriation * 1.15);
    state.strategy.baseBudget = state.appropriation;
    state.confidence = 55;
    state.strategy.factions.hawks = 65;
    state.supplemented.push(c.id);
  }
  if (scenario === 'rebuild') {
    state.treasury += 500;
    state.appropriation = Math.round(state.appropriation * 1.1);
    state.strategy.baseBudget = state.appropriation;
  }
  if (custom) {
    state.treasury = custom.treasury + (extra?.treasury ?? 0);
    state.appropriation = custom.appropriation + (extra?.appropriation ?? 0);
    state.strategy.baseBudget = state.appropriation;
    state.confidence = custom.confidence;
    state.priceIndex = custom.prices;
    state.allies = { merrow: custom.allies, calder: custom.allies };
    for (const def of SITES) if (def.owner === 'foreign' && def.nation && custom.bans[def.nation]) state.sites[def.id].embargoDays = custom.bans[def.nation] * DAYS_PER_MONTH;
    const c = CRISES.find((x) => x.id === custom.crisis);
    if (c) {
      state.crisis = { id: c.id, name: c.name, region: c.region, family: c.family, phase: 'active', days: 240, intensity: 1.1, mix: { ...c.mix } };
      state.supplemented.push(c.id);
    }
  }
  if (!rules.crises && state.crisis) state.crisis = null;
  state.rival = newRival(state);
  if (custom) state.rival.next = Math.round(state.rival.next * RIVAL_PACE[custom.rivalPace]);
  state.diplomacy = newDiplomacy(state);
  // Each scenario's own rules (19.0c): the front, the bans and their broker, worn plants.
  scenarioStart(state);
  if (story) state.story = newStory(0);
  state.towns = newTowns(state);
  // The tutorial keeps the rival quiet for its first year.
  if (scenario === 'tutorial') state.rival.next = 420;
  setNetwork([], {});
  void SITE_BY_ID;
  state.strategy.candidates = makeCandidates(state);
  state.strategy.startWorkers = Object.values(state.sites).reduce((a, x) => a + x.workers, 0);
  state.engineers = newEngineers(state);
  state.cast = newCast(state);
  return state;
}
