// 19.0.4: the chief of staff's supply planning invests at the home maker of the weakest material in the chain.
import { describe, expect, it } from 'vitest';
import { weakLinks } from '../../src/sim/analytics';
import { proposals } from '../../src/sim/automation';
import { newSim } from '../../src/sim/setup';
import { openCampaign } from '../../src/sim/tick';
import { RECIPES, SITES } from '../../src/sim/world';

const rich = () => ({ ...openCampaign(newSim({ seed: 1 })), treasury: 50000 });

describe('supply planning', () => {
  it('invests at the biggest home maker of the weakest material, even when a foreign maker is bigger', () => {
    // Arrange: ban the foreign chip maker, so silicon chips run short and the only home foundry must carry them.
    const s = rich();
    for (const d of SITES) if (d.owner === 'foreign') s.sites[d.id].embargoDays = 500;
    const w = weakLinks(s)[0];
    // Act
    const acts = proposals(s, 'production');
    // Assert: an investment (or expansion) at a home plant that makes it.
    const home = SITES.filter((d) => d.owner !== 'foreign' && s.sites[d.id].processes.some((p) => RECIPES[p.recipe].output === w.material)).map((d) => d.id);
    expect(home.length).toBeGreaterThan(0);
    expect(acts.some((a) => (a.type === 'invest' || a.type === 'expand') && home.includes(a.site))).toBe(true);
  });

  it('keeps its money when it cannot afford the work with a margin', () => {
    const s = { ...rich(), treasury: 0 };
    for (const d of SITES) if (d.owner === 'foreign') s.sites[d.id].embargoDays = 500;
    expect(proposals(s, 'production').some((a) => a.type === 'invest')).toBe(false);
  });
});
