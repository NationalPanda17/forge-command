// Balance check: plays hands-off campaigns on every difficulty and prints the outcome.
//   npm run balance
import { readiness } from '../src/sim/selectors';
import { newSim } from '../src/sim/setup';
import { advanceDays, openCampaign } from '../src/sim/tick';

for (const difficulty of ['easy', 'normal', 'hard'] as const) {
  for (const seed of [1, 2, 3]) {
    let s = openCampaign(newSim({ seed, difficulty, months: 48 }));
    while (!s.over) s = advanceDays(s, 30);
    const leaks = s.history.reduce((a, h) => a + Object.values(h.leaked).reduce((x, y) => x + y, 0), 0);
    const retired = s.history.reduce((a, h) => a + h.retired, 0);
    console.log(difficulty.padEnd(6), seed, s.outcome.padEnd(9), `months ${s.history.length}`, `readiness ${readiness(s).toFixed(2)}`, `confidence ${Math.round(s.confidence)}`, `treasury ${Math.round(s.treasury)}`, `leaks ${Math.round(leaks)}`, `retired ${Math.round(retired)}`);
  }
}
