// The world of Forge Command 2.0: materials, recipes from mine to finished round, the sites of the
// (fictional) Commonwealth of Aldmere, and the transport network linking them.
//
// Designations and makers of finished rounds are real; every site, company, nation and person is fictional.
// Physical figures (launch weights, warhead weights) follow public reference data where it exists and are best
// guesses elsewhere. Map units are kilometres.

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

const m = (id: MaterialId, name: string, tier: Tier, unit: string, weight: number, price: number, shelfDays: number, blurb: string): MaterialDef => ({ id, name, tier, unit, weight, price, shelfDays, blurb });

export const MATERIALS: Record<MaterialId, MaterialDef> = {
  ironOre: m('ironOre', 'Iron ore', 'raw', 't', 1, 0.0001, 0, 'Hematite from open pits in the Brennock hills.'),
  coal: m('coal', 'Coking coal', 'raw', 't', 1, 0.00015, 0, 'Metallurgical coal for the blast furnaces.'),
  bauxite: m('bauxite', 'Bauxite', 'raw', 't', 1, 0.00005, 0, 'Aluminium ore. Its refining liquor also yields gallium.'),
  zincOre: m('zincOre', 'Zinc concentrate', 'raw', 't', 1, 0.0002, 0, 'Zinc ore concentrate. Germanium is recovered from the smelter residues.'),
  copperOre: m('copperOre', 'Copper ore', 'raw', 't', 1, 0.00003, 0, 'Low-grade porphyry ore: a hundred tonnes for one of copper.'),
  rareEarthOre: m('rareEarthOre', 'Rare-earth ore', 'raw', 't', 1, 0.0001, 0, 'Monazite-bearing sands rich in neodymium.'),
  silica: m('silica', 'High-purity quartz', 'raw', 't', 1, 0.0001, 0, 'Quartz for silicon refining.'),
  brine: m('brine', 'Salt brine', 'raw', 't', 1, 0.00002, 0, 'Sodium chloride brine for electrochemical oxidizers.'),
  natGas: m('natGas', 'Natural gas', 'raw', 't', 1, 0.0003, 0, 'Feedstock for ammonia and polymer binders.'),
  cellulose: m('cellulose', 'Cellulose pulp', 'raw', 't', 1, 0.0006, 0, 'Purified wood pulp for nitrocellulose.'),

  steel: m('steel', 'Steel', 'processed', 't', 1, 0.0008, 0, 'Forging-grade steel bar and plate.'),
  aluminium: m('aluminium', 'Aluminium', 'processed', 't', 1, 0.0025, 0, 'Primary aluminium for airframes and propellant powder.'),
  copper: m('copper', 'Copper', 'processed', 't', 1, 0.009, 0, 'Refined copper cathode.'),
  gallium: m('gallium', 'Gallium', 'processed', 'kg', 0.001, 0.0004, 0, 'Recovered from alumina liquor. Essential for GaN radar chips.'),
  germanium: m('germanium', 'Germanium', 'processed', 'kg', 0.001, 0.0015, 0, 'Recovered from zinc residues. Infrared windows and lenses.'),
  reOxide: m('reOxide', 'Rare-earth oxide', 'processed', 't', 1, 0.06, 0, 'Separated neodymium-praseodymium oxide.'),
  polysilicon: m('polysilicon', 'Polysilicon', 'processed', 'kg', 0.001, 0.00003, 0, 'Electronic-grade silicon.'),
  ammonia: m('ammonia', 'Ammonia', 'processed', 't', 1, 0.0005, 0, 'Haber-Bosch ammonia, the root of most explosives.'),
  nitricAcid: m('nitricAcid', 'Nitric acid', 'processed', 't', 1, 0.0004, 0, 'Concentrated acid for nitration.'),
  perchlorate: m('perchlorate', 'Ammonium perchlorate', 'processed', 't', 1, 0.004, 0, 'The oxidizer in composite rocket propellant.'),
  htpb: m('htpb', 'HTPB binder', 'processed', 't', 1, 0.006, 0, 'Rubbery polymer that binds propellant grains.'),
  nitrocellulose: m('nitrocellulose', 'Nitrocellulose', 'processed', 't', 1, 0.008, 3650, 'Base of gun propellant charges.'),
  highExplosive: m('highExplosive', 'High explosive', 'processed', 't', 1, 0.015, 0, 'RDX and TNT-based fills.'),

  propellant: m('propellant', 'Composite propellant', 'intermediate', 't', 1, 0.02, 2920, 'Perchlorate, aluminium powder and binder, mixed and cast.'),
  wafers: m('wafers', 'Silicon wafers', 'intermediate', 'wafer', 0.0003, 0.003, 0, 'Polished wafers ready for the fab.'),
  siChips: m('siChips', 'Silicon chip sets', 'intermediate', 'set', 0.0002, 0.0005, 0, 'Processors, memory and logic for one board.'),
  ganChips: m('ganChips', 'GaN radar chips', 'intermediate', 'set', 0.0001, 0.005, 0, 'Gallium-nitride amplifier chips for radar seekers.'),
  magnets: m('magnets', 'NdFeB magnets', 'intermediate', 'kg', 0.001, 0.0001, 0, 'Permanent magnets for motors and gyros.'),
  geOptics: m('geOptics', 'Germanium optics', 'intermediate', 'set', 0.002, 0.01, 0, 'Infrared domes and lenses.'),

  rocketMotor: m('rocketMotor', 'Rocket motors', 'component', 't', 1, 0.6, 3650, 'Loaded solid rocket motors, measured by mass.'),
  warhead: m('warhead', 'Warheads', 'component', 't', 1, 0.05, 0, 'Fragmentation and blast warheads, measured by mass.'),
  seekerRF: m('seekerRF', 'Radar seekers', 'component', 'seeker-eq', 0.02, 0.7, 0, 'Active radar seekers. One unit is one PAC-3-class seeker.'),
  seekerIR: m('seekerIR', 'Infrared seekers', 'component', 'seeker-eq', 0.01, 0.3, 0, 'Imaging infrared seekers. One unit is one IRIS-T-class seeker.'),
  guidance: m('guidance', 'Guidance sections', 'component', 'unit-eq', 0.015, 0.3, 0, 'Inertial units, flight computers and datalinks.'),
  actuators: m('actuators', 'Control actuators', 'component', 'unit-eq', 0.012, 0.1, 0, 'Fin actuators and thrust-vector control.'),
  airframe: m('airframe', 'Airframes', 'component', 't', 1, 0.05, 0, 'Bodies, wings and fins, measured by mass.'),
  fuze: m('fuze', 'Fuzes', 'component', 'unit-eq', 0.002, 0.02, 0, 'Proximity and impact fuzes. One unit is one missile fuze.'),
  shellBody: m('shellBody', 'Shell bodies', 'component', 'body', 0.043, 0.0012, 0, 'Forged and machined 155mm projectile bodies.'),
  propCharge: m('propCharge', 'Propellant charges', 'component', 'charge', 0.0026, 0.0003, 3650, 'Modular artillery charges.'),

  pac3: m('pac3', 'PAC-3 MSE', 'finished', 'round', 0.312, 4.1, 3650, 'Lockheed Martin. Hit-to-kill against ballistic and cruise missiles.'),
  sm6: m('sm6', 'SM-6', 'finished', 'round', 1.5, 4.3, 3650, 'RTX. Long range, against aircraft, cruise and ballistic missiles.'),
  tamir: m('tamir', 'Tamir', 'finished', 'round', 0.09, 0.06, 3650, 'Rafael. Short range, against rockets and drones.'),
  irist: m('irist', 'IRIS-T', 'finished', 'round', 0.087, 0.45, 3650, 'Diehl Defence. Medium range, against cruise missiles, drones and aircraft.'),
  stinger: m('stinger', 'Stinger', 'finished', 'round', 0.016, 0.48, 3650, 'RTX. Shoulder-fired, against drones and helicopters.'),
  gmlrs: m('gmlrs', 'GMLRS', 'finished', 'round', 0.3, 0.16, 3650, 'Lockheed Martin. Guided rocket artillery.'),
  shell155: m('shell155', '155mm shells', 'finished', 'round', 0.055, 0.0035, 7300, 'General Dynamics OTS. Tube artillery, with charges.'),
  apkws: m('apkws', 'APKWS', 'finished', 'round', 0.015, 0.03, 3650, 'BAE Systems. Laser-guided rocket for counter-drone work.'),
  coyote: m('coyote', 'Coyote Block 2', 'finished', 'round', 0.06, 0.11, 3650, 'RTX. Interceptor drone against drones.'),
  javelin: m('javelin', 'Javelin', 'finished', 'round', 0.022, 0.2, 3650, 'Javelin Joint Venture (Lockheed Martin, RTX). Anti-armor missile.'),
};
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

