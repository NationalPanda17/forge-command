// Player actions on the network. validate explains why an action is not allowed; apply never mutates its input.
import { DAYS_PER_MONTH, lotQty } from './selectors';
import type { Policy, RunLevel, SimState } from './types';
import { MATERIALS, RECIPES, SITE_BY_ID, type LineId, type MaterialId } from './world';
import { RESEARCH, hasResearch, resolveDecision, startResearch, type ResearchId, type StaffRole } from './strategy';
import { feed } from './tick';
import { CONTRACT_DISCOUNT, TENDER_COST, bidders, makeTender, priceNow } from './economy';
import { buildBlock, projectName, startProject } from './build';
import { MAX_SAFETY, safetyCost } from './people';
import { setNetwork } from './graph';
import { applyWorld } from './worldgen';
import { MAX_CLEARANCE, vetCost } from './security';
import { HOMES_PER_PROJECT, HOUSING_DAYS, hireRoom, housingCost, mothball, reopen, townOf } from './towns';
import { prioritise } from './testing';
import { controlBlock } from './hotseat';
import { storyCount } from './storyCount';
import { applyDiplomacy, validateDiplomacy } from './diplomacy';
import { answer, request, validateHearing, type RequestLevel } from './hearings';
import { applyCyber, validateCyber, type CyberArea } from './cyber';
import { payDeal, surgeBanned, validatePayDeal } from './unions';
import type { AllyId } from './types';
import { applyEnergy, validateEnergy } from './energy';
import { applyOversight, validateOversight } from './audit';
import { applyCommunity, onHousing, validateCommunity } from './communities';
import { applyAutomation, validateAutomation, type AutoArea, type Stance } from './automation';
import { applyEngineers, validateEngineers, type PayLevel } from './engineers';
import { applyIntel, validateIntel, type OpKind } from './intelops';
import { applyDoctrine, validateDoctrine, type ForkId, type Side } from './doctrine';
import { applyCast, poachWhy, validateCast } from './cast';
import { boonsFor, type BoonId } from './legacy';
import { CITIES } from './world';
import type { Project, Settings } from './types';
import { DESIGN_DAYS, addInhouseLine, designBlock, designCost, foundBlock, foundPlant, inhouseBlock, type VariantId } from './industry';
import { CRISES } from './fight';
import { MAX_POLICIES, POLICIES, REVOKE_COST, canSecondTerm, monthlyCapacity, programmeTerms, startSecondTerm, type PolicyId } from './commitments';
import type { RegionId } from './world';
export { CONTRACT_DISCOUNT };

