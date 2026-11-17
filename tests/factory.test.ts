import { describe, expect, it } from 'vitest';
import {
  FACILITIES,
  LINES,
  STAGES,
  TEST_CELL_HOURS,
  applyAction,
  campusCrewNeed,
  deserialize,
  endTurn,
  newGame,
  playTurn,
  serialize,
  stageCaps,
  validateAction,
  type Action,
  type GameState,
} from '../src/engine';

const resolveAll = (s: GameState): Action[] => s.decisions.map((d) => ({ type: 'resolveDecision', decision: d.id, option: d.fallback }) as Action);
const rich = (s: GameState): GameState => ({ ...s, treasury: 10_000 });

describe('stages and buffers', () => {
  it('every line has a chain of stages with buffers between them', () => {
    const s = newGame({ seed: 1 });
    for (const id of Object.keys(LINES) as (keyof typeof LINES)[]) {
      expect(s.lines[id].wip).toHaveLength(STAGES[id].length - 1);
      expect(s.lines[id].debottleneck).toHaveLength(STAGES[id].length);
      expect(STAGES[id].at(-1)!.testHours).toBeGreaterThan(0);
    }
  });

  it('units flow through stages without appearing from nowhere', () => {
    const s = endTurn(newGame({ seed: 2, difficulty: 'easy' }));
    for (const id of Object.keys(LINES) as (keyof typeof LINES)[]) {
      const st = s.lines[id].stages;
      for (let i = 1; i < st.length; i++) {
        // A stage can only take what the stage before made this month plus what was already waiting.
        expect(st[i].throughput).toBeLessThanOrEqual(st[i - 1].throughput + LINES[id].baseCapacity * 0.31 + 1e-6);
      }
      expect(s.lines[id].last.output).toBeLessThanOrEqual(st.at(-1)!.throughput + 1);
    }
  });

  it('a slow stage starves the stages after it; widening it helps', () => {
    let s = structuredClone(newGame({ seed: 3, difficulty: 'easy' }));
    s.lines.tamir.wip = s.lines.tamir.wip.map(() => 0);
    s.lines.tamir.debottleneck = [0, 0, 0, 0];
    // Make guidance integration the bottleneck by widening everything else.
    s.lines.tamir.debottleneck[0] = 2;
    s.lines.tamir.debottleneck[2] = 2;
    s = endTurn(s);
    expect(s.lines.tamir.stages[1].limit).toBe('capacity');
    expect(s.lines.tamir.stages[2].limit).toBe('starved');
    const before = stageCaps(s, 'tamir')[1];
    s = applyAction(rich(s), { type: 'debottleneck', line: 'tamir', stage: 1 });
    expect(validateAction(s, { type: 'debottleneck', line: 'tamir', stage: 0 })).toMatch(/already being widened/);
    s = playTurn(s, resolveAll(s));
    s = playTurn(s, resolveAll(s));
    expect(s.lines.tamir.debottleneck[1]).toBe(1);
    expect(stageCaps(s, 'tamir')[1]).toBeGreaterThan(before * 1.15);
  });

  it('experience improves yields', () => {
    const s = newGame({ seed: 4 });
    const fresh = endTurn(s);
    const veteran = structuredClone(s);
    veteran.lines.gmlrs.experience = 1e9;
    const vet = endTurn(veteran);
    const scrapRate = (g: GameState) => g.lines.gmlrs.stages.reduce((a, x) => a + x.scrap, 0) / g.lines.gmlrs.stages.reduce((a, x) => a + x.throughput, 0);
    expect(scrapRate(vet)).toBeLessThan(scrapRate(fresh));
  });
});

describe('test cells', () => {
  it('acceptance testing is limited by campus test-cell hours', () => {
    let s = structuredClone(newGame({ seed: 5, difficulty: 'easy' }));
    s.campuses.corran.testCells = 1;
    s = endTurn(s);
    const pac3 = s.lines.pac3.stages.at(-1)!;
    const sm6 = s.lines.sm6.stages.at(-1)!;
    const hours = pac3.throughput * STAGES.pac3.at(-1)!.testHours! + sm6.throughput * STAGES.sm6.at(-1)!.testHours!;
    expect(hours).toBeLessThanOrEqual(TEST_CELL_HOURS + 0.5);
    expect([s.lines.pac3.last.limit, s.lines.sm6.last.limit]).toContain('tests');
    expect(s.campuses.corran.lastTestHours.need).toBeGreaterThan(s.campuses.corran.lastTestHours.avail);
  });

  it('new test cells open after construction', () => {
    let s = applyAction(rich(newGame({ seed: 5 })), { type: 'buildTestCell', campus: 'northgate' });
    const cells = s.campuses.northgate.testCells;
    for (let i = 0; i < 3; i++) s = playTurn(s, resolveAll(s));
    expect(s.campuses.northgate.testCells).toBe(cells + 1);
  });
});