const r = (id: string, name: string, output: MaterialId, inputs: Partial<Record<MaterialId, number>>, scrap = 0.01, extra?: Partial<Record<MaterialId, number>>): RecipeDef => ({ id, name, output, yieldQty: 1, inputs, scrap, extra });

export const RECIPES: Record<string, RecipeDef> = {
  // Extraction
  mineIron: r('mineIron', 'Iron mining', 'ironOre', {}, 0),
  mineCoal: r('mineCoal', 'Coal mining', 'coal', {}, 0),
  mineBauxite: r('mineBauxite', 'Bauxite mining', 'bauxite', {}, 0),
  mineZinc: r('mineZinc', 'Zinc mining', 'zincOre', {}, 0),
  mineCopper: r('mineCopper', 'Copper mining', 'copperOre', {}, 0),
  mineRE: r('mineRE', 'Rare-earth mining', 'rareEarthOre', {}, 0),
  quarry: r('quarry', 'Quartz quarrying', 'silica', {}, 0),
  brineWell: r('brineWell', 'Brine pumping', 'brine', {}, 0),
  gasWell: r('gasWell', 'Gas production', 'natGas', {}, 0),
  pulping: r('pulping', 'Pulping', 'cellulose', {}, 0),
  // Processing
  steelMaking: r('steelMaking', 'Steelmaking', 'steel', { ironOre: 1.6, coal: 0.8 }, 0.02),
  aluminaSmelting: r('aluminaSmelting', 'Alumina refining and smelting', 'aluminium', { bauxite: 4.5 }, 0.01, { gallium: 0.08 }),
  zincSmelting: r('zincSmelting', 'Zinc smelting (germanium recovery)', 'germanium', { zincOre: 20 }, 0.02),
  copperRefining: r('copperRefining', 'Copper concentration and refining', 'copper', { copperOre: 100 }, 0.01),
  reSeparation: r('reSeparation', 'Rare-earth separation', 'reOxide', { rareEarthOre: 20 }, 0.02),
  siliconRefining: r('siliconRefining', 'Polysilicon refining', 'polysilicon', { silica: 0.012 }, 0.03),
  ammoniaSynth: r('ammoniaSynth', 'Ammonia synthesis', 'ammonia', { natGas: 0.7 }, 0.005),
  nitricAcid: r('nitricAcid', 'Nitric acid', 'nitricAcid', { ammonia: 0.29 }, 0.01),
  apElectrolysis: r('apElectrolysis', 'Perchlorate electrolysis', 'perchlorate', { brine: 3, ammonia: 0.15 }, 0.02),
  htpbSynth: r('htpbSynth', 'Binder polymerization', 'htpb', { natGas: 1.5 }, 0.02),
  nitration: r('nitration', 'Cellulose nitration', 'nitrocellulose', { cellulose: 0.7, nitricAcid: 1.2 }, 0.02),
  heSynth: r('heSynth', 'Explosive synthesis', 'highExplosive', { nitricAcid: 2.2, ammonia: 0.3 }, 0.02),
  // Intermediates
  propellantMix: r('propellantMix', 'Propellant mixing', 'propellant', { perchlorate: 0.68, aluminium: 0.18, htpb: 0.14 }, 0.02),
  waferFab: r('waferFab', 'Wafer slicing and polishing', 'wafers', { polysilicon: 0.4 }, 0.05),
  siChipFab: r('siChipFab', 'Silicon chip fabrication', 'siChips', { wafers: 0.05, copper: 0.0002 }, 0.08),
  ganChipFab: r('ganChipFab', 'GaN chip fabrication', 'ganChips', { wafers: 0.05, gallium: 0.004 }, 0.15),
  magnetMaking: r('magnetMaking', 'Magnet sintering', 'magnets', { reOxide: 0.0003, steel: 0.0007 }, 0.03),
  opticsGrinding: r('opticsGrinding', 'Optics grinding and coating', 'geOptics', { germanium: 0.4 }, 0.1),
  // Components
  motorCasting: r('motorCasting', 'Motor casting', 'rocketMotor', { propellant: 0.75, steel: 0.25 }, 0.03),
  warheadLoading: r('warheadLoading', 'Warhead loading', 'warhead', { steel: 0.6, highExplosive: 0.4 }, 0.02),
  seekerRFAssembly: r('seekerRFAssembly', 'Radar seeker assembly', 'seekerRF', { ganChips: 6, siChips: 4, aluminium: 0.003, copper: 0.002 }, 0.05),
  seekerIRAssembly: r('seekerIRAssembly', 'IR seeker assembly', 'seekerIR', { geOptics: 1, siChips: 4, aluminium: 0.002 }, 0.05),
  guidanceAssembly: r('guidanceAssembly', 'Guidance assembly', 'guidance', { siChips: 8, copper: 0.001, magnets: 0.2 }, 0.03),
  actuatorAssembly: r('actuatorAssembly', 'Actuator assembly', 'actuators', { magnets: 0.5, copper: 0.001, aluminium: 0.002 }, 0.02),
  airframeFab: r('airframeFab', 'Airframe fabrication', 'airframe', { aluminium: 1.1 }, 0.02),
  fuzeAssembly: r('fuzeAssembly', 'Fuze assembly', 'fuze', { siChips: 1, highExplosive: 0.00005, steel: 0.0002 }, 0.02),
  shellForging: r('shellForging', 'Shell forging and machining', 'shellBody', { steel: 0.05 }, 0.02),
  chargeMaking: r('chargeMaking', 'Charge manufacture', 'propCharge', { nitrocellulose: 0.0025 }, 0.01),
  // Final assembly and acceptance (bills of materials per round)
  pac3: r('pac3', 'PAC-3 MSE integration', 'pac3', { rocketMotor: 0.18, warhead: 0.011, seekerRF: 1, guidance: 1, actuators: 1, airframe: 0.06, fuze: 1 }, 0.025),
  sm6: r('sm6', 'SM-6 integration', 'sm6', { rocketMotor: 0.9, warhead: 0.064, seekerRF: 1.2, guidance: 1.2, actuators: 1, airframe: 0.25, fuze: 1 }, 0.025),
  tamir: r('tamir', 'Tamir integration', 'tamir', { rocketMotor: 0.05, warhead: 0.011, seekerRF: 0.05, guidance: 0.05, actuators: 0.1, airframe: 0.02, fuze: 0.3 }, 0.02),
  irist: r('irist', 'IRIS-T integration', 'irist', { rocketMotor: 0.045, warhead: 0.0114, seekerIR: 0.5, guidance: 0.3, actuators: 0.3, airframe: 0.02, fuze: 0.5 }, 0.02),
  stinger: r('stinger', 'Stinger integration', 'stinger', { rocketMotor: 0.006, warhead: 0.003, seekerIR: 0.3, guidance: 0.1, actuators: 0.1, airframe: 0.003, fuze: 0.3 }, 0.02),
  gmlrs: r('gmlrs', 'GMLRS integration', 'gmlrs', { rocketMotor: 0.15, warhead: 0.09, guidance: 0.2, actuators: 0.2, airframe: 0.05, fuze: 0.5 }, 0.015),
  shell155: r('shell155', '155mm load, assemble and pack', 'shell155', { shellBody: 1, highExplosive: 0.011, fuze: 0.01, propCharge: 4 }, 0.005),
  apkws: r('apkws', 'APKWS integration', 'apkws', { rocketMotor: 0.006, warhead: 0.0042, seekerIR: 0.03, guidance: 0.03, actuators: 0.05, airframe: 0.002, fuze: 0.1 }, 0.02),
  coyote: r('coyote', 'Coyote integration', 'coyote', { rocketMotor: 0.008, warhead: 0.002, seekerRF: 0.1, guidance: 0.15, actuators: 0.2, airframe: 0.006, fuze: 0.2 }, 0.02),
  javelin: r('javelin', 'Javelin integration', 'javelin', { rocketMotor: 0.004, warhead: 0.0084, seekerIR: 0.25, guidance: 0.2, actuators: 0.2, airframe: 0.005, fuze: 0.3 }, 0.02),
};
export const recipeFor = (output: MaterialId) => Object.values(RECIPES).find((x) => x.output === output);