export type SimAction =
  | { type: 'setRun'; site: string; process: number; run: RunLevel }
  | { type: 'expand'; site: string; process: number }
  | { type: 'hire'; site: string; count: number }
  | { type: 'repair'; site: string }
  | { type: 'signContract'; site: string; material: MaterialId; perDay: number; months: 12 | 24 | 36 }
  | { type: 'cancelContract'; contract: number }
  | { type: 'qualify'; site: string }
  | { type: 'invest'; site: string; process: number }
  | { type: 'refurbish'; site: string; line: LineId }
  | { type: 'setPolicy'; policy: Partial<Policy> }
  | { type: 'research'; research: ResearchId }
  | { type: 'hireStaff'; candidate: number }
  | { type: 'fireStaff'; role: StaffRole }
  | { type: 'decide'; decision: number; option: string }
  | { type: 'openTender'; material: MaterialId; perDay: number; months: 12 | 24 | 36 }
  | { type: 'awardTender'; tender: number; site: string }
  | { type: 'tutorial'; step: number }
  | { type: 'build'; kind: Project['kind']; target: string; process?: number }
  | { type: 'safety'; site: string }
  | { type: 'apprentices'; site: string; perMonth: number }
  | { type: 'sandbox'; op: SandboxOp }
  | { type: 'programme'; line: LineId; years: 3 | 5 }
  | { type: 'adoptPolicy'; policy: PolicyId }
  | { type: 'revokePolicy'; policy: PolicyId }
  | { type: 'secondTerm'; boon?: BoonId }
  | { type: 'adoptDoctrine'; fork: ForkId; side: Side }
  | { type: 'promoteManager'; site: string }
  | { type: 'appointManager'; site: string; candidate: number }
  | { type: 'found'; plot: string; recipe: string }
  | { type: 'inhouse'; site: string; recipe: string }
  | { type: 'design'; line: LineId; variant: VariantId }
  | { type: 'storyBriefed' }
  | { type: 'vet'; site: string }
  | { type: 'housing'; town: number }
  | { type: 'mothball'; site: string }
  | { type: 'reopen'; site: string }
  | { type: 'prioritiseTest'; test: number }
  | { type: 'handover' }
  | { type: 'tradeMission'; who: string }
  | { type: 'supplyGuarantee'; nation: string }
  | { type: 'coproduce'; ally: AllyId; line: LineId }
  | { type: 'endCoproduction'; id: number }
  | { type: 'seekExport'; line: LineId }
  | { type: 'hearingAnswer'; question: string; option: string }
  | { type: 'hearingRequest'; level: RequestLevel }
  | { type: 'cyberDefence'; area: CyberArea }
  | { type: 'cyberBackups' }
  | { type: 'cyberDrills' }
  | { type: 'payDeal' }
  | { type: 'generator'; site: string }
  | { type: 'powerContract'; region: RegionId }
  | { type: 'gridUpgrade'; region: RegionId }
  | { type: 'auditTeam' }
  | { type: 'disbandAuditTeam' }
  | { type: 'communityFund'; town: number }
  | { type: 'openDay'; town: number }
  | { type: 'automate'; area: AutoArea; on: boolean }
  | { type: 'automationReserve'; reserve: number }
  | { type: 'automationStance'; stance: Stance }
  | { type: 'hireEngineers'; count: number }
  | { type: 'academy'; town: number }
  | { type: 'engineerPay'; level: PayLevel }
  | { type: 'intelOp'; kind: OpKind }
  | { type: 'intelAgency' }
  | { type: 'tipSeen'; id: string };

/** Sandbox controls: change the rules and the world as you play. */
export type SandboxOp =
  | { kind: 'rules'; settings: Partial<Settings> }
  | { kind: 'money'; amount: number }
  | { kind: 'crisis'; region: RegionId }
  | { kind: 'endCrisis' }
  | { kind: 'disrupt'; site: string }
  | { kind: 'calm' }
  | { kind: 'finishResearch' };

const HIRE_COST = 0.015;
export const TRAINING_DAYS = 90;

/** $M to add 25% to a process. Scales with the value it makes. */
export function expandCost(s: SimState, site: string, process: number): number {
  const p = s.sites[site].processes[process];
  const out = RECIPES[p.recipe].output;
  // Priced on the plant's base size, counting capacity still ramping up from earlier expansions.
  const total = p.capacity + (p.ramp ?? []).reduce((x, r) => x + r.cap, 0);
  const yearly = (total / (1 + 0.25 * p.expansions)) * MATERIALS[out].price * 360;
  return Math.max(8, Math.round(yearly * 0.12 * s.priceIndex));
}
export const investCost = (s: SimState, site: string, process: number) => Math.round(expandCost(s, site, process) * 1.4);
export const repairCost = (s: SimState, site: string) => Math.max(2, Math.round((100 - s.sites[site].condition) * SITE_BY_ID[site].crew * 0.0004 * s.priceIndex));
export const qualifyCost = (site: string) => Math.round(15 + SITE_BY_ID[site].crew * 0.08);
export const QUALIFY_DAYS = 240;
export const refurbishCost = (line: LineId, qty: number) => qty * MATERIALS[line].price * 0.35;

const funds = (s: SimState, cost: number) => (s.treasury >= cost ? null : `Not enough money (needs $${Math.round(cost)}M).`);

