// Balance check: plays campaigns on every difficulty, hands-off and with a simple active player.
//   npm run balance
import { apply } from '../src/sim/actions';
import { readiness } from '../src/sim/selectors';
import { newSim } from '../src/sim/setup';
import { advanceDays, openCampaign } from '../src/sim/tick';
import { active } from './director';

for (const mode of ['hands-off', 'active'] as const) {
  for (const difficulty of ['easy', 'normal', 'hard'] as const) {
    for (const seed of [1, 2, 3]) {
      let s = openCampaign(newSim({ seed, difficulty, months: 48 }));
      while (!s.over) {
        if (mode === 'active') {
          for (const a of active(s)) s = apply(s, a);
          // Tenders open this pass are awarded straight away.
          for (const a of active(s).filter((x) => x.type === 'awardTender')) s = apply(s, a);
        }
        s = advanceDays(s, 30);
      }
      const leaks = s.history.reduce((a, h) => a + Object.values(h.leaked).reduce((x, y) => x + y, 0), 0);
      console.log(mode.padEnd(9), difficulty.padEnd(6), seed, s.outcome.padEnd(9), `months ${String(s.history.length).padStart(2)}`, `readiness ${readiness(s).toFixed(2)}`, `confidence ${String(Math.round(s.confidence)).padStart(3)}`, `treasury ${String(Math.round(s.treasury)).padStart(5)}`, `leaks ${Math.round(leaks)}`, `research ${s.strategy.research.done.length}`);
    }
  }
}
