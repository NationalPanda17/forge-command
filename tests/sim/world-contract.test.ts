import { describe, expect, it } from 'vitest';
import { canonical } from '../golden/cases';
import { newSim } from '../../src/sim/setup';
import { advanceDays, openCampaign } from '../../src/sim/tick';
import { apply } from '../../src/sim/actions';
import { safeAdvice } from '../../src/sim/advisor';
import type { SimState } from '../../src/sim/types';

// The world-state contract (docs/port/determinism.md): the map's tables are shared module state, so every entry point
// (advanceDays, apply, migrate, newSim) first makes the game's own world current. Two games of different worlds,
// played turn about in one process, must each end exactly as they do when played alone.
const classic = () => openCampaign(newSim({ seed: 21 }));
const generated = () => openCampaign(newSim({ seed: 22, world: 9022 }));
const month = (s: SimState) => {
  for (const a of safeAdvice(s)) s = apply(s, a);
  return advanceDays(s, 30);
};

describe('world-state contract', () => {
  it('plays a classic and a generated game turn about exactly as each plays alone', () => {
    // Arrange: each game alone.
    let a = classic();
    for (let i = 0; i < 6; i++) a = month(a);
    let b = generated();
    for (let i = 0; i < 6; i++) b = month(b);
    // Act: the two together, a month each in turn.
    let x = classic();
    let y = generated();
    for (let i = 0; i < 6; i++) {
      x = month(x);
      y = month(y);
    }
    // Assert
    expect(canonical(x)).toBe(canonical(a));
    expect(canonical(y)).toBe(canonical(b));
  });
});