export function validate(s: SimState, a: SimAction): string | null {
  if (a.type === 'secondTerm') return canSecondTerm(s) ?? (a.boon && !boonsFor(s).includes(a.boon) ? 'That legacy was not earned this term.' : null);
  if (s.over) return 'The campaign is over.';
  // Hot-seat: each player runs only their own half of the country.
  if (a.type !== 'handover') {
    // The site an action touches: its own, a plot, a build target, or the site a decision is about.
    const dec = a.type === 'decide' ? s.strategy.decisions.find((d) => d.id === a.decision) : undefined;
    const decSite = dec ? (dec.site ?? s.chains.find((c) => c.id === dec.data?.chain)?.site) : undefined;
    const target = 'site' in a ? a.site : a.type === 'found' ? a.plot : a.type === 'build' ? a.target : decSite;
    const blocked = controlBlock(s, target);
    if (blocked) return blocked;
    const permit = dec?.kind === 'permit' ? s.communities.permits.find((p) => p.id === dec.data?.chain) : undefined;
    if (s.hotseat && permit?.player !== undefined && permit.player !== s.hotseat.active) {
      const other = s.hotseat.players[permit.player];
      return `${other.name} (${other.command}) started that work.`;
    }
  }
  const site = 'site' in a ? s.sites[a.site] : null;
  if ('site' in a && !site) return 'Unknown site.';
  const def = site ? SITE_BY_ID[site.id] : null;
  switch (a.type) {
    case 'tradeMission':
    case 'supplyGuarantee':
    case 'coproduce':
    case 'endCoproduction':
    case 'seekExport':
      return validateDiplomacy(s, a);
    case 'hearingAnswer':
    case 'hearingRequest':
      return validateHearing(s, a);
    case 'cyberDefence':
    case 'cyberBackups':
    case 'cyberDrills':
      return validateCyber(s, a);
    case 'payDeal':
      return validatePayDeal(s);
    case 'generator':
    case 'powerContract':
    case 'gridUpgrade':
      return validateEnergy(s, a);
    case 'auditTeam':
    case 'disbandAuditTeam':
      return validateOversight(s, a);
    case 'communityFund':
    case 'openDay':
      return validateCommunity(s, a);
    case 'automate':
    case 'automationReserve':
    case 'automationStance':
      return validateAutomation(s, a);
    case 'hireEngineers':
    case 'academy':
    case 'engineerPay':
      return validateEngineers(s, a);
    case 'intelOp':
    case 'intelAgency':
      return validateIntel(s, a);
    case 'tipSeen':
      return (s.tipsSeen ?? []).includes(a.id) ? 'Already seen.' : null;
    case 'setRun':
      if (!['idle', 'single', 'normal', 'surge'].includes(a.run)) return 'Unknown shift pattern.';
      if (def!.owner !== 'state') return 'You can only run your own plants.';
      if (site!.mothballed && a.run !== 'idle') return 'Reopen the plant first.';
      if (a.run === 'surge' && surgeBanned(s, a.site)) return 'A union deal rules out round-the-clock shifts here for now.';
      return site!.processes[a.process] ? null : 'Unknown process.';
    case 'expand':
      if (def!.owner !== 'state') return 'Invest in a supplier to expand its capacity.';
      if (!site!.processes[a.process]) return 'Unknown process.';
      if (site!.processes[a.process].expansions >= 4) return 'No room left on this site.';
      return funds(s, expandCost(s, a.site, a.process));
    case 'hire': {
      if (def!.owner !== 'state') return 'Only your own sites hire directly.';
      if (!Number.isInteger(a.count) || a.count < 1) return 'Hire at least one person.';
      if (site!.mothballed) return 'Reopen the plant first.';
      const room = hireRoom(s, townOf(a.site));
      if (a.count > room) return room <= 0 ? `${townOf(a.site)} has no one left to hire: build housing there.` : `${townOf(a.site)} can supply only ${room} more people: hire fewer, or build housing.`;
      return funds(s, a.count * HIRE_COST * s.priceIndex);
    }
    case 'repair':
      if (def!.owner !== 'state') return 'Only your own sites.';
      if (site!.condition >= 95) return 'Already in good repair.';
      return funds(s, repairCost(s, a.site));
    case 'signContract': {
      if (def!.owner === 'state') return 'You do not contract with yourself.';
      if (site!.status === 'closed') return `${def!.name} has closed.`;
      if (!site!.qualified) return `${def!.name} is not qualified to supply your arsenals yet.`;
      if (!def!.processes.some((p) => RECIPES[p.recipe].output === a.material || RECIPES[p.recipe].extra?.[a.material])) return `${def!.name} does not make that.`;
      if (!(a.months in CONTRACT_DISCOUNT)) return 'Contracts run for 12, 24 or 36 months.';
      return a.perDay > 0 && Number.isFinite(a.perDay) ? null : 'Quantity must be above zero.';
    }
    case 'cancelContract':
      return s.contracts.some((c) => c.id === a.contract) ? null : 'No such contract.';
    case 'qualify':
      if (def!.owner === 'state') return 'Your own sites need no qualification.';
      if (site!.status === 'closed') return `${def!.name} has closed.`;
      if (site!.qualified) return 'Already qualified.';
      if (site!.qualifyingDays !== null) return 'Qualification already under way.';
      return funds(s, qualifyCost(a.site));
    case 'invest':
      if (def!.owner !== 'private') return 'You can only invest in domestic companies.';
      if (site!.status === 'closed') return `${def!.name} has closed.`;
      if (!site!.processes[a.process]) return 'Unknown process.';
      if (site!.processes[a.process].expansions >= 3) return 'This plant cannot grow any further.';
      return funds(s, investCost(s, a.site, a.process));
    case 'refurbish': {
      // Rounds are refurbished where they wait: your depots, arsenals and bases, not at the demilitarization site.
      if (def!.owner !== 'state' || def!.kind === 'demil') return 'Refurbish rounds at a depot, an arsenal or a base.';
      const q = site!.unserviceable[a.line] ?? 0;
      if (q < 1) return 'Nothing waiting for refurbishment here.';
      if (a.line === 'shell155') return 'Old shells are not worth refurbishing.';
      return funds(s, refurbishCost(a.line, q));
    }
    case 'setPolicy':
      if (a.policy.demilMethod === 'burn' && (s.communities?.burnBanUntil ?? 0) > s.day) return 'A court order bans open burning for now.';
      return a.policy.demilMethod === 'burn' && s.policies.includes('greenDemil') ? 'Your clean disposal pledge bans open burning.' : null;
    case 'research': {
      const r = RESEARCH[a.research];
      if (hasResearch(s, a.research)) return 'Already done.';
      if (s.strategy.research.active) return 'Your engineers are busy with another project.';
      const missing = r.requires.filter((q) => !hasResearch(s, q));
      if (missing.length) return `Needs ${missing.map((q) => RESEARCH[q].name).join(', ')} first.`;
      return funds(s, r.cost);
    }
    case 'hireStaff': {
      const p = s.strategy.candidates.find((c) => c.id === a.candidate);
      if (!p) return 'That candidate has taken another job.';
      return funds(s, p.salary * 3);
    }
    case 'fireStaff': {
      const p = s.strategy.staff[a.role];
      if (!p) return 'Nobody holds that post.';
      return funds(s, p.salary * 3);
    }
    case 'decide': {
      const d = s.strategy.decisions.find((x) => x.id === a.decision);
      if (!d) return 'That decision is gone.';
      return d.kind === 'poach' ? poachWhy(s, d, a.option) : null;
    }
    case 'adoptDoctrine':
      return validateDoctrine(s, a);
    case 'promoteManager':
    case 'appointManager':
      return validateCast(s, a);
    case 'openTender':
      if (!(a.perDay > 0) || !Number.isFinite(a.perDay)) return 'Quantity must be above zero.';
      if (!bidders(s, a.material).length) return 'No qualified supplier makes that. Qualify one first.';
      if (s.tenders.some((t) => t.material === a.material)) return 'A tender for that is already open.';
      return funds(s, TENDER_COST);
    case 'awardTender': {
      const t = s.tenders.find((x) => x.id === a.tender);
      if (!t || t.expires <= s.day) return 'That tender has closed.';
      const b = t.bids.find((x) => x.site === a.site);
      if (!b) return 'No such bid.';
      if (s.sites[b.site].status === 'closed') return `${SITE_BY_ID[b.site].name} has closed.`;
      return b.perDay > 0 ? null : 'That supplier has no capacity to offer.';
    }
    case 'tutorial':
      return s.tutorial ? null : 'Not in the tutorial.';
    case 'build':
      return buildBlock(s, a.kind, a.target, a.process);
    case 'safety':
      if (def!.owner !== 'state' || !def!.crew) return 'Only your own plants.';
      if (site!.safety >= MAX_SAFETY) return 'The safety programme is already complete.';
      return funds(s, safetyCost(s, a.site));
    case 'apprentices':
      if (def!.owner !== 'state' || !def!.crew) return 'Only your own plants.';
      return a.perMonth >= 0 && a.perMonth <= 60 ? null : 'Between 0 and 60 a month.';
    case 'programme':
      if (a.years !== 3 && a.years !== 5) return 'Programmes run for 3 or 5 years.';
      if (!s.lines[a.line]?.unlocked) return 'That line is not in production.';
      if (s.programmes.some((p) => p.line === a.line)) return 'A programme for that round is already running.';
      if (s.programmes.length >= 3) return 'The Committee will fund three programmes at most.';
      return monthlyCapacity(s, a.line) >= 1 ? null : 'Your arsenals cannot make that yet.';
    case 'adoptPolicy':
      if (s.policies.includes(a.policy)) return 'Already in force.';
      return s.policies.length >= MAX_POLICIES ? `At most ${MAX_POLICIES} policies at once. Revoke one first.` : null;
    case 'revokePolicy':
      return s.policies.includes(a.policy) ? null : 'Not in force.';
    case 'vet':
      if (def!.owner !== 'state' || !site!.processes.length) return 'Only your own plants.';
      if ((site!.clearance ?? 0) >= MAX_CLEARANCE) return 'Already at full clearance.';
      return funds(s, vetCost(s, a.site));
    case 'housing':
      if (!CITIES[a.town]) return 'No such town.';
      return funds(s, housingCost(s));
    case 'mothball':
      if (def!.owner !== 'state' || !site!.processes.length) return 'Only your own plants.';
      if (site!.status === 'building') return 'It is still being built.';
      return site!.mothballed ? 'Already mothballed.' : null;
    case 'reopen':
      return site!.mothballed ? null : 'It is running.';
    case 'prioritiseTest':
      return s.tests.some((t) => t.id === a.test) ? null : 'No such programme.';
    case 'handover':
      return s.hotseat?.handover ? null : 'No handover waiting.';
    case 'storyBriefed':
      // A briefing is waiting only when there is a story and its briefing is set (not null and not missing).
      return s.story && s.story.briefing !== null && s.story.briefing !== undefined ? null : 'No briefing waiting.';
    case 'found':
      return foundBlock(s, a.plot, a.recipe);
    case 'inhouse':
      return inhouseBlock(s, a.site, a.recipe);
    case 'design':
      return designBlock(s, a.line, a.variant);
    case 'sandbox': {
      if (s.mode !== 'sandbox') return 'Only in a sandbox game.';
      const op = a.op;
      if (op.kind === 'crisis') return s.crisis ? 'A crisis is already on.' : CRISES.some((c) => c.region === op.region) ? null : 'No crisis fits that region.';
      if (op.kind === 'endCrisis') return s.crisis ? null : 'No crisis to end.';
      if (op.kind === 'disrupt') return s.sites[op.site]?.processes.length ? null : 'That site makes nothing.';
      if (op.kind === 'finishResearch') return s.strategy.research.active ? null : 'Nothing is being researched.';
      if (op.kind === 'money') return Number.isFinite(op.amount) && Math.abs(op.amount) <= 1e6 ? null : 'Enter an amount up to $1,000,000M either way.';
      return null;
    }
  }
}