/** Game production rates per day at the start (about a fifth of public reference rates). */
export const LINE_RATE: Record<LineId, number> = {
  pac3: 10 / 30, sm6: 4 / 30, tamir: 40 / 30, irist: 8 / 30, stinger: 12 / 30, gmlrs: 230 / 30, shell155: 20000 / 30,
  apkws: 80 / 30, coyote: 25 / 30, javelin: 66 / 30,
};
export const PUBLIC_RATE: Record<LineId, string> = {
  pac3: '650 per year (stated 2027 goal)', sm6: 'about 200 per year', tamir: 'about 2,400 per year', irist: 'about 500 per year',
  stinger: '60 per month (stated goal)', gmlrs: '14,000 per year (stated goal)', shell155: '100,000 per month (stated goal)',
  apkws: 'about 25,000 per year (stated goal)', coyote: 'about 1,500 per year', javelin: '3,960 per year (stated goal)',
};
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

const s = (d: Omit<SiteDef, 'qualified' | 'crew'> & Partial<Pick<SiteDef, 'qualified' | 'crew'>>): SiteDef => ({ qualified: true, crew: 200, ...d });

export const SITES: SiteDef[] = [
  // Extraction
  s({ id: 'brennockMine', name: 'Brennock Iron Pits', kind: 'mine', x: 520, y: 175, region: 'north', owner: 'private', processes: [{ recipe: 'mineIron', share: 1.3 }], crew: 420, blurb: 'Open-pit hematite on the Brennock hills.' }),
  s({ id: 'hollinColliery', name: 'Hollin Colliery', kind: 'mine', x: 615, y: 235, region: 'north', owner: 'private', processes: [{ recipe: 'mineCoal', share: 1.3 }], crew: 380, blurb: 'Deep coking-coal seams.' }),
  s({ id: 'redmarlBauxite', name: 'Redmarl Bauxite', kind: 'mine', x: 285, y: 470, region: 'central', owner: 'private', processes: [{ recipe: 'mineBauxite', share: 1.4 }], crew: 210, blurb: 'Red laterite plateaus.' }),
  s({ id: 'tarnFell', name: 'Tarn Fell Zinc Mine', kind: 'mine', x: 675, y: 410, region: 'east', owner: 'private', processes: [{ recipe: 'mineZinc', share: 0.7 }], crew: 260, blurb: 'Zinc-lead veins. The only domestic germanium comes from its residues.' }),
  s({ id: 'corvidCopper', name: 'Corvid Copper', kind: 'mine', x: 760, y: 300, region: 'east', owner: 'private', processes: [{ recipe: 'mineCopper', share: 1.4 }], crew: 300, blurb: 'A vast low-grade open pit near the border.' }),
  s({ id: 'skellSands', name: 'Skell Mineral Sands', kind: 'mine', x: 830, y: 530, region: 'east', owner: 'private', processes: [{ recipe: 'mineRE', share: 1.2 }], crew: 140, blurb: 'Monazite sands. Small, but the country’s only rare earths.' }),
  s({ id: 'whitesand', name: 'Whitesand Quarry', kind: 'quarry', x: 215, y: 560, region: 'coast', owner: 'private', processes: [{ recipe: 'quarry', share: 1.5 }], crew: 90, blurb: 'High-purity quartz cliffs.' }),
  s({ id: 'mericBrine', name: 'Meric Saltworks', kind: 'well', x: 440, y: 70, region: 'north', owner: 'private', processes: [{ recipe: 'brineWell', share: 1.5 }], crew: 70, blurb: 'Brine wells on the northern salt flats.' }),
  s({ id: 'halvardGas', name: 'Halvard Offshore Gas', kind: 'well', x: 95, y: 300, region: 'coast', owner: 'private', processes: [{ recipe: 'gasWell', share: 1.3 }], crew: 160, blurb: 'Platforms in the strait, piped ashore at Halvard.' }),
  s({ id: 'varnPulp', name: 'Varn River Pulp', kind: 'forestry', x: 405, y: 345, region: 'central', owner: 'private', processes: [{ recipe: 'pulping', share: 1.3 }], crew: 240, blurb: 'Forests and a pulp mill on the Varn.' }),
  // Processing
  s({ id: 'brennockSteel', name: 'Brennock Steelworks', kind: 'steelworks', x: 560, y: 200, region: 'north', owner: 'private', processes: [{ recipe: 'steelMaking', share: 1.2 }], crew: 900, blurb: 'Two blast furnaces and a forge shop.' }),
  s({ id: 'redmarlSmelter', name: 'Redmarl Aluminium', kind: 'smelter', x: 320, y: 500, region: 'central', owner: 'private', processes: [{ recipe: 'aluminaSmelting', share: 1.3 }], crew: 520, blurb: 'Alumina refinery and potline. Its liquor yields gallium.' }),
  s({ id: 'tarnSmelter', name: 'Tarn Smelter', kind: 'smelter', x: 700, y: 445, region: 'east', owner: 'private', processes: [{ recipe: 'zincSmelting', share: 0.7 }], crew: 300, blurb: 'Zinc smelter with a small germanium circuit.' }),
  s({ id: 'corvidRefinery', name: 'Corvid Refinery', kind: 'refinery', x: 740, y: 330, region: 'east', owner: 'private', processes: [{ recipe: 'copperRefining', share: 1.3 }], crew: 260, blurb: 'Concentrator and electrowinning tankhouse.' }),
  s({ id: 'skellSeparation', name: 'Skell Separation Plant', kind: 'refinery', x: 805, y: 505, region: 'east', owner: 'private', processes: [{ recipe: 'reSeparation', share: 1.2 }], crew: 120, blurb: 'Solvent-extraction rare-earth separation.' }),
  s({ id: 'whitesandSilicon', name: 'Whitesand Silicon', kind: 'refinery', x: 245, y: 540, region: 'coast', owner: 'private', processes: [{ recipe: 'siliconRefining', share: 0.6 }, { recipe: 'waferFab', share: 0.6 }], crew: 220, blurb: 'Polysilicon reactors and a wafer line.' }),
  s({ id: 'halvardChem', name: 'Halvard Ammonia & Nitric', kind: 'chemical', x: 165, y: 320, region: 'coast', owner: 'private', processes: [{ recipe: 'ammoniaSynth', share: 1.3 }, { recipe: 'nitricAcid', share: 1.3 }], crew: 340, blurb: 'Gas-fed ammonia and nitric acid trains.' }),
  s({ id: 'halvardPolymers', name: 'Halvard Polymers', kind: 'chemical', x: 150, y: 345, region: 'coast', owner: 'private', processes: [{ recipe: 'htpbSynth', share: 1.4 }], crew: 110, blurb: 'Specialty binders for propellant.' }),
  s({ id: 'cinderFlats', name: 'Cinder Flats Chemical', kind: 'chemical', x: 470, y: 95, region: 'north', owner: 'private', processes: [{ recipe: 'apElectrolysis', share: 1.25 }], crew: 180, blurb: 'The only domestic perchlorate plant. One explosion away from a national crisis.' }),
  s({ id: 'varnCellulose', name: 'Varn River Cellulose', kind: 'chemical', x: 435, y: 360, region: 'central', owner: 'private', processes: [{ recipe: 'nitration', share: 1.2 }], crew: 260, blurb: 'Nitration lines for propellant-grade nitrocellulose.' }),
  s({ id: 'ironmoor', name: 'Ironmoor Energetics', kind: 'explosives', x: 520, y: 385, region: 'central', owner: 'private', processes: [{ recipe: 'heSynth', share: 1.2 }, { recipe: 'propellantMix', share: 1.25 }], crew: 640, blurb: 'A sprawling explosives and propellant complex in the moors.' }),
  // Electronics and components
  s({ id: 'trustedFoundry', name: 'Aldmere Trusted Foundry', kind: 'fab', x: 275, y: 415, region: 'central', owner: 'private', processes: [{ recipe: 'siChipFab', share: 0.45 }, { recipe: 'ganChipFab', share: 0.5 }], crew: 480, qualified: true, blurb: 'Secure domestic fab. Expensive, but nobody can embargo it.' }),
  s({ id: 'skellMagnetics', name: 'Skell Magnetics', kind: 'components', x: 785, y: 480, region: 'east', owner: 'private', processes: [{ recipe: 'magnetMaking', share: 0.9 }], crew: 90, blurb: 'Sintered NdFeB magnets.' }),
  s({ id: 'haldenMicrowave', name: 'Halden Microwave', kind: 'components', x: 330, y: 295, region: 'central', owner: 'private', processes: [{ recipe: 'seekerRFAssembly', share: 1.15 }], crew: 360, blurb: 'Sole qualified maker of radar seekers.' }),
  s({ id: 'pellucid', name: 'Pellucid Imaging', kind: 'components', x: 385, y: 410, region: 'central', owner: 'private', processes: [{ recipe: 'opticsGrinding', share: 0.5 }, { recipe: 'seekerIRAssembly', share: 0.4 }], crew: 150, qualified: false, blurb: 'A domestic optics start-up hungry for a production order.' }),
  s({ id: 'lindellFuze', name: 'Lindell Fuze Works', kind: 'components', x: 455, y: 300, region: 'central', owner: 'private', processes: [{ recipe: 'fuzeAssembly', share: 1.2 }], crew: 300, blurb: 'Proximity and impact fuzes.' }),
  s({ id: 'mercerControls', name: 'Mercer Controls', kind: 'components', x: 640, y: 480, region: 'east', owner: 'private', processes: [{ recipe: 'actuatorAssembly', share: 1.2 }, { recipe: 'guidanceAssembly', share: 1.15 }], crew: 420, blurb: 'Guidance sections and fin actuators.' }),
  s({ id: 'aldmereAero', name: 'Aldmere Aerostructures', kind: 'components', x: 350, y: 445, region: 'central', owner: 'private', processes: [{ recipe: 'airframeFab', share: 1.3 }, { recipe: 'magnetMaking', share: 0.3 }], crew: 380, blurb: 'Airframes, wings and fins.' }),
  s({ id: 'kestrel', name: 'Kestrel Propulsion', kind: 'motors', x: 600, y: 420, region: 'east', owner: 'private', processes: [{ recipe: 'motorCasting', share: 1.1 }], crew: 520, blurb: 'The motor house nearly every program depends on.' }),
  s({ id: 'vantor', name: 'Vantor Motor Works', kind: 'motors', x: 360, y: 255, region: 'central', owner: 'private', processes: [{ recipe: 'motorCasting', share: 0.5 }], crew: 260, qualified: false, blurb: 'A new motor caster with no flight history.' }),
  s({ id: 'greystone', name: 'Greystone Forge', kind: 'components', x: 585, y: 215, region: 'north', owner: 'private', processes: [{ recipe: 'shellForging', share: 1.1 }, { recipe: 'warheadLoading', share: 1.2 }], crew: 700, blurb: 'Shell bodies and warhead cases by the thousand.' }),
  s({ id: 'ashfordCharges', name: 'Ashford Propellant Charges', kind: 'explosives', x: 625, y: 355, region: 'east', owner: 'private', processes: [{ recipe: 'chargeMaking', share: 1.2 }], crew: 200, blurb: 'Modular artillery charges.' }),
  // State arsenals (yours)
  s({ id: 'corranWorks', name: 'Corran Valley Works', kind: 'arsenal', x: 420, y: 255, region: 'central', owner: 'state', processes: [{ recipe: 'pac3', share: 1 }, { recipe: 'sm6', share: 1 }], crew: 1000, blurb: 'Clean rooms and integration halls for the big hit-to-kill interceptors.' }),
  s({ id: 'northgateCenter', name: 'Northgate Integration Center', kind: 'arsenal', x: 495, y: 140, region: 'north', owner: 'state', processes: [{ recipe: 'tamir', share: 1 }, { recipe: 'irist', share: 1 }, { recipe: 'stinger', share: 1 }], crew: 850, blurb: 'Short-range air defense: three lines under one long roof.' }),
  s({ id: 'ashfordComplex', name: 'Ashford Munitions Complex', kind: 'arsenal', x: 605, y: 330, region: 'east', owner: 'state', processes: [{ recipe: 'gmlrs', share: 1 }, { recipe: 'shell155', share: 1 }], crew: 1400, blurb: 'Rockets and shells by the thousand.' }),
  s({ id: 'saltmereRange', name: 'Saltmere Test Range', kind: 'testRange', x: 120, y: 430, region: 'coast', owner: 'state', processes: [], crew: 120, blurb: 'Over-water range for missile lot acceptance and surveillance firings.' }),
  s({ id: 'karrowRange', name: 'Karrow Proving Ground', kind: 'testRange', x: 705, y: 585, region: 'east', owner: 'state', processes: [], crew: 140, blurb: 'Artillery and rocket proving ground in the southern hills.' }),
  s({ id: 'karrowDemil', name: 'Karrow Demilitarization Facility', kind: 'demil', x: 675, y: 610, region: 'east', owner: 'state', processes: [], crew: 160, blurb: 'Where old rounds go to die: open burning pits, and a small recycling plant.' }),
  // Depots
  s({ id: 'depotCentral', name: 'Corran Central Depot', kind: 'depot', x: 445, y: 285, region: 'central', owner: 'state', processes: [], crew: 220, blurb: 'The national reserve, in earth-covered igloos.' }),
  s({ id: 'depotNorth', name: 'Meric Depot', kind: 'depot', x: 395, y: 95, region: 'north', owner: 'state', processes: [], crew: 90, blurb: 'Northern ports and the Riverline.' }),
  s({ id: 'depotCoast', name: 'Halvard Depot', kind: 'depot', x: 195, y: 255, region: 'coast', owner: 'state', processes: [], crew: 90, blurb: 'Facing the strait.' }),
  s({ id: 'depotEast', name: 'Marches Depot', kind: 'depot', x: 760, y: 215, region: 'east', owner: 'state', processes: [], crew: 90, blurb: 'Behind the eastern border.' }),
  s({ id: 'depotIsles', name: 'Skerry Depot', kind: 'depot', x: 115, y: 615, region: 'isles', owner: 'state', processes: [], crew: 50, blurb: 'Island stores, resupplied by sea and air.' }),
  // Bases (where rounds are fired)
  s({ id: 'mericSector', name: 'Meric Air Defense Sector', kind: 'adBase', x: 410, y: 55, region: 'north', owner: 'state', processes: [], crew: 0, blurb: 'Patriot and short-range batteries over the port.' }),
  s({ id: 'riverlineBrigade', name: 'Riverline Artillery Brigade', kind: 'artillery', x: 565, y: 105, region: 'north', owner: 'state', processes: [], crew: 0, blurb: 'Guns and launchers along the northern river.' }),
  s({ id: 'halvardAirBase', name: 'Halvard Air Base', kind: 'airBase', x: 150, y: 225, region: 'coast', owner: 'state', processes: [], crew: 0, blurb: 'Fighter base with layered air defense.' }),
  s({ id: 'coastSector', name: 'Coastal Air Defense Sector', kind: 'adBase', x: 135, y: 375, region: 'coast', owner: 'state', processes: [], crew: 0, blurb: 'Naval and ground air defense along the strait.' }),
  s({ id: 'marchesSector', name: 'Marches Air Defense Sector', kind: 'adBase', x: 830, y: 180, region: 'east', owner: 'state', processes: [], crew: 0, blurb: 'Air defense behind the border.' }),
  s({ id: 'eastCorps', name: '3rd Artillery Corps', kind: 'artillery', x: 860, y: 310, region: 'east', owner: 'state', processes: [], crew: 0, blurb: 'The heaviest guns in the country.' }),
  s({ id: 'velmSector', name: 'Velm Plateau Air Defense', kind: 'adBase', x: 815, y: 410, region: 'east', owner: 'state', processes: [], crew: 0, blurb: 'Counter-drone batteries on the high plateau.' }),
  s({ id: 'skerryBase', name: 'Skerry Isles Air Base', kind: 'airBase', x: 85, y: 640, region: 'isles', owner: 'state', processes: [], crew: 0, blurb: 'Island air base far out at sea.' }),
  // Ports and air hubs
  s({ id: 'portMeric', name: 'Port of Meric', kind: 'port', x: 360, y: 45, region: 'north', owner: 'state', processes: [], crew: 0, blurb: 'Northern deep-water port.' }),
  s({ id: 'portHalvard', name: 'Halvard Docks', kind: 'port', x: 160, y: 285, region: 'coast', owner: 'state', processes: [], crew: 0, blurb: 'Container docks on the strait. Prone to congestion.' }),
  s({ id: 'portLowmouth', name: 'Port of Lowmouth', kind: 'port', x: 335, y: 625, region: 'coast', owner: 'state', processes: [], crew: 0, blurb: 'Southern port, facing the open ocean.' }),
  s({ id: 'portSkerry', name: 'Skerry Harbour', kind: 'port', x: 125, y: 600, region: 'isles', owner: 'state', processes: [], crew: 0, blurb: 'Small island harbour.' }),
  s({ id: 'corranAirHub', name: 'Corran Air Logistics Hub', kind: 'airfield', x: 470, y: 265, region: 'central', owner: 'state', processes: [], crew: 0, blurb: 'Military airlift hub. Fast, but small and expensive.' }),
  // Open plots: land you can build a plant on, each with a rail spur waiting to be laid.
  s({ id: 'plotHalden', name: 'Halden Vale plot', kind: 'plot', x: 290, y: 330, region: 'central', owner: 'state', processes: [], crew: 0, blurb: 'Flat ground in the Halden vale, a short spur from the microwave works.' }),
  s({ id: 'plotNorthgate', name: 'Northgate Heath plot', kind: 'plot', x: 450, y: 180, region: 'north', owner: 'state', processes: [], crew: 0, blurb: 'Heathland south of Northgate, close to the arsenal.' }),
  s({ id: 'plotAshford', name: 'Ashford Fields plot', kind: 'plot', x: 655, y: 385, region: 'east', owner: 'state', processes: [], crew: 0, blurb: 'Old farmland between Ashford and the motor works.' }),
  s({ id: 'plotRedmarl', name: 'Redmarl Downs plot', kind: 'plot', x: 370, y: 545, region: 'central', owner: 'state', processes: [], crew: 0, blurb: 'Open downland near the smelter and the road to Lowmouth.' }),
  s({ id: 'plotMarches', name: 'Marches Ridge plot', kind: 'plot', x: 800, y: 255, region: 'east', owner: 'state', processes: [], crew: 0, blurb: 'A ridge near the eastern depot. Close to the border, and to the fighting.' }),
  // Foreign suppliers (reached by sea)
  s({ id: 'karskMetals', name: 'Karsk State Metals', kind: 'foreign', x: 760, y: -45, region: 'north', owner: 'foreign', nation: 'Karsk Federation', processes: [{ recipe: 'aluminaSmelting', share: 0.4 }, { recipe: 'zincSmelting', share: 1.2 }], crew: 0, blurb: 'Cheap gallium and germanium, and a government fond of export controls.' }),
  s({ id: 'sableCircuits', name: 'Sable Circuit Works', kind: 'foreign', x: 300, y: 735, region: 'coast', owner: 'foreign', nation: 'Ostrel Republic', processes: [{ recipe: 'siChipFab', share: 0.8 }, { recipe: 'ganChipFab', share: 0.7 }, { recipe: 'waferFab', share: 0.6 }], crew: 0, blurb: 'High volume, low price, one ocean away.' }),
  s({ id: 'brightwater', name: 'Brightwater Optics', kind: 'foreign', x: -50, y: 360, region: 'coast', owner: 'foreign', nation: 'Corvane Union', processes: [{ recipe: 'opticsGrinding', share: 0.9 }, { recipe: 'seekerIRAssembly', share: 1.25 }], crew: 0, blurb: 'Imaging IR seekers across the strait.' }),
  s({ id: 'lyreSensors', name: 'Lyre Sensors', kind: 'foreign', x: 440, y: 735, region: 'coast', owner: 'foreign', nation: 'Ostrel Republic', processes: [{ recipe: 'seekerRFAssembly', share: 0.6 }], crew: 0, qualified: false, blurb: 'Capable radar seekers from a country under pressure from all sides.' }),
  s({ id: 'northwind', name: 'Northwind Aerojet', kind: 'foreign', x: -50, y: 200, region: 'coast', owner: 'foreign', nation: 'Corvane Union', processes: [{ recipe: 'motorCasting', share: 0.4 }, { recipe: 'apElectrolysis', share: 0.4 }], crew: 0, qualified: false, blurb: 'Established motor maker across the strait.' }),
];
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

