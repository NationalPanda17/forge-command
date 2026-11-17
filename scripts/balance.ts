// Balance check: plays campaigns on every difficulty, hands-off and with a simple active player.
//   npm run balance
import { apply, validate, type SimAction } from '../src/sim/actions';
import { nationalStock, readiness, reserveTarget } from '../src/sim/selectors';
import { newSim } from '../src/sim/setup';
import { RESEARCH_IDS, STAFF_ROLE_IDS } from '../src/sim/strategy';
import { advanceDays, openCampaign } from '../src/sim/tick';
import type { SimState } from '../src/sim/types';
import { FINISHED, RECIPES, SITES, type LineId } from '../src/sim/world';

/** A competent but simple director: staff up, research, second sources, recycle, refurbish, chase crises, expand. */
function active(s: SimState): SimAction[] {
  const acts: SimAction[] = [];
  for (const d of s.strategy.decisions) acts.push({ type: 'decide', decision: d.id, option: d.kind === 'bailout' && s.treasury > 300 ? 'bail' : d.fallback });
  for (const role of STAFF_ROLE_IDS) {
    if (s.strategy.staff[role]) continue;
    const best = s.strategy.candidates.filter((c) => c.role === role).sort((a, b) => b.skill - a.skill)[0];
    if (best) acts.push({ type: 'hireStaff', candidate: best.id });
  }
  if (!s.strategy.research.active) {
    const next = RESEARCH_IDS.find((r) => validate(s, { type: 'research', research: r }) === null);
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
      if (nationalStock(s, line) < reserveTarget(s, line) * 0.7 && s.treasury > 600) acts.push({ type: 'expand', site: def.id, process: i });
    });
    if (site.workers < (def.crew + site.extraCrew) * 1.1) acts.push({ type: 'hire', site: def.id, count: 60 });
  }
  return acts;
}

for (const mode of ['hands-off', 'active'] as const) {
  for (const difficulty of ['easy', 'normal', 'hard'] as const) {
    for (const seed of [1, 2, 3]) {
      let s = openCampaign(newSim({ seed, difficulty, months: 48 }));
      while (!s.over) {
        if (mode === 'active') for (const a of active(s)) s = apply(s, a);
        s = advanceDays(s, 30);
      }
      const leaks = s.history.reduce((a, h) => a + Object.values(h.leaked).reduce((x, y) => x + y, 0), 0);
      console.log(mode.padEnd(9), difficulty.padEnd(6), seed, s.outcome.padEnd(9), `months ${String(s.history.length).padStart(2)}`, `readiness ${readiness(s).toFixed(2)}`, `confidence ${String(Math.round(s.confidence)).padStart(3)}`, `treasury ${String(Math.round(s.treasury)).padStart(5)}`, `leaks ${Math.round(leaks)}`, `research ${s.strategy.research.done.length}`);
    }
  }
}