function charge(s: SimState, cost: number): void {
  s.treasury -= cost;
  s.month.spend.projects += cost;
}

export function apply(state: SimState, a: SimAction): SimState {
  if (validate(state, a)) return state;
  applyWorld(state.world ?? null);
  const s = structuredClone(state);
  s.alerts = [];
  setNetwork(s.network.built, s.network.upgrades);
  applyInPlace(s, a);
  return s;
}

/** Carries out a valid action on a state you already own, changing it in place. Returns false if the action is not
 * allowed. The autopilot uses this inside a day's step; everything else should use apply(). */
export function applyInPlace(s: SimState, a: SimAction): boolean {
  if (validate(s, a)) return false;
  const before = s.treasury;
  switch (a.type) {
    case 'setRun':
      s.sites[a.site].processes[a.process].run = a.run;
      break;
    case 'expand':
    case 'invest': {
      const cost = a.type === 'expand' ? expandCost(s, a.site, a.process) : investCost(s, a.site, a.process);
      charge(s, cost);
      const p = s.sites[a.site].processes[a.process];
      const total = p.capacity + (p.ramp ?? []).reduce((x, r) => x + r.cap, 0);
      const base = total / (1 + 0.25 * p.expansions);
      const add = base * (a.type === 'invest' ? 0.3 : 0.25);
      // New capacity is installed and inspected, then ramps up from about 10% on its own.
      (p.ramp ??= []).push({ cap: add, maturity: 0.1 });
      p.expansions++;
      if (a.type === 'invest') s.strategy.investedThisMonth += cost;
      s.feed.push({ day: s.day, tone: 'info', text: `New capacity ordered at ${SITE_BY_ID[a.site].name}: ${RECIPES[p.recipe].name}.`, site: a.site });
      break;
    }
    case 'hire':
      charge(s, a.count * HIRE_COST * s.priceIndex);
      s.sites[a.site].trainees.push({ count: Math.floor(a.count), days: TRAINING_DAYS });
      break;
    case 'repair':
      charge(s, repairCost(s, a.site));
      s.sites[a.site].condition = 100;
      break;
    case 'signContract':
      s.contracts.push({
        id: s.nextId++,
        site: a.site,
        material: a.material,
        perDay: a.perDay,
        price: priceNow(s, a.material) * CONTRACT_DISCOUNT[a.months],
        endDay: s.day + a.months * DAYS_PER_MONTH,
      });
      break;
    case 'cancelContract':
      s.contracts = s.contracts.filter((c) => c.id !== a.contract);
      break;
    case 'qualify':
      charge(s, qualifyCost(a.site));
      s.sites[a.site].qualifyingDays = Math.round(QUALIFY_DAYS * (hasResearch(s, 'rapidQual') ? 0.5 : 1));
      break;
    case 'refurbish': {
      const site = s.sites[a.site];
      const q = site.unserviceable[a.line] ?? 0;
      charge(s, refurbishCost(a.line, q));
      site.unserviceable[a.line] = 0;
      // New motors and recertification: five more years of service.
      const lots = site.lots[a.line] ?? (site.lots[a.line] = []);
      lots.push({ qty: q, made: s.day, until: s.day + 5 * 360 });
      lots.sort((x, y) => x.until - y.until);
      s.feed.push({ day: s.day, tone: 'good', text: `${Math.round(q)} ${MATERIALS[a.line].name} refurbished at ${SITE_BY_ID[a.site].name}: five more years of service.`, site: a.site });
      void lotQty;
      break;
    }
    case 'research':
      startResearch(s, a.research);
      break;
    case 'hireStaff': {
      const p = s.strategy.candidates.find((c) => c.id === a.candidate)!;
      charge(s, p.salary * 3);
      s.strategy.staff[p.role] = p;
      s.strategy.candidates = s.strategy.candidates.filter((c) => c.id !== p.id);
      feed(s, 'good', `${p.name} joins the Board.`);
      break;
    }
    case 'fireStaff': {
      const p = s.strategy.staff[a.role]!;
      charge(s, p.salary * 3);
      s.strategy.staff[a.role] = null;
      break;
    }
    case 'decide':
      resolveDecision(s, a.decision, a.option, feed);
      break;
    case 'openTender':
      charge(s, TENDER_COST);
      s.tenders.push(makeTender(s, a.material, a.perDay, a.months));
      feed(s, 'info', `Tender opened for ${a.perDay} ${MATERIALS[a.material].name} a day over ${a.months} months.`);
      break;
    case 'awardTender': {
      const t = s.tenders.find((x) => x.id === a.tender)!;
      const b = t.bids.find((x) => x.site === a.site)!;
      s.contracts.push({ id: s.nextId++, site: b.site, material: t.material, perDay: b.perDay, price: b.price, endDay: s.day + t.months * DAYS_PER_MONTH });
      s.tenders = s.tenders.filter((x) => x.id !== t.id);
      s.sites[b.site].health = Math.min(100, s.sites[b.site].health + 6);
      storyCount(s, 'awarded');
      feed(s, 'good', `Contract awarded to ${SITE_BY_ID[b.site].name}: ${b.perDay} ${MATERIALS[t.material].name} a day at $${b.price.toFixed(3)}M.`, b.site);
      break;
    }
    case 'tutorial':
      s.tutorial = { step: a.step };
      break;
    case 'build':
      startProject(s, a.kind, a.target, a.process, feed);
      feed(s, 'info', `Work begins: ${projectName(s, a)}.`);
      break;
    case 'safety': {
      charge(s, safetyCost(s, a.site));
      const site = s.sites[a.site];
      site.safety += 1;
      site.morale = Math.min(100, site.morale + 5);
      feed(s, 'good', `Safety programme stage ${site.safety} at ${SITE_BY_ID[a.site].name}.`, a.site);
      break;
    }
    case 'apprentices':
      s.sites[a.site].apprentices = Math.round(a.perMonth);
      break;
    case 'programme': {
      const t = programmeTerms(s, a.line, a.years);
      s.programmes.push({ id: s.nextId++, line: a.line, perMonth: t.perMonth, funding: t.funding, start: s.day, endDay: s.day + a.years * 360, misses: 0 });
      s.strategy.factions.hawks = Math.min(100, s.strategy.factions.hawks + 3);
      feed(s, 'good', `A ${a.years}-year ${MATERIALS[a.line].name} programme is signed: ${t.perMonth} rounds a month, for $${t.funding}M a month while you deliver.`, undefined, true);
      break;
    }
    case 'adoptPolicy':
      s.policies.push(a.policy);
      if (a.policy === 'stockpileLaw') {
        s.appropriation = Math.round(s.appropriation * 1.1);
        s.strategy.baseBudget = Math.round(s.strategy.baseBudget * 1.1);
      }
      if (a.policy === 'greenDemil') s.policy.demilMethod = 'recycle';
      feed(s, 'info', `Policy adopted: ${POLICIES[a.policy].name}.`);
      break;
    case 'revokePolicy':
      s.policies = s.policies.filter((p) => p !== a.policy);
      if (a.policy === 'stockpileLaw') {
        s.appropriation = Math.round(s.appropriation / 1.1);
        s.strategy.baseBudget = Math.round(s.strategy.baseBudget / 1.1);
      }
      s.confidence = Math.max(0, s.confidence - REVOKE_COST);
      feed(s, 'warn', `Policy revoked: ${POLICIES[a.policy].name}. The Committee notes the broken promise.`);
      break;
    case 'secondTerm':
      startSecondTerm(s, feed, a.boon);
      break;
    case 'adoptDoctrine':
      applyDoctrine(s, a, feed);
      break;
    case 'promoteManager':
    case 'appointManager':
      applyCast(s, a, feed);
      break;
    case 'storyBriefed':
      s.story!.briefing = null;
      break;
    case 'vet': {
      charge(s, vetCost(s, a.site));
      const site = s.sites[a.site];
      site.clearance = (site.clearance ?? 0) + 1;
      // Vetting is intrusive: a little grumbling on the shop floor.
      site.morale = Math.max(0, site.morale - 2);
      feed(s, 'info', `Security vetting at ${SITE_BY_ID[a.site].name} reaches level ${site.clearance}.`, a.site);
      break;
    }
    case 'housing':
      charge(s, housingCost(s));
      s.towns[a.town].building.push({ homes: HOMES_PER_PROJECT, days: HOUSING_DAYS });
      onHousing(s, a.town);
      feed(s, 'info', `${HOMES_PER_PROJECT} homes are being built in ${CITIES[a.town].name}: about five months.`);
      break;
    case 'mothball':
      mothball(s, a.site, feed);
      break;
    case 'reopen':
      reopen(s, a.site, feed);
      break;
    case 'prioritiseTest':
      prioritise(s, a.test);
      break;
    case 'tradeMission':
    case 'supplyGuarantee':
    case 'coproduce':
    case 'endCoproduction':
    case 'seekExport':
      applyDiplomacy(s, a, feed);
      break;
    case 'hearingAnswer':
      answer(s, a.question, a.option, feed);
      break;
    case 'hearingRequest':
      request(s, a.level, feed);
      break;
    case 'cyberDefence':
    case 'cyberBackups':
    case 'cyberDrills':
      applyCyber(s, a, feed);
      break;
    case 'payDeal':
      payDeal(s, feed);
      break;
    case 'generator':
    case 'powerContract':
    case 'gridUpgrade':
      applyEnergy(s, a, feed);
      break;
    case 'auditTeam':
    case 'disbandAuditTeam':
      applyOversight(s, a, feed);
      break;
    case 'communityFund':
    case 'openDay':
      applyCommunity(s, a, feed);
      break;
    case 'automate':
    case 'automationReserve':
    case 'automationStance':
      applyAutomation(s, a);
      break;
    case 'hireEngineers':
    case 'academy':
    case 'engineerPay':
      applyEngineers(s, a, feed);
      break;
    case 'intelOp':
    case 'intelAgency':
      applyIntel(s, a, feed);
      break;
    case 'tipSeen':
      s.tipsSeen = [...(s.tipsSeen ?? []), a.id];
      break;
    case 'handover':
      s.hotseat!.handover = false;
      break;
    case 'found':
      foundPlant(s, a.plot, a.recipe, feed);
      break;
    case 'inhouse':
      addInhouseLine(s, a.site, a.recipe, feed);
      break;
    case 'design':
      s.treasury -= designCost(s);
      s.month.spend.projects += designCost(s);
      s.design = { line: a.line, variant: a.variant, days: DESIGN_DAYS };
      feed(s, 'info', `Design work begins on a new ${MATERIALS[a.line].name} variant: about four months.`);
      break;
    case 'sandbox': {
      const op = a.op;
      if (op.kind === 'rules') {
        s.settings = { ...s.settings, ...op.settings };
        if (op.settings.endless === false) s.days = Math.max(s.day + 30, s.plannedDays ?? 48 * DAYS_PER_MONTH);
        if (op.settings.endless) s.days = 100 * 360;
      } else if (op.kind === 'money') {
        s.treasury += op.amount;
        s.month.income.appropriation += op.amount;
        feed(s, 'info', `Sandbox: $${op.amount}M added to the treasury.`);
      } else if (op.kind === 'crisis') {
        const c = CRISES.find((x) => x.region === op.region)!;
        s.crisis = { id: c.id, name: c.name, region: c.region, family: c.family, phase: 'active', days: 180, intensity: 1.1, mix: { ...c.mix } };
        feed(s, 'bad', `Sandbox: the ${c.name} begins.`, undefined, true);
      } else if (op.kind === 'endCrisis') {
        feed(s, 'good', `Sandbox: the ${s.crisis!.name} is called off.`);
        s.supplemented = s.supplemented.filter((x) => x !== s.crisis!.id);
        s.crisis = null;
      } else if (op.kind === 'disrupt') {
        const site = s.sites[op.site];
        site.disruptionDays = 45;
        site.disruptionFactor = 0.3;
        feed(s, 'bad', `Sandbox: ${SITE_BY_ID[op.site].name} is disrupted for six weeks.`, op.site, true);
      } else if (op.kind === 'calm') {
        for (const site of Object.values(s.sites)) {
          site.disruptionDays = 0;
          site.disruptionFactor = 1;
          site.embargoDays = 0;
        }
        feed(s, 'good', 'Sandbox: every disruption and export ban is lifted.');
      } else if (op.kind === 'finishResearch') {
        s.strategy.research.active!.days = 1;
      }
      break;
    }
    case 'setPolicy':
      if (a.policy.demilMethod) s.recycleChosen = a.policy.demilMethod === 'recycle';
      s.policy = { ...s.policy, ...a.policy, depotDays: { ...s.policy.depotDays, ...(a.policy.depotDays ?? {}) } };
      break;
  }
  if (s.hotseat && s.treasury < before) s.hotseat.players[s.hotseat.active].spent += before - s.treasury;
  return true;
}

export function applyAll(s: SimState, actions: SimAction[]): SimState {
  return actions.reduce(apply, s);
}