export const CITIES: CityDef[] = [
  { name: 'Corran', x: 438, y: 268, pop: 1240, capital: true },
  { name: 'Meric', x: 378, y: 62, pop: 610 },
  { name: 'Halvard', x: 172, y: 270, pop: 540 },
  { name: 'Ashford', x: 592, y: 342, pop: 310 },
  { name: 'Northgate', x: 505, y: 128, pop: 220 },
  { name: 'Marchford', x: 785, y: 245, pop: 280 },
  { name: 'Lowmouth', x: 340, y: 605, pop: 260 },
  { name: 'Brennock', x: 545, y: 190, pop: 140 },
  { name: 'Varn', x: 418, y: 372, pop: 95 },
  { name: 'Redmarl', x: 300, y: 488, pop: 120 },
  { name: 'Tarnby', x: 688, y: 428, pop: 70 },
  { name: 'Skerry Town', x: 100, y: 628, pop: 30 },
  { name: 'Velmgate', x: 800, y: 395, pop: 60 },
  { name: 'Saltash', x: 270, y: 180, pop: 85 },
  { name: 'Corvid', x: 752, y: 318, pop: 45 },
];

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
export const MODES: Record<Mode, { name: string; speed: number; cost: number; detour: number }> = {
  rail: { name: 'Rail', speed: 400, cost: 0.00000004, detour: 1.15 },
  road: { name: 'Road', speed: 450, cost: 0.0000001, detour: 1.25 },
  sea: { name: 'Sea', speed: 500, cost: 0.00000002, detour: 1.3 },
  air: { name: 'Air', speed: 4000, cost: 0.000002, detour: 1 },
};

