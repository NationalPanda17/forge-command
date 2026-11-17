// Traces one campaign month by month: confidence, its causes, and the people in the arsenals.
//   npx vite-node scripts/probe.ts <seed> <difficulty>
import { apply } from '../src/sim/actions';
import { newSim } from '../src/sim/setup';
import { advanceDays, openCampaign } from '../src/sim/tick';
import { active } from './director';

const seed = Number(process.argv[2] ?? 1);
const difficulty = (process.argv[3] ?? 'normal') as 'easy' | 'normal' | 'hard';
let s = openCampaign(newSim({ seed, difficulty, months: 48 }));
const counts: Record<string, number> = {};
let seen = 0;
while (!s.over) {
  for (const a of active(s)) s = apply(s, a);
  for (const a of active(s).filter((x) => x.type === 'awardTender')) s = apply(s, a);
  const c0 = s.confidence;
  const f0 = { ...s.strategy.factions };
  s = advanceDays(s, 30);
  const h = s.history.at(-1)!;
  for (const f of s.feed.filter((x) => x.day > seen)) for (const k of ['Accident', 'Strike', 'Pay dispute', 'Objective missed', 'rejects', 'Morale is low', 'condemned', 'Penalty', 'got through']) if (f.text.includes(k)) counts[k] = (counts[k] ?? 0) + 1;
  seen = s.day;
  const f = s.strategy.factions;
  const people = ['corranWorks', 'northgateCenter', 'ashfordComplex'].map((id) => `${Math.round(s.sites[id].skill)}/${Math.round(s.sites[id].morale)}/${Math.round(s.sites[id].fatigue)}`).join(' ');
  console.log(h.month, 'ready', h.readiness.toFixed(2), 'Δconf', (s.confidence - c0).toFixed(1), 'conf', s.confidence.toFixed(0), 'Δfac', (['hawks', 'treasury', 'regions', 'industry'] as const).map((k) => (f[k] - f0[k]).toFixed(1)).join('/'), 'people', people, 'tr', Math.round(s.treasury));
}
console.log(counts);
