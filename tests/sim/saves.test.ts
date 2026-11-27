import { describe, expect, it } from 'vitest';
import { canonical } from '../golden/cases';
import { SAVE_SCHEMA, migrate, newSim } from '../../src/sim/setup';
import { advanceDays, openCampaign } from '../../src/sim/tick';
import type { SimState } from '../../src/sim/types';

/** A save as an older version wrote it: no schema number, and without fields added since. */
function oldSave(): SimState {
  const s = JSON.parse(JSON.stringify(advanceDays(openCampaign(newSim({ seed: 9 })), 60))) as Record<string, unknown>;
  for (const k of ['schema', 'engineers', 'doctrine', 'cast', 'intel']) delete s[k];
  return s as unknown as SimState;
}

describe('save schema', () => {
  it('numbers every new save with the current schema', () => {
    // Act and assert
    expect(newSim({ seed: 1 }).schema).toBe(SAVE_SCHEMA);
  });

  it('brings a save from before 18.0 up to the current schema, with every missing system restored', () => {
    // Arrange
    const s = oldSave();
    // Act
    const m = migrate(s);
    // Assert
    expect(m.schema).toBe(SAVE_SCHEMA);
    expect(m.engineers).toBeTruthy();
    expect(m.doctrine).toBeTruthy();
    expect(m.cast).toBeTruthy();
    expect(m.intel).toBeTruthy();
    // And it plays on.
    expect(() => advanceDays(m, 30)).not.toThrow();
  });

  it('leaves a current save exactly as it was when loaded again', () => {
    // Arrange
    const s = advanceDays(openCampaign(newSim({ seed: 10 })), 45);
    const text = JSON.stringify(s);
    // Act
    const loaded = migrate(JSON.parse(text) as SimState);
    // Assert
    expect(canonical(loaded)).toBe(canonical(JSON.parse(text)));
  });
});