const rail = (a: string, b: string, cap = 1500): RouteDef => ({ a, b, mode: 'rail', cap });
const road = (a: string, b: string, cap = 400): RouteDef => ({ a, b, mode: 'road', cap });
const sea = (a: string, b: string, cap = 3000): RouteDef => ({ a, b, mode: 'sea', cap });
const air = (a: string, b: string, cap = 40): RouteDef => ({ a, b, mode: 'air', cap });

export const ROUTES: RouteDef[] = [
  // Main rail lines
  rail('depotCentral', 'corranWorks'), rail('depotCentral', 'lindellFuze'), rail('depotCentral', 'varnCellulose'), rail('varnCellulose', 'ironmoor'),
  rail('ironmoor', 'kestrel'), rail('kestrel', 'ashfordComplex'), rail('ashfordComplex', 'ashfordCharges'), rail('ashfordComplex', 'corvidRefinery'),
  rail('corvidRefinery', 'corvidCopper'), rail('corvidRefinery', 'depotEast'), rail('depotEast', 'marchesSector'), rail('depotEast', 'eastCorps'),
  rail('ashfordComplex', 'greystone'), rail('greystone', 'brennockSteel'), rail('brennockSteel', 'brennockMine'), rail('brennockSteel', 'hollinColliery'),
  rail('brennockSteel', 'northgateCenter'), rail('northgateCenter', 'cinderFlats'), rail('cinderFlats', 'mericBrine'), rail('cinderFlats', 'depotNorth'),
  rail('depotNorth', 'portMeric'), rail('depotNorth', 'mericSector'), rail('northgateCenter', 'riverlineBrigade'), rail('corranWorks', 'northgateCenter', 1200),
  rail('corranWorks', 'vantor'), rail('vantor', 'haldenMicrowave'), rail('haldenMicrowave', 'depotCoast'), rail('depotCoast', 'portHalvard'),
  rail('portHalvard', 'halvardChem'), rail('halvardChem', 'halvardPolymers'), rail('depotCoast', 'halvardAirBase'), rail('halvardChem', 'coastSector'),
  rail('varnCellulose', 'varnPulp'), rail('varnPulp', 'haldenMicrowave'), rail('varnCellulose', 'pellucid'), rail('pellucid', 'aldmereAero'),
  rail('aldmereAero', 'redmarlSmelter'), rail('redmarlSmelter', 'redmarlBauxite'), rail('redmarlSmelter', 'trustedFoundry'), rail('trustedFoundry', 'pellucid'),
  rail('redmarlSmelter', 'whitesandSilicon'), rail('whitesandSilicon', 'whitesand'), rail('whitesandSilicon', 'portLowmouth'), rail('redmarlSmelter', 'portLowmouth'),
  rail('kestrel', 'mercerControls'), rail('mercerControls', 'tarnSmelter'), rail('tarnSmelter', 'tarnFell'), rail('tarnSmelter', 'velmSector'),
  rail('mercerControls', 'skellMagnetics'), rail('skellMagnetics', 'skellSeparation'), rail('skellSeparation', 'skellSands'),
  rail('mercerControls', 'karrowDemil'), rail('karrowDemil', 'karrowRange'), rail('halvardChem', 'saltmereRange', 600),
  rail('ironmoor', 'mercerControls'), rail('lindellFuze', 'ironmoor'), rail('depotCentral', 'corranAirHub'), rail('halvardChem', 'ironmoor', 1000),
  // Roads (slower, smaller, everywhere)
  road('depotCentral', 'depotNorth'), road('depotCentral', 'depotCoast'), road('depotCentral', 'depotEast'), road('depotCentral', 'ashfordComplex'),
  road('depotEast', 'velmSector'), road('ashfordComplex', 'tarnSmelter'), road('saltmereRange', 'coastSector'), road('portLowmouth', 'trustedFoundry'),
  road('riverlineBrigade', 'brennockMine'), road('eastCorps', 'corvidCopper'), road('aldmereAero', 'corranWorks'), road('lindellFuze', 'corranWorks'),
  road('karrowRange', 'skellSands'), road('greystone', 'hollinColliery'),
  // Sea lanes
  sea('portHalvard', 'portSkerry', 600), sea('portLowmouth', 'portSkerry', 600), sea('portSkerry', 'depotIsles', 600), sea('depotIsles', 'skerryBase', 600),
  sea('portMeric', 'karskMetals'), sea('portLowmouth', 'sableCircuits'), sea('portLowmouth', 'lyreSensors'), sea('portHalvard', 'brightwater'), sea('portHalvard', 'northwind'),
  sea('portHalvard', 'halvardGas', 2000), sea('portMeric', 'portHalvard', 2000), sea('portHalvard', 'portLowmouth', 2000),
  // Airlift
  air('corranAirHub', 'skerryBase', 30), air('corranAirHub', 'halvardAirBase'), air('corranAirHub', 'marchesSector'), air('corranAirHub', 'mericSector'),
];

