import { describe, expect, it } from 'vitest';
import {
  LINES,
  RESEARCH,
  activeLines,
  applyAction,
  bomOf,
  calmDraw,
  endTurn,
  freeBays,
  newGame,
  playTurn,
  readiness,
  validateAction,
  type Action,
  type GameState,
  type ResearchId,
} from '../src/engine';

const resolveAll = (s: GameState): Action[] => s.decisions.map((d) => ({ type: 'resolveDecision', decision: d.id, option: d.fallback }) as Action);
const withResearch = (s: GameState, ...ids: ResearchId[]): GameState => {
  const c = structuredClone(s);
  c.research.done.push(...ids);
  return c;
};

describe('research', () => {
  it('runs one project at a time and completes after its months', () => {
    let s = { ...newGame({ seed: 1 }), treasury: 5000 };
    s = applyAction(s, { type: 'startResearch', research: 'digitalTest' });
    expect(validateAction(s, { type: 'startResearch', research: 'rapidQual' })).toMatch(/busy/);
    for (let i = 0; i < RESEARCH.digitalTest.months; i++) s = playTurn(s, resolveAll(s));
    expect(s.research.done).toContain('digitalTest');
    expect(s.research.active).toBeNull();
  });

  it('respects prerequisites', () => {
    const s = { ...newGame({ seed: 1 }), treasury: 5000 };
    expect(validateAction(s, { type: 'startResearch', research: 'seekerDTC' })).toMatch(/Gallium-light/);
    expect(validateAction(withResearch(s, 'galliumLight'), { type: 'startResearch', research: 'seekerDTC' })).toBeNull();
  });

  it('design changes cut the parts each round needs', () => {
    const s = newGame({ seed: 2 });
    const before = bomOf(s, 'pac3');
    const after = bomOf(withResearch(s, 'galliumLight', 'commonMotors', 'seekerDTC'), 'pac3');
    expect(after.criticalMaterials).toBeCloseTo(before.criticalMaterials! * 0.6);
    expect(after.srm).toBeCloseTo(before.srm! * 0.85);
    expect(after.rfSeeker).toBeCloseTo(before.rfSeeker! * 0.8);
  });

  it('digital-twin testing cuts test-cell hours', () => {
    const s = newGame({ seed: 3, difficulty: 'easy' });
    const plain = endTurn(s).campuses.corran.lastTestHours.need;
    const twin = endTurn(withResearch(s, 'digitalTest')).campuses.corran.lastTestHours.need;
    expect(twin).toBeLessThan(plain * 0.8);
  });
});

describe('new product lines', () => {
  it('new lines start locked, outside the readiness score', () => {
    const s = newGame({ seed: 4 });
    expect(activeLines(s)).not.toContain('apkws');
    expect(calmDraw(s, 'apkws')).toBe(0);
    expect(validateAction({ ...s, treasury: 5000 }, { type: 'establishLine', line: 'apkws' })).toMatch(/Research/);
    expect(readiness(s)).toBeGreaterThan(0);
  });

  it('setting up a line needs its research and four free bays', () => {
    let s = withResearch({ ...newGame({ seed: 4 }), treasury: 5000 }, 'apkws');
    expect(validateAction(s, { type: 'establishLine', line: 'apkws' })).toMatch(/4 free bays/);
    s.campuses.northgate.bays += 4;
    const free = freeBays(s, 'northgate');
    s = applyAction(s, { type: 'establishLine', line: 'apkws' });
    expect(activeLines(s)).toContain('apkws');
    expect(freeBays(s, 'northgate')).toBe(free - 4);
  });

  it('cheap counter-drone rounds take over drone defense and improve the cost exchange', () => {
    const base = structuredClone(newGame({ seed: 5, difficulty: 'easy' }));
    const withApkws = withResearch(base, 'apkws');
    withApkws.lines.apkws.tranches = [{ capacity: LINES.apkws.baseCapacity, maturity: 1, base: true, faiMonths: 0 }];
    withApkws.reserves.apkws.stock = 2000;
    expect(calmDraw(withApkws, 'apkws')).toBeGreaterThan(0);
    expect(calmDraw(withApkws, 'stinger')).toBeLessThan(calmDraw(base, 'stinger'));
    let a = withApkws;
    let b = base;
    for (let i = 0; i < 6; i++) {
      a = endTurn(a);
      b = endTurn(b);
    }
    const ratio = (g: GameState) => g.history.reduce((x, h) => x + h.threatValueStopped, 0) / g.history.reduce((x, h) => x + h.interceptorSpend, 0);
    expect(a.reserves.apkws.used).toBeGreaterThan(0);
    expect(ratio(a)).toBeGreaterThan(ratio(b));
  });

  it('high-power microwave stops some drones before any interceptor fires', () => {
    const s = newGame({ seed: 6 });
    expect(calmDraw(withResearch(s, 'hpm'), 'stinger')).toBeCloseTo(calmDraw(s, 'stinger') * 0.8);
  });
});
