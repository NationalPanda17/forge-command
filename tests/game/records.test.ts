// Named saves, the record book and achievements: what the browser remembers between games.
import { beforeEach, describe, expect, it } from 'vitest';
import { newSim } from '../../src/sim/setup';
import { advanceDays, openCampaign } from '../../src/sim/tick';
import { apply } from '../../src/sim/actions';
import { MAX_SLOTS, deleteSlot, listSlots, loadSlot, saveSlot } from '../../src/game/saves';
import { bests, entryKey, kindOf, loadScores, loadTotals, recordScore } from '../../src/game/scores';
import { ACHIEVEMENTS, checkAchievements, loadAchievements } from '../../src/game/achievements';

let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
});

const finished = (seed: number, months = 12) => advanceDays(openCampaign(newSim({ seed, months })), months * 30 + 1);

describe('named saves', () => {
  it('save, list, load and delete', () => {
    const s = advanceDays(openCampaign(newSim({ seed: 1 })), 40);
    expect(saveSlot('  ', s)).toMatch(/name/);
    expect(saveSlot('First', s)).toBeNull();
    expect(listSlots().map((x) => x.name)).toEqual(['First']);
    const back = loadSlot('First')!;
    expect(back.day).toBe(s.day);
    expect(back.energy).toBeDefined();
    deleteSlot('First');
    expect(listSlots()).toHaveLength(0);
    expect(loadSlot('First')).toBeNull();
  });

  it('caps the number of slots, and survives a corrupt index', () => {
    const s = openCampaign(newSim({ seed: 1 }));
    for (let i = 0; i < MAX_SLOTS; i++) expect(saveSlot(`S${i}`, s)).toBeNull();
    expect(saveSlot('One too many', s)).toMatch(/At most/);
    store.set('forge-command-slots', '{not json');
    expect(listSlots()).toEqual([]);
  });

  it('an old save without the newer systems loads with them filled in', () => {
    const s = openCampaign(newSim({ seed: 2 })) as unknown as Record<string, unknown>;
    for (const k of ['energy', 'oversight', 'cyber', 'unions', 'diplomacy', 'hearing', 'promises', 'career', 'custom', 'towns', 'tests', 'hotseat']) delete s[k];
    store.set('forge-command-slot:Old', JSON.stringify(s));
    const back = loadSlot('Old')!;
    expect(back.energy.grids.north).toBeDefined();
    expect(back.oversight.findings).toEqual([]);
    expect(back.unions.towns.length).toBeGreaterThan(0);
    expect(() => advanceDays(back, 60)).not.toThrow();
  });
});

describe('the record book', () => {
  it('files each finished term once, and keeps lifetime totals', () => {
    const s = finished(3);
    recordScore(s);
    recordScore(s);
    expect(loadScores()).toHaveLength(1);
    expect(loadScores()[0].key).toBe(entryKey(s));
    expect(loadScores()[0].kind).toBe('campaign');
    const t = loadTotals();
    expect(t.terms).toBe(1);
    expect(t.completed + t.dismissed).toBe(1);
    expect(t.roundsMade).toBeGreaterThan(0);
  });

  it('a second term is filed separately, and the career length is remembered', () => {
    let s = finished(4);
    recordScore(s);
    s = apply(s, { type: 'secondTerm' });
    s = advanceDays(s, 48 * 30 + 1);
    recordScore(s);
    expect(loadScores()).toHaveLength(2);
    expect(loadTotals().longestCareer).toBe(2);
  });

  it('sandbox games are not scored, and bests are kept per kind and difficulty', () => {
    const sb = { ...finished(5), mode: 'sandbox' as const };
    recordScore(sb);
    expect(loadScores()).toHaveLength(0);
    recordScore(finished(6));
    recordScore(finished(7));
    const b = bests(loadScores());
    expect(b).toHaveLength(1);
    expect(b[0].entry.score).toBe(Math.max(...loadScores().map((e) => e.score)));
    expect(kindOf(openCampaign(newSim({ seed: 1, hotseat: ['A', 'B'] })))).toBe('hotseat');
  });
});

describe('achievements', () => {
  it('are earned once, remembered, and never in the sandbox', () => {
    const s = finished(8);
    const first = checkAchievements(s);
    expect(first.map((a) => a.id)).toContain('term');
    expect(checkAchievements(s)).toHaveLength(0);
    expect(loadAchievements().term).toBeDefined();
    store.clear();
    expect(checkAchievements({ ...s, mode: 'sandbox' })).toHaveLength(0);
  });

  it('every achievement can be checked on a fresh game without crashing', () => {
    const s = openCampaign(newSim({ seed: 1 }));
    for (const a of ACHIEVEMENTS) expect(() => a.check(s)).not.toThrow();
  });
});