/** Links the player can build. Each is a new route once finished. */
export interface CandidateRoute extends RouteDef {
  id: string;
  name: string;
  blurb: string;
}
export const CANDIDATE_ROUTES: CandidateRoute[] = [
  { ...rail('corranWorks', 'depotCoast', 1200), id: 'westline', name: 'Westline', blurb: 'A direct line from Corran to Halvard, bypassing the Halden valley.' },
  { ...rail('depotCentral', 'redmarlSmelter', 1200), id: 'southMain', name: 'Southern main line', blurb: 'Corran to Redmarl and on to Lowmouth: a second way south.' },
  { ...rail('depotEast', 'greystone', 1000), id: 'marchesLink', name: 'Marches link', blurb: 'Ties the eastern depot to the northern forges without going through Ashford.' },
  { ...rail('kestrel', 'tarnSmelter', 900), id: 'tarnCutoff', name: 'Tarn cut-off', blurb: 'A short line from the motor works to the Tarn smelter.' },
  { ...road('depotNorth', 'riverlineBrigade', 500), id: 'riverRoad', name: 'Riverline military road', blurb: 'An all-weather road from Meric Depot to the Riverline guns.' },
  { ...rail('lindellFuze', 'ashfordComplex', 1200), id: 'ashfordDirect', name: 'Corran–Ashford direct', blurb: 'Doubles the busiest corridor in the country.' },
  // Spurs to the open plots, laid when a plant is founded there.
  { ...rail('plotHalden', 'haldenMicrowave', 800), id: 'plot-plotHalden', name: 'Halden Vale spur', blurb: 'Serves a new plant in the Halden vale.' },
  { ...rail('plotNorthgate', 'northgateCenter', 800), id: 'plot-plotNorthgate', name: 'Northgate Heath spur', blurb: 'Serves a new plant on Northgate Heath.' },
  { ...rail('plotAshford', 'kestrel', 800), id: 'plot-plotAshford', name: 'Ashford Fields spur', blurb: 'Serves a new plant on Ashford Fields.' },
  { ...rail('plotRedmarl', 'redmarlSmelter', 800), id: 'plot-plotRedmarl', name: 'Redmarl Downs spur', blurb: 'Serves a new plant on Redmarl Downs.' },
  { ...rail('plotMarches', 'depotEast', 800), id: 'plot-plotMarches', name: 'Marches Ridge spur', blurb: 'Serves a new plant on Marches Ridge.' },
];
/** Spurs that come with a plot rather than being built on their own. */
export const isPlotSpur = (id: string) => id.startsWith('plot-');
export const CANDIDATE_BY_ID: Record<string, CandidateRoute> = Object.fromEntries(CANDIDATE_ROUTES.map((c) => [c.id, c]));

export const ROUTE_KEY = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
export function routeKm(rt: RouteDef): number {
  const A = SITE_BY_ID[rt.a];
  const B = SITE_BY_ID[rt.b];
  return Math.hypot(A.x - B.x, A.y - B.y) * MODES[rt.mode].detour;
}

// ---------- Regions and the fight ----------

export const REGIONS: Record<RegionId, { name: string; threatShare: number; landShare: number; depot: string }> = {
  north: { name: 'Northern Ports', threatShare: 0.25, landShare: 0.4, depot: 'depotNorth' },
  coast: { name: 'Halvard Coast', threatShare: 0.3, landShare: 0, depot: 'depotCoast' },
  east: { name: 'Eastern Marches', threatShare: 0.3, landShare: 0.6, depot: 'depotEast' },
  isles: { name: 'Skerry Isles', threatShare: 0.15, landShare: 0, depot: 'depotIsles' },
  central: { name: 'Heartland', threatShare: 0, landShare: 0, depot: 'depotCentral' },
};
export const FIGHTING_REGIONS: RegionId[] = ['north', 'coast', 'east', 'isles'];