describe('first-article inspection', () => {
  it('new capacity does nothing until it passes inspection (longer on hard)', () => {
    const expand = (difficulty: 'easy' | 'hard') => applyAction(rich(newGame({ seed: 6, difficulty })), { type: 'expandLine', line: 'gmlrs' });
    expect(expand('easy').lines.gmlrs.tranches[1].faiMonths).toBe(0);
    let s = expand('hard');
    expect(s.lines.gmlrs.tranches[1].faiMonths).toBe(2);
    s = playTurn(s, resolveAll(s));
    expect(s.lines.gmlrs.tranches[1].maturity).toBeCloseTo(0.3);
    s = playTurn(s, resolveAll(s));
    s = playTurn(s, resolveAll(s));
    expect(s.lines.gmlrs.tranches[1].maturity).toBeGreaterThan(0.3);
  });
});

describe('in-house plants', () => {
  it('a motor plant takes time to build, needs crew, and then feeds the shared stock', () => {
    let s = applyAction(rich(newGame({ seed: 7, difficulty: 'easy' })), { type: 'buildFacility', facility: 'motorWorks' });
    expect(s.facilities.motorWorks.status).toBe('building');
    expect(validateAction(s, { type: 'buildFacility', facility: 'motorWorks' })).toMatch(/under construction/);
    const crewBefore = campusCrewNeed(s, 'ashford');
    while (s.facilities.motorWorks.status === 'building') s = playTurn(s, resolveAll(s));
    expect(campusCrewNeed(s, 'ashford')).toBeGreaterThan(crewBefore);
    s = playTurn(s, resolveAll(s));
    s = playTurn(s, resolveAll(s));
    expect(s.facilities.motorWorks.lastOutput).toBeGreaterThan(0);
    expect(s.facilities.motorWorks.lastOutput).toBeLessThanOrEqual(FACILITIES.motorWorks.baseCap);
  });

  it('plants can be idled and expanded', () => {
    let s = structuredClone(rich(newGame({ seed: 7 })));
    s.facilities.arsenalForge = { id: 'arsenalForge', status: 'running', monthsLeft: 0, tranches: [{ capacity: 8000, maturity: 1, base: true, faiMonths: 0 }], run: 'normal', lastOutput: 0, lastLimit: null };
    s = applyAction(s, { type: 'expandFacility', facility: 'arsenalForge' });
    expect(s.facilities.arsenalForge.tranches).toHaveLength(2);
    s = applyAction(s, { type: 'setFacilityRun', facility: 'arsenalForge', run: 'idle' });
    s = endTurn(s);
    expect(s.facilities.arsenalForge.lastOutput).toBe(0);
  });
});

describe('save migration', () => {
  it('upgrades a version 2 save instead of discarding it', () => {
    const s = endTurn(newGame({ seed: 8 }));
    const old = JSON.parse(serialize(s));
    old.version = 2;
    delete old.facilities;
    for (const l of Object.values(old.lines) as Record<string, unknown>[]) {
      delete l.wip;
      delete l.debottleneck;
      delete l.debottlenecking;
      delete l.stages;
      for (const t of l.tranches as Record<string, unknown>[]) delete t.faiMonths;
    }
    for (const c of Object.values(old.campuses) as Record<string, unknown>[]) {
      delete c.testCells;
      delete c.testCellBuilds;
      delete c.lastTestHours;
    }
    const up = deserialize(JSON.stringify(old));
    expect(up).not.toBeNull();
    expect(up!.version).toBe(3);
    expect(up!.facilities.motorWorks.status).toBe('none');
    // And it keeps playing.
    const next = endTurn(up!);
    expect(next.month).toBe(s.month + 1);
  });
});
