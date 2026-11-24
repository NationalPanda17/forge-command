// The scripted director used by the balance check: competent, simple and predictable.
import { validate, type SimAction } from '../src/sim/actions';
import { nationalStock, readiness, reserveTarget } from '../src/sim/selectors';
import { bottleneck, monthsTo } from '../src/sim/analytics';
import { DEVELOPMENTS } from '../src/sim/rival';
import { FOUNDABLE } from '../src/sim/industry';
import { hireRoom, townIndex, townOf } from '../src/sim/towns';
import { crewNeed } from '../src/sim/selectors';
import { routeByKey, routeCap } from '../src/sim/build';
import { RESEARCH_IDS, STAFF_ROLE_IDS } from '../src/sim/strategy';
import type { SimState } from '../src/sim/types';
import { requestOdds } from '../src/sim/hearings';
import { CYBER_AREA_IDS } from '../src/sim/cyber';
import { supplierNations } from '../src/sim/diplomacy';
import { GRID_REGIONS, regionPlants } from '../src/sim/energy';
import { FINISHED, RECIPES, SITES, SITE_BY_ID, type LineId } from '../src/sim/world';

/** A competent but simple director: staff up, research, second sources, recycle, refurbish, chase crises, expand. */
export function active(s: SimState): SimAction[] {
  const acts: SimAction[] = [];
  const ready = readiness(s);
  const rich = s.treasury > 400;
  const choose: Record<string, string> = {
    bailout: rich ? 'bail' : 'let',
    budget: 'push',
    reprice: 'accept',
    supplement: 'ask',
    allyRequest: ready > 0.85 ? 'send' : 'decline',
    allyOffer: ready < 0.7 && s.treasury > 600 ? 'buy' : 'pass',
    export: ready > 0.9 ? 'accept' : 'decline',
    labour: rich ? 'pay' : 'talk',
    recall: rich ? 'recall' : 'accept',
    inspection: rich ? 'fund' : 'leave',
  };
  for (const d of s.strategy.decisions) {
    // Union claims: settle what is affordable, talk otherwise.
    const has = (o: string) => d.options.some((x) => x.id === o);
    const pick =
      d.kind === 'labour' ? (has('pay') ? (rich ? 'pay' : 'talk') : has('agree') ? 'agree' : has('fund') && rich ? 'fund' : d.fallback)
      : d.kind === 'ransom' ? 'rebuild'
      : d.kind === 'audit' ? 'accept'
      : d.kind === 'fraud' ? 'settle'
      : d.kind === 'permit' ? (rich ? 'package' : 'override')
      : choose[d.kind];
    acts.push({ type: 'decide', decision: d.id, option: pick ?? d.fallback });
  }
  // The budget hearing: answer for goodwill, promise only what is in hand, then ask for what the odds allow.
  if (s.hearing) {
    for (const q of s.hearing.questions) {
      if (s.hearing.answers[q.id]) continue;
      const safe = (o: (typeof q.options)[number]) =>
        !o.promise || (o.promise.kind === 'readiness' && ready > 0.88) || (o.promise.kind === 'solvent' && s.treasury > 600) || (o.promise.kind === 'vetting' && s.treasury > 900);
      const best = [...q.options].filter(safe).sort((a, b) => Object.values(b.sway).reduce((x, y) => x + y, 0) - Object.values(a.sway).reduce((x, y) => x + y, 0))[0] ?? q.options.find((o) => o.id === q.fallback)!;
      acts.push({ type: 'hearingAnswer', question: q.id, option: best.id });
    }
    acts.push({ type: 'hearingRequest', level: requestOdds(s, 'bold') >= 0.45 ? 'bold' : 'modest' });
  }
  // Cyber: basic defences everywhere once the books allow, then backups.
  for (const area of CYBER_AREA_IDS) if (s.cyber.levels[area] < (s.treasury > 1400 ? 2 : 1) && s.treasury > 800) acts.push({ type: 'cyberDefence', area });
  if (!s.cyber.backups && s.treasury > 1000) acts.push({ type: 'cyberBackups' });
  // Power: generators at the arsenals, a contract while power is cheap, an audit team once the books allow.
  if (s.treasury > 700) for (const def of SITES.filter((x) => x.owner === 'state' && x.kind === 'arsenal')) if (!s.energy.generators.includes(def.id)) acts.push({ type: 'generator', site: def.id });
  for (const r of GRID_REGIONS) if (regionPlants(s, r).length && s.energy.grids[r].price <= 1.05) acts.push({ type: 'powerContract', region: r });
  if (!s.oversight.team && s.treasury > 900) acts.push({ type: 'auditTeam' });
  // Towns: a fund for any town that has turned against you.
  if (s.treasury > 800) s.communities.mood.forEach((m, t) => m < 35 && acts.push({ type: 'communityFund', town: t }));
  // Keep the nations that sell you parts friendly when a ban would hurt.
  if (s.treasury > 900) for (const n of supplierNations()) if (s.diplomacy.nations[n] < 45) acts.push({ type: 'tradeMission', who: n });
  // Re-tender contracts before they lapse, and award the cheapest dependable bid.
  for (const c of s.contracts) {
    if (c.endDay - s.day > 45 || s.tenders.some((t) => t.material === c.material)) continue;
    if (s.contracts.some((k) => k !== c && k.material === c.material && k.endDay - s.day > 45)) continue;
    acts.push({ type: 'openTender', material: c.material, perDay: c.perDay, months: 24 });
  }
  for (const t of s.tenders) {
    const best = t.bids.filter((b) => b.perDay > 0 && b.reliability >= 0.5).sort((a, b) => a.price - b.price)[0];
    if (best) acts.push({ type: 'awardTender', tender: t.id, site: best.site });
  }
  for (const role of STAFF_ROLE_IDS) {
    if (s.strategy.staff[role]) continue;
    const best = s.strategy.candidates.filter((c) => c.role === role).sort((a, b) => b.skill - a.skill)[0];
    if (best) acts.push({ type: 'hireStaff', candidate: best.id });
  }
  if (!s.strategy.research.active) {
    // Counters to the rival's announced weapons come first.
    const counter = s.rival.known.map((k) => DEVELOPMENTS[k.id].counter).find((r) => validate(s, { type: 'research', research: r }) === null);
    const next = counter ?? RESEARCH_IDS.find((r) => validate(s, { type: 'research', research: r }) === null);
    if (next && s.treasury > 300) acts.push({ type: 'research', research: next });
  }
  for (const def of SITES) if (def.owner === 'private' && !s.sites[def.id].qualified && s.treasury > 400) acts.push({ type: 'qualify', site: def.id });
  if (s.policy.demilMethod !== 'recycle') acts.push({ type: 'setPolicy', policy: { demilMethod: 'recycle' } });
  for (const site of Object.values(s.sites)) {
    for (const [l, q] of Object.entries(site.unserviceable)) if ((q ?? 0) >= 1 && l !== 'shell155' && site.id !== 'karrowDemil') acts.push({ type: 'refurbish', site: site.id, line: l as LineId });
  }
  if (s.crisis) acts.push({ type: 'setPolicy', policy: { depotDays: { ...s.policy.depotDays, [s.crisis.region]: 60 } } });
  for (const def of SITES.filter((x) => x.kind === 'arsenal')) {
    const site = s.sites[def.id];
    site.processes.forEach((p, i) => {
      const line = RECIPES[p.recipe].output as LineId;
      if (!FINISHED.includes(line)) return;
      // Throttle lines far above target so they stop eating shared parts; restart them when they come back down.
      const level = nationalStock(s, line) / Math.max(1, reserveTarget(s, line));
      if (level > 1.6 && p.run !== 'idle') acts.push({ type: 'setRun', site: def.id, process: i, run: 'idle' });
      else if (level < 1.1 && p.run === 'idle' && s.lines[line].unlocked) acts.push({ type: 'setRun', site: def.id, process: i, run: 'normal' });
      // A starved round whose tightest part has a single outside source: bring that part in-house.
      if (level < 0.6 && s.lines[line].unlocked && s.treasury > 1500) {
        const b = bottleneck(s, line);
        const recipe = b ? Object.keys(FOUNDABLE).find((r) => RECIPES[r].output === b.material) : undefined;
        if (recipe) {
          const outside = SITES.filter((d) => d.owner !== 'state' && s.sites[d.id].processes.some((q) => q.recipe === recipe)).length;
          if (outside <= 1) acts.push({ type: 'inhouse', site: def.id, recipe });
        }
      }
      // A starved round: fund the supplier behind its tightest input.
      if (level < 0.6 && s.lines[line].unlocked && s.treasury > 600) {
        const b = bottleneck(s, line);
        const top = b?.top;
        if (top && SITE_BY_ID[top].owner === 'private') {
          const k = s.sites[top].processes.findIndex((q) => RECIPES[q.recipe].output === b!.material);
          if (k >= 0) acts.push({ type: 'invest', site: top, process: k });
        }
      }
      if (level > 1.2) return;
      // Expand on the forecast, before the shortage arrives.
      const soon = monthsTo(s, line, 0.85, 12) !== null || nationalStock(s, line) < reserveTarget(s, line) * 0.8;
      if (soon && s.treasury > 500) acts.push({ type: 'expand', site: def.id, process: i });
    });
    // Hire to cover the crew, counting people already in training.
    const training = site.trainees.reduce((x, t) => x + t.count, 0);
    // Hire to the real crew requirement (expansions and new lines included), as far as the town can supply.
    const short = Math.ceil(crewNeed(site) * 1.03 - site.workers - training);
    if (short > 0) {
      const room = hireRoom(s, townOf(def.id));
      if (room > 0) acts.push({ type: 'hire', site: def.id, count: Math.min(room, Math.ceil(short / 10) * 10) });
      // A full town needs homes before it can supply more people.
      if (room < short && !s.towns[townIndex(townOf(def.id))].building.length) acts.push({ type: 'housing', town: townIndex(townOf(def.id)) });
    }
    if (site.clearance === undefined || site.clearance < 2) if (s.treasury > 900) acts.push({ type: 'vet', site: def.id });
    // Look after the people: safety, apprentices, and automation once the books allow.
    if (site.safety < 2 && s.treasury > 700) acts.push({ type: 'safety', site: def.id });
    if (site.apprentices === 0) acts.push({ type: 'apprentices', site: def.id, perMonth: 10 });
    if (s.treasury > 1500) site.processes.forEach((p, i) => !p.automated && p.run !== 'idle' && acts.push({ type: 'build', kind: 'automate', target: def.id, process: i }));
  }
  // Upgrade the busiest routes when money allows.
  if (s.treasury > 1200) {
    for (const [key, load] of Object.entries(s.routeLoad)) {
      const r = routeByKey(s, key);
      if (r && r.mode !== 'air' && load / routeCap(s, r) > 0.85) acts.push({ type: 'build', kind: 'upgrade', target: key });
    }
  }
  return acts;
}

